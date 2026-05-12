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

  private backgroundLayers: Phaser.GameObjects.TileSprite[] = [];

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

    // === ТОЧНЫЕ ИМЕНА ИЗ ТВОЕЙ ПАПКИ ===
    this.load.image('emperial_cruiser', 'assets/units/portraits/emperial_cruiser.png');
    this.load.image('emperial_dreadnought', 'assets/units/portraits/emperial_dreadnought.png');
    this.load.image('emperial_droneswarm', 'assets/units/portraits/emperial_droneswarm.png');
    this.load.image('Emperial_fighter', 'assets/units/portraits/Emperial_fighter.png'); // с большой E

    this.load.image('mechanoid_cruiser', 'assets/units/portraits/mechanoid_cruiser.png');
    this.load.image('mechanoid_dreadnought', 'assets/units/portraits/mechanoid_dreadnought.png');
    this.load.image('mechanoid_droneswarm', 'assets/units/portraits/mechanoid_droneswarm.png');
    this.load.image('mechanoid_fighter', 'assets/units/portraits/mechanoid_fighter.png');

    this.load.image('voidborn_cruiser', 'assets/units/portraits/voidborn_cruiser.png');
    this.load.image('voidborn_dreadnought', 'assets/units/portraits/voidborn_dreadnought.png');
    this.load.image('voidborn_droneswarm', 'assets/units/portraits/voidborn_droneswarm.png');
    this.load.image('voidborn_fighter', 'assets/units/portraits/voidborn_fighter.png');
  }

  create() {
    this.shutdownCleanup();
    this.createParallaxBackground();
    this.add.rectangle(960, 540, 1920, 1080, 0x050010).setAlpha(0.5);

    this.currentRoundText = this.add.text(960, 48, 'ROUND 1', {
      fontSize: '48px', color: '#ff00cc', fontStyle: 'bold', fontFamily: 'monospace'
    }).setOrigin(0.5).setDepth(100);

    this.setupTeams();
    this.setupBattleLog();

    if (this.battleEvents.length === 0) {
      this.showFinalResult();
    } else {
      this.currentEventIndex = 0;
      this.processNextEvent();
    }
  }

  private createParallaxBackground() {
    const w = this.scale.width;
    const h = this.scale.height;

    const stars = this.add.tileSprite(0, 0, w, h, 'stars')
      .setOrigin(0).setScrollFactor(0.05).setDisplaySize(w, h).setDepth(0);
    this.backgroundLayers.push(stars);

    const nebulaMid = this.add.tileSprite(w / 2, h / 2, w * 1.6, h * 1.6, 'nebula_mid')
      .setAlpha(0.48).setScrollFactor(0.22).setDepth(1);
    this.backgroundLayers.push(nebulaMid);

    const nebulaClose = this.add.tileSprite(0, 0, w, h, 'nebula_close')
      .setAlpha(0.32).setScrollFactor(0.5).setDisplaySize(w, h).setDepth(2);
    this.backgroundLayers.push(nebulaClose);
  }

  private setupTeams() {
    this.playerShips = []; this.aiShips = [];
    this.playerShadows = []; this.aiShadows = [];
    this.playerHPLabels = []; this.aiHPLabels = [];

    const playerStartX = 220;
    const playerStartY = 255;
    const spacingX = 158;
    const spacingY = 190;

    // Игрок — все смотрят вправо
    for (let i = 0; i < Math.min(8, this.playerMaxHp.length); i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const depthFactor = row * 0.17;
      const x = playerStartX + col * spacingX;
      const y = playerStartY + row * spacingY + depthFactor * 32;

      const unit = this.playerUnitsData[i] || { faction: 0, unitClass: 0 };
      const key = this.getShipKey(unit.faction, unit.unitClass);
      const ship = this.add.sprite(x, y, key)
        .setScale(0.82 - depthFactor * 0.11)
        .setDepth(y)
        .setFlipX(false)
        .setRotation(0);

      const shadow = this.add.sprite(x + 11, y + 26, key)
        .setScale((0.82 - depthFactor * 0.11) * 0.58)
        .setAlpha(0.26).setTint(0x000000).setDepth(y - 1);
      this.playerShadows.push(shadow);

      this.playerShips.push(ship);

      const hpLabel = this.add.text(x, y - 76, `HP ${this.playerMaxHp[i] || 100}`, {
        fontSize: '17px', color: '#00ffcc', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(50);
      this.playerHPLabels.push(hpLabel);

      this.tweens.add({
        targets: ship, y: y - 5, scale: ship.scaleX * 1.025,
        duration: 1550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    }

    // Враг — все смотрят влево
    const aiStartX = 1700;
    const aiStartY = 255;

    for (let i = 0; i < Math.min(8, this.aiMaxHp.length); i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const depthFactor = row * 0.17;
      const x = aiStartX - col * spacingX;
      const y = aiStartY + row * spacingY + depthFactor * 32;

      const unit = this.aiUnitsData[i] || { faction: 1, unitClass: 0 };
      const key = this.getShipKey(unit.faction, unit.unitClass);
      const ship = this.add.sprite(x, y, key)
        .setScale(0.82 - depthFactor * 0.11)
        .setDepth(y)
        .setFlipX(true);

      const shadow = this.add.sprite(x - 11, y + 26, key)
        .setScale((0.82 - depthFactor * 0.11) * 0.58)
        .setAlpha(0.26).setTint(0x000000).setDepth(y - 1);
      this.aiShadows.push(shadow);

      this.aiShips.push(ship);

      const hpLabel = this.add.text(x, y - 76, `HP ${this.aiMaxHp[i] || 100}`, {
        fontSize: '17px', color: '#ff88aa', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(50);
      this.aiHPLabels.push(hpLabel);

      this.tweens.add({
        targets: ship, y: y - 5, scale: ship.scaleX * 1.025,
        duration: 1550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    }
  }

  private getShipKey(faction: number, unitClass: number): string {
    const map: Record<string, string> = {
      '0_0': 'Emperial_fighter',
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
    return map[`${faction}_${unitClass}`] || 'Emperial_fighter';
  }

  private setupBattleLog() {
    this.logContainer = this.add.container(960, 915);
    this.add.text(960, 855, 'БОЕВОЙ ЛОГ', {
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
    if (this.currentRoundText) this.currentRoundText.setText(`ROUND ${event.round}`);
    this.animateEvent(event);
    this.currentEventIndex++;
    this.time.delayedCall(650, () => this.processNextEvent());
  }

  private animateEvent(event: BattleEvent) {
    const isPlayer = event.isPlayerSide;
    const attackers = isPlayer ? this.playerShips : this.aiShips;
    const targets = isPlayer ? this.aiShips : this.playerShips;
    const targetLabels = isPlayer ? this.aiHPLabels : this.playerHPLabels;

    const attacker = attackers[event.attackerIndex % attackers.length];
    const target = targets[event.targetIndex % targets.length];
    const targetLabel = targetLabels[event.targetIndex % targetLabels.length];

    if (!attacker || !target) return;

    const originalX = attacker.x;
    const originalY = attacker.y;
    const originalScale = attacker.scaleX;

    this.tweens.add({
      targets: attacker,
      x: attacker.x + (isPlayer ? 48 : -48),
      y: attacker.y + 18,
      scale: originalScale * 1.09,
      duration: 110,
      ease: 'Power2',
      onComplete: () => {
        const laserKey = isPlayer ? 'laser_blue' : 'laser_red';
        const laser = this.add.sprite(attacker.x, attacker.y, laserKey).setDepth(30);
        const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);
        laser.setRotation(angle);
        laser.setScale(0.65);

        this.tweens.add({
          targets: laser,
          x: target.x,
          y: target.y,
          duration: 95,
          onComplete: () => {
            laser.destroy();

            const dmg = Number(event.damageDealt);
            if (dmg > 0) {
              const color = event.specialEffect === 'CRIT' ? '#ffff00' : '#ff4444';
              const dmgText = this.add.text(target.x, target.y - 55, `-${dmg}`, {
                fontSize: '42px', color, fontStyle: 'bold'
              }).setOrigin(0.5).setDepth(40);
              this.tweens.add({
                targets: dmgText, y: dmgText.y - 95, alpha: 0, duration: 580,
                onComplete: () => dmgText.destroy()
              });
            }

            if (event.remainingHp <= 0) this.playExplosion(target.x, target.y);

            if (targetLabel) {
              targetLabel.setText(`HP ${event.remainingHp}`);
              if (event.remainingHp <= 0) targetLabel.setFill('#ff4444');
            }

            const attackerName = `${this.getRarityName(event.attackerRarity)} ${this.getClassName(event.attackerClass)}`;
            const targetName = `${this.getRarityName(event.targetRarity)} ${this.getClassName(event.targetClass)}`;
            const side = isPlayer ? 'PLAYER' : 'AI';
            this.addToLog(`R${event.round} • ${side} • ${attackerName} → ${targetName} • ${dmg} dmg`);

            this.tweens.add({
              targets: attacker,
              x: originalX, y: originalY, scale: originalScale,
              duration: 130, ease: 'Power2'
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
    const resultText = this.playerWon ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ';
    const color = this.playerWon ? '#00ff88' : '#ff3366';

    this.add.text(960, 240, resultText, {
      fontSize: '108px', color, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(100);

    const btn = this.add.text(960, 520, '← ВЕРНУТЬСЯ В ПОДГОТОВКУ', {
      fontSize: '32px', color: '#ffffff', backgroundColor: '#112233', padding: { x: 32, y: 10 }
    }).setOrigin(0.5).setInteractive().setDepth(100);

    btn.on('pointerdown', () => this.scene.start('PrepareScene'));
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
  }

  shutdown() {
    this.shutdownCleanup();
  }
}