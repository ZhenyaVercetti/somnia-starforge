// @ts-nocheck
// frontend/src/scenes/BattleScene.ts
import * as Phaser from 'phaser';

export default class BattleScene extends Phaser.Scene {
  private battleEvents: any[] = [];
  private playerWon: boolean = false;
  private playerMaxHp: number[] = [];
  private aiMaxHp: number[] = [];
  private playerUnitsData: any[] = [];
  private aiUnitsData: any[] = [];

  private playerShips: Phaser.GameObjects.Sprite[] = [];
  private aiShips: Phaser.GameObjects.Sprite[] = [];
  private playerHPLabels: Phaser.GameObjects.Text[] = [];
  private aiHPLabels: Phaser.GameObjects.Text[] = [];

  private currentEventIndex = 0;
  private battleLog: Phaser.GameObjects.Text[] = [];
  private fullBattleLog: string[] = [];
  private logContainer: Phaser.GameObjects.Container | null = null;
  private currentRoundText: Phaser.GameObjects.Text | null = null;

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
    this.load.image('Emperial_fighter', 'assets/units/portraits/Emperial_fighter.png');
    this.load.image('Emperial_cruiser', 'assets/units/portraits/Emperial_cruiser.png');
    this.load.image('Emperial_dreadnought', 'assets/units/portraits/Emperial_dreadnought.png');
    this.load.image('Emperial_droneswarm', 'assets/units/portraits/Emperial_droneswarm.png');

    this.load.image('voidborn_fighter', 'assets/units/portraits/voidborn_fighter.png');
    this.load.image('voidborn_cruiser', 'assets/units/portraits/voidborn_cruiser.png');
    this.load.image('voidborn_dreadnought', 'assets/units/portraits/voidborn_dreadnought.png');
    this.load.image('voidborn_droneswarm', 'assets/units/portraits/voidborn_droneswarm.png');

    this.load.image('mechanoid_fighter', 'assets/units/portraits/mechanoid_fighter.png');
    this.load.image('mechanoid_cruiser', 'assets/units/portraits/mechanoid_cruiser.png');
    this.load.image('mechanoid_dreadnought', 'assets/units/portraits/mechanoid_dreadnought.png');
    this.load.image('mechanoid_droneswarm', 'assets/units/portraits/mechanoid_droneswarm.png');
  }

  create() {
    this.shutdownCleanup();
    this.add.rectangle(960, 540, 1920, 1080, 0x0a0022).setAlpha(0.92);

    this.currentRoundText = this.add.text(960, 55, 'ROUND 1', {
      fontSize: '52px',
      fill: '#ff00ff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.setupTeams();
    this.setupBattleLog();
    this.playBattleSequence();
  }

  private getShipTexture(faction: number, unitClass: number): string {
    const factionMap = ['Emperial', 'voidborn', 'mechanoid'];
    const classMap = ['fighter', 'cruiser', 'dreadnought', 'droneswarm'];
    const f = factionMap[faction] || 'Emperial';
    const c = classMap[unitClass] || 'fighter';
    return `${f}_${c}`;
  }

  private setupTeams() {
    this.playerShips = [];
    this.playerHPLabels = [];
    this.aiShips = [];
    this.aiHPLabels = [];

    const playerStartX = 165;
    const playerStartY = 265;
    const spacingX = 158;
    const spacingY = 215;

    for (let i = 0; i < 8; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = playerStartX + col * spacingX;
      const y = playerStartY + row * spacingY;

      const unit = this.playerUnitsData[i] || { faction: 0, unitClass: 0 };
      const texture = this.getShipTexture(unit.faction, unit.unitClass);

      const ship = this.add.sprite(x, y, texture)
        .setScale(0.92)
        .setDepth(10);

      this.playerShips.push(ship);

      const hpLabel = this.add.text(x, y - 92, `HP ${this.playerMaxHp[i] || 100}`, {
        fontSize: '21px',
        fill: '#00ffcc',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(20);

      this.playerHPLabels.push(hpLabel);
    }

    const aiStartX = 1755;
    const aiStartY = 265;

    for (let i = 0; i < 8; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = aiStartX - col * spacingX;
      const y = aiStartY + row * spacingY;

      const unit = this.aiUnitsData[i] || { faction: 1, unitClass: 0 };
      const texture = this.getShipTexture(unit.faction, unit.unitClass);

      const ship = this.add.sprite(x, y, texture)
        .setScale(0.92)
        .setDepth(10);

      this.aiShips.push(ship);

      const hpLabel = this.add.text(x, y - 92, `HP ${this.aiMaxHp[i] || 100}`, {
        fontSize: '21px',
        fill: '#ff88aa',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(20);

      this.aiHPLabels.push(hpLabel);
    }
  }

  private setupBattleLog() {
    this.logContainer = this.add.container(960, 690);

    this.add.text(960, 625, 'БОЕВОЙ ЛОГ', {
      fontSize: '36px',
      fill: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  private addToLog(text: string) {
    this.fullBattleLog.push(text);

    const logText = this.add.text(0, 0, text, {
      fontSize: '22px',
      fill: '#d0d0ff',
      wordWrap: { width: 1680 },
      align: 'center'
    }).setOrigin(0.5, 0);

    this.battleLog.unshift(logText);
    this.logContainer?.add(logText);

    this.battleLog.forEach((t, i) => {
      t.y = i * 30;
    });

    if (this.battleLog.length > 8) {
      const old = this.battleLog.pop();
      old?.destroy();
    }
  }

  private playBattleSequence() {
    if (this.battleEvents.length === 0) {
      this.add.text(960, 480, 'Нет событий боя', { 
        fontSize: '48px', 
        fill: '#ffff00' 
      }).setOrigin(0.5);
      this.showFinalResult();
      return;
    }

    this.currentEventIndex = 0;
    this.processNextEvent();
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

    setTimeout(() => this.processNextEvent(), 820);
  }

  private animateEvent(event: any) {
    const isPlayer = event.isPlayerSide;
    const attackers = isPlayer ? this.playerShips : this.aiShips;
    const targets = isPlayer ? this.aiShips : this.playerShips;
    const targetLabels = isPlayer ? this.aiHPLabels : this.playerHPLabels;

    const attacker = attackers[event.attackerIndex % attackers.length];
    const target = targets[event.targetIndex % targets.length];
    const targetLabel = targetLabels[event.targetIndex % targetLabels.length];

    if (!attacker || !target) return;

    const originalX = attacker.x;

    this.tweens.add({
      targets: attacker,
      x: attacker.x + (isPlayer ? 95 : -95),
      duration: 135,
      onComplete: () => {
        const laserColor = isPlayer ? 0x44ffff : 0xff5588;
        const laser = this.add.line(0, 0, attacker.x, attacker.y, target.x, target.y, laserColor)
          .setLineWidth(11)
          .setDepth(15);

        this.tweens.add({
          targets: laser,
          alpha: 0,
          duration: 200,
          onComplete: () => laser.destroy()
        });

        const dmg = Number(event.damageDealt);
        if (dmg > 0) {
          const color = event.specialEffect === 'CRIT' ? '#ffff00' : '#ff3333';
          const dmgText = this.add.text(target.x, target.y - 72, `-${dmg}`, {
            fontSize: '50px',
            fill: color,
            fontStyle: 'bold'
          }).setOrigin(0.5);

          this.tweens.add({
            targets: dmgText,
            y: dmgText.y - 135,
            alpha: 0,
            duration: 780,
            onComplete: () => dmgText.destroy()
          });
        }

        if (event.specialEffect) {
          let fxColor = '#ffff00';
          let fxText = event.specialEffect;
          if (event.specialEffect === 'DODGE') fxColor = '#00ff88';
          if (event.specialEffect === 'Last Stand') fxColor = '#ff8800';

          const fx = this.add.text(target.x, target.y - 150, fxText, {
            fontSize: '36px',
            fill: fxColor,
            fontStyle: 'bold'
          }).setOrigin(0.5);

          this.tweens.add({
            targets: fx,
            alpha: 0,
            duration: 1300,
            onComplete: () => fx.destroy()
          });
        }

        if (targetLabel) {
          targetLabel.setText(`HP ${event.remainingHp}`);
          if (event.remainingHp <= 0) targetLabel.setFill('#ff4444');
        }

        if (event.remainingHp <= 0) {
          const boom = this.add.circle(target.x, target.y, 40, 0xffaa00).setAlpha(0.9);
          this.tweens.add({ targets: boom, scale: 3.3, alpha: 0, duration: 400, onComplete: () => boom.destroy() });

          const boom2 = this.add.circle(target.x, target.y, 24, 0xff5500).setAlpha(0.75);
          this.tweens.add({ targets: boom2, scale: 4.0, alpha: 0, duration: 500, onComplete: () => boom2.destroy() });
        }

        const attackerName = `${this.getRarityName(event.attackerRarity)} ${this.getClassName(event.attackerClass)}`;
        const targetName = `${this.getRarityName(event.targetRarity)} ${this.getClassName(event.targetClass)}`;
        const side = isPlayer ? 'PLAYER' : 'AI';
        this.addToLog(`R${event.round} • ${side} • ${attackerName} → ${targetName} • ${dmg} dmg`);

        this.tweens.add({ targets: attacker, x: originalX, duration: 120 });
      }
    });

    this.tweens.add({ targets: attacker, scale: 1.16, duration: 100, yoyo: true });
  }

  private getRarityName(rarity: number): string {
    if (rarity === 2) return 'Legendary';
    if (rarity === 1) return 'Rare';
    return 'Common';
  }

  private getClassName(unitClass: number): string {
    const names = ['Fighter', 'Cruiser', 'Dreadnought', 'Drone Swarm'];
    return names[unitClass] || 'Unknown';
  }

  private showFinalResult() {
    const resultText = this.playerWon ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ';
    const color = this.playerWon ? '#00ff88' : '#ff3366';

    this.add.text(960, 255, resultText, {
      fontSize: '115px',
      fill: color,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(960, 975, '← ВЕРНУТЬСЯ В ПОДГОТОВКУ', {
      fontSize: '42px',
      fill: '#ffffff',
      backgroundColor: '#112233',
      padding: { x: 40, y: 14 }
    })
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => this.scene.start('PrepareScene'));
  }

  private shutdownCleanup() {
    this.tweens.killAll();
    [...this.playerShips, ...this.aiShips].forEach(s => s?.destroy());
    [...this.playerHPLabels, ...this.aiHPLabels].forEach(t => t?.destroy());
    this.battleLog.forEach(t => t?.destroy());

    this.playerShips = [];
    this.aiShips = [];
    this.playerHPLabels = [];
    this.aiHPLabels = [];
    this.battleLog = [];
  }

  shutdown() {
    this.shutdownCleanup();
  }
}