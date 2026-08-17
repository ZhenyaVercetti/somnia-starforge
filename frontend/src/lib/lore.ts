export type LoreEntry = {
  id: string;
  title: string;
  body: string;
};

// In-game canon. GDD only names the setting; this is the first written log.
export const LORE_LOG: LoreEntry[] = [
  {
    id: 'echo',
    title: 'ECHO OF DREAMS',
    body: 'Somnia does not sleep. It dreams in public. Every hull you stamp, every relic you slot, is a memory the chain refuses to forget.'
  },
  {
    id: 'forge',
    title: 'THE STARFORGE',
    body: 'The Forge is not a factory. It is an anvil sunk into the dream. Pay the toll and a ship is written into existence — soulbound, because a dream that can be sold is already dying.'
  },
  {
    id: 'empire',
    title: 'EMPIRE',
    body: 'The last banners of a sun that already went out. Empire crews still salute. Their guns still work. They have not been told the war they remember is over.'
  },
  {
    id: 'voidborn',
    title: 'VOIDBORN',
    body: 'Not invaders. Negative space that learned a name. Where the dream thins, Voidborn hulls gather — quiet, fast, and hungry for the shape of other ships.'
  },
  {
    id: 'mechanoids',
    title: 'MECHANOIDS',
    body: 'They built themselves so the dream could not. No pilots. No last words. Only a loop that says: survive the echo, then forge the next frame.'
  },
  {
    id: 'shadow',
    title: 'SHADOW FLEET',
    body: 'The Void does not invent enemies. It plays back every unfinished formation. Empty slots in your line become strong fillers — the dream hates a missing note.'
  },
  {
    id: 'relics',
    title: 'RELICS',
    body: 'Shards of the first dream. Three at most. More than that and the echo tears. Last Stand is not mercy. It is the Forge refusing to lose a hull on the first blow.'
  },
  {
    id: 'battle',
    title: 'RESOLUTION',
    body: 'When two fleets lock, the Void does not wait. Fire is fire. Steel is steel. You are in it until one line breaks.'
  }
];

export function loreByIndex(index: number): LoreEntry {
  const i = ((index % LORE_LOG.length) + LORE_LOG.length) % LORE_LOG.length;
  return LORE_LOG[i];
}

export function loreById(id: string): LoreEntry | undefined {
  return LORE_LOG.find((entry) => entry.id === id);
}

export function factionLoreId(faction: number): string {
  if (faction === 1) return 'voidborn';
  if (faction === 2) return 'mechanoids';
  return 'empire';
}

export function loreIndexForContext(ctx: { hasLastEnemy?: boolean; level?: number; wins?: number }): number {
  if (ctx.hasLastEnemy) {
    return LORE_LOG.findIndex((entry) => entry.id === 'shadow');
  }
  if ((ctx.level || 0) >= 10) {
    return LORE_LOG.findIndex((entry) => entry.id === 'battle');
  }
  if ((ctx.wins || 0) >= 1) {
    return LORE_LOG.findIndex((entry) => entry.id === 'relics');
  }
  return 0;
}
