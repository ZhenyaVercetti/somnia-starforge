export interface BattleEvent {
  round: number;
  isPlayerSide: boolean;
  attackerIndex: number;
  targetIndex: number;
  damageDealt: number;
  remainingHp: number;
  specialEffect?: string;
  attackerRarity?: number;
  attackerClass?: number;
  targetRarity?: number;
  targetClass?: number;
}

export interface UnitData {
  faction?: number;
  unitClass?: number;
  rarity?: number;
}

export interface BattleInitData {
  events?: BattleEvent[];
  playerWon?: boolean;
  playerMaxHp?: number[];
  aiMaxHp?: number[];
  playerUnitsData?: UnitData[];
  aiUnitsData?: UnitData[];
  savedTeam?: unknown[];
}
