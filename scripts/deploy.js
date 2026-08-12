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
 * After a successful Game deploy the same deployer (must be owner / DEFAULT_ADMIN)
 * automatically binds the live contracts:
 *   1. StarForgeUnitNFT.setGameContract(newGame)
 *   2. StarForgeRelic.setGameContract(newGame)
 *   3. StarForgePlayerProfile.setGameContract(newGame)
 *   4. new StarForgeGame.setRelicContract(currentRelic)
 */

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

// DEPLOYMENT.md — single source of truth for current testnet addresses.
const TESTNET_DEFAULTS = {
  unitNFT: "0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1",
  relic: "0x619e19df1975A8D289545834aAff3FEEf1b84909",
  playerProfile: "0x2C8976ECc9e9bDf939745ee61b1aD858607563d9",
  currentGame: "0xcc51dbf77d96b477485122BA2F6Ee6beBBA21B88"
};

const PREVIOUS_GAMES = [
  "0x05bcfA66B38259ea33B6986C1f04F028f0129a9F",
  "0x4628FC45cb2f28A198A4ebF1491791b2E12D92DA",
  "0x6107dCb032ef91350e139563fDE7776E4ccd0fab",
  "0xcc51dbf77d96b477485122BA2F6Ee6beBBA21B88",
  "0xB0768AE07a84F8172424ED331c80525D1B4564de"
];

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

  return hre.ethers.getAddress(value.toLowerCase());
}

async function requireOnChainContract(label, address) {
  const code = await hre.ethers.provider.getCode(address);
  if (!code || code === "0x") {
    throw new Error(
      `${label} has no bytecode at ${address}. Check the network and DEPLOYMENT.md / .env addresses.`
    );
  }
}

async function sendOwnerCall(label, contract, method, args) {
  console.log("");
  console.log(`Calling ${label}...`);
  try {
    const tx = await contract[method](...args);
    console.log(`  tx: ${tx.hash}`);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error(`${label} mined but reverted`);
    }
    console.log(`  OK   ${label}`);
    return { label, hash: tx.hash, ok: true };
  } catch (error) {
    const hash = error.transaction?.hash || error.receipt?.hash || "";
    console.error(`  FAIL ${label}`);
    if (hash) {
      console.error(`  tx: ${hash}`);
    }
    console.error(`  ${error.shortMessage || error.reason || error.message || error}`);
    throw new Error(
      `${label} failed. Binding stopped. New Game may already be deployed — do not point the frontend at it until all set* calls succeed.`
    );
  }
}

async function bindLiveContracts(deployer, newGame, game, unitNFT, relic, playerProfile) {
  const completed = [];

  const nftContract = await hre.ethers.getContractAt("StarForgeUnitNFT", unitNFT, deployer);
  completed.push(
    await sendOwnerCall(
      `StarForgeUnitNFT.setGameContract(${newGame})`,
      nftContract,
      "setGameContract",
      [newGame]
    )
  );

  const relicContract = await hre.ethers.getContractAt("StarForgeRelic", relic, deployer);
  completed.push(
    await sendOwnerCall(
      `StarForgeRelic.setGameContract(${newGame})`,
      relicContract,
      "setGameContract",
      [newGame]
    )
  );

  const profileContract = await hre.ethers.getContractAt(
    "StarForgePlayerProfile",
    playerProfile,
    deployer
  );
  completed.push(
    await sendOwnerCall(
      `StarForgePlayerProfile.setGameContract(${newGame})`,
      profileContract,
      "setGameContract",
      [newGame]
    )
  );

  completed.push(
    await sendOwnerCall(
      `StarForgeGame.setRelicContract(${relic})`,
      game.connect(deployer),
      "setRelicContract",
      [relic]
    )
  );

  const GAME_ROLE = hre.ethers.id("GAME_ROLE");
  for (const oldGame of PREVIOUS_GAMES) {
    const checksummed = hre.ethers.getAddress(oldGame.toLowerCase());
    if (checksummed.toLowerCase() === newGame.toLowerCase()) {
      continue;
    }
    const hasRole = await profileContract.hasRole(GAME_ROLE, checksummed);
    if (!hasRole) {
      continue;
    }
    completed.push(
      await sendOwnerCall(
        `StarForgePlayerProfile.revokeRole(GAME_ROLE, ${checksummed})`,
        profileContract,
        "revokeRole",
        [GAME_ROLE, checksummed]
      )
    );
  }

  return completed;
}

function printLinkSummary(newGame, unitNFT, relic, playerProfile, currentGame, completed) {
  console.log("");
  console.log("============================================================");
  console.log("LINKING COMPLETE");
  console.log("============================================================");
  console.log(`  StarForgeGame (NEW):     ${newGame}`);
  console.log(`  StarForgeGame (old):     ${currentGame}`);
  console.log(`  StarForgeUnitNFT:        ${unitNFT}`);
  console.log(`  StarForgeRelic:          ${relic}`);
  console.log(`  StarForgePlayerProfile:  ${playerProfile}`);
  console.log("");
  console.log("set* calls:");
  for (const step of completed) {
    console.log(`  OK  ${step.label}`);
    console.log(`      ${step.hash}`);
  }
  console.log("");
  console.log("Address files updated:");
  console.log("  - DEPLOYMENT.md");
  console.log("  - frontend/src/lib/contractAddresses.ts");
  console.log("============================================================");
}

function writeDeploymentFiles(newGame, unitNFT, relic, playerProfile) {
  const today = new Date();
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const dateLabel = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

  const deployment = `# DEPLOYMENT.md
**Актуально на ${dateLabel} — единственный источник правды по адресам**

## Актуальные адреса (testnet)

- **StarForgeUnitNFT**: \`${unitNFT}\`
- **StarForgeRelic**: \`${relic}\`
- **StarForgePlayerProfile**: \`${playerProfile}\`
- **StarForgeGame** (новый): \`${newGame}\` ← **актуальный**

## Порядок деплоя и связывания контрактов

**При деплое нового StarForgeGame:**

1. Деплоим **НОВЫЙ** \`StarForgeGame\` с параметрами:
   - \`_unitNFT\` = \`${unitNFT}\`
   - \`_relic\` = \`${relic}\`
   - \`_playerProfile\` = \`${playerProfile}\`

2. После деплоя выполняем:

\`\`\`solidity
// 1. NFT → новый Game
StarForgeUnitNFT.setGameContract(${newGame})

// 2. Relic → новый Game
StarForgeRelic.setGameContract(${newGame})

// 3. PlayerProfile → новый Game
StarForgePlayerProfile.setGameContract(${newGame})
\`\`\`
`;

  fs.writeFileSync(path.join(__dirname, "..", "DEPLOYMENT.md"), deployment, "utf8");

  const addresses = `// frontend/src/lib/contractAddresses.ts
// ЕДИНСТВЕННОЕ МЕСТО ДЛЯ АДРЕСОВ КОНТРАКТОВ (testnet)

export const GAME_ADDRESS = '${newGame}' as const;
export const NFT_ADDRESS = '${unitNFT}' as const;
export const RELIC_ADDRESS = '${relic}' as const;
export const PLAYER_PROFILE_ADDRESS = '${playerProfile}' as const;

export const CHAIN_ID = 50312;
export const RPC_URL = 'https://dream-rpc.somnia.network';
`;

  fs.writeFileSync(
    path.join(__dirname, "..", "frontend", "src", "lib", "contractAddresses.ts"),
    addresses,
    "utf8"
  );
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

  console.log("");
  console.log("Binding live contracts (deployer must be owner / DEFAULT_ADMIN)...");
  const completed = await bindLiveContracts(
    deployer,
    newGame,
    game,
    unitNFT,
    relic,
    playerProfile
  );

  writeDeploymentFiles(newGame, unitNFT, relic, playerProfile);

  printLinkSummary(
    newGame,
    unitNFT,
    relic,
    playerProfile,
    TESTNET_DEFAULTS.currentGame,
    completed
  );
}

main().catch((error) => {
  console.error("DEPLOY FAILED");
  console.error(error.message || error);
  process.exitCode = 1;
});
