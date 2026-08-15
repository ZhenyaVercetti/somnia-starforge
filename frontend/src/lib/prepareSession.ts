const KEY_PREFIX = 'starforge-prepare-';

export type PrepareSession = {
  team: number[];
  relics?: number[];
};

const memorySessions = new Map<string, PrepareSession>();

export function emptyTeamSlots(): number[] {
  return [0, 0, 0, 0, 0, 0, 0, 0];
}

export function emptyRelicSlots(): number[] {
  return [0, 0, 0];
}

export function compactTeamIds(team: number[]): number[] {
  return team.map((id) => Number(id)).filter((id) => id > 0);
}

export function filledTeamCount(team: number[]): number {
  return compactTeamIds(team).length;
}

export function alignTeamToSlots(ids: number[]): number[] {
  const slots = emptyTeamSlots();
  let cursor = 0;
  for (const raw of ids) {
    const id = Number(raw);
    if (id > 0 && cursor < 8) {
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

export function savePrepareSession(account: string, session: Partial<PrepareSession> & { team?: number[] }): void {
  const key = accountKey(account);
  const previous = memorySessions.get(key) || { team: [] };
  const next: PrepareSession = {
    team: session.team !== undefined ? compactTeamIds(session.team) : previous.team
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
  if (fromMemory && (fromMemory.team.length > 0 || fromMemory.relics)) {
    return {
      team: [...fromMemory.team],
      relics: fromMemory.relics ? alignRelicSlots(fromMemory.relics) : undefined
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
    const team = Array.isArray(parsed.team) ? compactTeamIds(parsed.team) : [];
    const relics = Array.isArray(parsed.relics) ? alignRelicSlots(parsed.relics) : undefined;
    const session: PrepareSession = { team, relics };
    if (team.length > 0 || relics) {
      memorySessions.set(key, session);
    }
    return session;
  } catch {
    return null;
  }
}
