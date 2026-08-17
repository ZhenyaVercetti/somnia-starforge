export type AchievementId =
  | 'first_watch'
  | 'first_ship'
  | 'hangar_open'
  | 'fleet_ready'
  | 'shopkeep'
  | 'relic_hunter'
  | 'relic_slotted'
  | 'ten_forged'
  | 'first_battle'
  | 'first_blood'
  | 'iron_fleet'
  | 'captain'
  | 'admiral'
  | 'last_stand';

export type AchievementDef = {
  id: AchievementId;
  title: string;
  hint: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_watch', title: 'Awake in the Void', hint: 'Enter the hangar with a connected wallet' },
  { id: 'first_ship', title: 'First Hull', hint: 'Own at least one ship' },
  { id: 'hangar_open', title: 'Open the Bay', hint: 'Open the collection overlay' },
  { id: 'fleet_ready', title: 'Full Broadside', hint: 'Fill all 8 fleet slots' },
  { id: 'shopkeep', title: 'Dream Merchant', hint: 'Reroll the relic shop or buy from it' },
  { id: 'relic_hunter', title: 'Relic Hunter', hint: 'Own a relic' },
  { id: 'relic_slotted', title: 'Armed', hint: 'Equip a relic locally' },
  { id: 'ten_forged', title: 'Ten Forged', hint: 'Generate 10 ships in one mint' },
  { id: 'first_battle', title: 'First Echo', hint: 'Finish a battle' },
  { id: 'first_blood', title: 'First Blood', hint: 'Win a battle' },
  { id: 'iron_fleet', title: 'Iron Fleet', hint: 'Reach 10 wins' },
  { id: 'captain', title: 'Captain', hint: 'Reach level 5' },
  { id: 'admiral', title: 'Admiral', hint: 'Reach level 10' },
  { id: 'last_stand', title: 'Not Today', hint: 'See Last Stand save a ship' }
];

type Store = {
  unlocked: AchievementId[];
};

const memory = new Map<string, Store>();

function key(account: string): string {
  return `starforge-achievements-${account.toLowerCase()}`;
}

function emptyStore(): Store {
  return { unlocked: [] };
}

function readStore(account: string): Store {
  const cache = memory.get(account.toLowerCase());
  if (cache) {
    return cache;
  }
  try {
    const raw = window.sessionStorage.getItem(key(account)) || window.localStorage.getItem(key(account));
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      const store = {
        unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : []
      };
      memory.set(account.toLowerCase(), store);
      return store;
    }
  } catch {
    // ignore
  }
  const store = emptyStore();
  memory.set(account.toLowerCase(), store);
  return store;
}

function writeStore(account: string, store: Store): void {
  memory.set(account.toLowerCase(), store);
  const payload = JSON.stringify(store);
  try {
    window.localStorage.setItem(key(account), payload);
  } catch {
    try {
      window.sessionStorage.setItem(key(account), payload);
    } catch {
      // ignore
    }
  }
}

export function getUnlocked(account: string): AchievementId[] {
  return [...readStore(account).unlocked];
}

export function isUnlocked(account: string, id: AchievementId): boolean {
  return readStore(account).unlocked.includes(id);
}

export function unlockAchievement(account: string, id: AchievementId): AchievementDef | null {
  const store = readStore(account);
  if (store.unlocked.includes(id)) {
    return null;
  }
  store.unlocked.push(id);
  writeStore(account, store);
  return ACHIEVEMENTS.find((item) => item.id === id) || null;
}

export type ProgressSnap = {
  level?: number;
  wins?: number;
  losses?: number;
  units?: number;
  relics?: number;
  fleet?: number;
};

export function evaluateAchievements(account: string, snap: ProgressSnap): AchievementDef[] {
  const unlocked: AchievementDef[] = [];
  const tryUnlock = (id: AchievementId) => {
    const def = unlockAchievement(account, id);
    if (def) {
      unlocked.push(def);
    }
  };

  tryUnlock('first_watch');
  if ((snap.units || 0) >= 1) {
    tryUnlock('first_ship');
  }
  if ((snap.fleet || 0) >= 8) {
    tryUnlock('fleet_ready');
  }
  if ((snap.relics || 0) >= 1) {
    tryUnlock('relic_hunter');
  }
  if ((snap.wins || 0) + (snap.losses || 0) >= 1) {
    tryUnlock('first_battle');
  }
  if ((snap.wins || 0) >= 1) {
    tryUnlock('first_blood');
  }
  if ((snap.wins || 0) >= 10) {
    tryUnlock('iron_fleet');
  }
  if ((snap.level || 0) >= 5) {
    tryUnlock('captain');
  }
  if ((snap.level || 0) >= 10) {
    tryUnlock('admiral');
  }
  return unlocked;
}
