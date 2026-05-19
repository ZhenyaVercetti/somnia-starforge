// @ts-nocheck
// frontend/src/scenes/CollectionScene.ts
import * as Phaser from 'phaser';
import { UnitVisualFactory } from '../utils/UnitVisualFactory';


export default class CollectionScene extends Phaser.Scene {
  private gameContract: any;
  private nftContract: any;
  private relicContract: any;
  private account: `0x${string}` | undefined;
  private publicClient: any;
  private equippedRelicIds: number[] = [];
  private lastClickTime = 0;
  private previewShip: Phaser.GameObjects.Sprite | null = null;

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

  private getShipKey(faction: number, unitClass: number): string {
  const map: Record<string, string> = {
    '0_0': 'emperial_fighter',
    '0_1': 'emperial_cruiser',
    '0_2': 'emperial_dreadnought',
    '0_3': 'emperial_droneswarm',
    '1_0': 'voidborn_fighter',
    '1_1': 'voidborn_cruiser',
    '1_2': 'voidborn_dreadnought',
    '1_3': 'voidborn_droneswarm',
    '2_0': 'mechanoid_fighter',
    '2_1': 'mechanoid_cruiser',
    '2_2': 'mechanoid_dreadnought',
    '2_3': 'mechanoid_droneswarm',
  };
  return map[`${faction}_${unitClass}`] || 'emperial_fighter';
}

init(data: any) {
  if (data.walletManager) {
    this.walletManager = data.walletManager;
    this.gameContract = data.gameContract || this.walletManager.gameContract;
    this.nftContract = data.nftContract || this.walletManager.nftContract;
    this.relicContract = data.relicContract || this.walletManager.relicContract;
    this.account = data.account || this.walletManager.account;
    this.publicClient = data.publicClient || this.walletManager.getPublicClient();
    this.returnToScene = data.returnTo || 'PrepareScene';
    this.equippedRelicIds = data.equippedRelicIds || [];
  } else {
    this.gameContract = data.gameContract;
    this.nftContract = data.nftContract;
    this.relicContract = data.relicContract;
    this.account = data.account;
    this.publicClient = data.publicClient;
    this.returnToScene = data.returnTo || 'PrepareScene';
    this.equippedRelicIds = data.equippedRelicIds || [];
  }
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

  // === ТЁМНЫЙ ФОН 960×1080 (безопасная зона — клик ничего не делает) ===
  this.darkOverlay = this.add.rectangle(480, 540, 960, 1080, 0x0a1122)
    .setAlpha(0.96)
    .setDepth(-1)
    .setInteractive()
    .on('pointerdown', (pointer) => {
      pointer.event.stopPropagation(); // блокируем прокликивание, но не закрываем сцену
    });

  // Рамка коллекции
  this.add.image(480, 540, 'collection_frame')
    .setDisplaySize(960, 1080)
    .setOrigin(0.5)
    .setDepth(5);

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
  // Принудительная перезагрузка при возврате из боя
setTimeout(() => {
  if (this.scene.get('PrepareScene')) {
    this.loadCollectionData();
  }
}, 300);


  // === ЗАКРЫТИЕ ТОЛЬКО ЗА ПРЕДЕЛАМИ ТЁМНОГО ФОНА (960×1080) ===
  this.input.on('pointerdown', (pointer) => {
    const isInsideDark = pointer.x >= 0 && pointer.x <= 960 && pointer.y >= 0 && pointer.y <= 1080;
    if (!isInsideDark) {
      this.scene.stop('CollectionScene');
    }
  });
}


private createTabs() {
  // UNITS
  const unitsBtn = this.add.image(380, 135, 'button_base')
    .setDisplaySize(160, 55)
    .setInteractive()
    .setOrigin(0.5);

  const unitsText = this.add.text(380, 135, 'UNITS', {
    fontSize: '28px',
    fill: '#00ffff',
    fontStyle: 'bold'
  }).setOrigin(0.5);

  (unitsBtn as any).linkedText = unitsText;
  (unitsText as any).originalFill = '#00ffff';

  this.addButtonEffects(unitsBtn);
  unitsBtn.on('pointerdown', () => this.switchTab('units'));

  // RELICS
  const relicsBtn = this.add.image(580, 135, 'button_base')
    .setDisplaySize(160, 55)
    .setInteractive()
    .setOrigin(0.5);

  const relicsText = this.add.text(580, 135, 'RELICS', {
    fontSize: '28px',
    fill: '#ff00ff',
    fontStyle: 'bold'
  }).setOrigin(0.5);

  (relicsBtn as any).linkedText = relicsText;
  (relicsText as any).originalFill = '#ff00ff';

  this.addButtonEffects(relicsBtn);
  relicsBtn.on('pointerdown', () => this.switchTab('relics'));
}


private switchTab(tab: 'units' | 'relics') {
  this.currentTab = tab;
  this.selectedUnitIds = [];
  this.selectedRelicIds = [];

  if (this.unitsUnderline) {
    this.unitsUnderline.setPosition(tab === 'units' ? 380 : 580, 172);
  }

  this.showFloatingMultiSelectPanel(); // очищаем панель при переключении
  this.refreshGrid();
}

private createFilters() {
  this.add.text(50, 190, 'FILTERS:', { 
    fontSize: '24px', 
    fill: '#aaaaaa' 
  });

  // Rarity
  const rarityBtn = this.add.text(50, 220, `Rarity: ${this.getRarityName(Number(this.filters.rarity))}`, { 
    fontSize: '22px', fill: '#00ffff' 
  }).setInteractive().on('pointerdown', () => {
    const options: ('all' | '0' | '1' | '2')[] = ['all', '0', '1', '2'];
    const idx = options.indexOf(this.filters.rarity);
    this.filters.rarity = options[(idx + 1) % options.length];
    rarityBtn.setText(`Rarity: ${this.getRarityName(Number(this.filters.rarity))}`);
    this.refreshGrid();
  });

  // Faction
  const factionBtn = this.add.text(50, 252, `Faction: ${this.getFactionName(Number(this.filters.faction))}`, { 
    fontSize: '22px', fill: '#00ffff' 
  }).setInteractive().on('pointerdown', () => {
    const options: ('all' | '0' | '1' | '2')[] = ['all', '0', '1', '2'];
    const idx = options.indexOf(this.filters.faction);
    this.filters.faction = options[(idx + 1) % options.length];
    factionBtn.setText(`Faction: ${this.getFactionName(Number(this.filters.faction))}`);
    this.refreshGrid();
  });

  // Class
  const classBtn = this.add.text(50, 284, `Class: ${this.getClassName(Number(this.filters.unitClass))}`, { 
    fontSize: '22px', fill: '#00ffff' 
  }).setInteractive().on('pointerdown', () => {
    const options: ('all' | '0' | '1' | '2' | '3')[] = ['all', '0', '1', '2', '3'];
    const idx = options.indexOf(this.filters.unitClass);
    this.filters.unitClass = options[(idx + 1) % options.length];
    classBtn.setText(`Class: ${this.getClassName(Number(this.filters.unitClass))}`);
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
  // Карточка превью (серый фон)
  this.previewRect = this.add.rectangle(775, 510, 260, 390, 0x112233)
    .setDepth(4);

  // Рамка (поверх карточки и текста)
  this.add.image(775, 510, 'preview_frame')
    .setDisplaySize(260, 390)
    .setOrigin(0.5)
    .setDepth(100);
}


private createBottomPanel() {
  const backBtn = this.add.image(480, 1020, 'button_base')
    .setDisplaySize(360, 70)
    .setInteractive()
    .setOrigin(0.5);

  const backText = this.add.text(480, 1020, '← GO BACK', {
    fontSize: '36px',
    fill: '#ffffff',
    fontStyle: 'bold'
  }).setOrigin(0.5);

  (backBtn as any).linkedText = backText;
  (backText as any).originalFill = '#ffffff';

  this.addButtonEffects(backBtn);
  backBtn.on('pointerdown', () => this.returnToPrepare());
}



private async loadCollectionData() {
  if (!this.account || !this.gameContract || !this.nftContract) {
    console.error('CollectionScene: не хватает контрактов');
    return;
  }

  try {
    const unitIds: bigint[] = await this.gameContract.read.getPlayerUnits([this.account]);
    console.log('📦 Юнитов в контракте:', unitIds.length);

    this.unitsData = await Promise.all(
      unitIds.map(async (idBig) => {
        const id = Number(idBig);
        const unit = await this.nftContract.read.getUnit([idBig]);
        return { id, unit, inTeam: false };
      })
    );

    // Временно убираем фильтр по команде (для отладки)
    // const prepare = this.scene.get('PrepareScene') as any;
    // if (prepare && prepare.team) {
    //   this.unitsData = this.unitsData.filter(u => !prepare.team.includes(u.id));
    // }

    console.log('✅ Юнитов загружено:', this.unitsData.length);

    const relicIds: bigint[] = await this.gameContract.read.getPlayerRelics([this.account]);
    this.relicsData = await Promise.all(
      relicIds.map(async (idBig) => {
        const id = Number(idBig);
        const relic = await this.relicContract.read.getRelic([idBig]);
        return { id, relic };
      })
    );

    this.relicsData = this.relicsData.filter(r => !this.equippedRelicIds.includes(r.id));

    this.refreshGrid();

  } catch (e) {
    console.error('loadCollectionData error:', e);
  }
}


  private getRarityTintAndScale(rarity: number) {
    if (rarity === 2) return { tint: 0xffee00, scale: 1.22 };
    if (rarity === 1) return { tint: 0x00ff77, scale: 1.10 };
    return { tint: 0x44aaff, scale: 0.96 };
  }

private refreshGrid() {
  // === ПОЛНАЯ ОЧИСТКА ГРИДА (решает проблему наложения) ===
  if (this.gridContainer) {
    this.gridContainer.removeAll(true); // true = уничтожить все дочерние объекты
  }
  this.unitSprites = [];
  this.relicSprites = [];

  let data = this.currentTab === 'units' ? this.unitsData : this.relicsData;

  // Фильтрация только для юнитов
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
  const itemsPerRow = 7;
  const spacingX = this.currentTab === 'units' ? 68 : 85;
  const spacingY = this.currentTab === 'units' ? 78 : 95;

  data.forEach((item, index) => {
    const col = index % itemsPerRow;
    const row = Math.floor(index / itemsPerRow);
    const x = startX + col * spacingX;
    const y = startY + row * spacingY;

    if (this.currentTab === 'units') {
      // === ЮНИТЫ ===
      const shipKey = this.getShipKey(item.unit.faction, item.unit.unitClass);
      const container = UnitVisualFactory.createUnitWithFrame(this, x, y, shipKey, item.unit.rarity, 0.20);
      this.gridContainer!.add(container);

      const ship = container.last as Phaser.GameObjects.Sprite;
      (ship as any).unitId = item.id;
      (ship as any).isUnit = true;
      ship.setInteractive().setDepth(8);

      let clickCount = 0;
      ship.on('pointerdown', () => {
        clickCount++;
        if (clickCount === 1) {
          this.toggleUnitSelection(item.id, ship);
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

      ship.on('pointerover', () => this.showCollectionTooltip(this.gridContainer!.x + x + 4, this.gridContainer!.y + y - 38, item.unit));
      ship.on('pointerout', () => this.hideTooltip());

      this.unitSprites.push(container);
    } else {
      // === РЕЛИКВИИ (теперь тоже в контейнере — без наложений) ===
      const isSelected = this.selectedRelicIds.includes(item.id);
      const borderColor = isSelected ? 0x00ff00 : 0xffaa00;
      const strokeWidth = isSelected ? 6 : 4;

      const relicMap: Record<number, string> = {
        0: 'quantum_strike',
        1: 'void_shield',
        2: 'nebula_dash',
        3: 'echo_core',
        4: 'flux_overload',
        5: 'last_stand'
      };
      const relicKey = relicMap[item.relic.relicType] || 'quantum_strike';

      // Контейнер реликвии (решает проблему наложения)
      const relicContainer = this.add.container(x, y);

      const bg = this.add.rectangle(0, 0, 52, 52, 0x112233)
        .setStrokeStyle(strokeWidth, borderColor)
        .setInteractive();

      const relicSprite = this.add.sprite(0, 0, relicKey)
        .setScale(0.65);

      relicContainer.add([bg, relicSprite]);
      this.gridContainer!.add(relicContainer);

      (bg as any).relicId = item.id;
      (bg as any).isRelic = true;
      (relicContainer as any).relicId = item.id;

      let clickCount = 0;
      bg.on('pointerdown', () => {
        clickCount++;
        if (clickCount === 1) {
          this.toggleRelicSelection(item.id, relicContainer);
        }
        if (clickCount === 2) {
          const prepare = this.scene.get('PrepareScene') as any;
          if (prepare && typeof prepare.equipSingleRelic === 'function') {
            const success = prepare.equipSingleRelic(item.id);
            if (success) {
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

      bg.on('pointerover', () => this.showCollectionTooltip(this.gridContainer!.x + x + 4, this.gridContainer!.y + y - 38, undefined, item.relic));
      bg.on('pointerout', () => this.hideTooltip());

      this.relicSprites.push(relicContainer);
    }
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
  
  this.showFloatingMultiSelectPanel();
  this.showPreview(id, false);
  
}


private showFloatingMultiSelectPanel() {
  // Удаляем предыдущую панель
  if (this.floatingPanel) {
    this.floatingPanel.destroy();
    this.floatingPanel = null;
  }

  const count = this.currentTab === 'units' 
    ? this.selectedUnitIds.length 
    : this.selectedRelicIds.length;

  if (count === 0) {
    this.refreshGrid();
    return;
  }

  const isUnits = this.currentTab === 'units';
  const centerX = 480;

  // Контейнер панели
  this.floatingPanel = this.add.container(0, 0);

  // Кнопка "Selected: X units/relics" (визуальная, не интерактивная)
  const selectedBtn = this.add.image(centerX, 820, 'button_base')
    .setDisplaySize(320, 50)
    .setOrigin(0.5);
  this.floatingPanel.add(selectedBtn);

  const selectedText = this.add.text(centerX, 820, `Selected: ${count} ${isUnits ? 'units' : 'relics'}`, {
    fontSize: '28px',
    fill: '#00ff88',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  this.floatingPanel.add(selectedText);

  // Action кнопка (ADD TO TEAM / ACTIVATE)
  const actionBtn = this.add.image(centerX, 900, 'button_base')
    .setDisplaySize(320, 60)
    .setInteractive()
    .setOrigin(0.5);
  this.floatingPanel.add(actionBtn);

  const actionText = this.add.text(centerX, 900, isUnits ? 'ADD TO TEAM' : 'ACTIVATE', {
    fontSize: '32px',
    fill: isUnits ? '#ffff00' : '#00ffff',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  this.floatingPanel.add(actionText);

  (actionBtn as any).linkedText = actionText;
  (actionText as any).originalFill = isUnits ? '#ffff00' : '#00ffff';

  this.addButtonEffects(actionBtn);

  actionBtn.on('pointerdown', () => {
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
  if (!prepareScene || typeof prepareScene.addMultipleRelicsToEquipped !== 'function') return;

  // Заменяем справа налево
  prepareScene.addMultipleRelicsToEquipped([...this.selectedRelicIds]);

  // Убираем из коллекции
  this.relicsData = this.relicsData.filter(r => !this.selectedRelicIds.includes(r.id));
  this.selectedRelicIds = [];

  this.showFloatingMultiSelectPanel();
  this.refreshGrid();
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
  // === БЕЗОПАСНЫЙ УНИЧТОЖЕНИЕ ПРЕДЫДУЩЕГО ПРЕВЬЮ ===
  if (this.previewShip) {
    const prev = this.previewShip as any;
    if (prev && typeof prev.destroy === 'function') {
      prev.destroy(true);
    }
    this.previewShip = null;
  }

  if (this.previewTexts && this.previewTexts.length > 0) {
    this.previewTexts.forEach(t => {
      if (t && typeof t.destroy === 'function') t.destroy(true);
    });
    this.previewTexts = [];
  }

  if (this.previewRect) {
    this.previewRect.setVisible(true);
    this.previewRect.setFillStyle(0x112233);
  }

  const wrapWidth = 230;

  if (isUnit) {
    const unitData = this.unitsData.find(u => u.id === id);
    if (!unitData) return;
    const unit = unitData.unit;

    const shipKey = this.getShipKey(unit.faction, unit.unitClass);

// === ФАБРИКА С РАМКОЙ ===
const container = UnitVisualFactory.createUnitWithFrame(
  this, 
  775, 440,           // новые координаты
  shipKey, 
  unit.rarity, 
  0.72,               // масштаб РАМКИ
  0.65                // масштаб КОРАБЛЯ (меньше рамки!)
);

container.setDepth(15);
this.children.bringToTop(container);

this.previewShip = container as any;

const ship = container.getAt(container.length - 1) as Phaser.GameObjects.Sprite;
ship.setDepth(16);

// Лёгкая пульсация (теперь только корабль)
this.tweens.add({
  targets: ship,
  scale: ship.scale * 1.04,   // лёгкая пульсация относительно текущего размера
  duration: 1800,
  yoyo: true,
  repeat: -1,
  ease: 'Sine.easeInOut'
});

    const t1 = this.add.text(775, 585, `${this.getFactionName(unit.faction)} ${this.getClassName(unit.unitClass)}`, {
      fontSize: '29px', fill: '#00ffff', wordWrap: { width: wrapWidth }, align: 'center'
    }).setOrigin(0.5).setDepth(20);
    this.previewTexts.push(t1);

    const t2 = this.add.text(775, 635, `ATK ${unit.attack}  DEF ${unit.defense}  SPD ${unit.speed}`, {
      fontSize: '26px', fill: '#ffaa00', wordWrap: { width: wrapWidth }
    }).setOrigin(0.5).setDepth(20);
    this.previewTexts.push(t2);

} else {
console.log('🟢 showPreview для реликвии, id:', id);
  const relicData = this.relicsData.find(r => r.id === id)?.relic;
  console.log('relicData:', relicData);
  
  if (!relicData) {
    console.error('❌ relicData не найден!');
    return;
    }
  const relicMap: Record<number, string> = {
    0: 'quantum_strike',
    1: 'void_shield',
    2: 'nebula_dash',
    3: 'echo_core',
    4: 'flux_overload',
    5: 'last_stand'
  };

  const relicKey = relicMap[relicData.relicType] || 'quantum_strike';

  const relicSprite = this.add.sprite(775, 420, relicKey)
    .setScale(1.15)
    .setDepth(16);

  this.previewShip = relicSprite as any;

  const t1 = this.add.text(775, 565, relicData.name.replace(/\s*\+\d+/, ''), {
    fontSize: '29px', fill: '#ff00ff', wordWrap: { width: 230 }, align: 'center'
  }).setOrigin(0.5).setDepth(20);
  this.previewTexts.push(t1);

  const t2 = this.add.text(775, 635, `+${relicData.value} ${this.getRelicEffectDescription(relicData.relicType)}`, {
    fontSize: '25px', fill: '#ffff88', wordWrap: { width: 230 }, align: 'center'
  }).setOrigin(0.5).setDepth(20);
  this.previewTexts.push(t2);
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
  if (!prepareScene || typeof prepareScene.equipSingleRelic !== 'function') return;

  // Заменяем справа налево
  const success = prepareScene.equipSingleRelic(relicId);
  if (success) {
    // Убираем из коллекции
    this.relicsData = this.relicsData.filter(r => r.id !== relicId);
    this.selectedRelicIds = this.selectedRelicIds.filter(id => id !== relicId);
    this.showFloatingMultiSelectPanel();
    this.refreshGrid();
  }
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
text = `${relic.name.replace(/\s*\+\d+/, '')}\n+${relic.value} ${this.getRelicEffectDescription(relic.relicType)}`;
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
  if (isNaN(faction) || faction < 0 || faction > 2) return 'Any';
  const names = ['Empire', 'Voidborn', 'Mechanoids'];
  return names[faction] || 'Any';
}

private getClassName(unitClass: number): string {
  if (isNaN(unitClass) || unitClass < 0 || unitClass > 3) return 'Any';
  const names = ['Fighter', 'Cruiser', 'Dreadnought', 'Drone Swarm'];
  return names[unitClass] || 'Any';
}

private getRarityName(rarity: number): string {
  if (isNaN(rarity) || rarity < 0 || rarity > 2) return 'Any';
  const names = ['Common', 'Rare', 'Legendary'];
  return names[rarity] || 'Any';
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


shutdown() {
    this.unitSprites.forEach(s => s.destroy());
    this.relicSprites.forEach(s => s.destroy());
    if (this.tooltip) this.tooltip.destroy();
  }
}