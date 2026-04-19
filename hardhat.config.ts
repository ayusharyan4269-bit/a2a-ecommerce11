import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

// Use the Hardhat-specific tsconfig (CommonJS) instead of Next.js bundler config
// This fixes: ERR_UNKNOWN_FILE_EXTENSION ".ts"
process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT || "tsconfig.hardhat.json";

dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env

const PRIVATE_KEY  = process.env.PRIVATE_KEY  || "";
const SEPOLIA_RPC  = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    sepolia: {
      url: SEPOLIA_RPC,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
