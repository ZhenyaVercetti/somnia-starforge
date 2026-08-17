// Phaser combat VFX director.
// Layered additive sprites + pooled trails. Cosmetic shots never touch HP.

import Phaser from 'phaser';

export type VfxKind = 'bolt' | 'beam' | 'slug' | 'needle';

export type VfxShot = {
  unitClass: number;
  faction: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  cosmetic?: boolean;
  crit?: boolean;
  onHit?: () => void;
};

type ShotLook = {
  kind: VfxKind;
  count: number;
  spread: number;
  stagger: number;
  travel: number;
  charge: number;
  hold: number;
  fade: number;
  jitter: number;
  coreH: number;
  glowH: number;
  length: number;
  lunge: number;
};

const FACTION = [
  { core: 0xe8f7ff, glow: 0x4ec4ff, hot: 0xffffff },
  { core: 0xf0d0ff, glow: 0xc45cff, hot: 0xffe6ff },
  { core: 0xffe3b0, glow: 0xff8a2a, hot: 0xfff4d0 }
] as const;

const CLASS_SHOT: ShotLook[] = [
  {
    kind: 'bolt',
    count: 2,
    spread: 0.038,
    stagger: 58,
    travel: 132,
    charge: 0,
    hold: 0,
    fade: 80,
    jitter: 3,
    coreH: 13,
    glowH: 26,
    length: 56,
    lunge: 20
  },
  {
    kind: 'beam',
    count: 1,
    spread: 0,
    stagger: 0,
    travel: 36,
    charge: 50,
    hold: 210,
    fade: 150,
    jitter: 0,
    coreH: 7,
    glowH: 34,
    length: 0,
    lunge: 10
  },
  {
    kind: 'slug',
    count: 1,
    spread: 0,
    stagger: 0,
    travel: 250,
    charge: 230,
    hold: 0,
    fade: 110,
    jitter: 0,
    coreH: 22,
    glowH: 42,
    length: 78,
    lunge: 8
  },
  {
    kind: 'needle',
    count: 6,
    spread: 0.13,
    stagger: 20,
    travel: 154,
    charge: 0,
    hold: 0,
    fade: 70,
    jitter: 16,
    coreH: 6,
    glowH: 12,
    length: 28,
    lunge: 16
  }
];

export function classLunge(unitClass: number): number {
  return (CLASS_SHOT[unitClass] || CLASS_SHOT[0]).lunge;
}

export const FX_KEYS = [
  'fx_bolt',
  'fx_needle',
  'fx_slug',
  'fx_beam_core',
  'fx_beam_soft',
  'fx_muzzle',
  'fx_impact',
  'fx_ring',
  'fx_trail',
  'fx_spark',
  'fx_charge',
  'fx_cap'
] as const;

export function preloadCombatFx(scene: Phaser.Scene): void {
  const files: Record<(typeof FX_KEYS)[number], string> = {
    fx_bolt: 'assets/fx/bolt.png',
    fx_needle: 'assets/fx/needle.png',
    fx_slug: 'assets/fx/slug.png',
    fx_beam_core: 'assets/fx/beam_core.png',
    fx_beam_soft: 'assets/fx/beam_soft.png',
    fx_muzzle: 'assets/fx/muzzle.png',
    fx_impact: 'assets/fx/impact.png',
    fx_ring: 'assets/fx/ring.png',
    fx_trail: 'assets/fx/trail.png',
    fx_spark: 'assets/fx/spark.png',
    fx_charge: 'assets/fx/charge.png',
    fx_cap: 'assets/fx/cap.png'
  };
  FX_KEYS.forEach((key) => {
    if (!scene.textures.exists(key)) {
      scene.load.image(key, files[key]);
    }
  });
}

type TrailSlot = {
  emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  busy: boolean;
};

export class CombatVfx {
  private scene: Phaser.Scene;
  private trails: TrailSlot[] = [];
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private timers: Phaser.Time.TimerEvent[] = [];
  private live = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  boot(): void {
    this.live = true;
    for (let i = 0; i < 10; i++) {
      const emitter = this.scene.add.particles(0, 0, 'fx_trail', {
        lifespan: { min: 120, max: 220 },
        scale: { start: 0.55, end: 0.02 },
        alpha: { start: 0.72, end: 0 },
        blendMode: 'ADD',
        frequency: 16,
        quantity: 1,
        emitting: false
      });
      emitter.setDepth(436);
      this.trails.push({ emitter, busy: false });
    }

    this.sparks = this.scene.add.particles(0, 0, 'fx_spark', {
      lifespan: { min: 140, max: 320 },
      speed: { min: 40, max: 180 },
      scale: { start: 0.9, end: 0.1 },
      alpha: { start: 0.95, end: 0 },
      rotate: { min: 0, max: 180 },
      blendMode: 'ADD',
      emitting: false,
      frequency: -1,
      quantity: 1
    });
    this.sparks.setDepth(466);

    this.motes = this.scene.add.particles(0, 0, 'fx_trail', {
      lifespan: { min: 180, max: 420 },
      speed: { min: 8, max: 46 },
      scale: { start: 0.4, end: 0.02 },
      alpha: { start: 0.55, end: 0 },
      blendMode: 'ADD',
      emitting: false,
      frequency: -1,
      quantity: 1
    });
    this.motes.setDepth(435);
  }

  destroy(): void {
    this.live = false;
    this.timers.forEach((timer) => timer.remove(false));
    this.timers = [];
    this.trails.forEach((slot) => {
      slot.emitter.stop();
      slot.emitter.destroy();
    });
    this.trails = [];
    this.sparks?.destroy();
    this.motes?.destroy();
    this.sparks = null;
    this.motes = null;
  }

  shot(req: VfxShot): void {
    if (!this.live) {
      req.onHit?.();
      return;
    }
    const look = { ...(CLASS_SHOT[req.unitClass] || CLASS_SHOT[0]) };
    const paint = FACTION[req.faction] || FACTION[0];
    const cosmetic = !!req.cosmetic;
    const crit = !!req.crit && !cosmetic;
    if (cosmetic) {
      look.count = Math.max(1, Math.ceil(look.count * 0.45));
      look.charge = 0;
      look.hold = Math.floor(look.hold * 0.45);
      look.coreH *= 0.7;
      look.glowH *= 0.65;
    }

    const finishOnce = (() => {
      let done = false;
      return () => {
        if (done) return;
        done = true;
        req.onHit?.();
      };
    })();

    const launch = () => {
      if (!this.live) {
        finishOnce();
        return;
      }
      this.muzzle(req.fromX, req.fromY, req.toX, req.toY, paint.glow, cosmetic ? 0.45 : crit ? 1.15 : 1);
      if (look.kind === 'beam') {
        this.beam(req, look, paint, cosmetic, crit, finishOnce);
        return;
      }
      for (let i = 0; i < look.count; i++) {
        this.after(i * look.stagger, () => {
          if (!this.live) {
            finishOnce();
            return;
          }
          const aim = this.aimed(req, look, i, cosmetic);
          if (look.kind === 'slug') {
            this.slug(aim.fromX, aim.fromY, aim.toX, aim.toY, look, paint, cosmetic, crit, i === 0 ? finishOnce : undefined);
          } else {
            this.bolt(aim.fromX, aim.fromY, aim.toX, aim.toY, look, paint, cosmetic, crit, i === 0 ? finishOnce : undefined);
          }
        });
      }
    };

    if (look.charge > 0 && !cosmetic) {
      this.charge(req.fromX, req.fromY, paint.glow, look.charge);
      this.after(look.charge, launch);
    } else {
      launch();
    }
  }

  markTarget(x: number, y: number, faction: number): void {
    if (!this.live) return;
    const paint = FACTION[faction] || FACTION[0];
    const ring = this.scene.add.image(x, y, 'fx_ring')
      .setScale(0.22)
      .setTint(paint.glow)
      .setAlpha(0.55)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(428);
    this.scene.tweens.add({
      targets: ring,
      scale: 0.48,
      alpha: 0,
      duration: 280,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy()
    });
  }

  private aimed(req: VfxShot, look: ShotLook, index: number, cosmetic: boolean) {
    const count = look.count;
    const spread = (index - (count - 1) / 2) * look.spread;
    const jx = (Math.random() - 0.5) * look.jitter;
    const jy = (Math.random() - 0.5) * look.jitter;
    const fromX = req.fromX + jx;
    const fromY = req.fromY + jy;
    let toX = req.toX;
    let toY = req.toY;
    if (cosmetic) {
      const base = Phaser.Math.Angle.Between(fromX, fromY, req.toX, req.toY);
      const perp = base + Math.PI / 2;
      const miss = (Math.random() < 0.5 ? -1 : 1) * (26 + Math.random() * 34);
      toX = req.toX + Math.cos(perp) * miss;
      toY = req.toY + Math.sin(perp) * miss;
    }
    const ang = Phaser.Math.Angle.Between(fromX, fromY, toX, toY) + spread;
    const dist = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    return {
      fromX,
      fromY,
      toX: fromX + Math.cos(ang) * dist,
      toY: fromY + Math.sin(ang) * dist
    };
  }

  private bolt(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    look: ShotLook,
    paint: (typeof FACTION)[number],
    cosmetic: boolean,
    crit: boolean,
    onHit?: () => void
  ) {
    const key = look.kind === 'needle' ? 'fx_needle' : 'fx_bolt';
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    const core = this.scene.add.image(fromX, fromY, key)
      .setOrigin(0.5)
      .setRotation(angle)
      .setDisplaySize(look.length, look.coreH)
      .setTint(crit ? 0xffe9a0 : paint.core)
      .setAlpha(cosmetic ? 0.38 : 0.96)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(442);
    const glow = this.scene.add.image(fromX, fromY, key)
      .setOrigin(0.5)
      .setRotation(angle)
      .setDisplaySize(look.length * 1.25, look.glowH)
      .setTint(crit ? 0xfff3c0 : paint.glow)
      .setAlpha(cosmetic ? 0.18 : 0.42)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(441);
    this.glowSafe(core, paint.glow, cosmetic ? 0 : crit ? 6 : 3);
    const trail = cosmetic ? null : this.acquireTrail(paint.glow, look.kind === 'needle' ? 22 : 16);
    if (trail) {
      trail.startFollow(core);
      trail.start();
    }
    this.ghosts(core, key, look.length, look.coreH, paint.glow, look.travel);
    this.scene.tweens.add({
      targets: [core, glow],
      x: toX,
      y: toY,
      duration: look.travel,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.releaseTrail(trail);
        onHit?.();
        this.impact(toX, toY, paint, cosmetic, false, crit);
        this.scene.tweens.add({
          targets: [core, glow],
          alpha: 0,
          scale: 0.35,
          duration: look.fade,
          onComplete: () => {
            core.destroy();
            glow.destroy();
          }
        });
      }
    });
  }

  private slug(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    look: ShotLook,
    paint: (typeof FACTION)[number],
    cosmetic: boolean,
    crit: boolean,
    onHit?: () => void
  ) {
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    const body = this.scene.add.image(fromX, fromY, 'fx_slug')
      .setOrigin(0.5)
      .setRotation(angle)
      .setDisplaySize(look.length, look.coreH)
      .setTint(crit ? 0xffe566 : paint.core)
      .setAlpha(cosmetic ? 0.4 : 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(444);
    const halo = this.scene.add.image(fromX, fromY, 'fx_slug')
      .setOrigin(0.5)
      .setRotation(angle)
      .setDisplaySize(look.length * 1.35, look.glowH)
      .setTint(paint.glow)
      .setAlpha(cosmetic ? 0.16 : 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(443);
    this.glowSafe(body, paint.glow, cosmetic ? 0 : 8);
    const trail = cosmetic ? null : this.acquireTrail(paint.glow, 12);
    if (trail) {
      trail.startFollow(body);
      trail.start();
    }
    this.ghosts(body, 'fx_slug', look.length, look.coreH, paint.glow, look.travel);
    this.scene.tweens.add({
      targets: [body, halo],
      x: toX,
      y: toY,
      duration: look.travel,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.releaseTrail(trail);
        onHit?.();
        this.impact(toX, toY, paint, cosmetic, true, crit);
        this.scene.tweens.add({
          targets: [body, halo],
          alpha: 0,
          scale: 0.4,
          duration: look.fade,
          onComplete: () => {
            body.destroy();
            halo.destroy();
          }
        });
      }
    });
  }

  private beam(
    req: VfxShot,
    look: ShotLook,
    paint: (typeof FACTION)[number],
    cosmetic: boolean,
    crit: boolean,
    onHit: () => void
  ) {
    const angle = Phaser.Math.Angle.Between(req.fromX, req.fromY, req.toX, req.toY);
    const dist = Math.max(24, Phaser.Math.Distance.Between(req.fromX, req.fromY, req.toX, req.toY));
    const soft = this.scene.add.image(req.fromX, req.fromY, 'fx_beam_soft')
      .setOrigin(0, 0.5)
      .setRotation(angle)
      .setDisplaySize(8, look.glowH)
      .setTint(paint.glow)
      .setAlpha(cosmetic ? 0.16 : 0.55)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(439);
    const core = this.scene.add.image(req.fromX, req.fromY, 'fx_beam_core')
      .setOrigin(0, 0.5)
      .setRotation(angle)
      .setDisplaySize(8, look.coreH)
      .setTint(crit ? 0xfff4c8 : paint.hot)
      .setAlpha(cosmetic ? 0.35 : 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(441);
    const tip = this.scene.add.image(req.toX, req.toY, 'fx_cap')
      .setTint(paint.core)
      .setAlpha(cosmetic ? 0.3 : 0.9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(cosmetic ? 0.35 : 0.55)
      .setDepth(442);
    const root = this.scene.add.image(req.fromX, req.fromY, 'fx_cap')
      .setTint(paint.hot)
      .setAlpha(cosmetic ? 0.25 : 0.85)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.4)
      .setDepth(442);
    this.glowSafe(core, paint.glow, cosmetic ? 0 : 4);
    this.scene.tweens.add({
      targets: [soft, core],
      displayWidth: dist,
      duration: look.travel,
      ease: 'Cubic.easeOut',
      onComplete: () => onHit()
    });
    this.scene.tweens.add({
      targets: core,
      alpha: { from: cosmetic ? 0.35 : 1, to: cosmetic ? 0.18 : 0.7 },
      duration: 42,
      yoyo: true,
      repeat: 5
    });
    this.after(look.travel + look.hold, () => {
      if (!this.live) return;
      this.impact(req.toX, req.toY, paint, cosmetic, false, crit);
      this.scene.tweens.add({
        targets: [soft, core, tip, root],
        alpha: 0,
        duration: look.fade,
        onComplete: () => {
          soft.destroy();
          core.destroy();
          tip.destroy();
          root.destroy();
        }
      });
    });
  }

  private charge(x: number, y: number, tint: number, duration: number): void {
    const orb = this.scene.add.image(x, y, 'fx_charge')
      .setTint(tint)
      .setScale(0.18)
      .setAlpha(0.2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(470);
    this.scene.tweens.add({
      targets: orb,
      scale: 0.72,
      alpha: 0.95,
      duration,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.scene.tweens.add({
          targets: orb,
          alpha: 0,
          scale: 1.05,
          duration: 70,
          onComplete: () => orb.destroy()
        });
      }
    });
    for (let i = 0; i < 7; i++) {
      const ang = (Math.PI * 2 * i) / 7 + Math.random() * 0.3;
      const r = 28 + Math.random() * 18;
      const mote = this.scene.add.image(x + Math.cos(ang) * r, y + Math.sin(ang) * r, 'fx_trail')
        .setTint(tint)
        .setScale(0.35)
        .setAlpha(0.7)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(469);
      this.scene.tweens.add({
        targets: mote,
        x,
        y,
        alpha: 0.15,
        scale: 0.12,
        duration: duration * 0.9,
        ease: 'Cubic.easeIn',
        onComplete: () => mote.destroy()
      });
    }
  }

  private muzzle(fromX: number, fromY: number, toX: number, toY: number, tint: number, scale: number): void {
    const ang = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    const flash = this.scene.add.image(fromX, fromY, 'fx_muzzle')
      .setRotation(ang)
      .setTint(tint)
      .setScale(0.28 * scale)
      .setAlpha(0.95)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(472);
    this.scene.tweens.add({
      targets: flash,
      scale: 0.72 * scale,
      alpha: 0,
      duration: 130,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy()
    });
    this.sparks?.setParticleTint(tint);
    this.sparks?.explode(Math.round(5 * scale), fromX, fromY);
  }

  private impact(
    x: number,
    y: number,
    paint: (typeof FACTION)[number],
    cosmetic: boolean,
    heavy: boolean,
    crit: boolean
  ): void {
    if (cosmetic) {
      this.motes?.setParticleTint(paint.glow);
      this.motes?.explode(3, x, y);
      return;
    }
    const burst = this.scene.add.image(x, y, 'fx_impact')
      .setTint(crit ? 0xffe9a0 : paint.core)
      .setScale(heavy ? 0.42 : 0.28)
      .setAlpha(0.95)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(464);
    this.scene.tweens.add({
      targets: burst,
      scale: heavy ? 1.05 : 0.7,
      alpha: 0,
      duration: heavy ? 260 : 180,
      ease: 'Cubic.easeOut',
      onComplete: () => burst.destroy()
    });
    if (heavy || crit) {
      const ring = this.scene.add.image(x, y, 'fx_ring')
        .setTint(paint.glow)
        .setScale(0.18)
        .setAlpha(0.8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(463);
      this.scene.tweens.add({
        targets: ring,
        scale: heavy ? 0.95 : 0.62,
        alpha: 0,
        duration: 280,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy()
      });
    }
    this.sparks?.setParticleTint(paint.hot);
    this.sparks?.explode(heavy ? 14 : crit ? 10 : 6, x, y);
    this.motes?.setParticleTint(paint.glow);
    this.motes?.explode(heavy ? 10 : 5, x, y);
  }

  private ghosts(
    source: Phaser.GameObjects.Image,
    key: string,
    w: number,
    h: number,
    tint: number,
    travel: number
  ): void {
    const step = 28;
    const n = Math.max(1, Math.floor(travel / step) - 1);
    for (let i = 1; i <= n; i++) {
      this.after(i * step, () => {
        if (!this.live || !source.active) return;
        const ghost = this.scene.add.image(source.x, source.y, key)
          .setOrigin(0.5)
          .setRotation(source.rotation)
          .setDisplaySize(w, h)
          .setTint(tint)
          .setAlpha(0.22)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(437);
        this.scene.tweens.add({
          targets: ghost,
          alpha: 0,
          scale: 0.7,
          duration: 140,
          onComplete: () => ghost.destroy()
        });
      });
    }
  }

  private acquireTrail(tint: number, frequency: number): Phaser.GameObjects.Particles.ParticleEmitter | null {
    const slot = this.trails.find((item) => !item.busy);
    if (!slot) return null;
    slot.busy = true;
    slot.emitter.setParticleTint(tint);
    slot.emitter.frequency = frequency;
    return slot.emitter;
  }

  private releaseTrail(emitter: Phaser.GameObjects.Particles.ParticleEmitter | null): void {
    if (!emitter) return;
    emitter.stop();
    emitter.stopFollow();
    const slot = this.trails.find((item) => item.emitter === emitter);
    if (slot) slot.busy = false;
  }

  private glowSafe(sprite: Phaser.GameObjects.Image, color: number, strength: number): void {
    if (strength <= 0 || !sprite.preFX) return;
    try {
      sprite.preFX.addGlow(color, strength, 0, false, 0.1, 8);
    } catch {
      // Canvas renderer has no preFX.
    }
  }

  private after(ms: number, fn: () => void): void {
    const timer = this.scene.time.delayedCall(Math.max(0, ms), fn);
    this.timers.push(timer);
  }
}
