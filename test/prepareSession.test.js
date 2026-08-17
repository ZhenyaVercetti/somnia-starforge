const { expect } = require("chai");

const EMPTY_TEAM_SLOT = -1;
const SLOT_FORMAT = 2;

function isFilledSlot(id) {
  return typeof id === "number" && Number.isFinite(id) && id >= 0;
}

function compactTeamIds(team) {
  return team.map((id) => Number(id)).filter((id) => isFilledSlot(id));
}

function normalizeSlotId(raw, format) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return EMPTY_TEAM_SLOT;
  }
  if (format >= SLOT_FORMAT) {
    return value >= 0 ? value : EMPTY_TEAM_SLOT;
  }
  return value > 0 ? value : EMPTY_TEAM_SLOT;
}

describe("prepareSession slot format", function () {
  it("treats token 0 as a filled ship in v2", function () {
    const team = [0, EMPTY_TEAM_SLOT, 5, EMPTY_TEAM_SLOT, EMPTY_TEAM_SLOT, EMPTY_TEAM_SLOT, EMPTY_TEAM_SLOT, EMPTY_TEAM_SLOT];
    expect(compactTeamIds(team)).to.deep.equal([0, 5]);
    expect(isFilledSlot(0)).to.equal(true);
    expect(isFilledSlot(EMPTY_TEAM_SLOT)).to.equal(false);
  });

  it("migrates legacy zeros to empty slots", function () {
    const legacy = [0, 12, 0, 0, 0, 0, 0, 0].map((id) => normalizeSlotId(id, 1));
    expect(legacy[0]).to.equal(EMPTY_TEAM_SLOT);
    expect(legacy[1]).to.equal(12);
    expect(compactTeamIds(legacy)).to.deep.equal([12]);
  });

  it("keeps token 0 when loading v2", function () {
    const next = [0, -1, 8].map((id) => normalizeSlotId(id, 2));
    expect(next).to.deep.equal([0, EMPTY_TEAM_SLOT, 8]);
  });
});
