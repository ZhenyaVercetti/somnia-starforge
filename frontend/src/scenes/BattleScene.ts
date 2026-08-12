// @ts-nocheck
// frontend/src/scenes/BattleScene.ts
// Cinematic auto-battler playback. Contract data-flow is unchanged:
// events / playerWon / playerMaxHp / aiMaxHp / playerUnitsData / aiUnitsData.

import Phaser from 'phaser';

interface BattleEvent {
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

interface Combatant {
  ship: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Sprite;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  engine: Phaser.GameObjects.Particles.ParticleEmitter;
  homeX: number;
  homeY: number;
  baseScale: number;
  faction: number;
  unitClass: number;
  alive: boolean;
  lastStandLit: boolean;
  idleTween: Phaser.Tweens.Tween | null;
}

const FACTION_ENGINE: Record<number, { tint: number; tintAlt: number; glow: number }> = {
  0: { tint: 0x8fd6ff, tintAlt: 0xffffff, glow: 0x3aa7ff },
  1: { tint: 0xd48cff, tintAlt: 0x7a20ff, glow: 0xb44cff },
  2: { tint: 0xffb347, tintAlt: 0xfff1a8, glow: 0xff7a18 }
};

export default class BattleScene extends Phaser.Scene {
  private battleEvents: BattleEvent[] = [];
  private playerWon = false;
  private playerMaxHp: number[] = [];
  private aiMaxHp: number[] = [];
  private playerUnitsData: any[] = [];
  private aiUnitsData: any[] = [];

  private playerUnits: Combatant[] = [];
  private aiUnits: Combatant[] = [];

  private currentEventIndex = 0;
  private battleLogTexts: Phaser.GameObjects.Text[] = [];
  private fullBattleLog: string[] = [];
  private logContainer: Phaser.GameObjects.Container | null = null;
  private logTitle: Phaser.GameObjects.Text | null = null;
  private battleSpeedMultiplier = 1;
  private isPlaying = false;

  private backgroundLayers: Phaser.GameObjects.Image[] = [];
  private cameraDriftTween: Phaser.Tweens.Tween | null = null;

  private hitEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private plasmaEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private debrisEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private muzzleEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private critEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private victoryEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  private overlay: Phaser.GameObjects.Rectangle | null = null;
  private speedBtnBase: Phaser.GameObjects.Image | null = null;
  private speedBtnText: Phaser.GameObjects.Text | null = null;
  private pendingTimers: Phaser.Time.TimerEvent[] = [];

  constructor() {
    super({ key: 'BattleScene' });
  }

  init(data: any) {
    this.battleEvents = data.events || [];
    this.playerWon = data.playerWon || false;
    this.playerMaxHp = data.playerMaxHp || [];
    this.aiMaxHp = data.aiMaxHp || [];
    this.playerUnitsData = data.playerUnitsData || [];
    this.aiUnitsData = data.aiUnitsData || [];
    this.currentEventIndex = 0;
    this.isPlaying = false;
    this.battleSpeedMultiplier = 1;
  }

  preload() {
    this.load.image('stars', 'assets/background/stars.png');
    this.load.image('nebula_mid', 'assets/background/nebula_mid.png');
    this.load.image('nebula_close', 'assets/background/nebula_close.png');
    this.load.image('arena_platform', 'assets/background/arena_platform.png');
    this.load.image('outer_frame', 'assets/outer_frame.png');
    this.load.image('button_base', 'assets/button_base.png');

    this.load.image('laser_blue', 'assets/effects/laser_blue.png');
    this.load.image('laser_red', 'assets/effects/laser_red.png');
    this.load.image('muzzle_flash', 'assets/effects/muzzle_flash.png');
    this.load.image('energy_ring', 'assets/effects/energy_ring.png');
    this.load.image('engine_blob', 'assets/effects/engine_blob.png');
    this.load.image('shield_glow', 'assets/effects/shield_glow.png');
    this.load.spritesheet('spark_sheet', 'assets/effects/spark_sheet.png', {
      frameWidth: 64,
      frameHeight: 64
    });

    for (let i = 1; i <= 6; i++) {
      this.load.image(
        `explosion_${i.toString().padStart(2, '0')}`,
        `assets/effects/explosion_${i.toString().padStart(2, '0')}.png`
      );
    }

    this.load.image('emperial_cruiser', 'assets/units/portraits/emperial_cruiser.png');
    this.load.image('emperial_dreadnought', 'assets/units/portraits/emperial_dreadnought.png');
    this.load.image('emperial_droneswarm', 'assets/units/portraits/emperial_droneswarm.png');
    this.load.image('emperial_fighter', 'assets/units/portraits/emperial_fighter.png');

    this.load.image('mechanoid_cruiser', 'assets/units/portraits/mechanoid_cruiser.png');
    this.load.image('mechanoid_dreadnought', 'assets/units/portraits/mechanoid_dreadnought.png');
    this.load.image('mechanoid_droneswarm', 'assets/units/portraits/mechanoid_droneswarm.png');
    this.load.image('mechanoid_fighter', 'assets/units/portraits/mechanoid_fighter.png');

    this.load.image('voidborn_cruiser', 'assets/units/portraits/voidborn_cruiser.png');
    this.load.image('voidborn_dreadnought', 'assets/units/portraits/voidborn_dreadnought.png');
    this.load.image('voidborn_droneswarm', 'assets/units/portraits/voidborn_droneswarm.png');
    this.load.image('voidborn_fighter', 'assets/units/portraits/voidborn_fighter.png');

    this.load.image('emperial_fighter_destroyed', 'assets/units/destroyed/emperial_fighter_destroyed.png');
    this.load.image('emperial_cruiser_destroyed', 'assets/units/destroyed/emperial_cruiser_destroyed.png');
    this.load.image('emperial_dreadnought_destroyed', 'assets/units/destroyed/emperial_dreadnought_destroyed.png');
    this.load.image('emperial_droneswarm_destroyed', 'assets/units/destroyed/emperial_droneswarm_destroyed.png');

    this.load.image('voidborn_fighter_destroyed', 'assets/units/destroyed/voidborn_fighter_destroyed.png');
    this.load.image('voidborn_cruiser_destroyed', 'assets/units/destroyed/voidborn_cruiser_destroyed.png');
    this.load.image('voidborn_dreadnought_destroyed', 'assets/units/destroyed/voidborn_dreadnought_destroyed.png');
    this.load.image('voidborn_droneswarm_destroyed', 'assets/units/destroyed/voidborn_droneswarm_destroyed.png');

    this.load.image('mechanoid_fighter_destroyed', 'assets/units/destroyed/mechanoid_fighter_destroyed.png');
    this.load.image('mechanoid_cruiser_destroyed', 'assets/units/destroyed/mechanoid_cruiser_destroyed.png');
    this.load.image('mechanoid_dreadnought_destroyed', 'assets/units/destroyed/mechanoid_dreadnought_destroyed.png');
    this.load.image('mechanoid_droneswarm_destroyed', 'assets/units/destroyed/mechanoid_droneswarm_destroyed.png');
  }

  create() {
    this.shutdownCleanup();
    this.ensureFxTextures();
    this.createFxAnimations();
    this.createParallaxBackground();
    this.createArenaPlatform();
    this.createSharedEmitters();
    this.createCinematicOverlay();
    this.createSpeedButton();
    this.startCameraDrift();

    this.setupTeams();
    this.setupBattleLog();

    this.add.image(960, 540, 'outer_frame')
      .setDisplaySize(1920, 1080)
      .setDepth(900)
      .setScrollFactor(0);

    if (this.battleEvents.length === 0) {
      this.showEmptyState();
      return;
    }

    this.currentEventIndex = 0;
    this.isPlaying = true;
    this.delay(700, () => this.processNextEvent());
  }

  update(_time: number, _delta: number) {
    this.refreshCombatantDepths(this.playerUnits);
    this.refreshCombatantDepths(this.aiUnits);
  }

  // ---------------------------------------------------------------------------
  // FX textures — generated once, reused by every emitter
  // ---------------------------------------------------------------------------

  private ensureFxTextures() {
    if (!this.textures.exists('fx_soft')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 0.08);
      g.fillCircle(32, 32, 32);
      g.fillStyle(0xffffff, 0.22);
      g.fillCircle(32, 32, 22);
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(32, 32, 10);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(32, 32, 4);
      g.generateTexture('fx_soft', 64, 64);
      g.destroy();
    }

    if (!this.textures.exists('fx_spark')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillRect(7, 0, 2, 16);
      g.fillRect(0, 7, 16, 2);
      g.fillCircle(8, 8, 2);
      g.generateTexture('fx_spark', 16, 16);
      g.destroy();
    }

    if (!this.textures.exists('fx_ring')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.lineStyle(6, 0xffffff, 0.95);
      g.strokeCircle(64, 64, 48);
      g.lineStyle(14, 0xffffff, 0.18);
      g.strokeCircle(64, 64, 48);
      g.generateTexture('fx_ring', 128, 128);
      g.destroy();
    }
  }

  private createFxAnimations() {
    if (!this.anims.exists('spark_flash')) {
      this.anims.create({
        key: 'spark_flash',
        frames: this.anims.generateFrameNumbers('spark_sheet', { start: 0, end: 3 }),
        frameRate: 18,
        hideOnComplete: true
      });
    }
  }

  private createSharedEmitters() {
    this.hitEmitter = this.add.particles(0, 0, 'spark_sheet', {
      frame: [0, 1, 2, 3],
      lifespan: { min: 180, max: 360 },
      speed: { min: 70, max: 240 },
      scale: { start: 0.42, end: 0.08 },
      alpha: { start: 0.95, end: 0 },
      rotate: { min: 0, max: 360 },
      blendMode: 'ADD',
      emitting: false,
      frequency: -1,
      quantity: 1
    });
    this.hitEmitter.setDepth(460);

    this.plasmaEmitter = this.add.particles(0, 0, 'engine_blob', {
      lifespan: { min: 280, max: 620 },
      speed: { min: 20, max: 110 },
      scale: { start: 0.42, end: 0.04 },
      alpha: { start: 0.7, end: 0 },
      rotate: { min: -30, max: 30 },
      blendMode: 'ADD',
      emitting: false,
      frequency: -1,
      quantity: 1
    });
    this.plasmaEmitter.setDepth(455);

    this.debrisEmitter = this.add.particles(0, 0, 'spark_sheet', {
      frame: [0, 1, 2, 3],
      lifespan: { min: 500, max: 1100 },
      speed: { min: 40, max: 220 },
      gravityY: 90,
      scale: { start: 0.28, end: 0.04 },
      alpha: { start: 0.9, end: 0 },
      rotate: { min: 0, max: 360 },
      blendMode: 'ADD',
      emitting: false,
      frequency: -1,
      quantity: 1
    });
    this.debrisEmitter.setDepth(448);

    this.muzzleEmitter = this.add.particles(0, 0, 'spark_sheet', {
      frame: [0, 1, 2, 3],
      lifespan: { min: 80, max: 180 },
      speed: { min: 20, max: 90 },
      scale: { start: 0.28, end: 0.04 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
      emitting: false,
      frequency: -1,
      quantity: 1
    });
    this.muzzleEmitter.setDepth(470);

    this.critEmitter = this.add.particles(0, 0, 'spark_sheet', {
      frame: [0, 1, 2, 3],
      lifespan: { min: 260, max: 700 },
      speed: { min: 40, max: 180 },
      scale: { start: 0.5, end: 0.05 },
      alpha: { start: 0.95, end: 0 },
      blendMode: 'ADD',
      emitting: false,
      frequency: -1,
      quantity: 1,
      tint: 0xffe566
    });
    this.critEmitter.setDepth(465);

    this.victoryEmitter = this.add.particles(960, 200, 'engine_blob', {
      lifespan: { min: 900, max: 1800 },
      speed: { min: 30, max: 140 },
      angle: { min: 240, max: 300 },
      scale: { start: 0.38, end: 0 },
      alpha: { start: 0.55, end: 0 },
      blendMode: 'ADD',
      emitting: false,
      frequency: 80,
      quantity: 2,
      gravityY: -20
    });
    this.victoryEmitter.setDepth(520);
  }

  private createEngineEmitter(x: number, y: number, faction: number, isPlayer: boolean) {
    const palette = FACTION_ENGINE[faction] || FACTION_ENGINE[0];
    const emitter = this.add.particles(x, y, 'engine_blob', {
      lifespan: { min: 280, max: 540 },
      speedX: isPlayer ? { min: -80, max: -22 } : { min: 22, max: 80 },
      speedY: { min: -14, max: 14 },
      scale: { start: 0.48, end: 0.04 },
      alpha: { start: 0.7, end: 0 },
      rotate: isPlayer ? 90 : -90,
      blendMode: 'ADD',
      frequency: 34,
      quantity: 1,
      tint: [palette.tint, palette.tintAlt]
    });
    emitter.setDepth(y - 2);
    return emitter;
  }

  // ---------------------------------------------------------------------------
  // Atmosphere
  // ---------------------------------------------------------------------------

  private createParallaxBackground() {
    const w = this.scale.width;
    const h = this.scale.height;

    const stars = this.add.image(w / 2, h / 2, 'stars')
      .setDisplaySize(w * 1.08, h * 1.08)
      .setDepth(0)
      .setScrollFactor(0.04);
    this.backgroundLayers.push(stars);

    const nebulaMid = this.add.image(w / 2, h / 2, 'nebula_mid')
      .setDisplaySize(w * 1.62, h * 1.62)
      .setAlpha(0.54)
      .setScrollFactor(0.18)
      .setDepth(1);
    this.backgroundLayers.push(nebulaMid);

    const nebulaClose = this.add.image(w / 2 + 40, h / 2, 'nebula_close')
      .setDisplaySize(w * 1.12, h * 1.12)
      .setAlpha(0.38)
      .setScrollFactor(0.42)
      .setDepth(2);
    this.backgroundLayers.push(nebulaClose);

    this.tweens.add({
      targets: nebulaMid,
      scaleX: 1.045,
      scaleY: 1.045,
      angle: 1.4,
      duration: 42000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.tweens.add({
      targets: nebulaClose,
      x: nebulaClose.x - 36,
      y: nebulaClose.y + 18,
      alpha: 0.46,
      duration: 26000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.tweens.add({
      targets: stars,
      x: '+=18',
      y: '+=10',
      duration: 48000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  private createArenaPlatform() {
    this.add.image(960, 540, 'arena_platform')
      .setDisplaySize(1920, 1080)
      .setDepth(5)
      .setAlpha(0.9);
  }

  private createCinematicOverlay() {
    this.overlay = this.add.rectangle(960, 540, 1920, 1080, 0x040012)
      .setAlpha(0.18)
      .setDepth(6)
      .setScrollFactor(0);
  }

  private startCameraDrift() {
    const cam = this.cameras.main;
    cam.setZoom(1);
    this.cameraDriftTween = this.tweens.add({
      targets: cam,
      scrollX: { from: -10, to: 10 },
      scrollY: { from: -6, to: 6 },
      duration: 9000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  private createSpeedButton() {
    this.speedBtnBase = this.add.image(1848, 48, 'button_base')
      .setDisplaySize(88, 44)
      .setInteractive({ useHandCursor: true })
      .setDepth(910)
      .setScrollFactor(0);

    this.speedBtnText = this.add.text(1848, 48, 'x2', {
      fontSize: '26px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(911).setScrollFactor(0);

    this.speedBtnBase.on('pointerdown', () => {
      if (this.battleSpeedMultiplier === 1) {
        this.battleSpeedMultiplier = 0.5;
        this.speedBtnText?.setText('x1');
        this.speedBtnText?.setColor('#ffff66');
      } else {
        this.battleSpeedMultiplier = 1;
        this.speedBtnText?.setText('x2');
        this.speedBtnText?.setColor('#ffffff');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Teams
  // ---------------------------------------------------------------------------

  private setupTeams() {
    this.destroyCombatants(this.playerUnits);
    this.destroyCombatants(this.aiUnits);
    this.playerUnits = [];
    this.aiUnits = [];

    const playerCount = Math.min(8, Math.max(this.playerUnitsData.length, this.playerMaxHp.length));
    for (let i = 0; i < playerCount; i++) {
      const unit = this.playerUnitsData[i] || { faction: 0, unitClass: 0 };
      const pos = this.slotPosition(true, i);
      this.playerUnits.push(this.spawnCombatant(pos.x, pos.y, pos.scale, unit, this.playerMaxHp[i] || 100, true));
    }

    const aiCount = Math.min(8, Math.max(this.aiUnitsData.length || 8, this.aiMaxHp.length || 8, 8));
    for (let i = 0; i < aiCount; i++) {
      const unit = this.aiUnitsData[i] || { faction: 1, unitClass: 0 };
      const pos = this.slotPosition(false, i);
      this.aiUnits.push(this.spawnCombatant(pos.x, pos.y, pos.scale, unit, this.aiMaxHp[i] || 100, false));
    }
  }

  private slotPosition(isPlayer: boolean, index: number) {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const depthFactor = row * 0.09;
    const baseY = 278;
    const rowSpacing = 138;
    const colSpacing = 138;
    const y = baseY + row * rowSpacing + depthFactor * 26;
    const scale = 0.64 - depthFactor * 0.045;

    if (isPlayer) {
      let x = 498 + col * colSpacing;
      if (col === 0) x -= 14;
      if (col === 1) x += 28;
      return { x, y, scale };
    }

    let x = 1404 - col * colSpacing;
    if (col === 0) x += 14;
    if (col === 1) x -= 28;
    return { x, y, scale };
  }

  private spawnCombatant(
    x: number,
    y: number,
    baseScale: number,
    unit: any,
    maxHp: number,
    isPlayer: boolean
  ): Combatant {
    const faction = Number(unit.faction ?? 0);
    const unitClass = Number(unit.unitClass ?? 0);
    const key = this.getShipKey(faction, unitClass);
    const palette = FACTION_ENGINE[faction] || FACTION_ENGINE[0];

    const shadow = this.add.sprite(x + 9, y + 20, key)
      .setScale(baseScale * 0.5)
      .setAlpha(0.24)
      .setTint(0x000000)
      .setDepth(y - 6)
      .setFlipX(isPlayer);

    const ship = this.add.sprite(x, y, key)
      .setScale(baseScale)
      .setDepth(y + 12)
      .setFlipX(isPlayer);

    const engine = this.createEngineEmitter(
      x + (isPlayer ? -22 : 22),
      y + 10,
      faction,
      isPlayer
    );
    engine.startFollow(ship, isPlayer ? -22 : 22, 10);

    const barY = y - 42;
    const hpBg = this.add.rectangle(x, barY, 54, 5, 0x140818)
      .setStrokeStyle(1, palette.glow, 0.35)
      .setDepth(y + 34)
      .setAlpha(0);
    const hpFill = this.add.rectangle(x, barY, 54, 5, isPlayer ? 0x5dffb0 : 0xff6b7d)
      .setDepth(y + 35)
      .setAlpha(0);
    (hpFill as any).maxHp = maxHp;
    (hpFill as any).currentHp = maxHp;

    const idleTween = this.tweens.add({
      targets: ship,
      y: y - 3.5,
      scaleX: baseScale * 1.018,
      scaleY: baseScale * 1.018,
      duration: 1500 + Math.floor(Math.random() * 500),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.tweens.add({
      targets: shadow,
      alpha: { from: 0.18, to: 0.28 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    return {
      ship,
      shadow,
      hpBg,
      hpFill,
      engine,
      homeX: x,
      homeY: y,
      baseScale,
      faction,
      unitClass,
      alive: true,
      lastStandLit: false,
      idleTween
    };
  }

  private refreshCombatantDepths(units: Combatant[]) {
    for (const unit of units) {
      if (!unit.ship || !unit.ship.active) continue;
      const y = unit.ship.y;
      unit.ship.setDepth(y + 12);
      unit.shadow.setDepth(y - 6);
      unit.hpBg.setDepth(y + 34);
      unit.hpFill.setDepth(y + 35);
      unit.engine.setDepth(y - 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------

  private processNextEvent() {
    if (!this.isPlaying) return;

    if (this.currentEventIndex >= this.battleEvents.length) {
      this.showFinalResult();
      return;
    }

    const event = this.battleEvents[this.currentEventIndex];
    this.currentEventIndex += 1;
    this.animateEvent(event);

    const kill = Number(event.remainingHp) <= 0;
    const extra = kill ? 420 : (event.specialEffect === 'CRIT' ? 180 : 0);
    const delay = (1480 + extra) * this.battleSpeedMultiplier;
    this.delay(delay, () => this.processNextEvent());
  }

  private animateEvent(event: BattleEvent) {
    const isPlayer = event.isPlayerSide;
    const attackers = isPlayer ? this.playerUnits : this.aiUnits;
    const defenders = isPlayer ? this.aiUnits : this.playerUnits;
    const attacker = attackers[event.attackerIndex % attackers.length];
    const target = defenders[event.targetIndex % defenders.length];
    if (!attacker || !target || !attacker.ship || !target.ship) return;

    const speed = this.battleSpeedMultiplier;
    const dmg = Number(event.damageDealt) || 0;
    const effect = event.specialEffect || '';
    const isCrit = effect === 'CRIT';
    const isDodge = effect === 'DODGE';
    const isLastStand = effect === 'Last Stand';
    const lunge = isPlayer ? 28 : -28;

    const startX = attacker.ship.x;
    const startY = attacker.ship.y;
    const startScale = attacker.ship.scaleX;

    this.tweens.add({
      targets: attacker.ship,
      x: startX + lunge,
      y: startY - 7,
      scaleX: startScale * 1.08,
      scaleY: startScale * 1.08,
      duration: 95 * speed,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.spawnMuzzleFlash(attacker, isPlayer);
        this.fireLaser(attacker.ship, target.ship, isPlayer, isCrit, () => {
          if (isDodge) {
            this.playDodge(target);
            this.spawnFloatingText(target.ship.x, target.ship.y - 58, 'DODGE', '#7ad7ff', 34);
          } else {
            this.playHitStop(isCrit ? 70 : 48);
            this.impactCamera(dmg, isCrit, Number(event.remainingHp) <= 0);
            this.playImpact(target, dmg, isCrit);
            this.updateHealthBar(target, event.remainingHp);
            if (dmg > 0) {
              this.spawnDamageNumber(target.ship.x, target.ship.y - 58, dmg, isCrit);
            }
            if (isLastStand && event.remainingHp > 0) {
              this.playLastStand(target);
            }
            if (event.remainingHp <= 0) {
              this.killCombatant(target);
            }
          }

          this.pushLogLine(event, dmg, effect);

          this.tweens.add({
            targets: attacker.ship,
            x: attacker.homeX,
            y: attacker.homeY,
            scaleX: attacker.baseScale,
            scaleY: attacker.baseScale,
            duration: 170 * speed,
            ease: 'Sine.easeOut'
          });
        });
      }
    });
  }

  private fireLaser(
    from: Phaser.GameObjects.Sprite,
    to: Phaser.GameObjects.Sprite,
    isPlayer: boolean,
    isCrit: boolean,
    onHit: () => void
  ) {
    const speed = this.battleSpeedMultiplier;
    const key = isPlayer ? 'laser_blue' : 'laser_red';
    const angle = Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y);
    const dist = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);

    const beam = this.add.image(from.x, from.y, key)
      .setOrigin(0, 0.5)
      .setRotation(angle)
      .setDisplaySize(8, isCrit ? 22 : 14)
      .setAlpha(0.95)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(440);

    const glow = this.add.image(from.x, from.y, key)
      .setOrigin(0, 0.5)
      .setRotation(angle)
      .setDisplaySize(8, isCrit ? 40 : 26)
      .setAlpha(0.35)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(439);

    this.tweens.add({
      targets: [beam, glow],
      displayWidth: dist,
      duration: 78 * speed,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        onHit();
        this.tweens.add({
          targets: [beam, glow],
          alpha: 0,
          displayHeight: 4,
          duration: 90 * speed,
          onComplete: () => {
            beam.destroy();
            glow.destroy();
          }
        });
      }
    });
  }

  private spawnMuzzleFlash(attacker: Combatant, isPlayer: boolean) {
    const palette = FACTION_ENGINE[attacker.faction] || FACTION_ENGINE[0];
    const noseX = attacker.ship.x + (isPlayer ? 26 : -26);
    const noseY = attacker.ship.y - 2;
    if (this.muzzleEmitter) {
      this.muzzleEmitter.setParticleTint(palette.tint);
      this.muzzleEmitter.explode(8, noseX, noseY);
    }

    const flash = this.add.image(noseX, noseY, 'muzzle_flash')
      .setScale(0.42)
      .setTint(palette.glow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setRotation(isPlayer ? 0 : Math.PI)
      .setDepth(471);
    this.tweens.add({
      targets: flash,
      scale: 0.85,
      alpha: 0,
      duration: 130 * this.battleSpeedMultiplier,
      onComplete: () => flash.destroy()
    });
  }

  private playImpact(target: Combatant, damage: number, isCrit: boolean) {
    const palette = FACTION_ENGINE[target.faction] || FACTION_ENGINE[0];
    const x = target.ship.x;
    const y = target.ship.y;

    if (this.hitEmitter) {
      this.hitEmitter.setParticleTint(isCrit ? 0xfff1a0 : 0xffffff);
      this.hitEmitter.explode(isCrit ? 18 : 10, x, y);
    }

    const spark = this.add.sprite(x, y, 'spark_sheet', 0)
      .setScale(isCrit ? 1.15 : 0.85)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(461);
    spark.play('spark_flash');
    spark.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spark.destroy());
    if (this.plasmaEmitter) {
      this.plasmaEmitter.setParticleTint(isCrit ? 0xffe27a : palette.glow);
      this.plasmaEmitter.explode(isCrit ? 16 : 8, x, y);
    }

    this.tweens.add({
      targets: target.ship,
      x: target.ship.x + (Math.random() * 10 - 5),
      y: target.ship.y - 4,
      duration: 50 * this.battleSpeedMultiplier,
      yoyo: true,
      ease: 'Sine.easeOut'
    });

    if (isCrit) {
      this.playCritBurst(x, y);
    }

    const flash = this.add.rectangle(x, y, 70, 70, isCrit ? 0xfff3a1 : 0xffffff, 0.18)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(450);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.8,
      duration: 160 * this.battleSpeedMultiplier,
      onComplete: () => flash.destroy()
    });

    void damage;
  }

  private playCritBurst(x: number, y: number) {
    if (this.critEmitter) {
      this.critEmitter.explode(16, x, y);
    }
    const ring = this.add.image(x, y, 'energy_ring')
      .setScale(0.22)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(466);
    this.tweens.add({
      targets: ring,
      scale: 1.15,
      alpha: 0,
      duration: 300 * this.battleSpeedMultiplier,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy()
    });
  }

  private playDodge(target: Combatant) {
    const ghost = this.add.sprite(target.ship.x, target.ship.y, target.ship.texture.key)
      .setScale(target.ship.scaleX)
      .setFlipX(target.ship.flipX)
      .setAlpha(0.55)
      .setTint(0x7ad7ff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(target.ship.depth + 2);

    this.tweens.add({
      targets: ghost,
      x: target.ship.x + (target.ship.flipX ? -46 : 46),
      alpha: 0,
      scale: target.ship.scaleX * 1.08,
      duration: 280 * this.battleSpeedMultiplier,
      onComplete: () => ghost.destroy()
    });

    this.tweens.add({
      targets: target.ship,
      x: target.homeX + (target.ship.flipX ? 18 : -18),
      duration: 80 * this.battleSpeedMultiplier,
      yoyo: true,
      ease: 'Sine.easeOut'
    });

    if (this.plasmaEmitter) {
      this.plasmaEmitter.setParticleTint(0x6ecbff);
      this.plasmaEmitter.explode(10, target.ship.x, target.ship.y);
    }
  }

  private playLastStand(target: Combatant) {
    target.lastStandLit = true;
    const shield = this.add.image(target.ship.x, target.ship.y, 'shield_glow')
      .setScale(0.42)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(target.ship.depth + 3)
      .setAlpha(0.9);

    this.tweens.add({
      targets: shield,
      scale: 0.72,
      alpha: 0,
      duration: 640 * this.battleSpeedMultiplier,
      ease: 'Sine.easeOut',
      onComplete: () => shield.destroy()
    });

    const ring = this.add.image(target.ship.x, target.ship.y, 'energy_ring')
      .setScale(0.28)
      .setTint(0xff3355)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(target.ship.depth + 4);

    this.tweens.add({
      targets: ring,
      scale: 0.85,
      alpha: 0,
      duration: 520 * this.battleSpeedMultiplier,
      onComplete: () => ring.destroy()
    });

    this.tweens.add({
      targets: target.ship,
      tint: 0xff6677,
      duration: 90,
      yoyo: true,
      repeat: 3,
      onComplete: () => target.ship.clearTint()
    });
  }

  private killCombatant(target: Combatant) {
    if (!target.alive) return;
    target.alive = false;
    if (target.idleTween) {
      target.idleTween.stop();
      target.idleTween = null;
    }
    target.engine.stop();
    target.engine.explode(8, target.ship.x, target.ship.y);

    this.playExplosion(target.ship.x, target.ship.y);
    if (this.debrisEmitter) {
      this.debrisEmitter.setParticleTint(0xffaa66);
      this.debrisEmitter.explode(18, target.ship.x, target.ship.y);
    }

    const destroyedKey = this.getDestroyedShipKey(target.faction, target.unitClass);
    if (destroyedKey && this.textures.exists(destroyedKey)) {
      target.ship.setTexture(destroyedKey);
    }

    this.tweens.add({
      targets: target.ship,
      alpha: 0.55,
      angle: target.ship.flipX ? -14 : 14,
      y: target.ship.y + 16,
      scaleX: target.baseScale * 0.92,
      scaleY: target.baseScale * 0.92,
      duration: 420 * this.battleSpeedMultiplier,
      ease: 'Cubic.easeOut'
    });

    this.tweens.add({
      targets: [target.hpBg, target.hpFill, target.shadow],
      alpha: 0,
      duration: 260 * this.battleSpeedMultiplier
    });

    this.delay(500 * this.battleSpeedMultiplier, () => {
      if (target.engine) target.engine.stop();
    });
  }

  private playExplosion(x: number, y: number) {
    for (let i = 0; i < 3; i++) {
      this.delay(i * 80, () => {
        const explosion = this.add.sprite(
          x + (Math.random() - 0.5) * 22,
          y + (Math.random() - 0.5) * 22,
          'explosion_01'
        ).setDepth(480).setScale(0.78 + i * 0.18).setBlendMode(Phaser.BlendModes.ADD);

        let frame = 1;
        const timer = this.time.addEvent({
          delay: 50,
          repeat: 5,
          callback: () => {
            frame += 1;
            if (frame <= 6) {
              explosion.setTexture(`explosion_${frame.toString().padStart(2, '0')}`);
            } else {
              timer.remove();
              this.tweens.add({
                targets: explosion,
                alpha: 0,
                scale: 2.25,
                duration: 150,
                onComplete: () => explosion.destroy()
              });
            }
          }
        });
        this.pendingTimers.push(timer);
      });
    }
  }

  private updateHealthBar(target: Combatant, remainingHp: number) {
    const maxHp = (target.hpFill as any).maxHp || 100;
    const hp = Math.max(0, Number(remainingHp));
    (target.hpFill as any).currentHp = hp;
    const percent = Math.max(0, Math.min(1, hp / maxHp));

    target.hpBg.setAlpha(0.9);
    target.hpFill.setAlpha(0.95);
    target.hpFill.width = 54 * percent;

    let color = 0x5dffb0;
    if (percent < 0.3) color = 0xff4455;
    else if (percent < 0.6) color = 0xffcc44;
    target.hpFill.setFillStyle(color);
  }

  private spawnDamageNumber(x: number, y: number, damage: number, isCrit: boolean) {
    const text = this.add.text(x, y, isCrit ? `CRIT -${damage}` : `-${damage}`, {
      fontSize: isCrit ? '48px' : '40px',
      color: isCrit ? '#ffe566' : '#ff5a5a',
      fontStyle: 'bold',
      stroke: isCrit ? '#7a4a00' : '#2a0008',
      strokeThickness: isCrit ? 6 : 4
    }).setOrigin(0.5).setDepth(500).setScale(0.55);

    this.tweens.add({
      targets: text,
      y: y - 92,
      alpha: 0,
      scale: isCrit ? 1.18 : 1.0,
      duration: 640 * this.battleSpeedMultiplier,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy()
    });
  }

  private spawnFloatingText(x: number, y: number, label: string, color: string, size: number) {
    const text = this.add.text(x, y, label, {
      fontSize: `${size}px`,
      color,
      fontStyle: 'bold',
      stroke: '#041018',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(500).setScale(0.7);

    this.tweens.add({
      targets: text,
      y: y - 70,
      alpha: 0,
      scale: 1.05,
      duration: 520 * this.battleSpeedMultiplier,
      onComplete: () => text.destroy()
    });
  }

  private playHitStop(ms: number) {
    this.time.timeScale = 0.22;
    this.tweens.timeScale = 0.22;
    this.delay(ms, () => {
      this.time.timeScale = 1;
      this.tweens.timeScale = 1;
    }, false);
  }

  private impactCamera(damage: number, isCrit: boolean, isKill: boolean) {
    const intensity = Math.min(0.016, 0.0035 + damage / 9000) * (isCrit ? 1.8 : 1) * (isKill ? 1.5 : 1);
    const duration = isKill ? 220 : isCrit ? 180 : 110;
    this.cameras.main.shake(duration, intensity);

    if (isCrit || isKill) {
      const cam = this.cameras.main;
      this.tweens.add({
        targets: cam,
        zoom: isKill ? 1.055 : 1.04,
        duration: 90,
        yoyo: true,
        ease: 'Sine.easeOut'
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Log + result
  // ---------------------------------------------------------------------------

  private setupBattleLog() {
    this.logContainer = this.add.container(960, 948).setDepth(880).setScrollFactor(0);
    this.logTitle = this.add.text(960, 922, 'BATTLE LOG', {
      fontSize: '16px',
      color: '#f6e27a',
      fontStyle: 'bold',
      stroke: '#1a1020',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(881).setScrollFactor(0);
  }

  private pushLogLine(event: BattleEvent, damage: number, effect: string) {
    const attackerName = `${this.getRarityName(event.attackerRarity)} ${this.getClassName(event.attackerClass)}`;
    const targetName = `${this.getRarityName(event.targetRarity)} ${this.getClassName(event.targetClass)}`;
    const side = event.isPlayerSide ? 'YOU' : 'VOID';
    let color = event.isPlayerSide ? '#9fd6ff' : '#ff9aa8';
    let suffix = `${damage}`;
    if (effect === 'CRIT') {
      color = '#ffe566';
      suffix = `CRIT ${damage}`;
    } else if (effect === 'DODGE') {
      color = '#7ad7ff';
      suffix = 'DODGE';
    } else if (effect === 'Last Stand') {
      color = '#ff6b7a';
      suffix = `LAST STAND ${damage}`;
    }

    const line = `R${event.round}  ${side}  ${attackerName} → ${targetName}  ${suffix}`;
    this.addToLog(line, color);
  }

  private addToLog(text: string, color = '#d0d0ff') {
    this.fullBattleLog.push(text);
    const logText = this.add.text(0, 0, text, {
      fontSize: '15px',
      color,
      fontStyle: 'bold',
      stroke: '#0a0612',
      strokeThickness: 3,
      wordWrap: { width: 1400 },
      align: 'center'
    }).setOrigin(0.5, 0).setDepth(882);

    this.battleLogTexts.unshift(logText);
    this.logContainer?.add(logText);
    this.battleLogTexts.forEach((entry, index) => {
      entry.y = index * 22;
      entry.setAlpha(1 - index * 0.16);
    });

    if (this.battleLogTexts.length > 4) {
      const old = this.battleLogTexts.pop();
      old?.destroy();
    }
  }

  private showEmptyState() {
    this.add.text(960, 420, 'NO BATTLE DATA FROM CONTRACT', {
      fontSize: '32px',
      color: '#ff4444',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(920);

    const backBtn = this.add.image(960, 520, 'button_base')
      .setDisplaySize(300, 52)
      .setInteractive({ useHandCursor: true })
      .setDepth(920);
    this.add.text(960, 520, 'BACK TO PREPARE', {
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(921);
    backBtn.on('pointerdown', () => this.returnToPrepare());
  }

  private showFinalResult() {
    this.isPlaying = false;
    const winners = this.playerWon ? this.playerUnits : this.aiUnits;
    const midX = winners.length > 0
      ? winners.reduce((sum, unit) => sum + unit.homeX, 0) / winners.length
      : 960;
    const midY = winners.length > 0
      ? winners.reduce((sum, unit) => sum + unit.homeY, 0) / winners.length
      : 480;

    if (this.cameraDriftTween) {
      this.cameraDriftTween.stop();
      this.cameraDriftTween = null;
    }

    this.cameras.main.pan(midX, midY, 700, 'Sine.easeInOut');
    this.tweens.add({
      targets: this.cameras.main,
      zoom: 1.12,
      duration: 800,
      ease: 'Sine.easeInOut'
    });

    if (this.victoryEmitter) {
      this.victoryEmitter.setPosition(midX, midY - 40);
      this.victoryEmitter.setParticleTint(this.playerWon ? 0x7dffc4 : 0xff6b88);
      this.victoryEmitter.start();
    }

    const title = this.playerWon ? 'VICTORY' : 'DEFEAT';
    const color = this.playerWon ? '#5dffb0' : '#ff4d6d';

    const veil = this.add.rectangle(960, 540, 1920, 1080, 0x050010, 0)
      .setDepth(930)
      .setScrollFactor(0);
    this.tweens.add({ targets: veil, alpha: 0.35, duration: 500 });

    const result = this.add.text(960, 86, title, {
      fontSize: '72px',
      color,
      fontStyle: 'bold',
      stroke: '#120818',
      strokeThickness: 8
    }).setOrigin(0.5).setDepth(940).setScrollFactor(0).setAlpha(0).setScale(0.6);

    this.tweens.add({
      targets: result,
      alpha: 1,
      scale: 1,
      duration: 480,
      ease: 'Back.easeOut'
    });

    const glow = this.add.image(960, 86, 'energy_ring')
      .setScale(1.25)
      .setTint(this.playerWon ? 0x3dff9a : 0xff3355)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(935)
      .setScrollFactor(0);
    this.tweens.add({ targets: glow, alpha: 0.45, duration: 500, yoyo: true, repeat: 2 });

    const btn = this.add.image(960, 980, 'button_base')
      .setDisplaySize(300, 52)
      .setInteractive({ useHandCursor: true })
      .setDepth(941)
      .setScrollFactor(0)
      .setAlpha(0);
    const btnText = this.add.text(960, 980, 'GO BACK', {
      fontSize: '26px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(942).setScrollFactor(0).setAlpha(0);

    this.tweens.add({
      targets: [btn, btnText],
      alpha: 1,
      duration: 360,
      delay: 280
    });

    btn.on('pointerdown', () => this.returnToPrepare());
  }

  private returnToPrepare() {
    this.shutdownCleanup();
    this.scene.start('PrepareScene');
  }

  // ---------------------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------------------

  private getShipKey(faction: number, unitClass: number): string {
    const map: Record<string, string> = {
      '0_0': 'emperial_fighter',
      '0_1': 'emperial_cruiser',
      '0_2': 'emperial_dreadnought',
      '0_3': 'emperial_droneswarm',
      '1_0': 'voidborn_fighter',
      '1_1': 'voidborn_cruiser',
      '1_2': 'voidborn_dreadnought',
      '1_3': 'voidborn_droneswarm',
      '2_0': 'mechanoid_fighter',
      '2_1': 'mechanoid_cruiser',
      '2_2': 'mechanoid_dreadnought',
      '2_3': 'mechanoid_droneswarm'
    };
    return map[`${faction}_${unitClass}`] || 'emperial_fighter';
  }

  private getDestroyedShipKey(faction?: number, unitClass?: number): string | null {
    if (faction === undefined || unitClass === undefined) return null;
    const map: Record<string, string> = {
      '0_0': 'emperial_fighter_destroyed',
      '0_1': 'emperial_cruiser_destroyed',
      '0_2': 'emperial_dreadnought_destroyed',
      '0_3': 'emperial_droneswarm_destroyed',
      '1_0': 'voidborn_fighter_destroyed',
      '1_1': 'voidborn_cruiser_destroyed',
      '1_2': 'voidborn_dreadnought_destroyed',
      '1_3': 'voidborn_droneswarm_destroyed',
      '2_0': 'mechanoid_fighter_destroyed',
      '2_1': 'mechanoid_cruiser_destroyed',
      '2_2': 'mechanoid_dreadnought_destroyed',
      '2_3': 'mechanoid_droneswarm_destroyed'
    };
    return map[`${faction}_${unitClass}`] || null;
  }

  private getRarityName(rarity?: number): string {
    if (rarity === 2) return 'Legendary';
    if (rarity === 1) return 'Rare';
    return 'Common';
  }

  private getClassName(unitClass?: number): string {
    const names = ['Fighter', 'Cruiser', 'Dreadnought', 'Drone Swarm'];
    return names[unitClass || 0] || 'Unknown';
  }

  private delay(ms: number, fn: () => void, scaleWithBattle = true) {
    const wait = scaleWithBattle ? ms : ms;
    const timer = this.time.delayedCall(wait, fn);
    this.pendingTimers.push(timer);
    return timer;
  }

  private destroyCombatants(units: Combatant[]) {
    for (const unit of units) {
      unit.idleTween?.stop();
      unit.engine?.stop();
      unit.engine?.destroy();
      unit.ship?.destroy();
      unit.shadow?.destroy();
      unit.hpBg?.destroy();
      unit.hpFill?.destroy();
    }
  }

  private shutdownCleanup() {
    this.isPlaying = false;
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.pendingTimers.forEach((timer) => timer.remove(false));
    this.pendingTimers = [];

    this.destroyCombatants(this.playerUnits);
    this.destroyCombatants(this.aiUnits);
    this.playerUnits = [];
    this.aiUnits = [];

    this.hitEmitter?.destroy();
    this.plasmaEmitter?.destroy();
    this.debrisEmitter?.destroy();
    this.muzzleEmitter?.destroy();
    this.critEmitter?.destroy();
    this.victoryEmitter?.destroy();
    this.hitEmitter = null;
    this.plasmaEmitter = null;
    this.debrisEmitter = null;
    this.muzzleEmitter = null;
    this.critEmitter = null;
    this.victoryEmitter = null;

    this.battleLogTexts.forEach((entry) => entry.destroy());
    this.battleLogTexts = [];
    this.logContainer?.destroy();
    this.logContainer = null;
    this.logTitle?.destroy();
    this.logTitle = null;

    this.overlay?.destroy();
    this.overlay = null;
    this.speedBtnBase?.destroy();
    this.speedBtnBase = null;
    this.speedBtnText?.destroy();
    this.speedBtnText = null;

    this.backgroundLayers = [];
    this.cameraDriftTween = null;
    this.cameras.main.resetFX();
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(960, 540);
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
  }

  shutdown() {
    this.shutdownCleanup();
  }
}
