// frontend/src/scenes/BattleScene.ts
// Phaser HUD + Three.js battle world. Contract data-flow is unchanged.

import Phaser from 'phaser';
import { HUD, displayText, hudText, rarityName } from '../utils/HudChrome';
import { gameAudio } from '../lib/gameAudio';
import { unlockAchievement, type AchievementDef } from '../lib/achievements';
import { beginOrResumeTutorial, clearTutorialCard, showAchievementToasts } from '../utils/MetaHud';
import { classVisual, eventBeatMs, factionVisual } from '../utils/battleCatalog';
import type { BattleEvent, BattleInitData, UnitData } from '../utils/battleTypes';
import { BattleWorld } from '../battle3d/BattleWorld';

interface Combatant {
  id: string;
  isPlayer: boolean;
  slot: number;
  faction: number;
  unitClass: number;
  rarity: number;
  maxHp: number;
  currentHp: number;
  alive: boolean;
  hpGfx: Phaser.GameObjects.Graphics;
}

const PLAYBACK_SCALE_NORMAL = 1;
const PLAYBACK_SCALE_FAST = 2;
const PLAYBACK_SCALE_SKIP = 3.4;

export default class BattleScene extends Phaser.Scene {
  private battleEvents: BattleEvent[] = [];
  private playerWon = false;
  private playerMaxHp: number[] = [];
  private aiMaxHp: number[] = [];
  private playerUnitsData: UnitData[] = [];
  private aiUnitsData: UnitData[] = [];

  private playerUnits: Combatant[] = [];
  private aiUnits: Combatant[] = [];

  private currentEventIndex = 0;
  private battleLogTexts: Phaser.GameObjects.Text[] = [];
  private fullBattleLog: string[] = [];
  private logContainer: Phaser.GameObjects.Container | null = null;
  private logTitle: Phaser.GameObjects.Text | null = null;
  private logPanel: Phaser.GameObjects.Rectangle | null = null;
  private logPlate: Phaser.GameObjects.Image | null = null;
  private playbackTimeScale = PLAYBACK_SCALE_NORMAL;
  private skipActive = false;
  private speedFast = false;
  private isPlaying = false;
  private resultOpen = false;
  private leaving = false;
  private maxRound = 0;
  private roundHud: Phaser.GameObjects.Text | null = null;
  private sideLabelPlayer: Phaser.GameObjects.Text | null = null;
  private sideLabelEnemy: Phaser.GameObjects.Text | null = null;

  private speedBtnBase: Phaser.GameObjects.Image | null = null;
  private speedBtnText: Phaser.GameObjects.Text | null = null;
  private skipBtnBase: Phaser.GameObjects.Image | null = null;
  private skipBtnText: Phaser.GameObjects.Text | null = null;
  private pendingTimers: Phaser.Time.TimerEvent[] = [];
  private savedTeam: number[] = [];
  private world: BattleWorld | null = null;

  constructor() {
    super({ key: 'BattleScene' });
  }

  init(data: BattleInitData) {
    this.battleEvents = data.events || [];
    this.playerWon = data.playerWon || false;
    this.playerMaxHp = data.playerMaxHp || [];
    this.aiMaxHp = data.aiMaxHp || [];
    this.playerUnitsData = data.playerUnitsData || [];
    this.aiUnitsData = data.aiUnitsData || [];
    this.savedTeam = Array.isArray(data.savedTeam) ? data.savedTeam.map((id) => Number(id)) : [];
    this.currentEventIndex = 0;
    this.isPlaying = false;
    this.skipActive = false;
    this.speedFast = false;
    this.playbackTimeScale = PLAYBACK_SCALE_NORMAL;
    this.resultOpen = false;
    this.leaving = false;
    this.maxRound = 0;
    this.fullBattleLog = [];
    this.battleLogTexts = [];
  }

  preload() {
    this.load.image('button_base', 'assets/button_base.png');
    this.load.image('ui_titlebar', 'assets/ui/ui_titlebar.png');
    this.load.image('ui_plate', 'assets/ui/ui_plate.png');
    this.load.image('ui_result', 'assets/ui/ui_result.png');
  }

  create() {
    this.shutdownCleanup();
    this.cameras.main.setBackgroundColor({ r: 0, g: 0, b: 0, a: 0 });
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(960, 540);
    this.game.canvas.style.background = 'transparent';
    this.game.canvas.style.zIndex = '1';

    this.world = new BattleWorld();
    this.createSpeedButton();
    this.createSkipButton();
    this.applyPlaybackRate();
    this.setupBattleLog();
    this.setupBattleChrome();
    gameAudio.unlock();
    void this.bootWorld();
  }

  private async bootWorld() {
    if (!this.world) {
      return;
    }
    await this.world.mount(this.game.canvas);
    if (this.leaving || !this.world) {
      return;
    }
    this.setupTeams();
    this.refreshSideLabels();
    const account = window.account;
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

  update(_time: number, delta: number) {
    this.world?.tick(delta);
    this.syncHealthBars(this.playerUnits);
    this.syncHealthBars(this.aiUnits);
  }

  private setupTeams() {
    this.destroyCombatants(this.playerUnits);
    this.destroyCombatants(this.aiUnits);
    this.playerUnits = [];
    this.aiUnits = [];
    if (!this.world) {
      return;
    }

    const playerCount = Math.min(8, Math.max(this.playerUnitsData.length, this.playerMaxHp.length));
    for (let i = 0; i < playerCount; i++) {
      const unit = this.playerUnitsData[i] || { faction: 0, unitClass: 0 };
      this.playerUnits.push(this.makeCombatant(true, i, unit, this.playerMaxHp[i] || 100));
    }

    const aiCount = Math.min(8, this.aiUnitsData.length, this.aiMaxHp.length);
    for (let i = 0; i < aiCount; i++) {
      const unit = this.aiUnitsData[i] || { faction: 1, unitClass: 0 };
      this.aiUnits.push(this.makeCombatant(false, i, unit, this.aiMaxHp[i] || 100));
    }
  }

  private makeCombatant(isPlayer: boolean, slot: number, unit: UnitData, maxHp: number): Combatant {
    const faction = Number(unit.faction ?? 0);
    const unitClass = Number(unit.unitClass ?? 0);
    const spawned = this.world?.spawn(isPlayer, slot, faction, unitClass);
    const hpGfx = this.add.graphics().setDepth(860).setScrollFactor(0);
    const combatant: Combatant = {
      id: spawned?.id || `${isPlayer ? 'p' : 'a'}-${slot}`,
      isPlayer,
      slot,
      faction,
      unitClass,
      rarity: Number(unit.rarity ?? 0),
      maxHp,
      currentHp: maxHp,
      alive: true,
      hpGfx
    };
    this.drawHealth(combatant);
    return combatant;
  }

  private syncHealthBars(units: Combatant[]) {
    for (const unit of units) {
      const screen = this.world?.project(unit.id);
      if (!screen || !unit.alive) {
        if (!unit.alive) {
          unit.hpGfx.clear();
        }
        continue;
      }
      unit.hpGfx.setPosition(screen.x, screen.y + 22);
    }
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
    this.world?.setTimeScale(this.playbackTimeScale);
  }

  private processNextEvent() {
    if (!this.isPlaying) {
      return;
    }
    if (this.currentEventIndex >= this.battleEvents.length) {
      this.showFinalResult();
      return;
    }

    const event = this.battleEvents[this.currentEventIndex];
    this.currentEventIndex += 1;
    this.updateRoundHud(Number(event.round) || 0);
    this.animateEvent(event);

    const attackers = event.isPlayerSide ? this.playerUnits : this.aiUnits;
    const attacker = attackers[event.attackerIndex];
    const kill = Number(event.remainingHp) <= 0 && event.specialEffect !== 'DODGE';
    const crit = event.specialEffect === 'CRIT';
    this.delay(eventBeatMs(attacker?.unitClass ?? 0, kill, crit), () => this.processNextEvent());
  }

  private animateEvent(event: BattleEvent) {
    const attackers = event.isPlayerSide ? this.playerUnits : this.aiUnits;
    const defenders = event.isPlayerSide ? this.aiUnits : this.playerUnits;
    const attacker = attackers[event.attackerIndex];
    const target = defenders[event.targetIndex];
    if (!attacker || !target || !this.world) {
      return;
    }

    const dmg = Number(event.damageDealt) || 0;
    const effect = event.specialEffect || '';
    const isCrit = effect === 'CRIT';
    const isDodge = effect === 'DODGE';
    const isLastStand = effect === 'Last Stand';
    const vis = classVisual(attacker.unitClass);

    this.world.playAttack(attacker.id, target.id, {
      crit: isCrit,
      onHit: () => {
        const screen = this.world?.project(target.id);
        const sx = screen?.x ?? 960;
        const sy = (screen?.y ?? 540) - 28;
        if (isDodge) {
          gameAudio.dodge();
          this.world?.playDodge(target.id, attacker.id);
          this.spawnFloatingText(sx, sy, 'DODGE', '#7ad7ff', 30);
        } else {
          if (event.remainingHp > 0) {
            this.world?.playImpact(target.id, attacker.id, vis.shot === 'slug', isCrit);
          }
          this.updateHealthBar(target, event.remainingHp);
          if (dmg > 0) {
            if (Number(event.remainingHp) > 0 && !isLastStand) {
              gameAudio.hit(isCrit);
            }
            this.spawnDamageNumber(sx, sy, dmg, isCrit);
          }
          if (isLastStand && event.remainingHp > 0) {
            gameAudio.lastStand();
            this.world?.playLastStand(target.id);
            const account = window.account;
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
      }
    });
  }

  private killCombatant(target: Combatant) {
    if (!target.alive) {
      return;
    }
    target.alive = false;
    this.world?.kill(target.id);
    target.hpGfx.clear();
    this.refreshSideLabels();
  }

  private drawHealth(unit: Combatant) {
    const percent = Math.max(0, Math.min(1, unit.currentHp / Math.max(1, unit.maxHp)));
    let color = unit.isPlayer ? 0x5dffb0 : 0xff6b7d;
    if (percent < 0.3) {
      color = 0xff4455;
    } else if (percent < 0.6) {
      color = 0xffcc44;
    }
    const g = unit.hpGfx;
    g.clear();
    g.fillStyle(0x0a0610, 0.88);
    g.fillRoundedRect(-34, -5, 68, 10, 3);
    g.lineStyle(1, factionVisual(unit.faction).glow, 0.55);
    g.strokeRoundedRect(-34, -5, 68, 10, 3);
    if (percent > 0) {
      g.fillStyle(color, 1);
      g.fillRoundedRect(-32, -3, 64 * percent, 6, 2);
    }
  }

  private updateHealthBar(target: Combatant, remainingHp: number) {
    target.currentHp = Math.max(0, Number(remainingHp));
    this.drawHealth(target);
  }

  private spawnDamageNumber(x: number, y: number, damage: number, isCrit: boolean) {
    const text = this.add.text(x, y, isCrit ? `CRIT -${damage}` : `-${damage}`, {
      fontSize: isCrit ? '42px' : '32px',
      color: isCrit ? '#ffe566' : '#ff5a5a',
      fontStyle: 'bold',
      stroke: isCrit ? '#7a4a00' : '#2a0008',
      strokeThickness: isCrit ? 6 : 4
    }).setOrigin(0.5).setDepth(500).setScale(0.5).setScrollFactor(0);

    this.tweens.add({
      targets: text,
      y: y - 78,
      alpha: 0,
      scale: isCrit ? 1.12 : 1,
      duration: 560,
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
    }).setOrigin(0.5).setDepth(500).setScale(0.7).setScrollFactor(0);

    this.tweens.add({
      targets: text,
      y: y - 56,
      alpha: 0,
      scale: 1.02,
      duration: 460,
      onComplete: () => text.destroy()
    });
  }

  private setupBattleLog() {
    this.fullBattleLog = [];
    this.battleLogTexts.forEach((entry) => entry.destroy());
    this.battleLogTexts = [];
    this.logPlate?.destroy();
    this.logPanel?.destroy();
    this.logTitle?.destroy();
    this.logContainer?.destroy();

    this.logPlate = this.add.image(960, 1024, 'ui_plate')
      .setDisplaySize(1040, 112)
      .setAlpha(0.72)
      .setDepth(878)
      .setScrollFactor(0);
    this.logPanel = this.add.rectangle(960, 1026, 980, 84, 0x080d16, 0.42)
      .setStrokeStyle(1, 0x1f3a4d, 0.6)
      .setDepth(879)
      .setScrollFactor(0);
    this.logTitle = this.add.text(470, 984, 'COMBAT LOG', displayText({
      fontSize: '13px',
      color: HUD.color.gold,
      stroke: '#1a1020',
      strokeThickness: 3
    })).setOrigin(0, 0.5).setDepth(881).setScrollFactor(0);
    this.logContainer = this.add.container(470, 996).setDepth(880).setScrollFactor(0);
  }

  private setupBattleChrome() {
    this.maxRound = this.battleEvents.reduce(
      (max, event) => Math.max(max, Number(event.round) || 0),
      0
    );
    this.add.image(960, 42, 'ui_titlebar')
      .setDisplaySize(460, 58)
      .setAlpha(0.94)
      .setDepth(911)
      .setScrollFactor(0);
    this.roundHud = this.add.text(
      960,
      40,
      this.maxRound > 0 ? `ROUND 0 / ${this.maxRound}` : 'BATTLE',
      displayText({
        fontSize: '24px',
        color: HUD.color.gold,
        stroke: '#120818',
        strokeThickness: 5
      })
    ).setOrigin(0.5).setDepth(912).setScrollFactor(0);

    this.sideLabelPlayer = this.add.text(250, 118, 'YOUR FLEET', displayText({
      fontSize: '18px',
      color: '#9fd6ff',
      stroke: '#120818',
      strokeThickness: 4
    })).setOrigin(0.5).setDepth(860).setScrollFactor(0);

    this.sideLabelEnemy = this.add.text(1670, 118, 'VOID FLEET', displayText({
      fontSize: '18px',
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
    const attackerName = `${rarityName(attacker?.rarity ?? event.attackerRarity ?? 0)} ${classVisual(attacker?.unitClass ?? event.attackerClass ?? 0).display}`;
    const targetName = `${rarityName(target?.rarity ?? event.targetRarity ?? 0)} ${classVisual(target?.unitClass ?? event.targetClass ?? 0).display}`;
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
    this.addToLog(`R${event.round}   ${side}   ${attackerName}  →  ${targetName}     ${suffix}`, color);
  }

  private addToLog(text: string, color = '#d0d0ff') {
    this.fullBattleLog.push(text);
    const logText = this.add.text(0, -8, text, hudText({
      fontSize: '16px',
      color,
      stroke: '#0a0612',
      strokeThickness: 3
    })).setOrigin(0, 0).setDepth(882).setAlpha(0);

    this.battleLogTexts.unshift(logText);
    this.logContainer?.add(logText);
    this.battleLogTexts.forEach((entry, index) => {
      this.tweens.add({
        targets: entry,
        y: index * 18,
        alpha: index === 0 ? 1 : Math.max(0.28, 1 - index * 0.22),
        duration: 140,
        ease: 'Cubic.easeOut'
      });
    });

    if (this.battleLogTexts.length > 4) {
      const old = this.battleLogTexts.pop();
      if (old) {
        this.tweens.add({
          targets: old,
          alpha: 0,
          duration: 100,
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
    this.mountGoBackButton(960, 560, 920);
  }

  private showFinalResult() {
    if (this.resultOpen || this.leaving) {
      return;
    }
    this.isPlaying = false;
    this.resultOpen = true;
    this.skipActive = false;
    this.playbackTimeScale = 1;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.world?.setTimeScale(1);
    this.world?.dimForResult();
    clearTutorialCard(this);

    const hudFade: Phaser.GameObjects.GameObject[] = [
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
    ].filter((obj): obj is NonNullable<typeof obj> => obj !== null);
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

    if (this.playerWon) {
      gameAudio.victory();
    } else {
      gameAudio.defeat();
    }
    const account = window.account;
    if (account) {
      const unlocked: AchievementDef[] = [
        unlockAchievement(account, 'first_battle'),
        this.playerWon ? unlockAchievement(account, 'first_blood') : null
      ].filter((item): item is AchievementDef => item !== null);
      if (unlocked.length > 0) {
        showAchievementToasts(this, unlocked);
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
      (event) => event.isPlayerSide && Number(event.remainingHp) <= 0 && event.specialEffect !== 'DODGE'
    ).length;
    const aiKills = this.battleEvents.filter(
      (event) => !event.isPlayerSide && Number(event.remainingHp) <= 0 && event.specialEffect !== 'DODGE'
    ).length;
    const subtitle = playerAlive > 0 && aiAlive > 0
      ? (this.playerWon ? 'Timeout: your fleet held more HP' : 'Timeout: enemy held more HP')
      : (this.playerWon ? `${playerAlive} ships remaining` : `${aiAlive} enemy ships remaining`);
    const statsLine = `YOUR FLEET  ${playerAlive}/${playerTotal}     ENEMY  ${aiAlive}/${aiTotal}     ROUNDS  ${lastRound}     KILLS  ${playerKills}–${aiKills}`;

    const veil = this.add.rectangle(960, 540, 1920, 1080, 0x050010, 0)
      .setDepth(930)
      .setScrollFactor(0)
      .setInteractive();
    this.tweens.add({ targets: veil, alpha: 0.42, duration: 500 });
    veil.on('pointerdown', () => this.returnToPrepare());

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

    this.mountGoBackButton(960, 378, 941);
  }

  private mountGoBackButton(x: number, y: number, depth: number) {
    this.add.image(x, y, 'button_base')
      .setDisplaySize(280, 64)
      .setDepth(depth)
      .setScrollFactor(0);
    const btnText = this.add.text(x, y, 'GO BACK', hudText({
      fontSize: '22px',
      color: '#ffffff'
    })).setOrigin(0.5).setDepth(depth + 1).setScrollFactor(0);
    const hit = this.add.zone(x, y, 300, 80)
      .setDepth(depth + 2)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.returnToPrepare());
    btnText.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.returnToPrepare());
  }

  private returnToPrepare() {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    this.isPlaying = false;
    this.resultOpen = true;
    const playerAlive = this.playerUnits.filter((unit) => unit.alive).length;
    const aiAlive = this.aiUnits.filter((unit) => unit.alive).length;
    const savedTeam = [...this.savedTeam];
    const won = this.playerWon;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.world?.dispose();
    this.world = null;
    const walletManager = window.walletManager;
    if (walletManager) {
      walletManager.restoreFromWindow();
    }
    this.scene.start('PrepareScene', {
      account: window.account,
      publicClient: window.publicClient,
      walletClient: window.walletClient,
      walletManager,
      savedTeam,
      lastBattleResult: {
        won,
        playerAlive,
        aiAlive
      }
    });
  }

  private delay(ms: number, fn: () => void) {
    const timer = this.time.delayedCall(ms, fn);
    this.pendingTimers.push(timer);
    return timer;
  }

  private destroyCombatants(units: Combatant[]) {
    for (const unit of units) {
      unit.hpGfx?.destroy();
    }
  }

  private shutdownCleanup() {
    this.isPlaying = false;
    this.world?.dispose();
    this.world = null;
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.pendingTimers.forEach((timer) => timer.remove(false));
    this.pendingTimers = [];

    this.destroyCombatants(this.playerUnits);
    this.destroyCombatants(this.aiUnits);
    this.playerUnits = [];
    this.aiUnits = [];

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
