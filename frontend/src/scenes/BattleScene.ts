// @ts-nocheck
// frontend/src/scenes/BattleScene.ts
import * as Phaser from 'phaser';

export default class BattleScene extends Phaser.Scene {
  private battleEvents: any[] = [];
  private playerWon: boolean = false;

  private playerShips: Phaser.GameObjects.Sprite[] = [];
  private aiShips: Phaser.GameObjects.Sprite[] = [];
  private playerHPBars: Phaser.GameObjects.Graphics[] = [];
  private aiHPBars: Phaser.GameObjects.Graphics[] = [];
  private playerHPLabels: Phaser.GameObjects.Text[] = [];
  private aiHPLabels: Phaser.GameObjects.Text[] = [];

  private currentEventIndex = 0;

  constructor() {
    super({ key: 'BattleScene' });
  }

  init(data: any) {
    this.battleEvents = data.events || [];
    this.playerWon = data.playerWon || false;
    console.log(`🎮 BattleScene init → ${this.battleEvents.length} событий, победа: ${this.playerWon}`);
  }

  create() {
    this.add.rectangle(640, 360, 1280, 720, 0x0a0022).setAlpha(0.92);
    this.add.text(640, 60, 'ON-CHAIN ПОШАГОВЫЙ БОЙ', { fontSize: '42px', fill: '#ff00ff' }).setOrigin(0.5);

    this.setupTeams();
    this.playBattleSequence();
  }

  private setupTeams() {
    // Игрок — 8 слотов слева
    for (let i = 0; i < 8; i++) {
      const x = 180 + (i % 4) * 110;
      const y = 220 + Math.floor(i / 4) * 160;
      const ship = this.add.sprite(x, y, 'ship').setScale(0.9).setTint(0x00ffff);
      this.playerShips.push(ship);

      const bar = this.add.graphics();
      bar.fillStyle(0x00ff88, 1);
      bar.fillRect(x - 45, y - 75, 90, 14);
      this.playerHPBars.push(bar);

      const label = this.add.text(x, y - 95, 'HP 50', { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5);
      this.playerHPLabels.push(label);
    }

    // ИИ — 4 слота справа
    for (let i = 0; i < 4; i++) {
      const x = 820 + (i % 4) * 110;
      const y = 280 + Math.floor(i / 2) * 160;
      const ship = this.add.sprite(x, y, 'ship').setScale(0.9).setTint(0xff3366);
      this.aiShips.push(ship);

      const bar = this.add.graphics();
      bar.fillStyle(0x00ff88, 1);
      bar.fillRect(x - 45, y - 75, 90, 14);
      this.aiHPBars.push(bar);

      const label = this.add.text(x, y - 95, 'HP 50', { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5);
      this.aiHPLabels.push(label);
    }
  }

  private playBattleSequence() {
    if (this.battleEvents.length === 0) {
      this.add.text(640, 300, 'Нет событий боя', { fontSize: '32px', fill: '#ffff00' }).setOrigin(0.5);
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
    this.animateEvent(event);

    this.currentEventIndex++;
    setTimeout(() => this.processNextEvent(), 1000); // ровно 1 секунда на каждое событие
  }

  private animateEvent(event: any) {
    const isPlayer = event.isPlayerSide;
    const attackers = isPlayer ? this.playerShips : this.aiShips;
    const targets = isPlayer ? this.aiShips : this.playerShips;
    const hpBars = isPlayer ? this.aiHPBars : this.playerHPBars;
    const hpLabels = isPlayer ? this.aiHPLabels : this.playerHPLabels;

    const attacker = attackers[event.attackerIndex % attackers.length];
    const target = targets[event.targetIndex % targets.length];
    const hpBar = hpBars[event.targetIndex % hpBars.length];
    const hpLabel = hpLabels[event.targetIndex % hpLabels.length];

    if (!attacker || !target) return;

    // Атака
    this.tweens.add({
      targets: attacker,
      x: attacker.x + (isPlayer ? 80 : -80),
      duration: 180,
      yoyo: true,
      onComplete: () => {
        // Лазер
        const laser = this.add.line(0, 0, attacker.x, attacker.y, target.x, target.y, isPlayer ? 0x00ffff : 0xff3366)
          .setLineWidth(7);
        this.tweens.add({ targets: laser, alpha: 0, duration: 220, onComplete: () => laser.destroy() });

        // Урон
        const dmgText = this.add.text(target.x, target.y - 50, `-${event.damage}`, {
          fontSize: '36px', fill: '#ff2222', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.tweens.add({ targets: dmgText, y: dmgText.y - 90, alpha: 0, duration: 900, onComplete: () => dmgText.destroy() });

        // Special Effect
        if (event.specialEffect) {
          const fx = this.add.text(target.x, target.y - 110, event.specialEffect, {
            fontSize: '26px', fill: '#ffff00', fontStyle: 'bold'
          }).setOrigin(0.5);
          this.tweens.add({ targets: fx, alpha: 0, duration: 1400, onComplete: () => fx.destroy() });
        }

        // Обновление HP
        const maxHp = 50; // можно будет сделать динамическим позже
        const ratio = Math.max(0, event.remainingHp / maxHp);
        hpBar.clear();
        hpBar.fillStyle(0x00ff88, 1);
        hpBar.fillRect(hpBar.x - 45, hpBar.y, 90 * ratio, 14);
        hpLabel.setText(`HP ${event.remainingHp}`);

        if (event.remainingHp <= 0) {
          target.setAlpha(0.3);
          this.tweens.add({ targets: target, alpha: 0.1, duration: 800 });
        }
      }
    });
  }

  private showFinalResult() {
    const resultText = this.playerWon ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ';
    const color = this.playerWon ? '#00ff88' : '#ff3366';

    this.add.text(640, 160, resultText, {
      fontSize: '82px',
      fill: color,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(640, 620, '← ВЕРНУТЬСЯ В ПОДГОТОВКУ', {
      fontSize: '32px',
      fill: '#ffffff',
      backgroundColor: '#112233',
      padding: { x: 30, y: 12 }
    })
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => this.scene.start('PrepareScene'));
  }
}