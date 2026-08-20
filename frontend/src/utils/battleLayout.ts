import { classVisual } from './battleCatalog';

export const BATTLE_FIELD = {
  playerOuterX: 548,
  playerInnerX: 786,
  enemyInnerX: 1134,
  enemyOuterX: 1372,
  firstRowY: 238,
  rowStep: 156,
  cols: 2
} as const;

export type SlotPose = {
  x: number;
  y: number;
  fit: number;
  flipX: boolean;
};

export function slotPose(isPlayer: boolean, index: number, unitClass: number): SlotPose {
  const vis = classVisual(unitClass);
  const col = ((index % BATTLE_FIELD.cols) + BATTLE_FIELD.cols) % BATTLE_FIELD.cols;
  const row = Math.floor(index / BATTLE_FIELD.cols);
  const inner = col === 1;
  let x = isPlayer
    ? (inner ? BATTLE_FIELD.playerInnerX : BATTLE_FIELD.playerOuterX)
    : (inner ? BATTLE_FIELD.enemyInnerX : BATTLE_FIELD.enemyOuterX);
  const towardCenter = isPlayer ? 1 : -1;
  x += towardCenter * vis.forward * 28;
  x -= towardCenter * vis.rear * 28;
  const y = BATTLE_FIELD.firstRowY + row * BATTLE_FIELD.rowStep - vis.lift * 18;
  const fit = vis.fit * (inner ? 1.05 : 0.93);
  return { x, y, fit, flipX: !isPlayer };
}

export function muzzleOf(x: number, y: number, displayWidth: number, flipX: boolean) {
  const dir = flipX ? -1 : 1;
  return { x: x + dir * displayWidth * 0.42, y };
}

export function rearOf(x: number, y: number, displayWidth: number, flipX: boolean) {
  const dir = flipX ? -1 : 1;
  return { x: x - dir * displayWidth * 0.36, y };
}

export function toward(fromX: number, fromY: number, toX: number, toY: number, dist: number) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: fromX + (dx / len) * dist,
    y: fromY + (dy / len) * dist
  };
}
