// @ts-nocheck
// frontend/src/scenes/BootScene.ts
import * as Phaser from 'phaser';
import { createWalletClient, custom } from 'viem';
import { somniaTestnet } from 'viem/chains';
import { getContract } from 'viem';

const GAME_CONTRACT = '0x0BB53b8b1e8Cb7Fc287d7cc35535705a1407Dc3C';
const NFT_CONTRACT = '0x9D00dB7fb6faF315C9c63971ae34380d5b831a56';

export default class BootScene extends Phaser.Scene {
  private gameContract: any;
  private nftContract: any;
  private account: `0x${string}` | undefined;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    console.log('✅ Preload завершён');
  }

  create() {
    this.add.image(640, 360, 'bg');

    const connectBtn = this.add.text(500, 300, 'ПОДКЛЮЧИТЬ METAMASK', {
      fontSize: '36px',
      fill: '#00ff00',
      backgroundColor: '#112233',
      padding: { x: 20, y: 10 }
    })
      .setInteractive()
      .on('pointerdown', () => this.initWalletAndButtons());
  }

  private async initWalletAndButtons() {
    if (typeof window.ethereum === 'undefined') return alert('Установи MetaMask');

    const walletClient = createWalletClient({ chain: somniaTestnet, transport: custom(window.ethereum) });
    await walletClient.request({ method: 'eth_requestAccounts' });
    const addresses = await walletClient.getAddresses();
    if (addresses.length === 0) return alert('В MetaMask нажми "Подключить"');

    this.account = addresses[0];

    const gameAbi = [
      { "inputs": [], "name": "buyUnit", "outputs": [], "stateMutability": "payable", "type": "function" },
      { "inputs": [], "name": "rerollShop", "outputs": [], "stateMutability": "payable", "type": "function" },
      { "inputs": [{ "internalType": "uint256", "name": "slot", "type": "uint256" }], "name": "buyFromShop", "outputs": [], "stateMutability": "payable", "type": "function" },
      { "inputs": [{ "internalType": "uint256[]", "name": "team", "type": "uint256[]" }], "name": "startMatch", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getPlayerUnits", "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }], "stateMutability": "view", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "profiles", "outputs": [{ "components": [
        { "internalType": "uint16", "name": "level", "type": "uint16" },
        { "internalType": "uint32", "name": "xp", "type": "uint32" },
        { "internalType": "uint256", "name": "wins", "type": "uint256" },
        { "internalType": "uint256", "name": "losses", "type": "uint256" }
      ], "internalType": "struct StarForgeGame.PlayerProfile", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getPlayerShop", "outputs": [{ "components": [
        { "internalType": "uint8", "name": "faction", "type": "uint8" },
        { "internalType": "uint8", "name": "rarity", "type": "uint8" },
        { "internalType": "uint8", "name": "unitClass", "type": "uint8" },
        { "internalType": "uint8", "name": "attack", "type": "uint8" },
        { "internalType": "uint8", "name": "defense", "type": "uint8" },
        { "internalType": "uint8", "name": "speed", "type": "uint8" }
      ], "internalType": "struct StarForgeGame.ShopUnit[5]", "name": "", "type": "tuple[5]" }], "stateMutability": "view", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getCurrentAI", "outputs": [{ "components": [
        { "internalType": "uint8", "name": "faction", "type": "uint8" },
        { "internalType": "uint8", "name": "rarity", "type": "uint8" },
        { "internalType": "uint8", "name": "unitClass", "type": "uint8" },
        { "internalType": "uint8", "name": "attack", "type": "uint8" },
        { "internalType": "uint8", "name": "defense", "type": "uint8" },
        { "internalType": "uint8", "name": "speed", "type": "uint8" }
      ], "internalType": "struct StarForgeGame.ShopUnit[]", "name": "", "type": "tuple[]" }], "stateMutability": "view", "type": "function" }
    ];

    const nftAbi = [
      {
        "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
        "name": "getUnit",
        "outputs": [{
          "components": [
            { "internalType": "enum StarForgeUnitNFT.Faction", "name": "faction", "type": "uint8" },
            { "internalType": "enum StarForgeUnitNFT.Rarity", "name": "rarity", "type": "uint8" },
            { "internalType": "enum StarForgeUnitNFT.UnitClass", "name": "unitClass", "type": "uint8" },
            { "internalType": "uint8", "name": "attack", "type": "uint8" },
            { "internalType": "uint8", "name": "defense", "type": "uint8" },
            { "internalType": "uint8", "name": "speed", "type": "uint8" }
          ],
          "internalType": "struct StarForgeUnitNFT.Unit",
          "name": "",
          "type": "tuple"
        }],
        "stateMutability": "view",
        "type": "function"
      }
    ];

    this.gameContract = getContract({ address: GAME_CONTRACT, abi: gameAbi, client: { ...walletClient, account: this.account } });
    this.nftContract = getContract({ address: NFT_CONTRACT, abi: nftAbi, client: { ...walletClient, account: this.account } });

    console.log('✅ MetaMask подключён. Game:', GAME_CONTRACT);

    this.children.getAll().forEach(child => {
      if (child instanceof Phaser.GameObjects.Text && child.text.includes('ПОДКЛЮЧИТЬ')) child.destroy();
    });

    this.scene.start('PrepareScene', {
      gameContract: this.gameContract,
      nftContract: this.nftContract,
      account: this.account
    });
  }
}