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

    console.log('✅ Контракты инициализированы');
  }

  private async showConnectedUI() {
    if (this.connectBtn) this.connectBtn.destroy();

    const shortAddr = `${this.account!.slice(0, 6)}...${this.account!.slice(-4)}`;
    const balance = await this.walletManager.getBalance();

    this.statusText = this.add.text(960, 380, `✓ ${shortAddr}  •  ${parseFloat(balance).toFixed(4)} SOM`, {
      fontSize: '28px',
      color: '#00ff9d',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.playBtn = this.add.text(960, 520, 'НАЧАТЬ ИГРУ', {
      fontSize: '48px',
      fontFamily: 'Arial Black',
      color: '#ff00aa',
      stroke: '#00f9ff',
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 0, color: '#ff00aa', blur: 20, fill: true }
    })
      .setOrigin(0.5)
      .setInteractive({ cursor: 'pointer' });

    this.playBtn.on('pointerover', () => this.playBtn?.setScale(1.08));
    this.playBtn.on('pointerout', () => this.playBtn?.setScale(1));
    this.playBtn.on('pointerdown', () => {
      this.scene.start('PrepareScene', {
        gameContract: this.gameContract,
        nftContract: this.nftContract,
        relicContract: this.relicContract,
        account: this.account,
        publicClient: this.publicClient,
        walletManager: this.walletManager
      });
    });
  }

  private showError(message: string) {
    const errorText = this.add.text(960, 600, `ОШИБКА: ${message}`, {
      fontSize: '24px',
      color: '#ff3366',
      wordWrap: { width: 800 }
    }).setOrigin(0.5);

    this.time.delayedCall(4000, () => errorText.destroy());
  }
}