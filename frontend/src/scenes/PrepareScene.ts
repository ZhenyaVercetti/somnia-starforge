// @ts-nocheck
// frontend/src/scenes/PrepareScene.ts
import * as Phaser from 'phaser';
import { getContract } from 'viem';

export default class PrepareScene extends Phaser.Scene {
  private gameContract: any;
  private nftContract: any;
  private account: `0x${string}` | undefined;

  private team: number[] = [];
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

  constructor() {
    super({ key: 'PrepareScene' });
  }

  init(data: any) {
    this.gameContract = data.gameContract;
    this.nftContract = data.nftContract;
    this.account = data.account;
    this.isWalletReady = true;
  }

      create() {
    this.addGameUI();
    this.loadOwnedUnits();
    this.loadPlayerShop();
    this.updatePlayerProfile();

    // === HOVER TOOLTIP ===
    this.tooltip = this.add.text(0, 0, '', {
      fontSize: '16px',
      fill: '#ffffff',
      backgroundColor: '#112233',
      padding: { x: 12, y: 8 },
      align: 'left'
    })
      .setOrigin(0, 1)
      .setDepth(100)
      .setVisible(false);
  }

      private async loadOwnedUnits() {
    if (!this.account || !this.gameContract || !this.nftContract) return;

    this.ownedSprites.forEach(s => s.destroy());
    this.ownedSprites = [];

    try {
      const ownedIds: bigint[] = await this.gameContract.read.getPlayerUnits([this.account]);
      console.log('📦 Твои юниты:', ownedIds);

      this.children.getAll().forEach(child => {
        if (child instanceof Phaser.GameObjects.Text && child.text.includes('ТВОИ ЮНИТЫ')) child.destroy();
      });
      this.add.text(50, 150, `ТВОИ ЮНИТЫ (${ownedIds.length})`, { fontSize: '18px', fill: '#ffff00' });

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
          .setScale(0.75);
        (rect as any).tokenId = tokenId;

        let scaleMod = 0.75;
        if (rarity === 1) scaleMod = 0.85;
        else if (rarity === 2) scaleMod = 0.95;
        rect.setScale(scaleMod);

        // Hover tooltip
        rect.on('pointerover', () => {
          const tooltipText = 
            `${this.getFactionName(unit.faction)}\n` +
            `Rarity: ${this.getRarityName(unit.rarity)}\n` +
            `Class: ${this.getClassName(unit.unitClass)}\n` +
            `ATK ${unit.attack}  DEF ${unit.defense}  SPD ${unit.speed}`;
          this.showTooltip(x + 25, y, tooltipText);
        });

        rect.on('pointerout', () => this.hideTooltip());

                this.input.setDraggable(rect);

        rect.on('dragstart', () => {
          rect.setScale(0.9);                    // визуально «поднял»
          this.highlightFreeSlots();
        });

        rect.on('drag', (_: any, dragX: number, dragY: number) => {
          rect.x = dragX;
          rect.y = dragY;
        });

                rect.on('dragend', () => {
          rect.setScale(0.75);
          this.resetSlotHighlights();

          const slotIndex = this.gridSlots.findIndex((s: any) =>
            Math.abs(s.x - rect.x) < 55 && Math.abs(s.y - rect.y) < 55
          );

          // === ЗАЩИТА ОТ СТЕКИНГА ===
          const slotAlreadyOccupied = this.ownedSprites.some((s: any) => 
            s !== rect && 
            Math.abs(s.x - this.gridSlots[slotIndex]?.x) < 20 && 
            Math.abs(s.y - this.gridSlots[slotIndex]?.y) < 20
          );

          if (slotIndex !== -1 && 
              this.team.length < 8 && 
              !this.team.includes(tokenId) && 
              !slotAlreadyOccupied) {
            
            this.team.push(tokenId);
            rect.setPosition(this.gridSlots[slotIndex].x, this.gridSlots[slotIndex].y);
            rect.disableInteractive();
            if (this.teamCounterText) this.teamCounterText.setText(`TEAM: ${this.team.length}/8`);
          } else {
            // Возврат на место
            rect.x = x;
            rect.y = y;
          }
        });

        this.ownedSprites.push(rect);
      });

      if (this.teamCounterText) this.teamCounterText.setText(`TEAM: ${this.team.length}/8`);
    } catch (e) {
      console.error('loadOwnedUnits error', e);
    }
  }

    private async loadPlayerShop() {
    if (!this.account || !this.gameContract) return;
    this.shopSprites.forEach(s => s.destroy()); this.shopSprites = [];

    try {
      const shopData: any[] = await this.gameContract.read.getPlayerShop([this.account]);
      console.log('🛒 Shop preview:', shopData);

      this.add.text(650, 80, 'SHOP (5 слотов)', { fontSize: '22px', fill: '#ff00ff' });

      for (let i = 0; i < 5; i++) {
        const unit = shopData[i];
        const x = 680 + i * 100;
        const y = 140;

        // Удаляем старые элементы слота
        this.children.getAll().forEach(child => {
          if (child instanceof Phaser.GameObjects.Text && 
              Math.abs(child.x - x) < 60 && Math.abs(child.y - y) < 100) child.destroy();
          if (child instanceof Phaser.GameObjects.Rectangle && 
              Math.abs(child.x - x) < 60 && Math.abs(child.y - y) < 60) child.destroy();
        });

        const strokeColor = unit.rarity === 2 ? 0xffaa00 : unit.rarity === 1 ? 0x00ff88 : 0x00ffff;
        this.add.rectangle(x, y, 80, 80, 0x112233).setStrokeStyle(4, strokeColor);

        const sprite = this.add.sprite(x, y, 'ship').setInteractive();
        (sprite as any).shopSlot = i;

        if (unit.rarity === 2) sprite.setScale(1.3);
        else if (unit.rarity === 1) sprite.setScale(1.15);

        const rarityColor = unit.rarity === 2 ? '#ffff00' : unit.rarity === 1 ? '#00ff00' : '#ffffff';
        this.add.text(x - 35, y - 45, `${unit.faction} ${unit.rarity} ${unit.unitClass}`, { fontSize: '12px', fill: rarityColor });
        this.add.text(x - 30, y + 50, `${unit.attack}/${unit.defense}/${unit.speed}`, { fontSize: '14px', fill: '#ffff00' });

        this.add.text(x - 20, y + 80, 'BUY', { fontSize: '18px', fill: '#00ff00' })
          .setInteractive()
          .on('pointerdown', () => this.buyFromShopSlot(i));

        // === HOVER TOOLTIP ДЛЯ SHOP ===
        sprite.on('pointerover', () => {
          const tooltipText = 
            `${this.getFactionName(unit.faction)}\n` +
            `Rarity: ${this.getRarityName(unit.rarity)}\n` +
            `Class: ${this.getClassName(unit.unitClass)}\n` +
            `ATK ${unit.attack}  DEF ${unit.defense}  SPD ${unit.speed}`;
          this.showTooltip(x + 90, y - 30, tooltipText);
        });

        sprite.on('pointerout', () => {
          this.hideTooltip();
        });

        this.shopSprites.push(sprite);
      }
    } catch (e) { console.error('loadPlayerShop error', e); }
  }

  private async buyFromShopSlot(slot: number) {
    if (!this.isWalletReady || !this.gameContract || !this.account) return alert('Сначала подключи MetaMask');
    try {
      await this.gameContract.write.buyFromShop([BigInt(slot)], { account: this.account, value: 1000000000000000n });
      this.add.text(400, 300, `Юнит из слота ${slot} куплен!`, { fontSize: '28px', fill: '#00ff00' });
      setTimeout(() => {
        this.loadPlayerShop();
        this.loadOwnedUnits();
      }, 2500);
    } catch (e: any) { alert(e.shortMessage || e.message); }
  }

  private addGameUI() {
    this.gridSlots = [];
    for (let i = 0; i < 8; i++) {
      const x = 420 + (i % 4) * 90;
      const y = 380 + Math.floor(i / 4) * 90;
      const slot = this.add.rectangle(x, y, 80, 80, 0x112233).setStrokeStyle(3, 0x00ffff);
      (slot as any).isGridSlot = true;
      this.gridSlots.push(slot);
    }

    this.teamCounterText = this.add.text(420, 320, 'TEAM: 0/8', { fontSize: '24px', fill: '#ffff00' });

    this.playerProfileText = this.add.text(50, 40, 'PROFILE: Level 1 | XP 0 | W:0 L:0', {
      fontSize: '18px', fill: '#00ffff', align: 'left'
    });

    this.add.text(100, 100, 'BUY (0.001 STT)', { fontSize: '22px', fill: '#00ffff' })
      .setInteractive().on('pointerdown', () => this.buyUnit());

    this.add.text(100, 140, 'REROLL SHOP (0.0005 STT)', { fontSize: '22px', fill: '#ff00ff' })
      .setInteractive().on('pointerdown', () => this.rerollShop());

    this.add.text(100, 180, 'REFRESH OWNED', { fontSize: '22px', fill: '#ffff00' })
      .setInteractive().on('pointerdown', () => this.loadOwnedUnits());

    this.add.text(900, 600, '▶ START BATTLE', { fontSize: '42px', fill: '#ff3333' })
      .setInteractive().on('pointerdown', () => this.startBattle());

    const clearBtn = this.add.text(650, 320, 'ОЧИСТИТЬ КОМАНДУ', { fontSize: '22px', fill: '#ff6666', backgroundColor: '#112233', padding: { x: 15, y: 8 } })
      .setInteractive()
      .on('pointerdown', () => {
        this.team = [];
        if (this.teamCounterText) this.teamCounterText.setText('TEAM: 0/8');
        this.loadOwnedUnits();
      });
  }

  private async updatePlayerProfile() {
    if (!this.account || !this.gameContract || !this.playerProfileText) return;
    try {
      const profile = await this.gameContract.read.profiles([this.account]);
      const text = `PROFILE: Level ${profile.level} | XP ${profile.xp} | W:${profile.wins} L:${profile.losses}`;
      this.playerProfileText.setText(text);
    } catch (e) {
      console.error('updatePlayerProfile error', e);
    }
  }
    private showTooltip(x: number, y: number, text: string) {
    if (!this.tooltip) return;
    this.tooltip.setText(text);
    this.tooltip.setPosition(x + 60, y - 10);
    this.tooltip.setVisible(true);
  }

    private hideTooltip() {
    if (this.tooltip) this.tooltip.setVisible(false);
  }
    private highlightFreeSlots() {
    this.gridSlots.forEach(slot => {
      // Проверяем, есть ли в этом слоте реальный юнит (rect)
      const hasUnit = this.ownedSprites.some((s: any) => 
        Math.abs(s.x - slot.x) < 20 && Math.abs(s.y - slot.y) < 20
      );
      slot.setStrokeStyle(5, hasUnit ? 0xff6666 : 0x00ff88); // красный = занят, зелёный = свободен
    });
  }

    private resetSlotHighlights() {
    this.gridSlots.forEach(slot => {
      slot.setStrokeStyle(3, 0x00ffff); // обычный цвет
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
    if (!this.isWalletReady || !this.gameContract || !this.account) return alert('Сначала подключи MetaMask');
    try {
      await this.gameContract.write.buyUnit([], { account: this.account, value: 1000000000000000n });
      this.add.text(400, 300, 'Юнит куплен on-chain!', { fontSize: '32px', fill: '#00ff00' });
      setTimeout(() => {
        this.loadOwnedUnits();
        this.loadPlayerShop();
      }, 3000);
    } catch (e) { alert((e as Error).message); }
  }

  private async rerollShop() {
    if (!this.isWalletReady || !this.gameContract || !this.account) return alert('Сначала подключи MetaMask');
    try {
      await this.gameContract.write.rerollShop([], { account: this.account, value: 500000000000000n });
      this.add.text(400, 340, 'Shop rerolled', { fontSize: '28px', fill: '#ffff00' });
      setTimeout(() => this.loadPlayerShop(), 2000);
    } catch (e) { alert((e as Error).message); }
  }

      private async startBattle() {
    if (!this.isWalletReady || !this.gameContract || !this.account) return alert('Сначала подключи MetaMask');
    
    console.log('🚀 startBattle: team =', this.team);

    if (this.team.length < 4 || this.team.length > 8) {
      return this.add.text(500, 500, `Нужно 4-8 юнитов! Сейчас: ${this.team.length}`, { fontSize: '28px', fill: '#ff0000' });
    }

    try {
      const teamBigInt = this.team.map(id => BigInt(id));
      console.log('📤 Отправляем teamBigInt:', teamBigInt);

      const ownedBefore = await this.gameContract.read.getPlayerUnits([this.account]);
      this.lastOwnedCount = ownedBefore.length;

      await this.gameContract.write.startMatch([teamBigInt], { account: this.account });
      
      this.add.text(500, 280, 'TX отправлена on-chain...', { fontSize: '24px', fill: '#ffff00' });

      // Запускаем отдельную сцену боя
      this.scene.start('BattleScene');

      this.team = [];
      if (this.teamCounterText) this.teamCounterText.setText('TEAM: 0/8');

      // Обновление наград после возврата из BattleScene
      setTimeout(async () => {
        await this.loadOwnedUnits();
        await this.loadPlayerShop();
        
        const ownedAfter = await this.gameContract.read.getPlayerUnits([this.account]);
        this.lastRewardsCount = ownedAfter.length - this.lastOwnedCount;
        this.lastRewardIds = ownedAfter.slice(-this.lastRewardsCount).map(id => Number(id));
        
        console.log(`🎁 Получено наград: ${this.lastRewardsCount} | ID:`, this.lastRewardIds);

        const rewardText = this.lastRewardsCount > 1 
          ? `Получено ${this.lastRewardsCount} юнита!` 
          : `Получено ${this.lastRewardsCount} юнит!`;
        
        if (this.rewardNotification) this.rewardNotification.destroy();
        this.rewardNotification = this.add.text(420, 310, rewardText, { fontSize: '26px', fill: '#ffff00' });

        if (this.lastRewardIds.length > 0) {
          this.add.text(420, 340, `ID: ${this.lastRewardIds.join(', ')}`, { fontSize: '18px', fill: '#aaffff' });
        }
        
        setTimeout(() => {
          if (this.rewardNotification) this.rewardNotification.destroy();
        }, 4500);
      }, 8500);   // чуть больше, чтобы успела отработать BattleScene
    } catch (e: any) {
      console.error('❌ startMatch error:', e);
      alert(e.shortMessage || e.message || 'Неизвестная ошибка контракта');
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
}