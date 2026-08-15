const hre = require("hardhat");
const { readFrontendAddresses } = require("./lib/liveAddresses");

const MAX = 12;

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const game = await hre.ethers.getContractAt("StarForgeGame", readFrontendAddresses().game, signer);
  const profile = await hre.ethers.getContractAt(
    "StarForgePlayerProfile",
    await game.playerProfileContract(),
    signer
  );

  for (let i = 1; i <= MAX; i++) {
    const p = await profile.getProfile(signer.address);
    const units = [...await game.getPlayerUnits(signer.address)];
    const pending = await game.pendingLevelUpShips(signer.address);
    console.log(`#${i} level=${p.level} xp=${p.xp} W=${p.wins} L=${p.losses} units=${units.length} pending=${pending}`);
    if (Number(p.level) > 1) {
      console.log("LEVEL UP reached");
      break;
    }
    const team = units.slice(0, 4);
    const tx = await game.startMatch(team, [], { gasLimit: 8_000_000n });
    const receipt = await tx.wait();
    const logs = receipt.logs
      .map((log) => {
        try {
          return game.interface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);
    const resolved = logs.find((item) => item.name === "BattleResolved");
    const events = logs.filter((item) => item.name === "BattleEventEmitted");
    const grants = logs.filter((item) => item.name === "LevelUpShipsGranted");
    console.log(
      `  ${tx.hash} gas=${receipt.gasUsed} won=${resolved ? resolved.args.playerWon : "?"} events=${events.length} grants=${grants.length}`
    );
  }

  const after = await profile.getProfile(signer.address);
  const unitsAfter = await game.getPlayerUnits(signer.address);
  const pending = await game.pendingLevelUpShips(signer.address);
  console.log(`final level=${after.level} xp=${after.xp} units=${unitsAfter.length} pending=${pending}`);

  if (Number(pending) > 0) {
    const tx = await game.claimLevelUpShips();
    const receipt = await tx.wait();
    console.log(`claim ${tx.hash} gas=${receipt.gasUsed}`);
  }

  const done = await profile.getProfile(signer.address);
  const unitsDone = await game.getPlayerUnits(signer.address);
  console.log(`after claim/auto units=${unitsDone.length} pending=${await game.pendingLevelUpShips(signer.address)} level=${done.level}`);
}

main().catch((error) => {
  console.error(error.shortMessage || error.message || error);
  process.exitCode = 1;
});
