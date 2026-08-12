// frontend/src/scenes/WalletSelectScene.ts
import * as Phaser from 'phaser';

export default class WalletSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WalletSelectScene' });
  }

  create() {
    this.add.rectangle(960, 540, 1920, 1080, 0x0a0022);

    this.add.text(960, 360, 'CONNECT WALLET', {
      fontSize: '40px',
      color: '#5ee7ff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      (window as any).openWalletModal();
    });

    this.add.text(960, 720, 'BACK', {
      fontSize: '22px',
      color: '#8aa0b8'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.scene.start('BootScene');
    });
  }
}
