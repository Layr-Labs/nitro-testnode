# Validate Upgrade
The purpose of this document is to provide an AI agent with a framework for performing an upgrade between nitro versions. Please advise the [Arbitrum Version Management](https://hackmd.io/@epociask/HkJragrhkx) writeup for deeper context on what versioning schemas exist for an Arbitrum blockchain.

## Agent Context
**Behavior**

You are a blockchain engineer who values precision, security, and correctness. You will utilize chain-of-thought prompting to better rationalize and ensure better conciseness with your decision making.

**Goal**

Apply an Arbitrum upgrade and validate its correctness. Your validation will be embedded into an output markdown report for user consumption so your thinking and procedural execution can be validated.


## Required Input Flags
```
--from (string): the version X.X.X that we're upgrading from
--to  (string): the `version X.X.X that we're upgrading to
--contract-action (optional, document): the contract action used for upgrading parent chain artifacts
```

## Upgrade Types
### Consensus
#### Detection

Detecting a consensus change requires comparing the `wasm-module-root.txt` contents between `from` and `to` containers. *If they differ* then `consensus` should be added to the `upgrade_actions` set.

The `wasm-module-root.txt` for `from` and `to` can be found extracted by:
1. docker create --name `test-upgrade-{from || to}` `{from || to}`
2. `docker cp test-upgrade-{from || to}:/home/user/target/machines/latest/module-root.txt module-root-{from || to}.txt`

After doing this check, delete the `module-root-{from}.txt` and containers `test-upgrade-{from || to}`. The `module-root-{to}.txt` should be preserved for when performing the upgrade later on.

**CRITICAL**: Before proceeding with the upgrade, validate that the extracted WASM module root from the `from` version matches what the validator is actually using:
```bash
docker compose logs validator | grep -i "wasm\|module"
```
Look for log entries showing the WASM module root in use. This ensures the detected consensus change is accurate.


#### Performing Upgrade
Upgrading the consensus module root requires executing a parent chain transaction against the `Upgrade Executor` contract to set a new `wasmModuleRoot` in the `Rollup` contract.

You will do this via a cast command of the following structure:
```bash
cast send ${UPGRADE_EXECUTOR_ADDRESS} \
  "executeCall(address,bytes)" \
  ${ROLLUP_ADRESS} \
  "0x89384960${WASM_MODULE_ROOT}" \
  --rpc-url http://localhost:8545 \
  --private-key ${ROLLUP_OWNER_PRIVATE_KEY}
```

where env vars can be extracted via:
- `deployment.json` file stored in `nitro-testnode_config`
- scripts commands

Extracting `deployment.json` requires copying the file from the sequencer container's mounted volume:
```bash
docker cp nitro-testnode-sequencer-1:/config/deployment.json .
```
Now you can extract env like:
```bash
export ROLLUP_ADRESS=$(cat deployment.json | jq '.rollup')

export UPGRADE_EXECUTOR_ADDRESS=$(cat deployment.json | jq '."upgrade-executor"')

export ROLLUP_OWNER_PRIVATE_KEY=$(docker compose run scripts print-private-key --account l2owner)

export WASM_MODULE_ROOT=$(cat module-root-to.txt)
``` 

Once all env is properly extracted, you can execute the command. If the transaction returns a non-status 1 please prompt the user for remediation/help. If the transaction is status 1, then continue.

**POST-CONSENSUS UPGRADE VALIDATION**: After the consensus upgrade transaction succeeds, verify the validator transitions to using only the new WASM module root:
```bash
docker compose logs validator | grep -i "wasm\|module\|validated"
```
Look for entries showing `WasmRoots=[new_root_only]` and successful validation with the new WASM root exclusively.


## Expected Output Format
```markdown
# [System/Project] Upgrade Validation Report: [From Version] → [To Version]

## Executive Summary
[Brief summary of the upgrade outcome — include major changes detected and overall status.]

**WASM Module Root Transition Verified**: 
- **Pre-upgrade**: [Summary of validator supporting both WASM roots during transition]
- **Post-consensus upgrade**: [Summary of validator exclusively using new WASM root]
- **Validation continuity**: [Summary of validator processing messages successfully with new WASM root]

## Upgrade Parameters
- **From Version**: [From Version]
- **To Version**: [To Version]
- **Contract Action**: [If applicable]
- **Upgrade Types Performed**:
  - Node Software Bump [✅/❌]
  - Consensus Change [✅/❌]

## Consensus Change Analysis
### WASM Module Root Comparison
- **[From Version]**: `[old_root_hash]`
- **[To Version]**: `[new_root_hash]`
- **Status**: [⚠️/✅] **[Summary of consensus change detection]**

### WASM Root Transition Evidence (only if wasm root was updated)
**Proof of dual WASM root support during transition (pre-consensus upgrade):**
```
[Include actual validator log entries showing dual WASM root support]
```

**Proof of exclusive new WASM root usage (post-consensus upgrade):**
```  
[Include actual validator log entries showing exclusive new WASM root usage]
```

**Proof of validator detecting WASM root progression:**
```
[Include validator log showing detection of new WASM root]
```

### Consensus Upgrade Transaction
- **Rollup Address**: `[address]`
- **Upgrade Executor Address**: `[address]`
- **New WASM Module Root**: `[hash]`
- **Transaction Status**: [⚠️/✅] **[Status details]**
- **Required Action**: [Instructions for next steps]

## Node Software Bump
### Upgrade Process
1. **Pre-upgrade Validation**: [Pass/Fail & notes]
2. **Service Orchestration**: [Details of service handling]
3. **Image Management**: [Details on image tagging/pulling]
4. **Configuration Update**: [Details]
5. **Service Restart**: [Pass/Fail & notes]
6. **Post-upgrade Validation**: [Pass/Fail & notes]

### Service Status After Upgrade
[List all relevant services and their status]

## Chain-of-Thought Analysis
1. **Version Validation**: [Observations]
2. **Consensus Detection**: [Observations]
3. **Upgrade Strategy**: [Observations]
4. **Risk Mitigation**: [Observations]
5. **Validation Approach**: [Observations]

## Validation Results
### Functional Testing
- **Service Health**: [✅/❌ + details]
- **Account Access**: [✅/❌ + details]
- **Network Connectivity**: [✅/❌ + details]
- **Other Issues**: [Details]

### Performance Metrics
- **Upgrade Duration**: [Value]
- **Downtime**: [Value]
- **Data Loss**: [Value]

## Security Considerations
- **Private Key Management**: [Details]
- **Contract Verification**: [Details]
- **Rollup Integrity**: [Details]

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]
4. [Recommendation 4]

## Next Steps
1. [Step 1 — with commands if applicable]
2. [Step 2]
3. [Step 3]

## Conclusion
**Status**: [✅/⚠️/❌] **[Summary of final upgrade outcome]**

---
*Generated on [Date/Time UTC]*  
*Validation performed by [Name/Tool/Agent version]*
```

## Subprocedures
### Flag Validation and Context Processing
You will manage a set of `upgrade_actions` that need to take place. You will populate this set via the following procedure. Assume that at step #1 that the set is initialized like `[node_software_bump]`.

**Steps**
1. Ensure that the upgrade type provided maps to a real enum defined in the [defined type names](#upgrade-types)
2. For versions; ensure that:
    - `from` and `to` version strings reference real containers published to the `layr-labs/nitro` (i.e, ghcr.io/layr-labs/nitro/nitro-node:<version>) by performing `docker pull` commands.
    - `from != to`
3. Understand if upgrade type is `consensus` based on [detection criteria](#consensus), if so append `consensus` to set.

### Node Software Bump
**Context**
Upgrading the node software requires careful orchestration of the existing nitro-testnode docker network resources. Specifically, the following services **must** not go down:
- *redis* since it is used to manage a coordination lock for the sequencer and the sequencer is torn down in-conjuction then its local volume could become corrupted
- *eigenda_proxy* 
- *minio*

**Procedure**
1. Tear down all services except for those mentioned in the context above using `docker compose stop [service-names]`
2. Tag (`docker tag`) the `to` container as `nitro-node-dev-testnode-to`
3. Update all image references from `nitro-node-dev-testnode` to `nitro-node-dev-testnode-to` within `docker-compose.yaml` using `replace_all=true`
4. Restart services with new image: `docker compose up -d sequencer poster validator validation_node`
5. Verify all services are running: `docker compose ps`
6. **VALIDATE DUAL WASM ROOT SUPPORT**: Check validator logs to confirm it supports both old and new WASM roots during the transition:
```bash
docker compose logs validator | grep -i "wasm\|module"
```
Look for entries like: `WasmRoots="[old_root new_root]"` indicating dual support during transition period

## Procedure
### Assumptions
1. Every upgrade executed by this command will require performing a [Node Software Bump](#node-software-bump)
2. Every upgrade should use a *nitro-node* target image and not a *nitro-node-dev* one
3. Checks done on system flow correctness (i.e, batch posting, derivation for validation) should be leveraged from [validate-eigenda-feature scenario 1](./validate-eigenda-feature.md#scenario-1---eigenda-with-arbitrator-interperter-validation-enabled)

### Steps
1. Before proceeding forward, please process the above [assumptions](#assumptions) into your context
2. If not already provided, fetch [Required Input Flags](#required-input-flags) from the user and populate `upgrade_actions` set based on detection criteria
3. **Initial Cluster Setup**: Using the [validate-eigenda-feature scenario 1](./validate-eigenda-feature.md#scenario-1---eigenda-with-arbitrator-interperter-validation-enabled), spinup and validate a local cluster with the `from` version. If the cluster startup fails due to network connectivity issues during container builds, try without `--init --build-utils` flags and manually start required services. YOU WILL NEED TO PROCESS the `validate-eigenda-feature.md` into your context to understand the precise standup/validation steps.
4. **Pre-upgrade EigenDA Validation**: Run the three test cases from EigenDA Scenario 1:
   - Test Case 1: Batch posting (run 5 L2 transactions)
   - Test Case 2: L1 to L2 deposits  
   - Test Case 3: Validator state root validation
   Wait at least 5 seconds between test operations for service stabilization.
5. In linear order, iterate over the `upgrade_actions` and perform each action one by one. If any action fails prompt the user for manual intervention.
6. **Post-upgrade EigenDA Validation**: Using the same checks from step 4, validate correctness of key system flows after the upgrade
7. **Evidence Collection**: Throughout the upgrade process, capture validator logs showing:
   - Initial WASM root usage
   - Dual WASM root support during node software bump  
   - Transition to exclusive new WASM root after consensus upgrade
8. Generate a prettified report using the [output format](#expected-output-format) into `./validation_summaries/{from}_to_{to}_upgrade_validation_report.md`, including actual validator log entries as proof
9. Optional: Tear down all docker resources and ensure any intermediary files (e.g, `module-root.txts`) are removed as well