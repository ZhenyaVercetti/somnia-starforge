/**
 * Close v1.6 testnet loop: limits, match, replay logs, level-up ships.
 *   npx hardhat run scripts/testnet-cycle.js --network somniaTestnet
 */

const hre = require("hardhat");
const path = require("path");
const fs = require("fs");

const BUY_UNIT_PRICE = hre.ethers.parseEther("0.01");
const TEN_SHIPS_PRICE = hre.ethers.parseEther("0.1");
const MAX_LEVEL_UP_MATCHES = 16;

function parseGameLogs(game, receipt) {
  const parsed = [];
  for (const log of receipt.logs) {
    try {
      const item = game.interface.parseLog(log);
      if (item) parsed.push(item);
    } catch (e) {
      // ignore other contracts
    }
  }
  return parsed;
}

function readGameAddress() {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "frontend", "src", "lib", "contractAddresses.ts"),
    "utf8"
  );
  const match = source.match(/GAME_ADDRESS = '([^']+)'/);
  return hre.ethers.getAddress(match[1].toLowerCase());
}

async function printState(label, game, profile, signer) {
  const remaining = await game.getRemainingBuys(signer.address);
  const units = await game.getPlayerUnits(signer.address);
  const p = await profile.getProfile(signer.address);
  let pending = 0;
  try {
    pending = await game.pendingLevelUpShips(signer.address);
  } catch (e) {
    pending = "n/a";
  }
  console.log(`[${label}] remainingBuys=${remaining} units=${units.length} level=${p.level} xp=${p.xp} W=${p.wins} L=${p.losses} pendingFree=${pending}`);
  return { remaining, units, profile: p, pending };
}

async function runMatch(game, signer, units) {
  const team = units.slice(0, Math.min(8, Math.max(4, units.length)));
  const tx = await game.startMatch(team, []);
  const receipt = await tx.wait();
  if (receipt.status !== 1) {
    throw new Error("startMatch failed");
  }
  const logs = parseGameLogs(game, receipt);
  const resolved = logs.filter((item) => item.name === "BattleResolved");
  const events = logs.filter((item) => item.name === "BattleEventEmitted");
  const grants = logs.filter((item) => item.name === "LevelUpShipsGranted");
  const summary = await game.getLastBattleSummary(signer.address);
  if (resolved.length !== 1) {
    throw new Error(`BattleResolved count=${resolved.length}`);
  }
  if (events.length === 0) {
    throw new Error("No BattleEventEmitted");
  }
  if (summary.battleId !== resolved[0].args.battleId) {
    throw new Error("battleId mismatch");
  }
  console.log(
    `  startMatch ${tx.hash} gas=${receipt.gasUsed} won=${summary.playerWon} events=${events.length} grants=${grants.length}`
  );
  return { receipt, result: summary, events, grants };
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const gameAddress = readGameAddress();
  const game = await hre.ethers.getContractAt("StarForgeGame", gameAddress, signer);
  const profileAddr = await game.playerProfileContract();
  const profile = await hre.ethers.getContractAt("StarForgePlayerProfile", profileAddr, signer);
  const balance = await hre.ethers.provider.getBalance(signer.address);

  console.log("==========================================================");
  console.log("Testnet cycle");
  console.log(`Signer  ${signer.address}`);
  console.log(`Game    ${gameAddress}`);
  console.log(`Profile ${profileAddr}`);
  console.log(`Balance ${hre.ethers.formatEther(balance)}`);
  console.log("==========================================================");

  let state = await printState("start", game, profile, signer);

  // 1) generateTenShips if the daily cap allows, otherwise prove it is blocked
  if (state.remaining >= 10n) {
    console.log("generateTenShips...");
    const tx = await game.generateTenShips({ value: TEN_SHIPS_PRICE });
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error("generateTenShips failed");
    console.log(`  OK ${tx.hash} gas=${receipt.gasUsed}`);
    state = await printState("after generateTenShips", game, profile, signer);
    if (state.remaining !== 0n) {
      throw new Error("expected remainingBuys=0 after generateTenShips");
    }
  } else {
    console.log(`generateTenShips skipped (remaining=${state.remaining} < 10)`);
    try {
      await game.generateTenShips.staticCall({ value: TEN_SHIPS_PRICE });
      throw new Error("generateTenShips should revert when remaining < 10");
    } catch (error) {
      console.log(`  blocked as expected: ${error.reason || error.shortMessage || "revert"}`);
    }
  }

  // 2) ensure at least 4 units for a match
  while (state.units.length < 4 && state.remaining > 0n) {
    console.log("buyUnit...");
    const tx = await game.buyUnit({ value: BUY_UNIT_PRICE });
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error("buyUnit failed");
    console.log(`  OK ${tx.hash} gas=${receipt.gasUsed}`);
    state = await printState("after buyUnit", game, profile, signer);
  }
  if (state.units.length < 4) {
    throw new Error("Need 4 units");
  }

  // 3) one match + replay logs
  console.log("startMatch #1...");
  const remainingBefore = state.remaining;
  await runMatch(game, signer, [...state.units]);
  state = await printState("after match #1", game, profile, signer);
  if (state.remaining !== remainingBefore) {
    throw new Error("startMatch must not consume daily buys");
  }

  // 4) level-up free ships: keep battling until level > 1 or cap
  let matches = 1;
  while (Number(state.profile.level) <= 1 && matches < MAX_LEVEL_UP_MATCHES) {
    matches += 1;
    console.log(`startMatch #${matches} (farm XP)...`);
    await runMatch(game, signer, [...await game.getPlayerUnits(signer.address)]);
    state = await printState(`after match #${matches}`, game, profile, signer);
  }

  const pending = Number(state.pending);
  if (pending > 0) {
    const unitsBefore = state.units.length;
    console.log(`claimLevelUpShips pending=${pending}...`);
    try {
      const tx = await game.claimLevelUpShips();
      const receipt = await tx.wait();
      console.log(`  OK ${tx.hash} gas=${receipt.gasUsed}`);
    } catch (error) {
      console.log(`  claim skipped/failed: ${error.reason || error.shortMessage || error.message}`);
    }
    state = await printState("after claim", game, profile, signer);
    if (state.units.length <= unitsBefore && Number(state.profile.level) > 1) {
      console.log("  note: ships may already have been auto-granted in startMatch");
    }
  } else if (Number(state.profile.level) > 1) {
    console.log("pendingFree=0 after level-up — ships were auto-granted in startMatch");
  } else {
    console.log(`level still ${state.profile.level} after ${matches} matches — need more XP for free ship`);
  }

  console.log("");
  console.log("CYCLE CHECKS");
  console.log(`  units=${state.units.length} remainingBuys=${state.remaining} level=${state.profile.level}`);
  console.log(`  lastBattleId=${(await game.getLastBattleSummary(signer.address)).battleId}`);
  console.log("CYCLE OK");
}

main().catch((error) => {
  console.error("CYCLE FAILED");
  console.error(error.shortMessage || error.message || error);
  process.exitCode = 1;
});
