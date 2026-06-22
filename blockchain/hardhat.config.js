require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const defaultLocalPrivateKey =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function resolveDeployPrivateKey() {
  const key =
    process.env.PRIVATE_KEY ||
    process.env.BLOCKCHAIN_OWNER_PRIVATE_KEY ||
    process.env.SUPER_ADMIN_PRIVATE_KEY ||
    defaultLocalPrivateKey;

  if (
    key &&
    key !== "your_deployer_private_key_here" &&
    /^0x?[0-9a-fA-F]{64}$/.test(key)
  ) {
    return key.startsWith("0x") ? key : `0x${key}`;
  }

  return defaultLocalPrivateKey;
}

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
      accounts: [resolveDeployPrivateKey()],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
