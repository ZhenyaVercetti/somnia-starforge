// @ts-nocheck
import * as Phaser from 'phaser';
import WalletManager from '../lib/WalletManager';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    this.add.rectangle(960, 540, 1920, 1080, 0x0a0022);

    this.add.text(960, 320, 'SOMNIA STARFORGE', {
      fontSize: '68px',
      color: '#00ffff',
      fontFamily: 'Arial Black',
    }).setOrigin(0.5);

    this.add.text(960, 390, 'ON-CHAIN AUTO-BATTLER', {
      fontSize: '26px',
      color: '#8888ff',
    }).setOrigin(0.5);

    // Инициализируем walletManager и сохраняем в window
    const walletManager = WalletManager.getInstance();
    (window as any).walletManager = walletManager;

    // Автоматически открываем RainbowKit
    setTimeout(() => {
      if ((window as any).openWalletModal) {
        (window as any).openWalletModal();
      }
    }, 400);

    // Автоматический переход в PrepareScene через 4 секунды
    setTimeout(() => {
      this.scene.start('PrepareScene', {
        walletManager: walletManager
      });
    }, 4000);
  }
}