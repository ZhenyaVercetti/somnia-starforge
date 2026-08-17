// 1920x1080. Slot x/y is the CENTER of the slot.

export const HUD = {
  W: 1920,
  H: 1080,
  SAFE: 40,

  FONT: 'Rajdhani, Arial, sans-serif',
  FONT_DISPLAY: 'Orbitron, Rajdhani, sans-serif',

  BTN_W: 292,
  BTN_H: 66,
  BTN_FONT: '24px',

  TAB_W: 200,
  TAB_H: 56,
  SPEED_W: 140,
  SPEED_H: 54,

  START_W: 420,
  START_H: 96,
  START_FONT: '32px',

  PROFILE_W: 380,
  PROFILE_H: 140,

  TEAM: 148,
  SHOP: 118,
  RELIC: 126,
  AI: 112,

  TITLE: '24px',
  BODY: '22px',
  SMALL: '18px',

  color: {
    text: '#e8f4ff',
    accent: '#5ee7ff',
    good: '#5dffb0',
    warn: '#ffd56a',
    bad: '#ff6b88',
    muted: '#7f96ad',
    gold: '#f6e27a'
  }
};

// First slot CENTER so the whole row is symmetric around centerX.
export function gridFirstCenter(centerX: number, count: number, size: number, gap: number): number {
  return centerX - ((count - 1) * (size + gap)) / 2;
}

export const PREPARE_LAYOUT = {
  leftX: 250,
  centerX: 960,
  rightX: 1660,

  profileY: 20,
  logoY: 8,

  shopTitleY: 214,
  shopY: 300,
  shopGap: 18,

  leftBtnY0: 470,
  leftBtnStep: 80,

  autoY: 888,
  fleetTitleY: 176,
  teamTopY: 316,
  teamGap: 36,

  relicY: 736,

  aiTitleY: 176,
  aiTopY: 316,
  aiGap: 20,

  loreTitleY: 618,
  loreY: 824,

  startY: 1008
};

/**
 * Inner glass of ui_plate as a fraction of displaySize.
 * Measured from the PNG (692x496): transparent margin is tiny,
 * the thick chamfered bezel eats most of the leftover.
 */
export const UI_PLATE_WELL = {
  left: 0.114,
  right: 0.108,
  top: 0.188,
  bottom: 0.177
} as const;

export function plateWell(
  cx: number,
  cy: number,
  displayW: number,
  displayH: number,
  extra: { left?: number; right?: number; top?: number; bottom?: number } = {}
) {
  const left = cx - displayW / 2 + displayW * UI_PLATE_WELL.left + (extra.left ?? 0);
  const right = cx + displayW / 2 - displayW * UI_PLATE_WELL.right - (extra.right ?? 0);
  const top = cy - displayH / 2 + displayH * UI_PLATE_WELL.top + (extra.top ?? 0);
  const bottom = cy + displayH / 2 - displayH * UI_PLATE_WELL.bottom - (extra.bottom ?? 0);
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top
  };
}

export function hudText(overrides: Record<string, unknown> = {}) {
  return {
    fontFamily: HUD.FONT,
    fontStyle: '700',
    ...overrides
  };
}

export const RELIC_META = [
  { key: 'quantum_strike', name: 'Quantum Strike', short: 'ATK' },
  { key: 'void_shield', name: 'Void Shield', short: 'DEF' },
  { key: 'nebula_dash', name: 'Nebula Dash', short: 'SPD' },
  { key: 'echo_core', name: 'Echo Core', short: 'HP' },
  { key: 'flux_overload', name: 'Flux Overload', short: 'CRIT' },
  { key: 'last_stand', name: 'Last Stand', short: 'STAND' }
] as const;

export const FACTION_NAMES = ['Empire', 'Voidborn', 'Mechanoids'] as const;
export const CLASS_NAMES = ['Fighter', 'Cruiser', 'Dreadnought', 'Drone Swarm'] as const;
export const CLASS_SHORT = ['Ftr', 'Cru', 'Drd', 'Swarm'] as const;
export const RARITY_NAMES = ['Common', 'Rare', 'Legendary'] as const;

const SHIP_KEYS: Record<string, string> = {
  '0_0': 'emperial_fighter',
  '0_1': 'emperial_cruiser',
  '0_2': 'emperial_dreadnought',
  '0_3': 'emperial_droneswarm',
  '1_0': 'voidborn_fighter',
  '1_1': 'voidborn_cruiser',
  '1_2': 'voidborn_dreadnought',
  '1_3': 'voidborn_droneswarm',
  '2_0': 'mechanoid_fighter',
  '2_1': 'mechanoid_cruiser',
  '2_2': 'mechanoid_dreadnought',
  '2_3': 'mechanoid_droneswarm'
};

const RELIC_EFFECTS = [
  'Raises ATK for the whole fleet',
  'Raises DEF for the whole fleet',
  'Raises SPD for the whole fleet',
  'Raises HP for the whole fleet',
  'Raises crit chance for the fleet',
  'Once per ship: survive a killing blow at 1 HP'
];

export function displayText(overrides: Record<string, unknown> = {}) {
  return {
    fontFamily: HUD.FONT_DISPLAY,
    fontStyle: '700',
    ...overrides
  };
}

export function factionName(faction: number): string {
  return FACTION_NAMES[faction] || 'Unknown';
}

export function className(unitClass: number): string {
  return CLASS_NAMES[unitClass] || 'Unknown';
}

export function classShort(unitClass: number): string {
  return CLASS_SHORT[unitClass] || 'Unit';
}

export function rarityName(rarity: number): string {
  return RARITY_NAMES[rarity] || 'Unknown';
}

export function rarityColor(rarity: number): string {
  if (rarity === 2) return HUD.color.gold;
  if (rarity === 1) return HUD.color.good;
  return '#7ec8ff';
}

export function shipKey(faction: number, unitClass: number): string {
  return SHIP_KEYS[`${faction}_${unitClass}`] || 'emperial_fighter';
}

export function relicMeta(relicType: number) {
  return RELIC_META[relicType] || RELIC_META[0];
}

export function relicEffect(relicType: number): string {
  return RELIC_EFFECTS[relicType] || 'Unknown effect';
}
