const hre = require("hardhat");
const { readFrontendAddresses } = require("./lib/liveAddresses");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const live = readFrontendAddresses();
  const game = await hre.ethers.getContractAt(
    "StarForgeGame",
    live.game,
    signer
  );

  const remaining = await game.getRemainingBuys(signer.address);
  console.log("remainingBuys", remaining.toString());

  try {
    await game.generateTenShips.staticCall({ value: hre.ethers.parseEther("0.1") });
    console.log("generateTenShips staticCall unexpected success");
  } catch (error) {
    console.log("generateTenShips blocked:", error.reason || error.shortMessage || error.message);
  }

  try {
    await game.claimLevelUpShips.staticCall();
    console.log("claimLevelUpShips unexpected success");
  } catch (error) {
    console.log("claimLevelUpShips blocked:", error.reason || error.shortMessage || error.message);
  }

  const result = await game.getLastBattleResult(signer.address);
  console.log("lastBattleId", result[3]);
  console.log("packedEventsFn", game.interface.hasFunction("getPackedBattleEvents(address)"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
