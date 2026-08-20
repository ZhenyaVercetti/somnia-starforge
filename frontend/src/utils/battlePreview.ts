import type { BattleInitData } from './battleTypes';

export function createPreviewBattle(): BattleInitData {
  return {
    playerWon: true,
    playerMaxHp: [80, 140, 260, 90, 80, 140, 260, 90],
    aiMaxHp: [80, 140, 260, 90, 80, 140, 260, 90],
    playerUnitsData: [
      { faction: 0, unitClass: 0, rarity: 0 },
      { faction: 0, unitClass: 1, rarity: 1 },
      { faction: 0, unitClass: 2, rarity: 2 },
      { faction: 0, unitClass: 3, rarity: 0 },
      { faction: 2, unitClass: 0, rarity: 1 },
      { faction: 2, unitClass: 1, rarity: 0 },
      { faction: 1, unitClass: 2, rarity: 2 },
      { faction: 1, unitClass: 3, rarity: 1 }
    ],
    aiUnitsData: [
      { faction: 1, unitClass: 0, rarity: 0 },
      { faction: 1, unitClass: 1, rarity: 1 },
      { faction: 1, unitClass: 2, rarity: 2 },
      { faction: 1, unitClass: 3, rarity: 0 },
      { faction: 2, unitClass: 0, rarity: 1 },
      { faction: 2, unitClass: 1, rarity: 0 },
      { faction: 0, unitClass: 2, rarity: 2 },
      { faction: 0, unitClass: 3, rarity: 1 }
    ],
    savedTeam: [0, 1, 2, 3, 4, 5, 6, 7],
    events: [
      { round: 1, isPlayerSide: true, attackerIndex: 0, targetIndex: 0, damageDealt: 22, remainingHp: 58, specialEffect: '' },
      { round: 1, isPlayerSide: false, attackerIndex: 0, targetIndex: 0, damageDealt: 18, remainingHp: 62, specialEffect: '' },
      { round: 1, isPlayerSide: true, attackerIndex: 1, targetIndex: 1, damageDealt: 34, remainingHp: 106, specialEffect: '' },
      { round: 2, isPlayerSide: true, attackerIndex: 2, targetIndex: 2, damageDealt: 58, remainingHp: 202, specialEffect: 'CRIT' },
      { round: 2, isPlayerSide: false, attackerIndex: 1, targetIndex: 4, damageDealt: 0, remainingHp: 80, specialEffect: 'DODGE' },
      { round: 2, isPlayerSide: true, attackerIndex: 3, targetIndex: 4, damageDealt: 26, remainingHp: 54, specialEffect: '' },
      { round: 3, isPlayerSide: false, attackerIndex: 2, targetIndex: 6, damageDealt: 90, remainingHp: 1, specialEffect: 'Last Stand' },
      { round: 3, isPlayerSide: true, attackerIndex: 4, targetIndex: 0, damageDealt: 58, remainingHp: 0, specialEffect: '' },
      { round: 3, isPlayerSide: false, attackerIndex: 3, targetIndex: 5, damageDealt: 21, remainingHp: 119, specialEffect: '' },
      { round: 4, isPlayerSide: true, attackerIndex: 5, targetIndex: 5, damageDealt: 40, remainingHp: 100, specialEffect: '' },
      { round: 4, isPlayerSide: true, attackerIndex: 6, targetIndex: 2, damageDealt: 70, remainingHp: 132, specialEffect: 'CRIT' },
      { round: 4, isPlayerSide: false, attackerIndex: 5, targetIndex: 1, damageDealt: 28, remainingHp: 112, specialEffect: '' },
      { round: 5, isPlayerSide: true, attackerIndex: 7, targetIndex: 4, damageDealt: 54, remainingHp: 0, specialEffect: '' },
      { round: 5, isPlayerSide: true, attackerIndex: 2, targetIndex: 2, damageDealt: 64, remainingHp: 68, specialEffect: '' },
      { round: 6, isPlayerSide: true, attackerIndex: 0, targetIndex: 3, damageDealt: 24, remainingHp: 66, specialEffect: '' },
      { round: 6, isPlayerSide: true, attackerIndex: 1, targetIndex: 2, damageDealt: 68, remainingHp: 0, specialEffect: '' }
    ]
  };
}
