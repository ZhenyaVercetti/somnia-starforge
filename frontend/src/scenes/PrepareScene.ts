// @ts-nocheck
// frontend/src/scenes/PrepareScene.ts
import * as Phaser from 'phaser';
import { getContract } from 'viem';
import WalletManager from '../lib/WalletManager';
import { UnitVisualFactory } from '../utils/UnitVisualFactory';
import { GAME_ADDRESS, NFT_ADDRESS, RELIC_ADDRESS, CHAIN_ID, RPC_URL } from '../lib/contractAddresses';


export default class PrepareScene extends Phaser.Scene {
  
async init(data?: any) {
  console.log('PrepareScene init — data:', data);

  // 1. Try to get from data (passed from main-react)
  if (data?.account && data?.publicClient) {
    this.account = data.account;
    this.publicClient = data.publicClient;
    this.isWalletReady = true;
    this.createContracts();
    console.log('✅ PrepareScene ready (from data), account:', this.account);
    return;
  }

  // 2. Try to get from window (saved from WalletModal)
  if ((window as any).account && (window as any).publicClient) {
    this.account = (window as any).account;
    this.publicClient = (window as any).publicClient;
    this.isWalletReady = true;
    this.createContracts();
    console.log('✅ PrepareScene ready (from window), account:', this.account);
    return;
  }

  // 3. Try from walletManager
  if (data?.walletManager) {
    this.walletManager = data.walletManager;
  } else if ((window as any).walletManager) {
    this.walletManager = (window as any).walletManager;
  } else {
    this.walletManager = WalletManager.getInstance();
  }

  this.account = this.walletManager?.account || null;
  this.publicClient = this.walletManager?.getPublicClient() || null;

  if (!this.account || !this.publicClient) {
    console.error('❌ account or publicClient not initialized');
    return;
  }

  this.isWalletReady = true;
  this.createContracts();

// Always try to create profile (contract ignores if already exists)
if (this.account && this.gameContract) {
  try {
    await this.sendGameTransaction('createProfile', [], 0n).catch(() => {});
    console.log('Profile creation attempted');
  } catch (e) {
    console.error('Profile creation error:', e);
  }
}

  if (data?.addUnits && Array.isArray(data.addUnits)) {
    setTimeout(() => this.addMultipleUnitsToTeam(data.addUnits), 350);
  }

  console.log('PrepareScene initialized, account:', this.account);
}




  private walletManager: WalletManager;
  private gameContract: any;
  private nftContract: any;
  private relicContract: any;
  private account: `0x${string}` | null = null;
  private publicClient: any;
  private shopBuyButtons: Phaser.GameObjects.Text[] = [];
  private shopContainer: Phaser.GameObjects.Container | null = null;
  private equippedTexts: Phaser.GameObjects.Text[] = [];

  private unitsInTeam: number[] = [];
  private team: number[] = [];
  private playerUnitIds: number[] = [];
  private equippedRelics: number[] = [0, 0, 0];
  private isWalletReady = false;
  private ownedSprites: Phaser.GameObjects.GameObject[] = [];
  private shopSprites: Phaser.GameObjects.Sprite[] = [];
  private gridSlots: Phaser.GameObjects.Rectangle[] = [];
  private playerProfileText: Phaser.GameObjects.Text | null = null;
  private tooltip: Phaser.GameObjects.Text | null = null;
  private lastClickTime = 0;
  private teamSlotOccupants: (Phaser.GameObjects.GameObject | null)[] = [];
  private originalPositions: Map<number, {x: number, y: number}> = new Map();
  private aiSprites: Phaser.GameObjects.Sprite[] = [];
  private aiTexts: Phaser.GameObjects.Text[] = [];
  private equippedSlotRects: Phaser.GameObjects.Rectangle[] = [];
  private equippedSprites: Phaser.GameObjects.GameObject[] = [];
  private aiGridSlots: Phaser.GameObjects.Rectangle[] = [];
  private collectionButton: Phaser.GameObjects.Text | null = null;
  private playerLevelText: Phaser.GameObjects.Text | null = null;
  private playerStatsText: Phaser.GameObjects.Text | null = null;
  private teamCounterText: Phaser.GameObjects.Text | null = null;
  private teamOperationLock = false;
  private lastKnownLevel: number = 0;
  private slotPulses: Phaser.Tweens.Tween[] = [];
  private connectModalContainer: Phaser.GameObjects.Container | null = null;
  private isConnectModalOpen = false;

  constructor() {
    super({ key: 'PrepareScene' });
    this.walletManager = WalletManager.getInstance();
  }

  

private createContracts() {
  if (!this.account || !this.publicClient) {
    console.error('Cannot create contracts — account or publicClient missing');
    return;
  }

  const gameAbi = [
    {
      "inputs": [],
      "name": "createProfile",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "address", "name": "player", "type": "address" }],
      "name": "hasProfile",
      "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "address", "name": "player", "type": "address" }],
      "name": "profiles",
      "outputs": [
        { "internalType": "uint16", "name": "level", "type": "uint16" },
        { "internalType": "uint32", "name": "xp", "type": "uint32" },
        { "internalType": "uint256", "name": "wins", "type": "uint256" },
        { "internalType": "uint256", "name": "losses", "type": "uint256" },
        { "internalType": "uint16", "name": "currentAITier", "type": "uint16" }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "buyUnit",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "buyUnitPrice",
      "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "rerollShop",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "rerollPrice",
      "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "uint256", "name": "slot", "type": "uint256" }],
      "name": "buyFromShop",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "buyUnitShopPrice",
      "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "buyRelicShopPrice",
      "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        { "internalType": "uint256[]", "name": "team", "type": "uint256[]" },
        { "internalType": "uint256[]", "name": "equipped", "type": "uint256[]" }
      ],
      "name": "startMatch",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "address", "name": "player", "type": "address" }],
      "name": "getLastBattleResult",
      "outputs": [
        { "internalType": "bool", "name": "", "type": "bool" },
        { "internalType": "uint16[]", "name": "", "type": "uint16[]" },
        { "internalType": "uint16[]", "name": "", "type": "uint16[]" },
        { "internalType": "bytes32", "name": "", "type": "bytes32" },
        {
          "components": [
            { "internalType": "uint8", "name": "round", "type": "uint8" },
            { "internalType": "bool", "name": "isPlayerSide", "type": "bool" },
            { "internalType": "uint8", "name": "attackerIndex", "type": "uint8" },
            { "internalType": "uint8", "name": "targetIndex", "type": "uint8" },
            { "internalType": "uint16", "name": "damage", "type": "uint16" },
            { "internalType": "uint16", "name": "damageDealt", "type": "uint16" },
            { "internalType": "uint16", "name": "initialHp", "type": "uint16" },
            { "internalType": "uint16", "name": "remainingHp", "type": "uint16" },
            { "internalType": "string", "name": "specialEffect", "type": "string" },
            { "internalType": "uint8", "name": "attackerRarity", "type": "uint8" },
            { "internalType": "uint8", "name": "attackerClass", "type": "uint8" },
            { "internalType": "uint8", "name": "targetRarity", "type": "uint8" },
            { "internalType": "uint8", "name": "targetClass", "type": "uint8" }
          ],
          "internalType": "struct StarForgeBattleLibrary.BattleEvent[]",
          "name": "",
          "type": "tuple[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "address", "name": "player", "type": "address" }],
      "name": "getCurrentAI",
      "outputs": [
        {
          "components": [
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
          ],
          "internalType": "struct StarForgeGame.ShopItem[]",
          "name": "",
          "type": "tuple[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "uint256[3]", "name": "relics", "type": "uint256[3]" }],
      "name": "equipRelics",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "address", "name": "player", "type": "address" }],
      "name": "getEquippedRelics",
      "outputs": [{ "internalType": "uint256[3]", "name": "", "type": "uint256[3]" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "address", "name": "player", "type": "address" }],
      "name": "getPlayerUnits",
      "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "address", "name": "player", "type": "address" }],
      "name": "getPlayerRelics",
      "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "address", "name": "player", "type": "address" }],
      "name": "getPlayerShop",
      "outputs": [
        {
          "components": [
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
          ],
          "internalType": "struct StarForgeGame.ShopItem[3]",
          "name": "",
          "type": "tuple[3]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];

  const nftAbi = [
    {
      "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
      "name": "getUnit",
      "outputs": [{
        "components": [
          { "internalType": "uint8", "name": "faction", "type": "uint8" },
          { "internalType": "uint8", "name": "rarity", "type": "uint8" },
          { "internalType": "uint8", "name": "unitClass", "type": "uint8" },
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

  const relicAbi = [
    {
      "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
      "name": "getRelic",
      "outputs": [
        { "internalType": "uint8", "name": "relicType", "type": "uint8" },
        { "internalType": "uint8", "name": "value", "type": "uint8" }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];

  this.gameContract = getContract({
    address: GAME_ADDRESS,
    abi: gameAbi,
    client: { public: this.publicClient }
  });

  this.nftContract = getContract({
    address: NFT_ADDRESS,
    abi: nftAbi,
    client: { public: this.publicClient }
  });

  this.relicContract = getContract({
    address: RELIC_ADDRESS,
    abi: relicAbi,
    client: { public: this.publicClient }
  });
}


private async sendGameTransaction(functionName: string, args: any[] = [], value: bigint = 0n) {
  if (!this.gameContract || !this.account || !this.publicClient) {
    throw new Error('Contract or wallet not ready');
  }

  const { createWalletClient, custom, encodeFunctionData } = await import('viem');

  const walletClient = createWalletClient({
    chain: {
      id: CHAIN_ID,
      name: 'Somnia Testnet',
      nativeCurrency: { name: 'Somnia Test Token', symbol: 'STT', decimals: 18 },
      rpcUrls: { default: { http: [RPC_URL] } }
    },
    transport: custom((window as any).ethereum)
  });

  try {
    // Simulate first to get the exact revert reason from the contract
    await this.publicClient.simulateContract({
      address: this.gameContract.address,
      abi: this.gameContract.abi,
      functionName,
      args,
      account: this.account,
      value
    });

    const data = encodeFunctionData({
      abi: this.gameContract.abi,
      functionName,
      args
    });

    const hash = await walletClient.sendTransaction({
      account: this.account,
      to: this.gameContract.address,
      data,
      value
    });

    return hash;

  } catch (err: any) {
    console.error('sendGameTransaction ERROR:', err);

    // Show exact contract revert reason to the user
    if (err.cause?.reason) {
      alert(`Contract revert: ${err.cause.reason}`);
    } else if (err.shortMessage) {
      alert(err.shortMessage);
    } else {
      alert('Transaction failed. Check console for details.');
    }
    throw err;
  }
}



  preload() {
    this.load.image('mainbackground', 'assets/mainbackground.jpg');
    this.load.image('slot_team', 'assets/slot_team.png');
    this.load.image('slot_shop', 'assets/slot_shop.png');
    this.load.image('slot_equipped', 'assets/slot_equipped.png');
    this.load.image('slot_ai', 'assets/slot_ai.png');
    this.load.image('button_base', 'assets/button_base.png');
    this.load.image('button_start', 'assets/button_start.png');
    this.load.image('profile_frame', 'assets/profile_frame.png');
    this.load.image('outer_frame', 'assets/outer_frame.png');
    this.load.image('collection_frame', 'assets/collection_frame.png');
    this.load.image('preview_frame', 'assets/preview_frame.png');

    this.load.image('emperial_fighter', 'assets/units/portraits/emperial_fighter.png');
    this.load.image('emperial_cruiser', 'assets/units/portraits/emperial_cruiser.png');
    this.load.image('emperial_dreadnought', 'assets/units/portraits/emperial_dreadnought.png');
    this.load.image('emperial_droneswarm', 'assets/units/portraits/emperial_droneswarm.png');
    this.load.image('voidborn_fighter', 'assets/units/portraits/voidborn_fighter.png');
    this.load.image('voidborn_cruiser', 'assets/units/portraits/voidborn_cruiser.png');
    this.load.image('voidborn_dreadnought', 'assets/units/portraits/voidborn_dreadnought.png');
    this.load.image('voidborn_droneswarm', 'assets/units/portraits/voidborn_droneswarm.png');
    this.load.image('mechanoid_fighter', 'assets/units/portraits/mechanoid_fighter.png');
    this.load.image('mechanoid_cruiser', 'assets/units/portraits/mechanoid_cruiser.png');
    this.load.image('mechanoid_dreadnought', 'assets/units/portraits/mechanoid_dreadnought.png');
    this.load.image('mechanoid_droneswarm', 'assets/units/portraits/mechanoid_droneswarm.png');

    this.load.image('quantum_strike', 'assets/relics/quantum_strike.png');
    this.load.image('void_shield', 'assets/relics/void_shield.png');
    this.load.image('nebula_dash', 'assets/relics/nebula_dash.png');
    this.load.image('echo_core', 'assets/relics/echo_core.png');
    this.load.image('flux_overload', 'assets/relics/flux_overload.png');
    this.load.image('last_stand', 'assets/relics/last_stand.png');

    this.load.image('legendary_frame', 'assets/frames/legendary.png');
    this.load.image('rare_frame', 'assets/frames/rare.png');
    this.load.image('common_frame', 'assets/frames/common.png');
  }

create() {
  this.team = [];
  this.teamSlotOccupants = new Array(8).fill(null);
  this.equippedRelics = [0, 0, 0];
  this.equippedSprites = [];
  this.equippedTexts = [];
  this.lastKnownLevel = 0;
  this.teamOperationLock = false;
  this.originalPositions.clear();

  this.addGameUI();
  this.initEquippedState();
  this.updatePlayerProfile();
  this.loadOwnedUnits();
  this.loadPlayerShop();
  this.updatePlayerProfile();

  this.input.topOnly = false;

  console.log('✅ PrepareScene created');
  console.log('🔍 Button diagnostics:');
  console.log('  isWalletReady:', this.isWalletReady);
  console.log('  gameContract:', !!this.gameContract);
  console.log('  account:', this.account);
  console.log('  publicClient:', !!this.publicClient);
}

private normalizeUnit(unit: any) {
  if (!unit) {
    return { faction: 0, rarity: 0, unitClass: 0, attack: 0, defense: 0, speed: 0 };
  }
  if (Array.isArray(unit)) {
    return {
      faction: Number(unit[0]),
      rarity: Number(unit[1]),
      unitClass: Number(unit[2]),
      attack: Number(unit[3]),
      defense: Number(unit[4]),
      speed: Number(unit[5])
    };
  }
  return {
    faction: Number(unit.faction),
    rarity: Number(unit.rarity),
    unitClass: Number(unit.unitClass),
    attack: Number(unit.attack),
    defense: Number(unit.defense),
    speed: Number(unit.speed)
  };
}

private async loadOwnedUnits() {
  if (!this.account || !this.gameContract || !this.nftContract) return;

  this.ownedSprites.forEach(s => s.destroy());
  this.ownedSprites = [];

  try {
    const ownedIds: bigint[] = await this.gameContract.read.getPlayerUnits([this.account]);
    this.playerUnitIds = ownedIds.map(id => Number(id));

    this.team = this.team.filter(id => this.playerUnitIds.includes(id));
    if (this.teamCounterText) this.teamCounterText.setText(`TEAM: ${this.team.length}/8`);

  } catch (e) {
    console.error('loadOwnedUnits error', e);
  }
}

private async loadPlayerShop() {
  if (!this.account || !this.gameContract) return;

  // Полная очистка
  if (this.shopContainer) {
    this.shopContainer.destroy(true);
    this.shopContainer = null;
  }
  this.shopSprites = [];
  this.shopTexts = [];
  this.shopBuyButtons = [];

  try {
    const shopData: any[] = await this.gameContract.read.getPlayerShop([this.account]);

    this.shopContainer = this.add.container(0, 0);

    const shopCenterX = 340;
    const shopY = 560;
    const shopSlotSize = 128;           // новый размер
    const shopSpacing = 48;             // чуть уменьшил для 128px
    const shopTotalWidth = 3 * shopSlotSize + 2 * shopSpacing;
    const shopStartX = shopCenterX - shopTotalWidth / 2;

for (let i = 0; i < 3; i++) {
  const item = shopData[i] || { isRelic: false, relicType: 0, relicValue: 0 };
  const x = shopStartX + i * (shopSlotSize + shopSpacing);
  const y = shopY;

  const bg = this.add.rectangle(x, y, 120, 120, 0x0a1122).setDepth(1);
  this.shopContainer.add(bg);

  const slotImage = this.add.image(x, y, 'slot_shop')
    .setInteractive()
    .setDisplaySize(128, 128)
    .setDepth(10);
  // this.addButtonEffects(slotImage);   // ← УБРАНО (чтобы рамка не пульсировала)

  this.shopContainer.add(slotImage);

  let displayName = 'EMPTY';
  let tooltipText = 'Empty slot';
  let relicKey = '';
  let iconScale = 0.88;   // ← УВЕЛИЧЕНО

  if (item.isRelic) {
    const typeNames = ['Quantum Strike', 'Void Shield', 'Nebula Dash', 'Echo Core', 'Flux Overload', 'Last Stand'];
    displayName = typeNames[item.relicType] || 'Unknown Relic';
    tooltipText = `${displayName}\n+${item.relicValue} ${this.getRelicEffectDescription(item.relicType)}`;

    const relicMap: Record<number, string> = {
      0: 'quantum_strike', 1: 'void_shield', 2: 'nebula_dash',
      3: 'echo_core', 4: 'flux_overload', 5: 'last_stand'
    };
    relicKey = relicMap[item.relicType] || 'quantum_strike';
  }

  const sprite = this.add.sprite(x, y, relicKey || 'slot_shop')
    .setInteractive()
    .setScale(relicKey ? iconScale : 1)
    .setDepth(4);
  (sprite as any).shopSlot = i;
  this.shopContainer.add(sprite);
  this.shopSprites.push(sprite);

  const nameText = this.add.text(x, y + 85, displayName, {
    fontSize: '18px', fill: '#ffff00', align: 'center', wordWrap: { width: 120 }
  }).setOrigin(0.5);
  this.shopContainer.add(nameText);
  this.shopTexts.push(nameText);

  const buyBtn = this.add.text(x - 28, y + 115, 'BUY', {
    fontSize: '26px', fill: '#00ff00'
  })
    .setInteractive()
    .on('pointerdown', () => this.buyFromShopSlot(i));
  this.shopContainer.add(buyBtn);
  this.shopBuyButtons.push(buyBtn);

  sprite.on('pointerover', () => this.showTooltip(x + 140, y - 40, tooltipText));
  sprite.on('pointerout', () => this.hideTooltip());
}


    // AI GRID (без изменений)
    this.aiGridSlots = [];
    const aiCenterX = 1640;
    const aiCenterY = 610;
    const aiSlotSize = 95;
    const aiHSpacing = 15;
    const aiVSpacing = 15;
    const aiTotalWidth = 4 * aiSlotSize + 3 * aiHSpacing;
    const aiTotalHeight = 2 * aiSlotSize + aiVSpacing;
    const aiStartX = aiCenterX - aiTotalWidth / 2;
    const aiStartY = aiCenterY - aiTotalHeight / 2;

    for (let i = 0; i < 8; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = aiStartX + col * (aiSlotSize + aiHSpacing);
      const y = aiStartY + row * (aiSlotSize + aiVSpacing);

      this.add.rectangle(x, y, aiSlotSize - 6, aiSlotSize - 6, 0x0a1122).setDepth(1);

      const slot = this.add.image(x, y, 'slot_ai')
        .setInteractive()
        .setDisplaySize(aiSlotSize, aiSlotSize)
        .setDepth(10);

      this.aiGridSlots.push(slot);
      this.addButtonEffects(slot);
    }

    this.loadCurrentAI();

  } catch (e) {
    console.error('loadPlayerShop error', e);
  }
}


  private async refreshRelics() {
    await this.loadEquippedRelics();
  }

  private async initEquippedState() {
    if (!this.account || !this.gameContract) return;
    try {
      const equipped: bigint[] = await this.gameContract.read.getEquippedRelics([this.account]);
      this.equippedRelics = equipped.map(id => Number(id));
      await this.refreshRelics();
    } catch (e) {
      console.error('initEquippedState error', e);
    }
  }

private async loadEquippedRelics() {
  if (!this.equippedSprites) this.equippedSprites = [];
  if (!this.equippedTexts) this.equippedTexts = [];

  if (!this.account || !this.gameContract || !this.relicContract) return;

  try {
    this.equippedSprites.forEach(s => s.destroy());
    this.equippedSprites = [];
    this.equippedTexts.forEach(t => t.destroy());
    this.equippedTexts = [];

    for (let i = 0; i < 3; i++) {
      const slot = this.equippedSlotRects[i];
      if (!slot) continue;

      const oldSprite = slot.getData('equippedSprite') as Phaser.GameObjects.Sprite;
      if (oldSprite) oldSprite.destroy();

      if (this.equippedRelics[i] === 0) {
        slot.setData('equippedSprite', null);
        continue;
      }

      const relicId = this.equippedRelics[i];
      const relicData = await this.relicContract.read.getRelic([BigInt(relicId)]);

      const relicMap: Record<number, string> = {
        0: 'quantum_strike', 1: 'void_shield', 2: 'nebula_dash',
        3: 'echo_core', 4: 'flux_overload', 5: 'last_stand'
      };

      const relicKey = relicMap[relicData.relicType] || 'quantum_strike';

      const sprite = this.add.sprite(slot.x, slot.y, relicKey)
        .setScale(0.80)
        .setInteractive()
        .setDepth(12);

      (sprite as any).relicId = relicId;
      (sprite as any).isEquipped = true;
      (sprite as any).slotIndex = i;

      slot.setData('equippedSprite', sprite);
      this.equippedSprites.push(sprite);

      sprite.on('pointerover', () => {
        this.showTooltip(slot.x + 60, slot.y - 45,
          `${relicData.name}\n+${relicData.value} ${this.getRelicEffectDescription(relicData.relicType)}`);
      });
      sprite.on('pointerout', () => this.hideTooltip());

      this.input.setDraggable(sprite);

      let dragStartX = 0;
      let dragStartY = 0;

      sprite.on('dragstart', (pointer: Phaser.Input.Pointer) => {
        dragStartX = pointer.x;
        dragStartY = pointer.y;
        sprite.setDepth(30);
        sprite.setScale(0.95);
      });

      sprite.on('drag', (_: any, dragX: number, dragY: number) => {
        sprite.x = dragX;
        sprite.y = dragY;
      });

      sprite.on('dragend', (pointer: Phaser.Input.Pointer) => {
        sprite.setScale(0.80);
        sprite.setDepth(12);

        const movedDistance = Math.sqrt(Math.pow(pointer.x - dragStartX, 2) + Math.pow(pointer.y - dragStartY, 2));

        if (movedDistance < 25) {
          this.unequipRelic(i);
          return;
        }

        let droppedOnAnotherSlot = false;

        for (let s = 0; s < 3; s++) {
          if (s === i) continue;
          const targetSlot = this.equippedSlotRects[s];
          const dx = targetSlot.x - sprite.x;
          const dy = targetSlot.y - sprite.y;

          if (Math.sqrt(dx * dx + dy * dy) < 80) {
            const temp = this.equippedRelics[i];
            this.equippedRelics[i] = this.equippedRelics[s];
            this.equippedRelics[s] = temp;
            this.refreshRelics();
            droppedOnAnotherSlot = true;
            break;
          }
        }

        if (!droppedOnAnotherSlot) {
          this.unequipRelic(i);
        } else {
          sprite.x = slot.x;
          sprite.y = slot.y;
        }
      });
    }
  } catch (e) {
    console.error('loadEquippedRelics error', e);
  }
}


  private async equipRelic(relicId: number, slotIndex: number) {
    if (slotIndex < 0 || slotIndex > 2) return;
    this.equippedRelics[slotIndex] = relicId;
    await this.refreshRelics();
  }

  private async unequipRelic(slotIndex: number) {
    if (slotIndex < 0 || slotIndex > 2) return;
    const relicId = this.equippedRelics[slotIndex];
    if (relicId === 0) return;

    this.equippedRelics[slotIndex] = 0;
    await this.refreshRelics();

    const collectionScene = this.scene.get('CollectionScene') as any;
    if (collectionScene && collectionScene.scene.isActive()) {
      const alreadyExists = collectionScene.relicsData.some((r: any) => r.id === relicId);
      if (!alreadyExists) {
        collectionScene.relicsData.push({ id: relicId, relic: null });
        if (typeof collectionScene.applyFiltersAndSort === 'function') {
          collectionScene.applyFiltersAndSort();
        } else if (typeof collectionScene.refreshGrid === 'function') {
          collectionScene.refreshGrid();
        }
      }
    }
  }

private getRelicEffectDescription(relicType: number): string {
  const desc = [
    'Increases ATK for all units',
    'Increases DEF for all units',
    'Increases SPD for all units',
    'Increases HP for all units',
    'Increases crit chance (Quantum Flux)',
    'Last stand before death (Last Stand)'
  ];
  return desc[relicType] || 'Unknown effect';
}

private async loadCurrentAI() {
  if (!this.account || !this.gameContract) {
    console.warn('loadCurrentAI: no account or gameContract');
    return;
  }

  this.aiSprites.forEach(s => s?.destroy());
  this.aiSprites = [];

  this.aiGridSlots.forEach(slot => {
    const old = slot.getData('aiSprite');
    if (old) old.destroy();
    slot.setData('aiSprite', null);
  });

  try {
    const aiData: any[] = await this.gameContract.read.getCurrentAI([this.account]);

    if (!aiData || !Array.isArray(aiData) || aiData.length === 0) {
      const placeholder = this.add.text(1590, 730, 'ENEMY TEAM\nWILL BE GENERATED\nON BATTLE START', {
        fontSize: '18px',
        color: '#888888',
        align: 'center',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(20);
      this.aiSprites.push(placeholder as any);
      return;
    }

    for (let i = 0; i < 8; i++) {
      const slot = this.aiGridSlots[i];
      if (!slot || i >= aiData.length) continue;

      const unit = aiData[i];
      const style = this.getRarityTintAndScale(unit.rarity);
      const shipKey = this.getShipKey(Number(unit.faction), Number(unit.unitClass));

      const container = UnitVisualFactory.createUnitWithFrame(
        this, slot.x, slot.y, shipKey, Number(unit.rarity), style.scale * 0.30, 0.85
      );

      const ship = container.getAt(container.length - 1) as Phaser.GameObjects.Sprite;
      if (!ship) {
        container.destroy();
        continue;
      }

      (ship as any).unit = unit;
      ship.setInteractive().setDepth(8);
      container.setDepth(8);

      slot.setData('aiSprite', container);
      this.aiSprites.push(container);

      const tooltipText = `${this.getFactionName(unit.faction)} ${this.getRarityName(unit.rarity)} ${this.getClassName(unit.unitClass)}\nATK ${unit.attack} DEF ${unit.defense} SPD ${unit.speed}`;
      ship.on('pointerover', () => this.showTooltip(slot.x + 55, slot.y - 45, tooltipText));
      ship.on('pointerout', () => this.hideTooltip());
    }
  } catch (e) {
    console.error('loadCurrentAI error:', e);
    const errorText = this.add.text(1590, 730, 'FAILED TO LOAD\nENEMY TEAM', {
      fontSize: '18px',
      color: '#ff4444',
      align: 'center'
    }).setOrigin(0.5).setDepth(20);
    this.aiSprites.push(errorText as any);
  }
}


private async autoSelectTeam() {
  if (this.teamOperationLock) return;
  this.teamOperationLock = true;

  try {
    if (this.playerUnitIds.length === 0) {
      await this.loadOwnedUnits();
    }
    if (this.playerUnitIds.length === 0) return;

    this.clearTeam();

    // === LOAD ALL DATA IN PARALLEL (FAST) ===
    const unitPromises = this.playerUnitIds.map(async (id) => {
      try {
        const unit = await this.nftContract.read.getUnit([BigInt(id)]);
        return {
          id: Number(id),
          rarity: Number(unit.rarity)
        };
      } catch {
        return null;
      }
    });

    const results = await Promise.all(unitPromises);
    const unitsWithRarity = results.filter(Boolean) as { id: number; rarity: number }[];

    unitsWithRarity.sort((a, b) => b.rarity - a.rarity);
    const toSelect = unitsWithRarity.slice(0, 8);

    for (let i = 0; i < toSelect.length; i++) {
      const unitInfo = toSelect[i];
      if (this.team.length >= 8) break;

      const freeSlotIndex = this.teamSlotOccupants.findIndex(slot => slot === null);
      if (freeSlotIndex !== -1) {
        this.team.push(unitInfo.id);
        await this.createTeamUnitVisual(unitInfo.id, freeSlotIndex);
        await new Promise(resolve => setTimeout(resolve, 180));
      }
    }

    this.updateTeamCounter();

  } finally {
    this.teamOperationLock = false;
  }
}


  private clearTeam() {
    if (this.teamOperationLock) return;

    for (let i = 0; i < this.teamSlotOccupants.length; i++) {
      const occupant = this.teamSlotOccupants[i];
      if (occupant) {
        occupant.destroy();
        this.teamSlotOccupants[i] = null;
      }
    }

    this.team = [];
    this.originalPositions.clear();
    if (this.teamCounterText) this.teamCounterText.setText('TEAM: 0/8');

    this.gridSlots.forEach(slot => {
      if (slot) slot.setInteractive();
    });
  }

private async updatePlayerProfile() {
  if (!this.account || !this.gameContract) return;
  if (!this.playerLevelText || !this.playerStatsText) return;

  try {
    // Check if profile exists
    const hasProfile = await this.gameContract.read.hasProfile([this.account]);

    if (!hasProfile) {
      // Show default values if profile doesn't exist yet
      this.playerLevelText.setText('PROFILE Level 1');
      this.playerStatsText.setText('XP 0/90 | W:0 L:0');
      return;
    }

    // Safely read profile data
    const profile: any = await this.gameContract.read.profiles([this.account]);

    const level = Number(profile.level) || 1;
    const xp = Number(profile.xp) || 0;
    const wins = Number(profile.wins) || 0;
    const losses = Number(profile.losses) || 0;

    const nextXp = level * 55 + 90;

    this.playerLevelText.setText(`PROFILE Level ${level}`);
    this.playerStatsText.setText(`XP ${xp}/${nextXp} | W:${wins} L:${losses}`);

    // Update progress bar if it exists
    const bar = (this as any).levelProgressBar as Phaser.GameObjects.Rectangle;
    if (bar && bar.scene) {
      this.tweens.add({
        targets: bar,
        width: 330 * Math.min(xp / nextXp, 1),
        duration: 900,
        ease: 'Sine.easeOut'
      });
    }

    // Level up animation
    if (this.lastKnownLevel > 0 && level > this.lastKnownLevel) {
      const levelUpText = this.add.text(600, 300, `LEVEL UP! → ${level}`, {
        fontSize: '63px', fill: '#ffff00', fontStyle: 'bold'
      }).setOrigin(0.5);
      this.tweens.add({
        targets: levelUpText,
        y: levelUpText.y - 120,
        alpha: 0,
        duration: 2200,
        onComplete: () => levelUpText.destroy()
      });
    }

    this.lastKnownLevel = level;

  } catch (e) {
    console.error('updatePlayerProfile error', e);
    // Show default values on error
    this.playerLevelText.setText('PROFILE Level 1');
    this.playerStatsText.setText('XP 0/90 | W:0 L:0');
  }
}
  private showTooltip(x: number, y: number, text: string) {
    if (!this.tooltip || this.tooltip.scene !== this) {
      this.tooltip = this.add.text(0, 0, '', {
        fontSize: '24px',
        fill: '#ffffff',
        backgroundColor: '#112233',
        padding: { x: 18, y: 12 },
        align: 'left'
      }).setOrigin(0.5, 1).setDepth(100);
    }

    this.tooltip.setText(text);
    this.tooltip.setPosition(x, y - 22);
    this.tooltip.setVisible(true);
  }

  private hideTooltip() {
    if (this.tooltip) this.tooltip.setVisible(false);
  }

private clearTemporaryTexts() {
  this.children.getAll().forEach(child => {
    if (child instanceof Phaser.GameObjects.Text) {
      const text = child.text.toLowerCase();
      if (text.includes('purchased') || text.includes('rerolled') || text.includes('tx sent') || text.includes('victory')) {
        child.destroy();
      }
    }
  });
}

  private getFactionName(faction: number): string {
    const names = ['Empire', 'Voidborn', 'Mechanoids'];
    return names[faction] || 'Unknown';
  }

  private getRarityName(rarity: number): string {
    const names = ['Common', 'Rare', 'Legendary'];
    return names[rarity] || 'Unknown';
  }

  private getClassName(unitClass: number): string {
    const names = ['Fighter', 'Cruiser', 'Dreadnought', 'Drone Swarm'];
    return names[unitClass] || 'Unknown';
  }

private async buyUnit() {
  console.log('🟢 BUY pressed');
  if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) {
    return alert('Connect wallet first');
  }

  try {
    console.log('📤 Sending buyUnit...');
    const hash = await this.sendGameTransaction('buyUnit', [], 10000000000000000n); // 0.01 ETH

    console.log('✅ TX sent:', hash);
    const waiting = this.add.text(600, 450, 'TX buyUnit sent... waiting for on-chain (3 sec)', { 
      fontSize: '36px', fill: '#ffff00' 
    }).setDepth(500);

    await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    waiting.destroy();

    const msg = this.add.text(600, 450, 'Unit purchased on-chain!', { 
      fontSize: '48px', fill: '#00ff00' 
    }).setDepth(500);
    setTimeout(() => msg.destroy(), 2200);

    setTimeout(() => this.loadOwnedUnits(), 3000);
  } catch (e: any) {
    console.error('❌ buyUnit error:', e);
    const errMsg = e.shortMessage || e.message || 'Unknown error';
    const errorText = this.add.text(600, 450, `Error: ${errMsg}`, { 
      fontSize: '36px', fill: '#ff4444' 
    }).setDepth(500);
    setTimeout(() => errorText.destroy(), 4000);
  }
}

private async buyFromShopSlot(slot: number) {

  console.log('🟢 BUY FROM SHOP pressed, slot:', slot);

  if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) {
    return alert('Connect wallet first');
  }

  try {
    console.log('📤 Sending buyFromShop...');
    const hash = await this.sendGameTransaction('buyFromShop', [BigInt(slot)], 10000000000000000n); // 0.01 ETH

    console.log('✅ TX sent:', hash);

    const waiting = this.add.text(600, 450, `TX buyFromShop [${slot}] sent... waiting for on-chain (3 sec)`, { 
      fontSize: '36px', fill: '#ffff00' 
    }).setDepth(500);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    waiting.destroy();

    const msg = this.add.text(600, 450, `Artifact purchased!`, { 
      fontSize: '42px', fill: '#00ff00' 
    }).setDepth(500);
    setTimeout(() => msg.destroy(), 1800);

    setTimeout(() => {
      this.loadPlayerShop();
      this.loadCurrentAI();
    }, 3000);
  } catch (e: any) {
    console.error('❌ buyFromShopSlot error:', e);
    const errMsg = e.shortMessage || e.message || 'Error';
    const errorText = this.add.text(600, 450, `Error: ${errMsg}`, { 
      fontSize: '36px', fill: '#ff4444' 
    }).setDepth(500);
    setTimeout(() => errorText.destroy(), 4000);
  }
}


private async rerollShop() {
  console.log('🟢 REROLL pressed');

  if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) {
    return alert('Connect wallet first');
  }

  try {
    console.log('📤 Sending rerollShop...');
    const hash = await this.sendGameTransaction('rerollShop', [], 5000000000000000n);

    console.log('✅ TX sent:', hash);

    const waiting = this.add.text(600, 510, 'TX reroll sent... waiting for on-chain (2 sec)', {
      fontSize: '42px', fill: '#ffff00'
    }).setDepth(500);

    await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    waiting.destroy();

    // Immediate refresh without timeout
    await this.loadPlayerShop();
    await this.loadCurrentAI();

    const msg = this.add.text(600, 510, 'Shop rerolled — new artifacts', {
      fontSize: '42px', fill: '#00ff00'
    }).setDepth(500);
    setTimeout(() => msg.destroy(), 1800);

  } catch (e: any) {
    console.error('❌ rerollShop error:', e);
    const errMsg = e.shortMessage || e.message || 'Reroll error';
    const errorText = this.add.text(600, 510, `Error: ${errMsg}`, {
      fontSize: '36px', fill: '#ff4444'
    }).setDepth(500);
    setTimeout(() => errorText.destroy(), 4000);
  }
}

private async buyFromShopSlot(slot: number) {
  console.log('🟢 BUY FROM SHOP pressed, slot:', slot);

  if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) {
    return alert('Connect wallet first');
  }

  try {
    console.log('📤 Sending buyFromShop...');
    const hash = await this.sendGameTransaction('buyFromShop', [BigInt(slot)], 10000000000000000n);

    console.log('✅ TX sent:', hash);

    const waiting = this.add.text(600, 450, `TX buyFromShop [${slot}] sent... waiting for on-chain (2 sec)`, {
      fontSize: '36px', fill: '#ffff00'
    }).setDepth(500);

    await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    waiting.destroy();

    await this.loadPlayerShop();
    await this.loadCurrentAI();

    const msg = this.add.text(600, 450, `Artifact purchased!`, {
      fontSize: '42px', fill: '#00ff00'
    }).setDepth(500);
    setTimeout(() => msg.destroy(), 1800);

  } catch (e: any) {
    console.error('❌ buyFromShopSlot error:', e);
    const errMsg = e.shortMessage || e.message || 'Error';
    const errorText = this.add.text(600, 450, `Error: ${errMsg}`, {
      fontSize: '36px', fill: '#ff4444'
    }).setDepth(500);
    setTimeout(() => errorText.destroy(), 4000);
  }
}

private addGameUI() {
  const bg = this.add.image(960, 540, 'mainbackground').setDepth(-20);
  bg.setDisplaySize(1920, 1080);

  // === PROFILE (слева сверху) ===
  const profileX = 45;
  const profileY = 28;

  const profileFrame = this.add.image(profileX, profileY, 'profile_frame')
    .setOrigin(0, 0)
    .setDisplaySize(520, 180)
    .setDepth(5);

  this.playerLevelText = this.add.text(profileX + 32, profileY + 26, 'Level 1', {
    fontSize: '46px', fill: '#00ffff', fontStyle: 'bold'
  }).setDepth(10);

  this.playerStatsText = this.add.text(profileX + 32, profileY + 84, 'XP 0/90  •  W:0 L:0', {
    fontSize: '23px', fill: '#aaffff'
  }).setDepth(10);

  const progressBg = this.add.rectangle(profileX + 32, profileY + 122, 454, 16, 0x112233)
    .setStrokeStyle(2, 0x00ffff).setOrigin(0, 0).setDepth(8);

  const progressBar = this.add.rectangle(profileX + 32, profileY + 122, 0, 16, 0x00ff88)
    .setOrigin(0, 0).setDepth(9);
  (this as any).levelProgressBar = progressBar;

  // === LOGO ===
  const logo = this.add.image(950, 45, 'logo')
    .setOrigin(0.5, 0)
    .setDepth(15);

  const logoScale = 240 / logo.height;
  logo.setScale(logoScale);

  // === TEAM GRID (сдвинут на 60px вниз) ===
  this.gridSlots = [];
  this.teamSlotOccupants = new Array(8).fill(null);

  const teamCenterX = 1020;
  const teamCenterY = 620;                    // +60px

  const slotSize = 142;
  const hSpacing = 23;
  const vSpacing = 23;
  const totalWidth = 4 * slotSize + 3 * hSpacing;
  const totalHeight = 2 * slotSize + vSpacing;
  const teamStartX = teamCenterX - totalWidth / 2;
  const teamStartY = teamCenterY - totalHeight / 2;

  for (let i = 0; i < 8; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = teamStartX + col * (slotSize + hSpacing);
    const y = teamStartY + row * (slotSize + vSpacing);

    this.add.rectangle(x, y, slotSize - 8, slotSize - 8, 0x0a1122).setDepth(1);

    const slot = this.add.image(x, y, 'slot_team')
      .setInteractive()
      .setDisplaySize(slotSize, slotSize)
      .setDepth(10);

    this.gridSlots.push(slot);
    this.addButtonEffects(slot);

    slot.on('pointerover', () => {
      this.showTooltip(slot.x + 80, slot.y - 65, "Select a ship in your collection");
    });

    slot.on('pointerout', () => {
      this.hideTooltip();
    });

    slot.on('pointerdown', () => {
      this.openCollectionScene();
    });
  }

  // === OUTER FRAME ===
  this.add.image(960, 540, 'outer_frame')
    .setDisplaySize(1920, 1080)
    .setDepth(200);

  // === TEAM 0/8 ===
  this.teamCounterText = this.add.text(940, 730, 'TEAM: 0/8', {
    fontSize: '38px', fill: '#ffff00'
  }).setOrigin(0.5);

  // === EQUIPPED RELICS ===
  this.equippedSlotRects = [];
  const equippedY = teamCenterY + totalHeight / 2 + 80;
  const equippedTotalWidth = 3 * 128 + 2 * 40;
  const equippedStartX = teamCenterX - equippedTotalWidth / 2;

  for (let i = 0; i < 3; i++) {
    const x = equippedStartX + i * (128 + 40);
    const slot = this.add.image(x, equippedY, 'slot_equipped')
      .setDisplaySize(128, 128)
      .setDepth(10);
    this.equippedSlotRects.push(slot);
  }

  // === Buttons TEAM  ===

  // AUTO SELECT
  const btnAuto = this.add.image(790, 345, 'button_base')
    .setInteractive()
    .setDisplaySize(270, 70);
  const textAuto = this.add.text(790, 345, 'AUTO SELECT', {
    fontSize: '26px', fill: '#00ff88', fontStyle: 'bold'
  }).setOrigin(0.5);
  (btnAuto as any).linkedText = textAuto;
  btnAuto.on('pointerdown', () => this.autoSelectTeam());
  this.addButtonEffects(btnAuto);

  // CLEAR TEAM
  const btnClear = this.add.image(1100, 345, 'button_base')
    .setInteractive()
    .setDisplaySize(270, 70);
  const textClear = this.add.text(1100, 345, 'CLEAR TEAM', {
    fontSize: '26px', fill: '#ff6666', fontStyle: 'bold'
  }).setOrigin(0.5);
  (btnClear as any).linkedText = textClear;
  btnClear.on('pointerdown', () => this.clearTeam());
  this.addButtonEffects(btnClear);

  // REROLL SHOP
  const btnReroll = this.add.image(285, 445, 'button_base')
    .setInteractive()
    .setDisplaySize(270, 70);
  const textReroll = this.add.text(285, 445, 'REROLL SHOP', {
    fontSize: '26px', fill: '#ff00ff', fontStyle: 'bold'
  }).setOrigin(0.5);
  (btnReroll as any).linkedText = textReroll;
  btnReroll.on('pointerdown', () => this.rerollShop());
  this.addButtonEffects(btnReroll);

  // Collection
  const btnCollection = this.add.image(285, 900, 'button_base')
    .setInteractive()
    .setDisplaySize(270, 70);
  const textCollection = this.add.text(285, 900, 'Collection', {
    fontSize: '26px', fill: '#ffff00', fontStyle: 'bold'
  }).setOrigin(0.5);
  (btnCollection as any).linkedText = textCollection;
  btnCollection.on('pointerdown', () => this.openCollectionScene());
  this.addButtonEffects(btnCollection);

  // BUY
  const btnBuy = this.add.image(285, 805, 'button_base')
    .setInteractive()
    .setDisplaySize(270, 70);
  const textBuy = this.add.text(285, 805, 'BUY (FREE)', {
    fontSize: '26px', fill: '#00ffff', fontStyle: 'bold'
  }).setOrigin(0.5);
  (btnBuy as any).linkedText = textBuy;
  btnBuy.on('pointerdown', () => this.buyUnit());
  this.addButtonEffects(btnBuy);

  // START BATTLE
  const btnStart = this.add.image(1600, 900, 'button_start')
    .setInteractive()
    .setDisplaySize(400, 90);
  const textStart = this.add.text(1600, 900, '▶ START BATTLE', {
    fontSize: '36px', fill: '#ff3333', fontStyle: 'bold'
  }).setOrigin(0.5);
  (btnStart as any).linkedText = textStart;
  btnStart.on('pointerdown', () => this.startBattle());
  this.addButtonEffects(btnStart);
}

private async startBattle() {
  console.log('START BATTLE pressed');

  if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) {
    return alert('Connect wallet first');
  }

  if (this.team.length < 4) {
    const msg = this.add.text(960, 450, 'Minimum 4 units in team (per contract rules)', {
      fontSize: '36px', fill: '#ff4444', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(500);
    setTimeout(() => msg.destroy(), 2800);
    return;
  }

  if (this.team.length > 8) {
    const msg = this.add.text(960, 450, 'Maximum 8 units', {
      fontSize: '36px', fill: '#ff4444'
    }).setOrigin(0.5).setDepth(500);
    setTimeout(() => msg.destroy(), 2000);
    return;
  }

  try {
    console.log('Sending startMatch... team length:', this.team.length);

    const hash = await this.sendGameTransaction(
      'startMatch',
      [
        this.team.map(id => BigInt(id)),
        this.equippedRelics.map(id => BigInt(id))
      ],
      0n
    );

    console.log('TX startMatch sent:', hash);

    const waitingText = this.add.text(960, 450, 'Transaction sent. Waiting for confirmation...', {
      fontSize: '32px',
      fill: '#ffff00'
    }).setOrigin(0.5).setDepth(500);

    await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    waitingText.destroy();

    await new Promise(resolve => setTimeout(resolve, 800));
    let lastResult: any = await this.gameContract.read.getLastBattleResult([this.account]);

    if (!lastResult[3] || lastResult[3] === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      await new Promise(resolve => setTimeout(resolve, 1200));
      lastResult = await this.gameContract.read.getLastBattleResult([this.account]);
    }

    const playerWon: boolean = lastResult[0] ?? false;
    const playerMaxHpBig: bigint[] = lastResult[1] ?? [];
    const aiMaxHpBig: bigint[] = lastResult[2] ?? [];
    const battleId: string = lastResult[3] ?? '0x0';

    let playerMaxHp: number[] = Array.isArray(playerMaxHpBig) 
      ? playerMaxHpBig.map((n: bigint) => Number(n)) 
      : [];
    let aiMaxHp: number[] = Array.isArray(aiMaxHpBig) 
      ? aiMaxHpBig.map((n: bigint) => Number(n)) 
      : [];

    const playerUnitsData: any[] = [];
    for (const id of this.team) {
      try {
        const rawUnit = await this.nftContract.read.getUnit([BigInt(id)]);
        const unit = this.normalizeUnit(rawUnit);
        playerUnitsData.push({
          faction: unit.faction,
          unitClass: unit.unitClass
        });
      } catch {
        playerUnitsData.push({ faction: 0, unitClass: 0 });
      }
    }

    const aiUnitsData: any[] = [];
    try {
      const aiData: any[] = await this.gameContract.read.getCurrentAI([this.account]);
      if (aiData && Array.isArray(aiData) && aiData.length > 0) {
        for (const u of aiData) {
          aiUnitsData.push({
            faction: Number(u.faction) || 1,
            unitClass: Number(u.unitClass) || 0
          });
        }
      }
    } catch (e) {
      console.warn('getCurrentAI failed, using fallback');
    }

    while (aiUnitsData.length < 8) {
      aiUnitsData.push({ faction: 1, unitClass: 0 });
    }
    if (aiMaxHp.length < 8) aiMaxHp = new Array(8).fill(120);
    if (playerMaxHp.length === 0 && playerUnitsData.length > 0) {
      playerMaxHp = new Array(playerUnitsData.length).fill(100);
    }

    const successMsg = this.add.text(960, 380, 'BATTLE STARTED!', {
      fontSize: '48px', fill: '#00ff88', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(500);
    setTimeout(() => successMsg.destroy(), 900);

    this.scene.start('BattleScene', {
      events: lastResult[4] ?? [],
      playerWon: playerWon,
      playerMaxHp: playerMaxHp,
      aiMaxHp: aiMaxHp,
      playerUnitsData,
      aiUnitsData,
      battleId
    });

  } catch (e: any) {
    console.error('startBattle error:', e);
    const errMsg = e.shortMessage || e.message || 'Unknown error';
    const errorText = this.add.text(960, 450, `Error: ${errMsg}`, {
      fontSize: '34px', fill: '#ff4444'
    }).setOrigin(0.5).setDepth(500);
    setTimeout(() => errorText.destroy(), 4500);
  }
}


private openCollectionScene() {
  const equippedIds = this.equippedRelics.filter(id => id > 0);

  this.scene.launch('CollectionScene', {
    walletManager: this.walletManager,
    gameContract: this.gameContract,
    nftContract: this.nftContract,
    relicContract: this.relicContract,
    account: this.account,
    publicClient: this.publicClient,
    returnTo: 'PrepareScene',
    equippedRelicIds: equippedIds
  });
}

  public async addMultipleUnitsToTeam(newIds: number[]) {
    if (this.teamOperationLock || !newIds || newIds.length === 0) return;
    this.teamOperationLock = true;

    try {
      const remaining = 8 - this.team.length;
      const actuallyAdded: number[] = [];

      if (newIds.length > remaining) {
        this.clearTeam();
        const toAdd = newIds.slice(0, 8);
        for (const id of toAdd) {
          if (!this.team.includes(id)) {
            const freeSlotIndex = this.teamSlotOccupants.findIndex(slot => slot === null);
            if (freeSlotIndex !== -1) {
              this.team.push(id);
              await this.createTeamUnitVisual(id, freeSlotIndex);
              actuallyAdded.push(id);
            }
          }
        }
      } else {
        for (const id of newIds) {
          if (this.team.length >= 8) break;
          if (!this.team.includes(id)) {
            const freeSlotIndex = this.teamSlotOccupants.findIndex(slot => slot === null);
            if (freeSlotIndex !== -1) {
              this.team.push(id);
              await this.createTeamUnitVisual(id, freeSlotIndex);
              actuallyAdded.push(id);
            }
          }
        }
      }

      this.updateTeamCounter();

      const collectionScene = this.scene.get('CollectionScene') as any;
      if (collectionScene && collectionScene.scene.isActive() && actuallyAdded.length > 0) {
        collectionScene.unitsData = collectionScene.unitsData.filter((u: any) => !actuallyAdded.includes(u.id));
        if (typeof collectionScene.refreshGrid === 'function') collectionScene.refreshGrid();
      }
    } finally {
      this.teamOperationLock = false;
    }
  }

public async addMultipleRelicsToEquipped(newRelicIds: number[]) {
  if (!newRelicIds || newRelicIds.length === 0 || newRelicIds.length > 3) return;

  let equippedCopy = [...this.equippedRelics];
  let idx = 0;

  for (let i = 0; i < equippedCopy.length && idx < newRelicIds.length; i++) {
    if (equippedCopy[i] === 0) equippedCopy[i] = newRelicIds[idx++];
  }

  for (let i = 0; idx < newRelicIds.length && i < equippedCopy.length; i++) {
    equippedCopy[i] = newRelicIds[idx++];
  }

  this.equippedRelics = equippedCopy;
  await this.refreshRelics();

  const msg = this.add.text(600, 450, `RELICS ACTIVATED (${newRelicIds.length})`, {
    fontSize: '42px', fill: '#00ff88'
  }).setOrigin(0.5);
  setTimeout(() => msg.destroy(), 2200);
}

private async createTeamUnitVisual(tokenId: number, slotIndex: number) {
  if (!this.nftContract || !this.gridSlots[slotIndex]) return;

  try {
    const rawUnit = await this.nftContract.read.getUnit([BigInt(tokenId)]);
    const unit = this.normalizeUnit(rawUnit);

    const slot = this.gridSlots[slotIndex];
    const style = this.getRarityTintAndScale(unit.rarity);
    const shipKey = this.getShipKey(unit.faction, unit.unitClass);
    const rarityNum = unit.rarity;
    const baseScale = style.scale * 0.42;
    const finalShipScale = baseScale * 0.75;

    const container = UnitVisualFactory.createUnitWithFrame(
      this, slot.x, slot.y, shipKey, rarityNum, baseScale, 0.75
    );

    const ship = container.getAt(container.length - 1) as Phaser.GameObjects.Sprite;

    if (!ship) {
      container.destroy();
      return;
    }

    (container as any).tokenId = tokenId;
    (container as any).unit = unit;
    (container as any).teamSlotIndex = slotIndex;

    ship.setInteractive().setDepth(8);
    container.setDepth(8);

    this.teamSlotOccupants[slotIndex] = container;

    if ((slot as any).pulseTween) {
      (slot as any).pulseTween.stop();
      (slot as any).pulseTween = null;
    }
    slot.disableInteractive();

    this.originalPositions.set(tokenId, { x: slot.x, y: slot.y });

    this.tweens.add({
      targets: ship,
      scale: ship.scale * 1.04,
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const originalWidth = slot.displayWidth;
    const originalHeight = slot.displayHeight;

    ship.on('pointerover', () => {
      const tooltipText = `${this.getFactionName(unit.faction)} ${this.getRarityName(unit.rarity)} ${this.getClassName(unit.unitClass)}\nATK ${unit.attack} DEF ${unit.defense} SPD ${unit.speed}`;
      this.showTooltip(slot.x + 80, slot.y - 65, tooltipText);
    });

    ship.on('pointerout', () => this.hideTooltip());

    ship.on('pointerdown', () => {
      const now = Date.now();
      if (now - this.lastClickTime < 300) {
        this.removeFromTeam(slotIndex);
      }
      this.lastClickTime = now;
    });

    this.input.setDraggable(ship);

    ship.on('dragstart', () => {
      container.setDepth(30);
      ship.setScale(style.scale * 1.15);
      slot.setDisplaySize(originalWidth, originalHeight);
    });

    ship.on('drag', (_: any, dragX: number, dragY: number) => {
      container.x = dragX;
      container.y = dragY;
    });

    ship.on('dragend', () => {
      container.setDepth(8);
      ship.setScale(finalShipScale);

      let droppedOnSlot = false;
      for (let s = 0; s < 8; s++) {
        if (s === slotIndex) continue;
        const targetSlot = this.gridSlots[s];
        const dx = targetSlot.x - container.x;
        const dy = targetSlot.y - container.y;
        if (Math.sqrt(dx * dx + dy * dy) < 90) {
          const temp = this.team[slotIndex];
          this.team[slotIndex] = this.team[s];
          this.team[s] = temp;
          this.clearTeamVisuals();
          this.rebuildTeamVisuals();
          droppedOnSlot = true;
          break;
        }
      }
      if (!droppedOnSlot) {
        this.removeFromTeam(slotIndex);
      } else {
        container.x = this.gridSlots[slotIndex].x;
        container.y = this.gridSlots[slotIndex].y;
      }
    });

  } catch (e) {
    console.error(`createTeamUnitVisual error for ${tokenId}:`, e);
    this.team = this.team.filter(id => id !== tokenId);
    this.teamSlotOccupants[slotIndex] = null;
    const slot = this.gridSlots[slotIndex];
    if (slot) {
      slot.setInteractive();
      if (!(slot as any).pulseTween) {
        const pulse = this.tweens.add({
          targets: slot,
          scaleX: 1.03,
          scaleY: 1.03,
          duration: 1300,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        (slot as any).pulseTween = pulse;
      }
    }
    if (this.teamCounterText) this.teamCounterText.setText(`TEAM: ${this.team.length}/8`);
  }
}

  private removeFromTeam(slotIndex: number) {
    const occupant = this.teamSlotOccupants[slotIndex];
    if (!occupant) return;

    const tokenId = (occupant as any).tokenId;

    this.team = this.team.filter(id => id !== tokenId);
    occupant.destroy();
    this.teamSlotOccupants[slotIndex] = null;
    this.originalPositions.delete(tokenId);
    this.updateTeamCounter();

    const teamSlot = this.gridSlots[slotIndex];
    if (teamSlot) {
      teamSlot.setInteractive();

      const pulse = this.tweens.add({
        targets: teamSlot,
        scaleX: 1.03,
        scaleY: 1.03,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      (teamSlot as any).pulseTween = pulse;
    }

    const collectionScene = this.scene.get('CollectionScene') as any;
    if (collectionScene && collectionScene.scene.isActive()) {
      const alreadyExists = collectionScene.unitsData.some((u: any) => u.id === tokenId);
      if (!alreadyExists) {
        collectionScene.unitsData.push({
          id: tokenId,
          unit: (occupant as any).unit || null,
          inTeam: false
        });
        if (typeof collectionScene.applyFiltersAndSort === 'function') {
          collectionScene.applyFiltersAndSort();
        } else if (typeof collectionScene.refreshGrid === 'function') {
          collectionScene.refreshGrid();
        }
      }
    }
  }

  public returnUnitToCollection(unitId: number) {
    const collectionScene = this.scene.get('CollectionScene') as any;
    if (collectionScene && collectionScene.scene.isActive()) {
      collectionScene.loadCollectionData();
    }
  }

  public returnRelicToCollection(relicId: number) {
    const collectionScene = this.scene.get('CollectionScene') as any;
    if (collectionScene && collectionScene.scene.isActive()) {
      collectionScene.loadCollectionData();
    }
  }

  private clearTeamVisuals() {
    this.teamSlotOccupants.forEach(occupant => {
      if (occupant) occupant.destroy();
    });
    this.teamSlotOccupants = new Array(8).fill(null);
  }

  private async rebuildTeamVisuals() {
    for (let i = 0; i < this.team.length; i++) {
      if (this.team[i]) {
        await this.createTeamUnitVisual(this.team[i], i);
      }
    }
    this.updateTeamCounter();
  }

  private getShipKey(faction: number, unitClass: number): string {
    const map: Record<string, string> = {
      '0_0': 'emperial_fighter', '0_1': 'emperial_cruiser', '0_2': 'emperial_dreadnought', '0_3': 'emperial_droneswarm',
      '1_0': 'voidborn_fighter', '1_1': 'voidborn_cruiser', '1_2': 'voidborn_dreadnought', '1_3': 'voidborn_droneswarm',
      '2_0': 'mechanoid_fighter', '2_1': 'mechanoid_cruiser', '2_2': 'mechanoid_dreadnought', '2_3': 'mechanoid_droneswarm',
    };
    return map[`${faction}_${unitClass}`] || 'emperial_fighter';
  }

  private getRarityTintAndScale(rarity: number) {
    if (rarity === 2) return { tint: 0xffee00, scale: 0.89 };
    if (rarity === 1) return { tint: 0x00ff77, scale: 0.84 };
    return { tint: 0x44aaff, scale: 0.78 };
  }

  private updateTeamCounter() {
    if (this.teamCounterText) this.teamCounterText.setText(`TEAM: ${this.team.length}/8`);
  }

private addButtonEffects(obj: Phaser.GameObjects.GameObject, scale: number = 1.08) {
  const img = obj as Phaser.GameObjects.Image;
  const originalWidth = img.displayWidth;
  const originalHeight = img.displayHeight;

  const hoverWidth = originalWidth * scale;
  const hoverHeight = originalHeight * scale;

  obj.on('pointerover', () => {
    this.tweens.add({
      targets: img,
      displayWidth: hoverWidth,
      displayHeight: hoverHeight,
      duration: 120,
      ease: 'Sine.easeOut'
    });

    const text = (obj as any).linkedText as Phaser.GameObjects.Text;
    if (text) {
      if (!(text as any).originalFill) {
        (text as any).originalFill = text.style.color;
      }
      text.setFill('#ffff88');
      // scale текста убрали — теперь не съезжает
    }
  });

  obj.on('pointerout', () => {
    this.tweens.add({
      targets: img,
      displayWidth: originalWidth,
      displayHeight: originalHeight,
      duration: 120,
      ease: 'Sine.easeOut'
    });

    const text = (obj as any).linkedText as Phaser.GameObjects.Text;
    if (text) {
      text.setFill((text as any).originalFill || '#ffffff');
    }
  });

  obj.on('pointerdown', () => {
    this.tweens.add({
      targets: img,
      displayWidth: originalWidth * 0.95,
      displayHeight: originalHeight * 0.95,
      duration: 60,
      ease: 'Sine.easeOut'
    });
  });

  obj.on('pointerup', () => {
    this.tweens.add({
      targets: img,
      displayWidth: hoverWidth,
      displayHeight: hoverHeight,
      duration: 80,
      ease: 'Sine.easeOut'
    });
  });
}

private async cleanupInvalidTeamIds() {
  if (!this.nftContract || this.team.length === 0) return;

  const validTeam: number[] = [];

  for (const id of this.team) {
    try {
      await this.nftContract.read.getUnit([BigInt(id)]);
      validTeam.push(id);
    } catch {
      console.log(`Removing non-existent token from team: ${id}`);
    }
  }

  this.team = validTeam;
  this.clearTeamVisuals();

  if (this.teamCounterText) this.teamCounterText.setText(`TEAM: ${this.team.length}/8`);
}

  public addSingleUnitToTeam(unitId: number): boolean {
    if (this.team.length >= 8 || this.team.includes(unitId)) return false;

    const freeSlotIndex = this.teamSlotOccupants.findIndex(slot => slot === null);
    if (freeSlotIndex === -1) return false;

    this.team.push(unitId);
    this.createTeamUnitVisual(unitId, freeSlotIndex);
    this.updateTeamCounter();

    const collectionScene = this.scene.get('CollectionScene') as any;
    if (collectionScene && collectionScene.scene.isActive()) {
      collectionScene.unitsData = collectionScene.unitsData.filter((u: any) => u.id !== unitId);
      if (typeof collectionScene.applyFiltersAndSort === 'function') collectionScene.applyFiltersAndSort();
    }

    return true;
  }

public equipSingleRelic(relicId: number): boolean {
  for (let i = 0; i < 3; i++) {
    if (this.equippedRelics[i] === 0) {
      this.equippedRelics[i] = relicId;
      this.refreshRelics();

      // Обновляем equippedRelicIds в открытой CollectionScene
      const collectionScene = this.scene.get('CollectionScene') as any;
      if (collectionScene && collectionScene.scene.isActive()) {
        collectionScene.equippedRelicIds = [...this.equippedRelics];
        collectionScene.refreshGrid();
      }

      return true;
    }
  }
  return false;
}

  shutdown() {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
    this.hideTooltip();

    this.ownedSprites.forEach(s => s.destroy());
    this.shopSprites.forEach(s => s.destroy());
    this.aiSprites.forEach(s => s.destroy());
    this.aiTexts.forEach(t => t.destroy());
    this.equippedTexts.forEach(t => t.destroy());
    this.equippedTexts = [];

    if (this.playerLevelText) this.playerLevelText.destroy();
    if (this.playerStatsText) this.playerStatsText.destroy();

    console.log('✅ PrepareScene shutdown');
  }
}