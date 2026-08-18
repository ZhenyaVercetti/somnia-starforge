// Phaser-heavy battle atmosphere. Does not touch contract data.

import Phaser from 'phaser';

export const BATTLE_CINEMA_KEYS = {
  starDust: 'battle_star_dust',
  arenaGlow: 'battle_arena_glow',
  explodeBloom: 'battle_explode_bloom',
  critFlare: 'battle_crit_flare',
  lastStand: 'battle_laststand',
  debris: 'battle_debris'
} as const;

export function preloadBattleCinema(scene: Phaser.Scene): void {
  const base = 'assets/fx';
  scene.load.image(BATTLE_CINEMA_KEYS.starDust, `${base}/battle_star_dust.jpg`);
  scene.load.image(BATTLE_CINEMA_KEYS.arenaGlow, `${base}/battle_arena_glow.jpg`);
  scene.load.image(BATTLE_CINEMA_KEYS.explodeBloom, `${base}/battle_explode_bloom.jpg`);
  scene.load.image(BATTLE_CINEMA_KEYS.critFlare, `${base}/battle_crit_flare.jpg`);
  scene.load.image(BATTLE_CINEMA_KEYS.lastStand, `${base}/battle_laststand.jpg`);
  scene.load.image(BATTLE_CINEMA_KEYS.debris, `${base}/battle_debris.jpg`);
}

export type BattleCinema = {
  starDust: Phaser.GameObjects.TileSprite;
  farDust: Phaser.GameObjects.TileSprite;
  arenaGlow: Phaser.GameObjects.Image;
  motes: Phaser.GameObjects.Particles.ParticleEmitter | null;
  shards: Phaser.GameObjects.Particles.ParticleEmitter | null;
  lastRound: number;
};

export function bootBattleCinema(scene: Phaser.Scene): BattleCinema {
  const cam = scene.cameras.main;
  try {
    cam.postFX.clear();
    cam.postFX.addVignette(0.5, 0.5, 0.86, 0.22);
  } catch {
    // Canvas renderer has no postFX.
  }

  const farDust = scene.add.tileSprite(960, 540, 2200, 1300, BATTLE_CINEMA_KEYS.starDust)
    .setScrollFactor(0.03)
    .setDepth(0.4)
    .setAlpha(0.35);

  const starDust = scene.add.tileSprite(960, 540, 2200, 1300, BATTLE_CINEMA_KEYS.starDust)
    .setScrollFactor(0.08)
    .setDepth(3.2)
    .setAlpha(0.16);

  const arenaGlow = scene.add.image(960, 580, BATTLE_CINEMA_KEYS.arenaGlow)
    .setDisplaySize(1500, 780)
    .setAlpha(0.16)
    .setDepth(4.5);

  return { starDust, farDust, arenaGlow, motes: null, shards: null, lastRound: 0 };
}

export function tickBattleCinema(cine: BattleCinema, delta: number, playing: boolean): void {
  const drift = playing ? 0.045 : 0.02;
  cine.farDust.tilePositionX += drift * delta * 0.08;
  cine.farDust.tilePositionY += drift * delta * 0.03;
  cine.starDust.tilePositionX += drift * delta * 0.16;
  cine.starDust.tilePositionY -= drift * delta * 0.05;
}

export function destroyBattleCinema(scene: Phaser.Scene, cine: BattleCinema | null): void {
  if (!cine) {
    return;
  }
  cine.starDust.destroy();
  cine.farDust.destroy();
  cine.arenaGlow.destroy();
  cine.motes?.stop();
  cine.motes?.destroy();
  cine.shards?.stop();
  cine.shards?.destroy();
  try {
    scene.cameras.main.postFX.clear();
  } catch {
    // ignore
  }
}

export function spawnBloomBurst(scene: Phaser.Scene, x: number, y: number, scale = 0.42, tint = 0xffffff): void {
  if (!scene.textures.exists(BATTLE_CINEMA_KEYS.explodeBloom)) {
    return;
  }
  const bloom = scene.add.image(x, y, BATTLE_CINEMA_KEYS.explodeBloom)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(478)
    .setScale(scale * 0.35)
    .setAlpha(0.95)
    .setTint(tint);
  scene.tweens.add({
    targets: bloom,
    scale: scale,
    alpha: 0,
    angle: 18,
    duration: 420,
    ease: 'Cubic.easeOut',
    onComplete: () => bloom.destroy()
  });
}

export function spawnCritFlare(scene: Phaser.Scene, x: number, y: number): void {
  if (!scene.textures.exists(BATTLE_CINEMA_KEYS.critFlare)) {
    return;
  }
  const flare = scene.add.image(x, y, BATTLE_CINEMA_KEYS.critFlare)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(482)
    .setScale(0.18)
    .setAlpha(1);
  scene.tweens.add({
    targets: flare,
    scale: 0.62,
    alpha: 0,
    angle: 24,
    duration: 380,
    ease: 'Cubic.easeOut',
    onComplete: () => flare.destroy()
  });
}

export function spawnLastStandDome(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(BATTLE_CINEMA_KEYS.lastStand)) {
    return null;
  }
  const dome = scene.add.image(x, y + 6, BATTLE_CINEMA_KEYS.lastStand)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(y + 40)
    .setScale(0.22)
    .setAlpha(0.95);
  scene.tweens.add({
    targets: dome,
    scale: 0.38,
    alpha: 0.15,
    duration: 720,
    ease: 'Sine.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: dome,
        alpha: 0,
        duration: 280,
        onComplete: () => dome.destroy()
      });
    }
  });
  return dome;
}

export function flashShipHit(ship: Phaser.GameObjects.Sprite, crit: boolean): void {
  if (!ship?.preFX) {
    ship.setTint(crit ? 0xffe566 : 0xff8866);
    ship.scene.time.delayedCall(70, () => ship.clearTint());
    return;
  }
  try {
    const glow = ship.preFX.addGlow(crit ? 0xffe566 : 0xff5533, crit ? 8 : 4, 0, false, 0.12, 6);
    ship.scene.time.delayedCall(90, () => {
      try {
        if (glow) {
          ship.preFX?.remove(glow);
        }
      } catch {
        ship.clearTint();
      }
    });
  } catch {
    ship.setTint(crit ? 0xffe566 : 0xff8866);
    ship.scene.time.delayedCall(70, () => ship.clearTint());
  }
}

export function showRoundBanner(scene: Phaser.Scene, round: number, total: number): void {
  const label = scene.add.text(960, 168, `ROUND  ${round}  /  ${total}`, {
    fontFamily: 'Orbitron, Rajdhani, Arial, sans-serif',
    fontSize: '34px',
    color: '#f6e27a',
    fontStyle: '700',
    stroke: '#080410',
    strokeThickness: 6
  }).setOrigin(0.5).setDepth(900).setScrollFactor(0).setAlpha(0).setScale(0.82);

  scene.tweens.add({
    targets: label,
    alpha: 1,
    scale: 1,
    duration: 180,
    ease: 'Back.easeOut',
    yoyo: true,
    hold: 420,
    onComplete: () => label.destroy()
  });
}
