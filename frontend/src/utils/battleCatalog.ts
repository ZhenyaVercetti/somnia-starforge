// Visual registry for battle playback.
// Add a faction or class here, drop matching PNGs, do not edit BattleScene.

export type ShotKind = 'bolt' | 'beam' | 'slug' | 'needle';

export type FactionVisual = {
  id: number;
  slug: string;
  display: string;
  glow: number;
  core: number;
  hot: number;
};

export type ClassVisual = {
  id: number;
  slug: string;
  display: string;
  shot: ShotKind;
  fit: number;
  lunge: number;
  charge: number;
  travel: number;
  hold: number;
  fade: number;
  count: number;
  spread: number;
  stagger: number;
  length: number;
  coreH: number;
  glowH: number;
  forward: number;
  lift: number;
  rear: number;
  hpLift: number;
  weaponFit: number;
  worldFit: number;
};

export const DRONE_VARIANT_COUNT = 4;

export const BATTLE_FACTIONS: FactionVisual[] = [
  { id: 0, slug: 'emperial', display: 'Empire', glow: 0x3aa7ff, core: 0xe8f7ff, hot: 0xffffff },
  { id: 1, slug: 'voidborn', display: 'Voidborn', glow: 0xb44cff, core: 0xf0d0ff, hot: 0xffe6ff },
  { id: 2, slug: 'mechanoid', display: 'Mechanoids', glow: 0xff7a18, core: 0xffe3b0, hot: 0xfff4d0 }
];

export const BATTLE_CLASSES: ClassVisual[] = [
  {
    id: 0,
    slug: 'fighter',
    display: 'Fighter',
    shot: 'bolt',
    fit: 128,
    lunge: 16,
    charge: 0,
    travel: 150,
    hold: 0,
    fade: 80,
    count: 1,
    spread: 0,
    stagger: 0,
    length: 150,
    coreH: 28,
    glowH: 44,
    forward: 0.12,
    lift: 0.04,
    rear: 0,
    hpLift: 1.45,
    weaponFit: 0,
    worldFit: 2.12
  },
  {
    id: 1,
    slug: 'cruiser',
    display: 'Cruiser',
    shot: 'beam',
    fit: 168,
    lunge: 12,
    charge: 70,
    travel: 45,
    hold: 150,
    fade: 110,
    count: 1,
    spread: 0,
    stagger: 0,
    length: 0,
    coreH: 7,
    glowH: 28,
    forward: 0,
    lift: 0,
    rear: 0.08,
    hpLift: 1.78,
    weaponFit: 0,
    worldFit: 2.62
  },
  {
    id: 2,
    slug: 'dreadnought',
    display: 'Dreadnought',
    shot: 'slug',
    fit: 196,
    lunge: 10,
    charge: 90,
    travel: 210,
    hold: 0,
    fade: 110,
    count: 1,
    spread: 0,
    stagger: 0,
    length: 170,
    coreH: 48,
    glowH: 68,
    forward: -0.04,
    lift: -0.04,
    rear: 0.16,
    hpLift: 2.12,
    weaponFit: 0,
    worldFit: 3.18
  },
  {
    id: 3,
    slug: 'droneswarm',
    display: 'Drone Swarm',
    shot: 'needle',
    fit: 172,
    lunge: 14,
    charge: 0,
    travel: 130,
    hold: 0,
    fade: 70,
    count: 5,
    spread: 14,
    stagger: 26,
    length: 90,
    coreH: 10,
    glowH: 16,
    forward: 0.08,
    lift: 0.1,
    rear: 0,
    hpLift: 1.55,
    weaponFit: 0,
    worldFit: 0.98
  }
];

const factionById = new Map(BATTLE_FACTIONS.map((item) => [item.id, item]));
const classById = new Map(BATTLE_CLASSES.map((item) => [item.id, item]));

function hueColor(hue: number, sat: number, lit: number): number {
  const h = ((hue % 360) + 360) % 360 / 360;
  const a = sat * Math.min(lit, 1 - lit);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const ch = lit - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(ch * 255);
  };
  return (f(0) << 16) + (f(8) << 8) + f(4);
}

export function factionVisual(id: number): FactionVisual {
  const known = factionById.get(id);
  if (known) {
    return known;
  }
  const hue = id * 47 + 21;
  return {
    id,
    slug: `faction${id}`,
    display: `Faction ${id}`,
    glow: hueColor(hue, 0.74, 0.56),
    core: hueColor(hue, 0.32, 0.9),
    hot: 0xffffff
  };
}

export function classVisual(id: number): ClassVisual {
  const known = classById.get(id);
  if (known) {
    return known;
  }
  return {
    id,
    slug: `class${id}`,
    display: `Class ${id}`,
    shot: 'bolt',
    fit: 140,
    lunge: 14,
    charge: 0,
    travel: 160,
    hold: 0,
    fade: 80,
    count: 1,
    spread: 0,
    stagger: 0,
    length: 150,
    coreH: 26,
    glowH: 40,
    forward: 0.4,
    lift: 0.15,
    rear: 0.1,
    hpLift: 1.55,
    weaponFit: 0,
    worldFit: 2.2
  };
}

export function droneTexturePath(faction: number, variant: number): string {
  const known = factionById.has(faction);
  const slug = known ? factionVisual(faction).slug : 'emperial';
  const index = ((variant % DRONE_VARIANT_COUNT) + DRONE_VARIANT_COUNT) % DRONE_VARIANT_COUNT;
  return `assets/units/drones/${slug}_${index}.png`;
}

export function droneWreckPath(faction: number, variant: number): string {
  const known = factionById.has(faction);
  const slug = known ? factionVisual(faction).slug : 'emperial';
  const index = ((variant % DRONE_VARIANT_COUNT) + DRONE_VARIANT_COUNT) % DRONE_VARIANT_COUNT;
  return `assets/units/drones/${slug}_${index}_destroyed.png`;
}

export function weaponTexturePath(faction: number, unitClass: number): string {
  const visF = factionVisual(faction);
  const visC = classVisual(unitClass);
  const slugF = factionById.has(faction) ? visF.slug : 'emperial';
  return `assets/units/weapons/${slugF}_${visC.slug}.png`;
}

export function battleFxPath(name: string): string {
  return `assets/fx/${name}.png`;
}

export function droneLoadJobs(): CombatLoadJob[] {
  const jobs: CombatLoadJob[] = [];
  for (const faction of BATTLE_FACTIONS) {
    for (let variant = 0; variant < DRONE_VARIANT_COUNT; variant++) {
      jobs.push({
        key: `drone_${faction.slug}_${variant}`,
        path: droneTexturePath(faction.id, variant)
      });
      jobs.push({
        key: `drone_${faction.slug}_${variant}_destroyed`,
        path: droneWreckPath(faction.id, variant)
      });
    }
  }
  return jobs;
}

export function weaponLoadJobs(): CombatLoadJob[] {
  const jobs: CombatLoadJob[] = [];
  for (const faction of BATTLE_FACTIONS) {
    for (const unitClass of BATTLE_CLASSES) {
      if (unitClass.slug === 'droneswarm') {
        continue;
      }
      jobs.push({
        key: `weapon_${faction.slug}_${unitClass.slug}`,
        path: weaponTexturePath(faction.id, unitClass.id)
      });
    }
  }
  return jobs;
}

export function battleFxLoadJobs(): CombatLoadJob[] {
  return ['shot_bolt', 'shot_slug', 'shot_needle', 'shot_muzzle', 'shot_impact'].map((name) => ({
    key: name,
    path: battleFxPath(name)
  }));
}

export type CombatLoadJob = {
  key: string;
  path: string;
};

export function combatTextureKey(faction: number, unitClass: number): string {
  return `combat_${factionVisual(faction).slug}_${classVisual(unitClass).slug}`;
}

export function wreckTextureKey(faction: number, unitClass: number): string {
  return `${combatTextureKey(faction, unitClass)}_destroyed`;
}

export function genericCombatKey(unitClass: number): string {
  return `combat_generic_${classVisual(unitClass).slug}`;
}

export function combatTexturePath(faction: number, unitClass: number): string {
  const visF = factionVisual(faction);
  const visC = classVisual(unitClass);
  return `assets/units/combat/${visF.slug}_${visC.slug}.png`;
}

export function wreckTexturePath(faction: number, unitClass: number): string {
  const visF = factionVisual(faction);
  const visC = classVisual(unitClass);
  return `assets/units/combat/${visF.slug}_${visC.slug}_destroyed.png`;
}

export function genericCombatPath(unitClass: number): string {
  return `assets/units/combat/generic_${classVisual(unitClass).slug}.png`;
}

export function portraitPath(faction: number, unitClass: number): string {
  return `assets/units/portraits/${factionVisual(faction).slug}_${classVisual(unitClass).slug}.png`;
}

export function portraitWreckPath(faction: number, unitClass: number): string {
  return `assets/units/destroyed/${factionVisual(faction).slug}_${classVisual(unitClass).slug}_destroyed.png`;
}

export function portraitLoadJobs(): CombatLoadJob[] {
  const jobs: CombatLoadJob[] = [];
  for (const faction of BATTLE_FACTIONS) {
    for (const unitClass of BATTLE_CLASSES) {
      jobs.push({
        key: `portrait_${faction.slug}_${unitClass.slug}`,
        path: portraitPath(faction.id, unitClass.id)
      });
      jobs.push({
        key: `portrait_${faction.slug}_${unitClass.slug}_destroyed`,
        path: portraitWreckPath(faction.id, unitClass.id)
      });
    }
  }
  return jobs;
}

export function resolveShipTexture(
  scene: Phaser.Scene,
  faction: number,
  unitClass: number,
  wrecked = false
): string {
  const specific = wrecked
    ? wreckTextureKey(faction, unitClass)
    : combatTextureKey(faction, unitClass);
  if (scene.textures.exists(specific)) {
    return specific;
  }
  const generic = genericCombatKey(unitClass);
  if (!wrecked && scene.textures.exists(generic)) {
    return generic;
  }
  const portrait = `${factionVisual(faction).slug}_${classVisual(unitClass).slug}`;
  if (!wrecked && scene.textures.exists(portrait)) {
    return portrait;
  }
  if (scene.textures.exists('combat_generic_hull')) {
    return 'combat_generic_hull';
  }
  return specific;
}

export function combatLoadJobs(): CombatLoadJob[] {
  const jobs: CombatLoadJob[] = [];
  for (const faction of BATTLE_FACTIONS) {
    for (const unitClass of BATTLE_CLASSES) {
      jobs.push({
        key: combatTextureKey(faction.id, unitClass.id),
        path: combatTexturePath(faction.id, unitClass.id)
      });
      jobs.push({
        key: wreckTextureKey(faction.id, unitClass.id),
        path: wreckTexturePath(faction.id, unitClass.id)
      });
    }
  }
  for (const unitClass of BATTLE_CLASSES) {
    jobs.push({
      key: genericCombatKey(unitClass.id),
      path: genericCombatPath(unitClass.id)
    });
  }
  return jobs;
}

export function eventBeatMs(unitClass: number, kill: boolean, crit: boolean): number {
  const vis = classVisual(unitClass);
  const lunge = 110;
  const ret = 130;
  const rest = 160;
  const shot = vis.charge + vis.travel + vis.hold + Math.max(0, vis.count - 1) * vis.stagger;
  return lunge + shot + ret + rest + (kill ? 280 : 0) + (crit ? 50 : 0);
}
