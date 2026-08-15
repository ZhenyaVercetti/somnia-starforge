/**
 * Diagnose why startMatch reverts on the live Game.
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

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const GAME = readGameAddress();
  const game = await hre.ethers.getContractAt("StarForgeGame", GAME, signer);
  const nft = await hre.ethers.getContractAt("StarForgeUnitNFT", await game.unitNFT(), signer);
  const relic = await hre.ethers.getContractAt("StarForgeRelic", await game.relicContract(), signer);
  const profile = await hre.ethers.getContractAt(
    "StarForgePlayerProfile",
    await game.playerProfileContract(),
    signer
  );
  const GAME_ROLE = hre.ethers.id("GAME_ROLE");

  console.log("signer", signer.address);
  console.log("game", GAME);
  console.log("paused", await game.paused());
  console.log("nft", await nft.getAddress(), "gameContract", await nft.gameContract());
  console.log("relic", await relic.getAddress(), "gameContract", await relic.gameContract());
  console.log("profile", await profile.getAddress());
  console.log("profile GAME_ROLE", await profile.hasRole(GAME_ROLE, GAME));
  console.log("pending ships", await game.pendingLevelUpShips(signer.address));
  console.log("freeShipsGranted", await game.freeShipsGranted(signer.address));

  const p = await profile.getProfile(signer.address);
  console.log("profile", {
    level: Number(p.level),
    xp: Number(p.xp),
    wins: Number(p.wins),
    losses: Number(p.losses),
  });

  const units = [...(await game.getPlayerUnits(signer.address))];
  console.log("units", units.length, units.map((id) => id.toString()));
  const team8 = units.slice(0, 8);
  const team4 = units.slice(0, 4);

  for (const id of team8) {
    try {
      const u = await nft.getUnit(id);
      console.log(
        "unit",
        id.toString(),
        "atk",
        Number(u.attack),
        "def",
        Number(u.defense),
        "spd",
        Number(u.speed),
        "r",
        Number(u.rarity),
        "owner",
        await nft.ownerOf(id)
      );
    } catch (error) {
      console.log("unit FAIL", id.toString(), error.shortMessage || error.message);
    }
  }

  const equipped = [...(await game.getEquippedRelics(signer.address))];
  console.log("equipped", equipped.map((id) => id.toString()));
  for (const id of equipped) {
    if (id === 0n) continue;
    try {
      const r = await relic.getRelic(id);
      console.log(
        "relic",
        id.toString(),
        "type",
        Number(r.relicType),
        "value",
        Number(r.value),
        "bal",
        (await relic.balanceOf(signer.address, id)).toString()
      );
    } catch (error) {
      console.log("relic FAIL", id.toString(), error.shortMessage || error.message);
    }
  }

  async function tryCall(label, team, relics, gasLimit) {
    console.log("");
    console.log("TRY", label, "team", team.length, "gas", gasLimit || "estimate");
    try {
      if (gasLimit) {
        await game.startMatch.staticCall(team, relics, { gasLimit });
      } else {
        await game.startMatch.staticCall(team, relics);
      }
      console.log("staticCall OK");
    } catch (error) {
      console.log("staticCall FAIL", error.shortMessage || error.message);
      if (error.data) console.log("data", error.data);
      if (error.reason) console.log("reason", error.reason);
      if (error.info?.error?.message) console.log("rpc", error.info.error.message);
    }
    try {
      const est = await game.startMatch.estimateGas(team, relics);
      console.log("estimateGas", est.toString());
    } catch (error) {
      console.log("estimateGas FAIL", error.shortMessage || error.message);
    }
  }

  await tryCall("8 units equipped", team8, equipped);
  await tryCall("4 units equipped", team4, equipped);
  await tryCall("8 units empty relics", team8, []);
  await tryCall("4 units empty relics", team4, []);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
