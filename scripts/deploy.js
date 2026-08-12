/**
 * Deploy a NEW StarForgeGame. Does not redeploy NFT / Relic / PlayerProfile.
 *
 * One-time setup
 *   1. From the project root: npm install
 *   2. Copy .env.example to .env
 *   3. Put the deployer private key into PRIVATE_KEY (hex only, never commit .env)
 *   4. Confirm UNIT_NFT_ADDRESS, RELIC_ADDRESS, PLAYER_PROFILE_ADDRESS
 *      Testnet defaults = DEPLOYMENT.md. Mainnet requires explicit values.
 *
 * Run
 *   npx hardhat run scripts/deploy.js --network somniaTestnet
 *   npm run deploy:testnet
 *
 *   npx hardhat run scripts/deploy.js --network somniaMainnet
 *   (only after SOMNIA_MAINNET_RPC and mainnet addresses are set)
 *
 * This script does NOT call setGameContract / setRelicContract.
 * Linking stays a separate owner step so a bad deploy cannot rewrite live pointers.
 */

const hre = require("hardhat");

// DEPLOYMENT.md — single source of truth for current testnet addresses (20 May 2026).
const TESTNET_DEFAULTS = {
  unitNFT: "0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1",
  relic: "0x619e19df1975A8D289545834aAff3FEEf1b84909",
  playerProfile: "0x2C8976ECc9e9bDf939745ee61b1aD858607563d9",
  currentGame: "0x05bcfA66B38259ea33B6986C1f04F028f0129a9F"
};

function requirePrivateKey() {
  const raw = process.env.PRIVATE_KEY;
  if (!raw || raw.trim() === "" || raw.trim() === "0x") {
    throw new Error(
      "PRIVATE_KEY is missing. Copy .env.example to .env and set PRIVATE_KEY to the deployer hex key."
    );
  }
}

function resolveAddress(label, envValue, testnetDefault) {
  const networkName = hre.network.name;
  let value = envValue && envValue.trim() !== "" ? envValue.trim() : "";

  if (!value) {
    if (networkName === "somniaMainnet") {
      throw new Error(
        `${label} is required on somniaMainnet. Set it in .env. DEPLOYMENT.md defaults are testnet only.`
      );
    }
    value = testnetDefault;
  }

  if (!hre.ethers.isAddress(value) || value === hre.ethers.ZeroAddress) {
    throw new Error(`${label} is not a valid non-zero address: ${value}`);
  }

  return hre.ethers.getAddress(value);
}

async function requireOnChainContract(label, address) {
  const code = await hre.ethers.provider.getCode(address);
  if (!code || code === "0x") {
    throw new Error(
      `${label} has no bytecode at ${address}. Check the network and DEPLOYMENT.md / .env addresses.`
    );
  }
}

function printBindingInstructions(newGame, unitNFT, relic, playerProfile, currentGame) {
  console.log("");
  console.log("============================================================");
  console.log("BINDING ORDER — do this after a successful Game deploy");
  console.log("============================================================");
  console.log("");
  console.log("Current addresses (DEPLOYMENT.md testnet, before this deploy):");
  console.log(`  StarForgeUnitNFT:        ${unitNFT}`);
  console.log(`  StarForgeRelic:          ${relic}`);
  console.log(`  StarForgePlayerProfile:  ${playerProfile}`);
  console.log(`  StarForgeGame (old):     ${currentGame}`);
  console.log(`  StarForgeGame (NEW):     ${newGame}`);
  console.log("");
  console.log("AGENTS.md order when updating StarForgeGame.sol:");
  console.log("");
  console.log("1. Already done by this script:");
  console.log(`   Deploy NEW StarForgeGame(_unitNFT, _relic, _playerProfile)`);
  console.log(`   constructor args: ${unitNFT}, ${relic}, ${playerProfile}`);
  console.log("");
  console.log("2. StarForgeUnitNFT.setGameContract(new Game)");
  console.log(`   Contract: ${unitNFT}`);
  console.log(`   Call:     setGameContract("${newGame}")`);
  console.log("");
  console.log("3. NEW StarForgeGame.setRelicContract(current Relic)");
  console.log("   Constructor already set relic. Optional safety call:");
  console.log(`   Contract: ${newGame}`);
  console.log(`   Call:     setRelicContract("${relic}")`);
  console.log("");
  console.log("4. StarForgeRelic.setGameContract(new Game)");
  console.log(`   Contract: ${relic}`);
  console.log(`   Call:     setGameContract("${newGame}")`);
  console.log("");
  console.log("5. StarForgePlayerProfile.setGameContract(new Game)");
  console.log("   Required for XP / wins. Without this the new Game cannot write the profile.");
  console.log(`   Contract: ${playerProfile}`);
  console.log(`   Call:     setGameContract("${newGame}")`);
  console.log("");
  console.log("If you later replace StarForgeUnitNFT:");
  console.log(`   1. Deploy new NFT`);
  console.log(`   2. Current Game.setUnitNFT(new NFT address)`);
  console.log("");
  console.log("If you later replace StarForgeRelic:");
  console.log(`   1. Deploy NEW StarForgeRelic`);
  console.log(`   2. New Relic.setGameContract(current StarForgeGame address)`);
  console.log(`   3. Current Game.setRelicContract(new Relic address)`);
  console.log("");
  console.log("Then:");
  console.log("  - Put the NEW Game address into frontend/src/lib/contractAddresses.ts (GAME_ADDRESS)");
  console.log("  - Update DEPLOYMENT.md only when you explicitly ask for the new text");
  console.log("============================================================");
}

async function main() {
  requirePrivateKey();

  const network = await hre.ethers.provider.getNetwork();
  const networkName = hre.network.name;
  const chainId = Number(network.chainId);

  console.log("----------------------------------------------------------");
  console.log("Somnia StarForge — deploy StarForgeGame");
  console.log(`Network:  ${networkName}`);
  console.log(`Chain ID: ${chainId}`);
  console.log("----------------------------------------------------------");

  if (networkName === "somniaTestnet" && chainId !== 50312) {
    throw new Error(`somniaTestnet must be chain 50312, got ${chainId}`);
  }
  if (networkName === "somniaMainnet" && chainId !== 5031) {
    throw new Error(`somniaMainnet must be chain 5031, got ${chainId}`);
  }
  if (networkName === "somniaMainnet") {
    const rpc = process.env.SOMNIA_MAINNET_RPC || "";
    if (!rpc || rpc.includes("REPLACE_WITH_SOMNIA_MAINNET_RPC")) {
      throw new Error("Set SOMNIA_MAINNET_RPC in .env before deploying to somniaMainnet.");
    }
  }

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error("No signer. Check PRIVATE_KEY and --network.");
  }

  const unitNFT = resolveAddress(
    "UNIT_NFT_ADDRESS",
    process.env.UNIT_NFT_ADDRESS,
    TESTNET_DEFAULTS.unitNFT
  );
  const relic = resolveAddress(
    "RELIC_ADDRESS",
    process.env.RELIC_ADDRESS,
    TESTNET_DEFAULTS.relic
  );
  const playerProfile = resolveAddress(
    "PLAYER_PROFILE_ADDRESS",
    process.env.PLAYER_PROFILE_ADDRESS,
    TESTNET_DEFAULTS.playerProfile
  );

  console.log(`Deployer:         ${deployer.address}`);
  console.log(`UnitNFT:          ${unitNFT}`);
  console.log(`Relic:            ${relic}`);
  console.log(`PlayerProfile:    ${playerProfile}`);

  await requireOnChainContract("UNIT_NFT_ADDRESS", unitNFT);
  await requireOnChainContract("RELIC_ADDRESS", relic);
  await requireOnChainContract("PLAYER_PROFILE_ADDRESS", playerProfile);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${hre.ethers.formatEther(balance)} native`);
  if (balance === 0n) {
    throw new Error("Deployer balance is 0. Fund the wallet on this network before deploying.");
  }

  console.log("");
  console.log("Deploying StarForgeGame...");

  const Game = await hre.ethers.getContractFactory("StarForgeGame");
  const game = await Game.deploy(unitNFT, relic, playerProfile);
  const deployTx = game.deploymentTransaction();

  console.log(`Deploy tx: ${deployTx ? deployTx.hash : "(unknown)"}`);
  await game.waitForDeployment();

  const newGame = await game.getAddress();

  console.log("");
  console.log("DEPLOY OK");
  console.log(`StarForgeGame (NEW):     ${newGame}`);
  console.log(`StarForgeUnitNFT:        ${unitNFT}`);
  console.log(`StarForgeRelic:          ${relic}`);
  console.log(`StarForgePlayerProfile:  ${playerProfile}`);
  console.log(`StarForgeGame (old):     ${TESTNET_DEFAULTS.currentGame}`);

  printBindingInstructions(
    newGame,
    unitNFT,
    relic,
    playerProfile,
    TESTNET_DEFAULTS.currentGame
  );
}

main().catch((error) => {
  console.error("DEPLOY FAILED");
  console.error(error.message || error);
  process.exitCode = 1;
});
