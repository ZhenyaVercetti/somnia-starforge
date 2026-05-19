// frontend/src/scenes/WalletSelectScene.ts
import * as Phaser from 'phaser';

export default class WalletSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WalletSelectScene' });
  }

  create() {
    this.add.rectangle(960, 540, 1920, 1080, 0x0a0022);

    this.add.text(960, 400, 'ПОДКЛЮЧИТЬ КОШЕЛЁК', {
      fontSize: '48px',
      color: '#00ffff',
    }).setOrigin(0.5).setInteractive().on('pointerdown', () => {
      (window as any).openWalletModal();
    });

    this.add.text(960, 700, '← НАЗАД', {
      fontSize: '28px',
      color: '#888888',
    }).setOrigin(0.5).setInteractive().on('pointerdown', () => {
      this.scene.start('BootScene');
    });
  }
}