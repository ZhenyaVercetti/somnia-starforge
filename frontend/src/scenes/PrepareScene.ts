// @ts-nocheck
// frontend/src/scenes/PrepareScene.ts
import * as Phaser from 'phaser';
import { getContract } from 'viem';

export default class PrepareScene extends Phaser.Scene {
      constructor() {
    super({ key: 'PrepareScene' });
  }
  private gameContract: any;
  private publicClient: any;
  private nftContract: any;
  private account: `0x${string}` | undefined;

private team: number[] = [];
private equippedTexts: Phaser.GameObjects.Text[] = [];
private equippedRelics: number[] = [0, 0, 0];
private isWalletReady = false;
private ownedSprites: Phaser.GameObjects.GameObject[] = [];
private shopSprites: Phaser.GameObjects.Sprite[] = [];
private gridSlots: Phaser.GameObjects.Rectangle[] = [];
private playerProfileText: Phaser.GameObjects.Text | null = null;
private rewardNotification: Phaser.GameObjects.Text | null = null;
private lastRewardsCount = 0;
private lastOwnedCount = 0;
private lastRewardIds: number[] = [];
private teamCounterText: Phaser.GameObjects.Text | null = null;
private tooltip: Phaser.GameObjects.Text | null = null;
private lastClickTime = 0;
private teamSlotOccupants: (Phaser.GameObjects.GameObject | null)[] = [];
private originalPositions: Map<number, {x: number, y: number}> = new Map();
private aiSprites: Phaser.GameObjects.Sprite[] = [];
private aiTexts: Phaser.GameObjects.Text[] = [];
private equippedRelics: number[] = [0, 0, 0];
private equippedSlotRects: Phaser.GameObjects.Rectangle[] = [];
private equippedSprites: Phaser.GameObjects.GameObject[] = [];
private relicContract: any;

private updateTeamCounter() {
  if (this.teamCounterText) this.teamCounterText.setText(`TEAM: ${this.team.length}/8`);
}

private removeFromTeam(slotIndex: number) {
  const occupant = this.teamSlotOccupants[slotIndex];
  if (!occupant) return;

  const tokenId = (occupant as any).tokenId;
  this.team = this.team.filter(id => id !== tokenId);

  const orig = this.originalPositions.get(tokenId);
  if (orig) {
    occupant.x = orig.x;
    occupant.y = orig.y;
    occupant.setInteractive();
    occupant.setScale(0.75);
    (occupant as any).input.draggable = true;   // ← обязательно
  }

  this.teamSlotOccupants[slotIndex] = null;
  this.updateTeamCounter();
}    

private async loadOwnedUnits() {
  if (!this.account || !this.gameContract || !this.nftContract) return;

  this.ownedSprites.forEach(s => s.destroy());
  this.ownedSprites = [];

  try {
    const ownedIds: bigint[] = await this.gameContract.read.getPlayerUnits([this.account]);
    console.log('📦 Твои юниты после reload:', ownedIds.length, ownedIds);

    this.children.getAll().forEach(child => {
      if (child instanceof Phaser.GameObjects.Text && child.text.includes('ТВОИ ЮНИТЫ')) child.destroy();
    });
    this.add.text(50, 150, `ТВОИ ЮНИТЫ (${ownedIds.length})`, { fontSize: '18px', fill: '#ffff00' });

    if (ownedIds.length === 0) return;

    const unitsData = await Promise.all(
      ownedIds.map(async (tokenIdBig) => {
        const tokenId = Number(tokenIdBig);
        const unit = await this.nftContract.read.getUnit([tokenIdBig]);
        return { tokenId, unit, rarity: Number(unit.rarity) };
      })
    );

    unitsData.forEach(({ tokenId, rarity, unit }, index) => {
      const col = index % 8;
      const row = Math.floor(index / 8);
      const x = 55 + col * 47;
      const y = 255 + row * 48;

      const rect = this.add.rectangle(x, y, 42, 42, 0x112233)
        .setStrokeStyle(5, rarity === 2 ? 0xffee00 : rarity === 1 ? 0x00ff77 : 0x00ccff)
        .setInteractive()
        .setScale(0.1)
        .setAlpha(0);

      (rect as any).tokenId = tokenId;
      (rect as any).unit = unit;

      let scaleMod = 0.75;
      if (rarity === 1) scaleMod = 0.85;
      else if (rarity === 2) scaleMod = 0.95;

      this.tweens.add({
        targets: rect,
        scale: scaleMod,
        alpha: 1,
        duration: 320,
        ease: 'Back.easeOut',
        delay: index * 12
      });

      // Hover — добавляем ОДИН РАЗ при создании
      const showHover = () => {
        const tooltipText = 
          `${this.getFactionName(unit.faction)}\n` +
          `Rarity: ${this.getRarityName(unit.rarity)}\n` +
          `Class: ${this.getClassName(unit.unitClass)}\n` +
          `ATK ${unit.attack}  DEF ${unit.defense}  SPD ${unit.speed}`;
        this.showTooltip(rect.x + 21, rect.y - 10, tooltipText);
      };

      rect.on('pointerover', showHover);
      rect.on('pointerout', () => this.hideTooltip());

      this.input.setDraggable(rect);

      rect.on('dragstart', () => { 
        rect.setScale(0.9); 
        this.highlightFreeSlots(); 
      });

      rect.on('drag', (_: any, dragX: number, dragY: number) => { 
        rect.x = dragX; 
        rect.y = dragY; 
      });

      rect.on('dragend', () => {
        rect.setScale(scaleMod);
        this.resetSlotHighlights();

        const slotIndex = this.gridSlots.findIndex((s: any) =>
          Math.abs(s.x - rect.x) < 55 && Math.abs(s.y - rect.y) < 55
        );

        if (slotIndex === -1) {
          const orig = this.originalPositions.get(tokenId);
          if (orig) rect.setPosition(orig.x, orig.y);
          return;
        }

        const currentOccupant = this.teamSlotOccupants[slotIndex];

        if (currentOccupant && currentOccupant !== rect) {
          const oldTokenId = (currentOccupant as any).tokenId;
          this.team = this.team.filter(id => id !== oldTokenId);

          const origOld = this.originalPositions.get(oldTokenId);
          if (origOld) {
            currentOccupant.x = origOld.x;
            currentOccupant.y = origOld.y;
            currentOccupant.setInteractive();
            currentOccupant.setScale(scaleMod);
            (currentOccupant as any).input.draggable = true;
          }
        }

        const slot = this.gridSlots[slotIndex];
        rect.setPosition(slot.x, slot.y);
        rect.input.draggable = false;   // выключаем drag пока в команде

        this.teamSlotOccupants[slotIndex] = rect;
        this.enableDoubleClickRemoveOnTeamUnit(rect, tokenId);

        if (!this.team.includes(tokenId)) {
          this.team.push(tokenId);
        }

        this.updateTeamCounter();
      });

            this.originalPositions.set(tokenId, { x, y });
      this.ownedSprites.push(rect);
    });

  } catch (e) {
    console.error('loadOwnedUnits error', e);
  }
}

private async loadPlayerShop() {
  if (!this.account || !this.gameContract) return;
  this.shopSprites.forEach(s => s.destroy()); 
  this.shopSprites = [];

  try {
    const shopData: any[] = await this.gameContract.read.getPlayerShop([this.account]);

    // Удаляем старые shop-элементы
    this.children.getAll().forEach(child => {
      if (child instanceof Phaser.GameObjects.Text && child.x > 600 && child.y < 220) child.destroy();
      if (child instanceof Phaser.GameObjects.Rectangle && child.x > 600 && child.y < 220) child.destroy();
    });

    this.add.text(720, 80, 'SHOP (3 ARTEFACTS)', { fontSize: '22px', fill: '#ff00ff' });

    const startX = 680;
    const spacing = 130; // удобное расстояние между 3 слотами

    for (let i = 0; i < 3; i++) {                    // ← теперь строго 3
      const item = shopData[i];
      const x = startX + i * spacing;
      const y = 140;

      const rect = this.add.rectangle(x, y, 80, 80, 0x112233).setStrokeStyle(4, 0xffaa00);

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

      const sprite = this.add.sprite(x, y, 'ship').setInteractive();
      (sprite as any).shopSlot = i;

      // Название артефакта — теперь ПОД квадратом
      this.add.text(x, y + 55, displayName, { 
        fontSize: '13px', 
        fill: '#ffff00',
        align: 'center',
        wordWrap: { width: 110 }
      }).setOrigin(0.5);

      this.add.text(x - 20, y + 85, 'BUY', { fontSize: '18px', fill: '#00ff00' })
        .setInteractive()
        .on('pointerdown', () => this.buyFromShopSlot(i));

      sprite.on('pointerover', () => this.showTooltip(x + 90, y - 30, tooltipText));
      sprite.on('pointerout', () => this.hideTooltip());

      this.shopSprites.push(sprite);
    }

    this.loadCurrentAI();
  } catch (e) { 
    console.error('loadPlayerShop error', e); 
  }
}

// ====================== RELIC SYSTEM v1.4.5 — СТАБИЛЬНЫЙ DRAG & DROP ======================
private async refreshRelics() {
  await this.loadPlayerRelics();
  await this.loadEquippedRelics();
}

// Загружаем начальное состояние equipped с on-chain ТОЛЬКО один раз
private async initEquippedState() {
  if (!this.account || !this.gameContract) return;
  try {
    const equipped: bigint[] = await this.gameContract.read.getEquippedRelics([this.account]);
    this.equippedRelics = equipped.map(id => Number(id));
    console.log('✅ initEquippedState loaded:', this.equippedRelics);
  } catch (e) {
    console.error('initEquippedState error', e);
  }
}

private async loadPlayerRelics() {
  if (!this.account || !this.gameContract || !this.relicContract) return;

  try {
    const relics: bigint[] = await this.gameContract.read.getPlayerRelics([this.account]);
    const equippedSet = new Set(this.equippedRelics); // ← теперь используем локальное состояние

    // Полная очистка старых owned relics
    this.children.getAll().forEach(child => {
      if ((child as any).isRelicSlot) child.destroy();
      if (child instanceof Phaser.GameObjects.Text && child.text.includes('RELICS')) child.destroy();
    });

    this.add.text(50, 620, `RELICS (${relics.length})`, { fontSize: '18px', fill: '#ff00ff' });

    if (relics.length === 0) {
      this.add.text(55, 660, 'Пока нет артефактов.\nКупи в магазине →', { 
        fontSize: '16px', fill: '#aaaaaa', align: 'left' 
      });
      return;
    }

    let displayedCount = 0;
    for (let i = 0; i < relics.length; i++) {
      const relicIdNum = Number(relics[i]);
      if (equippedSet.has(relicIdNum)) continue;

      const relicData = await this.relicContract.read.getRelic([relics[i]]);

      const x = 55 + (displayedCount % 8) * 55;
      const y = 660 + Math.floor(displayedCount / 8) * 58; // вертикальный отступ

      const rect = this.add.rectangle(x, y, 48, 48, 0x112233)
        .setStrokeStyle(4, 0xffaa00)
        .setInteractive()
        .setScale(0.85)
        .setDepth(5);

      (rect as any).isRelicSlot = true;
      (rect as any).relicId = relicIdNum;
      (rect as any).originalX = x;
      (rect as any).originalY = y;

      this.input.setDraggable(rect);

      rect.on('dragstart', () => {
        rect.setScale(1.05);
        rect.setDepth(20);
      });

      rect.on('drag', (_: any, dragX: number, dragY: number) => {
        rect.x = dragX;
        rect.y = dragY;
      });

      rect.on('dragend', () => {
        rect.setScale(0.85);
        rect.setDepth(5);

        // Находим БЛИЖАЙШИЙ слот
        let closestIndex = -1;
        let minDistance = Infinity;
        for (let s = 0; s < this.equippedSlotRects.length; s++) {
          const slot = this.equippedSlotRects[s];
          if (!slot) continue;
          const dx = slot.x - rect.x;
          const dy = slot.y - rect.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            minDistance = dist;
            closestIndex = s;
          }
        }

        console.log(`🟡 Drop relic ${relicIdNum} → slot ${closestIndex}, dist=${minDistance.toFixed(1)}px`);

        if (closestIndex !== -1 && minDistance < 95) { // увеличенный threshold
          // мгновенный visual snap
          rect.x = this.equippedSlotRects[closestIndex].x;
          rect.y = this.equippedSlotRects[closestIndex].y;

          const currentInSlot = this.equippedRelics[closestIndex];
          if (currentInSlot !== 0) {
            this.unequipRelic(closestIndex);
          }
          this.equipRelic(relicIdNum, closestIndex);
          // destroy произойдёт в refreshRelics
        } else {
          rect.x = (rect as any).originalX;
          rect.y = (rect as any).originalY;
        }
      });

      rect.on('pointerover', () => {
        this.showTooltip(x + 25, y - 10, 
          `${relicData.name}\n+${relicData.value} ${this.getRelicEffectDescription(relicData.relicType)}`
        );
      });
      rect.on('pointerout', () => this.hideTooltip());

      this.ownedSprites.push(rect);
      displayedCount++;
    }
  } catch (e) {
    console.error('loadPlayerRelics error', e);
  }
}

private async loadEquippedRelics() {
  if (!this.account || !this.gameContract || !this.relicContract) return;

  try {
    // Уничтожаем старые спрайты и ТЕКСТЫ
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

      const rect = this.add.rectangle(slot.x, slot.y, 72, 72, 0x112233)
        .setStrokeStyle(6, 0xffff00)
        .setInteractive()
        .setDepth(15);

      (rect as any).relicId = relicId;
      (rect as any).isEquipped = true;
      (rect as any).slotIndex = i;

      slot.setData('equippedRect', rect);

      // ТЕКСТ теперь хранится в equippedTexts
      const nameText = this.add.text(slot.x, slot.y + 58, relicData.name, { 
        fontSize: '12px', 
        fill: '#ffff00',
        align: 'center',
        wordWrap: { width: 90 }
      }).setOrigin(0.5).setDepth(15);

      this.equippedTexts.push(nameText);

      // DRAG НА EQUIPPED RELICS
      this.input.setDraggable(rect);

      rect.on('dragstart', () => {
        rect.setScale(1.1);
        rect.setDepth(30);
      });

      rect.on('drag', (_: any, dragX: number, dragY: number) => {
        rect.x = dragX;
        rect.y = dragY;
      });

      rect.on('dragend', () => {
        rect.setScale(1.0);

        let stillInEquipped = false;
        for (let s = 0; s < 3; s++) {
          const slotRect = this.equippedSlotRects[s];
          const dx = slotRect.x - rect.x;
          const dy = slotRect.y - rect.y;
          if (Math.sqrt(dx * dx + dy * dy) < 80) {
            stillInEquipped = true;
            break;
          }
        }

        if (!stillInEquipped) {
          console.log(`🔄 Unequip relic ${relicId} drag'ом`);
          this.unequipRelic(i);
        } else {
          rect.x = this.equippedSlotRects[i].x;
          rect.y = this.equippedSlotRects[i].y;
        }
      });

      rect.on('pointerover', () => {
        this.showTooltip(slot.x + 40, slot.y - 30, 
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
  this.equippedRelics[slotIndex] = 0;
  console.log(`✅ Unequipped слот ${slotIndex}`);
  await this.refreshRelics();
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
  this.aiTexts.forEach(t => t.destroy());
  this.aiSprites = [];
  this.aiTexts = [];

  try {
    const aiData: any[] = await this.gameContract.read.getCurrentAI([this.account]);

    // Удаляем старый заголовок
    this.children.getAll().forEach(child => {
      if (child instanceof Phaser.GameObjects.Text && 
          Math.abs((child as any).x - 1150) < 200 && (child as any).y < 350) {
        child.destroy();
      }
    });

    // Заголовок — максимально справа и чуть выше Team
    this.add.text(1150, 310, 'AI OPPONENT', { fontSize: '22px', fill: '#ff3366' }).setOrigin(0.5);

    if (aiData.length === 0) {
      const placeholder = this.add.text(1150, 380, 'Первый противник\nбудет сгенерирован\nпри старте боя', {
        fontSize: '14px',
        fill: '#888888',
        align: 'center',
        lineSpacing: 4
      }).setOrigin(0.5);
      this.aiTexts.push(placeholder);
      return;
    }

    // === 2 РЯДА ПО 4 СЛОТА, максимально близко к правому краю ===
    for (let i = 0; i < aiData.length; i++) {
      const unit = aiData[i];
      const col = i % 4;
      const row = Math.floor(i / 4);

      // Сдвиг вправо: начинаем с x=950, чтобы последний слот был почти у края
      const x = 950 + col * 85;
      const y = 380 + row * 90;   // точно на уровне Team

      const strokeColor = unit.rarity === 2 ? 0xffaa00 : unit.rarity === 1 ? 0x00ff88 : 0x00ffff;

      const rect = this.add.rectangle(x, y, 68, 68, 0x112233)
        .setStrokeStyle(3, strokeColor);

      const sprite = this.add.sprite(x, y, 'ship').setInteractive();
      if (unit.rarity === 2) sprite.setScale(0.95);
      else if (unit.rarity === 1) sprite.setScale(0.85);

      const statsText = this.add.text(x, y + 45, 
        `${unit.attack}/${unit.defense}/${unit.speed}`, 
        { fontSize: '13px', fill: '#ffff00' }).setOrigin(0.5);

      this.aiSprites.push(sprite);
      this.aiTexts.push(statsText);

      sprite.on('pointerover', () => {
        const tooltipText = 
          `${this.getFactionName(unit.faction)}\n` +
          `Rarity: ${this.getRarityName(unit.rarity)}\n` +
          `Class: ${this.getClassName(unit.unitClass)}\n` +
          `ATK ${unit.attack}  DEF ${unit.defense}  SPD ${unit.speed}`;
        this.showTooltip(x + 40, y - 20, tooltipText);
      });

      sprite.on('pointerout', () => this.hideTooltip());
    }
  } catch (e) {
    console.error('loadCurrentAI error', e);
  }
}



private enableDoubleClickRemoveOnTeamUnit(rect: Phaser.GameObjects.GameObject, tokenId: number) {
  let lastClick = 0;

  rect.on('pointerdown', () => {
    const now = Date.now();
    if (now - lastClick < 300) {
      const slotIndex = this.teamSlotOccupants.findIndex(s => s === rect);
      if (slotIndex !== -1) {
        this.removeFromTeam(slotIndex);
      }
    }
    lastClick = now;
  });
}

private addGameUI() {
  this.gridSlots = [];
  this.teamSlotOccupants = new Array(8).fill(null);
  this.equippedSlotRects = [];

  // Team grid
  for (let i = 0; i < 8; i++) {
    const x = 420 + (i % 4) * 90;
    const y = 380 + Math.floor(i / 4) * 90;
    const slot = this.add.rectangle(x, y, 80, 80, 0x112233).setStrokeStyle(3, 0x00ffff);
    (slot as any).isGridSlot = true;
    (slot as any).slotIndex = i;
    this.gridSlots.push(slot);

    slot.setInteractive().on('pointerdown', () => {
      const occupant = this.teamSlotOccupants[i];
      if (occupant) this.removeFromTeam(i);
    });
  }

  this.teamCounterText = this.add.text(420, 320, 'TEAM: 0/8', { fontSize: '24px', fill: '#ffff00' });

  // Кнопка АВТОВЫБОР (оставляем как было)
  this.add.text(650, 280, 'АВТОВЫБОР', {
    fontSize: '22px',
    fill: '#00ffff',
    backgroundColor: '#112233',
    padding: { x: 15, y: 8 }
  })
    .setInteractive()
    .on('pointerdown', () => this.autoSelectTeam());

  // === ИСПРАВЛЕННАЯ КНОПКА ОЧИСТИТЬ КОМАНДУ ===
  const clearBtn = this.add.text(650, 320, 'ОЧИСТИТЬ КОМАНДУ', {
    fontSize: '22px',
    fill: '#ff6666',
    backgroundColor: '#112233',
    padding: { x: 15, y: 8 }
  })
    .setInteractive()
    .on('pointerdown', () => this.clearTeam());

  // EQUIPPED RELICS
  this.add.text(420, 500, 'EQUIPPED RELICS (max 3)', { fontSize: '20px', fill: '#ff00ff' });

  for (let i = 0; i < 3; i++) {
    const x = 420 + i * 110;
    const y = 550;
    const slot = this.add.rectangle(x, y, 80, 80, 0x112233)
      .setStrokeStyle(4, 0xffaa00)
      .setInteractive()
      .setData('equippedIndex', i);
    this.equippedSlotRects.push(slot);

    slot.on('pointerdown', () => this.unequipRelic(i));
  }

  // PROGRESS-BAR
  this.playerProfileText = this.add.text(50, 40, 'PROFILE: Level 1 | XP 0/100', {
    fontSize: '18px', fill: '#00ffff', align: 'left'
  });

  const progressBg = this.add.rectangle(50, 70, 220, 14, 0x112233).setStrokeStyle(2, 0x00ffff);
  const progressBar = this.add.rectangle(50, 70, 0, 14, 0x00ff88).setOrigin(0, 0.5);
  (this as any).levelProgressBar = progressBar;
  (this as any).levelProgressBg = progressBg;

  // Кнопки
  this.add.text(100, 100, 'BUY (FREE)', { fontSize: '22px', fill: '#00ffff' })
    .setInteractive().on('pointerdown', () => this.buyUnit());

  this.add.text(100, 140, 'REROLL SHOP (FREE)', { fontSize: '22px', fill: '#ff00ff' })
    .setInteractive().on('pointerdown', () => this.rerollShop());

  const refreshBtn = this.add.text(100, 180, 'REFRESH ALL', { fontSize: '22px', fill: '#ffff00' })
    .setInteractive()
    .on('pointerdown', () => {
      refreshBtn.setText('REFRESHING...');
      Promise.all([
        this.loadOwnedUnits(),
        this.loadPlayerShop(),
        this.loadPlayerRelics()
      ]).then(() => {
        refreshBtn.setText('REFRESH ALL');
        this.updatePlayerProfile();
      });
    });

  this.add.text(900, 600, '▶ START BATTLE', { fontSize: '42px', fill: '#ff3333' })
    .setInteractive().on('pointerdown', () => this.startBattle());
}


private autoSelectTeam() {
  if (this.ownedSprites.length === 0) return;

  // Очищаем текущую команду
  this.team = [];
  this.teamSlotOccupants = new Array(8).fill(null);

  // ФИЛЬТРУЕМ ТОЛЬКО НАСТОЯЩИЕ ЮНИТЫ (у которых есть .unit)
  const onlyUnits = this.ownedSprites.filter(sprite => {
    const unit = (sprite as any).unit;
    return unit && typeof unit.rarity !== 'undefined';
  });

  if (onlyUnits.length === 0) return;

  // Сортируем по приоритету: Legendary (2) → Rare (1) → Common (0)
  const sorted = [...onlyUnits].sort((a, b) => {
    const rarityA = (a as any).unit.rarity;
    const rarityB = (b as any).unit.rarity;

    if (rarityA !== rarityB) return rarityB - rarityA; // более редкие первыми

    // При равном rarity — по общей силе (attack + defense + speed)
    const powerA = (a as any).unit.attack + (a as any).unit.defense + (a as any).unit.speed;
    const powerB = (b as any).unit.attack + (b as any).unit.defense + (b as any).unit.speed;
    return powerB - powerA;
  });

  // Берём максимум 8 юнитов
  const toSelect = sorted.slice(0, 8);

  // Заполняем team и слоты
  for (let i = 0; i < toSelect.length; i++) {
    const rect = toSelect[i] as any;
    const tokenId = rect.tokenId;

    const slotIndex = i;
    const slot = this.gridSlots[slotIndex];

    if (slot) {
      rect.setPosition(slot.x, slot.y);
      rect.input.draggable = false;
      this.teamSlotOccupants[slotIndex] = rect;
      this.enableDoubleClickRemoveOnTeamUnit(rect, tokenId);

      this.team.push(tokenId);
    }
  }

  this.updateTeamCounter();
  console.log(`✅ Автовыбор: выбрано ${this.team.length} юнитов (из ${onlyUnits.length} доступных)`);
}

private clearTeam() {
  if (this.team.length === 0) return;

  // Возвращаем все юниты из команды обратно в коллекцию «ТВОИ ЮНИТЫ»
  for (let i = 0; i < this.teamSlotOccupants.length; i++) {
    const occupant = this.teamSlotOccupants[i];
    if (!occupant) continue;

    const tokenId = (occupant as any).tokenId;
    const orig = this.originalPositions.get(tokenId);

    if (orig) {
      occupant.x = orig.x;
      occupant.y = orig.y;
      occupant.setScale(0.75);
      occupant.setInteractive();
      (occupant as any).input.draggable = true;
    }

    this.teamSlotOccupants[i] = null;
  }

  this.team = [];
  if (this.teamCounterText) this.teamCounterText.setText('TEAM: 0/8');

  console.log('✅ Команда очищена, юниты возвращены в коллекцию');
}


 private async updatePlayerProfile() {
  if (!this.account || !this.gameContract || !this.playerProfileText) return;
  try {
    const profile = await this.gameContract.read.profiles([this.account]);
    const level = Number(profile.level);
    const xp = Number(profile.xp);
    const nextXp = level * 90 + 120;                    // ← новая формула
    const text = `PROFILE: Level ${level} | XP ${xp}/${nextXp} | W:${profile.wins} L:${profile.losses}`;
    this.playerProfileText.setText(text);

    // Прогресс-бар
    const progress = Math.min(xp / nextXp, 1);
    const bar = (this as any).levelProgressBar as Phaser.GameObjects.Rectangle;
    if (bar) bar.width = 220 * progress;

    // Уведомление Level Up
    if (xp === 0 && level > 1) {
      const levelUpText = this.add.text(400, 200, `LEVEL UP! → ${level}`, {
        fontSize: '42px', fill: '#ffff00', fontStyle: 'bold'
      }).setOrigin(0.5);
      this.tweens.add({
        targets: levelUpText,
        y: levelUpText.y - 80,
        alpha: 0,
        duration: 2200,
        onComplete: () => levelUpText.destroy()
      });
    }
  } catch (e) {
    console.error('updatePlayerProfile error', e);
  }
}


  private showTooltip(x: number, y: number, text: string) {
    if (!this.tooltip || this.tooltip.scene !== this) {
      this.tooltip = this.add.text(0, 0, '', {
        fontSize: '16px',
        fill: '#ffffff',
        backgroundColor: '#112233',
        padding: { x: 12, y: 8 },
        align: 'left'
      })
        .setOrigin(0.5, 1)
        .setDepth(100);
    }

    this.tooltip.setText(text);
    this.tooltip.setPosition(x, y - 15);
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

    private highlightFreeSlots() {
  this.gridSlots.forEach(slot => {
    const hasUnit = this.teamSlotOccupants.some(occupant => occupant && 
      Math.abs((occupant as any).x - slot.x) < 20 && 
      Math.abs((occupant as any).y - slot.y) < 20
    );
    slot.setStrokeStyle(5, hasUnit ? 0xff6666 : 0x00ff88);
  });
}

private resetSlotHighlights() {
  this.gridSlots.forEach(slot => {
    slot.setStrokeStyle(3, 0x00ffff);
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
    const waiting = this.add.text(400, 300, 'TX buyUnit отправлена... ждём on-chain (3 сек)', { fontSize: '24px', fill: '#ffff00' });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    console.log('✅ buyUnit confirmed');

    waiting.destroy();
    const msg = this.add.text(400, 300, 'Юнит куплен on-chain!', { fontSize: '32px', fill: '#00ff00' });
    setTimeout(() => { msg.destroy(); }, 2200);

    // 3 секунды задержка перед обновлением UI
    setTimeout(() => {
      this.loadOwnedUnits();
      this.loadPlayerShop();
      this.loadPlayerRelics();
    }, 3000);
  } catch (e: any) {
    const errMsg = e.shortMessage || e.message || 'Неизвестная ошибка';
    const errorText = this.add.text(400, 300, `Ошибка: ${errMsg}`, { fontSize: '24px', fill: '#ff4444' });
    setTimeout(() => errorText.destroy(), 4000);
  }
}

  private async buyFromShopSlot(slot: number) {
  if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) 
    return alert('Сначала подключи MetaMask');

  try {
    const hash = await this.gameContract.write.buyFromShop([BigInt(slot)], { account: this.account, value: 0n });
    const waiting = this.add.text(400, 300, `TX buyFromShop [${slot}] отправлена... ждём on-chain (3 сек)`, { fontSize: '24px', fill: '#ffff00' });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    console.log('✅ buyFromShop confirmed');

    waiting.destroy();
    const msg = this.add.text(400, 300, `Артефакт куплен!`, { fontSize: '28px', fill: '#00ff00' });
    setTimeout(() => { msg.destroy(); }, 1800);

    // 3 секунды задержка перед обновлением UI
    setTimeout(() => {
      this.loadPlayerShop();
      this.loadPlayerRelics();
      this.loadCurrentAI();
    }, 3000);
  } catch (e: any) {
    const errMsg = e.shortMessage || e.message || 'Ошибка';
    const errorText = this.add.text(400, 300, `Ошибка: ${errMsg}`, { fontSize: '24px', fill: '#ff4444' });
    setTimeout(() => errorText.destroy(), 4000);
  }
}

  private async rerollShop() {
  if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) 
    return alert('Сначала подключи MetaMask');

  try {
    const hash = await this.gameContract.write.rerollShop([], { account: this.account, value: 0n });
    const waiting = this.add.text(400, 340, 'TX reroll отправлена... ждём on-chain (3 сек)', { fontSize: '28px', fill: '#ffff00' });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    console.log('✅ rerollShop confirmed');

    waiting.destroy();
    const msg = this.add.text(400, 340, 'Shop rerolled — новые артефакты', { fontSize: '28px', fill: '#ffff00' });
    setTimeout(() => { msg.destroy(); }, 1800);

    this.clearTemporaryTexts();

    // 3 секунды задержка перед обновлением UI
    setTimeout(() => {
      this.loadPlayerShop();
      this.loadCurrentAI();
    }, 3000);
  } catch (e: any) {
    const errMsg = e.shortMessage || e.message || 'Ошибка rerollShop';
    const errorText = this.add.text(400, 340, `Ошибка: ${errMsg}`, { fontSize: '24px', fill: '#ff4444' });
    setTimeout(() => errorText.destroy(), 4000);
    console.error('rerollShop error:', e);
  }
}

private async startBattle() {
  if (!this.isWalletReady || !this.gameContract || !this.account || !this.publicClient) 
    return alert('Сначала подключи MetaMask');

  console.log('🚀 startBattle: team =', this.team, 'equipped =', this.equippedRelics);

  if (this.team.length < 4 || this.team.length > 8) {
    return this.add.text(500, 500, `Нужно 4-8 юнитов! Сейчас: ${this.team.length}`, { fontSize: '28px', fill: '#ff0000' });
  }

  const tempTeam = [...this.team];

  try {
    const teamBigInt = this.team.map(id => BigInt(id));
    const equippedBigInt = this.equippedRelics.map(id => BigInt(id));

    const hash = await this.gameContract.write.startMatch([teamBigInt, equippedBigInt], { account: this.account });
    
    const waitingText = this.add.text(500, 280, 'TX отправлена... Бой обрабатывается on-chain (5–10 сек)', { fontSize: '24px', fill: '#ffff00' });

    const receipt = await this.publicClient.waitForTransactionReceipt({ 
      hash, 
      confirmations: 1 
    });

    console.log('✅ receipt получен, status:', receipt.status);

    if (receipt.status !== 'success') {
      throw new Error(`Транзакция не прошла (status = ${receipt.status})`);
    }

    waitingText.destroy();

    // Очищаем команду ТОЛЬКО после успеха
    this.team = [];
    if (this.teamCounterText) this.teamCounterText.setText('TEAM: 0/8');

    await new Promise(resolve => setTimeout(resolve, 7000));

    // ← НОВЫЙ РАЗБОР РЕЗУЛЬТАТА (4 значения)
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
        console.log(`📡 getLastBattleResult attempt ${attempt + 1}: events=${events.length}, playerMaxHp=${playerMaxHp.length}, aiMaxHp=${aiMaxHp.length}`);
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
    const errorText = this.add.text(400, 300, `ОШИБКА: ${errMsg}\nБой отменён.\nКоманда восстановлена.`, { 
      fontSize: '24px', 
      fill: '#ff4444',
      align: 'center',
      wordWrap: { width: 700 }
    });
    setTimeout(() => errorText.destroy(), 6000);
  }
}


private playVisualBattle() {
    const cx = 640, cy = 400;

    this.children.getAll().forEach(child => {
      if (!child) return;

      if (child.type === 'Text' && 
          (child.text.includes('ПОБЕДА') || 
           child.text.includes('Получено') || 
           child.text.includes('TX') || 
           child.text.includes('БОЙ НАЧАЛСЯ'))) {
        child.destroy();
      }

      if (child.type === 'Line' || child.type === 'Arc') {
        child.destroy();
      }
    });

    this.add.text(420, 260, 'БОЙ НАЧАЛСЯ...', { fontSize: '32px', fill: '#ff00ff' });

    for (let wave = 0; wave < 4; wave++) {
      setTimeout(() => {
        for (let i = 0; i < 6; i++) {
          const startX = 200 + Math.random() * 100;
          const startY = 300 + Math.random() * 200;
          const laser = this.add.line(0, 0, startX, startY, cx - 80, cy + (Math.random() * 120 - 60), 0x00ffff)
            .setLineWidth(4);
          this.tweens.add({
            targets: laser,
            alpha: 0,
            duration: 280 + Math.random() * 120,
            onComplete: () => laser.destroy()
          });
        }

        for (let i = 0; i < 4; i++) {
          const startX = 1080 - Math.random() * 100;
          const startY = 300 + Math.random() * 200;
          const laser = this.add.line(0, 0, startX, startY, cx + 80, cy + (Math.random() * 120 - 60), 0xff3366)
            .setLineWidth(3);
          this.tweens.add({
            targets: laser,
            alpha: 0,
            duration: 320 + Math.random() * 100,
            onComplete: () => laser.destroy()
          });
        }

        if (wave >= 2) {
          const boom = this.add.circle(cx, cy, 50 + wave * 15, 0xffaa00).setAlpha(0.9);
          this.tweens.add({
            targets: boom,
            scale: 3.5,
            alpha: 0,
            duration: 450 + wave * 50,
            onComplete: () => boom.destroy()
          });
        }

        if (wave === 3) {
          setTimeout(() => {
            const victoryFlash = this.add.circle(cx, cy, 180, 0x00ffcc).setAlpha(0.6);
            this.tweens.add({
              targets: victoryFlash,
              scale: 4,
              alpha: 0,
              duration: 800,
              onComplete: () => victoryFlash.destroy()
            });

            this.add.text(420, 260, 'ПОБЕДА! + rewards on-chain', { fontSize: '38px', fill: '#00ff00', fontStyle: 'bold' });
          }, 300);
        }
      }, wave * 520);
    }
  }
    shutdown() {
    // Полная очистка при уходе со сцены (важно для возврата из BattleScene)
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
    this.hideTooltip();

    // Очищаем все спрайты, чтобы не оставались старые listeners
    this.ownedSprites.forEach(s => s.destroy());
    this.shopSprites.forEach(s => s.destroy());
    this.aiSprites.forEach(s => s.destroy());
    this.aiTexts.forEach(t => t.destroy());
    this.equippedTexts.forEach(t => t.destroy());
    this.equippedTexts = [];

  console.log('✅ PrepareScene shutdown — очистка перед выходом');
  }

    init(data: any) {
    this.gameContract = data.gameContract;
    this.nftContract = data.nftContract;
    this.relicContract = data.relicContract;
    this.account = data.account;
    this.publicClient = data.publicClient;
    this.isWalletReady = true;
    console.log('✅ PrepareScene init — данные от BootScene получены');
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

  this.add.image(640, 360, 'bg');

  this.addGameUI();
  
  // ← ИСПРАВЛЕНИЕ: без await (fire-and-forget, как и все остальные вызовы)
  this.initEquippedState();
  this.refreshRelics();
  this.updatePlayerProfile();

  this.loadOwnedUnits();
  this.loadPlayerShop();
  this.loadPlayerRelics();

  console.log('✅ PrepareScene создана (после боя)');
}
}
