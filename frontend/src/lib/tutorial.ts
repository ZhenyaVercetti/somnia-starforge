export type TutorialStepId =
  | 'welcome'
  | 'ships'
  | 'fleet'
  | 'relics'
  | 'start'
  | 'collection'
  | 'battle';

export type TutorialStep = {
  id: TutorialStepId;
  title: string;
  body: string;
  scene: 'PrepareScene' | 'CollectionScene' | 'BattleScene';
  focus?: { x: number; y: number; w: number; h: number };
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome, Captain',
    body: 'This is your hangar. Profile and shop sit on the left. Fleet in the center. The Shadow Fleet waits on the right.',
    scene: 'PrepareScene',
    focus: { x: 250, y: 90, w: 380, h: 140 }
  },
  {
    id: 'ships',
    title: 'Get ships',
    body: 'BUY SHIP mints one hull. GENERATE 10 mints a full pack and spends the daily 10. Relic shop is rerolled separately.',
    scene: 'PrepareScene',
    focus: { x: 250, y: 590, w: 300, h: 280 }
  },
  {
    id: 'fleet',
    title: 'Fill the fleet',
    body: 'Fill all 8 fleet slots. Open COLLECTION or hit AUTO.',
    scene: 'PrepareScene',
    focus: { x: 960, y: 400, w: 760, h: 380 }
  },
  {
    id: 'relics',
    title: 'Relics',
    body: 'Up to 3 relics. Equip from the collection without a wallet pop-up. AUTO and CLEAR apply to relics too. Last Stand saves a ship once.',
    scene: 'PrepareScene',
    focus: { x: 960, y: 736, w: 520, h: 170 }
  },
  {
    id: 'start',
    title: 'Start battle',
    body: 'START BATTLE sends your fleet into the fight. Enter starts. C opens the hangar.',
    scene: 'PrepareScene',
    focus: { x: 960, y: 1008, w: 420, h: 96 }
  },
  {
    id: 'collection',
    title: 'Hangar',
    body: 'Left half only. Click to inspect. Double-click or ADD to put a ship in the fleet. Relic EQUIP is local — the tx happens at START.',
    scene: 'CollectionScene',
    focus: { x: 480, y: 540, w: 900, h: 980 }
  },
  {
    id: 'battle',
    title: 'The void',
    body: 'x2 speeds the fight. SKIP hurries it, it does not jump to the result. Last Stand can fire once per ship.',
    scene: 'BattleScene',
    focus: { x: 1766, y: 48, w: 280, h: 70 }
  }
];

type TutorialStore = {
  done: boolean;
  index: number;
};

const memory = new Map<string, TutorialStore>();

function storageKey(account: string): string {
  return `starforge-tutorial-${account.toLowerCase()}`;
}

function read(account: string): TutorialStore {
  const cached = memory.get(account.toLowerCase());
  if (cached) {
    return cached;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(account));
    if (raw) {
      const parsed = JSON.parse(raw) as TutorialStore;
      const store = { done: !!parsed.done, index: Number(parsed.index) || 0 };
      memory.set(account.toLowerCase(), store);
      return store;
    }
  } catch {
    // ignore
  }
  const store = { done: false, index: 0 };
  memory.set(account.toLowerCase(), store);
  return store;
}

function write(account: string, store: TutorialStore): void {
  memory.set(account.toLowerCase(), store);
  try {
    window.localStorage.setItem(storageKey(account), JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function isTutorialDone(account: string): boolean {
  return read(account).done;
}

export function getTutorialIndex(account: string): number {
  return read(account).index;
}

export function setTutorialIndex(account: string, index: number): void {
  const store = read(account);
  store.index = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, index));
  write(account, store);
}

export function completeTutorial(account: string): void {
  write(account, { done: true, index: TUTORIAL_STEPS.length - 1 });
}

export function resetTutorial(account: string): void {
  write(account, { done: false, index: 0 });
}

export function nextTutorialStep(account: string): TutorialStep | null {
  const store = read(account);
  if (store.done) {
    return null;
  }
  const next = store.index + 1;
  if (next >= TUTORIAL_STEPS.length) {
    completeTutorial(account);
    return null;
  }
  store.index = next;
  write(account, store);
  return TUTORIAL_STEPS[next];
}

export function currentTutorialStep(account: string): TutorialStep | null {
  const store = read(account);
  if (store.done) {
    return null;
  }
  return TUTORIAL_STEPS[store.index] || null;
}
