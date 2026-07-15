require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

function resolveCustomAccounts() {
  const key =
    process.env.PRIVATE_KEY ||
    process.env.BLOCKCHAIN_OWNER_PRIVATE_KEY ||
    process.env.SUPER_ADMIN_PRIVATE_KEY;

  if (!key) {
    return [];
  }

  if (
    key !== "your_deployer_private_key_here" &&
    /^(?:0x)?[0-9a-fA-F]{64}$/.test(key)
  ) {
    return [key.startsWith("0x") ? key : `0x${key}`];
  }

  throw new Error("Invalid custom deploy private key. Set PRIVATE_KEY as a 64-hex-character key.");
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
      accounts: resolveCustomAccounts(),
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
