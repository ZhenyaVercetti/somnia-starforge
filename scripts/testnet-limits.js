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
  console.log("game", live.game);
  console.log("remainingBuys", remaining.toString());

  if (remaining > 0n) {
    try {
      await game.buyUnit.staticCall({ value: hre.ethers.parseEther("0.010000000000000001") });
      throw new Error("overpay buyUnit should revert");
    } catch (error) {
      const reason = error.reason || error.shortMessage || error.message || "";
      if (!String(reason).includes("Wrong payment")) {
        throw new Error(`expected Wrong payment, got: ${reason}`);
      }
      console.log("overpay buyUnit blocked: Wrong payment");
    }
  } else {
    console.log("overpay buyUnit skipped: daily buy cap already used");
  }

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

  const summary = await game.getLastBattleSummary(signer.address);
  console.log("lastBattleId", summary.battleId);
  console.log("packedEventsFn", game.interface.hasFunction("getPackedBattleEvents(address)"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
