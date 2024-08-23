import { runStress } from './stress';
import { ethers } from 'ethers';
import { namedAccount, namedAddress } from './accounts';

function randomInRange(maxSize: number): number {
    return Math.ceil(Math.random() * maxSize);
}

function generateRandomBytes(size: number): string {
    let result = '';
    const hexChars = '0123456789abcdef';
    for (let i = 0; i < size; i++) {
        const byte = Math.floor(Math.random() * 256);
        result += hexChars[(byte >> 4) & 0xf] + hexChars[byte & 0xf]; // Convert byte to two hex characters
    }
    return result;
}

function generateRandomHexData(size: number): string {
    return '0x' + generateRandomBytes(size);
}

async function sendTransaction(argv: any, threadId: number) {
    console.log("sending tx from", argv.from, "to", argv.to)
    const account = namedAccount(argv.from, threadId).connect(argv.provider)
    const startNonce = await account.getTransactionCount("pending")
    for (let index = 0; index < argv.times; index++) {
        const response = await 
            account.sendTransaction({
                to: namedAddress(argv.to, threadId),
                value: ethers.utils.parseEther(argv.ethamount),
                data: argv.data,
                nonce: startNonce + index,
            })
        console.log(response)
        if (argv.wait) {
          const receipt = await response.wait()
          console.log(receipt)
        }
        if (argv.delay > 0) {
            await new Promise(f => setTimeout(f, argv.delay));
        }
    }
}

// flood simulation
async function simulateNetworkFlood(argv: any) {
    // fund the users
    console.log(`fund all users`)
    const funding_argv = {
        ...argv,
        ethamount: "100000",
        times: 1,
        threads: 1,
        wait: true,
        from: `funnel`
    }
    for (let i = 0; i < argv.users; i++) {
        funding_argv.to = `user_${i}`
        await runStress(funding_argv, sendTransaction)
    }
    
    console.log(`start sending transactions`)
    const max_time = argv.times
    const max_thread = argv.threads
    for (let i = 0; i < argv.rounds; i++) {
        argv.from = `user_${randomInRange(argv.users)}`;
        argv.times = randomInRange(max_time)
        argv.threads = randomInRange(max_thread)
        argv.to = `user_${randomInRange(argv.users)}`; // don't care if sending to self
        const size = randomInRange(argv.maxTxDataSize)
        argv.data = generateRandomHexData(size);

        console.log(`prepared transactions`, { transaction_count: i, size: size, from: argv.from, to: argv.to})
        await runStress(argv, sendTransaction);
    }
}


export const floodCommand = {
    command: "flood",
    describe: "Simulates network activity by sending arbitrary transactions among random users",
    builder: {
      users: {
        number: true,
        describe: "Number of active users",
        default: 10,
      },
      ethamount: {
        string: true,
        describe: "Amount of ETH to send in each transaction",
        default: "0.1",
      },
      rounds: {
        number: true,
        describe: "Number of rounds of transactions to send (total transactions = rounds * threads * times)",
        default: 10000,
      },
      avgTxDataSize: {
        number: true,
        describe: "Average transaction data size in bytes",
        default: 100,
      },
      // this is something we can read from the rollup creator
      maxTxDataSize: {
        number: true,
        describe: "Maximum transaction data size in bytes",
        default: 58982,
      },
      threads: {
        number: true,
        describe: "Number of threads per transaction",
        default: 100,
      },
      times: {
        number: true,
        describe: "Number of transactions per thread",
        default: 10,
      },
      delay: {
        number: true,
        describe: "Delay between transactions in milliseconds",
        default: 0,
      },
      serial: {
        boolean: true,
        describe: "Run transactions serially (in sequence)",
        default: false,
      },
      wait: {
        boolean: true,
        describe: "Wait for transaction confirmations",
        default: false,
      },
    },
    handler: async (argv: any) => {
        argv.provider = new ethers.providers.WebSocketProvider(argv.l2url);
        await simulateNetworkFlood(argv);
        argv.provider.destroy();

    },
  };

