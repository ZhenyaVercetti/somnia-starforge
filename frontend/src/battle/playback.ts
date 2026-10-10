import type { BattleEvent, UnitData } from '../utils/battleTypes';

export type PhaseName = 'intro' | 'telegraph' | 'shot' | 'hit' | 'gap' | 'done';

export type PlayClock = {
  phase: PhaseName;
  index: number;
  t: number;
  speed: 1 | 2;
};

export const INTRO_S = 1.65;

const CLASS_LENGTH = [2.05, 2.75, 3.55, 2.35] as const;

export function classLength(unitClass: number): number {
  return CLASS_LENGTH[unitClass] ?? CLASS_LENGTH[0];
}

/** Local -z maps to world +X at -PI/2 and to world -X at +PI/2. */
export function sideYaw(isPlayer: boolean): number {
  return isPlayer ? -Math.PI / 2 : Math.PI / 2;
}

/** World X of the ship's nose. Derived only from sideYaw. */
export function sideForwardX(isPlayer: boolean): number {
  return -Math.sin(sideYaw(isPlayer));
}

export function slotWorld(isPlayer: boolean, index: number): [number, number, number] {
  const col = ((index % 2) + 2) % 2;
  const row = Math.floor(index / 2);
  const x = (isPlayer ? -1 : 1) * (2.2 + (col === 0 ? 3.5 : 0));
  const z = (row - 1.5) * 4.6;
  return [x, 0, z];
}

/** Midpoint of the two rows. Camera offsets are added to this, not rebuilt. */
export function fleetFocus(): [number, number, number] {
  const farRow = slotWorld(true, 0);
  const nearRow = slotWorld(true, 2);
  return [0, 1.15, (farRow[2] + nearRow[2]) * 0.5];
}

export type CameraPose = {
  x: number;
  y: number;
  z: number;
  lookX: number;
  lookY: number;
  lookZ: number;
};

function place(lookX: number, lookY: number, lookZ: number, up: number, back: number): CameraPose {
  return { x: lookX * 0.12, y: lookY + up, z: lookZ + back, lookX, lookY, lookZ };
}

/** One framing for the intro and each shot. Offsets were checked against a 16:9 fov-40 camera. */
export function cameraPose(clock: PlayClock, events: BattleEvent[], player: UnitData[], ai: UnitData[]): CameraPose {
  const fleet = fleetFocus();
  const event = clock.phase === 'intro' || clock.phase === 'done' ? undefined : events[clock.index];
  if (!event) {
    const u = clock.phase === 'intro' ? Math.min(1, clock.t / INTRO_S) : 1;
    const s = u * u * (3 - 2 * u);
    const up = 7.2 + (5.8 - 7.2) * s;
    const back = 20 + (17.4 - 20) * s;
    return place(fleet[0], fleet[1], fleet[2], up, back);
  }
  const attacker = slotWorld(event.isPlayerSide, event.attackerIndex);
  const target = slotWorld(!event.isPlayerSide, event.targetIndex);
  const lookX = (attacker[0] + target[0]) * 0.5;
  const lookZ = (attacker[2] + target[2]) * 0.5;
  const unitClass = attackerClass(event, player, ai);
  const punch = clock.phase === 'hit' && (event.specialEffect === 'Last Stand' || (Number(event.remainingHp) <= 0 && event.specialEffect !== 'DODGE'));
  const shot = unitClass === 2 ? [5.6, 16.2] : unitClass === 1 ? [5.2, 15.2] : [4.8, 14.2];
  const close = unitClass === 2 ? [5.2, 15.0] : unitClass === 1 ? [4.6, 13.6] : [4.2, 12.6];
  const [up, back] = punch ? close : shot;
  return place(lookX, 1.15, lookZ, up, back);
}

export function attackerClass(event: BattleEvent, player: UnitData[], ai: UnitData[]): number {
  const list = event.isPlayerSide ? player : ai;
  const unit = list[event.attackerIndex];
  const value = Number(unit?.unitClass ?? 0);
  return value >= 0 && value <= 3 ? value : 0;
}

export function unitFaction(unit: UnitData | undefined): number {
  const value = Number(unit?.faction ?? 0);
  return value >= 0 && value <= 2 ? value : 0;
}

function smooth(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function phaseDuration(phase: PhaseName, unitClass: number): number {
  if (phase === 'intro') return INTRO_S;
  if (phase === 'telegraph') return 0.52;
  if (phase === 'shot') {
    if (unitClass === 1) return 0.82;
    if (unitClass === 2) return 0.95;
    if (unitClass === 3) return 0.78;
    return 0.48;
  }
  if (phase === 'hit') return 0.7;
  if (phase === 'gap') return 0.14;
  return 0;
}

export function advance(clock: PlayClock, dt: number, events: BattleEvent[], classOf: (event: BattleEvent) => number): PlayClock {
  if (clock.phase === 'done' || events.length === 0) {
    return { ...clock, phase: 'done', t: 0 };
  }
  let phase: PhaseName = clock.phase;
  let index = clock.index;
  let t = clock.t + Math.min(dt, 0.05) * clock.speed;
  for (let guard = 0; guard < 12; guard += 1) {
    const event = phase === 'intro' ? undefined : events[index];
    if (phase !== 'intro' && !event) {
      return { phase: 'done', index, t: 0, speed: clock.speed };
    }
    const dur = phaseDuration(phase, event ? classOf(event) : 0);
    if (t < dur) break;
    t -= dur;
    if (phase === 'intro') phase = 'telegraph';
    else if (phase === 'telegraph') phase = 'shot';
    else if (phase === 'shot') phase = 'hit';
    else if (phase === 'hit') phase = 'gap';
    else {
      index += 1;
      phase = index >= events.length ? 'done' : 'telegraph';
      if (phase === 'done') t = 0;
    }
  }
  return { phase, index, t, speed: clock.speed };
}

function resolvedCount(clock: PlayClock, eventCount: number): number {
  if (clock.phase === 'intro') return 0;
  if (clock.phase === 'done') return eventCount;
  if (clock.phase === 'gap') return Math.min(eventCount, clock.index + 1);
  return Math.min(eventCount, clock.index);
}

export function hpOf(events: BattleEvent[], maxHp: number[], isPlayer: boolean, index: number, clock: PlayClock): number {
  let hp = Number(maxHp[index]) || 100;
  const through = resolvedCount(clock, events.length);
  for (let i = 0; i < through; i += 1) {
    const event = events[i];
    if (!event) continue;
    const targetIsPlayer = !event.isPlayerSide;
    if (targetIsPlayer === isPlayer && event.targetIndex === index) {
      hp = Number(event.remainingHp);
    }
  }
  if ((clock.phase === 'hit' || clock.phase === 'gap') && clock.index < events.length) {
    const event = events[clock.index];
    if (event && !event.isPlayerSide === isPlayer && event.targetIndex === index) {
      hp = Number(event.remainingHp);
    }
  }
  return hp;
}

export type UnitPose = {
  x: number;
  y: number;
  z: number;
  homeX: number;
  homeY: number;
  homeZ: number;
  pitch: number;
  bank: number;
  flare: number;
  muzzle: number;
  flash: number;
  hidden: number;
  ghost: number;
  crit: boolean;
  dodge: boolean;
  lastStand: boolean;
  kill: boolean;
};

function deadBefore(events: BattleEvent[], isPlayer: boolean, index: number, count: number): boolean {
  for (let i = 0; i < count; i += 1) {
    const event = events[i];
    if (!event) continue;
    const targetIsPlayer = !event.isPlayerSide;
    if (targetIsPlayer === isPlayer && event.targetIndex === index && Number(event.remainingHp) <= 0 && event.specialEffect !== 'DODGE') {
      return true;
    }
  }
  return false;
}

export function unitPose(
  isPlayer: boolean,
  index: number,
  clock: PlayClock,
  events: BattleEvent[],
  player: UnitData[],
  ai: UnitData[]
): UnitPose {
  const home = slotWorld(isPlayer, index);
  const pose: UnitPose = {
    x: home[0],
    y: home[1],
    z: home[2],
    homeX: home[0],
    homeY: home[1],
    homeZ: home[2],
    pitch: 0,
    bank: 0,
    flare: 0.35,
    muzzle: 0,
    flash: 0,
    hidden: 0,
    ghost: 0,
    crit: false,
    dodge: false,
    lastStand: false,
    kill: false
  };
  const resolved = resolvedCount(clock, events.length);
  const alreadyDead = deadBefore(events, isPlayer, index, resolved);
  const event = clock.phase === 'intro' || clock.phase === 'done' ? undefined : events[clock.index];
  const isAttacker = !!event && event.isPlayerSide === isPlayer && event.attackerIndex === index;
  const isTarget = !!event && !event.isPlayerSide === isPlayer && event.targetIndex === index;
  if (alreadyDead && !isAttacker) {
    pose.y = -0.9;
    pose.hidden = 1;
    pose.flare = 0;
    return pose;
  }
  if (!event || clock.phase === 'gap') {
    return pose;
  }
  const dur = phaseDuration(clock.phase, attackerClass(event, player, ai));
  const ease = smooth(clock.t / Math.max(0.001, dur));
  const wave = Math.sin(Math.min(1, clock.t / Math.max(0.001, dur)) * Math.PI);
  const attackerHome = slotWorld(event.isPlayerSide, event.attackerIndex);
  const targetHome = slotWorld(!event.isPlayerSide, event.targetIndex);
  const sideSign = Math.sign(targetHome[2] - attackerHome[2]) || 1;
  const fwd = sideForwardX(isPlayer);
  const unitClass = attackerClass(event, player, ai);

  if (isAttacker && clock.phase === 'telegraph') {
    pose.bank = sideSign * wave * 0.42;
    pose.pitch = wave * 0.16;
    pose.flare = 0.4 + wave * 4.2;
    pose.z += sideSign * wave * 0.18;
  }

  if (isAttacker && clock.phase === 'shot') {
    pose.flare = 2.4;
    if (unitClass === 0) {
      pose.x += fwd * wave * 2.2;
      pose.z += (targetHome[2] - attackerHome[2]) * 0.12 * wave;
      pose.muzzle = wave * 5;
      pose.pitch = -wave * 0.12;
    } else if (unitClass === 1) {
      pose.muzzle = ease > 0.12 && ease < 0.92 ? 4.5 : 0.4;
      pose.flare = 1.4;
    } else if (unitClass === 2) {
      pose.x -= fwd * wave * 1.15;
      pose.muzzle = wave * 6;
      pose.pitch = wave * 0.08;
    } else {
      pose.flare = 1.1 + wave * 2;
      pose.bank = sideSign * wave * 0.18;
    }
  }

  if (isTarget && clock.phase === 'hit') {
    const effect = event.specialEffect;
    pose.crit = effect === 'CRIT';
    pose.dodge = effect === 'DODGE';
    pose.lastStand = effect === 'Last Stand';
    pose.kill = Number(event.remainingHp) <= 0 && effect !== 'DODGE';
    pose.flash = 1 - ease;
    if (pose.dodge) {
      pose.z += sideSign * wave * 1.15;
      pose.x -= fwd * wave * 0.25;
      pose.ghost = 0.5 * (1 - ease);
    }
    if (pose.kill) {
      pose.hidden = ease;
      pose.y = -0.95 * ease;
      pose.flare = 0.2 * (1 - ease);
    }
    if (pose.lastStand) {
      pose.flare = 2.8;
      pose.pitch = wave * 0.2;
    }
  }

  return pose;
}

export function beamVisible(clock: PlayClock, unitClass: number): boolean {
  if (clock.phase !== 'shot' || unitClass !== 1) return false;
  const dur = phaseDuration('shot', 1);
  const u = clock.t / dur;
  return u > 0.14 && u < 0.9;
}

export function droneTravel(clock: PlayClock, delay: number): number {
  if (clock.phase !== 'shot') return -1;
  const dur = phaseDuration('shot', 3);
  return Math.min(1, Math.max(0, (clock.t / dur - delay) / 0.72));
}
