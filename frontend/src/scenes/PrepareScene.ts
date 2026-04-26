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
  private aiSprites: Phaser.GameObjects.Sprite[] = [];
  private aiTexts: Phaser.GameObjects.Text[] = [];

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
    this.loadPlayerShop();      // ← теперь инициализирует preview автоматически
    this.loadCurrentAI();
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

        rect.on('dragstart', () => { rect.setScale(0.9); this.highlightFreeSlots(); });
        rect.on('drag', (_: any, dragX: number, dragY: number) => { rect.x = dragX; rect.y = dragY; });
        rect.on('dragend', () => {
          rect.setScale(0.75);
          this.resetSlotHighlights();

          const slotIndex = this.gridSlots.findIndex((s: any) =>
            Math.abs(s.x - rect.x) < 55 && Math.abs(s.y - rect.y) < 55
          );

          if (slotIndex !== -1 && this.team.length < 8 && !this.team.includes(tokenId)) {
            this.team.push(tokenId);
            rect.setPosition(this.gridSlots[slotIndex].x, this.gridSlots[slotIndex].y);
            rect.disableInteractive();
            if (this.teamCounterText) this.teamCounterText.setText(`TEAM: ${this.team.length}/8`);
          } else {
            rect.x = x;
            rect.y = y;
          }
        });

        this.ownedSprites.push(rect);
      });
    } catch (e) {
      console.error('loadOwnedUnits error', e);
    }
  }

            private async loadPlayerShop() {
    if (!this.account || !this.gameContract) return;
    this.shopSprites.forEach(s => s.destroy()); this.shopSprites = [];

    try {
      const shopData: any[] = await this.gameContract.read.getPlayerShop([this.account]);
      console.log('🛒 Shop preview RAW:', shopData);

      // Аккуратная очистка только shop-элементов
      this.children.getAll().forEach(child => {
        if (child instanceof Phaser.GameObjects.Text && 
            (child.text.includes('SHOP (5 слотов)') || 
             (child.text.includes('BUY') && child.y > 200 && child.y < 250))) {
          child.destroy();
        }
        if (child instanceof Phaser.GameObjects.Rectangle && 
            child.x > 650 && child.x < 1200 && child.y < 250) {
          child.destroy();
        }
      });

      this.add.text(650, 80, 'SHOP (5 слотов)', { fontSize: '22px', fill: '#ff00ff' });

      const isEmpty = shopData[0] && shopData[0].attack === 0;

      if (isEmpty) {
        const placeholder = this.add.text(850, 175, 'REROLL SHOP\n(0.0005 STT)\nчтобы увидеть\nпервые предложения', {
          fontSize: '16px',
          fill: '#888888',
          align: 'center',
          lineSpacing: 8
        }).setOrigin(0.5);
        this.shopSprites.push(placeholder as any);
        return;
      }

      for (let i = 0; i < 5; i++) {
        const unit = shopData[i];
        const x = 680 + i * 100;
        const y = 140;

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

        sprite.on('pointerover', () => {
          const tooltipText = 
            `${this.getFactionName(unit.faction)}\n` +
            `Rarity: ${this.getRarityName(unit.rarity)}\n` +
            `Class: ${this.getClassName(unit.unitClass)}\n` +
            `ATK ${unit.attack}  DEF ${unit.defense}  SPD ${unit.speed}`;
          this.showTooltip(x + 90, y - 30, tooltipText);
        });

        sprite.on('pointerout', () => this.hideTooltip());

        this.shopSprites.push(sprite);
      }
    } catch (e) { 
      console.error('loadPlayerShop error', e); 
    }
  }

          private async loadCurrentAI() {
    if (!this.account || !this.gameContract) return;

    this.aiSprites.forEach(s => s.destroy());
    this.aiTexts.forEach(t => t.destroy());
    this.aiSprites = [];
    this.aiTexts = [];

    try {
      const aiData: any[] = await this.gameContract.read.getCurrentAI([this.account]);
      console.log('🤖 Current AI opponent:', aiData);

      // Заголовок AI
      this.children.getAll().forEach(child => {
        if (child instanceof Phaser.GameObjects.Text && 
            Math.abs((child as any).x - 680) < 100 && (child as any).y === 240) {
          child.destroy();
        }
      });

      this.add.text(680, 240, 'AI OPPONENT', { fontSize: '22px', fill: '#ff3366' });

      if (aiData.length === 0) {
        const placeholder = this.add.text(720, 285, 'Первый противник\nбудет сгенерирован\nпри старте первого боя', {
          fontSize: '14px',
          fill: '#888888',
          align: 'center',
          lineSpacing: 4
        }).setOrigin(0.5, 0);
        this.aiTexts.push(placeholder);
        return;
      }

      for (let i = 0; i < aiData.length; i++) {
        const unit = aiData[i];
        const x = 680 + i * 85;
        const y = 280;

        const strokeColor = unit.rarity === 2 ? 0xffaa00 : unit.rarity === 1 ? 0x00ff88 : 0x00ffff;

        const rect = this.add.rectangle(x, y, 68, 68, 0x112233)
          .setStrokeStyle(3, strokeColor);

        const sprite = this.add.sprite(x, y, 'ship').setInteractive();
        if (unit.rarity === 2) sprite.setScale(0.95);
        else if (unit.rarity === 1) sprite.setScale(0.85);

        const statsText = this.add.text(x - 30, y + 38, 
          `${unit.attack}/${unit.defense}/${unit.speed}`, 
          { fontSize: '13px', fill: '#ffff00' });

        this.aiSprites.push(sprite);
        this.aiTexts.push(statsText);

        // Hover tooltip
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

      private async buyFromShopSlot(slot: number) {
    if (!this.isWalletReady || !this.gameContract || !this.account) return alert('Сначала подключи MetaMask');
    try {
      console.log('🚀 buyFromShopSlot slot', slot);
      await this.gameContract.write.buyFromShop([BigInt(slot)], { 
        account: this.account, 
        value: 1000000000000000n,
        gas: 1200000n 
      });
      const msg = this.add.text(400, 300, `✅ Юнит из слота ${slot} куплен!`, { fontSize: '28px', fill: '#00ff00' });
      setTimeout(() => { msg.destroy(); }, 2200);

      setTimeout(async () => {
        await this.loadOwnedUnits();
        await this.loadPlayerShop();
      }, 9000);
    } catch (e: any) {
      console.error('buyFromShopSlot FULL ERROR:', e);
      const errMsg = e.shortMessage || e.message || e.details || JSON.stringify(e);
      const errorText = this.add.text(400, 300, `❌ Ошибка: ${errMsg}`, { fontSize: '22px', fill: '#ff4444' });
      setTimeout(() => errorText.destroy(), 8000);
    }
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

    // Короткая кнопка REFRESH с обратной связью
    const refreshBtn = this.add.text(100, 180, 'REFRESH', { fontSize: '22px', fill: '#ffff00' })
      .setInteractive()
      .on('pointerdown', () => {
        refreshBtn.setText('REFRESHING...');
        this.loadOwnedUnits().then(() => {
          refreshBtn.setText('REFRESH');
        });
      });

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
    // Если tooltip ещё не создан или был уничтожен — создаём заново
    if (!this.tooltip) {
      this.tooltip = this.add.text(0, 0, '', {
        fontSize: '16px',
        fill: '#ffffff',
        backgroundColor: '#112233',
        padding: { x: 12, y: 8 },
        align: 'left'
      })
        .setOrigin(0, 1)
        .setDepth(100);
    }

    this.tooltip.setText(text);
    this.tooltip.setPosition(x + 60, y - 10);
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
        const t = child.text.toLowerCase();
        if (t.includes('куплен') || t.includes('rerolled') || t.includes('tx отправлена') || t.includes('победа')) {
          child.destroy();
        }
      }
    });
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
      console.log('🚀 buyUnit: отправляем tx (0 STT)...');
      await this.gameContract.write.buyUnit([], { 
        account: this.account, 
        value: 0n,           // ← ИЗМЕНЕНО
        gas: 1200000n 
      });
      const msg = this.add.text(400, 300, '✅ Юнит куплен on-chain!', { fontSize: '32px', fill: '#00ff00' });
      setTimeout(() => { msg.destroy(); }, 2200);

      setTimeout(async () => {
        console.log('🔄 Обновляем owned units...');
        await this.loadOwnedUnits();
        await this.loadPlayerShop();
      }, 8000);
    } catch (e: any) {
      console.error('buyUnit FULL ERROR:', e);
      const errMsg = e.shortMessage || e.message || e.details || JSON.stringify(e);
      const errorText = this.add.text(400, 300, `❌ Ошибка: ${errMsg}`, { fontSize: '22px', fill: '#ff4444' });
      setTimeout(() => errorText.destroy(), 8000);
    }
  }

  private async buyFromShopSlot(slot: number) {
    if (!this.isWalletReady || !this.gameContract || !this.account) return alert('Сначала подключи MetaMask');
    try {
      console.log('🚀 buyFromShopSlot slot', slot);
      await this.gameContract.write.buyFromShop([BigInt(slot)], { 
        account: this.account, 
        value: 0n,           // ← ИЗМЕНЕНО
        gas: 1200000n 
      });
      const msg = this.add.text(400, 300, `✅ Юнит из слота ${slot} куплен!`, { fontSize: '28px', fill: '#00ff00' });
      setTimeout(() => { msg.destroy(); }, 2200);

      setTimeout(async () => {
        await this.loadOwnedUnits();
        await this.loadPlayerShop();
      }, 8000);
    } catch (e: any) {
      console.error('buyFromShopSlot FULL ERROR:', e);
      const errMsg = e.shortMessage || e.message || e.details || JSON.stringify(e);
      const errorText = this.add.text(400, 300, `❌ Ошибка: ${errMsg}`, { fontSize: '22px', fill: '#ff4444' });
      setTimeout(() => errorText.destroy(), 8000);
    }
  }

  private async rerollShop() {
    if (!this.isWalletReady || !this.gameContract || !this.account) return alert('Сначала подключи MetaMask');
    try {
      console.log('🚀 rerollShop: отправляем tx (0 STT)...');
      await this.gameContract.write.rerollShop([], { 
        account: this.account, 
        value: 0n,           // ← ИЗМЕНЕНО
        gas: 350000n 
      });
      const msg = this.add.text(400, 340, '✅ Shop rerolled', { fontSize: '28px', fill: '#ffff00' });
      setTimeout(() => { msg.destroy(); }, 1800);

      setTimeout(async () => {
        await this.loadPlayerShop();
      }, 5000);
    } catch (e: any) {
      console.error('rerollShop FULL ERROR:', e);
      const errMsg = e.shortMessage || e.message || e.details || JSON.stringify(e);
      const errorText = this.add.text(400, 340, `❌ Ошибка: ${errMsg}`, { fontSize: '22px', fill: '#ff4444' });
      setTimeout(() => errorText.destroy(), 4000);
    }
  }

  private async startBattle() {
    if (!this.isWalletReady || !this.gameContract || !this.account) return alert('Сначала подключи MetaMask');
    
    console.log('🚀 startBattle: team =', this.team);

    if (this.team.length < 4 || this.team.length > 8) {
      return this.add.text(500, 500, `Нужно 4-8 юнитов! Сейчас: ${this.team.length}`, { fontSize: '28px', fill: '#ff0000' });
    }

    try {
      const teamBigInt = this.team.map(id => BigInt(id));

      const ownedBefore = await this.gameContract.read.getPlayerUnits([this.account]);
      this.lastOwnedCount = ownedBefore.length;

      await this.gameContract.write.startMatch([teamBigInt], { 
        account: this.account,
        gas: 600000n 
      });
      
      this.add.text(500, 280, 'TX отправлена on-chain...', { fontSize: '24px', fill: '#ffff00' });

      this.scene.start('BattleScene');

      this.team = [];
      if (this.teamCounterText) this.teamCounterText.setText('TEAM: 0/8');

      setTimeout(async () => {
        await this.loadOwnedUnits();
        await this.loadPlayerShop();
        await this.loadCurrentAI();
        
        const ownedAfter = await this.gameContract.read.getPlayerUnits([this.account]);
        this.lastRewardsCount = ownedAfter.length - this.lastOwnedCount;
        this.lastRewardIds = ownedAfter.slice(-this.lastRewardsCount).map(id => Number(id));
        
        const rewardText = this.lastRewardsCount > 1 
          ? `Получено ${this.lastRewardsCount} юнита!` 
          : `Получено ${this.lastRewardsCount} юнит!`;
        
        if (this.rewardNotification) this.rewardNotification.destroy();
        this.rewardNotification = this.add.text(420, 310, rewardText, { fontSize: '26px', fill: '#ffff00' });

        if (this.lastRewardIds.length > 0) {
          const idText = this.add.text(420, 340, `ID: ${this.lastRewardIds.join(', ')}`, { fontSize: '18px', fill: '#aaffff' });
          setTimeout(() => { idText.destroy(); }, 4500);
        }
        
        setTimeout(async () => {
          await this.updatePlayerProfile();
        }, 800);

        setTimeout(() => {
          if (this.rewardNotification) this.rewardNotification.destroy();
        }, 4500);
      }, 9000);   // ← увеличено
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