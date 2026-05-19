// @ts-nocheck
import * as Phaser from 'phaser';

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

    // Регистрируем startGame
    (window as any).startGame = () => {
      this.scene.start('PrepareScene');
    };

    // Автоматически открываем RainbowKit
    setTimeout(() => {
      if ((window as any).openWalletModal) {
        (window as any).openWalletModal();
      }
    }, 400);
  }
}