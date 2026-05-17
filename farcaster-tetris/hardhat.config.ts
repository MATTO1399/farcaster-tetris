import 'dotenv/config';
import { HardhatUserConfig } from 'hardhat/config';
process.env.TS_NODE_PROJECT = './tsconfig.hardhat.json';

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY?.trim() ?? '';
const hasPrivateKey = /^0x[a-fA-F0-9]{64}$/.test(DEPLOYER_PRIVATE_KEY);

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      evmVersion: 'cancun',
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {
      type: 'edr-simulated',
      chainType: 'l1',
    },
    baseSepolia: {
      type: 'http',
      chainType: 'op',
      url: process.env.BASE_SEPOLIA_RPC_URL || '',
      chainId: 84532,
      accounts: hasPrivateKey ? [DEPLOYER_PRIVATE_KEY] : [],
    },
    base: {
      type: 'http',
      chainType: 'op',
      url: process.env.BASE_MAINNET_RPC_URL || '',
      chainId: 8453,
      accounts: hasPrivateKey ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};

export default config;
