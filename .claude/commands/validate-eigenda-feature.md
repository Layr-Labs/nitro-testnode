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


### Scenario 3 - EigenDA with Validation Enabled & TokenBridge Enabled

**Phase 0: Update Config**
In `scripts/config.ts`, set:
  - `enable-eigenda-failover` to `false`

**Phase 1: Spinup Cluster**
```
./test-node.bash --init --eigenda --validate --tokenbridge --build-utils
```

**Phase 2: Check Docker Services**
- eigenda_proxy
- poster
- sequencer
- validator
- geth
- validation_node

**Phase 3: Create and Bridge ERC20 Token**

Create a bridgeable ERC20 token that deploys to both L1 and L2:
```
docker compose run scripts create-erc20 --deployer l2owner --bridgeable
```

Expected output:
```
Contract deployed at L1 address: 0x...
Contract deployed at L2 address: 0x...
```

Save the L2 token address for the next step.

**Phase 4: Test ERC20 Token Transfer on L2**

Transfer ERC20 tokens on L2 to verify the bridged token is operational:
```
docker compose run scripts transfer-erc20 --from l2owner --to user_alice --amount 1000 --token <L2_TOKEN_ADDRESS>
```

This command should complete successfully, confirming the TokenBridge ERC20 functionality.

**Phase 5: Run Validation Checks**

Run all standard validation checks (Test Cases 1-3) to ensure:
- Batches containing TokenBridge activity are posted to EigenDA
- Delayed messages from TokenBridge operations are processed
- Validator successfully validates blocks with TokenBridge transactions

Check for specific TokenBridge activity in logs:
```bash
# Check batch posting with TokenBridge delayed messages
docker compose logs poster | grep "batch sent" | tail -5

# Check for delayed messages from TokenBridge operations
docker compose logs sequencer | grep "Added DelayedMessages" | tail -5

# Verify validation succeeded for blocks with TokenBridge activity
docker compose logs validator | grep "validated execution" | tail -5
```

Expected observations:
- Batches show `eigenDA=true` with incrementing delayed message counters
- Delayed messages increment from TokenBridge operations (token creation, transfers)
- Validator logs show successful validation with consistent WasmRoots

**Phase 6: Teardown**
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

### Scenario 5 - EigenDA with Validation Enabled & Timeboost Express Lane

**Phase 0: Update Config**
In `scripts/config.ts`, ensure:
  - `enable-eigenda-failover` is set to `false`
  - Timeboost config uses correct path: `sequencerConfig.execution.sequencer.timeboost` (NOT `.dangerous.timeboost`)
  - Lines 334-339 should be uncommented and use the correct path

**Phase 1: Spinup Cluster**
```
./test-node.bash --init --eigenda --validate --l2-timeboost --build-utils
```

**Phase 2: Check Docker Services**
- eigenda_proxy
- poster
- sequencer
- validator
- geth
- validation_node
- redis
- timeboost-auctioneer
- timeboost-bid-validator

**Phase 3: Run Standard Validation Checks**

Run all standard validation checks (Test Cases 1-3) to ensure:
- Batches are posted to EigenDA with timeboost enabled
- Delayed messages are processed correctly
- Validator successfully validates blocks

**Phase 4: Verify Timeboost Configuration and Services**

Verify that timeboost is properly configured and operational:

1. Check sequencer timeboost configuration:
```bash
docker compose exec sequencer cat /config/sequencer_config.json | python3 -m json.tool | grep -A 10 timeboost
```

Expected output:
```json
"timeboost": {
    "enable": true,
    "auction-contract-address": "0x...",
    "auctioneer-address": "0x...",
    "redis-url": "redis://redis:6379"
}
```

2. Check sequencer logs for timeboost express lane activity:
```bash
docker compose logs sequencer | grep -E "timeboost|express lane|EigenDA"
```

Expected observations:
- `INFO EigenDA enabled failover=false anytrust=false`
- `INFO Reading blob from EigenDA batchID=X`
- `INFO Watching for new express lane rounds`
- `INFO Monitoring express lane auction contract via resolvedRounds`
- `INFO New express lane auction round round=X timestamp=...`

3. Verify timeboost-auctioneer service is functioning:
```bash
docker compose logs timeboost-auctioneer | tail -20
```

Expected observations:
- `INFO New auction closing time reached closingTime=... totalBids=0`
- `INFO No bids received for auction resolution round=X` (expected when no bidders active)
- Auctions running every 60 seconds
- No errors or fatal crashes

4. Send test transactions:
```bash
docker compose run scripts send-l2 --ethamount 5 --to user_alice --wait
docker compose run scripts send-l2 --ethamount 5 --to user_bob --wait
```

Expected: Transactions process successfully through the timeboost-enabled sequencer

**Phase 5: Verify EigenDA + Timeboost Integration**

Check that batches containing timeboost transactions are properly posted to EigenDA:

```bash
# Check batch posting with timeboost enabled
docker compose logs poster | grep "batch sent" | tail -10

# Verify EigenDA dispersion
docker compose logs poster | grep "Dispersing batch" | tail -5
```

Expected observations:
- Batches show `eigenDA=true` indicating EigenDA is active
- No errors dispersing batches to EigenDA with timeboost enabled
- Batch sequence numbers incrementing correctly

**Phase 6: Run Final Validation Checks**

Re-run Test Cases 1-3 to ensure continued stability:
- Batch posting continues successfully with both EigenDA and timeboost active
- Validation succeeding with consistent WasmRoots
- No death loops or terminal errors

Check validator logs for blocks containing timeboost transactions:
```
docker compose logs validator | grep "validated execution" | tail -10
```

Expected observations:
- Validator successfully validates blocks with timeboost enabled
- Consistent WasmRoots across validations
- MessageCount and Batch numbers properly incrementing

**Phase 7: Teardown**
Tear down compose cluster
In `scripts/config.ts`, set:
  - `enable-eigenda-failover` back to `true` (if modified)
