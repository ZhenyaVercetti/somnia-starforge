// @ts-nocheck
// frontend/src/scenes/BootScene.ts
import * as Phaser from 'phaser';
import WalletManager from '../lib/WalletManager';
import { getContract } from 'viem';
import type { Address } from 'viem';

const GAME_CONTRACT = '0x663FfeB8c82F97F31a5209D01D30354Deba9381a';
const NFT_CONTRACT = '0x917cf23DEE1fC5339F7eDb5e7090b2e36AdEE54d';
const RELIC_CONTRACT = '0x83930224Ced8cEB6350fC9F41202B8fAA0033173';

export default class BootScene extends Phaser.Scene {
  private walletManager: WalletManager;
  private connectBtn?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private playBtn?: Phaser.GameObjects.Text;
  private gameContract: any;
  private nftContract: any;
  private relicContract: any;
  private account: Address | undefined;
  private publicClient: any;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Добавь сюда свои ассеты, если нужно
    // this.load.image('bg', 'assets/bg.png');
    this.load.image('legendary_frame', 'assets/frames/legendary.png');
    this.load.image('rare_frame', 'assets/frames/rare.png');
  }

  create() {
    // Фон (если ассет не загрузился — просто тёмный)
    try {
      this.add.image(960, 540, 'bg').setAlpha(0.6);
    } catch {
      this.add.rectangle(960, 540, 1920, 1080, 0x0a0022);
    }

    this.walletManager = WalletManager.getInstance();

    this.createNeonConnectButton();
  }

  private createNeonConnectButton() {
    this.connectBtn = this.add.text(960, 520, 'ПОДКЛЮЧИТЬ КОШЕЛЁК', {
      fontSize: '52px',
      fontFamily: 'Arial Black',
      color: '#00f9ff',
      stroke: '#ff00aa',
      strokeThickness: 6,
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: '#00f9ff',
        blur: 25,
        fill: true
      }
    })
      .setOrigin(0.5)
      .setInteractive({ cursor: 'pointer' });

    this.connectBtn.on('pointerover', () => {
      this.connectBtn?.setScale(1.08).setStyle({ color: '#ffffff' });
    });

    this.connectBtn.on('pointerout', () => {
      this.connectBtn?.setScale(1).setStyle({ color: '#00f9ff' });
    });

    this.connectBtn.on('pointerdown', () => this.handleConnect());
  }

  private async handleConnect() {
    if (this.connectBtn) {
      this.connectBtn.setText('ПОДКЛЮЧЕНИЕ...').disableInteractive();
    }

    try {
      this.account = await this.walletManager.connect();
      this.publicClient = this.walletManager.publicClient;

      await this.initContracts();

      this.showConnectedUI();
    } catch (error: any) {
      console.error(error);
      this.showError(error.message || 'Ошибка подключения');
      if (this.connectBtn) {
        this.connectBtn.setText('ПОДКЛЮЧИТЬ КОШЕЛЁК').setInteractive();
      }
    }
  }

  private async initContracts() {
    const walletClient = this.walletManager.getWalletClient();
    if (!walletClient || !this.account) throw new Error('Кошелёк не инициализирован');

    const gameAbi = [ /* твой старый ABI gameContract — оставил полностью */ 
      { "inputs": [], "name": "buyUnit", "outputs": [], "stateMutability": "payable", "type": "function" },
      { "inputs": [], "name": "rerollShop", "outputs": [], "stateMutability": "payable", "type": "function" },
      { "inputs": [{ "internalType": "uint256", "name": "slot", "type": "uint256" }], "name": "buyFromShop", "outputs": [], "stateMutability": "payable", "type": "function" },
      { "inputs": [ { "internalType": "uint256[]", "name": "team", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "equipped", "type": "uint256[]" } ], "name": "startMatch", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getPlayerUnits", "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }], "stateMutability": "view", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getPlayerRelics", "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }], "stateMutability": "view", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getPlayerShop", "outputs": [{ "components": [ { "internalType": "bool", "name": "isRelic", "type": "bool" }, { "internalType": "uint256", "name": "id", "type": "uint256" }, { "internalType": "uint8", "name": "faction", "type": "uint8" }, { "internalType": "uint8", "name": "rarity", "type": "uint8" }, { "internalType": "uint8", "name": "unitClass", "type": "uint8" }, { "internalType": "uint8", "name": "attack", "type": "uint8" }, { "internalType": "uint8", "name": "defense", "type": "uint8" }, { "internalType": "uint8", "name": "speed", "type": "uint8" }, { "internalType": "uint8", "name": "relicType", "type": "uint8" }, { "internalType": "uint8", "name": "relicValue", "type": "uint8" } ], "internalType": "struct StarForgeGame.ShopItem[3]", "name": "", "type": "tuple[3]" }], "stateMutability": "view", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getCurrentAI", "outputs": [{ "components": [ { "internalType": "bool", "name": "isRelic", "type": "bool" }, { "internalType": "uint256", "name": "id", "type": "uint256" }, { "internalType": "uint8", "name": "faction", "type": "uint8" }, { "internalType": "uint8", "name": "rarity", "type": "uint8" }, { "internalType": "uint8", "name": "unitClass", "type": "uint8" }, { "internalType": "uint8", "name": "attack", "type": "uint8" }, { "internalType": "uint8", "name": "defense", "type": "uint8" }, { "internalType": "uint8", "name": "speed", "type": "uint8" }, { "internalType": "uint8", "name": "relicType", "type": "uint8" }, { "internalType": "uint8", "name": "relicValue", "type": "uint8" } ], "internalType": "struct StarForgeGame.ShopItem[]", "name": "", "type": "tuple[]" }], "stateMutability": "view", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getEquippedRelics", "outputs": [{ "internalType": "uint256[3]", "name": "", "type": "uint256[3]" }], "stateMutability": "view", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getLastBattleResult", "outputs": [ { "internalType": "bool", "name": "playerWon", "type": "bool" }, { "internalType": "tuple[]", "name": "events", "type": "tuple[]", "components": [ { "internalType": "uint8", "name": "round", "type": "uint8" }, { "internalType": "bool", "name": "isPlayerSide", "type": "bool" }, { "internalType": "uint8", "name": "attackerIndex", "type": "uint8" }, { "internalType": "uint8", "name": "targetIndex", "type": "uint8" }, { "internalType": "uint16", "name": "damage", "type": "uint16" }, { "internalType": "uint16", "name": "damageDealt", "type": "uint16" }, { "internalType": "uint16", "name": "initialHp", "type": "uint16" }, { "internalType": "uint16", "name": "remainingHp", "type": "uint16" }, { "internalType": "string", "name": "specialEffect", "type": "string" }, { "internalType": "uint8", "name": "attackerRarity", "type": "uint8" }, { "internalType": "uint8", "name": "attackerClass", "type": "uint8" }, { "internalType": "uint8", "name": "targetRarity", "type": "uint8" }, { "internalType": "uint8", "name": "targetClass", "type": "uint8" } ] }, { "internalType": "uint16[]", "name": "playerMaxHp", "type": "uint16[]" }, { "internalType": "uint16[]", "name": "aiMaxHp", "type": "uint16[]" } ], "stateMutability": "view", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "profiles", "outputs": [{ "components": [ { "internalType": "uint16", "name": "level", "type": "uint16" }, { "internalType": "uint32", "name": "xp", "type": "uint32" }, { "internalType": "uint256", "name": "wins", "type": "uint256" }, { "internalType": "uint256", "name": "losses", "type": "uint256" }, { "internalType": "uint16", "name": "currentAITier", "type": "uint16" } ], "internalType": "struct StarForgeGame.PlayerProfile", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" }
    ];

    const nftAbi = [{
      "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
      "name": "getUnit",
      "outputs": [{ "components": [ { "internalType": "enum StarForgeUnitNFT.Faction", "name": "faction", "type": "uint8" }, { "internalType": "enum StarForgeUnitNFT.Rarity", "name": "rarity", "type": "uint8" }, { "internalType": "enum StarForgeUnitNFT.UnitClass", "name": "unitClass", "type": "uint8" }, { "internalType": "uint8", "name": "attack", "type": "uint8" }, { "internalType": "uint8", "name": "defense", "type": "uint8" }, { "internalType": "uint8", "name": "speed", "type": "uint8" } ], "internalType": "struct StarForgeUnitNFT.Unit", "name": "", "type": "tuple" }],
      "stateMutability": "view",
      "type": "function"
    }];

    const relicAbi = [{
      "inputs": [{ "internalType": "uint256", "name": "id", "type": "uint256" }],
      "name": "getRelic",
      "outputs": [{ "components": [ { "internalType": "enum StarForgeRelic.RelicType", "name": "relicType", "type": "uint8" }, { "internalType": "uint8", "name": "value", "type": "uint8" }, { "internalType": "string", "name": "name", "type": "string" } ], "internalType": "struct StarForgeRelic.RelicData", "name": "", "type": "tuple" }],
      "stateMutability": "view",
      "type": "function"
    }];

    this.gameContract = getContract({
      address: GAME_CONTRACT,
      abi: gameAbi,
      client: { ...walletClient, account: this.account }
    });

    this.nftContract = getContract({
      address: NFT_CONTRACT,
      abi: nftAbi,
      client: { ...walletClient, account: this.account }
    });

    this.relicContract = getContract({
      address: RELIC_CONTRACT,
      abi: relicAbi,
      client: { ...walletClient, account: this.account }
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