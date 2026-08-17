export type NormalizedUnit = {
  faction: number;
  rarity: number;
  unitClass: number;
  attack: number;
  defense: number;
  speed: number;
};

export function emptyNormalizedUnit(): NormalizedUnit {
  return { faction: 0, rarity: 0, unitClass: 0, attack: 0, defense: 0, speed: 0 };
}

export function normalizeUnit(unit: unknown): NormalizedUnit {
  if (!unit) {
    return emptyNormalizedUnit();
  }
  if (Array.isArray(unit)) {
    return {
      faction: Number(unit[0] ?? 0),
      rarity: Number(unit[1] ?? 0),
      unitClass: Number(unit[2] ?? 0),
      attack: Number(unit[3] ?? 0),
      defense: Number(unit[4] ?? 0),
      speed: Number(unit[5] ?? 0)
    };
  }
  const record = unit as Record<string, unknown>;
  return {
    faction: Number(record.faction ?? 0),
    rarity: Number(record.rarity ?? 0),
    unitClass: Number(record.unitClass ?? 0),
    attack: Number(record.attack ?? 0),
    defense: Number(record.defense ?? 0),
    speed: Number(record.speed ?? 0)
  };
}
