const { expect } = require("chai");
const { ethers } = require("hardhat");

const BUY_UNIT_PRICE = ethers.parseEther("0.01");
const REROLL_PRICE = ethers.parseEther("0.005");
const BUY_RELIC_PRICE = ethers.parseEther("0.008");
const TEN_SHIPS_PRICE = ethers.parseEther("0.1");

const GAME_ROLE = ethers.id("GAME_ROLE");

async function deploySystem() {
  const [owner, player, stranger] = await ethers.getSigners();

  const UnitNFT = await ethers.getContractFactory("StarForgeUnitNFT");
  const unitNFT = await UnitNFT.deploy();
  await unitNFT.waitForDeployment();

  const Relic = await ethers.getContractFactory("StarForgeRelic");
  const relic = await Relic.deploy();
  await relic.waitForDeployment();

  const Profile = await ethers.getContractFactory("StarForgePlayerProfile");
  const profile = await Profile.deploy();
  await profile.waitForDeployment();

  const Game = await ethers.getContractFactory("StarForgeGame");
  const game = await Game.deploy(
    await unitNFT.getAddress(),
    await relic.getAddress(),
    await profile.getAddress()
  );
  await game.waitForDeployment();

  const gameAddress = await game.getAddress();
  await (await unitNFT.setGameContract(gameAddress)).wait();
  await (await relic.setGameContract(gameAddress)).wait();
  await (await profile.setGameContract(gameAddress)).wait();

  return { owner, player, stranger, unitNFT, relic, profile, game, gameAddress };
}

async function buyUnits(game, player, count) {
  for (let i = 0; i < count; i++) {
    await (await game.connect(player).buyUnit({ value: BUY_UNIT_PRICE })).wait();
  }
}

function parseNamedLogs(game, receipt, eventName) {
  return receipt.logs
    .map((log) => {
      try {
        return game.interface.parseLog(log);
      } catch (e) {
        return null;
      }
    })
    .filter((parsed) => parsed && parsed.name === eventName);
}

async function buyAnyRelic(game, player, profile) {
  await (await game.connect(player).rerollShop({ value: REROLL_PRICE })).wait();
  await (await game.connect(player).buyFromShop(0, { value: BUY_RELIC_PRICE })).wait();
  const relics = await profile.getPlayerRelics(player.address);
  return relics[relics.length - 1];
}

async function buyRelicOfType(game, player, profile, relicType) {
  await (await game.connect(player).rerollShop({ value: REROLL_PRICE })).wait();
  for (let attempt = 0; attempt < 80; attempt++) {
    const shop = await game.getPlayerShop(player.address);
    for (let slot = 0; slot < 3; slot++) {
      if (Number(shop[slot].relicType) === relicType && Number(shop[slot].relicValue) > 0) {
        await (await game.connect(player).buyFromShop(slot, { value: BUY_RELIC_PRICE })).wait();
        const relics = await profile.getPlayerRelics(player.address);
        return relics[relics.length - 1];
      }
    }
    await (await game.connect(player).buyFromShop(0, { value: BUY_RELIC_PRICE })).wait();
  }
  throw new Error(`Could not buy relic type ${relicType}`);
}

describe("StarForgeGame Variant 1", function () {
  it("constructor wires NFT, Relic and Profile", async function () {
    const { unitNFT, relic, profile, game } = await deploySystem();
    expect(await game.unitNFT()).to.equal(await unitNFT.getAddress());
    expect(await game.relicContract()).to.equal(await relic.getAddress());
    expect(await game.playerProfileContract()).to.equal(await profile.getAddress());
  });

  it("does not expose packed battle event storage", async function () {
    const { game } = await deploySystem();
    expect(game.interface.hasFunction("getPackedBattleEvents(address)")).to.equal(false);
    expect(game.interface.hasFunction("lastBattleEventsPacked(address)")).to.equal(false);
    expect(game.interface.hasFunction("getLastBattleResult(address)")).to.equal(true);
  });

  it("buyUnit mints a soulbound ship and records it on the profile", async function () {
    const { player, unitNFT, profile, game } = await deploySystem();

    await expect(game.connect(player).buyUnit({ value: BUY_UNIT_PRICE }))
      .to.emit(unitNFT, "UnitMinted");

    const units = await profile.getPlayerUnits(player.address);
    expect(units.length).to.equal(1);

    const ownerOf = await unitNFT.ownerOf(units[0]);
    expect(ownerOf).to.equal(player.address);

    await expect(
      unitNFT.connect(player).transferFrom(player.address, player.address, units[0])
    ).to.be.revertedWith("Soulbound: transfers are disabled");
  });

  it("rejects buyUnit when payment is too low", async function () {
    const { player, game } = await deploySystem();
    await expect(
      game.connect(player).buyUnit({ value: ethers.parseEther("0.001") })
    ).to.be.revertedWith("Insufficient payment");
  });

  it("enforces daily buy limit of 10 at level 1", async function () {
    const { player, game } = await deploySystem();
    await buyUnits(game, player, 10);
    expect(await game.getRemainingBuys(player.address)).to.equal(0n);
    await expect(
      game.connect(player).buyUnit({ value: BUY_UNIT_PRICE })
    ).to.be.revertedWith("Daily buy limit reached");
  });

  it("generateTenShips consumes 10 buys", async function () {
    const { player, profile, game } = await deploySystem();
    await (await game.connect(player).generateTenShips({ value: TEN_SHIPS_PRICE })).wait();
    const units = await profile.getPlayerUnits(player.address);
    expect(units.length).to.equal(10);
    expect(await game.getRemainingBuys(player.address)).to.equal(0n);
  });

  it("rerollShop fills three relic slots and buyFromShop mints a soulbound relic", async function () {
    const { player, relic, profile, game } = await deploySystem();

    await (await game.connect(player).rerollShop({ value: REROLL_PRICE })).wait();
    const shop = await game.getPlayerShop(player.address);
    expect(shop[0].isRelic).to.equal(true);
    expect(shop[0].relicValue).to.be.greaterThan(0);

    await (await game.connect(player).buyFromShop(0, { value: BUY_RELIC_PRICE })).wait();
    const relics = await profile.getPlayerRelics(player.address);
    expect(relics.length).to.equal(1);
    expect(await relic.balanceOf(player.address, relics[0])).to.equal(1n);

    await expect(
      relic.connect(player).safeTransferFrom(player.address, player.address, relics[0], 1, "0x")
    ).to.be.revertedWith("Soulbound: transfers are disabled");
  });

  it("startMatch reverts on invalid team size", async function () {
    const { player, game } = await deploySystem();
    await buyUnits(game, player, 3);
    const units = [...await game.getPlayerUnits(player.address)];
    await expect(game.connect(player).startMatch(units, [])).to.be.revertedWith("Invalid team size");
  });

  it("startMatch reverts when the player does not own a unit", async function () {
    const { player, game } = await deploySystem();
    await buyUnits(game, player, 4);
    await expect(
      game.connect(player).startMatch([999, 1000, 1001, 1002], [])
    ).to.be.reverted;
  });

  it("startMatch writes summary, emits logs, and does not keep event storage", async function () {
    const { player, profile, game } = await deploySystem();
    await buyUnits(game, player, 4);
    const units = [...await game.getPlayerUnits(player.address)];

    const tx = await game.connect(player).startMatch(units, []);
    const receipt = await tx.wait();
    console.log(`    startMatch gas used: ${receipt.gasUsed.toString()}`);

    const resolved = receipt.logs
      .map((log) => {
        try {
          return game.interface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .filter((parsed) => parsed && parsed.name === "BattleResolved");

    const emitted = receipt.logs
      .map((log) => {
        try {
          return game.interface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .filter((parsed) => parsed && parsed.name === "BattleEventEmitted");

    expect(resolved.length).to.equal(1);
    expect(emitted.length).to.be.greaterThan(0);

    const summary = await game.getLastBattleSummary(player.address);
    expect(summary.battleId).to.equal(resolved[0].args.battleId);
    expect(summary.playerFinalHp.length).to.equal(4);
    expect(summary.aiFinalHp.length).to.equal(8);
    expect(summary.timestamp).to.be.greaterThan(0n);

    const result = await game.getLastBattleResult(player.address);
    expect(result.length).to.equal(4);
    expect(result[3]).to.equal(summary.battleId);

    const playerProfile = await profile.getProfile(player.address);
    expect(playerProfile.level).to.be.greaterThan(0);
    expect(playerProfile.wins + playerProfile.losses).to.equal(1n);

    const ai = await game.getCurrentAI(player.address);
    expect(ai.length).to.equal(8);
    expect(ai[0].isRelic).to.equal(false);
  });

  it("equipRelics rejects relics the player does not own", async function () {
    const { player, game } = await deploySystem();
    await expect(game.connect(player).equipRelics([1, 0, 0])).to.be.revertedWith(
      "Not owner"
    );
  });

  it("clearPlayerData wipes game-side battle state and keeps profile units", async function () {
    const { player, profile, game } = await deploySystem();
    await buyUnits(game, player, 4);
    const units = [...await game.getPlayerUnits(player.address)];
    await (await game.connect(player).startMatch(units, [])).wait();

    await (await game.connect(player).clearPlayerData()).wait();
    const summary = await game.getLastBattleSummary(player.address);
    expect(summary.battleId).to.equal(ethers.ZeroHash);
    expect(await profile.getPlayerUnits(player.address)).to.deep.equal(units);
  });

  it("only the bound Game can mint units", async function () {
    const { stranger, unitNFT } = await deploySystem();
    await expect(
      unitNFT.connect(stranger).mintUnit(stranger.address, 0, 0, 0, 10, 10, 10)
    ).to.be.revertedWith("Only Game contract can mint");
  });

  it("profile grants GAME_ROLE to the linked Game", async function () {
    const { profile, gameAddress } = await deploySystem();
    expect(await profile.hasRole(GAME_ROLE, gameAddress)).to.equal(true);
  });

  it("keeps a hard daily paid-buy cap of 10 after level-up", async function () {
    const { owner, player, profile, game } = await deploySystem();
    await buyUnits(game, player, 1);
    await profile.grantGameRole(owner.address);
    for (let i = 0; i < 6; i++) {
      await (await profile.connect(owner).updateAfterBattle(player.address, true)).wait();
    }
    const playerProfile = await profile.getProfile(player.address);
    expect(playerProfile.level).to.be.greaterThan(1);

    await buyUnits(game, player, 9);
    expect(await game.getRemainingBuys(player.address)).to.equal(0n);
    await expect(
      game.connect(player).buyUnit({ value: BUY_UNIT_PRICE })
    ).to.be.revertedWith("Daily buy limit reached");
  });

  it("grants one free ship per level-up without consuming daily buys", async function () {
    const { owner, player, profile, game } = await deploySystem();
    await buyUnits(game, player, 1);
    const before = (await profile.getPlayerUnits(player.address)).length;
    const remainingBefore = await game.getRemainingBuys(player.address);

    await profile.grantGameRole(owner.address);
    for (let i = 0; i < 6; i++) {
      await (await profile.connect(owner).updateAfterBattle(player.address, true)).wait();
    }

    expect(await game.pendingLevelUpShips(player.address)).to.equal(1);
    await expect(game.connect(player).claimLevelUpShips()).to.emit(game, "LevelUpShipsGranted");

    const after = (await profile.getPlayerUnits(player.address)).length;
    expect(after).to.equal(before + 1);
    expect(await game.pendingLevelUpShips(player.address)).to.equal(0);
    expect(await game.getRemainingBuys(player.address)).to.equal(remainingBefore);
    await expect(game.connect(player).claimLevelUpShips()).to.be.revertedWith(
      "No level-up ships to claim"
    );
  });

  it("startMatch auto-grants pending level-up ships", async function () {
    const { owner, player, profile, game } = await deploySystem();
    await buyUnits(game, player, 4);
    await profile.grantGameRole(owner.address);
    for (let i = 0; i < 6; i++) {
      await (await profile.connect(owner).updateAfterBattle(player.address, true)).wait();
    }

    const before = (await profile.getPlayerUnits(player.address)).length;
    const units = [...await game.getPlayerUnits(player.address)];
    await (await game.connect(player).startMatch(units.slice(0, 4), [])).wait();

    const after = (await profile.getPlayerUnits(player.address)).length;
    expect(after).to.be.greaterThan(before);
    expect(await game.pendingLevelUpShips(player.address)).to.equal(0);
  });

  it("underfleet AI fillers are Rare with high stats at 0 battles", async function () {
    const { player, unitNFT, game } = await deploySystem();
    await buyUnits(game, player, 4);
    const units = [...await game.getPlayerUnits(player.address)];
    await (await game.connect(player).startMatch(units, [])).wait();

    const player0 = await unitNFT.getUnit(units[0]);
    const ai = await game.getCurrentAI(player.address);
    expect(ai.length).to.equal(8);
    expect(Number(ai[0].faction)).to.equal(Number(player0.faction));
    expect(Number(ai[0].unitClass)).to.equal(Number(player0.unitClass));
    expect(Number(ai[0].attack)).to.be.at.least(10);
    expect(Number(ai[0].attack)).to.be.at.most(20);

    for (let i = 4; i < 8; i++) {
      expect(Number(ai[i].rarity)).to.equal(1);
      expect(Number(ai[i].attack)).to.be.at.least(14);
      expect(Number(ai[i].defense)).to.be.at.least(12);
      expect(Number(ai[i].speed)).to.be.at.least(13);
    }
  });

  it("startMatch rejects a duplicated unit id", async function () {
    const { player, game } = await deploySystem();
    await buyUnits(game, player, 4);
    const units = [...await game.getPlayerUnits(player.address)];
    await expect(
      game.connect(player).startMatch([units[0], units[0], units[1], units[2]], [])
    ).to.be.revertedWith("Dup unit");
  });

  it("equipRelics rejects stacking the same relic id", async function () {
    const { player, profile, game } = await deploySystem();
    const relicId = await buyAnyRelic(game, player, profile);
    await expect(
      game.connect(player).equipRelics([relicId, relicId, 0])
    ).to.be.revertedWith("Dup relic");
  });

  it("startMatch rejects duplicate relics in calldata", async function () {
    const { player, profile, game } = await deploySystem();
    await buyUnits(game, player, 4);
    const units = [...await game.getPlayerUnits(player.address)];
    const relicId = await buyAnyRelic(game, player, profile);
    await expect(
      game.connect(player).startMatch(units, [relicId, relicId, 0])
    ).to.be.revertedWith("Dup relic");
  });

  it("Last Stand fires at most once per unit", async function () {
    const { player, profile, game } = await deploySystem();
    await buyUnits(game, player, 4);
    const units = [...await game.getPlayerUnits(player.address)];
    const lastStandId = await buyRelicOfType(game, player, profile, 5);
    await (await game.connect(player).equipRelics([lastStandId, 0, 0])).wait();

    let lastStandHits = [];
    for (let attempt = 0; attempt < 5 && lastStandHits.length === 0; attempt++) {
      const receipt = await (await game.connect(player).startMatch(units, [])).wait();
      lastStandHits = parseNamedLogs(game, receipt, "BattleEventEmitted")
        .filter((parsed) => Number(parsed.args.specialEffect) === 3);
    }

    expect(lastStandHits.length).to.be.greaterThan(0);

    const seen = new Set();
    for (const parsed of lastStandHits) {
      const key = `${parsed.args.isPlayerSide}-${parsed.args.targetIndex}`;
      expect(seen.has(key)).to.equal(false);
      seen.add(key);
    }
  });

  it("inherits free ship grants from previousGame after a redeploy", async function () {
    const { owner, player, unitNFT, relic, profile, game } = await deploySystem();
    await buyUnits(game, player, 1);
    await profile.grantGameRole(owner.address);
    for (let i = 0; i < 6; i++) {
      await (await profile.connect(owner).updateAfterBattle(player.address, true)).wait();
    }
    await (await game.connect(player).claimLevelUpShips()).wait();
    expect(await game.freeShipsGranted(player.address)).to.equal(1);

    const Game = await ethers.getContractFactory("StarForgeGame");
    const game2 = await Game.deploy(
      await unitNFT.getAddress(),
      await relic.getAddress(),
      await profile.getAddress()
    );
    await game2.waitForDeployment();
    await (await game2.setPreviousGame(await game.getAddress())).wait();
    await (await profile.setGameContract(await game2.getAddress())).wait();

    expect(await game2.freeShipsGranted(player.address)).to.equal(0);
    expect(await game2.pendingLevelUpShips(player.address)).to.equal(0);
    await expect(game2.connect(player).claimLevelUpShips()).to.be.revertedWith(
      "No level-up ships to claim"
    );
  });

  it("clearPlayerData also wipes lastAI", async function () {
    const { player, game } = await deploySystem();
    await buyUnits(game, player, 4);
    const units = [...await game.getPlayerUnits(player.address)];
    await (await game.connect(player).startMatch(units, [])).wait();
    const before = await game.getCurrentAI(player.address);
    expect(Number(before[0].attack)).to.be.greaterThan(0);

    await (await game.connect(player).clearPlayerData()).wait();
    const after = await game.getCurrentAI(player.address);
    expect(Number(after[0].attack)).to.equal(0);
    expect(Number(after[0].id)).to.equal(0);
  });

  it("full fleet of 8 leaves no filler slots", async function () {
    const { player, unitNFT, game } = await deploySystem();
    await (await game.connect(player).generateTenShips({ value: TEN_SHIPS_PRICE })).wait();
    const units = [...await game.getPlayerUnits(player.address)].slice(0, 8);
    await (await game.connect(player).startMatch(units, [])).wait();

    const ai = await game.getCurrentAI(player.address);
    for (let i = 0; i < 8; i++) {
      const playerUnit = await unitNFT.getUnit(units[i]);
      expect(Number(ai[i].faction)).to.equal(Number(playerUnit.faction));
      expect(Number(ai[i].unitClass)).to.equal(Number(playerUnit.unitClass));
    }
  });
});
