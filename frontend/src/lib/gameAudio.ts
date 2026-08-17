const MUTE_KEY = 'starforge-audio-mute';

const BANK = {
  click: ['sfx_click'],
  buy: ['sfx_confirm'],
  error: ['sfx_error'],
  startMatch: ['sfx_select'],
  hit: ['sfx_laser_0', 'sfx_laser_1', 'sfx_laser_2'],
  crit: ['sfx_laser_big'],
  dodge: [] as string[],
  lastStand: ['sfx_shield'],
  explode: ['sfx_explode_0', 'sfx_explode_1'],
  victory: ['sfx_victory'],
  defeat: ['sfx_explode_1'],
  unlockJingle: ['sfx_confirm']
} as const;

export const SFX_MANIFEST: Array<{ key: string; file: string }> = [
  { key: 'sfx_click', file: 'assets/sfx/click.ogg' },
  { key: 'sfx_confirm', file: 'assets/sfx/confirm.ogg' },
  { key: 'sfx_error', file: 'assets/sfx/error.ogg' },
  { key: 'sfx_select', file: 'assets/sfx/select.ogg' },
  { key: 'sfx_laser_0', file: 'assets/sfx/laser_0.ogg' },
  { key: 'sfx_laser_1', file: 'assets/sfx/laser_1.ogg' },
  { key: 'sfx_laser_2', file: 'assets/sfx/laser_2.ogg' },
  { key: 'sfx_laser_big', file: 'assets/sfx/laser_big.ogg' },
  { key: 'sfx_explode_0', file: 'assets/sfx/explode_0.ogg' },
  { key: 'sfx_explode_1', file: 'assets/sfx/explode_1.ogg' },
  { key: 'sfx_shield', file: 'assets/sfx/shield.ogg' },
  { key: 'sfx_victory', file: 'assets/sfx/victory.ogg' }
];

function loadMute(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMute(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // ignore
  }
}

function pick(list: readonly string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

class GameAudio {
  private muted = loadMute();
  private lastAt = 0;

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    saveMute(muted);
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.click();
    }
    return this.muted;
  }

  unlock(): void {
    const sound = this.manager();
    if (sound && typeof sound.unlock === 'function') {
      sound.unlock();
    }
  }

  startAmbient(): void {}
  stopAmbient(): void {}

  click(): void {
    this.play(BANK.click, 0.22, 30);
  }

  hover(): void {}

  buy(): void {
    this.play(BANK.buy, 0.3, 80);
  }

  error(): void {
    this.play(BANK.error, 0.28, 80);
  }

  startMatch(): void {
    this.play(BANK.startMatch, 0.28, 120);
  }

  hit(crit = false): void {
    this.play(crit ? BANK.crit : BANK.hit, crit ? 0.36 : 0.26, 90);
  }

  dodge(): void {}

  lastStand(): void {
    this.play(BANK.lastStand, 0.34, 120);
  }

  explode(): void {
    this.play(BANK.explode, 0.4, 140);
  }

  victory(): void {
    this.play(BANK.victory, 0.32, 150);
  }

  defeat(): void {
    this.play(BANK.defeat, 0.32, 150);
  }

  unlockJingle(): void {
    this.play(BANK.unlockJingle, 0.28, 150);
  }

  private play(keys: readonly string[], volume: number, gapMs: number): void {
    if (this.muted || keys.length === 0) {
      return;
    }
    const now = Date.now();
    if (now - this.lastAt < gapMs) {
      return;
    }
    this.lastAt = now;
    const sound = this.manager();
    if (!sound) {
      return;
    }
    try {
      sound.play(pick(keys), { volume });
    } catch {
      // cache miss before BootScene finishes preload
    }
  }

  private manager(): { play: (key: string, cfg: { volume: number }) => unknown; unlock?: () => void } | null {
    const game = (window as { game?: { sound?: { play: (key: string, cfg: { volume: number }) => unknown; unlock?: () => void } } }).game;
    return game?.sound || null;
  }
}

export const gameAudio = new GameAudio();
