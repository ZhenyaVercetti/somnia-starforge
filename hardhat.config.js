require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const path = require("path");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } = require("hardhat/builtin-tasks/task-names");

// Remix dumps OpenZeppelin copies into contracts/.deps — never compile them.
subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(async (_, __, runSuper) => {
  const paths = await runSuper();
  return paths.filter((p) => {
    const normalized = p.split(path.sep).join("/");
    return !normalized.includes("/.deps/") && !normalized.endsWith("/.deps");
  });
});

function getAccounts() {
  const raw = process.env.PRIVATE_KEY;
  if (!raw || raw.trim() === "" || raw.trim() === "0x") {
    return [];
  }

  const key = raw.trim().startsWith("0x") ? raw.trim() : `0x${raw.trim()}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      "PRIVATE_KEY in .env is invalid. Expected 64 hex characters (optional 0x prefix). Do not use a mnemonic here."
    );
  }

  return [key];
}

const accounts = getAccounts();

module.exports = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  defaultNetwork: "somniaTestnet",
  networks: {
    hardhat: {
      chainId: 31337
    },
    somniaTestnet: {
      url: process.env.SOMNIA_TESTNET_RPC || "https://dream-rpc.somnia.network",
      chainId: 50312,
      accounts
    },
    somniaMainnet: {
      url: process.env.SOMNIA_MAINNET_RPC || "https://REPLACE_WITH_SOMNIA_MAINNET_RPC",
      chainId: 5031,
      accounts
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
