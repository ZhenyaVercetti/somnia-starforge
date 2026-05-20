// @ts-nocheck
import * as Phaser from 'phaser';
import WalletManager from '../lib/WalletManager';

export default class BootScene extends Phaser.Scene {
  private backgroundLayers: Phaser.GameObjects.Image[] = [];

  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.image('stars', 'assets/background/stars.png');
    this.load.image('nebula_mid', 'assets/background/nebula_mid.png');
    this.load.image('nebula_close', 'assets/background/nebula_close.png');
    this.load.image('logo', 'assets/background/logo.png');
    this.load.image('outer_frame', 'assets/outer_frame.png');   // ← добавил
  }

  create() {
    this.createParallaxBackground();

    // === ЛОГОТИП в самом верху по центру (отступ 30px) ===
    this.add.image(955, 30, 'logo')
      .setOrigin(0.5, 0)
      .setDepth(10);

    // === OUTER FRAME на весь экран ===
    this.add.image(960, 540, 'outer_frame')
      .setDisplaySize(1920, 1080)
      .setDepth(100);

    const walletManager = WalletManager.getInstance();
    (window as any).walletManager = walletManager;

    setTimeout(() => {
      if ((window as any).openWalletModal) {
        (window as any).openWalletModal();
      }
    }, 600);
  }

  private createParallaxBackground() {
    const w = this.scale.width;
    const h = this.scale.height;

    const stars = this.add.image(w / 2, h / 2, 'stars')
      .setDisplaySize(w, h)
      .setDepth(0)
      .setScrollFactor(0.05)
      .setAlpha(0.95);
    this.backgroundLayers.push(stars);

    const nebulaMid = this.add.image(w / 2, h / 2, 'nebula_mid')
      .setDisplaySize(w * 1.5, h * 1.5)
      .setAlpha(0.65)
      .setScrollFactor(0.22)
      .setDepth(1);
    this.backgroundLayers.push(nebulaMid);

    const nebulaClose = this.add.image(w / 2, h / 2, 'nebula_close')
      .setDisplaySize(w, h)
      .setAlpha(0.45)
      .setScrollFactor(0.5)
      .setDepth(2);
    this.backgroundLayers.push(nebulaClose);

    this.tweens.add({
      targets: nebulaMid,
      scaleX: 1.022,
      scaleY: 1.022,
      duration: 48000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.tweens.add({
      targets: stars,
      x: '+=12',
      y: '+=7',
      duration: 52000,
      yoyo: true,
      repeat: -1,
      ease: 'Linear'
    });
  }
}