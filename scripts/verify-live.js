/**
 * Read-only check of the live Somnia testnet contracts.
 * Does not send transactions. Does not read PRIVATE_KEY.
 *
 *   npx hardhat run scripts/verify-live.js --network somniaTestnet
 */

const hre = require("hardhat");
const { readFrontendAddresses } = require("./lib/liveAddresses");
const { PREVIOUS_GAMES } = require("./lib/previousGames");

const GAME_ROLE = hre.ethers.id("GAME_ROLE");

async function codeAt(label, address) {
  const code = await hre.ethers.provider.getCode(address);
  const ok = code && code !== "0x";
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label} ${address}  bytecode=${ok ? code.length : 0} chars`);
  return ok;
}

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const live = readFrontendAddresses();

  console.log("----------------------------------------------------------");
  console.log("Live verify — Somnia StarForge");
  console.log(`Network:  ${hre.network.name}`);
  console.log(`Chain ID: ${Number(network.chainId)}`);
  console.log("----------------------------------------------------------");

  const gameOk = await codeAt("StarForgeGame", live.game);
  const nftOk = await codeAt("StarForgeUnitNFT", live.nft);
  const relicOk = await codeAt("StarForgeRelic", live.relic);
  const profileOk = await codeAt("StarForgePlayerProfile", live.profile);

  if (!gameOk || !nftOk || !relicOk || !profileOk) {
    throw new Error("One or more live addresses have no bytecode");
  }

  const game = await hre.ethers.getContractAt("StarForgeGame", live.game);
  const nft = await hre.ethers.getContractAt("StarForgeUnitNFT", live.nft);
  const relic = await hre.ethers.getContractAt("StarForgeRelic", live.relic);
  const profile = await hre.ethers.getContractAt("StarForgePlayerProfile", live.profile);

  const wiredNft = await game.unitNFT();
  const wiredRelic = await game.relicContract();
  const wiredProfile = await game.playerProfileContract();
  const nftGame = await nft.gameContract();
  const relicGame = await relic.gameContract();
  const hasRole = await profile.hasRole(GAME_ROLE, live.game);
  const previousGame = await game.previousGame();
  const buyUnitPrice = await game.buyUnitPrice();
  const rerollPrice = await game.rerollPrice();
  const relicPrice = await game.buyRelicShopPrice();

  console.log("");
  console.log(`  Game.unitNFT              ${wiredNft}`);
  console.log(`  Game.relicContract        ${wiredRelic}`);
  console.log(`  Game.playerProfile        ${wiredProfile}`);
  console.log(`  Game.previousGame         ${previousGame}`);
  console.log(`  NFT.gameContract          ${nftGame}`);
  console.log(`  Relic.gameContract        ${relicGame}`);
  console.log(`  Profile GAME_ROLE(Game)   ${hasRole}`);
  console.log(`  Prices                    unit=${hre.ethers.formatEther(buyUnitPrice)} reroll=${hre.ethers.formatEther(rerollPrice)} relic=${hre.ethers.formatEther(relicPrice)}`);

  const nftMatch = wiredNft.toLowerCase() === live.nft.toLowerCase();
  const relicMatch = wiredRelic.toLowerCase() === live.relic.toLowerCase();
  const profileMatch = wiredProfile.toLowerCase() === live.profile.toLowerCase();
  const nftPoints = nftGame.toLowerCase() === live.game.toLowerCase();
  const relicPoints = relicGame.toLowerCase() === live.game.toLowerCase();

  if (!nftMatch || !relicMatch || !profileMatch || !nftPoints || !relicPoints || !hasRole) {
    throw new Error("Live contracts are not fully bound to the frontend Game address");
  }
  if (previousGame.toLowerCase() === live.game.toLowerCase()) {
    throw new Error("previousGame must not be the live Game");
  }
  if (previousGame !== hre.ethers.ZeroAddress) {
    const prevCode = await hre.ethers.provider.getCode(previousGame);
    if (!prevCode || prevCode === "0x") {
      throw new Error("previousGame has no bytecode");
    }
  }

  for (const old of PREVIOUS_GAMES) {
    const checksummed = hre.ethers.getAddress(old.toLowerCase());
    if (checksummed.toLowerCase() === live.game.toLowerCase()) {
      continue;
    }
    const leftover = await profile.hasRole(GAME_ROLE, checksummed);
    console.log(`  Old GAME_ROLE ${checksummed}  ${leftover ? "STILL SET" : "revoked"}`);
    if (leftover) {
      throw new Error(`Old Game ${checksummed} still has GAME_ROLE`);
    }
  }

  console.log("");
  console.log("LIVE VERIFY OK");
}

main().catch((error) => {
  console.error("LIVE VERIFY FAILED");
  console.error(error.message || error);
  process.exitCode = 1;
});
