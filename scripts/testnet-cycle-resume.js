const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const { readFrontendAddresses } = require("./lib/liveAddresses");
  const game = await hre.ethers.getContractAt(
    "StarForgeGame",
    readFrontendAddresses().game,
    signer
  );
  const profile = await hre.ethers.getContractAt(
    "StarForgePlayerProfile",
    await game.playerProfileContract(),
    signer
  );

  const units = [...await game.getPlayerUnits(signer.address)];
  const p = await profile.getProfile(signer.address);
  console.log("units", units.length, "level", p.level.toString(), "xp", p.xp.toString(), "W", p.wins.toString(), "L", p.losses.toString());
  console.log("team4", units.slice(0, 4).map((id) => id.toString()));

  const team = units.slice(0, 4);
  try {
    const gas = await game.startMatch.estimateGas(team, []);
    console.log("estimateGas", gas.toString());
  } catch (error) {
    console.log("estimate FAILED", error.shortMessage || error.message);
    if (error.data) console.log("data", error.data);
  }

  const tx = await game.startMatch(team, [], { gasLimit: 8_000_000n });
  console.log("tx", tx.hash);
  const receipt = await tx.wait();
  console.log("status", receipt.status, "gas", receipt.gasUsed.toString());
}

main().catch((error) => {
  console.error(error.shortMessage || error.message || error);
  process.exitCode = 1;
});
