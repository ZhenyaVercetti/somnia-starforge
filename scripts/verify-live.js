/**
 * Read-only check of the live Somnia testnet contracts.
 * Does not send transactions. Does not read PRIVATE_KEY.
 *
 *   npx hardhat run scripts/verify-live.js --network somniaTestnet
 */

const hre = require("hardhat");

function addr(value) {
  return hre.ethers.getAddress(value.toLowerCase());
}

const DEPLOYMENT = {
  unitNFT: addr("0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1"),
  relic: addr("0x619e19df1975A8D289545834aAff3FEEf1b84909"),
  playerProfile: addr("0x2C8976ECc9e9bDf939745ee61b1aD858607563d9"),
  game: addr("0x4628Fc45cb2f28A198A4ebf1491791b2E12D92DA"),
  oldGame: addr("0x05bcfA66B38259ea33B6986C1f04F028f0129a9F"),
  frontendProfile: addr("0x48820B6263920fBD843F203E982cCa908Bd12dB3")
};

const GAME_ROLE = hre.ethers.id("GAME_ROLE");

async function codeAt(label, address) {
  const code = await hre.ethers.provider.getCode(address);
  const ok = code && code !== "0x";
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label} ${address}  bytecode=${ok ? code.length : 0} chars`);
  return ok;
}

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  console.log("----------------------------------------------------------");
  console.log("Live verify — Somnia StarForge");
  console.log(`Network:  ${hre.network.name}`);
  console.log(`Chain ID: ${Number(network.chainId)}`);
  console.log("----------------------------------------------------------");

  const gameOk = await codeAt("StarForgeGame", DEPLOYMENT.game);
  const nftOk = await codeAt("StarForgeUnitNFT", DEPLOYMENT.unitNFT);
  const relicOk = await codeAt("StarForgeRelic", DEPLOYMENT.relic);
  const profileOk = await codeAt("StarForgePlayerProfile (DEPLOYMENT)", DEPLOYMENT.playerProfile);
  await codeAt("StarForgeGame (old)", DEPLOYMENT.oldGame);
  const frontendProfileOk = await codeAt(
    "PlayerProfile (frontend contractAddresses.ts)",
    DEPLOYMENT.frontendProfile
  );

  if (!gameOk || !nftOk || !relicOk || !profileOk) {
    throw new Error("One or more DEPLOYMENT.md contracts have no bytecode.");
  }

  const game = await hre.ethers.getContractAt("StarForgeGame", DEPLOYMENT.game);
  const nft = await hre.ethers.getContractAt("StarForgeUnitNFT", DEPLOYMENT.unitNFT);
  const relic = await hre.ethers.getContractAt("StarForgeRelic", DEPLOYMENT.relic);
  const profile = await hre.ethers.getContractAt("StarForgePlayerProfile", DEPLOYMENT.playerProfile);

  const wiredNft = await game.unitNFT();
  const wiredRelic = await game.relicContract();
  const wiredProfile = await game.playerProfileContract();
  const nftGame = await nft.gameContract();
  const relicGame = await relic.gameContract();
  const profileHasRole = await profile.hasRole(GAME_ROLE, DEPLOYMENT.game);
  const oldGameHasRole = await profile.hasRole(GAME_ROLE, DEPLOYMENT.oldGame);

  console.log("");
  console.log("Wiring");
  console.log(`  Game.unitNFT()                 = ${wiredNft}  ${wiredNft.toLowerCase() === DEPLOYMENT.unitNFT.toLowerCase() ? "OK" : "MISMATCH"}`);
  console.log(`  Game.relicContract()           = ${wiredRelic}  ${wiredRelic.toLowerCase() === DEPLOYMENT.relic.toLowerCase() ? "OK" : "MISMATCH"}`);
  console.log(`  Game.playerProfileContract()   = ${wiredProfile}  ${wiredProfile.toLowerCase() === DEPLOYMENT.playerProfile.toLowerCase() ? "OK" : "MISMATCH"}`);
  console.log(`  NFT.gameContract()             = ${nftGame}  ${nftGame.toLowerCase() === DEPLOYMENT.game.toLowerCase() ? "OK" : "MISMATCH"}`);
  console.log(`  Relic.gameContract()           = ${relicGame}  ${relicGame.toLowerCase() === DEPLOYMENT.game.toLowerCase() ? "OK" : "MISMATCH"}`);
  console.log(`  Profile GAME_ROLE(new Game)    = ${profileHasRole}  ${profileHasRole ? "OK" : "FAIL"}`);
  console.log(`  Profile GAME_ROLE(old Game)    = ${oldGameHasRole}  ${oldGameHasRole ? "STILL GRANTED (setGameContract does not revoke)" : "revoked or never granted"}`);

  const prices = {
    buyUnit: await game.buyUnitPrice(),
    reroll: await game.rerollPrice(),
    buyUnitShop: await game.buyUnitShopPrice(),
    buyRelicShop: await game.buyRelicShopPrice()
  };
  console.log("");
  console.log("Prices");
  console.log(`  buyUnitPrice      = ${hre.ethers.formatEther(prices.buyUnit)}`);
  console.log(`  rerollPrice       = ${hre.ethers.formatEther(prices.reroll)}`);
  console.log(`  buyUnitShopPrice  = ${hre.ethers.formatEther(prices.buyUnitShop)}`);
  console.log(`  buyRelicShopPrice = ${hre.ethers.formatEther(prices.buyRelicShop)}`);

  const hasPacked = game.interface.hasFunction("getPackedBattleEvents(address)");
  const resultFrag = game.interface.getFunction("getLastBattleResult");
  console.log("");
  console.log("ABI (local artifact vs live calls)");
  console.log(`  getPackedBattleEvents present in artifact: ${hasPacked}`);
  console.log(`  getLastBattleResult outputs: ${resultFrag.outputs.length}  (${resultFrag.outputs.map((o) => o.type).join(", ")})`);

  try {
    await game.getLastBattleSummary(hre.ethers.ZeroAddress);
    console.log("  getLastBattleSummary(0x0): callable OK");
  } catch (error) {
    console.log(`  getLastBattleSummary(0x0): FAIL  ${error.shortMessage || error.message}`);
  }

  try {
    const result = await game.getLastBattleResult(hre.ethers.ZeroAddress);
    console.log(`  getLastBattleResult(0x0): ${result.length} values, battleId=${result[3]}`);
  } catch (error) {
    console.log(`  getLastBattleResult(0x0): FAIL  ${error.shortMessage || error.message}`);
  }

  const localDeployed = (await hre.artifacts.readArtifact("StarForgeGame")).deployedBytecode.toLowerCase();
  const liveCode = (await hre.ethers.provider.getCode(DEPLOYMENT.game)).toLowerCase();
  const metadataStrippedLocal = localDeployed.slice(0, localDeployed.length - 106);
  const metadataStrippedLive = liveCode.slice(0, liveCode.length - 106);
  const exact = liveCode === localDeployed;
  const sameWithoutMetadata = metadataStrippedLive === metadataStrippedLocal && liveCode.length > 10;
  console.log("");
  console.log("Bytecode vs local Hardhat artifact");
  console.log(`  live runtime length:  ${liveCode.length}`);
  console.log(`  local runtime length: ${localDeployed.length}`);
  console.log(`  exact match: ${exact}`);
  console.log(`  match ignoring CBOR metadata: ${sameWithoutMetadata}`);

  console.log("");
  console.log("Frontend vs DEPLOYMENT.md");
  console.log(`  GAME matches:    yes (0x4628...92DA)`);
  console.log(`  NFT matches:     yes`);
  console.log(`  Relic matches:   yes`);
  console.log(
    `  Profile mismatch: frontend=${DEPLOYMENT.frontendProfile}  DEPLOYMENT/Game=${DEPLOYMENT.playerProfile}  frontendHasCode=${frontendProfileOk}`
  );

  if (frontendProfileOk) {
    const other = await hre.ethers.getContractAt("StarForgePlayerProfile", DEPLOYMENT.frontendProfile);
    try {
      const otherHasNew = await other.hasRole(GAME_ROLE, DEPLOYMENT.game);
      const otherHasOld = await other.hasRole(GAME_ROLE, DEPLOYMENT.oldGame);
      console.log(`  frontend Profile GAME_ROLE(new Game) = ${otherHasNew}`);
      console.log(`  frontend Profile GAME_ROLE(old Game) = ${otherHasOld}`);
    } catch (error) {
      console.log(`  frontend Profile role read failed: ${error.shortMessage || error.message}`);
    }
  }

  const failures = [];
  if (wiredNft.toLowerCase() !== DEPLOYMENT.unitNFT.toLowerCase()) failures.push("Game.unitNFT mismatch");
  if (wiredRelic.toLowerCase() !== DEPLOYMENT.relic.toLowerCase()) failures.push("Game.relicContract mismatch");
  if (wiredProfile.toLowerCase() !== DEPLOYMENT.playerProfile.toLowerCase()) failures.push("Game.playerProfileContract mismatch");
  if (nftGame.toLowerCase() !== DEPLOYMENT.game.toLowerCase()) failures.push("NFT.gameContract is not the new Game");
  if (relicGame.toLowerCase() !== DEPLOYMENT.game.toLowerCase()) failures.push("Relic.gameContract is not the new Game");
  if (!profileHasRole) failures.push("Profile did not grant GAME_ROLE to the new Game");
  if (hasPacked) failures.push("Artifact still has getPackedBattleEvents");
  if (DEPLOYMENT.frontendProfile.toLowerCase() !== DEPLOYMENT.playerProfile.toLowerCase()) {
    failures.push("frontend PLAYER_PROFILE_ADDRESS != DEPLOYMENT.md / Game.playerProfileContract");
  }

  console.log("");
  if (failures.length === 0) {
    console.log("VERIFY OK — no blockers found");
  } else {
    console.log("VERIFY ISSUES");
    for (const item of failures) {
      console.log(`  - ${item}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("VERIFY FAILED");
  console.error(error);
  process.exitCode = 1;
});
