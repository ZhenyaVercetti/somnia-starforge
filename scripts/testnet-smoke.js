/**
 * Live smoke on somniaTestnet against the current DEPLOYMENT.md Game.
 *   npx hardhat run scripts/testnet-smoke.js --network somniaTestnet
 */

const hre = require("hardhat");

const BUY_UNIT_PRICE = hre.ethers.parseEther("0.01");

function parseGameLogs(game, receipt) {
  const parsed = [];
  for (const log of receipt.logs) {
    try {
      const item = game.interface.parseLog(log);
      if (item) parsed.push(item);
    } catch (e) {
      // ignore logs from other contracts
    }
  }
  return parsed;
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  if (!signer) {
    throw new Error("No signer. Set PRIVATE_KEY.");
  }

  const addressesPath = require("path").join(__dirname, "..", "frontend", "src", "lib", "contractAddresses.ts");
  const source = require("fs").readFileSync(addressesPath, "utf8");
  const gameMatch = source.match(/GAME_ADDRESS = '([^']+)'/);
  if (!gameMatch) {
    throw new Error("GAME_ADDRESS missing from frontend/src/lib/contractAddresses.ts");
  }
  const gameAddress = hre.ethers.getAddress(gameMatch[1].toLowerCase());

  const game = await hre.ethers.getContractAt("StarForgeGame", gameAddress, signer);
  const balance = await hre.ethers.provider.getBalance(signer.address);

  console.log("----------------------------------------------------------");
  console.log("Testnet smoke");
  console.log(`Signer:  ${signer.address}`);
  console.log(`Game:    ${gameAddress}`);
  console.log(`Balance: ${hre.ethers.formatEther(balance)}`);
  console.log("----------------------------------------------------------");

  const minBalance = hre.ethers.parseEther("0.01");
  if (balance < minBalance) {
    throw new Error("Need at least 0.01 native for startMatch gas.");
  }

  let remaining = await game.getRemainingBuys(signer.address);
  console.log(`Remaining paid buys: ${remaining}`);

  let units = [...await game.getPlayerUnits(signer.address)];
  console.log(`Units before: ${units.length}`);

  while (units.length < 4 && remaining > 0n) {
    console.log("buyUnit...");
    const tx = await game.buyUnit({ value: BUY_UNIT_PRICE });
    console.log(`  tx ${tx.hash}`);
    const receipt = await tx.wait();
    if (receipt.status !== 1) {
      throw new Error("buyUnit failed");
    }
    console.log(`  OK gas=${receipt.gasUsed}`);
    units = [...await game.getPlayerUnits(signer.address)];
    remaining = await game.getRemainingBuys(signer.address);
    console.log(`  units=${units.length} remainingBuys=${remaining}`);
  }

  if (units.length < 4) {
    throw new Error(`Need 4 units to startMatch, have ${units.length}`);
  }

  console.log("startMatch...");
  const matchTx = await game.startMatch(units.slice(0, 4), []);
  console.log(`  tx ${matchTx.hash}`);
  const matchReceipt = await matchTx.wait();
  if (matchReceipt.status !== 1) {
    throw new Error("startMatch failed");
  }
  console.log(`  OK gas=${matchReceipt.gasUsed}`);

  const logs = parseGameLogs(game, matchReceipt);
  const resolved = logs.filter((item) => item.name === "BattleResolved");
  const events = logs.filter((item) => item.name === "BattleEventEmitted");
  const grants = logs.filter((item) => item.name === "LevelUpShipsGranted");

  if (resolved.length !== 1) {
    throw new Error(`Expected 1 BattleResolved, got ${resolved.length}`);
  }
  if (events.length === 0) {
    throw new Error("No BattleEventEmitted logs — replay cannot work");
  }

  const summary = await game.getLastBattleSummary(signer.address);

  console.log(`  playerWon=${summary.playerWon}`);
  console.log(`  battleId=${summary.battleId}`);
  console.log(`  BattleEventEmitted count=${events.length}`);
  console.log(`  LevelUpShipsGranted=${grants.length}`);

  if (summary.battleId !== resolved[0].args.battleId) {
    throw new Error("battleId mismatch between result and BattleResolved");
  }

  try {
    const pending = await game.pendingLevelUpShips(signer.address);
    console.log(`pendingLevelUpShips=${pending}`);
    if (pending > 0) {
      console.log("claimLevelUpShips...");
      const claimTx = await game.claimLevelUpShips();
      console.log(`  tx ${claimTx.hash}`);
      const claimReceipt = await claimTx.wait();
      if (claimReceipt.status !== 1) {
        throw new Error("claimLevelUpShips failed");
      }
      console.log(`  OK gas=${claimReceipt.gasUsed}`);
    }
  } catch (error) {
    console.log(`level-up ships not available on this Game: ${error.shortMessage || error.message}`);
  }

  remaining = await game.getRemainingBuys(signer.address);
  const afterUnits = await game.getPlayerUnits(signer.address);
  console.log(`Units after: ${afterUnits.length}`);
  console.log(`Remaining paid buys: ${remaining}`);

  if (remaining > 10n) {
    throw new Error("Daily buy remaining exceeded 10");
  }

  console.log("");
  console.log("SMOKE OK");
}

main().catch((error) => {
  console.error("SMOKE FAILED");
  console.error(error.shortMessage || error.message || error);
  process.exitCode = 1;
});
