// @ts-nocheck
// frontend/src/scenes/PrepareScene.ts
import * as Phaser from 'phaser';
import { getContract, parseEventLogs, encodeFunctionData } from 'viem';
import type { WalletClient } from 'viem';
import { PLAYER_PROFILE_ADDRESS, GAME_ADDRESS, NFT_ADDRESS, RELIC_ADDRESS, CHAIN_ID } from '../lib/contractAddresses';
import { gameAbi, nftAbi, relicAbi, profileAbi } from '../lib/abis';
import { somniaTestnet } from '../lib/wagmiConfig';
import WalletManager from '../lib/WalletManager';
import { UnitVisualFactory } from '../utils/UnitVisualFactory';
import {
  HUD,
  PREPARE_LAYOUT,
  hudText,
  displayText,
  gridFirstCenter,
  plateWell,
  relicMeta,
  relicEffect,
  factionName,
  className,
  rarityName,
  rarityColor,
  shipKey
} from '../utils/HudChrome';
import {
  loadPrepareSession,
  savePrepareSession,
  emptyTeamSlots,
  compactTeamIds,
  filledTeamCount,
  alignTeamToSlots,
  alignRelicSlots,
  isFilledSlot,
  EMPTY_TEAM_SLOT
} from '../lib/prepareSession';
import { LORE_LOG, loreByIndex, loreIndexForContext } from '../lib/lore';
import { gameAudio } from '../lib/gameAudio';
import { normalizeUnit, type NormalizedUnit } from '../lib/unitNormalize';
import { addButtonEffects } from '../utils/uiFactory';
import { preloadRelicsAndFrames, preloadShipPortraits } from '../utils/preloadGameAssets';
import {
  evaluateAchievements,
  unlockAchievement,
  type AchievementDef
} from '../lib/achievements';
import {
  addMetaButtons,
  attachAudioUnlock,
  beginOrResumeTutorial,
  showAchievementPanel,
  showAchievementToasts
} from '../utils/MetaHud';


export default class PrepareScene extends Phaser.Scene {
  
async init(data?: any) {
  this.walletManager = data?.walletManager || window.walletManager || WalletManager.getInstance();
  this.walletManager.restoreFromWindow();

  this.account = data?.account || this.walletManager.account || window.account || null;
  this.publicClient = data?.publicClient || this.walletManager.getPublicClient() || window.publicClient || null;
  this.walletClient = data?.walletClient || this.walletManager.getWalletClient() || window.walletClient || null;

  if (!this.account || !this.publicClient || !this.walletClient) {
    console.error('PrepareScene blocked: wallet is not connected');
    this.isWalletReady = false;
    return;
  }

  this.walletManager.setSession({
    account: this.account,
    publicClient: this.publicClient,
    walletClient: this.walletClient
  });
  this.isWalletReady = true;
  this.createContracts();

  if (Array.isArray(data?.savedTeam) && data.savedTeam.length > 0 && this.account) {
    savePrepareSession(this.account, { team: data.savedTeam.map((id: unknown) => Number(id)) });
  }

  if (data?.addUnits && Array.isArray(data.addUnits)) {
    this.pendingAddUnits = data.addUnits.map((id: unknown) => Number(id)).filter((id: number) => isFilledSlot(id));
  }

  if (data?.lastBattleResult && typeof data.lastBattleResult.won === 'boolean') {
    this.pendingLastResult = data.lastBattleResult;
  }
}




  private walletManager: WalletManager;
  private gameContract: any;
  private nftContract: any;
  private relicContract: any;
  private account: `0x${string}` | null = null;
  private publicClient: any;
  private walletClient: WalletClient | null = null;
  private shopContainer: Phaser.GameObjects.Container | null = null;
  private equippedTexts: Phaser.GameObjects.Text[] = [];

  private team: number[] = emptyTeamSlots();
  private playerUnitIds: number[] = [];
  private equippedRelics: number[] = [0, 0, 0];
  private isWalletReady = false;
  private shopSprites: Phaser.GameObjects.Sprite[] = [];
  private gridSlots: Phaser.GameObjects.Rectangle[] = [];
  private tooltip: Phaser.GameObjects.Text | null = null;
  private lastClickTime = 0;
  private teamSlotOccupants: (Phaser.GameObjects.GameObject | null)[] = [];
  private aiSprites: Phaser.GameObjects.Sprite[] = [];
  private equippedSlotRects: Phaser.GameObjects.Rectangle[] = [];
  private equippedSprites: Phaser.GameObjects.GameObject[] = [];
  private aiGridSlots: Phaser.GameObjects.Rectangle[] = [];
  private playerLevelText: Phaser.GameObjects.Text | null = null;
  private playerStatsText: Phaser.GameObjects.Text | null = null;
  private teamCounterText: Phaser.GameObjects.Text | null = null;
  private teamOperationLock = false;
  private shopTexts: Phaser.GameObjects.Text[] = [];
  private rerollsLeftText: Phaser.GameObjects.Text | null = null;
  private sceneMessage?: { panel: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text };
  private fleetHintText: Phaser.GameObjects.Text | null = null;
  private aiTitleText: Phaser.GameObjects.Text | null = null;
  private pendingShipsText: Phaser.GameObjects.Text | null = null;
  private teamReady = false;
  private matchBusy = false;
  private txBusy = false;
  private unitCache = new Map<number, NormalizedUnit>();
  private pendingAddUnits: number[] = [];
  private busyOverlay: Phaser.GameObjects.Container | null = null;
  private levelProgressBar: Phaser.GameObjects.Rectangle | null = null;
  private pendingLastResult: { won: boolean; playerAlive?: number; aiAlive?: number } | null = null;
  private lastProfile = { level: 0, wins: 0, losses: 0, relics: 0 };
  private loreIndex = 0;
  private loreTitleText: Phaser.GameObjects.Text | null = null;
  private loreBodyText: Phaser.GameObjects.Text | null = null;
  private lorePageText: Phaser.GameObjects.Text | null = null;
  private loreUserPicked = false;

  constructor() {
    super({ key: 'PrepareScene' });
    this.walletManager = WalletManager.getInstance();
  }

  

private createContracts() {
  if (!this.account || !this.publicClient) {
    console.error('Cannot create contracts — account or publicClient missing');
    return;
  }

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


private clearSceneMessage() {
  if (this.sceneMessage) {
    this.sceneMessage.panel.destroy();
    this.sceneMessage.text.destroy();
    this.sceneMessage = undefined;
  }
}

private showSceneMessage(text: string, color = '#ff7b8a', duration = 2800) {
  this.clearSceneMessage();
  const panel = this.add.rectangle(960, 450, 980, 92, 0x080d16, 0.92)
    .setStrokeStyle(1, 0x5ee7ff, 0.28)
    .setDepth(970);
  const msg = this.add.text(960, 450, text, hudText({
    fontSize: '24px',
    fill: color,
    wordWrap: { width: 900 },
    align: 'center'
  })).setOrigin(0.5).setDepth(971);
  this.sceneMessage = { panel, text: msg };
  if (color === '#ff7b8a' || color === '#ff4444') {
    gameAudio.error();
  }
  this.time.delayedCall(duration, () => {
    if (this.sceneMessage && this.sceneMessage.text === msg) {
      this.clearSceneMessage();
    }
  });
  return msg;
}

private flashMedals(unlocked: AchievementDef[]): void {
  showAchievementToasts(this, unlocked);
}

private noteProgress(): void {
  if (!this.account) {
    return;
  }
  this.flashMedals(evaluateAchievements(this.account, {
    level: this.lastProfile.level,
    wins: this.lastProfile.wins,
    losses: this.lastProfile.losses,
    units: this.playerUnitIds.length,
    relics: this.lastProfile.relics,
    fleet: filledTeamCount(this.team)
  }));
}

private noteMedal(id: Parameters<typeof unlockAchievement>[1]): void {
  if (!this.account) {
    return;
  }
  const unlocked = unlockAchievement(this.account, id);
  if (unlocked) {
    this.flashMedals([unlocked]);
  }
}

private reloadOpenCollection() {
  const collectionScene = this.scene.get('CollectionScene') as any;
  if (collectionScene?.scene?.isActive() && typeof collectionScene.loadCollectionData === 'function') {
    return collectionScene.loadCollectionData();
  }
}

private showBusyOverlay(text: string) {
  this.hideBusyOverlay();
  const veil = this.add.rectangle(960, 540, 1920, 1080, 0x050010, 0.58)
    .setDepth(960)
    .setInteractive();
  const panel = this.add.rectangle(960, 520, 920, 110, 0x080614, 0.88)
    .setStrokeStyle(1, 0xf6e27a, 0.3)
    .setDepth(961);
  const label = this.add.text(960, 520, text, hudText({
    fontSize: '28px',
    fill: HUD.color.warn,
    align: 'center',
    wordWrap: { width: 860 }
  })).setOrigin(0.5).setDepth(962);
  this.busyOverlay = this.add.container(0, 0, [veil, panel, label]).setDepth(960);
}

private hideBusyOverlay() {
  this.busyOverlay?.destroy(true);
  this.busyOverlay = null;
}

private async readPayablePrice(functionName: string, fallback: bigint): Promise<bigint> {
  try {
    const value = await this.gameContract.read[functionName]();
    if (typeof value === 'bigint' && value > 0n) {
      return value;
    }
  } catch (error) {
    console.error(`Failed to read ${functionName}`, error);
  }
  return fallback;
}

private async sendGameTransaction(
  functionName: string,
  args: any[] = [],
  value: bigint = 0n,
  options: { silent?: boolean } = {}
) {
  const walletClient = this.walletClient || this.walletManager.getWalletClient();
  if (!this.gameContract || !this.account || !this.publicClient || !walletClient) {
    if (!options.silent) {
      this.showSceneMessage('Connect wallet first');
    }
    throw new Error('Contract or wallet not ready');
  }

  const chainId = Number(walletClient.chain?.id ?? this.walletManager.chainId);
  if (chainId !== CHAIN_ID) {
    if (!options.silent) {
      this.showSceneMessage('Switch to Somnia Testnet (50312)');
    }
    throw new Error('Wrong chain');
  }

  try {
    await this.publicClient.simulateContract({
      address: this.gameContract.address,
      abi: this.gameContract.abi,
      functionName,
      args,
      account: this.account,
      value
    });

    let gas = await this.publicClient.estimateContractGas({
      address: this.gameContract.address,
      abi: this.gameContract.abi,
      functionName,
      args,
      account: this.account,
      value
    });
    gas = (gas * 13n) / 10n;
    if (functionName === 'startMatch' && gas < 12_000_000n) {
      gas = 12_000_000n;
    }

    const data = encodeFunctionData({
      abi: this.gameContract.abi,
      functionName,
      args
    });

    return await walletClient.sendTransaction({
      account: this.account,
      chain: somniaTestnet,
      to: this.gameContract.address,
      data,
      value,
      gas
    });
  } catch (err: any) {
    console.error('sendGameTransaction ERROR:', err);
    if (!options.silent) {
      const errMsg = err.cause?.reason || err.shortMessage || err.message || 'Transaction failed';
      this.showSceneMessage(String(errMsg));
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

    this.load.image('ui_titlebar', 'assets/ui/ui_titlebar.png');
    this.load.image('ui_plate', 'assets/ui/ui_plate.png');
    this.load.image('ui_result', 'assets/ui/ui_result.png');

    this.load.image('logo', 'assets/background/logo.png');
    preloadShipPortraits(this);
    preloadRelicsAndFrames(this);
  }

create() {
  this.team = emptyTeamSlots();
  this.teamSlotOccupants = new Array(8).fill(null);
  this.equippedRelics = [0, 0, 0];
  this.equippedSprites = [];
  this.equippedTexts = [];
  this.teamOperationLock = false;
  this.teamReady = false;
  this.matchBusy = false;
  this.txBusy = false;
  this.hideBusyOverlay();

  this.addGameUI();
  attachAudioUnlock(this);

  if (!this.isWalletReady) {
    const veil = this.add.rectangle(960, 540, 1920, 1080, 0x02040a, 0.62).setDepth(400);
    const plate = this.add.rectangle(960, 520, 760, 180, 0x080d16, 0.94)
      .setStrokeStyle(1, 0x5ee7ff, 0.35)
      .setDepth(401);
    const prompt = this.add.text(960, 500, 'CONNECT WALLET TO PLAY', displayText({
      fontSize: '28px', fill: HUD.color.accent
    })).setOrigin(0.5).setDepth(402).setInteractive({ useHandCursor: true });
    const hint = this.add.text(960, 548, 'Somnia Testnet  ·  50312', hudText({
      fontSize: HUD.SMALL, fill: HUD.color.muted
    })).setOrigin(0.5).setDepth(402);
    prompt.on('pointerdown', () => {
      if (window.openWalletModal) {
        window.openWalletModal();
      }
    });
    veil.setInteractive();
    plate.setInteractive();
    return;
  }

  this.initEquippedState();
  this.loadOwnedUnits().then(async () => {
    await this.restoreSavedTeam();
    this.teamReady = true;
    this.updateTeamCounter();
    if (this.pendingAddUnits.length > 0) {
      const extra = this.pendingAddUnits;
      this.pendingAddUnits = [];
      await this.addMultipleUnitsToTeam(extra);
    }
    await this.updatePlayerProfile();
  });
  this.loadPlayerShop();
  this.loadCurrentAI();

  this.input.topOnly = true;
  this.bindPrepareHotkeys();
  if (this.account) {
    this.time.delayedCall(500, () => {
      if (this.account) {
        beginOrResumeTutorial(this, this.account, 'PrepareScene');
      }
    });
  }

  if (this.pendingLastResult) {
    const won = this.pendingLastResult.won;
    const playerAlive = this.pendingLastResult.playerAlive;
    const suffix = typeof playerAlive === 'number' ? `  ·  ${playerAlive} ships left` : '';
    this.showSceneMessage(
      (won ? 'Last battle: VICTORY' : 'Last battle: DEFEAT') + suffix,
      won ? '#6dffc0' : '#ff7b8a',
      3400
    );
    this.pendingLastResult = null;
  }
}

private async getCachedUnit(tokenId: number): Promise<NormalizedUnit> {
  const cached = this.unitCache.get(tokenId);
  if (cached) {
    return cached;
  }
  const rawUnit = await this.nftContract.read.getUnit([BigInt(tokenId)]);
  const unit = normalizeUnit(rawUnit);
  this.unitCache.set(tokenId, unit);
  return unit;
}

private safeBigIntToNumber(value: bigint | number | undefined): number {
  if (value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    console.warn('BigInt out of safe integer range, defaulting to 0');
    return 0;
  }
  return Number(value);
}


private async loadOwnedUnits() {
  if (!this.account || !this.gameContract || !this.nftContract) return;

  try {
    const ownedIds: bigint[] = await this.gameContract.read.getPlayerUnits([this.account]);
    this.playerUnitIds = ownedIds.map(id => Number(id));

    this.team = this.team.map((id) => (isFilledSlot(id) && this.playerUnitIds.includes(id) ? id : EMPTY_TEAM_SLOT));
    if (this.teamReady) {
      this.updateTeamCounter();
    } else if (this.teamCounterText) {
      this.teamCounterText.setText(`YOUR FLEET  ${filledTeamCount(this.team)}/8`);
    }
    this.refreshFleetHint();

  } catch (e) {
    console.error('loadOwnedUnits error', e);
  }
}

private async loadPlayerShop() {
  if (!this.account || !this.gameContract) return;

  if (this.shopContainer) {
    this.shopContainer.destroy(true);
    this.shopContainer = null;
  }
  this.shopSprites = [];
  this.shopTexts = [];

  try {
    const shopData: any[] = await this.gameContract.read.getPlayerShop([this.account]);
    const relicPrice = await this.readPayablePrice('buyRelicShopPrice', 8000000000000000n);
    const priceLabel = `${Number(relicPrice) / 1e18} ETH`;

    this.shopContainer = this.add.container(0, 0).setDepth(11);

    const shopSlotSize = HUD.SHOP;
    const shopSpacing = PREPARE_LAYOUT.shopGap;
    const shopStartX = gridFirstCenter(PREPARE_LAYOUT.leftX, 3, shopSlotSize, shopSpacing);
    const shopY = PREPARE_LAYOUT.shopY;

    for (let i = 0; i < 3; i++) {
      const item = shopData[i] || { isRelic: false, relicType: 0, relicValue: 0 };
      const x = shopStartX + i * (shopSlotSize + shopSpacing);
      const y = shopY;
      const filled = !!(item.isRelic && item.relicValue > 0);
      const meta = relicMeta(Number(item.relicType));

      const slotImage = this.add.image(x, y, 'slot_shop')
        .setInteractive({ useHandCursor: filled })
        .setDisplaySize(shopSlotSize, shopSlotSize)
        .setDepth(10)
        .setAlpha(filled ? 1 : 0.72);
      this.shopContainer.add(slotImage);

      let tooltipText = filled
        ? `${meta.name}\n+${item.relicValue} ${relicEffect(item.relicType)}\nBuy ${priceLabel}`
        : 'Empty. Reroll to fill the shop.';

      if (filled) {
        const sprite = this.add.sprite(x, y - 6, meta.key)
          .setDisplaySize(70, 70)
          .setDepth(11);
        this.shopContainer.add(sprite);
        this.shopSprites.push(sprite);
      }

      const caption = this.add.text(
        x,
        y + HUD.SHOP / 2 + 12,
        filled ? `+${item.relicValue} ${meta.name}` : 'EMPTY',
        hudText({
          fontSize: '13px',
          fill: filled ? '#e080ff' : HUD.color.muted,
          align: 'center',
          wordWrap: { width: HUD.SHOP + 16 }
        })
      ).setOrigin(0.5).setDepth(12);
      this.shopContainer.add(caption);
      this.shopTexts.push(caption);

      if (filled) {
        const priceText = this.add.text(x, y + HUD.SHOP / 2 + 46, `BUY  ${priceLabel}`, hudText({
          fontSize: '13px',
          fill: HUD.color.gold
        })).setOrigin(0.5).setDepth(12);
        this.shopContainer.add(priceText);
        this.shopTexts.push(priceText);
      }

      slotImage.on('pointerover', () => this.showTooltip(x + 120, y - 36, tooltipText));
      slotImage.on('pointerout', () => this.hideTooltip());
      if (filled) {
        slotImage.on('pointerdown', () => this.buyFromShopSlot(i));
      } else {
        slotImage.setInteractive({ useHandCursor: true });
        slotImage.on('pointerdown', () => this.rerollShop());
      }

    }

  } catch (e) {
    console.error('loadPlayerShop error', e);
  }
}



  private beginWalletTx(): boolean {
    if (this.txBusy || this.matchBusy) {
      return false;
    }
    this.txBusy = true;
    return true;
  }

  private endWalletTx(): void {
    this.txBusy = false;
  }

  private persistEquippedRelics() {
    if (!this.account) {
      return;
    }
    savePrepareSession(this.account, { relics: this.equippedRelics });
    if (this.equippedRelics.some((id) => id > 0)) {
      this.noteMedal('relic_slotted');
    }
  }

  private async initEquippedState() {
    if (!this.account || !this.gameContract) return;
    try {
      const saved = loadPrepareSession(this.account);
      let nextRelics: number[];
      if (saved && Array.isArray(saved.relics)) {
        nextRelics = alignRelicSlots(saved.relics);
      } else {
        const equipped: bigint[] = await this.gameContract.read.getEquippedRelics([this.account]);
        nextRelics = alignRelicSlots(equipped.map((id) => Number(id)));
      }
      try {
        const ownedRaw: bigint[] = await this.gameContract.read.getPlayerRelics([this.account]);
        const owned = new Set(ownedRaw.map((id) => Number(id)));
        nextRelics = nextRelics.map((id) => (id > 0 && owned.has(id) ? id : 0));
      } catch {
        // Keep the local loadout if the ownership read fails.
      }
      this.equippedRelics = alignRelicSlots(nextRelics);
      await this.loadEquippedRelics();
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

      const meta = relicMeta(Number(relicData.relicType));
      const relicKey = meta.key;

      const sprite = this.add.sprite(slot.x, slot.y - 6, relicKey)
        .setDisplaySize(78, 78)
        .setInteractive({ useHandCursor: true })
        .setDepth(12);

      const caption = this.add.text(slot.x, slot.y + HUD.RELIC / 2 + 12, `+${relicData.value} ${meta.name}`, hudText({
        fontSize: '13px',
        fill: '#e080ff',
        align: 'center',
        wordWrap: { width: HUD.RELIC + 24 }
      })).setOrigin(0.5).setDepth(13);
      this.equippedTexts.push(caption);

      (sprite as any).relicId = relicId;
      (sprite as any).isEquipped = true;
      (sprite as any).slotIndex = i;

      slot.setData('equippedSprite', sprite);
      this.equippedSprites.push(sprite);

      sprite.on('pointerover', () => {
        this.showTooltip(slot.x + 70, slot.y - 50,
          `${relicData.name || meta.name}\n+${relicData.value} ${relicEffect(relicData.relicType)}\nClick to unequip · drag to swap`);
      });
      sprite.on('pointerout', () => this.hideTooltip());

      this.input.setDraggable(sprite);

      let dragStartX = 0;
      let dragStartY = 0;

      sprite.on('dragstart', (pointer: Phaser.Input.Pointer) => {
        dragStartX = pointer.x;
        dragStartY = pointer.y;
        sprite.setDepth(30);
        sprite.setDisplaySize(92, 92);
      });

      sprite.on('drag', (_: any, dragX: number, dragY: number) => {
        sprite.x = dragX;
        sprite.y = dragY;
      });

      sprite.on('dragend', async (pointer: Phaser.Input.Pointer) => {
        sprite.setDisplaySize(80, 80);
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
            await this.loadEquippedRelics();
            this.persistEquippedRelics();
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
    await this.loadEquippedRelics();
    this.persistEquippedRelics();
  }

  private async unequipRelic(slotIndex: number) {
    if (slotIndex < 0 || slotIndex > 2) return;
    const relicId = this.equippedRelics[slotIndex];
    if (relicId === 0) return;

    this.equippedRelics[slotIndex] = 0;
    await this.loadEquippedRelics();
    this.persistEquippedRelics();

    const collectionScene = this.scene.get('CollectionScene') as any;
    if (collectionScene && collectionScene.scene.isActive()) {
      if (typeof collectionScene.loadCollectionData === 'function') {
        collectionScene.loadCollectionData();
      }
    }
  }

private async loadCurrentAI() {
  if (!this.account || !this.gameContract) {
    console.warn('loadCurrentAI: no account or gameContract');
    return;
  }

  if (!this.aiGridSlots || this.aiGridSlots.length === 0) {
    console.warn('loadCurrentAI: aiGridSlots not ready');
    return;
  }

  this.aiSprites.forEach(s => { try { s?.destroy(); } catch (e) {} });
  this.aiSprites = [];

  this.aiGridSlots.forEach(slot => {
    const old = slot.getData('aiSprite');
    if (old) { try { old.destroy(); } catch (e) {} slot.setData('aiSprite', null); }
  });

  try {
    const aiData: any[] = await this.gameContract.read.getCurrentAI([this.account]);

    const empty = !aiData || !Array.isArray(aiData) || aiData.every((unit: any) => {
      return !unit || (Number(unit.attack) === 0 && Number(unit.defense) === 0 && Number(unit.speed) === 0);
    });

    if (this.aiTitleText) {
      this.aiTitleText.setText(empty ? 'ENEMY FLEET' : 'LAST ENEMY FLEET');
    }
    this.seedLoreIfNeeded(!empty);

    if (empty) {
      this.setEnemySlotsVisible(false);
      this.showEnemyFleetCard(
        'SHADOW FLEET',
        'Waiting for the first battle.'
      );
      return;
    }

    this.setEnemySlotsVisible(true);

    for (let i = 0; i < 8; i++) {
      const slot = this.aiGridSlots[i];
      if (!slot || i >= aiData.length) continue;

      const unit = aiData[i];
      if (!unit || unit.isRelic) continue;

      const shipTexture = shipKey(Number(unit.faction), Number(unit.unitClass));

      const container = UnitVisualFactory.createUnitWithFrame(
        this, slot.x, slot.y, shipTexture, Number(unit.rarity), 96
      );

      const ship = container.getAt(container.length - 1) as Phaser.GameObjects.Sprite;
      if (!ship) { container.destroy(); continue; }

      (ship as any).unit = unit;
      ship.setInteractive().setDepth(8);
      container.setDepth(8);

      slot.setData('aiSprite', container);
      this.aiSprites.push(container);

      const tooltipText = `${factionName(Number(unit.faction))} ${rarityName(Number(unit.rarity))} ${className(Number(unit.unitClass))}\nATK ${unit.attack} DEF ${unit.defense} SPD ${unit.speed}`;
      ship.on('pointerover', () => this.showTooltip(slot.x + 55, slot.y - 45, tooltipText));
      ship.on('pointerout', () => this.hideTooltip());
    }

  } catch (e) {
    console.error('loadCurrentAI error:', e);
    this.setEnemySlotsVisible(false);
    this.showEnemyFleetCard('ENEMY FLEET', 'Could not load the last enemy team.', true);
  }
}

private setEnemySlotsVisible(visible: boolean) {
  this.aiGridSlots.forEach((slot) => {
    slot.setVisible(visible);
    slot.setAlpha(visible ? 1 : 0);
    if (visible) {
      slot.setInteractive();
    } else {
      slot.disableInteractive();
    }
  });
}

private addLorePanel() {
  const L = PREPARE_LAYOUT;
  const x = L.rightX;
  const y = L.loreY;
  const plateW = 500;
  const plateH = 360;
  // extra.top pushes every line off the slanted top bevel.
  const well = plateWell(x, y, plateW, plateH, { left: 12, right: 12, top: 18, bottom: 12 });

  this.add.image(x, y, 'ui_plate')
    .setDisplaySize(plateW, plateH)
    .setAlpha(0.95)
    .setDepth(11);
  const hit = this.add.rectangle(
    (well.left + well.right) / 2,
    (well.top + well.bottom) / 2,
    well.width,
    well.height,
    0x080d16,
    0.01
  )
    .setInteractive({ useHandCursor: true })
    .setDepth(14);

  this.add.text(well.left, well.top, 'ECHO LOG', displayText({
    fontSize: '16px',
    fill: HUD.color.gold
  })).setOrigin(0, 0).setDepth(13);
  this.lorePageText = this.add.text(well.right, well.top, '', hudText({
    fontSize: '13px',
    fill: HUD.color.muted
  })).setOrigin(1, 0).setDepth(13);
  this.loreTitleText = this.add.text(well.left, well.top + 26, '', displayText({
    fontSize: '17px',
    fill: HUD.color.accent
  })).setOrigin(0, 0).setDepth(13);
  this.loreBodyText = this.add.text(well.left, well.top + 52, '', hudText({
    fontSize: '15px',
    fill: HUD.color.text,
    align: 'left',
    wordWrap: { width: well.width },
    lineSpacing: 4
  })).setOrigin(0, 0).setDepth(13);
  this.add.text(well.right, well.bottom, 'CLICK  ·  NEXT', hudText({
    fontSize: '12px',
    fill: HUD.color.muted
  })).setOrigin(1, 1).setDepth(13);

  hit.on('pointerdown', () => {
    this.loreUserPicked = true;
    this.loreIndex = (this.loreIndex + 1) % LORE_LOG.length;
    this.paintLore(true);
  });

  this.seedLoreIfNeeded();
}

private seedLoreIfNeeded(hasLastEnemy?: boolean) {
  if (this.loreUserPicked || !this.loreTitleText) {
    return;
  }
  this.loreIndex = loreIndexForContext({
    hasLastEnemy,
    level: this.lastProfile.level,
    wins: this.lastProfile.wins
  });
  this.paintLore(false);
}

private paintLore(animate: boolean) {
  const entry = loreByIndex(this.loreIndex);
  this.loreTitleText?.setText(entry.title);
  this.loreBodyText?.setText(entry.body);
  this.lorePageText?.setText(`${this.loreIndex + 1} / ${LORE_LOG.length}`);
  if (animate && this.loreBodyText && this.loreTitleText) {
    this.loreTitleText.setAlpha(0.25);
    this.loreBodyText.setAlpha(0.25);
    this.tweens.add({
      targets: [this.loreTitleText, this.loreBodyText],
      alpha: 1,
      duration: 180
    });
  }
}

private showEnemyFleetCard(title: string, body: string, isError = false) {
  const L = PREPARE_LAYOUT;
  const x = L.rightX;
  const y = L.aiTopY + 68;

  const plate = this.add.image(x, y, 'ui_plate')
    .setDisplaySize(440, 210)
    .setAlpha(0.94)
    .setDepth(18);
  const panel = this.add.rectangle(x, y, 400, 176, 0x080d16, 0.62)
    .setStrokeStyle(1, isError ? 0xff6b88 : 0x2ec7d6, 0.4)
    .setDepth(19);
  const heading = this.add.text(x, y - 52, title, displayText({
    fontSize: '22px',
    fill: isError ? HUD.color.bad : HUD.color.gold
  })).setOrigin(0.5).setDepth(20);
  const text = this.add.text(x, y + 18, body, hudText({
    fontSize: '18px',
    fill: HUD.color.text,
    align: 'center',
    wordWrap: { width: 350 },
    lineSpacing: 8
  })).setOrigin(0.5).setDepth(20);

  this.aiSprites.push(plate as any, panel as any, heading as any, text as any);
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
      if (filledTeamCount(this.team) >= 8) break;

      const freeSlotIndex = this.teamSlotOccupants.findIndex(slot => slot === null);
      if (freeSlotIndex !== -1) {
        this.team[freeSlotIndex] = unitInfo.id;
        await this.createTeamUnitVisual(unitInfo.id, freeSlotIndex);
      }
    }

    this.updateTeamCounter();
    await this.autoEquipRelics();

  } finally {
    this.teamOperationLock = false;
  }
}

  private async autoEquipRelics() {
    if (!this.account || !this.gameContract || !this.relicContract) {
      return;
    }
    let ownedIds: number[] = [];
    try {
      const raw: bigint[] = await this.gameContract.read.getPlayerRelics([this.account]);
      ownedIds = raw.map((id) => Number(id)).filter((id) => id > 0);
    } catch {
      return;
    }
    if (ownedIds.length === 0) {
      this.equippedRelics = [0, 0, 0];
      await this.loadEquippedRelics();
      this.persistEquippedRelics();
      return;
    }

    const scored = await Promise.all(ownedIds.map(async (id) => {
      try {
        const relic = await this.relicContract.read.getRelic([BigInt(id)]);
        return {
          id,
          value: Number(relic.value),
          relicType: Number(relic.relicType)
        };
      } catch {
        return null;
      }
    }));
    const ranked = (scored.filter(Boolean) as { id: number; value: number; relicType: number }[])
      .sort((a, b) => b.value - a.value || a.relicType - b.relicType);

    const picked: number[] = [];
    const usedTypes = new Set<number>();
    for (const relic of ranked) {
      if (picked.length >= 3) break;
      if (usedTypes.has(relic.relicType)) continue;
      picked.push(relic.id);
      usedTypes.add(relic.relicType);
    }
    for (const relic of ranked) {
      if (picked.length >= 3) break;
      if (picked.includes(relic.id)) continue;
      picked.push(relic.id);
    }

    this.equippedRelics = [picked[0] || 0, picked[1] || 0, picked[2] || 0];
    await this.loadEquippedRelics();
    this.persistEquippedRelics();
    await this.reloadOpenCollection();
  }

  private async clearEquippedRelics() {
    this.equippedRelics = [0, 0, 0];
    await this.loadEquippedRelics();
    this.persistEquippedRelics();
    await this.reloadOpenCollection();
  }

  private async clearLoadout() {
    if (this.teamOperationLock) return;
    this.clearTeam();
    await this.clearEquippedRelics();
  }

  private clearTeam(force = false) {
    if (this.teamOperationLock && !force) return;

    for (let i = 0; i < this.teamSlotOccupants.length; i++) {
      const occupant = this.teamSlotOccupants[i];
      if (occupant) {
        occupant.destroy();
        this.teamSlotOccupants[i] = null;
      }
    }

    this.team = emptyTeamSlots();
    this.updateTeamCounter();

    this.gridSlots.forEach((slot) => {
      if (slot) {
        slot.setInteractive();
        this.startEmptySlotPulse(slot);
      }
    });
  }

private async updatePlayerProfile() {
  if (!this.account || !this.publicClient) {
    console.warn('updatePlayerProfile: no account or publicClient');
    return;
  }

  try {
    const profileContract = getContract({
      address: PLAYER_PROFILE_ADDRESS,
      abi: profileAbi,
      client: { public: this.publicClient }
    });

    const profile: any = await profileContract.read.getProfile([this.account]);

    const level = Number(profile.level ?? 0);
    const xp = Number(profile.xp ?? 0);
    const wins = Number(profile.wins ?? 0);
    const losses = Number(profile.losses ?? 0);
    this.lastProfile.level = level;
    this.lastProfile.wins = wins;
    this.lastProfile.losses = losses;
    try {
      const ownedRelics: bigint[] = await this.gameContract.read.getPlayerRelics([this.account]);
      this.lastProfile.relics = ownedRelics.length;
    } catch {
      this.lastProfile.relics = this.equippedRelics.filter((id) => id > 0).length;
    }
    this.noteProgress();
    this.seedLoreIfNeeded();

    if (this.playerLevelText) {
      this.playerLevelText.setText(`LVL ${level}`);
    }

    const xpNeeded = level * 55 + 90;
    const played = wins + losses;
    const winrate = played > 0 ? Math.round((wins / played) * 100) : 0;
    if (this.playerStatsText) {
      this.playerStatsText.setText(`XP ${xp}/${xpNeeded}   ${wins}W ${losses}L   ${winrate}%`);
    }
    if (this.levelProgressBar) {
      const ratio = xpNeeded > 0 ? Math.min(1, Math.max(0, xp / xpNeeded)) : 0;
      this.levelProgressBar.width = 300 * ratio;
    }

  } catch (e) {
    console.error('updatePlayerProfile error:', e);
  }

  try {
    const remainingBuys = await this.gameContract.read.getRemainingBuys([this.account]);
    const canReroll = await this.gameContract.read.canReroll([this.account]);
    const remainingNumber = this.safeBigIntToNumber(remainingBuys);

    if (this.rerollsLeftText) {
      const rerollLabel = canReroll ? 'Reroll ready' : 'Reroll spent';
      this.rerollsLeftText.setText(`Buys ${remainingNumber}/10   ·   ${rerollLabel}`);
    }

    const pending = this.safeBigIntToNumber(await this.gameContract.read.pendingLevelUpShips([this.account]));
    if (this.pendingShipsText) {
      if (pending > 0) {
        this.pendingShipsText.setText(`CLAIM ${pending} FREE SHIP${pending === 1 ? '' : 'S'}`);
        this.pendingShipsText.setVisible(true);
        this.pendingShipsText.setInteractive({ useHandCursor: true });
      } else {
        this.pendingShipsText.setVisible(false);
        this.pendingShipsText.disableInteractive();
      }
    }
  } catch (e) {
    console.error('Failed to load limits', e);
  }

}



private showTooltip(x: number, y: number, text: string) {
    if (!this.tooltip || this.tooltip.scene !== this) {
      this.tooltip = this.add.text(0, 0, '', hudText({
        fontSize: '18px',
        fill: HUD.color.text,
        backgroundColor: '#081018',
        padding: { x: 12, y: 8 },
        align: 'left',
        wordWrap: { width: 280 }
      })).setOrigin(0.5, 1).setDepth(100);
    }

    this.tooltip.setText(text);
    const clampedX = Phaser.Math.Clamp(x, 160, 1760);
    const clampedY = Phaser.Math.Clamp(y - 22, 80, 1000);
    this.tooltip.setPosition(clampedX, clampedY);
    this.tooltip.setVisible(true);
  }

  private hideTooltip() {
    if (this.tooltip) this.tooltip.setVisible(false);
  }

private async buyUnit() {
  if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) {
    this.showSceneMessage('Connect wallet first');
    return;
  }
  if (!this.beginWalletTx()) {
    return;
  }

  try {
    const price = await this.readPayablePrice('buyUnitPrice', 10000000000000000n);
    const hash = await this.sendGameTransaction('buyUnit', [], price);
    this.showSceneMessage('Buying ship...', '#ffe566', 8000);
    await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    await this.loadOwnedUnits();
    await this.loadPlayerShop();
    await this.updatePlayerProfile();
    await this.reloadOpenCollection();
    gameAudio.buy();
    this.noteProgress();
    this.showSceneMessage('Unit purchased!', '#6dffc0', 2200);
  } catch (e: any) {
    console.error('buyUnit error:', e);
    const errMsg = e.shortMessage || e.message || 'Unknown error';
    this.showSceneMessage(`Error: ${errMsg}`, '#ff4444', 4000);
  } finally {
    this.endWalletTx();
  }
}

private async buyFromShopSlot(slot: number) {
  if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) {
    this.showSceneMessage('Connect wallet first');
    return;
  }
  if (!this.beginWalletTx()) {
    return;
  }

  try {
    const price = await this.readPayablePrice('buyRelicShopPrice', 8000000000000000n);
    const hash = await this.sendGameTransaction('buyFromShop', [BigInt(slot)], price);
    this.showSceneMessage('Buying relic...', '#ffe566', 8000);

    await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

    await this.loadPlayerShop();
    await this.loadOwnedUnits();
    await this.updatePlayerProfile();
    await this.reloadOpenCollection();

    gameAudio.buy();
    this.noteMedal('shopkeep');
    this.noteMedal('relic_hunter');
    this.showSceneMessage('Artifact purchased!', '#6dffc0', 1800);
  } catch (e: any) {
    console.error('buyFromShopSlot error:', e);
    const errMsg = e.shortMessage || e.message || 'Error';
    this.showSceneMessage(`Error: ${errMsg}`, '#ff4444', 4000);
  } finally {
    this.endWalletTx();
  }
}

private async rerollShop() {
  if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) {
    this.showSceneMessage('Connect wallet first');
    return;
  }
  if (!this.beginWalletTx()) {
    return;
  }

  try {
    const price = await this.readPayablePrice('rerollPrice', 5000000000000000n);
    const hash = await this.sendGameTransaction('rerollShop', [], price);
    this.showSceneMessage('Rerolling shop...', '#ffe566', 8000);

    await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

    if (this.shopContainer) {
      this.shopContainer.destroy(true);
      this.shopContainer = null;
    }
    this.shopSprites = [];
    this.shopTexts = [];

    await this.loadPlayerShop();
    await this.updatePlayerProfile();

    gameAudio.buy();
    this.noteMedal('shopkeep');
    this.showSceneMessage('Shop rerolled — new artifacts', '#6dffc0', 1800);
  } catch (e: any) {
    console.error('rerollShop error:', e);
    const errMsg = e.shortMessage || e.message || 'Reroll error';
    this.showSceneMessage(`Error: ${errMsg}`, '#ff4444', 4000);
  } finally {
    this.endWalletTx();
  }
}


private startEmptySlotPulse(slot: Phaser.GameObjects.Image) {
  this.stopEmptySlotPulse(slot);
  slot.setDisplaySize(HUD.TEAM, HUD.TEAM);
  slot.setAlpha(0.78);
  (slot as any).pulseTween = this.tweens.add({
    targets: slot,
    alpha: 1,
    duration: 1600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });
}

private stopEmptySlotPulse(slot: Phaser.GameObjects.Image) {
  if ((slot as any).pulseTween) {
    (slot as any).pulseTween.stop();
    (slot as any).pulseTween = null;
  }
  this.tweens.killTweensOf(slot);
  slot.setDisplaySize(HUD.TEAM, HUD.TEAM);
  slot.setAlpha(1);
}

private addHudButton(
  x: number,
  y: number,
  label: string,
  color: string,
  onClick: () => void,
  kind: 'base' | 'start' | 'slim' = 'base'
) {
  const width = kind === 'start' ? HUD.START_W : kind === 'slim' ? 196 : HUD.BTN_W;
  const height = kind === 'start' ? HUD.START_H : kind === 'slim' ? 52 : HUD.BTN_H;
  const fontSize = kind === 'start' ? HUD.START_FONT : kind === 'slim' ? '22px' : HUD.BTN_FONT;
  const texture = kind === 'start' ? 'button_start' : 'button_base';
  const base = this.add.image(x, y, texture)
    .setInteractive({ useHandCursor: true })
    .setDisplaySize(width, height)
    .setDepth(12);
  const text = this.add.text(x, y, label, hudText({
    fontSize, fill: color
  })).setOrigin(0.5).setDepth(13);
  (base as any).linkedText = text;
  base.on('pointerdown', () => {
    gameAudio.click();
    onClick();
  });
  addButtonEffects(this, base);
  return base;
}

private addSectionTitle(x: number, y: number, label: string) {
  return this.add.text(x, y, label, displayText({
    fontSize: HUD.TITLE,
    fill: HUD.color.gold
  })).setOrigin(0.5).setDepth(12);
}

private addGameUI() {
  const L = PREPARE_LAYOUT;
  const leftX = L.leftX;
  const centerX = L.centerX;
  const rightX = L.rightX;
  const bg = this.add.image(960, 540, 'mainbackground').setDepth(-20);
  bg.setDisplaySize(1920, 1080);

  this.add.rectangle(leftX, L.shopY + 18, 440, 214, 0x0c1420, 0.55)
    .setStrokeStyle(1, 0x1f3a4d, 0.8)
    .setDepth(4);
  this.add.rectangle(centerX, L.teamTopY + 92, 780, 420, 0x0c1420, 0.36)
    .setStrokeStyle(1, 0x1f3a4d, 0.55)
    .setDepth(4);
  this.add.rectangle(centerX, L.relicY + 6, 540, 172, 0x0c1420, 0.4)
    .setStrokeStyle(1, 0x1f3a4d, 0.55)
    .setDepth(4);
  this.add.rectangle(rightX, L.aiTopY + 68, 500, 328, 0x0c1420, 0.36)
    .setStrokeStyle(1, 0x1f3a4d, 0.55)
    .setDepth(4);

  this.add.image(leftX, L.profileY, 'profile_frame')
    .setOrigin(0.5, 0)
    .setDisplaySize(HUD.PROFILE_W, HUD.PROFILE_H)
    .setDepth(5);

  const profileLeft = leftX - HUD.PROFILE_W / 2;
  this.playerLevelText = this.add.text(profileLeft + 40, L.profileY + 24, 'LVL 1', displayText({
    fontSize: '32px', fill: HUD.color.accent
  })).setDepth(12);

  this.playerStatsText = this.add.text(profileLeft + 36, L.profileY + 70, 'XP 0/90   0W 0L', hudText({
    fontSize: '18px', fill: HUD.color.text
  })).setDepth(12);

  this.pendingShipsText = this.add.text(profileLeft + 40, L.profileY + HUD.PROFILE_H + 8, '', hudText({
    fontSize: HUD.SMALL, fill: HUD.color.good
  })).setDepth(12).setVisible(false);
  this.pendingShipsText.on('pointerdown', () => {
    void this.claimLevelUpShips();
  });
  this.pendingShipsText.on('pointerover', () => this.pendingShipsText?.setColor(HUD.color.gold));
  this.pendingShipsText.on('pointerout', () => this.pendingShipsText?.setColor(HUD.color.good));

  this.add.rectangle(profileLeft + 40, L.profileY + 108, 300, 10, 0x112233)
    .setStrokeStyle(1, 0x2ec7d6, 0.55).setOrigin(0, 0).setDepth(8);
  this.levelProgressBar = this.add.rectangle(profileLeft + 40, L.profileY + 108, 0, 10, 0x5dffb0)
    .setOrigin(0, 0).setDepth(9);

  const logo = this.add.image(centerX, L.logoY, 'logo').setOrigin(0.5, 0).setDepth(15);
  logo.setScale(Math.min(118 / logo.height, 520 / logo.width));

  this.addSectionTitle(leftX, L.shopTitleY, 'SHOP · RELICS');

  this.gridSlots = [];
  this.teamSlotOccupants = new Array(8).fill(null);

  const teamStartX = gridFirstCenter(centerX, 4, HUD.TEAM, L.teamGap);

  this.teamCounterText = this.add.text(centerX, L.fleetTitleY, 'YOUR FLEET  0/8', displayText({
    fontSize: '26px', fill: HUD.color.warn
  })).setOrigin(0.5).setDepth(12);

  this.fleetHintText = this.add.text(centerX, L.fleetTitleY + 28, '', hudText({
    fontSize: HUD.SMALL, fill: HUD.color.muted
  })).setOrigin(0.5).setDepth(12);

  for (let i = 0; i < 8; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = teamStartX + col * (HUD.TEAM + L.teamGap);
    const y = L.teamTopY + row * (HUD.TEAM + L.teamGap);

    const slot = this.add.image(x, y, 'slot_team')
      .setInteractive({ useHandCursor: true })
      .setDisplaySize(HUD.TEAM, HUD.TEAM)
      .setDepth(10);
    this.gridSlots.push(slot);
    addButtonEffects(this, slot);
    this.startEmptySlotPulse(slot);
    slot.on('pointerover', () => {
      this.showTooltip(slot.x + 80, slot.y - 56, 'Open collection to assign a ship');
    });
    slot.on('pointerout', () => this.hideTooltip());
    slot.on('pointerdown', () => this.openCollectionScene());
  }

  this.addSectionTitle(centerX, L.relicY - 102, 'RELICS');

  const leftBtnYs = [
    L.leftBtnY0,
    L.leftBtnY0 + L.leftBtnStep,
    L.leftBtnY0 + L.leftBtnStep * 2,
    L.leftBtnY0 + L.leftBtnStep * 3
  ];
  this.addHudButton(leftX, leftBtnYs[0], 'REROLL SHOP', '#e080ff', () => this.rerollShop());
  this.addHudButton(leftX, leftBtnYs[1], 'BUY SHIP', HUD.color.accent, () => this.buyUnit());
  this.addHudButton(leftX, leftBtnYs[2], 'GENERATE 10', HUD.color.accent, () => this.generateTenShips());
  this.addHudButton(leftX, leftBtnYs[3], 'COLLECTION', HUD.color.warn, () => this.openCollectionScene());

  this.rerollsLeftText = this.add.text(leftX, leftBtnYs[3] + 64, 'Rerolls · Buys 10/10', hudText({
    fontSize: HUD.SMALL, fill: HUD.color.muted
  })).setOrigin(0.5).setDepth(12);

  this.add.text(centerX, L.startY - 72, 'ENTER start   ·   C collection', hudText({
    fontSize: '15px',
    fill: HUD.color.muted
  })).setOrigin(0.5).setDepth(12);
  this.addHudButton(centerX, L.startY, 'START BATTLE', HUD.color.text, () => {
    this.startBattle();
  }, 'start');

  this.equippedSlotRects = [];
  const relicStartX = gridFirstCenter(centerX, 3, HUD.RELIC, L.teamGap);
  for (let i = 0; i < 3; i++) {
    const x = relicStartX + i * (HUD.RELIC + L.teamGap);
    const slot = this.add.image(x, L.relicY, 'slot_equipped')
      .setDisplaySize(HUD.RELIC, HUD.RELIC)
      .setDepth(10);
    this.equippedSlotRects.push(slot);
  }

  addMetaButtons(this, {
    account: this.account,
    onHelp: () => {
      if (this.account) {
        beginOrResumeTutorial(this, this.account, 'PrepareScene', true);
      }
    },
    onMedals: () => {
      if (this.account) {
        showAchievementPanel(this, this.account);
      }
    }
  });
  this.addHudButton(centerX - 168, L.autoY, 'AUTO', HUD.color.good, () => this.autoSelectTeam());
  this.addHudButton(centerX + 168, L.autoY, 'CLEAR', HUD.color.bad, () => this.clearLoadout());

  this.aiGridSlots = [];
  const aiStartX = gridFirstCenter(rightX, 4, HUD.AI, L.aiGap);
  this.aiTitleText = this.addSectionTitle(rightX, L.aiTitleY, 'ENEMY FLEET');

  for (let i = 0; i < 8; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = aiStartX + col * (HUD.AI + L.aiGap);
    const y = L.aiTopY + row * (HUD.AI + L.aiGap);
    const slot = this.add.image(x, y, 'slot_ai')
      .setInteractive()
      .setDisplaySize(96, 96)
      .setDepth(10);
    this.aiGridSlots.push(slot);
    addButtonEffects(this, slot);
  }

  this.addLorePanel();
}


private async startBattle() {
  if (this.matchBusy || this.txBusy) {
    return;
  }

  if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) {
    this.showSceneMessage('Connect wallet first');
    return;
  }

  if (this.playerUnitIds.length === 0) {
    this.showSceneMessage('Buy or generate 10 ships first', '#ffe566');
    return;
  }

  if (filledTeamCount(this.team) !== 8) {
    this.showSceneMessage('Fill all 8 fleet slots.', HUD.color.warn, 2800);
    return;
  }

  this.matchBusy = true;
  gameAudio.startMatch();
  this.showBusyOverlay('ENTERING BATTLE...');

  try {
    const hash = await this.sendGameTransaction(
      'startMatch',
      [
        compactTeamIds(this.team).map(id => BigInt(id)),
        this.equippedRelics.map(id => BigInt(id))
      ],
      0n
    );

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

    if (receipt.status !== 'success') {
      throw new Error('Battle failed');
    }

    let parsed = this.parseBattleFromReceipt(receipt);

    if (!parsed.battleId || parsed.events.length === 0 || parsed.playerMaxHp.length === 0 || parsed.aiMaxHp.length === 0) {
      const summary: any = await this.gameContract.read.getLastBattleSummary([this.account]);
      const battleId: string = summary.battleId ?? parsed.battleId ?? '0x0';
      const playerWon: boolean = summary.playerWon ?? parsed.playerWon ?? false;
      const summaryPlayerHp: number[] = (summary.playerFinalHp ?? []).map((n: bigint) => this.safeBigIntToNumber(n));
      const summaryAiHp: number[] = (summary.aiFinalHp ?? []).map((n: bigint) => this.safeBigIntToNumber(n));
      const logEvents = await this.fetchBattleEventsFromLogs(battleId, receipt.blockNumber);

      parsed = {
        battleId,
        playerWon,
        playerMaxHp: summaryPlayerHp.length > 0 ? summaryPlayerHp : parsed.playerMaxHp,
        aiMaxHp: summaryAiHp.length > 0 ? summaryAiHp : parsed.aiMaxHp,
        events: logEvents.length > 0 ? logEvents : parsed.events
      };
    }

    if (parsed.playerMaxHp.length === 0 || parsed.aiMaxHp.length === 0) {
      throw new Error('Battle data is missing');
    }

    if (!parsed.events || parsed.events.length === 0) {
      throw new Error('Battle events not found in transaction logs');
    }

    const playerWon: boolean = parsed.playerWon;
    const playerMaxHp: number[] = parsed.playerMaxHp;
    const aiMaxHp: number[] = parsed.aiMaxHp;
    const battleId: string = parsed.battleId;
    const events: any[] = parsed.events;

    const playerUnitsData: any[] = [];
    for (let slot = 0; slot < 8; slot++) {
      const id = this.team[slot];
      if (!isFilledSlot(id)) {
        continue;
      }
      const occupant = this.teamSlotOccupants[slot] as { unit?: NormalizedUnit } | null;
      const unit = occupant?.unit || await this.getCachedUnit(id);
      playerUnitsData.push({
        faction: unit.faction,
        unitClass: unit.unitClass,
        rarity: unit.rarity
      });
    }

    const aiData: any[] = await this.gameContract.read.getCurrentAI([this.account]);
    const aiUnitsData: any[] = [];
    if (Array.isArray(aiData)) {
      for (const u of aiData) {
        if (!u?.isRelic) {
          aiUnitsData.push({
            faction: Number(u.faction ?? 0),
            unitClass: Number(u.unitClass ?? 0),
            rarity: Number(u.rarity ?? 0)
          });
        }
      }
    }

    if (aiUnitsData.length < 4) {
      throw new Error('Enemy fleet data is missing');
    }

    if (playerUnitsData.length < 4 || aiUnitsData.length < 4) {
      throw new Error('Battle data is incomplete');
    }

    this.teamReady = true;
    this.saveCurrentTeam();
    this.hideBusyOverlay();
    this.matchBusy = false;
    this.scene.start('BattleScene', {
      events: events,
      playerWon: playerWon,
      playerMaxHp: playerMaxHp,
      aiMaxHp: aiMaxHp,
      playerUnitsData: playerUnitsData,
      aiUnitsData: aiUnitsData,
      battleId: battleId,
      savedTeam: [...this.team]
    });

  } catch (e: any) {
    console.error('startBattle error:', e);
    this.hideBusyOverlay();
    this.matchBusy = false;
    const errMsg = e.shortMessage || e.message || 'Battle failed';
    this.showSceneMessage(`Error: ${errMsg}`, '#ff4444', 4500);
  }
}


private bindPrepareHotkeys() {
  this.input.keyboard?.off('keydown-ENTER');
  this.input.keyboard?.off('keydown-C');
  this.input.keyboard?.on('keydown-ENTER', () => {
    if (this.scene.isActive('CollectionScene') || this.matchBusy || this.txBusy) {
      return;
    }
    void this.startBattle();
  });
  this.input.keyboard?.on('keydown-C', () => {
    this.openCollectionScene();
  });
  this.input.keyboard?.off('keydown-H');
  this.input.keyboard?.on('keydown-H', () => {
    if (this.account) {
      beginOrResumeTutorial(this, this.account, 'PrepareScene', true);
    }
  });
}

private openCollectionScene() {
  if (this.scene.isActive('CollectionScene')) {
    this.scene.stop('CollectionScene');
    return;
  }

  const equippedIds = this.equippedRelics.filter(id => id > 0);

  this.noteMedal('hangar_open');
  this.input.enabled = false;
  this.scene.launch('CollectionScene', {
    walletManager: this.walletManager,
    gameContract: this.gameContract,
    nftContract: this.nftContract,
    relicContract: this.relicContract,
    account: this.account,
    publicClient: this.publicClient,
    returnTo: 'PrepareScene',
    equippedRelicIds: equippedIds,
    teamIds: compactTeamIds(this.team)
  });
  this.scene.bringToTop('CollectionScene');
}

  public async addMultipleUnitsToTeam(newIds: number[]) {
    if (this.teamOperationLock || !newIds || newIds.length === 0) return;
    this.teamOperationLock = true;

    try {
      const actuallyAdded: number[] = [];
      for (const id of newIds) {
        if (filledTeamCount(this.team) >= 8) break;
        if (!this.team.includes(id)) {
          const freeSlotIndex = this.teamSlotOccupants.findIndex(slot => slot === null);
          if (freeSlotIndex !== -1) {
            this.team[freeSlotIndex] = id;
            await this.createTeamUnitVisual(id, freeSlotIndex);
            actuallyAdded.push(id);
          }
        }
      }

      this.updateTeamCounter();

      const collectionScene = this.scene.get('CollectionScene') as any;
      if (collectionScene && collectionScene.scene.isActive() && actuallyAdded.length > 0) {
        collectionScene.unitsData = collectionScene.unitsData.filter((u: any) => !actuallyAdded.includes(u.id));
        if (typeof collectionScene.refreshGrid === 'function') collectionScene.refreshGrid();
      }
      return actuallyAdded;
    } finally {
      this.teamOperationLock = false;
    }
  }

public async addMultipleRelicsToEquipped(newRelicIds: number[]): Promise<number[]> {
  if (!newRelicIds || newRelicIds.length === 0) {
    return [];
  }

  const equippedCopy = [...this.equippedRelics];
  const added: number[] = [];
  for (const relicId of newRelicIds) {
    if (!(relicId > 0) || equippedCopy.includes(relicId)) {
      continue;
    }
    const empty = equippedCopy.findIndex((id) => id === 0);
    if (empty === -1) {
      break;
    }
    equippedCopy[empty] = relicId;
    added.push(relicId);
  }

  if (added.length === 0) {
    this.showSceneMessage('No free relic slot.', HUD.color.warn, 1800);
    return [];
  }

  this.equippedRelics = equippedCopy;
  await this.loadEquippedRelics();
  this.persistEquippedRelics();

  this.showSceneMessage(`Relics equipped (${added.length})`, HUD.color.good, 1800);
  return added;
}

private async createTeamUnitVisual(tokenId: number, slotIndex: number) {
  if (!this.nftContract || !this.gridSlots[slotIndex]) return;

  try {
    const unit = await this.getCachedUnit(tokenId);

    const slot = this.gridSlots[slotIndex];
    const textureKey = shipKey(unit.faction, unit.unitClass);
    const rarityNum = unit.rarity;
    const shipDisplay = Math.round(HUD.TEAM * 0.56);

    const container = UnitVisualFactory.createUnitWithFrame(
      this, slot.x, slot.y, textureKey, rarityNum, HUD.TEAM
    );

    const ship = container.getAt(container.length - 1) as Phaser.GameObjects.Sprite;

    if (!ship) {
      container.destroy();
      return;
    }

    const caption = this.add.text(0, HUD.TEAM / 2 + 12, className(unit.unitClass), hudText({
      fontSize: '13px',
      fill: rarityColor(unit.rarity)
    })).setOrigin(0.5);
    container.add(caption);

    (container as any).tokenId = tokenId;
    (container as any).unit = unit;
    (container as any).teamSlotIndex = slotIndex;

    ship.setDepth(8);
    container.setSize(HUD.TEAM, HUD.TEAM);
    container.setInteractive(new Phaser.Geom.Rectangle(-HUD.TEAM / 2, -HUD.TEAM / 2, HUD.TEAM, HUD.TEAM), Phaser.Geom.Rectangle.Contains);
    container.setDepth(8);

    this.teamSlotOccupants[slotIndex] = container;

    this.stopEmptySlotPulse(slot);
    slot.disableInteractive();

    this.tweens.add({
      targets: ship,
      displayWidth: shipDisplay * 1.04,
      displayHeight: shipDisplay * 1.04,
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const originalWidth = slot.displayWidth;
    const originalHeight = slot.displayHeight;

    container.on('pointerover', () => {
      const tooltipText = `${factionName(unit.faction)} ${rarityName(unit.rarity)} ${className(unit.unitClass)}\nATK ${unit.attack}  DEF ${unit.defense}  SPD ${unit.speed}`;
      this.showTooltip(slot.x + 80, slot.y - 65, tooltipText);
    });

    container.on('pointerout', () => this.hideTooltip());

    container.on('pointerdown', () => {
      const now = Date.now();
      const previous = Number((container as any).lastClickAt || 0);
      if (previous > 0 && now - previous < 300) {
        this.removeFromTeam(slotIndex);
      }
      (container as any).lastClickAt = now;
    });

    this.input.setDraggable(container);

    container.on('dragstart', () => {
      container.setDepth(30);
      ship.setDisplaySize(shipDisplay * 1.08, shipDisplay * 1.08);
      slot.setDisplaySize(originalWidth, originalHeight);
    });

    container.on('drag', (_: unknown, dragX: number, dragY: number) => {
      container.x = dragX;
      container.y = dragY;
    });

    container.on('dragend', () => {
      container.setDepth(8);
      ship.setDisplaySize(shipDisplay, shipDisplay);

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
      if (droppedOnSlot) {
        return;
      }

      const L = PREPARE_LAYOUT;
      const teamWidth = 4 * HUD.TEAM + 3 * L.teamGap;
      const teamHeight = 2 * HUD.TEAM + L.teamGap;
      const inFleet =
        container.x > L.centerX - teamWidth / 2 - 70 &&
        container.x < L.centerX + teamWidth / 2 + 70 &&
        container.y > L.teamTopY - 70 &&
        container.y < L.teamTopY + teamHeight + 70;

      if (inFleet) {
        container.x = slot.x;
        container.y = slot.y;
      } else {
        this.removeFromTeam(slotIndex);
      }
    });

  } catch (e) {
    console.error(`createTeamUnitVisual error for ${tokenId}:`, e);
    this.team[slotIndex] = EMPTY_TEAM_SLOT;
    this.teamSlotOccupants[slotIndex] = null;
    this.armEmptyTeamSlot(slotIndex);
    if (this.teamCounterText) this.teamCounterText.setText(`YOUR FLEET  ${filledTeamCount(this.team)}/8`);
  }
}

  private removeFromTeam(slotIndex: number) {
    const occupant = this.teamSlotOccupants[slotIndex];
    if (!occupant) return;

    const tokenId = (occupant as any).tokenId;
    const unit = (occupant as any).unit || null;

    this.team[slotIndex] = EMPTY_TEAM_SLOT;
    if (typeof (occupant as any).destroy === 'function') {
      occupant.destroy();
    }
    this.teamSlotOccupants[slotIndex] = null;
    this.updateTeamCounter();
    this.armEmptyTeamSlot(slotIndex);

    const collectionScene = this.scene.get('CollectionScene') as any;
    if (collectionScene && collectionScene.scene.isActive()) {
      const alreadyExists = collectionScene.unitsData.some((u: any) => u.id === tokenId);
      if (!alreadyExists) {
        collectionScene.unitsData.push({
          id: tokenId,
          unit,
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

  private clearTeamVisuals() {
    this.teamSlotOccupants.forEach((occupant) => {
      if (occupant && typeof (occupant as any).destroy === 'function') {
        occupant.destroy();
      }
    });
    this.teamSlotOccupants = new Array(8).fill(null);
  }

  private armEmptyTeamSlot(slotIndex: number) {
    const slot = this.gridSlots[slotIndex];
    this.teamSlotOccupants[slotIndex] = null;
    if (!slot) {
      return;
    }
    slot.setInteractive({ useHandCursor: true });
    this.startEmptySlotPulse(slot);
  }

  private async rebuildTeamVisuals() {
    for (let i = 0; i < this.team.length; i++) {
      if (isFilledSlot(this.team[i])) {
        await this.createTeamUnitVisual(this.team[i], i);
      } else {
        this.team[i] = EMPTY_TEAM_SLOT;
        this.armEmptyTeamSlot(i);
      }
    }
    this.updateTeamCounter();
  }

  private updateTeamCounter() {
    const count = filledTeamCount(this.team);
    if (this.teamCounterText) {
      this.teamCounterText.setText(`YOUR FLEET  ${count}/8`);
      this.teamCounterText.setColor(count === 8 ? HUD.color.good : HUD.color.warn);
    }
    this.refreshFleetHint();
    this.saveCurrentTeam();
    if (count === 8) {
      this.noteProgress();
    }
  }

  private saveCurrentTeam() {
    if (!this.account || !this.teamReady) {
      return;
    }
    savePrepareSession(this.account, {
      team: [...this.team],
      relics: this.equippedRelics
    });
  }

  private async restoreSavedTeam() {
    if (!this.account || filledTeamCount(this.team) > 0) {
      return;
    }
    const saved = loadPrepareSession(this.account);
    if (!saved || filledTeamCount(saved.team) === 0) {
      return;
    }
    const raw = Array.isArray(saved.team) ? saved.team : [];
    const slots = raw.length === 8 ? raw.map((id) => Number(id)) : alignTeamToSlots(raw);
    this.team = slots.map((id) => (isFilledSlot(id) && this.playerUnitIds.includes(id) ? id : EMPTY_TEAM_SLOT));
    if (filledTeamCount(this.team) === 0) {
      return;
    }
    await this.rebuildTeamVisuals();
  }

  private refreshFleetHint() {
    const count = filledTeamCount(this.team);
    if (this.teamCounterText) {
      this.teamCounterText.setText(`YOUR FLEET  ${count}/8`);
      this.teamCounterText.setColor(count === 8 ? HUD.color.good : HUD.color.warn);
    }
    if (!this.fleetHintText) {
      return;
    }
    if (this.playerUnitIds.length === 0) {
      this.fleetHintText.setText('Buy or generate ships, then fill 8 slots');
      this.fleetHintText.setColor(HUD.color.warn);
      return;
    }
    if (count < 8) {
      this.fleetHintText.setText(`Fill all 8 slots  ·  ${count}/8`);
      this.fleetHintText.setColor(HUD.color.warn);
      return;
    }
    this.fleetHintText.setText('');
  }

  private async claimLevelUpShips() {
  if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) {
    this.showSceneMessage('Connect wallet first');
    return;
  }
  if (!this.beginWalletTx()) {
    return;
  }
  try {
    const pending = this.safeBigIntToNumber(await this.gameContract.read.pendingLevelUpShips([this.account]));
    if (pending <= 0) {
      this.showSceneMessage('No free ships to claim', HUD.color.muted, 1800);
      return;
    }
    const hash = await this.sendGameTransaction('claimLevelUpShips', [], 0n);
    this.showSceneMessage('Claiming free ships...', HUD.color.warn, 8000);
    await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    await this.loadOwnedUnits();
    await this.updatePlayerProfile();
    await this.reloadOpenCollection();
    this.showSceneMessage(`${pending} free ship${pending === 1 ? '' : 's'} claimed`, HUD.color.good, 2200);
  } catch (e: any) {
    const errMsg = e.shortMessage || e.message || 'Claim failed';
    this.showSceneMessage(`Error: ${errMsg}`, '#ff4444', 4000);
  } finally {
    this.endWalletTx();
  }
}

private async generateTenShips() {

  if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) {
    this.showSceneMessage('Connect wallet first');
    return;
  }
  if (!this.beginWalletTx()) {
    return;
  }

  try {
    const unitPrice = await this.readPayablePrice('buyUnitPrice', 10000000000000000n);
    const hash = await this.sendGameTransaction('generateTenShips', [], unitPrice * 10n);
    this.showSceneMessage('Generating 10 ships...', '#ffe566', 8000);

    await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

    await this.loadOwnedUnits();
    await this.loadPlayerShop();
    await this.updatePlayerProfile();
    await this.reloadOpenCollection();
    if (filledTeamCount(this.team) === 0 && this.playerUnitIds.length >= 8) {
      await this.autoSelectTeam();
    }

    gameAudio.buy();
    this.noteMedal('ten_forged');
    this.noteProgress();
    this.showSceneMessage('10 ships generated!', '#6dffc0', 2000);

  } catch (e: any) {
    console.error('generateTenShips error:', e);
    const errMsg = e.shortMessage || e.message || 'Error';
    this.showSceneMessage(`Error: ${errMsg}`, '#ff4444', 4000);
  } finally {
    this.endWalletTx();
  }
}

  public addSingleUnitToTeam(unitId: number): boolean {
    if (!isFilledSlot(unitId)) return false;
    if (filledTeamCount(this.team) >= 8 || this.team.includes(unitId)) return false;

    const freeSlotIndex = this.teamSlotOccupants.findIndex(slot => slot === null);
    if (freeSlotIndex === -1) return false;

    this.team[freeSlotIndex] = unitId;
    this.teamSlotOccupants[freeSlotIndex] = { tokenId: unitId } as any;
    void this.createTeamUnitVisual(unitId, freeSlotIndex);
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
      this.loadEquippedRelics();
      this.persistEquippedRelics();

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

private mapSpecialEffect(code: number): string | undefined {
  if (code === 1) return 'CRIT';
  if (code === 2) return 'DODGE';
  if (code === 3) return 'Last Stand';
  return undefined;
}

private mapEmittedBattleEvent(args: any): any {
  return {
    round: Number(args.round),
    isPlayerSide: Boolean(args.isPlayerSide),
    attackerIndex: Number(args.attackerIndex),
    targetIndex: Number(args.targetIndex),
    damageDealt: this.safeBigIntToNumber(args.damage),
    remainingHp: this.safeBigIntToNumber(args.remainingHp),
    specialEffect: this.mapSpecialEffect(Number(args.specialEffect))
  };
}

private parseBattleFromReceipt(receipt: any): {
  battleId: string;
  playerWon: boolean;
  playerMaxHp: number[];
  aiMaxHp: number[];
  events: any[];
} {
  const resolvedLogs: any[] = parseEventLogs({
    abi: this.gameContract.abi,
    logs: receipt.logs,
    eventName: 'BattleResolved'
  });

  const eventLogs: any[] = parseEventLogs({
    abi: this.gameContract.abi,
    logs: receipt.logs,
    eventName: 'BattleEventEmitted'
  });

  let battleId = '';
  let playerWon = false;
  let playerMaxHp: number[] = [];
  let aiMaxHp: number[] = [];

  if (resolvedLogs.length > 0) {
    const args = resolvedLogs[0].args;
    battleId = args.battleId;
    playerWon = Boolean(args.playerWon);
    playerMaxHp = (args.playerMaxHp ?? []).map((n: bigint) => this.safeBigIntToNumber(n));
    aiMaxHp = (args.aiMaxHp ?? []).map((n: bigint) => this.safeBigIntToNumber(n));
  }

  const events = eventLogs
    .filter((log: any) => !battleId || log.args.battleId === battleId)
    .map((log: any) => this.mapEmittedBattleEvent(log.args));

  if (!battleId && eventLogs.length > 0) {
    battleId = eventLogs[0].args.battleId;
  }

  return { battleId, playerWon, playerMaxHp, aiMaxHp, events };
}

private async fetchBattleEventsFromLogs(battleId: string, blockNumber: bigint): Promise<any[]> {
  if (!battleId || battleId === '0x0' || !this.publicClient) {
    return [];
  }

  const logs: any[] = await this.publicClient.getLogs({
    address: GAME_ADDRESS,
    event: {
      type: 'event',
      name: 'BattleEventEmitted',
      inputs: [
        { indexed: true, name: 'battleId', type: 'bytes32' },
        { indexed: false, name: 'round', type: 'uint8' },
        { indexed: false, name: 'isPlayerSide', type: 'bool' },
        { indexed: false, name: 'attackerIndex', type: 'uint8' },
        { indexed: false, name: 'targetIndex', type: 'uint8' },
        { indexed: false, name: 'damage', type: 'uint16' },
        { indexed: false, name: 'remainingHp', type: 'uint16' },
        { indexed: false, name: 'specialEffect', type: 'uint8' }
      ]
    },
    args: { battleId },
    fromBlock: blockNumber,
    toBlock: blockNumber
  });

  return logs.map((log: any) => this.mapEmittedBattleEvent(log.args));
}

  shutdown() {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
    this.hideTooltip();
    this.clearSceneMessage();

    this.shopSprites.forEach((sprite) => sprite?.destroy());
    this.aiSprites.forEach(s => s.destroy());
    this.equippedTexts.forEach(t => t.destroy());
    this.equippedTexts = [];

    if (this.playerLevelText) this.playerLevelText.destroy();
    if (this.playerStatsText) this.playerStatsText.destroy();


  }
}