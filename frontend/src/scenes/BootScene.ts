// @ts-nocheck
// frontend/src/scenes/BootScene.ts
import * as Phaser from 'phaser';
import { createWalletClient, custom, createPublicClient, http } from 'viem';
import { somniaTestnet } from 'viem/chains';
import { getContract } from 'viem';

const GAME_CONTRACT = '0x1cfB6c6fe1775cD9a324684f6C426f206368Eb59';
const NFT_CONTRACT = '0x9D00dB7fb6faF315C9c63971ae34380d5b831a56';
const RELIC_CONTRACT = '0x83930224Ced8cEB6350fC9F41202B8fAA0033173';

export default class BootScene extends Phaser.Scene {
  private gameContract: any;
  private nftContract: any;
  private relicContract: any;
  private account: `0x${string}` | undefined;
  private publicClient: any;

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

    this.publicClient = createPublicClient({
      chain: somniaTestnet,
      transport: http('https://dream-rpc.somnia.network')
    });

    const gameAbi = [
      { "inputs": [], "name": "buyUnit", "outputs": [], "stateMutability": "payable", "type": "function" },
      { "inputs": [], "name": "rerollShop", "outputs": [], "stateMutability": "payable", "type": "function" },
      { "inputs": [{ "internalType": "uint256", "name": "slot", "type": "uint256" }], "name": "buyFromShop", "outputs": [], "stateMutability": "payable", "type": "function" },
      { "inputs": [{ "internalType": "uint256[]", "name": "team", "type": "uint256[]" }], "name": "startMatch", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getPlayerUnits", "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }], "stateMutability": "view", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getPlayerRelics", "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }], "stateMutability": "view", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getPlayerShop", "outputs": [{ "components": [
        { "internalType": "bool", "name": "isRelic", "type": "bool" },
        { "internalType": "uint256", "name": "id", "type": "uint256" },
        { "internalType": "uint8", "name": "faction", "type": "uint8" },
        { "internalType": "uint8", "name": "rarity", "type": "uint8" },
        { "internalType": "uint8", "name": "unitClass", "type": "uint8" },
        { "internalType": "uint8", "name": "attack", "type": "uint8" },
        { "internalType": "uint8", "name": "defense", "type": "uint8" },
        { "internalType": "uint8", "name": "speed", "type": "uint8" },
        { "internalType": "uint8", "name": "relicType", "type": "uint8" },
        { "internalType": "uint8", "name": "relicValue", "type": "uint8" }
      ], "internalType": "struct StarForgeGame.ShopItem[5]", "name": "", "type": "tuple[5]" }], "stateMutability": "view", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getCurrentAI", "outputs": [{ "components": [
        { "internalType": "bool", "name": "isRelic", "type": "bool" },
        { "internalType": "uint256", "name": "id", "type": "uint256" },
        { "internalType": "uint8", "name": "faction", "type": "uint8" },
        { "internalType": "uint8", "name": "rarity", "type": "uint8" },
        { "internalType": "uint8", "name": "unitClass", "type": "uint8" },
        { "internalType": "uint8", "name": "attack", "type": "uint8" },
        { "internalType": "uint8", "name": "defense", "type": "uint8" },
        { "internalType": "uint8", "name": "speed", "type": "uint8" },
        { "internalType": "uint8", "name": "relicType", "type": "uint8" },
        { "internalType": "uint8", "name": "relicValue", "type": "uint8" }
      ], "internalType": "struct StarForgeGame.ShopItem[]", "name": "", "type": "tuple[]" }], "stateMutability": "view", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getLastBattleResult", "outputs": [
        { "internalType": "bool", "name": "", "type": "bool" },
        { "internalType": "tuple[]", "name": "", "type": "tuple[]", "components": [
          { "internalType": "uint8", "name": "round", "type": "uint8" },
          { "internalType": "bool", "name": "isPlayerSide", "type": "bool" },
          { "internalType": "uint8", "name": "attackerIndex", "type": "uint8" },
          { "internalType": "uint8", "name": "targetIndex", "type": "uint8" },
          { "internalType": "uint16", "name": "damage", "type": "uint16" },
          { "internalType": "uint16", "name": "remainingHp", "type": "uint16" },
          { "internalType": "string", "name": "specialEffect", "type": "string" }
        ]}
      ], "stateMutability": "view", "type": "function" },
      { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "profiles", "outputs": [{ "components": [
        { "internalType": "uint16", "name": "level", "type": "uint16" },
        { "internalType": "uint32", "name": "xp", "type": "uint32" },
        { "internalType": "uint256", "name": "wins", "type": "uint256" },
        { "internalType": "uint256", "name": "losses", "type": "uint256" }
      ], "internalType": "struct StarForgeGame.PlayerProfile", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" }
    ];
    const nftAbi = [{
      "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
      "name": "getUnit",
      "outputs": [{ "components": [
        { "internalType": "enum StarForgeUnitNFT.Faction", "name": "faction", "type": "uint8" },
        { "internalType": "enum StarForgeUnitNFT.Rarity", "name": "rarity", "type": "uint8" },
        { "internalType": "enum StarForgeUnitNFT.UnitClass", "name": "unitClass", "type": "uint8" },
        { "internalType": "uint8", "name": "attack", "type": "uint8" },
        { "internalType": "uint8", "name": "defense", "type": "uint8" },
        { "internalType": "uint8", "name": "speed", "type": "uint8" }
      ], "internalType": "struct StarForgeUnitNFT.Unit", "name": "", "type": "tuple" }],
      "stateMutability": "view",
      "type": "function"
    }];

    const relicAbi = [{
      "inputs": [{ "internalType": "uint256", "name": "id", "type": "uint256" }],
      "name": "getRelic",
      "outputs": [{ "components": [
        { "internalType": "enum StarForgeRelic.RelicType", "name": "relicType", "type": "uint8" },
        { "internalType": "uint8", "name": "value", "type": "uint8" },
        { "internalType": "string", "name": "name", "type": "string" }
      ], "internalType": "struct StarForgeRelic.RelicData", "name": "", "type": "tuple" }],
      "stateMutability": "view",
      "type": "function"
    }];

    this.gameContract = getContract({ address: GAME_CONTRACT, abi: gameAbi, client: { ...walletClient, account: this.account } });
    this.nftContract = getContract({ address: NFT_CONTRACT, abi: nftAbi, client: { ...walletClient, account: this.account } });
    this.relicContract = getContract({ address: RELIC_CONTRACT, abi: relicAbi, client: { ...walletClient, account: this.account } });

    console.log('✅ MetaMask подключён, Game:', GAME_CONTRACT);

    this.scene.start('PrepareScene', {
      gameContract: this.gameContract,
      nftContract: this.nftContract,
      relicContract: this.relicContract,
      account: this.account,
      publicClient: this.publicClient
    });
  }
}