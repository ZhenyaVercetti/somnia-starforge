// frontend/src/scenes/BootScene.ts
import * as Phaser from 'phaser';
import WalletManager from '../lib/WalletManager';

export default class BootScene extends Phaser.Scene {
  private walletManager: WalletManager;

  constructor() {
    super({ key: 'BootScene' });
    this.walletManager = WalletManager.getInstance();
  }

  create() {
    this.add.rectangle(960, 540, 1920, 1080, 0x0a0022);

    this.add.text(960, 380, 'SOMNIA STARFORGE', {
      fontSize: '72px',
      color: '#00ffff',
      fontFamily: 'Arial Black',
    }).setOrigin(0.5);

    const connectBtn = this.add.text(960, 520, 'ПОДКЛЮЧИТЬ КОШЕЛЁК', {
      fontSize: '42px',
      color: '#ffffff',
      backgroundColor: '#112244',
      padding: { x: 50, y: 20 },
    }).setOrigin(0.5).setInteractive();

    connectBtn.on('pointerover', () => connectBtn.setBackgroundColor('#223355'));
    connectBtn.on('pointerout', () => connectBtn.setBackgroundColor('#112244'));

    connectBtn.on('pointerdown', () => {
      (window as any).openWalletModal();
    });
  }
}