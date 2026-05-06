// @ts-nocheck
// frontend/src/scenes/CollectionScene.ts
import * as Phaser from 'phaser';

export default class CollectionScene extends Phaser.Scene {
  private gameContract: any;
  private nftContract: any;
  private relicContract: any;
  private account: `0x${string}` | undefined;
  private publicClient: any;
  private equippedRelicIds: number[] = [];
  private lastClickTime = 0;

  private currentTab: 'units' | 'relics' = 'units';
  private unitsData: any[] = [];
  private relicsData: any[] = [];
  private selectedUnitIds: number[] = [];
  private selectedRelicIds: number[] = [];
  private unitSprites: Phaser.GameObjects.GameObject[] = [];
  private relicSprites: Phaser.GameObjects.GameObject[] = [];
  private gridContainer: Phaser.GameObjects.Container | null = null;
  private previewRect: Phaser.GameObjects.Rectangle | null = null;
  private previewTexts: Phaser.GameObjects.Text[] = [];
  private returnToScene: string = 'PrepareScene';
  private filters = {
    rarity: 'all' as 'all' | '0' | '1' | '2',
    faction: 'all' as 'all' | '0' | '1' | '2',
    unitClass: 'all' as 'all' | '0' | '1' | '2' | '3',
    status: 'all' as 'all' | 'inTeam' | 'notInTeam'
  };
  private tooltip: Phaser.GameObjects.Text | null = null;
  private unitsUnderline: Phaser.GameObjects.Rectangle | null = null;

  constructor() {
    super({ key: 'CollectionScene' });
  }

  init(data: any) {
    this.gameContract = data.gameContract;
    this.nftContract = data.nftContract;
    this.relicContract = data.relicContract;
    this.account = data.account;
    this.publicClient = data.publicClient;
    this.returnToScene = data.returnTo || 'PrepareScene';
    this.equippedRelicIds = data.equippedRelicIds || [];
  }

  create() {
    this.children.getAll().forEach(child => {
      if (child instanceof Phaser.GameObjects.GameObject) child.destroy();
    });

    this.unitSprites = [];
    this.relicSprites = [];
    this.selectedUnitIds = [];
    this.selectedRelicIds = [];
    this.previewTexts = [];
    this.tooltip = null;
// === ЗАКРЫТИЕ КОЛЛЕКЦИИ ПО КЛИКУ ВНЕ ИНТЕРФЕЙСА ===
this.add.rectangle(960, 540, 1920, 1080, 0x000000, 0) // полностью прозрачный
  .setDepth(-100)
  .setInteractive()
  .on('pointerdown', () => this.scene.stop('CollectionScene'));

    // Тёмный оверлей (в стиле PrepareScene)
this.add.rectangle(480, 540, 960, 1080, 0x0a1122)
  .setAlpha(0.96)
  .setDepth(-1)
  .setInteractive()
  .on('pointerdown', () => this.scene.stop('CollectionScene'));
// === РАМКА ПОВЕРХ ВСЕЙ СЦЕНЫ КОЛЛЕКЦИИ ===
this.add.image(480, 540, 'collection_frame')
  .setDisplaySize(960, 1080)
  .setOrigin(0.5)
  .setDepth(300);

    // Заголовок
    this.add.text(480, 45, 'COLLECTION', { 
      fontSize: '52px', 
      fill: '#ffff00', 
      fontStyle: 'bold' 
    }).setOrigin(0.5);

    this.createTabs();
    this.createFilters();
    this.createGridContainer();
    this.createPreviewPanel();
    this.createBottomPanel();

    this.loadCollectionData();
  }

private createTabs() {
  // Кнопка UNITS
  const unitsBtn = this.add.image(270, 135, 'button_base')
    .setDisplaySize(160, 55)
    .setInteractive()
    .setOrigin(1, 0.5);

  this.add.text(270, 135, 'UNITS', {
    fontSize: '28px',
    fill: '#00ffff',
    fontStyle: 'bold'
  }).setOrigin(1, 0.5);

  unitsBtn.on('pointerdown', () => this.switchTab('units'));

  // Кнопка RELICS
  const relicsBtn = this.add.image(390, 135, 'button_base')
    .setDisplaySize(160, 55)
    .setInteractive()
    .setOrigin(0, 0.5);

  this.add.text(390, 135, 'RELICS', {
    fontSize: '28px',
    fill: '#ff00ff',
    fontStyle: 'bold'
  }).setOrigin(0, 0.5);

  relicsBtn.on('pointerdown', () => this.switchTab('relics'));

  // Подчёркивание (можно оставить или убрать)
  //this.unitsUnderline = this.add.rectangle(330, 172, 280, 9, 0x00ffff).setOrigin(0.5);
}

  private switchTab(tab: 'units' | 'relics') {
    this.currentTab = tab;
    this.selectedUnitIds = [];
    this.selectedRelicIds = [];

    if (this.unitsUnderline) {
      this.unitsUnderline.setPosition(tab === 'units' ? 330 : 550, 172);
    }
    this.refreshGrid();
  }

  private createFilters() {
    this.add.text(40, 175, 'FILTERS:', { 
      fontSize: '24px', 
      fill: '#aaaaaa' 
    });

    // Rarity
    const rarityBtn = this.add.text(40, 205, `Rarity: ${this.filters.rarity}`, { 
      fontSize: '22px', fill: '#00ffff' 
    }).setInteractive().on('pointerdown', () => {
      const options: ('all' | '0' | '1' | '2')[] = ['all', '0', '1', '2'];
      const idx = options.indexOf(this.filters.rarity);
      this.filters.rarity = options[(idx + 1) % options.length];
      rarityBtn.setText(`Rarity: ${this.filters.rarity}`);
      this.refreshGrid();
    });

    // Faction
    const factionBtn = this.add.text(40, 237, `Faction: ${this.filters.faction}`, { 
      fontSize: '22px', fill: '#00ffff' 
    }).setInteractive().on('pointerdown', () => {
      const options: ('all' | '0' | '1' | '2')[] = ['all', '0', '1', '2'];
      const idx = options.indexOf(this.filters.faction);
      this.filters.faction = options[(idx + 1) % options.length];
      factionBtn.setText(`Faction: ${this.filters.faction}`);
      this.refreshGrid();
    });

    // Class (только для юнитов)
    const classBtn = this.add.text(40, 269, `Class: ${this.filters.unitClass}`, { 
      fontSize: '22px', fill: '#00ffff' 
    }).setInteractive().on('pointerdown', () => {
      const options: ('all' | '0' | '1' | '2' | '3')[] = ['all', '0', '1', '2', '3'];
      const idx = options.indexOf(this.filters.unitClass);
      this.filters.unitClass = options[(idx + 1) % options.length];
      classBtn.setText(`Class: ${this.filters.unitClass}`);
      this.refreshGrid();
    });
  }

  private createSearchAndSort() {
  // Поиск
  const searchInput = this.add.text(40, 310, '🔍 Поиск: _______________', {
    fontSize: '22px',
    fill: '#00ffff',
    backgroundColor: '#112233',
    padding: { x: 12, y: 6 }
  }).setInteractive();

  searchInput.on('pointerdown', () => {
    const term = prompt('Введите текст для поиска (имя, тип, фракция):', '');
    if (term !== null) {
      (this as any).searchTerm = term.toLowerCase();
      this.applyFiltersAndSort();
    }
  });

  // Сортировка
  const sortBtn = this.add.text(280, 310, 'Сортировка: Редкость ↓', {
    fontSize: '20px',
    fill: '#ffff00',
    backgroundColor: '#112233',
    padding: { x: 10, y: 5 }
  }).setInteractive();

  let sortModes = ['rarity-desc', 'level-desc', 'type', 'name', 'newest'];
  let sortLabels = ['Редкость ↓', 'Уровень ↓', 'Тип', 'Имя A-Z', 'Новые'];
  let currentSort = 0;

  sortBtn.on('pointerdown', () => {
    currentSort = (currentSort + 1) % sortModes.length;
    (this as any).sortMode = sortModes[currentSort];
    sortBtn.setText('Сортировка: ' + sortLabels[currentSort]);
    this.applyFiltersAndSort();
  });

  // Кнопка сброса фильтров
  this.add.text(520, 310, 'СБРОСИТЬ', {
    fontSize: '18px',
    fill: '#ff6666',
    backgroundColor: '#331111',
    padding: { x: 10, y: 4 }
  }).setInteractive().on('pointerdown', () => {
    (this as any).searchTerm = '';
    (this as any).sortMode = 'rarity-desc';
    this.filters = { rarity: 'all', faction: 'all', unitClass: 'all', status: 'all' };
    this.applyFiltersAndSort();
  });
}

  private createGridContainer() {
    this.gridContainer = this.add.container(48, 370);
    const maskGraphics = this.make.graphics();
    maskGraphics.fillRect(38, 355, 760, 640);
    const mask = maskGraphics.createGeometryMask();
    this.gridContainer.setMask(mask);
  }

  private createPreviewPanel() {
    this.previewRect = this.add.rectangle(775, 510, 260, 390, 0x112233)
      .setStrokeStyle(4, 0x00ffff);
  }

private createBottomPanel() {
  const backBtn = this.add.image(480, 1020, 'button_base')
    .setDisplaySize(420, 70)
    .setInteractive()
    .setOrigin(0.5);

  this.add.text(480, 1020, '← GO BACK', {
    fontSize: '36px',
    fill: '#ffffff',
    fontStyle: 'bold'
  }).setOrigin(0.5);

  backBtn.on('pointerdown', () => this.returnToPrepare());
}


private async loadCollectionData() {
  if (!this.account) return;

  try {
    // === ЮНИТЫ ===
    const unitIds: bigint[] = await this.gameContract.read.getPlayerUnits([this.account]);
    this.unitsData = await Promise.all(unitIds.map(async (idBig) => {
      const id = Number(idBig);
      const unit = await this.nftContract.read.getUnit([idBig]);
      return { id, unit, inTeam: false };
    }));

    // Фильтруем юниты, которые уже в команде PrepareScene
    const prepare = this.scene.get('PrepareScene') as any;
    if (prepare && prepare.team && Array.isArray(prepare.team)) {
      this.unitsData = this.unitsData.filter(u => !prepare.team.includes(u.id));
    }

    // === РЕЛИКВИИ ===
    const relicIds: bigint[] = await this.gameContract.read.getPlayerRelics([this.account]);
    this.relicsData = await Promise.all(relicIds.map(async (idBig) => {
      const id = Number(idBig);
      const relic = await this.relicContract.read.getRelic([idBig]);
      return { id, relic };
    }));

    // Убираем экипированные реликвии
    this.relicsData = this.relicsData.filter(r => !this.equippedRelicIds.includes(r.id));

    this.refreshGrid();
  } catch (e) {
    console.error('loadCollectionData error', e);
  }
}


  private getRarityTintAndScale(rarity: number) {
    if (rarity === 2) return { tint: 0xffee00, scale: 1.22 };
    if (rarity === 1) return { tint: 0x00ff77, scale: 1.10 };
    return { tint: 0x44aaff, scale: 0.96 };
  }

private refreshGrid() {
  this.unitSprites.forEach(s => s.destroy());
  this.relicSprites.forEach(s => s.destroy());
  this.unitSprites = [];
  this.relicSprites = [];

  let data = this.currentTab === 'units' ? this.unitsData : this.relicsData;

  if (this.currentTab === 'units') {
    data = data.filter((item: any) => {
      const u = item.unit;
      if (this.filters.rarity !== 'all' && String(u.rarity) !== this.filters.rarity) return false;
      if (this.filters.faction !== 'all' && String(u.faction) !== this.filters.faction) return false;
      if (this.filters.unitClass !== 'all' && String(u.unitClass) !== this.filters.unitClass) return false;
      return true;
    });
  }

  const startX = 32;
  const startY = 76;
  const spacingX = 68;
  const spacingY = 78;

  data.forEach((item, index) => {
    const col = index % 8;
    const row = Math.floor(index / 8);
    const x = startX + col * spacingX;
    const y = startY + row * spacingY;

    let sprite: Phaser.GameObjects.GameObject;

    if (this.currentTab === 'units') {
      const rarityColor = item.unit.rarity === 2 ? 0xffee00 : item.unit.rarity === 1 ? 0x00ff77 : 0x00ccff;
      const isSelected = this.selectedUnitIds.includes(item.id);
      const borderColor = isSelected ? 0x00ff00 : rarityColor;
      const strokeWidth = isSelected ? 6 : 4;

      sprite = this.add.rectangle(x, y, 52, 52, 0x112233)
        .setStrokeStyle(strokeWidth, borderColor)
        .setInteractive();

      (sprite as any).unitId = item.id;
      (sprite as any).isUnit = true;

      let clickCount = 0;
      sprite.on('pointerdown', () => {
        clickCount++;
        if (clickCount === 1) {
          this.toggleUnitSelection(item.id, sprite);
        }
        if (clickCount === 2) {
          const prepareScene = this.scene.get('PrepareScene') as any;
          if (prepareScene && typeof prepareScene.addSingleUnitToTeam === 'function') {
            const success = prepareScene.addSingleUnitToTeam(item.id);
            if (success) {
              const idx = this.selectedUnitIds.indexOf(item.id);
              if (idx > -1) this.selectedUnitIds.splice(idx, 1);
              this.showFloatingMultiSelectPanel();
            }
          }
          clickCount = 0;
        }
        setTimeout(() => { clickCount = 0; }, 500);
      });

      sprite.on('pointerover', () => this.showCollectionTooltip(this.gridContainer!.x + x + 4, this.gridContainer!.y + y - 38, item.unit));
      sprite.on('pointerout', () => this.hideTooltip());
    } else {
      const isSelected = this.selectedRelicIds.includes(item.id);
      const borderColor = isSelected ? 0x00ff00 : 0xffaa00;
      const strokeWidth = isSelected ? 6 : 4;

      sprite = this.add.rectangle(x, y, 52, 52, 0x112233)
        .setStrokeStyle(strokeWidth, borderColor)
        .setInteractive();

      (sprite as any).relicId = item.id;
      (sprite as any).isRelic = true;

      let clickCount = 0;
      sprite.on('pointerdown', () => {
        clickCount++;
        if (clickCount === 1) {
          this.toggleRelicSelection(item.id, sprite);
        }
        if (clickCount === 2) {
          const prepare = this.scene.get('PrepareScene') as any;
          if (prepare && typeof prepare.equipSingleRelic === 'function') {
            const success = prepare.equipSingleRelic(item.id);
            if (success) {
              // Чистим выбор, чтобы не появлялась панель «Выбрано»
              const idx = this.selectedRelicIds.indexOf(item.id);
              if (idx > -1) this.selectedRelicIds.splice(idx, 1);
              this.showFloatingMultiSelectPanel();

              this.relicsData = this.relicsData.filter((r: any) => r.id !== item.id);
              this.refreshGrid();
            }
          }
          clickCount = 0;
        }
                setTimeout(() => { clickCount = 0; }, 450);
      });

      sprite.on('pointerover', () => this.showCollectionTooltip(this.gridContainer!.x + x + 4, this.gridContainer!.y + y - 38, undefined, item.relic));
      sprite.on('pointerout', () => this.hideTooltip());
    }

    this.gridContainer!.add(sprite);
    if (this.currentTab === 'units') this.unitSprites.push(sprite);
    else this.relicSprites.push(sprite);
  });
}


private toggleUnitSelection(id: number, sprite: any) {
  const idx = this.selectedUnitIds.indexOf(id);
  if (idx > -1) {
    this.selectedUnitIds.splice(idx, 1);
  } else if (this.selectedUnitIds.length < 8) {
    this.selectedUnitIds.push(id);
  }
  // refreshGrid убрали, чтобы не ломать двойной клик
  this.showFloatingMultiSelectPanel();
  this.showPreview(id, true);
}


private toggleRelicSelection(id: number, sprite: any) {
  const idx = this.selectedRelicIds.indexOf(id);
  if (idx > -1) {
    this.selectedRelicIds.splice(idx, 1);
  } else if (this.selectedRelicIds.length < 3) {
    this.selectedRelicIds.push(id);
  }
  // refreshGrid убрали, чтобы не ломать двойной клик
  this.showFloatingMultiSelectPanel();
  this.showPreview(id, false);
  // Рамка обновится при следующем refreshGrid (или можно добавить ручное обновление бордера)
}


private showFloatingMultiSelectPanel() {
  // Удаляем старую панель
  this.children.getAll().forEach(child => {
    if (child instanceof Phaser.GameObjects.Text && 
        (child.text.includes('Выбрано') || child.text.includes('ДОБАВИТЬ') || child.text.includes('АКТИВИРОВАТЬ'))) {
      child.destroy();
    }
  });

  const count = this.currentTab === 'units' 
    ? this.selectedUnitIds.length 
    : this.selectedRelicIds.length;

  if (count === 0) {
    this.refreshGrid(); // принудительно чистим зелёные рамки
    return;
  }

  const isUnits = this.currentTab === 'units';
  const centerX = 480;

  this.add.text(centerX, 820, `Selected: ${count} ${isUnits ? 'units' : 'relics'}`, {
    fontSize: '34px', 
    fill: '#00ff88', 
    backgroundColor: '#112233', 
    padding: { x: 28, y: 10 }
  }).setOrigin(0.5);

  const btnText = isUnits ? 'ADD TO the TEAM' : 'ACTIVATE';
  const btnColor = isUnits ? '#ffff00' : '#00ffff';

  const btn = this.add.text(centerX, 900, btnText, { 
    fontSize: '40px', 
    fill: btnColor, 
    backgroundColor: '#223311', 
    padding: { x: 42, y: 16 }
  })
    .setOrigin(0.5)
    .setInteractive()
    .on('pointerdown', () => {
      if (isUnits) {
        this.addSelectedToTeam();
      } else {
        this.activateSelectedRelics();
      }
    });
}


private activateSelectedRelics() {
  if (this.selectedRelicIds.length === 0) return;

  const prepareScene = this.scene.get('PrepareScene') as any;
  if (prepareScene && typeof prepareScene.addMultipleRelicsToEquipped === 'function') {
    prepareScene.addMultipleRelicsToEquipped([...this.selectedRelicIds]);
  }

  // Удаляем активированные из коллекции
  this.relicsData = this.relicsData.filter(r => !this.selectedRelicIds.includes(r.id));
  this.selectedRelicIds = [];

  this.refreshGrid();
  // НЕ закрываем сцену!
}


private addSelectedToTeam() {
  if (this.selectedUnitIds.length === 0) return;

  const prepareScene = this.scene.get('PrepareScene') as any;
  if (prepareScene && typeof prepareScene.addMultipleUnitsToTeam === 'function') {
    prepareScene.addMultipleUnitsToTeam([...this.selectedUnitIds]);
  }

  // Очищаем выбор и обновляем коллекцию
  this.selectedUnitIds = [];
  this.showFloatingMultiSelectPanel();
this.refreshGrid();
setTimeout(() => this.refreshGrid(), 150); // перестраховка

  // Закрываем коллекцию (опционально, можно убрать)
  // this.scene.stop('CollectionScene');
}

  private showPreview(id: number, isUnit: boolean) {
    if (this.previewRect) this.previewRect.setFillStyle(0x112233);
    this.previewTexts.forEach(t => t.destroy());
    this.previewTexts = [];

    const wrapWidth = 230;

    if (isUnit) {
      const unitData = this.unitsData.find(u => u.id === id);
      if (!unitData) return;
      const unit = unitData.unit;

      this.previewTexts.push(
        this.add.text(775, 355, `ID: ${id}`, { 
          fontSize: '26px', fill: '#ffff00', wordWrap: { width: wrapWidth }
        }).setOrigin(0.5)
      );

      this.previewTexts.push(
        this.add.text(775, 405, `${this.getFactionName(unit.faction)} ${this.getClassName(unit.unitClass)}`, { 
          fontSize: '29px', fill: '#00ffff', wordWrap: { width: wrapWidth }, align: 'center'
        }).setOrigin(0.5)
      );

      this.previewTexts.push(
        this.add.text(775, 465, `ATK ${unit.attack}  DEF ${unit.defense}  SPD ${unit.speed}`, { 
          fontSize: '26px', fill: '#ffaa00', wordWrap: { width: wrapWidth }
        }).setOrigin(0.5)
      );
    } else {
      const relicData = this.relicsData.find(r => r.id === id)?.relic;
      if (relicData) {
        this.previewTexts.push(
          this.add.text(775, 395, relicData.name, { 
            fontSize: '29px', fill: '#ff00ff', wordWrap: { width: wrapWidth }, align: 'center'
          }).setOrigin(0.5)
        );

        this.previewTexts.push(
          this.add.text(775, 460, `+${relicData.value} ${this.getRelicEffectDescription(relicData.relicType)}`, { 
            fontSize: '25px', fill: '#ffff88', wordWrap: { width: wrapWidth }, align: 'center'
          }).setOrigin(0.5)
        );
      }
    }
  }


private addSingleUnitToTeam(unitId: number) {
  const prepareScene = this.scene.get('PrepareScene') as any;
  if (prepareScene && typeof prepareScene.addSingleUnitToTeam === 'function') {
    prepareScene.addSingleUnitToTeam(unitId);
  }

  // Удаляем юнит из списка выбранных (если он там был)
  const idx = this.selectedUnitIds.indexOf(unitId);
  if (idx > -1) {
    this.selectedUnitIds.splice(idx, 1);
  }

  // Обновляем (или убираем) плавающую панель "Выбрано"
  this.showFloatingMultiSelectPanel();

  // Обновляем грид (юнит исчезнет)
  this.refreshGrid();
}

private equipSingleRelic(relicId: number) {
  const prepareScene = this.scene.get('PrepareScene') as any;
  if (prepareScene && typeof prepareScene.equipSingleRelic === 'function') {
    prepareScene.equipSingleRelic(relicId);
  }

  // Удаляем реликвию из списка выбранных
  const idx = this.selectedRelicIds.indexOf(relicId);
  if (idx > -1) {
    this.selectedRelicIds.splice(idx, 1);
  }

  this.showFloatingMultiSelectPanel();
  this.refreshGrid();
}

  private showCollectionTooltip(x: number, y: number, unit?: any, relic?: any) {
    if (!this.tooltip) {
      this.tooltip = this.add.text(0, 0, '', {
        fontSize: '24px', fill: '#ffffff', backgroundColor: '#112233',
        padding: { x: 18, y: 12 }, align: 'left'
      }).setOrigin(0.5, 1).setDepth(100);
    }

    let text = '';
    if (unit) {
      text = `${this.getFactionName(unit.faction)} ${this.getRarityName(unit.rarity)} ${this.getClassName(unit.unitClass)}\nATK ${unit.attack} DEF ${unit.defense} SPD ${unit.speed}`;
    } else if (relic) {
      text = `${relic.name}\n+${relic.value} ${this.getRelicEffectDescription(relic.relicType)}`;
    }

    this.tooltip.setText(text);
    this.tooltip.setPosition(x, y - 22);
    this.tooltip.setVisible(true);
  }

  private hideTooltip() {
    if (this.tooltip) this.tooltip.setVisible(false);
  }

  private returnToPrepare() {
    this.scene.stop('CollectionScene');
  }

  private getFactionName(faction: number): string {
    const names = ['Empire', 'Voidborn', 'Mechanoids'];
    return names[faction] || 'Unknown';
  }

  private getClassName(unitClass: number): string {
    const names = ['Fighter', 'Cruiser', 'Dreadnought', 'Drone Swarm'];
    return names[unitClass] || 'Unknown';
  }

  private getRarityName(rarity: number): string {
    const names = ['Common', 'Rare', 'Legendary'];
    return names[rarity] || 'Unknown';
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
    return desc[relicType] || 'Эффект неизвестен';
  }

  shutdown() {
    this.unitSprites.forEach(s => s.destroy());
    this.relicSprites.forEach(s => s.destroy());
    if (this.tooltip) this.tooltip.destroy();
  }
}