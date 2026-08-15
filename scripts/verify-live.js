/**
 * Read-only check of the live Somnia testnet contracts.
 * Does not send transactions. Does not read PRIVATE_KEY.
 *
 *   npx hardhat run scripts/verify-live.js --network somniaTestnet
 */

const hre = require("hardhat");
const { readFrontendAddresses } = require("./lib/liveAddresses");

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

  console.log("");
  console.log(`  Game.unitNFT              ${wiredNft}`);
  console.log(`  Game.relicContract        ${wiredRelic}`);
  console.log(`  Game.playerProfile        ${wiredProfile}`);
  console.log(`  NFT.gameContract          ${nftGame}`);
  console.log(`  Relic.gameContract        ${relicGame}`);
  console.log(`  Profile GAME_ROLE(Game)   ${hasRole}`);

  const nftMatch = wiredNft.toLowerCase() === live.nft.toLowerCase();
  const relicMatch = wiredRelic.toLowerCase() === live.relic.toLowerCase();
  const profileMatch = wiredProfile.toLowerCase() === live.profile.toLowerCase();
  const nftPoints = nftGame.toLowerCase() === live.game.toLowerCase();
  const relicPoints = relicGame.toLowerCase() === live.game.toLowerCase();

  if (!nftMatch || !relicMatch || !profileMatch || !nftPoints || !relicPoints || !hasRole) {
    throw new Error("Live contracts are not fully bound to the frontend Game address");
  }

  console.log("");
  console.log("LIVE VERIFY OK");
}

main().catch((error) => {
  console.error("LIVE VERIFY FAILED");
  console.error(error.message || error);
  process.exitCode = 1;
});
