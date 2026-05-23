require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    custom: {
      url: process.env.NETWORK_RPC_URL || "http://127.0.0.1:8545",
      accounts: 
        process.env.PRIVATE_KEY && 
        process.env.PRIVATE_KEY !== "your_deployer_private_key_here" && 
        (process.env.PRIVATE_KEY.length === 64 || process.env.PRIVATE_KEY.length === 66)
          ? [process.env.PRIVATE_KEY]
          : ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"], // Fallback to Hardhat Account #0 default key
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
