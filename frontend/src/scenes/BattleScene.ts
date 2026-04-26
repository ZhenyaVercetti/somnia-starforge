// @ts-nocheck
// frontend/src/scenes/BattleScene.ts
import * as Phaser from 'phaser';

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BattleScene' });
  }

  create() {
    const cx = 640, cy = 400;

    this.add.text(420, 260, 'БОЙ НАЧАЛСЯ...', { fontSize: '32px', fill: '#ff00ff' });

    for (let wave = 0; wave < 4; wave++) {
      setTimeout(() => {
        // Лазеры игрока
        for (let i = 0; i < 6; i++) {
          const startX = 200 + Math.random() * 100;
          const startY = 300 + Math.random() * 200;
          const laser = this.add.line(0, 0, startX, startY, cx - 80, cy + (Math.random() * 120 - 60), 0x00ffff)
            .setLineWidth(4);
          this.tweens.add({
            targets: laser,
            alpha: 0,
            duration: 280 + Math.random() * 120,
            onComplete: () => laser.destroy()
          });
        }

        // Лазеры врага
        for (let i = 0; i < 4; i++) {
          const startX = 1080 - Math.random() * 100;
          const startY = 300 + Math.random() * 200;
          const laser = this.add.line(0, 0, startX, startY, cx + 80, cy + (Math.random() * 120 - 60), 0xff3366)
            .setLineWidth(3);
          this.tweens.add({
            targets: laser,
            alpha: 0,
            duration: 320 + Math.random() * 100,
            onComplete: () => laser.destroy()
          });
        }

        if (wave >= 2) {
          const boom = this.add.circle(cx, cy, 50 + wave * 15, 0xffaa00).setAlpha(0.9);
          this.tweens.add({
            targets: boom,
            scale: 3.5,
            alpha: 0,
            duration: 450 + wave * 50,
            onComplete: () => boom.destroy()
          });
        }

        if (wave === 3) {
          setTimeout(() => {
            const victoryFlash = this.add.circle(cx, cy, 180, 0x00ffcc).setAlpha(0.6);
            this.tweens.add({
              targets: victoryFlash,
              scale: 4,
              alpha: 0,
              duration: 800,
              onComplete: () => victoryFlash.destroy()
            });

            this.add.text(420, 260, 'ПОБЕДА! + rewards on-chain', { fontSize: '38px', fill: '#00ff00', fontStyle: 'bold' });

            // Возвращаемся в PrepareScene через 2 секунды
            setTimeout(() => {
              this.scene.start('PrepareScene');
            }, 2000);
          }, 300);
        }
      }, wave * 520);
    }
  }
}