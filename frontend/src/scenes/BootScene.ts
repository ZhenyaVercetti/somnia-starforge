import * as Phaser from 'phaser';
import WalletManager from '../lib/WalletManager';
import { gameAudio, SFX_MANIFEST } from '../lib/gameAudio';
import { preloadRelicsAndFrames, preloadShipPortraits } from '../utils/preloadGameAssets';

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
    this.load.image('button_base', 'assets/button_base.png');
    this.load.image('ui_titlebar', 'assets/ui/ui_titlebar.png');
    this.load.image('ui_plate', 'assets/ui/ui_plate.png');
    preloadShipPortraits(this);
    preloadRelicsAndFrames(this);
    SFX_MANIFEST.forEach((item) => this.load.audio(item.key, item.file));
  }

  create() {
    this.createParallaxBackground();

    this.add.image(960, 56, 'ui_titlebar')
      .setDisplaySize(640, 72)
      .setAlpha(0.9)
      .setDepth(8);

    const logo = this.add.image(960, 36, 'logo')
      .setOrigin(0.5, 0)
      .setDepth(10);
    logo.setScale(Math.min(88 / logo.height, 340 / logo.width));

    this.add.text(960, 150, 'ECHO OF DREAMS  ·  SOMNIA TESTNET', {
      fontFamily: 'Rajdhani, Arial, sans-serif',
      fontSize: '20px',
      color: '#7f96ad',
      fontStyle: '700'
    }).setOrigin(0.5).setDepth(12);

    this.add.image(960, 720, 'ui_plate')
      .setDisplaySize(420, 150)
      .setAlpha(0.55)
      .setDepth(18);

    const walletManager = WalletManager.getInstance();
    window.walletManager = walletManager;

    const connectBtn = this.add.image(960, 720, 'button_base')
      .setDisplaySize(320, 84)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    const connectText = this.add.text(960, 720, 'CONNECT WALLET', {
      fontFamily: 'Rajdhani, Arial, sans-serif',
      fontSize: '24px',
      color: '#5ee7ff',
      fontStyle: '700'
    }).setOrigin(0.5).setDepth(21);

    connectBtn.on('pointerover', () => {
      this.tweens.add({ targets: connectBtn, displayWidth: 338, displayHeight: 90, duration: 120 });
      connectText.setColor('#ffe566');
    });
    connectBtn.on('pointerout', () => {
      this.tweens.add({ targets: connectBtn, displayWidth: 320, displayHeight: 84, duration: 120 });
      connectText.setColor('#5ee7ff');
    });
    const openModal = () => {
      gameAudio.unlock();
      gameAudio.click();
      if (window.openWalletModal) {
        window.openWalletModal();
      }
    };
    connectBtn.on('pointerdown', openModal);
    connectText.setInteractive({ useHandCursor: true }).on('pointerdown', openModal);

    this.time.delayedCall(500, () => {
      if (walletManager.isConnected()) {
        if (window.startGame) {
          window.startGame();
        }
        return;
      }
      if (window.openWalletModal) {
        window.openWalletModal();
      }
    });
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
