// @ts-nocheck
// frontend/src/scenes/PrepareScene.ts
import * as Phaser from 'phaser';
import { getContract } from 'viem';

export default class PrepareScene extends Phaser.Scene {
  private unitsInTeam: number[] = [];
  private gameContract: any;
  private publicClient: any;
  private nftContract: any;
  private account: `0x${string}` | undefined;
  private team: number[] = [];
  private playerUnitIds: number[] = [];
  private equippedTexts: Phaser.GameObjects.Text[] = [];
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
  private relicContract: any;
  private collectionButton: Phaser.GameObjects.Text | null = null;
  private playerLevelText: Phaser.GameObjects.Text | null = null;
  private playerStatsText: Phaser.GameObjects.Text | null = null;
  private teamCounterText: Phaser.GameObjects.Text | null = null;
  private teamOperationLock = false;
  private lastKnownLevel: number = 0;
  

  constructor() {
    super({ key: 'PrepareScene' });
  }

  private getRarityTintAndScale(rarity: number) {
    if (rarity === 2) { // Legendary
      return { tint: 0xffee00, scale: 0.89 };
    }
    if (rarity === 1) { // Rare
      return { tint: 0x00ff77, scale: 0.84 };
    }
    // Common
    return { tint: 0x44aaff, scale: 0.78 };
  }

  private updateTeamCounter() {
    if (this.teamCounterText) this.teamCounterText.setText(`TEAM: ${this.team.length}/8`);
  }

private removeFromTeam(slotIndex: number) {
  const occupant = this.teamSlotOccupants[slotIndex];
  if (!occupant) return;

  const tokenId = (occupant as any).tokenId;

  // Удаляем из команды
  this.team = this.team.filter(id => id !== tokenId);
  occupant.destroy();
  this.teamSlotOccupants[slotIndex] = null;
  this.originalPositions.delete(tokenId);
  this.updateTeamCounter();

  // Возвращаем ТОЛЬКО этот юнит в коллекцию (улучшенная версия v1.6)
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
    collectionScene.loadCollectionData(); // просто перезагружаем коллекцию
  }
}


  private async loadOwnedUnits() {
    if (!this.account || !this.gameContract || !this.nftContract) return;

    this.ownedSprites.forEach(s => s.destroy());
    this.ownedSprites = [];

    try {
      const ownedIds: bigint[] = await this.gameContract.read.getPlayerUnits([this.account]);
      this.playerUnitIds = ownedIds.map(id => Number(id));
      console.log('📦 Твои юниты (для команды):', this.playerUnitIds.length);
    } catch (e) {
      console.error('loadOwnedUnits error', e);
    }
  }

private async loadPlayerShop() {
  if (!this.account || !this.gameContract) return;

  // Уничтожаем всё старое в области магазина
  this.children.getAll().forEach(child => {
    if (child instanceof Phaser.GameObjects.Text) {
      const txt = child as Phaser.GameObjects.Text;
      if (txt.y > 480 && txt.y < 720 && txt.x > 80 && txt.x < 600 && txt.text !== 'REROLL SHOP') {
        txt.destroy();
      }
    }
    if ((child instanceof Phaser.GameObjects.Rectangle || child instanceof Phaser.GameObjects.Image) &&
        child.x > 80 && child.x < 600 && child.y > 480 && child.y < 720) {
      child.destroy();
    }
  });

  this.shopSprites = [];

  try {
    const shopData: any[] = await this.gameContract.read.getPlayerShop([this.account]);

    const shopCenterX = 340;
    const shopY = 560;
    const shopSlotSize = 120;
    const shopSpacing = 55;
    const shopTotalWidth = 3 * shopSlotSize + 2 * shopSpacing;
    const shopStartX = shopCenterX - shopTotalWidth / 2;

    for (let i = 0; i < 3; i++) {
      const item = shopData[i];
      const x = shopStartX + i * (shopSlotSize + shopSpacing);
      const y = shopY;

      // Тёмный фон внутри слота
      this.add.rectangle(x, y, shopSlotSize - 10, shopSlotSize - 10, 0x0a1122)
        .setDepth(1);

      // Рамка слота
      const slotImage = this.add.image(x, y, 'slot_shop')
        .setInteractive()
        .setDisplaySize(120, 120)
        .setDepth(2);

      this.addButtonEffects(slotImage);   // ← анимация hover/click

      let displayName = 'RELIC';
      let tooltipText = `RELIC SLOT ${i}`;

      if (item.isRelic) {
        const typeNames = [
          'Quantum Strike', 'Void Shield', 'Nebula Dash',
          'Echo Core', 'Flux Overload', 'Last Stand'
        ];
        const typeName = typeNames[item.relicType] || 'Unknown Relic';
        displayName = `${typeName} +${item.relicValue}`;
        tooltipText = `${displayName}\n+${item.relicValue} ${this.getRelicEffectDescription(item.relicType)}`;
      }

      const sprite = this.add.sprite(x, y, 'ship').setInteractive().setScale(1.1);
      (sprite as any).shopSlot = i;

      this.add.text(x, y + 82, displayName, { 
        fontSize: '22px', 
        fill: '#ffff00',
        align: 'center',
        wordWrap: { width: 165 }
      }).setOrigin(0.5);

      this.add.text(x - 30, y + 128, 'BUY', { fontSize: '30px', fill: '#00ff00' })
        .setInteractive()
        .on('pointerdown', () => this.buyFromShopSlot(i));

      sprite.on('pointerover', () => this.showTooltip(x + 135, y - 45, tooltipText));
      sprite.on('pointerout', () => this.hideTooltip());

      this.shopSprites.push(sprite);
    }


    // === AI OPPONENT GRID (вынесено из цикла) ===
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

      // Тёмный фон внутри AI слота
      this.add.rectangle(x, y, aiSlotSize - 6, aiSlotSize - 6, 0x0a1122)
        .setDepth(1);

      const slot = this.add.image(x, y, 'slot_ai')
        .setInteractive()
        .setDisplaySize(aiSlotSize, aiSlotSize)
        .setDepth(2);

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
    console.log('✅ initEquippedState loaded:', this.equippedRelics);

    // === ВАЖНО: сразу обновляем визуалы после загрузки ===
    await this.refreshRelics();
  } catch (e) {
    console.error('initEquippedState error', e);
  }
}


private async loadEquippedRelics() {
  if (!this.account || !this.gameContract || !this.relicContract) return;

  try {
    this.equippedSprites.forEach(s => s.destroy());
    this.equippedSprites = [];
    this.equippedTexts.forEach(t => t.destroy());
    this.equippedTexts = [];

for (let i = 0; i < 3; i++) {
  const slot = this.equippedSlotRects[i];
  if (!slot) continue;

  const oldRect = slot.getData('equippedRect') as Phaser.GameObjects.GameObject;
  if (oldRect) oldRect.destroy();

  if (this.equippedRelics[i] === 0) {
    slot.setData('equippedRect', null);
    continue;
  }

  const relicId = this.equippedRelics[i];
  const relicData = await this.relicContract.read.getRelic([BigInt(relicId)]);

  const rect = this.add.rectangle(slot.x, slot.y, 108, 108, 0x112233)
    .setStrokeStyle(6, 0xffff00)
    .setInteractive()
    .setDepth(15);

  (rect as any).relicId = relicId;
  (rect as any).isEquipped = true;
  (rect as any).slotIndex = i;

  slot.setData('equippedRect', rect);

  const nameText = this.add.text(slot.x, slot.y + 87, relicData.name, { 
    fontSize: '20px', fill: '#ffff00', align: 'center', wordWrap: { width: 135 }
  }).setOrigin(0.5).setDepth(15);

  this.equippedTexts.push(nameText);

  // === DOUBLE CLICK (отдельная логика, без конфликта с drag) ===
  let clickCount = 0;
  rect.on('pointerdown', () => {
    clickCount++;
    if (clickCount === 2) {
      this.unequipRelic(i);
      clickCount = 0;
    }
    setTimeout(() => { clickCount = 0; }, 400);
  });

  // === DRAG (только для перемещения между слотами) ===
  this.input.setDraggable(rect);

  rect.on('dragstart', () => {
    rect.setScale(1.15);
    rect.setDepth(30);
  });

  rect.on('drag', (_: any, dragX: number, dragY: number) => {
    rect.x = dragX;
    rect.y = dragY;
  });

  rect.on('dragend', () => {
    rect.setScale(1.0);

    let droppedOnSlot = false;

    for (let s = 0; s < 3; s++) {
      if (s === i) continue;
      const targetSlot = this.equippedSlotRects[s];
      const dx = targetSlot.x - rect.x;
      const dy = targetSlot.y - rect.y;

      if (Math.sqrt(dx * dx + dy * dy) < 80) {
        const temp = this.equippedRelics[i];
        this.equippedRelics[i] = this.equippedRelics[s];
        this.equippedRelics[s] = temp;

        this.refreshRelics();
        droppedOnSlot = true;
        break;
      }
    }

    if (!droppedOnSlot) {
      this.unequipRelic(i);
    } else {
      rect.x = this.equippedSlotRects[i].x;
      rect.y = this.equippedSlotRects[i].y;
    }
  });

  rect.on('pointerover', () => {
    this.showTooltip(slot.x + 60, slot.y - 45, 
      `${relicData.name}\n+${relicData.value} ${this.getRelicEffectDescription(relicData.relicType)}`
    );
  });
  rect.on('pointerout', () => this.hideTooltip());

  this.equippedSprites.push(rect);
}
  } catch (e) {
    console.error('loadEquippedRelics error', e);
  }
}



  private async equipRelic(relicId: number, slotIndex: number) {
    if (slotIndex < 0 || slotIndex > 2) return;
    this.equippedRelics[slotIndex] = relicId;
    console.log(`✅ Equipped relic ${relicId} → слот ${slotIndex}`);
    await this.refreshRelics();
  }

private async unequipRelic(slotIndex: number) {
  if (slotIndex < 0 || slotIndex > 2) return;

  const relicId = this.equippedRelics[slotIndex];
  if (relicId === 0) return;

  // Снимаем реликвию
  this.equippedRelics[slotIndex] = 0;
  await this.refreshRelics();

  // === Возвращаем ТОЛЬКО эту реликвию в коллекцию (по той же логике, что и юниты) ===
  const collectionScene = this.scene.get('CollectionScene') as any;
  if (collectionScene && collectionScene.scene.isActive()) {
    const alreadyExists = collectionScene.relicsData.some((r: any) => r.id === relicId);
    if (!alreadyExists) {
      collectionScene.relicsData.push({
        id: relicId,
        relic: null
      });
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
      'Увеличивает ATK всем юнитам',
      'Увеличивает DEF всем юнитам',
      'Увеличивает SPD всем юнитам',
      'Увеличивает HP всем юнитам',
      'Повышает шанс крита (Quantum Flux)',
      'Последний удар перед смертью (Last Stand)'
    ];
    return desc[relicType] || 'Эффект неизвестен';
  }

  private async loadCurrentAI() {
    if (!this.account || !this.gameContract) return;

    this.aiSprites.forEach(s => s.destroy());
    this.aiSprites = [];

    try {
      const aiData: any[] = await this.gameContract.read.getCurrentAI([this.account]);

      this.aiGridSlots.forEach(slot => {
        const oldSprite = slot.getData('aiSprite') as Phaser.GameObjects.Sprite;
        if (oldSprite) oldSprite.destroy();
        slot.setData('aiSprite', null);
      });

      for (let i = 0; i < 8; i++) {
        const slot = this.aiGridSlots[i];
        if (!slot) continue;

        if (i >= aiData.length) continue;

        const unit = aiData[i];
        const style = this.getRarityTintAndScale(unit.rarity);

        const rect = this.add.rectangle(slot.x, slot.y, 95, 95, 0x112233)
          .setStrokeStyle(6, style.tint)
          .setScale(style.scale * 0.85)
          .setInteractive()
          .setDepth(10);

        (rect as any).unit = unit;

        slot.setData('aiSprite', rect);
        this.aiSprites.push(rect);

        const tooltipText = `${this.getFactionName(unit.faction)} ${this.getRarityName(unit.rarity)} ${this.getClassName(unit.unitClass)}\nATK ${unit.attack} DEF ${unit.defense} SPD ${unit.speed}`;
        rect.on('pointerover', () => this.showTooltip(slot.x + 55, slot.y - 45, tooltipText));
        rect.on('pointerout', () => this.hideTooltip());
      }
    } catch (e) {
      console.error('loadCurrentAI error', e);
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

      const toSelect = this.playerUnitIds.slice(0, 8);
      for (let i = 0; i < toSelect.length; i++) {
        const id = toSelect[i];
        if (this.team.length >= 8) break;
        if (!this.team.includes(id)) {
          const freeSlotIndex = this.teamSlotOccupants.findIndex(slot => slot === null);
          if (freeSlotIndex !== -1) {
            this.team.push(id);
            await this.createTeamUnitVisual(id, freeSlotIndex);
          }
        }
      }

      this.updateTeamCounter();
      console.log(`✅ Автовыбор завершён: ${this.team.length} юнитов`);
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

    console.log('✅ Команда полностью очищена (визуально + данные)');
  }

  private async updatePlayerProfile() {
    if (!this.account || !this.gameContract) return;

    if (!this.playerLevelText || !this.playerStatsText) {
      console.warn('updatePlayerProfile: тексты профиля ещё не созданы');
      return;
    }

    try {
      const profile = await this.gameContract.read.profiles([this.account]);
      const level = Number(profile.level);
      const xp = Number(profile.xp);
      const nextXp = level * 55 + 90;

      this.playerLevelText.setText(`PROFILE Level ${level}`);
      this.playerStatsText.setText(`XP ${xp}/${nextXp} | W:${profile.wins} L:${profile.losses}`);

      const bar = (this as any).levelProgressBar as Phaser.GameObjects.Rectangle;
      if (bar && bar.scene) {
        this.tweens.add({
          targets: bar,
          width: 330 * Math.min(xp / nextXp, 1),
          duration: 900,
          ease: 'Sine.easeOut'
        });
      }

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
      })
        .setOrigin(0.5, 1)
        .setDepth(100);
    }

    this.tooltip.setText(text);
    this.tooltip.setPosition(x, y - 22);
    this.tooltip.setVisible(true);
  }

  private hideTooltip() {
    if (this.tooltip) {
      this.tooltip.setVisible(false);
    }
  }

  private clearTemporaryTexts() {
    this.children.getAll().forEach(child => {
      if (child instanceof Phaser.GameObjects.Text) {
        const text = child.text.toLowerCase();
        if (text.includes('куплен') || 
            text.includes('rerolled') || 
            text.includes('tx отправлена') || 
            text.includes('победа')) {
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
    if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) 
      return alert('Сначала подключи MetaMask');

    try {
      const hash = await this.gameContract.write.buyUnit([], { account: this.account, value: 0n });
      const waiting = this.add.text(600, 450, 'TX buyUnit отправлена... ждём on-chain (3 сек)', { fontSize: '36px', fill: '#ffff00' });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      console.log('✅ buyUnit confirmed');

      waiting.destroy();
      const msg = this.add.text(600, 450, 'Юнит куплен on-chain!', { fontSize: '48px', fill: '#00ff00' });
      setTimeout(() => { msg.destroy(); }, 2200);

      setTimeout(() => {
        this.loadOwnedUnits();
        this.loadPlayerShop();
      }, 3000);
    } catch (e: any) {
      const errMsg = e.shortMessage || e.message || 'Неизвестная ошибка';
      const errorText = this.add.text(600, 450, `Ошибка: ${errMsg}`, { fontSize: '36px', fill: '#ff4444' });
      setTimeout(() => errorText.destroy(), 4000);
    }
  }

  private async buyFromShopSlot(slot: number) {
    if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) 
      return alert('Сначала подключи MetaMask');

    try {
      const hash = await this.gameContract.write.buyFromShop([BigInt(slot)], { account: this.account, value: 0n });
      const waiting = this.add.text(600, 450, `TX buyFromShop [${slot}] отправлена... ждём on-chain (3 сек)`, { fontSize: '36px', fill: '#ffff00' });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      console.log('✅ buyFromShop confirmed');

      waiting.destroy();
      const msg = this.add.text(600, 450, `Артефакт куплен!`, { fontSize: '42px', fill: '#00ff00' });
      setTimeout(() => { msg.destroy(); }, 1800);

      setTimeout(() => {
        this.loadPlayerShop();
        this.loadCurrentAI();
      }, 3000);
    } catch (e: any) {
      const errMsg = e.shortMessage || e.message || 'Ошибка';
      const errorText = this.add.text(600, 450, `Ошибка: ${errMsg}`, { fontSize: '36px', fill: '#ff4444' });
      setTimeout(() => errorText.destroy(), 4000);
    }
  }

  private async rerollShop() {
    if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) 
      return alert('Сначала подключи MetaMask');

    try {
      const hash = await this.gameContract.write.rerollShop([], { account: this.account, value: 0n });
      const waiting = this.add.text(600, 510, 'TX reroll отправлена... ждём on-chain (3 сек)', { fontSize: '42px', fill: '#ffff00' });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      console.log('✅ rerollShop confirmed');

      waiting.destroy();
      const msg = this.add.text(600, 510, 'Shop rerolled — новые артефакты', { fontSize: '42px', fill: '#ffff00' });
      setTimeout(() => { msg.destroy(); }, 1800);

      this.clearTemporaryTexts();

      setTimeout(() => {
        this.loadPlayerShop();
        this.loadCurrentAI();
      }, 3000);
    } catch (e: any) {
      const errMsg = e.shortMessage || e.message || 'Ошибка rerollShop';
      const errorText = this.add.text(600, 510, `Ошибка: ${errMsg}`, { fontSize: '36px', fill: '#ff4444' });
      setTimeout(() => errorText.destroy(), 4000);
      console.error('rerollShop error:', e);
    }
  }

  private async startBattle() {
    if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) 
      return alert('Сначала подключи MetaMask');

    console.log('🚀 startBattle: team =', this.team, 'equipped =', this.equippedRelics);

    if (this.team.length < 4 || this.team.length > 8) {
      return this.add.text(750, 750, `Нужно 4-8 юнитов! Сейчас: ${this.team.length}`, { fontSize: '42px', fill: '#ff0000' });
    }

    const tempTeam = [...this.team];

    try {
      const teamBigInt = this.team.map(id => BigInt(id));
      const equippedBigInt = this.equippedRelics.map(id => BigInt(id));

      const hash = await this.gameContract.write.startMatch([teamBigInt, equippedBigInt], { account: this.account });
      
      const waitingText = this.add.text(750, 420, 'TX отправлена... Бой обрабатывается on-chain (5–10 сек)', { fontSize: '36px', fill: '#ffff00' });

      const receipt = await this.publicClient.waitForTransactionReceipt({ 
        hash, 
        confirmations: 1 
      });

      if (receipt.status !== 'success') {
        throw new Error(`Транзакция не прошла (status = ${receipt.status})`);
      }

      waitingText.destroy();

      this.team = [];
      if (this.teamCounterText) this.teamCounterText.setText('TEAM: 0/8');

      await new Promise(resolve => setTimeout(resolve, 7000));

      let playerWon = false;
      let events: any[] = [];
      let playerMaxHp: number[] = [];
      let aiMaxHp: number[] = [];

      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const result = await this.gameContract.read.getLastBattleResult([this.account]);
          playerWon = result[0];
          events = result[1] || [];
          playerMaxHp = result[2] ? result[2].map((v: bigint) => Number(v)) : [];
          aiMaxHp = result[3] ? result[3].map((v: bigint) => Number(v)) : [];
          if (events.length > 0) break;
        } catch (e) {
          console.warn('getLastBattleResult attempt failed', attempt, e);
        }
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 3500));
      }

      if (events.length === 0) {
        throw new Error('Бой прошёл, но результат не получен с on-chain');
      }

      console.log('✅ Бой успешно подтверждён, переходим в BattleScene');
      this.scene.start('BattleScene', { 
        events, 
        playerWon, 
        playerMaxHp, 
        aiMaxHp 
      });

    } catch (e: any) {
      console.error('❌ startMatch error:', e);
      
      this.team = tempTeam;
      if (this.teamCounterText) this.teamCounterText.setText(`TEAM: ${this.team.length}/8`);

      const errMsg = e.shortMessage || e.message || 'Неизвестная ошибка';
      const errorText = this.add.text(600, 450, `ОШИБКА: ${errMsg}\nБой отменён.\nКоманда восстановлена.`, { 
        fontSize: '36px', 
        fill: '#ff4444',
        align: 'center',
        wordWrap: { width: 1050 }
      });
      setTimeout(() => errorText.destroy(), 6000);
    }
  }

private addGameUI() {
  const bg = this.add.image(960, 540, 'mainbackground').setDepth(-20);
  bg.setDisplaySize(1920, 1080);

  // === PROFILE ===
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

  // === TEAM GRID ===
  this.gridSlots = [];
  this.teamSlotOccupants = new Array(8).fill(null);
  const teamCenterX = 1020;
  const teamCenterY = 560;
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
      .setDepth(2);

    this.gridSlots.push(slot);
    this.addButtonEffects(slot);
  }

  // === ВНЕШНЯЯ РАМКА ===
  this.add.image(960, 540, 'outer_frame')
    .setDisplaySize(1920, 1080)
    .setDepth(200);

  this.teamCounterText = this.add.text(940, 670, 'TEAM: 0/8', { 
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
      .setInteractive()
      .setDisplaySize(128, 128);
    this.equippedSlotRects.push(slot);
    this.addButtonEffects(slot, 1.05);
  }

// === КНОПКИ (все одинакового размера 270×70) ===
const btnAuto = this.add.image(790, 300, 'button_base')
  .setInteractive()
  .setDisplaySize(270, 70);
const textAuto = this.add.text(770, 300, 'AUTO SELECT', { fontSize: '26px', fill: '#00ff88', fontStyle: 'bold' }).setOrigin(0.5);
(btnAuto as any).linkedText = textAuto;
(textAuto as any).originalFill = '#00ff88';
btnAuto.on('pointerdown', () => this.autoSelectTeam());
this.addButtonEffects(btnAuto);

const btnClear = this.add.image(1100, 300, 'button_base')
  .setInteractive()
  .setDisplaySize(270, 70);
const textClear = this.add.text(1100, 300, 'CLEAR TEAM', { fontSize: '26px', fill: '#ff6666', fontStyle: 'bold' }).setOrigin(0.5);
(btnClear as any).linkedText = textClear;
(textClear as any).originalFill = '#ff6666';
btnClear.on('pointerdown', () => this.clearTeam());
this.addButtonEffects(btnClear);

const btnReroll = this.add.image(285, 460, 'button_base')
  .setInteractive()
  .setDisplaySize(270, 70);
const textReroll = this.add.text(285, 460, 'REROLL SHOP', { fontSize: '26px', fill: '#ff00ff', fontStyle: 'bold' }).setOrigin(0.5);
(btnReroll as any).linkedText = textReroll;
(textReroll as any).originalFill = '#ff00ff';
btnReroll.on('pointerdown', () => this.rerollShop());
this.addButtonEffects(btnReroll);

const btnCollection = this.add.image(285, 900, 'button_base')
  .setInteractive()
  .setDisplaySize(270, 70);
const textCollection = this.add.text(285, 900, 'Collection', { fontSize: '26px', fill: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5);
(btnCollection as any).linkedText = textCollection;
(textCollection as any).originalFill = '#ffff00';
btnCollection.on('pointerdown', () => this.openCollectionScene());
this.addButtonEffects(btnCollection);

const btnBuy = this.add.image(285, 820, 'button_base')
  .setInteractive()
  .setDisplaySize(270, 70);
const textBuy = this.add.text(285, 820, 'BUY (FREE)', { fontSize: '26px', fill: '#00ffff', fontStyle: 'bold' }).setOrigin(0.5);
(btnBuy as any).linkedText = textBuy;
(textBuy as any).originalFill = '#00ffff';
btnBuy.on('pointerdown', () => this.buyUnit());
this.addButtonEffects(btnBuy);

// START BATTLE оставляем больше (главная кнопка)
const btnStart = this.add.image(1600, 900, 'button_start')
  .setInteractive()
  .setDisplaySize(400, 90);
const textStart = this.add.text(1600, 900, '▶ START BATTLE', { fontSize: '36px', fill: '#ff3333', fontStyle: 'bold' }).setOrigin(0.5);
(btnStart as any).linkedText = textStart;
(textStart as any).originalFill = '#ff3333';
btnStart.on('pointerdown', () => this.startBattle());
this.addButtonEffects(btnStart);
}



private openCollectionScene() {
  const equippedIds = this.equippedRelics.filter(id => id > 0);

  this.scene.launch('CollectionScene', {
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

    // Удаляем из коллекции ТОЛЬКО реально добавленные юниты
    const collectionScene = this.scene.get('CollectionScene') as any;
    if (collectionScene && collectionScene.scene.isActive() && actuallyAdded.length > 0) {
      collectionScene.unitsData = collectionScene.unitsData.filter(
        (u: any) => !actuallyAdded.includes(u.id)
      );
      if (typeof collectionScene.refreshGrid === 'function') {
        collectionScene.refreshGrid();
      }
    }
  } finally {
    this.teamOperationLock = false;
  }
}


public async addMultipleRelicsToEquipped(newRelicIds: number[]) {
  if (!newRelicIds || newRelicIds.length === 0 || newRelicIds.length > 3) return;

  let equippedCopy = [...this.equippedRelics];
  let idx = 0;

  // Заполняем пустые слоты
  for (let i = 0; i < equippedCopy.length && idx < newRelicIds.length; i++) {
    if (equippedCopy[i] === 0) {
      equippedCopy[i] = newRelicIds[idx++];
    }
  }

  // Если остались — перезаписываем
  for (let i = 0; idx < newRelicIds.length && i < equippedCopy.length; i++) {
    equippedCopy[i] = newRelicIds[idx++];
  }

  this.equippedRelics = equippedCopy;
  await this.refreshRelics();

  const msg = this.add.text(600, 450, `РЕЛИКВИИ АКТИВИРОВАНЫ (${newRelicIds.length})`, {
    fontSize: '42px',
    fill: '#00ff88'
  }).setOrigin(0.5);
  setTimeout(() => msg.destroy(), 2200);
}

private async createTeamUnitVisual(tokenId: number, slotIndex: number) {
  if (!this.nftContract || !this.gridSlots[slotIndex]) return;

  try {
    const unit = await this.nftContract.read.getUnit([BigInt(tokenId)]);
    const slot = this.gridSlots[slotIndex];

    const style = this.getRarityTintAndScale(unit.rarity);

    const rect = this.add.rectangle(slot.x, slot.y, 142, 142, 0x112233)
      .setStrokeStyle(8, style.tint)
      .setScale(style.scale)
      .setInteractive()
      .setDepth(10);

    (rect as any).tokenId = tokenId;
    (rect as any).unit = unit;

    this.teamSlotOccupants[slotIndex] = rect;
    this.originalPositions.set(tokenId, { x: slot.x, y: slot.y });

    // === DOUBLE CLICK — убрать из команды ===
    rect.on('pointerdown', () => {
      const now = Date.now();
      if (now - this.lastClickTime < 300) {
        this.removeFromTeam(slotIndex);
      }
      this.lastClickTime = now;
    });

    // === DRAG ===
    this.input.setDraggable(rect);

    rect.on('dragstart', () => {
      rect.setScale(style.scale * 1.15);
      rect.setDepth(30);
    });

    rect.on('drag', (_: any, dragX: number, dragY: number) => {
      rect.x = dragX;
      rect.y = dragY;
    });

    rect.on('dragend', () => {
      rect.setScale(style.scale);

      let droppedOnSlot = false;

      // Проверяем, попали ли в другой слот команды
      for (let s = 0; s < 8; s++) {
        if (s === slotIndex) continue;
        const targetSlot = this.gridSlots[s];
        const dx = targetSlot.x - rect.x;
        const dy = targetSlot.y - rect.y;

        if (Math.sqrt(dx * dx + dy * dy) < 90) {
          // Обмен юнитами
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
        // Убрали юнита из команды
        this.removeFromTeam(slotIndex);
      } else {
        rect.x = this.gridSlots[slotIndex].x;
        rect.y = this.gridSlots[slotIndex].y;
      }
    });

    rect.on('pointerover', () => {
      const tooltipText = `${this.getFactionName(unit.faction)} ${this.getRarityName(unit.rarity)} ${this.getClassName(unit.unitClass)}\nATK ${unit.attack} DEF ${unit.defense} SPD ${unit.speed}`;
      this.showTooltip(slot.x + 80, slot.y - 65, tooltipText);
    });
    rect.on('pointerout', () => this.hideTooltip());

  } catch (e) {
    console.error('createTeamUnitVisual error', e);
  }
}


  private enableDoubleClickRemoveOnTeamUnit(rect: any, tokenId: number) {
    rect.on('pointerdown', () => {
      const now = Date.now();
      if (now - this.lastClickTime < 300) {
        const slotIndex = this.teamSlotOccupants.indexOf(rect);
        if (slotIndex !== -1) this.removeFromTeam(slotIndex);
      }
      this.lastClickTime = now;
    });
  }

  init(data: any) {
    this.gameContract = data.gameContract;
    this.nftContract = data.nftContract;
    this.relicContract = data.relicContract;
    this.account = data.account;
    this.publicClient = data.publicClient;
    this.isWalletReady = true;

    if (data.addUnits && Array.isArray(data.addUnits)) {
      setTimeout(() => this.addMultipleUnitsToTeam(data.addUnits), 350);
    }

    console.log('✅ PrepareScene init — данные от BootScene получены');
  }

public returnRelicToCollection(relicId: number) {
  const collectionScene = this.scene.get('CollectionScene') as any;
  if (collectionScene && collectionScene.scene.isActive()) {
    collectionScene.loadCollectionData(); // просто перезагружаем коллекцию
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
}

create() {
  if (this.tooltip) {
    this.tooltip.destroy();
    this.tooltip = null;
  }

  this.children.getAll().forEach(child => {
    if (child instanceof Phaser.GameObjects.GameObject) child.destroy();
  });
  
  this.team = [];
  this.teamSlotOccupants = new Array(8).fill(null);
  this.originalPositions.clear();
  this.ownedSprites = [];
  this.shopSprites = [];
  this.aiSprites = [];
  this.aiTexts = [];
  this.equippedRelics = [0, 0, 0];
  this.lastKnownLevel = 0;
  this.teamOperationLock = false;

  this.addGameUI();
  
  this.initEquippedState();   // теперь сам обновит визуалы
  this.updatePlayerProfile();

  this.loadOwnedUnits();
  this.loadPlayerShop();
  this.updatePlayerProfile();

  console.log('✅ PrepareScene создана (дубли убраны, шрифты увеличены)');
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
    console.log('✅ PrepareScene shutdown — очистка перед выходом');
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
      text.setFill('#ffff88');
      this.tweens.add({ targets: text, scale: 1.1, duration: 120 });
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
      this.tweens.add({ targets: text, scale: 1, duration: 120 });
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


public addSingleUnitToTeam(unitId: number): boolean {
  if (this.team.length >= 8) {
    console.log('Команда заполнена (8/8)');
    return false;
  }
  if (this.team.includes(unitId)) {
    return false;
  }

  const freeSlotIndex = this.teamSlotOccupants.findIndex(slot => slot === null);
  if (freeSlotIndex === -1) return false;

  this.team.push(unitId);
  this.createTeamUnitVisual(unitId, freeSlotIndex);
  this.updateTeamCounter();

  // Удаляем из коллекции только если реально добавили
  const collectionScene = this.scene.get('CollectionScene') as any;
  if (collectionScene && collectionScene.scene.isActive()) {
    collectionScene.unitsData = collectionScene.unitsData.filter((u: any) => u.id !== unitId);
    if (typeof collectionScene.applyFiltersAndSort === 'function') {
      collectionScene.applyFiltersAndSort();
    } else if (typeof collectionScene.refreshGrid === 'function') {
      collectionScene.refreshGrid();
    }
  }

  return true;
}


public equipSingleRelic(relicId: number): boolean {
  // Ищем первый свободный слот
  for (let i = 0; i < 3; i++) {
    if (this.equippedRelics[i] === 0) {
      this.equippedRelics[i] = relicId;
      this.refreshRelics();
      return true;
    }
  }
  // Все слоты заняты
  return false;
}

}