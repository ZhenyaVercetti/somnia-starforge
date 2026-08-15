/**
 * Short shadow-fleet check on a brand-new wallet.
 * Funds from the deployer, buys 10 ships, optional relics, then:
 *   12 matches with 8 ships (honeymoon target 65-75%)
 *   4 matches with 4 ships (underfleet should lose a lot)
 *
 *   npx hardhat run scripts/testnet-fresh-shadow.js --network somniaTestnet
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const EIGHTS = Number(process.env.EIGHTS || 12);
const FOURS = Number(process.env.FOURS || 0);
const FAT_MIN = Number(process.env.FAT_MIN || 48);
const FUND = hre.ethers.parseEther(process.env.FUND || "1.5");
const TEN_SHIPS = hre.ethers.parseEther("0.1");
const REROLL_PRICE = hre.ethers.parseEther("0.005");
const RELIC_PRICE = hre.ethers.parseEther("0.008");

function previewShadowScale(battles) {
  const progress = battles > 100 ? 100 : battles;
  return {
    progress,
    relicMirror: 65 + Math.floor((progress * 10) / 100),
    statScale: 104 + Math.floor((progress * 6) / 100)
  };
}

function previewRelicMirror(battles, relicValueSum) {
  const progress = battles > 100 ? 100 : battles;
  const base = 65 + Math.floor((progress * 10) / 100);
  let fat = relicValueSum > 38 ? relicValueSum - 38 : 0;
  if (fat > 14) fat = 14;
  let scale = base + fat;
  if (scale > 80) scale = 80;
  return scale;
}

function readGameAddress() {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "frontend", "src", "lib", "contractAddresses.ts"),
    "utf8"
  );
  const match = source.match(/GAME_ADDRESS = '([^']+)'/);
  return hre.ethers.getAddress(match[1].toLowerCase());
}

function parseLogs(game, receipt) {
  return receipt.logs
    .map((log) => {
      try {
        return game.interface.parseLog(log);
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
}

function summarizeAI(ai) {
  return ai.map((unit, index) => ({
    i: index,
    r: Number(unit.rarity),
    atk: Number(unit.attack),
    def: Number(unit.defense),
    spd: Number(unit.speed),
  }));
}

async function playSeries(game, profile, team, equipped, count, label) {
  let wins = 0;
  let losses = 0;
  let failed = 0;
  const rows = [];

  for (let i = 1; i <= count; i++) {
    try {
      const estimated = await game.startMatch.estimateGas(team, equipped);
      const gasLimit = (estimated * 13n) / 10n;
      const tx = await game.startMatch(team, equipped, { gasLimit });
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        failed += 1;
        console.log(`${label} #${i} FAILED status`);
        continue;
      }
      const logs = parseLogs(game, receipt);
      const resolved = logs.find((item) => item.name === "BattleResolved");
      const won = Boolean(resolved && resolved.args.playerWon);
      if (won) wins += 1;
      else losses += 1;
      rows.push(won);
      console.log(`${label} #${i} ${tx.hash} gas=${receipt.gasUsed} won=${won}`);
    } catch (error) {
      const message = error.shortMessage || error.message || "";
      const transient = /ECONNRESET|ETIMEDOUT|socket hang up|network/i.test(message);
      if (transient) {
        try {
          const estimated = await game.startMatch.estimateGas(team, equipped);
          const gasLimit = (estimated * 13n) / 10n;
          const retryTx = await game.startMatch(team, equipped, { gasLimit });
          const retryReceipt = await retryTx.wait();
          const logs = parseLogs(game, retryReceipt);
          const resolved = logs.find((item) => item.name === "BattleResolved");
          const won = Boolean(resolved && resolved.args.playerWon);
          if (won) wins += 1;
          else losses += 1;
          rows.push(won);
          console.log(`${label} #${i} RETRY ${retryTx.hash} gas=${retryReceipt.gasUsed} won=${won}`);
          continue;
        } catch (retryError) {
          failed += 1;
          console.log(`${label} #${i} ERROR retry ${retryError.shortMessage || retryError.message}`);
          continue;
        }
      }
      failed += 1;
      console.log(`${label} #${i} ERROR ${message}`);
    }
  }

  const p = await profile.getProfile(await game.runner.getAddress());
  const battles = Number(p.wins) + Number(p.losses);
  const scale = previewShadowScale(battles);
  console.log(
    `${label} RESULT wins=${wins} losses=${losses} failed=${failed} wr=${wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : "n/a"}%`
  );
  console.log(
    `${label} profile level=${p.level} W=${p.wins} L=${p.losses} battles=${battles} progress=${scale.progress} relicMirror=${scale.relicMirror} statScale=${scale.statScale}`
  );
  return { wins, losses, failed, rows };
}

async function main() {
  const [funder] = await hre.ethers.getSigners();
  const GAME = readGameAddress();
  const fresh = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);

  console.log("==========================================================");
  console.log("Fresh shadow run");
  console.log("funder", funder.address);
  console.log("fresh", fresh.address);
  console.log("game", GAME);
  console.log("==========================================================");

  const fundTx = await funder.sendTransaction({ to: fresh.address, value: FUND });
  await fundTx.wait();
  console.log("funded", fundTx.hash, hre.ethers.formatEther(FUND));

  const game = await hre.ethers.getContractAt("StarForgeGame", GAME, fresh);
  const profile = await hre.ethers.getContractAt(
    "StarForgePlayerProfile",
    await game.playerProfileContract(),
    fresh
  );

  const tenTx = await game.generateTenShips({ value: TEN_SHIPS });
  const tenReceipt = await tenTx.wait();
  const units = [...(await game.getPlayerUnits(fresh.address))];
  console.log("generateTenShips", tenTx.hash, "gas", tenReceipt.gasUsed.toString(), "units", units.length);

  const startScale = previewShadowScale(0);
  console.log("scale at 0 battles", startScale);

  async function buyOpenSlots() {
    const shop = await game.getPlayerShop(fresh.address);
    for (let slot = 0; slot < 3; slot++) {
      const item = shop[slot];
      if (!item || !item.isRelic || Number(item.relicValue) === 0) {
        console.log(`shop slot ${slot} empty`);
        continue;
      }
      const buyTx = await game.buyFromShop(slot, { value: RELIC_PRICE });
      await buyTx.wait();
      console.log(`buy relic slot ${slot} type=${Number(item.relicType)} value=${Number(item.relicValue)}`);
    }
  }

  if (await game.canReroll(fresh.address)) {
    const rerollTx = await game.rerollShop({ value: REROLL_PRICE });
    await rerollTx.wait();
    console.log("reroll #1", rerollTx.hash);
  }
  await buyOpenSlots();
  if (await game.canReroll(fresh.address)) {
    const rerollTx = await game.rerollShop({ value: REROLL_PRICE });
    await rerollTx.wait();
    console.log("reroll #2", rerollTx.hash);
    await buyOpenSlots();
  }

  const relic = await hre.ethers.getContractAt("StarForgeRelic", await game.relicContract(), fresh);
  const relicIds = [...(await game.getPlayerRelics(fresh.address))];
  const relicRows = [];
  for (const id of relicIds) {
    const data = await relic.getRelic(id);
    relicRows.push({ id, type: Number(data.relicType), value: Number(data.value) });
  }
  relicRows.sort((a, b) => {
    const aCombat = a.type === 5 ? 0 : a.value;
    const bCombat = b.type === 5 ? 0 : b.value;
    return bCombat - aCombat;
  });
  const top = relicRows.slice(0, 3);
  const relicSum = top.reduce((sum, row) => sum + (row.type === 5 ? 0 : row.value), 0);
  const equipped = [top[0]?.id || 0n, top[1]?.id || 0n, top[2]?.id || 0n];
  if (top.length > 0) {
    const eqTx = await game.equipRelics(equipped);
    await eqTx.wait();
  }
  const liveMirror = previewRelicMirror(0, relicSum);
  console.log("all relics", relicRows);
  console.log("equipped top3", top, "sum", relicSum, "mirror", Number(liveMirror));
  if (relicSum < FAT_MIN) {
    console.log(`shop too lean (${relicSum} < ${FAT_MIN}), refund and retry`);
    const leftoverLean = await hre.ethers.provider.getBalance(fresh.address);
    const gasPriceLean = (await hre.ethers.provider.getFeeData()).gasPrice || 1000000000n;
    const reserveLean = gasPriceLean * 21000n * 2n;
    if (leftoverLean > reserveLean + hre.ethers.parseEther("0.02")) {
      const backLean = leftoverLean - reserveLean;
      const refundLean = await fresh.sendTransaction({ to: funder.address, value: backLean });
      await refundLean.wait();
      console.log("refund lean", refundLean.hash);
    }
    process.env.FAT_RETRY = String(Number(process.env.FAT_RETRY || "0") + 1);
    if (Number(process.env.FAT_RETRY) > 4) {
      throw new Error(`Could not roll a fat shop in 5 wallets, last sum=${relicSum}`);
    }
    return main();
  }

  const team8 = units.slice(0, 8);
  const team4 = units.slice(0, 4);

  const probe8 = await game.startMatch.staticCall(team8, equipped);
  console.log("static 8-ship ok", probe8 === undefined || probe8 === null ? "void" : probe8);
  const firstEst = await game.startMatch.estimateGas(team8, equipped);
  const firstTx = await game.startMatch(team8, equipped, { gasLimit: (firstEst * 13n) / 10n });
  const firstReceipt = await firstTx.wait();
  const firstLogs = parseLogs(game, firstReceipt);
  const firstWon = Boolean(firstLogs.find((item) => item.name === "BattleResolved")?.args.playerWon);
  console.log("8-ship #1", firstTx.hash, "won", firstWon, "gas", firstReceipt.gasUsed.toString());
  console.log("AI after 8-ship", summarizeAI(await game.getCurrentAI(fresh.address)));

  const eights = await playSeries(game, profile, team8, equipped, EIGHTS - 1, "8-ship");
  eights.wins += firstWon ? 1 : 0;
  eights.losses += firstWon ? 0 : 1;
  eights.rows.unshift(firstWon);
  console.log(
    `8-ship TOTAL wins=${eights.wins} losses=${eights.losses} wr=${((eights.wins / (eights.wins + eights.losses)) * 100).toFixed(1)}%`
  );
  const buckets = [
    [0, 24],
    [25, 49],
    [50, 74],
    [75, 99],
  ];
  for (const [from, to] of buckets) {
    const slice = eights.rows.slice(from, to + 1);
    if (slice.length === 0) continue;
    const w = slice.filter(Boolean).length;
    console.log(
      `8-ship ${from + 1}-${from + slice.length}: ${w}-${slice.length - w} (${((w / slice.length) * 100).toFixed(1)}%)`
    );
  }

  let fours = { wins: 0, losses: 0 };
  if (FOURS > 0) {
    const fourTxEst = await game.startMatch.estimateGas(team4, equipped);
    const fourTx = await game.startMatch(team4, equipped, { gasLimit: (fourTxEst * 13n) / 10n });
    const fourReceipt = await fourTx.wait();
    const fourWon = Boolean(
      parseLogs(game, fourReceipt).find((item) => item.name === "BattleResolved")?.args.playerWon
    );
    console.log("4-ship #1", fourTx.hash, "won", fourWon, "gas", fourReceipt.gasUsed.toString());
    console.log("AI after 4-ship (slots 4-7 should be fillers)", summarizeAI(await game.getCurrentAI(fresh.address)));

    fours = await playSeries(game, profile, team4, equipped, FOURS - 1, "4-ship");
    fours.wins += fourWon ? 1 : 0;
    fours.losses += fourWon ? 0 : 1;
    console.log(
      `4-ship TOTAL wins=${fours.wins} losses=${fours.losses} wr=${((fours.wins / (fours.wins + fours.losses)) * 100).toFixed(1)}%`
    );
  }

  const leftover = await hre.ethers.provider.getBalance(fresh.address);
  if (leftover > hre.ethers.parseEther("0.02")) {
    const gasPrice = (await hre.ethers.provider.getFeeData()).gasPrice || 1000000000n;
    const reserve = gasPrice * 21000n * 2n;
    if (leftover > reserve) {
      const back = leftover - reserve;
      const refund = await fresh.sendTransaction({ to: funder.address, value: back });
      await refund.wait();
      console.log("refund", refund.hash, hre.ethers.formatEther(back));
    }
  }

  console.log("");
  console.log("SUMMARY");
  console.log(`fresh=${fresh.address}`);
  console.log(`8-ship ${eights.wins}-${eights.losses} (${((eights.wins / (eights.wins + eights.losses)) * 100).toFixed(1)}%) fat-shop target 75-80%`);
  if (FOURS > 0) {
    console.log(`4-ship ${fours.wins}-${fours.losses} (${((fours.wins / (fours.wins + fours.losses)) * 100).toFixed(1)}%) target 15-35%`);
  }
}

main().catch((error) => {
  console.error("FRESH SHADOW FAILED");
  console.error(error.shortMessage || error.message || error);
  process.exitCode = 1;
});
