// @ts-nocheck
// frontend/src/scenes/BattleScene.ts
import * as Phaser from 'phaser';

export default class BattleScene extends Phaser.Scene {
  private battleEvents: any[] = [];
  private playerWon: boolean = false;
  private playerMaxHp: number[] = [];
  private aiMaxHp: number[] = [];

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

    console.log('🎮 BattleScene init — получены данные:');
    console.log('   events length:', this.battleEvents.length);
    console.log('   playerWon:', this.playerWon);
    console.log('   playerMaxHp length:', this.playerMaxHp.length, this.playerMaxHp);
    console.log('   aiMaxHp length:', this.aiMaxHp.length, this.aiMaxHp);
  }

  create() {
    this.shutdownCleanup();

    this.add.rectangle(960, 540, 1920, 1080, 0x0a0022).setAlpha(0.94);

    this.currentRoundText = this.add.text(960, 60, 'ROUND 1', {
      fontSize: '54px',
      fill: '#ff00ff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.setupTeams();
    this.setupBattleLog();
    this.playBattleSequence();
  }

  private setupTeams() {
    console.log('🔧 setupTeams вызван');

    this.children.getAll().forEach(child => {
      if (child instanceof Phaser.GameObjects.Text && child.text.includes('HP')) {
        child.destroy();
      }
    });

    const playerTeamSize = this.playerMaxHp.length || 8;
    const aiTeamSize = this.aiMaxHp.length || 8;

    console.log(`⚔️  РЕАЛЬНЫЕ РАЗМЕРЫ: Player = ${playerTeamSize}, AI = ${aiTeamSize}`);

    this.playerShips = [];
    this.playerHPLabels = [];
    const playerStartX = 270;
    const playerSpacing = playerTeamSize > 4 ? 142 : 165;

    for (let i = 0; i < playerTeamSize; i++) {
      const x = playerStartX + (i % 4) * playerSpacing;
      const y = 330 + Math.floor(i / 4) * 240;

      const ship = this.add.sprite(x, y, 'ship')
        .setScale(1.725)
        .setTint(0x44ffff)
        .setDepth(10);

      this.playerShips.push(ship);

      const maxHp = this.playerMaxHp[i] || 120;
      const hpLabel = this.add.text(x, y - 138, `HP ${maxHp}`, {
        fontSize: '27px',
        fill: '#00ffcc',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(20);

      this.playerHPLabels.push(hpLabel);
    }

    this.aiShips = [];
    this.aiHPLabels = [];
    const aiStartX = 1230;
    const aiSpacing = aiTeamSize > 4 ? 142 : 165;

    for (let i = 0; i < aiTeamSize; i++) {
      const x = aiStartX + (i % 4) * aiSpacing;
      const y = 330 + Math.floor(i / 4) * 240;

      const ship = this.add.sprite(x, y, 'ship')
        .setScale(1.725)
        .setTint(0xff5588)
        .setDepth(10);

      this.aiShips.push(ship);

      const maxHp = this.aiMaxHp[i] || 130;
      const hpLabel = this.add.text(x, y - 138, `HP ${maxHp}`, {
        fontSize: '27px',
        fill: '#00ffcc',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(20);

      this.aiHPLabels.push(hpLabel);
    }
  }

  private setupBattleLog() {
    this.logContainer = this.add.container(960, 682);

    this.add.text(960, 615, 'LOG БОЯ', {
      fontSize: '39px',
      fill: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  private addToLog(text: string) {
    this.fullBattleLog.push(text);

    const logText = this.add.text(0, 0, text, {
      fontSize: '24px',
      fill: '#e0e0ff',
      wordWrap: { width: 1650 },
      align: 'center'
    }).setOrigin(0.5, 0);

    this.battleLog.unshift(logText);
    this.logContainer?.add(logText);

    this.battleLog.forEach((t, i) => {
      t.y = i * 33;
    });

    if (this.battleLog.length > 9) {
      const old = this.battleLog.pop();
      old?.destroy();
    }
  }

  private playBattleSequence() {
    if (this.battleEvents.length === 0) {
      this.add.text(960, 450, 'Нет событий боя', { fontSize: '48px', fill: '#ffff00' }).setOrigin(0.5);
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
    setTimeout(() => this.processNextEvent(), 920);
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
      x: attacker.x + (isPlayer ? 142 : -142),
      duration: 180,
      onComplete: () => {
        const laser = this.add.line(0, 0, attacker.x, attacker.y, target.x, target.y, isPlayer ? 0x44ffff : 0xff5588)
          .setLineWidth(15).setDepth(15);
        this.tweens.add({ targets: laser, alpha: 0, duration: 260, onComplete: () => laser.destroy() });

        const dmg = Number(event.damageDealt);
        const effect = event.specialEffect || '';

        if (dmg > 0) {
          const color = (effect === 'CRIT') ? '#ffff00' : '#ff2222';
          const dmgText = this.add.text(target.x, target.y - 82, `-${dmg}`, {
            fontSize: '57px', fill: color, fontStyle: 'bold'
          }).setOrigin(0.5);
          this.tweens.add({ targets: dmgText, y: dmgText.y - 165, alpha: 0, duration: 950, onComplete: () => dmgText.destroy() });
        }

        if (effect) {
          let fxColor = '#ffff00';
          let fxText = effect;
          if (effect === 'DODGE') { fxColor = '#00ff88'; fxText = 'DODGE'; }
          if (effect === 'Last Stand') { fxColor = '#ff8800'; fxText = 'LAST STAND'; }

          const fx = this.add.text(target.x, target.y - 180, fxText, {
            fontSize: '42px', fill: fxColor, fontStyle: 'bold'
          }).setOrigin(0.5);
          this.tweens.add({ targets: fx, alpha: 0, duration: 1600, onComplete: () => fx.destroy() });
        }

        if (targetLabel) {
          const remaining = event.remainingHp;
          targetLabel.setText(`HP ${remaining}`);
          if (remaining <= 0) {
            targetLabel.setFill('#ff4444');
            targetLabel.setText('HP 0');
          }
        }

        if (event.remainingHp <= 0) {
          const explosion = this.add.circle(target.x, target.y, 48, 0xffaa00).setAlpha(0.95);
          this.tweens.add({ targets: explosion, scale: 3.2, alpha: 0, duration: 450, onComplete: () => explosion.destroy() });
          const boom2 = this.add.circle(target.x, target.y, 30, 0xff5500).setAlpha(0.8);
          this.tweens.add({ targets: boom2, scale: 3.8, alpha: 0, duration: 520, onComplete: () => boom2.destroy() });
        }

        const attackerName = `${this.getRarityName(event.attackerRarity)} ${this.getClassName(event.attackerClass)}`;
        const targetName = `${this.getRarityName(event.targetRarity)} ${this.getClassName(event.targetClass)}`;
        const side = isPlayer ? 'PLAYER' : 'AI';
        const logLine = `R${event.round} • ${side} • ${attackerName} → ${targetName} • ${effect ? effect + ' • ' : ''}${dmg} dmg → HP ${event.remainingHp}`;
        this.addToLog(logLine);

        this.tweens.add({ targets: attacker, x: originalX, duration: 160, onComplete: () => attacker.setTint(isPlayer ? 0x44ffff : 0xff5588) });
      }
    });

    this.tweens.add({ targets: attacker, scale: 2.07, tint: 0xffffff, duration: 160, yoyo: true });
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

    this.add.text(960, 240, resultText, {
      fontSize: '123px',
      fill: color,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    console.log('══════════════════════════════════════════════════════════════');
    console.log('ПОЛНЫЙ ЛОГ БОЯ');
    console.log('══════════════════════════════════════════════════════════════');
    this.fullBattleLog.forEach(line => console.log(line));
    console.log('══════════════════════════════════════════════════════════════');
    console.log(`ИТОГ: ${this.playerWon ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'} | Игрок: ${this.playerMaxHp.length} юнитов | ИИ: ${this.aiMaxHp.length} юнитов`);
    console.log('══════════════════════════════════════════════════════════════');

    this.add.text(960, 990, '← ВЕРНУТЬСЯ В ПОДГОТОВКУ', {
      fontSize: '48px',
      fill: '#ffffff',
      backgroundColor: '#112233',
      padding: { x: 45, y: 18 }
    })
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => this.scene.start('PrepareScene'));
  }

  shutdownCleanup() {
    this.tweens.killAll();

    [...this.playerShips, ...this.aiShips].forEach(s => s?.destroy());
    [...this.playerHPLabels, ...this.aiHPLabels].forEach(t => t?.destroy());
    this.battleLog.forEach(t => t?.destroy());

    this.playerShips = [];
    this.aiShips = [];
    this.playerHPLabels = [];
    this.aiHPLabels = [];
    this.battleLog = [];
    this.currentEventIndex = 0;
  }

  shutdown() {
    this.shutdownCleanup();
    console.log('✅ BattleScene shutdown — полная очистка');
  }
}