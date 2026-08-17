// @ts-nocheck
// frontend/src/scenes/BattleScene.ts
// Cinematic auto-battler playback. Contract data-flow is unchanged:
// events / playerWon / playerMaxHp / aiMaxHp / playerUnitsData / aiUnitsData.

import Phaser from 'phaser';
import { HUD, displayText, hudText, shipKey, rarityName, className } from '../utils/HudChrome';
import { gameAudio } from '../lib/gameAudio';
import { unlockAchievement } from '../lib/achievements';
import { beginOrResumeTutorial, showAchievementToasts } from '../utils/MetaHud';
import { CombatVfx, classLunge, preloadCombatFx } from '../utils/combatVfx';
import { preloadDestroyedShips, preloadShipPortraits } from '../utils/preloadGameAssets';

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
  rarity: number;
  isPlayer: boolean;
  alive: boolean;
  lastStandLit: boolean;
  idleTween: Phaser.Tweens.Tween | null;
  maxHp: number;
  currentHp: number;
}

const FACTION_ENGINE: Record<number, { tint: number; tintAlt: number; glow: number }> = {
  0: { tint: 0x8fd6ff, tintAlt: 0xffffff, glow: 0x3aa7ff },
  1: { tint: 0xd48cff, tintAlt: 0x7a20ff, glow: 0xb44cff },
  2: { tint: 0xffb347, tintAlt: 0xfff1a8, glow: 0xff7a18 }
};

// Original timeline * 1.7 (70% faster), then another 50% (1.5x).
const PLAYBACK_SCALE_NORMAL = 2.55;
const PLAYBACK_SCALE_FAST = PLAYBACK_SCALE_NORMAL * 2;
const PLAYBACK_SCALE_SKIP = PLAYBACK_SCALE_NORMAL * 3;

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
  private logPanel: Phaser.GameObjects.Rectangle | null = null;
  private logPlate: Phaser.GameObjects.Image | null = null;
  private battleSpeedMultiplier = 1;
  private playbackTimeScale = PLAYBACK_SCALE_NORMAL;
  private skipActive = false;
  private speedFast = false;
  private isPlaying = false;
  private resultOpen = false;
  private maxRound = 0;
  private roundHud: Phaser.GameObjects.Text | null = null;
  private sideLabelPlayer: Phaser.GameObjects.Text | null = null;
  private sideLabelEnemy: Phaser.GameObjects.Text | null = null;

  private backgroundLayers: Phaser.GameObjects.Image[] = [];
  private cameraDriftTween: Phaser.Tweens.Tween | null = null;

  private plasmaEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private debrisEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private critEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private victoryEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  private overlay: Phaser.GameObjects.Rectangle | null = null;
  private speedBtnBase: Phaser.GameObjects.Image | null = null;
  private speedBtnText: Phaser.GameObjects.Text | null = null;
  private skipBtnBase: Phaser.GameObjects.Image | null = null;
  private skipBtnText: Phaser.GameObjects.Text | null = null;
  private pendingTimers: Phaser.Time.TimerEvent[] = [];
  private savedTeam: number[] = [];
  private vfx: CombatVfx | null = null;

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
    this.savedTeam = Array.isArray(data.savedTeam) ? data.savedTeam.map((id: unknown) => Number(id)) : [];
    this.currentEventIndex = 0;
    this.isPlaying = false;
    this.battleSpeedMultiplier = 1;
    this.skipActive = false;
    this.speedFast = false;
    this.playbackTimeScale = PLAYBACK_SCALE_NORMAL;
    this.resultOpen = false;
    this.maxRound = 0;
    this.fullBattleLog = [];
    this.battleLogTexts = [];
  }

  preload() {
    this.load.image('stars', 'assets/background/stars.png');
    this.load.image('nebula_mid', 'assets/background/nebula_mid.png');
    this.load.image('nebula_close', 'assets/background/nebula_close.png');
    this.load.image('arena_platform', 'assets/background/arena_platform.png');

    this.load.image('button_base', 'assets/button_base.png');
    this.load.image('ui_titlebar', 'assets/ui/ui_titlebar.png');
    this.load.image('ui_plate', 'assets/ui/ui_plate.png');
    this.load.image('ui_result', 'assets/ui/ui_result.png');

    this.load.image('laser_blue', 'assets/effects/laser_blue.png');
    this.load.image('laser_red', 'assets/effects/laser_red.png');
    this.load.image('muzzle_flash', 'assets/effects/muzzle_flash.png');
    this.load.image('energy_ring', 'assets/effects/energy_ring.png');
    this.load.image('engine_blob', 'assets/effects/engine_blob.png');
    this.load.image('shield_glow', 'assets/effects/shield_glow.png');
    preloadCombatFx(this);
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

    preloadShipPortraits(this);
    preloadDestroyedShips(this);
  }

  create() {
    this.shutdownCleanup();
    this.ensureFxTextures();
    this.createFxAnimations();
    this.createParallaxBackground();
    this.createArenaPlatform();
    this.createSharedEmitters();
    this.vfx = new CombatVfx(this);
    this.vfx.boot();
    this.createCinematicOverlay();
    this.createSpeedButton();
    this.createSkipButton();
    this.applyPlaybackRate();
    this.startCameraDrift();

    this.setupTeams();
    this.setupBattleLog();
    this.setupBattleChrome();
    gameAudio.unlock();
    const account = window.account as string | undefined;
    if (account) {
      this.time.delayedCall(600, () => beginOrResumeTutorial(this, account, 'BattleScene'));
    }

    if (this.battleEvents.length === 0) {
      this.showEmptyState();
      return;
    }

    this.currentEventIndex = 0;
    this.isPlaying = true;
    this.delay(700, () => this.processNextEvent());
  }

  update(_time: number, _delta: number) {
    this.syncCombatantAttachments(this.playerUnits);
    this.syncCombatantAttachments(this.aiUnits);
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
    this.speedBtnBase = this.add.image(1836, 48, 'button_base')
      .setDisplaySize(120, HUD.SPEED_H)
      .setInteractive({ useHandCursor: true })
      .setDepth(910)
      .setScrollFactor(0);

    this.speedBtnText = this.add.text(1836, 48, 'x2', hudText({
      fontSize: '22px',
      color: '#ffffff'
    })).setOrigin(0.5).setDepth(911).setScrollFactor(0);

    this.speedBtnBase.on('pointerdown', () => this.toggleFastSpeed());
  }

  private createSkipButton() {
    this.skipBtnBase = this.add.image(1696, 48, 'button_base')
      .setDisplaySize(120, HUD.SPEED_H)
      .setInteractive({ useHandCursor: true })
      .setDepth(910)
      .setScrollFactor(0);

    this.skipBtnText = this.add.text(1696, 48, 'SKIP', hudText({
      fontSize: '18px',
      color: '#ffffff'
    })).setOrigin(0.5).setDepth(911).setScrollFactor(0);

    this.skipBtnBase.on('pointerdown', () => this.toggleSkip());
    this.input.keyboard?.on('keydown-SPACE', () => this.toggleSkip());
    this.input.keyboard?.on('keydown-ESC', () => this.toggleSkip());
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.resultOpen) {
        this.returnToPrepare();
      }
    });
  }

  private toggleFastSpeed() {
    this.speedFast = !this.speedFast;
    this.skipActive = false;
    this.refreshSpeedButton();
    this.refreshSkipButton();
    this.applyPlaybackRate();
  }

  private toggleSkip() {
    if (this.resultOpen) {
      this.returnToPrepare();
      return;
    }
    if (!this.isPlaying) {
      return;
    }
    this.skipActive = !this.skipActive;
    this.refreshSkipButton();
    this.applyPlaybackRate();
  }

  private refreshSpeedButton() {
    if (this.speedFast) {
      this.speedBtnText?.setText('x1');
      this.speedBtnText?.setColor('#ffff66');
    } else {
      this.speedBtnText?.setText('x2');
      this.speedBtnText?.setColor('#ffffff');
    }
  }

  private refreshSkipButton() {
    if (this.skipActive) {
      this.skipBtnText?.setColor('#ffff66');
    } else {
      this.skipBtnText?.setColor('#ffffff');
    }
  }

  private applyPlaybackRate() {
    if (this.skipActive) {
      this.playbackTimeScale = PLAYBACK_SCALE_SKIP;
    } else if (this.speedFast) {
      this.playbackTimeScale = PLAYBACK_SCALE_FAST;
    } else {
      this.playbackTimeScale = PLAYBACK_SCALE_NORMAL;
    }
    this.time.timeScale = this.playbackTimeScale;
    this.tweens.timeScale = this.playbackTimeScale;
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

    const aiCount = Math.min(8, this.aiUnitsData.length, this.aiMaxHp.length);
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
    const key = shipKey(faction, unitClass);
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
    const hpBg = this.add.rectangle(x, barY, 56, 6, 0x140818)
      .setStrokeStyle(1, palette.glow, 0.45)
      .setDepth(y + 34)
      .setAlpha(0.92);
    const hpFill = this.add.rectangle(x, barY, 56, 6, isPlayer ? 0x5dffb0 : 0xff6b7d)
      .setDepth(y + 35)
      .setAlpha(1);


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
      rarity: Number(unit.rarity ?? 0),
      isPlayer,
      alive: true,
      lastStandLit: false,
      idleTween,
      maxHp,
      currentHp: maxHp
    };
  }

  private syncCombatantAttachments(units: Combatant[]) {
    for (const unit of units) {
      if (!unit.ship || !unit.ship.active) continue;
      const x = unit.ship.x;
      const y = unit.ship.y;
      unit.ship.setDepth(y + 12);
      unit.shadow.setPosition(x + 9, y + 20);
      unit.shadow.setAngle(unit.ship.angle);
      unit.shadow.setFlipX(unit.ship.flipX);
      unit.shadow.setDepth(y - 6);
      unit.hpBg.setPosition(x, y - 42);
      unit.hpFill.setPosition(x, y - 42);
      unit.hpBg.setDepth(y + 34);
      unit.hpFill.setDepth(y + 35);
      unit.engine.setDepth(y - 1);
    }
  }

  // Art faces left. flipX = nose to the right. Extra angle is a bank toward the target.
  private faceToward(unit: Combatant, tx: number, ty: number) {
    if (!unit.alive || !unit.ship?.active) return;
    const dx = tx - unit.ship.x;
    const dy = ty - unit.ship.y;
    const faceRight = dx >= 0;
    unit.ship.setFlipX(faceRight);
    unit.shadow.setFlipX(faceRight);
    const pitch = Phaser.Math.Clamp(
      Math.atan2(dy, Math.max(48, Math.abs(dx))),
      -0.28,
      0.28
    );
    const deg = Phaser.Math.RadToDeg(faceRight ? pitch : -pitch);
    this.tweens.add({
      targets: unit.ship,
      angle: deg,
      duration: 90 * this.battleSpeedMultiplier,
      ease: 'Sine.easeOut'
    });
    this.syncEngine(unit, faceRight);
  }

  private restFacing(unit: Combatant) {
    if (!unit.ship?.active) return;
    const faceRight = unit.isPlayer;
    unit.ship.setFlipX(faceRight);
    unit.shadow.setFlipX(faceRight);
    this.tweens.add({
      targets: unit.ship,
      angle: 0,
      duration: 200 * this.battleSpeedMultiplier,
      ease: 'Sine.easeInOut'
    });
    this.syncEngine(unit, faceRight);
  }

  private syncEngine(unit: Combatant, faceRight: boolean) {
    const ox = faceRight ? -22 : 22;
    unit.engine.startFollow(unit.ship, ox, 10);
  }

  private noseOf(unit: Combatant) {
    const faceRight = unit.ship.flipX;
    const rot = unit.ship.rotation;
    const sx = faceRight ? 1 : -1;
    const len = 28;
    return {
      x: unit.ship.x + Math.cos(rot) * sx * len,
      y: unit.ship.y + Math.sin(rot) * sx * len
    };
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
    this.updateRoundHud(Number(event.round) || 0);
    this.animateEvent(event);

    const kill = Number(event.remainingHp) <= 0;
    const extra = kill ? 420 : (event.specialEffect === 'CRIT' ? 180 : 0);
    const attacker = (event.isPlayerSide ? this.playerUnits : this.aiUnits)[event.attackerIndex];
    const chargePad = attacker && attacker.unitClass === 2 ? 260 : attacker && attacker.unitClass === 1 ? 80 : 0;
    const delay = (1480 + extra + chargePad) * this.battleSpeedMultiplier;
    if (!this.skipActive && this.currentEventIndex < this.battleEvents.length) {
      this.delay(delay * 0.34, () => this.fireAmbientTracers());
      this.delay(delay * 0.7, () => this.fireAmbientTracers());
    }
    this.delay(delay, () => this.processNextEvent());
  }

  private animateEvent(event: BattleEvent) {
    const isPlayer = event.isPlayerSide;
    const attackers = isPlayer ? this.playerUnits : this.aiUnits;
    const defenders = isPlayer ? this.aiUnits : this.playerUnits;
    const attacker = attackers[event.attackerIndex];
    const target = defenders[event.targetIndex];
    if (!attacker || !target || !attacker.ship || !target.ship) return;

    const speed = this.battleSpeedMultiplier;
    const dmg = Number(event.damageDealt) || 0;
    const effect = event.specialEffect || '';
    const isCrit = effect === 'CRIT';
    const isDodge = effect === 'DODGE';
    const isLastStand = effect === 'Last Stand';
    const lunge = classLunge(attacker.unitClass);

    this.faceToward(attacker, target.ship.x, target.ship.y);
    this.faceToward(target, attacker.ship.x, attacker.ship.y);
    this.vfx?.markTarget(target.ship.x, target.ship.y, attacker.faction);

    const startX = attacker.ship.x;
    const startY = attacker.ship.y;
    const startScale = attacker.ship.scaleX;
    const aim = Phaser.Math.Angle.Between(startX, startY, target.ship.x, target.ship.y);

    this.tweens.add({
      targets: attacker.ship,
      x: startX + Math.cos(aim) * lunge,
      y: startY + Math.sin(aim) * lunge,
      scaleX: startScale * 1.08,
      scaleY: startScale * 1.08,
      duration: 95 * speed,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.fireWeapon(attacker, target.ship.x, target.ship.y, {
          crit: isCrit,
          onHit: () => {
            if (isDodge) {
              gameAudio.dodge();
              this.playDodge(target);
              this.spawnFloatingText(target.ship.x, target.ship.y - 58, 'DODGE', '#7ad7ff', 34);
            } else {
              this.playHitStop(isCrit ? 70 : 48);
              this.impactCamera(dmg, isCrit, Number(event.remainingHp) <= 0);
              this.playImpact(target, dmg, isCrit, attacker.unitClass);
              this.updateHealthBar(target, event.remainingHp);
              if (dmg > 0) {
                if (isPlayer && Number(event.remainingHp) > 0 && !isLastStand) {
                  gameAudio.hit(isCrit);
                }
                this.spawnDamageNumber(target.ship.x, target.ship.y - 58, dmg, isCrit);
              }
              if (isLastStand && event.remainingHp > 0) {
                gameAudio.lastStand();
                this.playLastStand(target);
                const account = window.account as string | undefined;
                if (account) {
                  const medal = unlockAchievement(account, 'last_stand');
                  if (medal) {
                    showAchievementToasts(this, [medal]);
                  }
                }
              }
              if (event.remainingHp <= 0) {
                gameAudio.explode();
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
              ease: 'Sine.easeOut',
              onComplete: () => this.delay(420 * speed, () => this.restFacing(attacker))
            });
            if (target.alive) {
              this.delay(560 * speed, () => this.restFacing(target));
            }
          }
        });
        this.fireCosmeticSupport(attacker, target, isPlayer);
      }
    });
  }

  private fireWeapon(
    attacker: Combatant,
    aimX: number,
    aimY: number,
    opts: { crit?: boolean; cosmetic?: boolean; onHit?: () => void } = {}
  ) {
    if (!attacker.alive || !attacker.ship?.active) {
      opts.onHit?.();
      return;
    }
    const nose = this.noseOf(attacker);
    if (!opts.cosmetic) {
      this.tweens.add({
        targets: attacker.ship,
        tint: FACTION_ENGINE[attacker.faction]?.glow ?? 0xffffff,
        duration: 70,
        yoyo: true,
        onComplete: () => attacker.ship.clearTint()
      });
    }
    if (!this.vfx) {
      opts.onHit?.();
      return;
    }
    this.vfx.shot({
      unitClass: attacker.unitClass,
      faction: attacker.faction,
      fromX: nose.x,
      fromY: nose.y,
      toX: aimX,
      toY: aimY,
      cosmetic: opts.cosmetic,
      crit: opts.crit,
      onHit: opts.onHit
    });
  }

  private fireCosmeticSupport(attacker: Combatant, target: Combatant, isPlayer: boolean) {
    if (this.skipActive || !this.isPlaying) return;
    const allies = (isPlayer ? this.playerUnits : this.aiUnits).filter(
      (unit) => unit.alive && unit !== attacker
    );
    const foes = (isPlayer ? this.aiUnits : this.playerUnits).filter((unit) => unit.alive);
    if (foes.length === 0) return;

    const support = this.pickSome(allies, 1);
    support.forEach((unit) => {
      this.delay(90, () => {
        if (!unit.alive || !this.isPlaying) return;
        const foe = Math.random() < 0.7 && target.alive
          ? target
          : this.pickSome(foes.filter((item) => item.alive), 1)[0];
        if (!foe?.alive) return;
        this.faceToward(unit, foe.ship.x, foe.ship.y);
        this.fireWeapon(unit, foe.ship.x, foe.ship.y, { cosmetic: true });
        this.delay(480, () => {
          if (unit.alive) this.restFacing(unit);
        });
      });
    });

    if (target.alive && Math.random() < 0.4) {
      this.delay(160, () => {
        if (!target.alive || !attacker.alive || !this.isPlaying) return;
        this.faceToward(target, attacker.ship.x, attacker.ship.y);
        this.fireWeapon(target, attacker.ship.x, attacker.ship.y, { cosmetic: true });
      });
    }
  }

  private fireAmbientTracers() {
    if (this.skipActive || !this.isPlaying) return;
    const players = this.playerUnits.filter((unit) => unit.alive);
    const enemies = this.aiUnits.filter((unit) => unit.alive);
    if (players.length === 0 || enemies.length === 0) return;
    const fromPlayer = Math.random() < 0.5;
    const from = this.pickSome(fromPlayer ? players : enemies, 1)[0];
    const to = this.pickSome(fromPlayer ? enemies : players, 1)[0];
    if (!from || !to) return;
    this.faceToward(from, to.ship.x, to.ship.y);
    this.fireWeapon(from, to.ship.x, to.ship.y, { cosmetic: true });
    this.delay(380, () => {
      if (from.alive) this.restFacing(from);
    });
  }

  private pickSome<T>(list: T[], n: number): T[] {
    const copy = list.slice();
    const out: T[] = [];
    while (copy.length > 0 && out.length < n) {
      const index = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(index, 1)[0]);
    }
    return out;
  }

  private playImpact(target: Combatant, damage: number, isCrit: boolean, attackerClass = 0) {
    const knock = attackerClass === 2 ? 14 : attackerClass === 1 ? 9 : attackerClass === 3 ? 5 : 7;
    this.tweens.add({
      targets: target.ship,
      x: target.ship.x + (Math.random() * knock - knock / 2),
      y: target.ship.y - (attackerClass === 2 ? 7 : 4),
      duration: 50 * this.battleSpeedMultiplier,
      yoyo: true,
      ease: 'Sine.easeOut'
    });
    if (isCrit) {
      this.playCritBurst(target.ship.x, target.ship.y);
    }
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
    this.refreshSideLabels();
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
    const maxHp = target.maxHp || 100;
    const hp = Math.max(0, Number(remainingHp));
    target.currentHp = hp;
    const percent = Math.max(0, Math.min(1, hp / maxHp));

    target.hpBg.setAlpha(0.9);
    target.hpFill.setAlpha(0.95);
    target.hpFill.width = 56 * percent;

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
    if (this.skipActive) {
      return;
    }
    this.time.timeScale = 0.22;
    this.tweens.timeScale = 0.22;
    this.delay(ms, () => {
      this.time.timeScale = this.playbackTimeScale;
      this.tweens.timeScale = this.playbackTimeScale;
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
    this.fullBattleLog = [];
    this.battleLogTexts.forEach((entry) => entry.destroy());
    this.battleLogTexts = [];
    this.logPlate?.destroy();
    this.logPanel?.destroy();
    this.logTitle?.destroy();
    this.logContainer?.destroy();

    this.logPlate = this.add.image(960, 1008, 'ui_plate')
      .setDisplaySize(1180, 168)
      .setAlpha(0.82)
      .setDepth(878)
      .setScrollFactor(0);
    this.logPanel = this.add.rectangle(960, 1012, 1120, 136, 0x080d16, 0.5)
      .setStrokeStyle(1, 0x1f3a4d, 0.75)
      .setDepth(879)
      .setScrollFactor(0);
    this.logTitle = this.add.text(430, 938, 'COMBAT LOG', displayText({
      fontSize: '15px',
      color: HUD.color.gold,
      stroke: '#1a1020',
      strokeThickness: 3
    })).setOrigin(0, 0.5).setDepth(881).setScrollFactor(0);
    this.logContainer = this.add.container(430, 956).setDepth(880).setScrollFactor(0);
  }

  private setupBattleChrome() {
    this.maxRound = this.battleEvents.reduce(
      (max, event) => Math.max(max, Number(event.round) || 0),
      0
    );
    this.add.image(960, 42, 'ui_titlebar')
      .setDisplaySize(520, 64)
      .setAlpha(0.96)
      .setDepth(911)
      .setScrollFactor(0);
    this.roundHud = this.add.text(
      960,
      40,
      this.maxRound > 0 ? `ROUND 0 / ${this.maxRound}` : 'BATTLE',
      displayText({
        fontSize: '26px',
        color: HUD.color.gold,
        stroke: '#120818',
        strokeThickness: 5
      })
    ).setOrigin(0.5).setDepth(912).setScrollFactor(0);

    this.sideLabelPlayer = this.add.text(250, 128, 'YOUR FLEET', displayText({
      fontSize: '20px',
      color: '#9fd6ff',
      stroke: '#120818',
      strokeThickness: 4
    })).setOrigin(0.5).setDepth(860).setScrollFactor(0);

    this.sideLabelEnemy = this.add.text(1660, 128, 'VOID FLEET', displayText({
      fontSize: '20px',
      color: '#ff9aa8',
      stroke: '#120818',
      strokeThickness: 4
    })).setOrigin(0.5).setDepth(860).setScrollFactor(0);

    this.refreshSideLabels();
  }

  private updateRoundHud(round: number) {
    if (!this.roundHud) {
      return;
    }
    const total = this.maxRound || round;
    this.roundHud.setText(`ROUND ${round} / ${total}`);
  }

  private refreshSideLabels() {
    const playerAlive = this.playerUnits.filter((unit) => unit.alive).length;
    const aiAlive = this.aiUnits.filter((unit) => unit.alive).length;
    this.sideLabelPlayer?.setText(`YOUR FLEET  ${playerAlive}`);
    this.sideLabelEnemy?.setText(`VOID FLEET  ${aiAlive}`);
  }

  private pushLogLine(event: BattleEvent, damage: number, effect: string) {
    const attackers = event.isPlayerSide ? this.playerUnits : this.aiUnits;
    const defenders = event.isPlayerSide ? this.aiUnits : this.playerUnits;
    const attacker = attackers[event.attackerIndex];
    const target = defenders[event.targetIndex];
    const attackerName = `${this.getRarityName(attacker?.rarity ?? event.attackerRarity)} ${this.getClassName(attacker?.unitClass ?? event.attackerClass)}`;
    const targetName = `${this.getRarityName(target?.rarity ?? event.targetRarity)} ${this.getClassName(target?.unitClass ?? event.targetClass)}`;
    const side = event.isPlayerSide ? 'YOU' : 'VOID';
    const isKill = Number(event.remainingHp) <= 0 && effect !== 'DODGE';
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
    if (isKill) {
      color = event.isPlayerSide ? '#7dffc4' : '#ff6b88';
      suffix = `${suffix}  ·  DESTROYED`;
    }

    const line = `R${event.round}   ${side}   ${attackerName}  →  ${targetName}     ${suffix}`;
    this.addToLog(line, color);
  }

  private addToLog(text: string, color = '#d0d0ff') {
    this.fullBattleLog.push(text);
    const logText = this.add.text(0, -8, text, hudText({
      fontSize: '18px',
      color,
      stroke: '#0a0612',
      strokeThickness: 3
    })).setOrigin(0, 0).setDepth(882).setAlpha(0);

    this.battleLogTexts.unshift(logText);
    this.logContainer?.add(logText);
    this.battleLogTexts.forEach((entry, index) => {
      this.tweens.add({
        targets: entry,
        y: index * 22,
        alpha: index === 0 ? 1 : Math.max(0.28, 1 - index * 0.16),
        duration: 160,
        ease: 'Cubic.easeOut'
      });
    });

    if (this.battleLogTexts.length > 6) {
      const old = this.battleLogTexts.pop();
      if (old) {
        this.tweens.add({
          targets: old,
          alpha: 0,
          duration: 120,
          onComplete: () => old.destroy()
        });
      }
    }
  }

  private showEmptyState() {
    this.add.rectangle(960, 500, 760, 220, 0x080d16, 0.88)
      .setStrokeStyle(1, 0x5ee7ff, 0.3)
      .setDepth(919);
    this.add.text(960, 450, 'NO BATTLE DATA', displayText({
      fontSize: '32px',
      color: HUD.color.bad
    })).setOrigin(0.5).setDepth(920);
    this.add.text(960, 494, 'The fight never began.', hudText({
      fontSize: HUD.BODY,
      color: HUD.color.muted
    })).setOrigin(0.5).setDepth(920);

    const backBtn = this.add.image(960, 560, 'button_base')
      .setDisplaySize(280, 64)
      .setInteractive({ useHandCursor: true })
      .setDepth(920);
    this.add.text(960, 560, 'GO BACK', hudText({
      fontSize: '22px',
      color: '#ffffff'
    })).setOrigin(0.5).setDepth(921);
    backBtn.on('pointerdown', () => this.returnToPrepare());
  }

  private showFinalResult() {
    this.isPlaying = false;
    this.resultOpen = true;
    this.skipActive = false;
    this.playbackTimeScale = 1;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;

    const hudFade = [
      this.logPlate,
      this.logPanel,
      this.logTitle,
      this.logContainer,
      this.speedBtnBase,
      this.speedBtnText,
      this.skipBtnBase,
      this.skipBtnText,
      this.roundHud,
      this.sideLabelPlayer,
      this.sideLabelEnemy
    ].filter((obj) => !!obj);
    if (hudFade.length > 0) {
      this.tweens.add({
        targets: hudFade,
        alpha: 0,
        duration: 240,
        onComplete: () => {
          this.speedBtnBase?.disableInteractive();
          this.skipBtnBase?.disableInteractive();
        }
      });
    }

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

    if (this.playerWon) {
      gameAudio.victory();
    } else {
      gameAudio.defeat();
    }
    const account = window.account as string | undefined;
    if (account) {
      const unlocked = [
        unlockAchievement(account, 'first_battle'),
        this.playerWon ? unlockAchievement(account, 'first_blood') : null
      ].filter(Boolean);
      if (unlocked.length > 0) {
        showAchievementToasts(this, unlocked as any);
      }
    }
    const title = this.playerWon ? 'VICTORY' : 'DEFEAT';
    const color = this.playerWon ? '#5dffb0' : '#ff4d6d';
    const playerAlive = this.playerUnits.filter((unit) => unit.alive).length;
    const aiAlive = this.aiUnits.filter((unit) => unit.alive).length;
    const playerTotal = Math.max(this.playerUnits.length, 1);
    const aiTotal = Math.max(this.aiUnits.length, 1);
    const lastRound = this.battleEvents.length > 0
      ? Number(this.battleEvents[this.battleEvents.length - 1].round) || 0
      : 0;
    const playerKills = this.battleEvents.filter(
      (event) => event.isPlayerSide && Number(event.remainingHp) <= 0
    ).length;
    const aiKills = this.battleEvents.filter(
      (event) => !event.isPlayerSide && Number(event.remainingHp) <= 0
    ).length;
    const subtitle = playerAlive > 0 && aiAlive > 0
      ? (this.playerWon ? 'Timeout: your fleet held more HP' : 'Timeout: enemy held more HP')
      : (this.playerWon ? `${playerAlive} ships remaining` : `${aiAlive} enemy ships remaining`);
    const statsLine = `YOUR FLEET  ${playerAlive}/${playerTotal}     ENEMY  ${aiAlive}/${aiTotal}     ROUNDS  ${lastRound}     KILLS  ${playerKills}–${aiKills}`;

    const veil = this.add.rectangle(960, 540, 1920, 1080, 0x050010, 0)
      .setDepth(930)
      .setScrollFactor(0);
    this.tweens.add({ targets: veil, alpha: 0.52, duration: 500 });

    const plate = this.add.image(960, 248, 'ui_result')
      .setDisplaySize(1040, 400)
      .setAlpha(0)
      .setDepth(934)
      .setScrollFactor(0);
    this.tweens.add({ targets: plate, alpha: 0.97, duration: 360 });

    const result = this.add.text(960, 148, title, displayText({
      fontSize: '72px',
      color,
      stroke: '#120818',
      strokeThickness: 8
    })).setOrigin(0.5).setDepth(940).setScrollFactor(0).setAlpha(0).setScale(0.7);

    this.tweens.add({
      targets: result,
      alpha: 1,
      scale: 1,
      duration: 520,
      ease: 'Back.easeOut'
    });

    const subtitleText = this.add.text(960, 214, subtitle, hudText({
      fontSize: '24px',
      color: '#d8e6f4',
      stroke: '#120818',
      strokeThickness: 3
    })).setOrigin(0.5).setDepth(940).setScrollFactor(0).setAlpha(0);

    const chipSpecs = [
      { label: 'YOUR FLEET', value: `${playerAlive}/${playerTotal}` },
      { label: 'ENEMY', value: `${aiAlive}/${aiTotal}` },
      { label: 'ROUNDS', value: `${lastRound}` },
      { label: 'KILLS', value: `${playerKills}–${aiKills}` }
    ];
    const chipWidth = 200;
    const chipGap = 18;
    const chipsWidth = chipSpecs.length * chipWidth + (chipSpecs.length - 1) * chipGap;
    const chipStart = 960 - chipsWidth / 2 + chipWidth / 2;
    const chips: Phaser.GameObjects.GameObject[] = [];
    chipSpecs.forEach((chip, index) => {
      const x = chipStart + index * (chipWidth + chipGap);
      const bg = this.add.rectangle(x, 268, chipWidth, 52, 0x0c1420, 0.78)
        .setStrokeStyle(1, 0x2ec7d6, 0.28)
        .setDepth(940)
        .setScrollFactor(0)
        .setAlpha(0);
      const caption = this.add.text(x, 256, chip.label, hudText({
        fontSize: '13px',
        color: HUD.color.muted
      })).setOrigin(0.5).setDepth(941).setScrollFactor(0).setAlpha(0);
      const value = this.add.text(x, 278, chip.value, displayText({
        fontSize: '20px',
        color: HUD.color.gold
      })).setOrigin(0.5).setDepth(941).setScrollFactor(0).setAlpha(0);
      chips.push(bg, caption, value);
    });

    const recap = this.fullBattleLog.slice(-2).join('\n') || statsLine;
    const recapText = this.add.text(960, 318, recap, hudText({
      fontSize: '16px',
      color: '#9bb0c4',
      align: 'center',
      wordWrap: { width: 860 }
    })).setOrigin(0.5).setDepth(940).setScrollFactor(0).setAlpha(0);

    this.tweens.add({
      targets: [subtitleText, recapText, ...chips],
      alpha: 1,
      duration: 360,
      delay: 180
    });

    const btn = this.add.image(960, 378, 'button_base')
      .setDisplaySize(280, 64)
      .setInteractive({ useHandCursor: true })
      .setDepth(941)
      .setScrollFactor(0)
      .setAlpha(0);
    const btnText = this.add.text(960, 378, 'GO BACK', hudText({
      fontSize: '22px',
      color: '#ffffff'
    })).setOrigin(0.5).setDepth(942).setScrollFactor(0).setAlpha(0);

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
    const walletManager = window.walletManager;
    if (walletManager) {
      walletManager.restoreFromWindow();
    }
    this.scene.start('PrepareScene', {
      account: window.account,
      publicClient: window.publicClient,
      walletClient: window.walletClient,
      walletManager,
      savedTeam: [...this.savedTeam],
      lastBattleResult: {
        won: this.playerWon,
        playerAlive: this.playerUnits.filter((unit) => unit.alive).length,
        aiAlive: this.aiUnits.filter((unit) => unit.alive).length
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------------------

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
    return rarityName(Number(rarity) || 0);
  }

  private getClassName(unitClass?: number): string {
    return className(Number(unitClass) || 0);
  }

  private delay(ms: number, fn: () => void, scaleWithBattle = true) {
    const scale = Math.max(0.001, this.time.timeScale || 1);
    const wait = scaleWithBattle ? ms : ms * scale;
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
    this.vfx?.destroy();
    this.vfx = null;

    this.destroyCombatants(this.playerUnits);
    this.destroyCombatants(this.aiUnits);
    this.playerUnits = [];
    this.aiUnits = [];

    this.plasmaEmitter?.destroy();
    this.debrisEmitter?.destroy();
    this.critEmitter?.destroy();
    this.victoryEmitter?.destroy();
    this.plasmaEmitter = null;
    this.debrisEmitter = null;
    this.critEmitter = null;
    this.victoryEmitter = null;

    this.battleLogTexts.forEach((entry) => entry.destroy());
    this.battleLogTexts = [];
    this.logContainer?.destroy();
    this.logContainer = null;
    this.logTitle?.destroy();
    this.logTitle = null;
    this.logPanel?.destroy();
    this.logPanel = null;
    this.logPlate?.destroy();
    this.logPlate = null;
    this.roundHud?.destroy();
    this.roundHud = null;
    this.sideLabelPlayer?.destroy();
    this.sideLabelPlayer = null;
    this.sideLabelEnemy?.destroy();
    this.sideLabelEnemy = null;

    this.overlay?.destroy();
    this.overlay = null;
    this.speedBtnBase?.destroy();
    this.speedBtnBase = null;
    this.speedBtnText?.destroy();
    this.speedBtnText = null;
    this.skipBtnBase?.destroy();
    this.skipBtnBase = null;
    this.skipBtnText?.destroy();
    this.skipBtnText = null;
    this.resultOpen = false;
    this.input.keyboard?.off('keydown-SPACE');
    this.input.keyboard?.off('keydown-ESC');
    this.input.keyboard?.off('keydown-ENTER');

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
