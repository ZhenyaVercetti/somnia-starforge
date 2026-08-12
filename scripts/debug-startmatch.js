const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const game = await hre.ethers.getContractAt(
    "StarForgeGame",
    "0x6107dCb032ef91350e139563fDE7776E4ccd0fab",
    signer
  );

  const units = [...await game.getPlayerUnits(signer.address)];
  console.log("account", signer.address);
  console.log("units", units.map((id) => id.toString()));
  console.log("remaining", (await game.getRemainingBuys(signer.address)).toString());

  try {
    const gas = await game.startMatch.estimateGas(units.slice(0, 4), []);
    console.log("estimateGas", gas.toString());
  } catch (error) {
    console.log("estimateGas FAILED");
    console.log(error.shortMessage || error.message);
    if (error.data) console.log("data", error.data);
    if (error.reason) console.log("reason", error.reason);
    if (error.info) console.log("info", JSON.stringify(error.info, null, 2));
  }

  try {
    await game.startMatch.staticCall(units.slice(0, 4), []);
    console.log("staticCall OK");
  } catch (error) {
    console.log("staticCall FAILED");
    console.log(error.shortMessage || error.message);
    if (error.reason) console.log("reason", error.reason);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
