// @ts-nocheck

// frontend/src/scenes/BattleScene.ts
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

export default class BattleScene extends Phaser.Scene {
  private battleEvents: BattleEvent[] = [];
  private playerWon = false;
  private playerMaxHp: number[] = [];
  private aiMaxHp: number[] = [];
  private playerUnitsData: any[] = [];
  private aiUnitsData: any[] = [];

  private playerShips: Phaser.GameObjects.Sprite[] = [];
  private aiShips: Phaser.GameObjects.Sprite[] = [];
  private playerShadows: Phaser.GameObjects.Sprite[] = [];
  private aiShadows: Phaser.GameObjects.Sprite[] = [];
  private playerHPLabels: Phaser.GameObjects.Text[] = [];
  private aiHPLabels: Phaser.GameObjects.Text[] = [];

  private currentEventIndex = 0;
  private battleLogTexts: Phaser.GameObjects.Text[] = [];
  private fullBattleLog: string[] = [];
  private logContainer: Phaser.GameObjects.Container | null = null;
  private currentRoundText: Phaser.GameObjects.Text | null = null;
  private battleSpeedMultiplier = 1;   // 1 = нормально, 0.5 = x2

  private backgroundLayers: Phaser.GameObjects.Image[] = [];

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
  }

  preload() {
    this.load.image('stars', 'assets/background/stars.png');
    this.load.image('nebula_mid', 'assets/background/nebula_mid.png');
    this.load.image('nebula_close', 'assets/background/nebula_close.png');

    this.load.image('laser_blue', 'assets/effects/laser_blue.png');
    this.load.image('laser_red', 'assets/effects/laser_red.png');

    for (let i = 1; i <= 6; i++) {
      this.load.image(`explosion_${i.toString().padStart(2, '0')}`, `assets/effects/explosion_${i.toString().padStart(2, '0')}.png`);
    }

    // === ТОЧНЫЕ ИМЕНА КОРАБЛЕЙ ===
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
    // === УНИЧТОЖЕННЫЕ ВЕРСИИ КОРАБЛЕЙ ===
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

    // Новая платформа с гридом
    this.load.image('arena_platform', 'assets/background/arena_platform.png');
  }

create() {
  this.shutdownCleanup();
  this.createParallaxBackground();
  this.createArenaPlatform();

  this.add.rectangle(960, 540, 1920, 1080, 0x050010).setAlpha(0.22);

  // === X2 / X1 кнопка (правый верхний угол) ===
  const speedBtnBase = this.add.image(1820, 55, 'button_base')
    .setDisplaySize(78, 48)
    .setInteractive()
    .setDepth(200);

  const speedBtnText = this.add.text(1820, 55, 'x2', {
    fontSize: '26px', color: '#ffffff', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(201);

  (speedBtnBase as any).linkedText = speedBtnText;

  speedBtnBase.on('pointerdown', () => {
    if (this.battleSpeedMultiplier === 1) {
      this.battleSpeedMultiplier = 0.5;
      speedBtnText.setText('x1');
      speedBtnText.setFill('#ffff00');
    } else {
      this.battleSpeedMultiplier = 1;
      speedBtnText.setText('x2');
      speedBtnText.setFill('#ffffff');
    }
  });

  this.setupTeams();
  this.setupBattleLog();

  if (this.battleEvents.length === 0) {
    this.showFinalResult();
  } else {
    this.currentEventIndex = 0;
    this.processNextEvent();
  }
  // === Полная рамка сцены ===
this.add.image(960, 540, 'outer_frame')
  .setDisplaySize(1920, 1080)
  .setDepth(300);
}


  private createParallaxBackground() {
    const w = this.scale.width;
    const h = this.scale.height;

    const stars = this.add.image(w / 2, h / 2, 'stars')
      .setDisplaySize(w, h)
      .setDepth(0)
      .setScrollFactor(0.05);
    this.backgroundLayers.push(stars);

    const nebulaMid = this.add.image(w / 2, h / 2, 'nebula_mid')
      .setDisplaySize(w * 1.5, h * 1.5)
      .setAlpha(0.48)
      .setScrollFactor(0.22)
      .setDepth(1);
    this.backgroundLayers.push(nebulaMid);

    const nebulaClose = this.add.image(w / 2, h / 2, 'nebula_close')
      .setDisplaySize(w, h)
      .setAlpha(0.32)
      .setScrollFactor(0.5)
      .setDepth(2);
    this.backgroundLayers.push(nebulaClose);
    // === Дыхание космоса (живой эффект) ===
this.tweens.add({
  targets: nebulaMid,
  scaleX: 1.022,
  scaleY: 1.022,
  duration: 48000,
  yoyo: true,
  repeat: -1,
  ease: 'Sine.easeInOut'
});
// === Очень-очень медленное движение звёзд ===
this.tweens.add({
  targets: stars,
  x: '+=12',
  y: '+=7',
  duration: 52000,
  yoyo: true,
  repeat: -1,
  ease: 'Linear'
});

  }

private createArenaPlatform() {
  const platform = this.add.image(960, 540, 'arena_platform')
    .setDisplaySize(1920, 1080)
    .setDepth(5)
    .setAlpha(0.88);
}

private setupTeams() {
  this.playerShips = []; this.aiShips = [];
  this.playerShadows = []; this.aiShadows = [];
  this.playerHPLabels = []; this.aiHPLabels = [];   // ← переиспользуем массив под health bars

  const barWidth = 52;
  const barHeight = 5;

  // === Игрок ===
  const playerBaseX = 470;
  const playerBaseY = 385;
  const playerRowShiftX = 20;
  const playerSpacingY = 118;
  const playerColSpacing = 122;

  for (let i = 0; i < Math.min(8, this.playerMaxHp.length); i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const depthFactor = row * 0.10;

    let x = playerBaseX + (3 - row) * playerRowShiftX + col * playerColSpacing;
    if (col === 0) x -= 40;
    if (col === 1) x += 18;

    const y = playerBaseY + row * playerSpacingY + depthFactor * 28;

    const unit = this.playerUnitsData[i] || { faction: 0, unitClass: 0 };
    const key = this.getShipKey(unit.faction, unit.unitClass);
    const baseScale = 0.545 - depthFactor * 0.05;

    const ship = this.add.sprite(x, y, key)
      .setScale(baseScale)
      .setDepth(y)
      .setFlipX(true);

    const shadow = this.add.sprite(x + 9, y + 22, key)
      .setScale(baseScale * 0.52)
      .setAlpha(0.26).setTint(0x000000).setDepth(y - 1)
      .setFlipX(true);
    this.playerShadows.push(shadow);

    this.playerShips.push(ship);

    // === Health Bar (поверх корабля) ===
    const barY = y - 42;
    const barBg = this.add.rectangle(x, barY, 52, 5, 0x222222)
      .setDepth(y + 20)
      .setVisible(false);
    const barFill = this.add.rectangle(x, barY, 52, 5, 0x00ff88)
      .setDepth(y + 21)
      .setVisible(false);

    (barFill as any).bg = barBg;
    (barFill as any).maxHp = this.playerMaxHp[i] || 100;
    this.playerHPLabels.push(barFill);

    this.tweens.add({
      targets: ship, y: y - 3, scale: ship.scaleX * 1.015,
      duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
  }

  // === ИИ ===
  const aiBaseX = 1410;
  const aiBaseY = 385;
  const aiRowShiftX = 28;
  const aiSpacingY = 118;
  const aiColSpacing = 122;

  for (let i = 0; i < Math.min(8, this.aiMaxHp.length); i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const depthFactor = row * 0.10;

    let x = aiBaseX - (3 - row) * aiRowShiftX + col * aiColSpacing;
    if (col === 0) x -= 18;
    if (col === 1) x += 40;

    const y = aiBaseY + row * aiSpacingY + depthFactor * 28;

    const unit = this.aiUnitsData[i] || { faction: 1, unitClass: 0 };
    const key = this.getShipKey(unit.faction, unit.unitClass);
    const baseScale = 0.545 - depthFactor * 0.05;

    const ship = this.add.sprite(x, y, key)
      .setScale(baseScale)
      .setDepth(y)
      .setFlipX(false);

    const shadow = this.add.sprite(x + 9, y + 22, key)
      .setScale(baseScale * 0.52)
      .setAlpha(0.26).setTint(0x000000).setDepth(y - 1)
      .setFlipX(false);
    this.aiShadows.push(shadow);

    this.aiShips.push(ship);

    // === Health Bar (поверх корабля) ===
    const barY = y - 42;
    const barBg = this.add.rectangle(x, barY, 52, 5, 0x222222)
      .setDepth(y + 20)
      .setVisible(false);
    const barFill = this.add.rectangle(x, barY, 52, 5, 0xff6666)
      .setDepth(y + 21)
      .setVisible(false);

    (barFill as any).bg = barBg;
    (barFill as any).maxHp = this.aiMaxHp[i] || 100;
    this.aiHPLabels.push(barFill);
    
    this.tweens.add({
      targets: ship, y: y - 3, scale: ship.scaleX * 1.015,
      duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
  }
}


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
      '2_3': 'mechanoid_droneswarm',
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
    '2_3': 'mechanoid_droneswarm_destroyed',
  };
  return map[`${faction}_${unitClass}`] || null;
}


private setupBattleLog() {
  this.logContainer = this.add.container(960, 915);
  this.add.text(960, 890, 'BATTLE LOG', {
    fontSize: '24px', color: '#ffff00', fontStyle: 'bold'
  }).setOrigin(0.5);
}


  private addToLog(text: string, color = '#d0d0ff') {
    this.fullBattleLog.push(text);
    const logText = this.add.text(0, 0, text, {
      fontSize: '16px', color, wordWrap: { width: 1480 }, align: 'center'
    }).setOrigin(0.5, 0);

    this.battleLogTexts.unshift(logText);
    this.logContainer?.add(logText);
    this.battleLogTexts.forEach((t, i) => t.y = i * 26);

    if (this.battleLogTexts.length > 7) {
      const old = this.battleLogTexts.pop();
      old?.destroy();
    }
  }

private processNextEvent() {
  if (this.currentEventIndex >= this.battleEvents.length) {
    this.showFinalResult();
    return;
  }
  const event = this.battleEvents[this.currentEventIndex];
  this.animateEvent(event);
  this.currentEventIndex++;

  const delay = 1300 * this.battleSpeedMultiplier;   // было 650
  this.time.delayedCall(delay, () => this.processNextEvent());
}


private animateEvent(event: BattleEvent) {
  const isPlayer = event.isPlayerSide;
  const attackers = isPlayer ? this.playerShips : this.aiShips;
  const targets = isPlayer ? this.aiShips : this.playerShips;
  const healthBars = isPlayer ? this.aiHPLabels : this.playerHPLabels;   // health bars

  const attacker = attackers[event.attackerIndex % attackers.length];
  const target = targets[event.targetIndex % targets.length];
  const healthBar = healthBars[event.targetIndex % healthBars.length];

  if (!attacker || !target) return;

  const originalX = attacker.x;
  const originalY = attacker.y;
  const originalScale = attacker.scaleX;

  const recoilDistance = isPlayer ? -22 : 22;
  const speed = this.battleSpeedMultiplier;

  this.tweens.add({
    targets: attacker,
    x: attacker.x + recoilDistance,
    y: attacker.y - 6,
    scale: originalScale * 0.96,
    duration: 90 * speed,
    ease: 'Sine.easeOut',
    onComplete: () => {
      const laserKey = isPlayer ? 'laser_blue' : 'laser_red';
      const laser = this.add.sprite(attacker.x, attacker.y, laserKey).setDepth(30);
      const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);
      laser.setRotation(angle);
      laser.setScale(0.6);

      this.tweens.add({
        targets: laser,
        x: target.x,
        y: target.y,
        duration: 85 * speed,
        onComplete: () => {
          laser.destroy();

          const dmg = Number(event.damageDealt);
          if (dmg > 0) {
            const color = event.specialEffect === 'CRIT' ? '#ffff00' : '#ff4444';
            const dmgText = this.add.text(target.x, target.y - 55, `-${dmg}`, {
              fontSize: '42px', color, fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(40);
            this.tweens.add({
              targets: dmgText, y: dmgText.y - 95, alpha: 0, duration: 580 * speed,
              onComplete: () => dmgText.destroy()
            });
          }

          // === HEALTH BAR ЛОГИКА ===
          if (healthBar && event.remainingHp > 0 && event.remainingHp < (healthBar as any).maxHp) {
            const maxHp = (healthBar as any).maxHp;
            const percent = event.remainingHp / maxHp;
            const bg = (healthBar as any).bg;

            healthBar.setVisible(true);
            if (bg) bg.setVisible(true);

            healthBar.width = 52 * percent;
            healthBar.setFillStyle(percent > 0.3 ? 0x00ff88 : 0xff4444);

            // Прячем через 900 мс
            this.time.delayedCall(900, () => {
              if (healthBar.scene) healthBar.setVisible(false);
              if (bg && bg.scene) bg.setVisible(false);
            });
          }

          if (event.remainingHp <= 0) {
            this.playExplosion(target.x, target.y);

            const destroyedKey = this.getDestroyedShipKey(
              isPlayer ? this.playerUnitsData[event.targetIndex]?.faction : this.aiUnitsData[event.targetIndex]?.faction,
              isPlayer ? this.playerUnitsData[event.targetIndex]?.unitClass : this.aiUnitsData[event.targetIndex]?.unitClass
            );
            if (destroyedKey) {
              target.setTexture(destroyedKey);
              target.setAlpha(0.75);
              this.tweens.killTweensOf(target);
            }

            // Прячем health bar навсегда
            if (healthBar) healthBar.setVisible(false);
            if ((healthBar as any).bg) (healthBar as any).bg.setVisible(false);
          }

          const attackerName = `${this.getRarityName(event.attackerRarity)} ${this.getClassName(event.attackerClass)}`;
          const targetName = `${this.getRarityName(event.targetRarity)} ${this.getClassName(event.targetClass)}`;
          const side = isPlayer ? 'PLAYER' : 'AI';
          this.addToLog(`R${event.round} • ${side} • ${attackerName} → ${targetName} • ${dmg} dmg`);

          this.tweens.add({
            targets: attacker,
            x: originalX, y: originalY, scale: originalScale,
            duration: 160 * speed,
            ease: 'Sine.easeOut'
          });
        }
      });
    }
  });
}


  private playExplosion(x: number, y: number) {
    const explosion = this.add.sprite(x, y, 'explosion_01').setDepth(35).setScale(0.9);
    let frame = 1;
    const timer = this.time.addEvent({
      delay: 70, repeat: 5,
      callback: () => {
        frame++;
        if (frame <= 6) {
          explosion.setTexture(`explosion_${frame.toString().padStart(2, '0')}`);
        } else {
          timer.remove();
          this.tweens.add({
            targets: explosion, alpha: 0, scale: 1.6, duration: 180,
            onComplete: () => explosion.destroy()
          });
        }
      }
    });
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

private showFinalResult() {
  const resultText = this.playerWon ? 'VICTORY!' : 'DEFEAT';
  const color = this.playerWon ? '#00ff88' : '#ff3366';

  // VICTORY / DEFEAT (как кнопка)
  const resultBase = this.add.image(960, 90, 'button_base')
    .setDisplaySize(520, 92)
    .setInteractive()
    .setDepth(100);

  const resultLabel = this.add.text(960, 90, resultText, {
    fontSize: '72px', color, fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(101);

  (resultBase as any).linkedText = resultLabel;

  // GO BACK кнопка
  const btnBase = this.add.image(960, 230, 'button_base')
    .setDisplaySize(320, 58)
    .setInteractive()
    .setDepth(100);

  const btnText = this.add.text(960, 230, 'GO BACK', {
    fontSize: '26px', color: '#ffffff', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(101);

  (btnBase as any).linkedText = btnText;

  btnBase.on('pointerdown', () => this.scene.start('PrepareScene'));
}


  private shutdownCleanup() {
    this.tweens.killAll();
    this.time.removeAllEvents();
    [...this.playerShips, ...this.aiShips, ...this.playerShadows, ...this.aiShadows].forEach(s => s?.destroy());
    [...this.playerHPLabels, ...this.aiHPLabels].forEach(t => t?.destroy());
    this.battleLogTexts.forEach(t => t?.destroy());

    this.playerShips = []; this.aiShips = [];
    this.playerShadows = []; this.aiShadows = [];
    this.playerHPLabels = []; this.aiHPLabels = [];
    this.battleLogTexts = [];
    this.playerHPLabels.forEach(bar => {
  if (bar) bar.destroy();
  const bg = (bar as any).bg;
  if (bg) bg.destroy();
});
this.aiHPLabels.forEach(bar => {
  if (bar) bar.destroy();
  const bg = (bar as any).bg;
  if (bg) bg.destroy();
});
this.playerHPLabels = [];
this.aiHPLabels = [];

  }

  shutdown() {
    this.shutdownCleanup();
  }
}