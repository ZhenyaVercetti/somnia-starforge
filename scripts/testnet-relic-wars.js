/**
 * Full UX path: reroll shop, buy relics, equip, play 20-30 matches.
 *   npx hardhat run scripts/testnet-relic-wars.js --network somniaTestnet
 */

const hre = require("hardhat");

const fs = require("fs");
const path = require("path");

function readGameAddress() {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "frontend", "src", "lib", "contractAddresses.ts"),
    "utf8"
  );
  const match = source.match(/GAME_ADDRESS = '([^']+)'/);
  return hre.ethers.getAddress(match[1].toLowerCase());
}
const MATCHES = Number(process.env.MATCHES || 25);
const REROLL_PRICE = hre.ethers.parseEther("0.005");
const RELIC_PRICE = hre.ethers.parseEther("0.008");

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

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const GAME = readGameAddress();
  const game = await hre.ethers.getContractAt("StarForgeGame", GAME, signer);
  const profile = await hre.ethers.getContractAt(
    "StarForgePlayerProfile",
    await game.playerProfileContract(),
    signer
  );

  console.log("==========================================================");
  console.log("Relic wars");
  console.log(signer.address);
  console.log("balance", hre.ethers.formatEther(await hre.ethers.provider.getBalance(signer.address)));
  console.log("==========================================================");

  let shop = await game.getPlayerShop(signer.address);
  console.log("shop before", shop.map((s) => ({ relic: s.isRelic, type: Number(s.relicType), value: Number(s.relicValue) })));

  const canReroll = await game.canReroll(signer.address);
  console.log("canReroll", canReroll);
  if (canReroll) {
    const tx = await game.rerollShop({ value: REROLL_PRICE });
    const receipt = await tx.wait();
    console.log("reroll #1", tx.hash, "gas", receipt.gasUsed.toString());
    shop = await game.getPlayerShop(signer.address);
    console.log("shop after reroll", shop.map((s) => ({ type: Number(s.relicType), value: Number(s.relicValue) })));
  }

  const relicsBefore = [...await game.getPlayerRelics(signer.address)];
  console.log("relics before", relicsBefore.map((id) => id.toString()));

  for (let slot = 0; slot < 3; slot++) {
    const item = shop[slot];
    if (!item || !item.isRelic || Number(item.relicValue) === 0) {
      console.log(`slot ${slot} empty, skip buy`);
      continue;
    }
    const tx = await game.buyFromShop(slot, { value: RELIC_PRICE });
    const receipt = await tx.wait();
    console.log(`buy slot ${slot}`, tx.hash, "gas", receipt.gasUsed.toString(), "type", Number(item.relicType), "value", Number(item.relicValue));
  }

  if (await game.canReroll(signer.address)) {
    const tx = await game.rerollShop({ value: REROLL_PRICE });
    const receipt = await tx.wait();
    console.log("reroll #2", tx.hash, "gas", receipt.gasUsed.toString());
    shop = await game.getPlayerShop(signer.address);
    for (let slot = 0; slot < 3; slot++) {
      const item = shop[slot];
      if (!item || !item.isRelic || Number(item.relicValue) === 0) continue;
      const buyTx = await game.buyFromShop(slot, { value: RELIC_PRICE });
      const buyReceipt = await buyTx.wait();
      console.log(`buy after reroll2 slot ${slot}`, buyTx.hash, "gas", buyReceipt.gasUsed.toString());
    }
  } else {
    console.log("second reroll not available today");
  }

  const relics = [...await game.getPlayerRelics(signer.address)];
  console.log("relics after buys", relics.map((id) => id.toString()));
  if (relics.length === 0) {
    throw new Error("No relics to equip");
  }

  const equipped = [relics[0] || 0n, relics[1] || 0n, relics[2] || 0n];
  const eqTx = await game.equipRelics(equipped);
  const eqReceipt = await eqTx.wait();
  console.log("equipRelics", eqTx.hash, "gas", eqReceipt.gasUsed.toString(), equipped.map((id) => id.toString()));

  const units = [...await game.getPlayerUnits(signer.address)];
  const team = units.slice(0, 8);
  if (team.length < 4) {
    throw new Error("Need 4 units");
  }
  console.log("team", team.length, team.slice(0, 4).map((id) => id.toString()));

  let wins = 0;
  let losses = 0;
  let eventsTotal = 0;
  let grants = 0;
  let failed = 0;

  for (let i = 1; i <= MATCHES; i++) {
    try {
      const estimated = await game.startMatch.estimateGas(team, equipped);
      const gasLimit = (estimated * 13n) / 10n;
      const tx = await game.startMatch(team, equipped, { gasLimit });
      const receipt = await tx.wait();
      if (receipt.status !== 1) {
        failed += 1;
        console.log(`#${i} FAILED status`);
        continue;
      }
      const logs = parseLogs(game, receipt);
      const resolved = logs.find((item) => item.name === "BattleResolved");
      const events = logs.filter((item) => item.name === "BattleEventEmitted");
      const grantLogs = logs.filter((item) => item.name === "LevelUpShipsGranted");
      const won = Boolean(resolved && resolved.args.playerWon);
      if (won) wins += 1;
      else losses += 1;
      eventsTotal += events.length;
      grants += grantLogs.length;
      console.log(
        `#${i} ${tx.hash} gas=${receipt.gasUsed} won=${won} events=${events.length} grants=${grantLogs.length}`
      );
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
          const events = logs.filter((item) => item.name === "BattleEventEmitted");
          const grantLogs = logs.filter((item) => item.name === "LevelUpShipsGranted");
          const won = Boolean(resolved && resolved.args.playerWon);
          if (won) wins += 1;
          else losses += 1;
          eventsTotal += events.length;
          grants += grantLogs.length;
          console.log(
            `#${i} RETRY ${retryTx.hash} gas=${retryReceipt.gasUsed} won=${won} events=${events.length} grants=${grantLogs.length}`
          );
          continue;
        } catch (retryError) {
          failed += 1;
          console.log(`#${i} ERROR retry ${retryError.shortMessage || retryError.message}`);
          continue;
        }
      }
      failed += 1;
      console.log(`#${i} ERROR ${message}`);
    }
  }

  const p = await profile.getProfile(signer.address);
  const unitsAfter = await game.getPlayerUnits(signer.address);
  const remaining = await game.getRemainingBuys(signer.address);
  console.log("");
  console.log("SUMMARY");
  console.log(`matches=${MATCHES} wins=${wins} losses=${losses} failed=${failed}`);
  console.log(`eventsTotal=${eventsTotal} levelUpGrants=${grants}`);
  console.log(`level=${p.level} xp=${p.xp} W=${p.wins} L=${p.losses} units=${unitsAfter.length} remainingBuys=${remaining}`);
  if (failed > 0) {
    throw new Error(`${failed} matches failed`);
  }
  console.log("RELIC WARS OK");
}

main().catch((error) => {
  console.error("RELIC WARS FAILED");
  console.error(error.shortMessage || error.message || error);
  process.exitCode = 1;
});
