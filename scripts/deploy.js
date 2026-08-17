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
 * automatically binds the live contracts. NFT is switched last so a failed bind
 * does not leave minting pointed at a half-linked Game:
 *   1. StarForgeRelic.setGameContract(newGame)
 *   2. StarForgePlayerProfile.setGameContract(newGame)
 *   3. revoke GAME_ROLE from previous Game addresses
 *   4. StarForgeUnitNFT.setGameContract(newGame)
 *
 * previousGame is passed in the Game constructor (CURRENT_GAME_ADDRESS).
 * Mainnet never overwrites DEPLOYMENT.md or frontend addresses.
 */

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { PREVIOUS_GAMES } = require("./lib/previousGames");

// DEPLOYMENT.md — single source of truth for current testnet addresses.
const TESTNET_DEFAULTS = {
  unitNFT: "0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1",
  relic: "0x619e19df1975A8D289545834aAff3FEEf1b84909",
  playerProfile: "0x2C8976ECc9e9bDf939745ee61b1aD858607563d9",
  currentGame: "0x064fE7661b1eb52b727e562E652764b94c008383"
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

  return hre.ethers.getAddress(value.toLowerCase());
}

function resolvePreviousGame(envValue, testnetDefault) {
  const networkName = hre.network.name;
  let value = envValue && envValue.trim() !== "" ? envValue.trim() : "";

  if (!value) {
    if (networkName === "somniaMainnet") {
      throw new Error(
        "CURRENT_GAME_ADDRESS is required on somniaMainnet. Use the zero address for the first Game on this chain."
      );
    }
    value = testnetDefault;
  }

  if (!hre.ethers.isAddress(value)) {
    throw new Error(`CURRENT_GAME_ADDRESS is not a valid address: ${value}`);
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

async function requireDeployerControls(deployer, unitNFT, relic, playerProfile) {
  const nftContract = await hre.ethers.getContractAt("StarForgeUnitNFT", unitNFT, deployer);
  const relicContract = await hre.ethers.getContractAt("StarForgeRelic", relic, deployer);
  const profileContract = await hre.ethers.getContractAt(
    "StarForgePlayerProfile",
    playerProfile,
    deployer
  );

  const nftOwner = await nftContract.owner();
  const relicOwner = await relicContract.owner();
  const DEFAULT_ADMIN_ROLE = hre.ethers.ZeroHash;
  const isProfileAdmin = await profileContract.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);

  if (nftOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Deployer is not owner of UnitNFT. owner=${nftOwner}`);
  }
  if (relicOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Deployer is not owner of Relic. owner=${relicOwner}`);
  }
  if (!isProfileAdmin) {
    throw new Error("Deployer does not have DEFAULT_ADMIN_ROLE on PlayerProfile.");
  }

  return { nftContract, relicContract, profileContract };
}

async function bindLiveContracts(deployer, newGame, unitNFT, relic, playerProfile, currentGame) {
  const completed = [];
  const { nftContract, relicContract, profileContract } = await requireDeployerControls(
    deployer,
    unitNFT,
    relic,
    playerProfile
  );

  completed.push(
    await sendOwnerCall(
      `StarForgeRelic.setGameContract(${newGame})`,
      relicContract,
      "setGameContract",
      [newGame]
    )
  );

  completed.push(
    await sendOwnerCall(
      `StarForgePlayerProfile.setGameContract(${newGame})`,
      profileContract,
      "setGameContract",
      [newGame]
    )
  );

  const GAME_ROLE = hre.ethers.id("GAME_ROLE");
  const revokeTargets = new Set(PREVIOUS_GAMES.map((addr) => hre.ethers.getAddress(addr.toLowerCase())));
  if (currentGame) {
    revokeTargets.add(hre.ethers.getAddress(currentGame.toLowerCase()));
  }
  for (const checksummed of revokeTargets) {
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

  completed.push(
    await sendOwnerCall(
      `StarForgeUnitNFT.setGameContract(${newGame})`,
      nftContract,
      "setGameContract",
      [newGame]
    )
  );

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
  console.log("============================================================");
}

function writeDeploymentFiles(newGame, unitNFT, relic, playerProfile, previousGame) {
  const today = new Date();
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const dateLabel = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

  const deployment = `# DEPLOYMENT.md
**Актуально на ${dateLabel} — единственный источник правды по адресам**

Testnet: Chain ID **50312**, RPC \`https://dream-rpc.somnia.network\`

## Актуальные адреса (testnet)

- **StarForgeUnitNFT**: \`${unitNFT}\`
- **StarForgeRelic**: \`${relic}\`
- **StarForgePlayerProfile**: \`${playerProfile}\`
- **StarForgeGame** (новый): \`${newGame}\` ← **актуальный**
  - Shadow Fleet (ИИ всегда 8), Variant 1 battle events (emit)
  - anti-abuse daily 10 + free ship за level-up
  - Last Stand 1 раз, unique team/relics, previousGame = old Game

## Предыдущий Game

- \`${previousGame}\` — снят с NFT/Relic/Profile GAME_ROLE

## Порядок деплоя и связывания контрактов

**При деплое нового StarForgeGame:**

1. Деплоим **НОВЫЙ** \`StarForgeGame\` с параметрами:
   - \`_unitNFT\` = \`${unitNFT}\`
   - \`_relic\` = \`${relic}\`
   - \`_playerProfile\` = \`${playerProfile}\`
   - \`_previousGame\` = \`${previousGame}\`

2. После деплоя выполняем:

\`\`\`solidity
StarForgeUnitNFT.setGameContract(${newGame})
StarForgeRelic.setGameContract(${newGame})
StarForgePlayerProfile.setGameContract(${newGame})
StarForgeGame constructor previousGame = ${previousGame}
\`\`\`
`;

  fs.writeFileSync(path.join(__dirname, "..", "DEPLOYMENT.md"), deployment, "utf8");

  const addresses = `// frontend/src/lib/contractAddresses.ts
// Single source of testnet contract addresses.

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
    if (process.env.CONFIRM_MAINNET !== "1") {
      throw new Error("Refusing somniaMainnet deploy. Set CONFIRM_MAINNET=1 in .env to continue.");
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
  const currentGame = resolvePreviousGame(
    process.env.CURRENT_GAME_ADDRESS,
    TESTNET_DEFAULTS.currentGame
  );

  console.log(`Deployer:         ${deployer.address}`);
  console.log(`UnitNFT:          ${unitNFT}`);
  console.log(`Relic:            ${relic}`);
  console.log(`PlayerProfile:    ${playerProfile}`);
  console.log(`Previous Game:    ${currentGame}`);

  await requireOnChainContract("UNIT_NFT_ADDRESS", unitNFT);
  await requireOnChainContract("RELIC_ADDRESS", relic);
  await requireOnChainContract("PLAYER_PROFILE_ADDRESS", playerProfile);
  if (currentGame === hre.ethers.ZeroAddress) {
    console.log("previousGame = 0 (first Game on this chain)");
  } else {
    await requireOnChainContract("CURRENT_GAME_ADDRESS", currentGame);
  }
  await requireDeployerControls(deployer, unitNFT, relic, playerProfile);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${hre.ethers.formatEther(balance)} native`);
  if (balance === 0n) {
    throw new Error("Deployer balance is 0. Fund the wallet on this network before deploying.");
  }

  console.log("");
  console.log("Deploying StarForgeGame...");

  const Game = await hre.ethers.getContractFactory("StarForgeGame");
  const game = await Game.deploy(unitNFT, relic, playerProfile, currentGame);
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
  console.log(`StarForgeGame (old):     ${currentGame}`);

  console.log("");
  console.log("Binding live contracts (deployer must be owner / DEFAULT_ADMIN)...");
  const completed = await bindLiveContracts(
    deployer,
    newGame,
    unitNFT,
    relic,
    playerProfile,
    currentGame
  );

  if (networkName === "somniaMainnet") {
    console.log("");
    console.log("Mainnet: DEPLOYMENT.md and frontend addresses were NOT overwritten.");
    console.log("Update a separate mainnet address file by hand.");
  } else {
    writeDeploymentFiles(newGame, unitNFT, relic, playerProfile, currentGame);
    console.log("");
    console.log("Address files updated:");
    console.log("  - DEPLOYMENT.md");
    console.log("  - frontend/src/lib/contractAddresses.ts");
  }

  printLinkSummary(
    newGame,
    unitNFT,
    relic,
    playerProfile,
    currentGame,
    completed
  );
}

main().catch((error) => {
  console.error("DEPLOY FAILED");
  console.error(error.message || error);
  process.exitCode = 1;
});
