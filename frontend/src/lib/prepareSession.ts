const KEY_PREFIX = 'starforge-prepare-';

// Token 0 is a valid ship. Empty fleet slots use -1, never 0.
export const EMPTY_TEAM_SLOT = -1;
export const SLOT_FORMAT = 2 as const;

export type PrepareSession = {
  team: number[];
  relics?: number[];
  slotFormat?: typeof SLOT_FORMAT;
};

const memorySessions = new Map<string, PrepareSession>();

export function emptyTeamSlots(): number[] {
  return [
    EMPTY_TEAM_SLOT,
    EMPTY_TEAM_SLOT,
    EMPTY_TEAM_SLOT,
    EMPTY_TEAM_SLOT,
    EMPTY_TEAM_SLOT,
    EMPTY_TEAM_SLOT,
    EMPTY_TEAM_SLOT,
    EMPTY_TEAM_SLOT
  ];
}

export function emptyRelicSlots(): number[] {
  return [0, 0, 0];
}

export function isFilledSlot(id: number | null | undefined): id is number {
  return typeof id === 'number' && Number.isFinite(id) && id >= 0;
}

export function compactTeamIds(team: number[]): number[] {
  return team.map((id) => Number(id)).filter((id) => isFilledSlot(id));
}

export function filledTeamCount(team: number[]): number {
  return compactTeamIds(team).length;
}

export function alignTeamToSlots(ids: number[]): number[] {
  const slots = emptyTeamSlots();
  let cursor = 0;
  for (const raw of ids) {
    const id = Number(raw);
    if (isFilledSlot(id) && cursor < 8) {
      slots[cursor] = id;
      cursor += 1;
    }
  }
  return slots;
}

export function alignRelicSlots(ids: number[] | undefined): number[] {
  const slots = emptyRelicSlots();
  let cursor = 0;
  for (const raw of ids || []) {
    const id = Number(raw);
    if (id > 0 && cursor < 3 && !slots.includes(id)) {
      slots[cursor] = id;
      cursor += 1;
    }
  }
  return slots;
}

function accountKey(account: string): string {
  return account.toLowerCase();
}

function normalizeSlotId(raw: unknown, format: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return EMPTY_TEAM_SLOT;
  }
  if (format >= SLOT_FORMAT) {
    return value >= 0 ? value : EMPTY_TEAM_SLOT;
  }
  // Legacy sessions treated 0 as empty. Token 0 was never persisted.
  return value > 0 ? value : EMPTY_TEAM_SLOT;
}

function persistTeamSlots(
  ids: number[] | undefined,
  fallback: number[],
  format: number = SLOT_FORMAT
): number[] {
  if (ids === undefined) {
    return persistTeamSlots(fallback, emptyTeamSlots(), format);
  }
  if (ids.length === 8) {
    return ids.map((id) => normalizeSlotId(id, format));
  }
  return alignTeamToSlots(ids);
}

export function savePrepareSession(account: string, session: Partial<PrepareSession> & { team?: number[] }): void {
  const key = accountKey(account);
  const previous = memorySessions.get(key) || { team: emptyTeamSlots(), slotFormat: SLOT_FORMAT };
  const next: PrepareSession = {
    team: persistTeamSlots(session.team, previous.team, SLOT_FORMAT),
    slotFormat: SLOT_FORMAT
  };
  if (session.relics !== undefined) {
    next.relics = alignRelicSlots(session.relics);
  } else if (previous.relics) {
    next.relics = alignRelicSlots(previous.relics);
  }
  memorySessions.set(key, next);
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${key}`, JSON.stringify(next));
  } catch {
    // Ignore quota / private-mode failures. Memory cache still holds the loadout.
  }
}

export function loadPrepareSession(account: string): PrepareSession | null {
  const key = accountKey(account);
  const fromMemory = memorySessions.get(key);
  if (fromMemory && (filledTeamCount(fromMemory.team) > 0 || fromMemory.relics)) {
    return {
      team: persistTeamSlots(fromMemory.team, emptyTeamSlots(), fromMemory.slotFormat || SLOT_FORMAT),
      relics: fromMemory.relics ? alignRelicSlots(fromMemory.relics) : undefined,
      slotFormat: SLOT_FORMAT
    };
  }
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${key}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed) {
      return null;
    }
    const format = parsed.slotFormat === SLOT_FORMAT ? SLOT_FORMAT : 1;
    const team = Array.isArray(parsed.team)
      ? persistTeamSlots(parsed.team, emptyTeamSlots(), format)
      : emptyTeamSlots();
    const relics = Array.isArray(parsed.relics) ? alignRelicSlots(parsed.relics) : undefined;
    const session: PrepareSession = { team, relics, slotFormat: SLOT_FORMAT };
    if (filledTeamCount(team) > 0 || relics) {
      memorySessions.set(key, session);
    }
    return session;
  } catch {
    return null;
  }
}
