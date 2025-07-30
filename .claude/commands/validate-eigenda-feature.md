# Validate EigenDA Feature

The purpose of this document is to provide an AI agent with a framework for doing manual verification checks on a local Arbitrum Nitro testnode cluster. All output files will be saved to a `{validation_summary}`, which should be named `{session_timestamp}_validation_summary.md` and placed inside the original log directory.

## Context
Sometimes when running the `./testnode-bash` script:
- The cluster can fail to start if existing resources are in conflict. If this happens, rerun the command.
- The script will prompt for user input. In this case run `echo "y" | ./test-node.bash ${FLAGS}`
- The sequencer may hang on start with no log progression after the `EigenDA Enabled` log appears. In this case, restart the container.

**Important**: 
- The initialization command can take up to 10 minutes to complete. Be patient and wait for all containers to be provisioned.
- If there's already a testnode cluster up before beginning Scenario 0, tear it down before proceeding forward.
- Test cases can only be marked as passed or failed. For each one you will need to attach a deductive summary explaining why it was marked so.
- `{session_timestamp}_validation_summary.md` is the **only** output file and should be formatted like:

```
EigenDA Manual Test Validation Summary

Nitro container used: {$NITRO_NODE_VERSION in test-node.bash}
WASM Module root used: {$WASM_MODULE_ROOT in validator logs}

Test Summary:
- Scenario xx:
    - Test case 1 (ensure that batches can be made): PASS

Testing Analysis:
- Scenario xx:
    - Test case 1: Observed batch posting logs with expected parameters. No errors found.
```

These tests can take place on two rollup domains:
- Layer 2 that settles to Ethereum
- Layer 3 that settles to Layer 2 Orbit chain

## How to test

Generate a `session_timestamp` for this test execution and store it in your context using the current date/time:

```
date +%Y%m%d_%H%M%S
```

### Validation Test Cases

These steps should be run for every test scenario. The first thing you should do is snapshot the poster, sequencer, and validator logs into `.claude-cache/${session_timestamp}-logs.txt` for future reference after executing system commands. After running `script` commands, always wait at least 5 seconds before parsing new service logs. Focus only on logs not previously seen in `.claude-cache/${session_timestamp}-logs.txt`.

#### Test Case 1: Ensure that batches can be made

Run the following command 5 times to stimulate batch posting:
```
docker compose run scripts send-l2 --ethamount 10 --to user_alice --wait
```

Then check the batch poster logs:
```
docker compose logs poster
```

Expected: No terminal errors like:
- Death loops of `execution reverted`
- Continuous `ERROR` messages

#### Test Case 2: Ensure that deposits can be made

Bridge native ETH to L2:
```
docker compose run scripts bridge-funds --ethamount 100000 --wait
```

Expected logs:
- On `sequencer`:
  ```
  ExecutionEngine: Added DelayedMessages   pos=X delayed=X
  ```
- On `poster`:
  ```
  BatchPoster: batch sent eigenDA=true ... prevDelayed=1 currentDelayed=10 ...
  ```

#### Test Case 3: Ensure that validations are succeeding and state roots are being submitted

Check validator logs:
```
validated execution messageCount=X globalstate="BlockHash: X, SendRoot: 0x..., Batch: S, PosInBatch: X" WasmRoots=[X]
```

Confirm values appear in `poster` and `sequencer` logs as:
```
InboxTracker sequencerBatchCount=X messageCount=X l1Block=X l1Timestamp=...
```

## Scenarios

### Scenario 1 - EigenDA with Arbitrator Interperter Validation Enabled

**Phase 0: Update Config**  
In `scripts/config.ts`, set:
  - `enable-eigenda-failover` to `false`
  - `use-jit` to `true`

**Phase 1: Spinup Cluster**
```
./test-node.bash --init --eigenda --validate --build-utils
```

**Phase 2: Check Docker Services**
- eigenda_proxy
- poster
- sequencer
- validator
- geth
- validation_node

**Phase 3: Run Validation Checks**

**Phase 4: Teardown**
Tear down compose cluster
In `scripts/config.ts`, set:
  - `enable-eigenda-failover` to `true`
  - `use-jit` to `false`

### Scenario 2 - EigenDA with Validation Enabled & AnyTrust Failover Enabled

**Phase 0: Update Config**  
Set `enable-eigenda-failover` to `true`

**Phase 1: Spinup Cluster**
```
./test-node.bash --init --eigenda --validate --l2-anytrust --build-utils
```

**Phase 2: Check Docker Services**
- all services from Scenario 1
- das-committee-a
- das-committee-b
- das-mirror

**Phase 3: Run Validation Checks**

**Phase 4: Trigger Failover Condition**
A failover can be triggered by updating the memconfig used by `eigenda_proxy`'s ephemeral memstore instance.
```
curl -X PATCH http://localhost:4242/memstore/config -d '{"PutReturnsFailoverError": true}'
```

**Phase 5: Run Validation Checks Again**


**Phase 6: Trigger EigenDA Back Online**
A healthy EigenDA can be triggered by updating the memconfig used by `eigenda_proxy`'s ephemeral memstore instance.
```
curl -X PATCH http://localhost:4242/memstore/config -d '{"PutReturnsFailoverError": false}'
```

**Phase 7: Run Validation Checks Again**

**Phase 8: Teardown**
Tear down compose cluster
In `scripts/config.ts`, set:
  - `enable-eigenda-failover` to `false`


### Scenario 3 - EigenDA with Validation Enabled && 4844 Failover Enabled
**Phase 0: Update Config**  
Set `enable-eigenda-failover` to `true`

**Phase 1: Spinup Cluster**
```
./test-node.bash --init --eigenda --validate --pos
```


### Scenario 3 - EigenDA with Validation Enabled & TokenBridge Enabled

**Phase 1: Spinup Cluster**
```
./test-node.bash --init --eigenda --validate --tokenbridge
```

**Phase 2: Check Docker Services**
- eigenda_proxy
- poster
- sequencer
- validator
- geth
- validation_node

**Phase 3: Deposit ERC20 tokens**

**Phase 3: Run Validation Checks**

**Phase 4: Teardown**
Tear down compose cluster

### Scenario 4 - Layer2 using EigenDA with Validation Enabled && Layer3 using EigenDA wtih custom gas token

**Phase 1: Spinup Cluster**
```
./test-node.bash --init --eigenda --validate --l3node --l3-fee-token 
```

**Phase 2: Check Docker Services**
- eigenda_proxy
- poster
- sequencer
- validator
- geth
- validation_node
- (layer3) l3node

**Phase 3: Deposit ERC20 tokens**

**Phase 3: Run Validation Checks for Layer 2**

After doing these checks, now validate the l3node logs. The l3node runs a batch poster, validator, & sequencer components all on the same instance. Do the
same validation checks done before but now for these components.

**Phase 4: Teardown**
Tear down compose cluster