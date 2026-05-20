// @ts-nocheck
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
  private previewShip: Phaser.GameObjects.GameObject | null = null;
  private contentContainer: Phaser.GameObjects.Container | null = null;

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
  private floatingPanel: Phaser.GameObjects.Container | null = null;
  private returnToScene: string = 'PrepareScene';
  private filters = {
    rarity: 'all' as 'all' | '0' | '1' | '2',
    faction: 'all' as 'all' | '0' | '1' | '2',
    unitClass: 'all' as 'all' | '0' | '1' | '2' | '3',
    status: 'all' as 'all' | 'inTeam' | 'notInTeam'
  };
  private tooltip: Phaser.GameObjects.Text | null = null;
  private unitsUnderline: Phaser.GameObjects.Rectangle | null = null;
  private darkOverlay: Phaser.GameObjects.Rectangle | null = null;

  private readonly GRID_START_X = 32;
  private readonly GRID_START_Y = 76;
  private readonly ITEMS_PER_ROW = 7;
  private readonly UNIT_SPACING_X = 68;
  private readonly UNIT_SPACING_Y = 78;
  private readonly RELIC_SPACING_X = 85;
  private readonly RELIC_SPACING_Y = 95;
  private readonly PREVIEW_X = 775;
  private readonly PREVIEW_Y = 440;

  constructor() {
    super({ key: 'CollectionScene' });
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
    this.floatingPanel = null;
    this.previewShip = null;

    this.darkOverlay = this.add.rectangle(480, 540, 960, 1080, 0x0a1122)
      .setAlpha(0.96)
      .setDepth(-1)
      .setInteractive()
      .on('pointerdown', (pointer) => {
        pointer.event.stopPropagation();
      });

    this.add.image(480, 540, 'collection_frame')
      .setDisplaySize(960, 1080)
      .setOrigin(0.5)
      .setDepth(5);

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

    setTimeout(() => {
      if (this.scene.get('PrepareScene')) {
        this.loadCollectionData();
      }
    }, 300);

    this.input.on('pointerdown', (pointer) => {
      const isInsideDark = pointer.x >= 0 && pointer.x <= 960 && pointer.y >= 0 && pointer.y <= 1080;
      if (!isInsideDark) {
        this.scene.stop('CollectionScene');
      }
    });
  }

  
  private createTabs() {
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

    this.unitsUnderline = this.add.rectangle(380, 172, 140, 4, 0x00ffff)
      .setOrigin(0.5)
      .setDepth(10);
  }

  private switchTab(tab: 'units' | 'relics') {
    this.currentTab = tab;
    this.selectedUnitIds = [];
    this.selectedRelicIds = [];

    if (this.unitsUnderline) {
      this.unitsUnderline.setPosition(tab === 'units' ? 380 : 580, 172);
      this.unitsUnderline.setFillStyle(tab === 'units' ? 0x00ffff : 0xff00ff);
    }

    this.clearFloatingPanel();
    this.clearGrid();
    this.refreshGrid();
  }

  private createFilters() {
    this.add.text(50, 190, 'FILTERS:', {
      fontSize: '24px',
      fill: '#aaaaaa'
    });

    const rarityBtn = this.add.text(50, 220, `Rarity: ${this.getRarityName(Number(this.filters.rarity))}`, {
      fontSize: '22px',
      fill: '#00ffff'
    }).setInteractive().on('pointerdown', () => {
      const options: ('all' | '0' | '1' | '2')[] = ['all', '0', '1', '2'];
      const idx = options.indexOf(this.filters.rarity);
      this.filters.rarity = options[(idx + 1) % options.length];
      rarityBtn.setText(`Rarity: ${this.getRarityName(Number(this.filters.rarity))}`);
      this.refreshGrid();
    });

    const factionBtn = this.add.text(50, 252, `Faction: ${this.getFactionName(Number(this.filters.faction))}`, {
      fontSize: '22px',
      fill: '#00ffff'
    }).setInteractive().on('pointerdown', () => {
      const options: ('all' | '0' | '1' | '2')[] = ['all', '0', '1', '2'];
      const idx = options.indexOf(this.filters.faction);
      this.filters.faction = options[(idx + 1) % options.length];
      factionBtn.setText(`Faction: ${this.getFactionName(Number(this.filters.faction))}`);
      this.refreshGrid();
    });

    const classBtn = this.add.text(50, 284, `Class: ${this.getClassName(Number(this.filters.unitClass))}`, {
      fontSize: '22px',
      fill: '#00ffff'
    }).setInteractive().on('pointerdown', () => {
      const options: ('all' | '0' | '1' | '2' | '3')[] = ['all', '0', '1', '2', '3'];
      const idx = options.indexOf(this.filters.unitClass);
      this.filters.unitClass = options[(idx + 1) % options.length];
      classBtn.setText(`Class: ${this.getClassName(Number(this.filters.unitClass))}`);
      this.refreshGrid();
    });
  }

  private createGridContainer() {
    this.gridContainer = this.add.container(48, 325);

    this.contentContainer = this.add.container(0, 0);
    this.gridContainer.add(this.contentContainer);

    // Mask expanded upward to prevent clipping of large frames
    const maskGraphics = this.make.graphics();
    maskGraphics.fillRect(38, 290, 760, 660);
    const mask = maskGraphics.createGeometryMask();
    this.gridContainer.setMask(mask);
  }

  private createPreviewPanel() {
    this.previewRect = this.add.rectangle(775, 510, 260, 390, 0x112233)
      .setDepth(4);

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
    console.error('CollectionScene: missing contracts');
    return;
  }

  try {
    const unitIds: bigint[] = await this.gameContract.read.getPlayerUnits([this.account]);
    this.unitsData = await Promise.all(
      unitIds.map(async (idBig) => {
        const id = Number(idBig);
        try {
          const unit = await this.nftContract.read.getUnit([idBig]);
          if (!unit) return null;
          return { id, unit, inTeam: false };
        } catch {
          return null;
        }
      })
    );
    this.unitsData = this.unitsData.filter(Boolean);

    const relicIds: bigint[] = await this.gameContract.read.getPlayerRelics([this.account]);
    this.relicsData = await Promise.all(
      relicIds.map(async (idBig) => {
        const id = Number(idBig);
        try {
          const relic = await this.relicContract.read.getRelic([idBig]);
          if (!relic) return null;
          return { id, relic };
        } catch {
          return null;
        }
      })
    );
    this.relicsData = this.relicsData.filter(Boolean);
    this.relicsData = this.relicsData.filter(r => !this.equippedRelicIds.includes(r.id));

    this.refreshGrid();

  } catch (e) {
    console.error('loadCollectionData error:', e);
  }
}

  private clearGrid() {
    if (this.contentContainer) {
      this.contentContainer.removeAll(true);
    }
    this.unitSprites = [];
    this.relicSprites = [];
  }

  private clearFloatingPanel() {
    if (this.floatingPanel) {
      this.floatingPanel.destroy();
      this.floatingPanel = null;
    }
  }

  private refreshGrid() {
  this.clearGrid();

  let data = this.currentTab === 'units' ? this.unitsData : this.relicsData;
  if (!data || data.length === 0) return;

  if (this.currentTab === 'units') {
    data = data.filter((item: any) => {
      if (!item || !item.unit) return false;
      const u = item.unit;
      if (this.filters.rarity !== 'all' && String(u.rarity) !== this.filters.rarity) return false;
      if (this.filters.faction !== 'all' && String(u.faction) !== this.filters.faction) return false;
      if (this.filters.unitClass !== 'all' && String(u.unitClass) !== this.filters.unitClass) return false;
      return true;
    });
  }


    const spacingX = this.RELIC_SPACING_X;
    const spacingY = this.RELIC_SPACING_Y;
    const startY = 32;

    data.forEach((item, index) => {
      const col = index % this.ITEMS_PER_ROW;
      const row = Math.floor(index / this.ITEMS_PER_ROW);
      const x = this.GRID_START_X + col * spacingX;
      const y = startY + row * spacingY;

      if (this.currentTab === 'units') {
        const card = this.createUnitCard(x, y, item);
        this.contentContainer!.add(card);
        this.unitSprites.push(card);
      } else {
        const card = this.createRelicCard(x, y, item);
        this.contentContainer!.add(card);
        this.relicSprites.push(card);
      }
    });

    if ((this.currentTab === 'relics' || this.currentTab === 'units') && data.length > this.ITEMS_PER_ROW * 5) {
      const totalRows = Math.ceil(data.length / this.ITEMS_PER_ROW);
      const totalHeight = totalRows * spacingY;
      const visibleHeight = 5 * spacingY + 60;
      const maxScroll = Math.max(0, totalHeight - visibleHeight);

      const maskGraphics = this.make.graphics();
      maskGraphics.fillRect(38, 290, 760, visibleHeight);
      const mask = maskGraphics.createGeometryMask();
      this.gridContainer!.setMask(mask);

      this.contentContainer!.y = 0;
      this.contentContainer!.setInteractive();

      let dragStartY = 0;
      let contentStartY = 0;

      this.contentContainer!.off('pointerdown');
      this.contentContainer!.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        dragStartY = pointer.y;
        contentStartY = this.contentContainer!.y;
      });

      this.input.off('pointermove');
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (pointer.isDown) {
          const delta = pointer.y - dragStartY;
          let newY = contentStartY + delta;
          newY = Phaser.Math.Clamp(newY, -maxScroll, 0);
          this.contentContainer!.y = newY;
        }
      });

      this.input.off('wheel');
      this.input.on('wheel', (_pointer: any, _gameObjects: any, _deltaX: number, deltaY: number) => {
        let newY = this.contentContainer!.y - deltaY * 0.7;
        newY = Phaser.Math.Clamp(newY, -maxScroll, 0);
        this.contentContainer!.y = newY;
      });
    } else {
      if (this.contentContainer) this.contentContainer.y = 0;
      if (this.contentContainer) this.contentContainer.disableInteractive();
      this.input.off('pointermove');
      this.input.off('wheel');

      const maskGraphics = this.make.graphics();
      maskGraphics.fillRect(38, 290, 760, 660);
      const mask = maskGraphics.createGeometryMask();
      this.gridContainer!.setMask(mask);
    }
  }

  private createUnitCard(x: number, y: number, item: any): Phaser.GameObjects.Container {
    const shipKey = this.getShipKey(item.unit.faction, item.unit.unitClass);

    // Increase frame by 20%, keep ship the same size
    const frameScale = 0.21 * 1.20;
    const shipScaleMultiplier = 1 / 1.30;

    const container = UnitVisualFactory.createUnitWithFrame(
      this,
      x,
      y,
      shipKey,
      item.unit.rarity,
      frameScale,
      shipScaleMultiplier
    );

    const selectionBorder = this.add.rectangle(0, 0, 68, 68)
      .setStrokeStyle(4, 0xffff00)
      .setFillStyle(0x000000, 0)
      .setVisible(false)
      .setDepth(20);
    container.add(selectionBorder);
    (container as any).selectionBorder = selectionBorder;

    const hitArea = this.add.rectangle(0, 0, 58, 58, 0x000000, 0)
      .setInteractive();
    container.add(hitArea);

    (hitArea as any).unitId = item.id;
    (container as any).unitId = item.id;

    let clickCount = 0;

    hitArea.on('pointerdown', () => {
      clickCount++;
      if (clickCount === 1) {
        this.toggleUnitSelection(item.id, container);
      }
      if (clickCount === 2) {
        const prepare = this.scene.get('PrepareScene') as any;
        if (prepare && typeof prepare.addSingleUnitToTeam === 'function') {
          const success = prepare.addSingleUnitToTeam(item.id);
          if (success) {
            const idx = this.selectedUnitIds.indexOf(item.id);
            if (idx > -1) this.selectedUnitIds.splice(idx, 1);
            this.clearFloatingPanel();
            this.unitsData = this.unitsData.filter((u: any) => u.id !== item.id);
            this.refreshGrid();
          }
        }
        clickCount = 0;
      }
      setTimeout(() => { clickCount = 0; }, 450);
    });

    hitArea.on('pointerover', () => this.showCollectionTooltip(this.gridContainer!.x + x + 4, this.gridContainer!.y + y - 38, item.unit));
    hitArea.on('pointerout', () => this.hideTooltip());

    return container;
  }

  private createRelicCard(x: number, y: number, item: any): Phaser.GameObjects.Container {
    const relicMap: Record<number, string> = {
      0: 'quantum_strike', 1: 'void_shield', 2: 'nebula_dash',
      3: 'echo_core', 4: 'flux_overload', 5: 'last_stand'
    };
    const relicKey = relicMap[item.relic.relicType] || 'quantum_strike';

    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, 52, 52, 0x112233)
      .setStrokeStyle(2, 0x444444)
      .setInteractive();

    const relicSprite = this.add.sprite(0, 0, relicKey)
      .setScale(0.65);

    container.add([bg, relicSprite]);
    this.gridContainer!.add(container);

    (bg as any).relicId = item.id;
    (container as any).relicId = item.id;

    const selectionBorder = this.add.rectangle(0, 0, 74, 74)
      .setStrokeStyle(5, 0xffff00)
      .setFillStyle(0x000000, 0)
      .setVisible(false)
      .setDepth(20);
    container.add(selectionBorder);
    (container as any).selectionBorder = selectionBorder;

    let clickCount = 0;
    bg.on('pointerdown', () => {
      clickCount++;
      if (clickCount === 1) {
        this.toggleRelicSelection(item.id, container);
      }
      if (clickCount === 2) {
        const prepare = this.scene.get('PrepareScene') as any;
        if (prepare && typeof prepare.equipSingleRelic === 'function') {
          const success = prepare.equipSingleRelic(item.id);
          if (success) {
            const idx = this.selectedRelicIds.indexOf(item.id);
            if (idx > -1) this.selectedRelicIds.splice(idx, 1);
            this.clearFloatingPanel();
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

    return container;
  }

  private toggleUnitSelection(id: number, container: any) {
    const idx = this.selectedUnitIds.indexOf(id);
    if (idx > -1) {
      this.selectedUnitIds.splice(idx, 1);
    } else if (this.selectedUnitIds.length < 8) {
      this.selectedUnitIds.push(id);
    }

    const border = (container as any).selectionBorder as Phaser.GameObjects.Rectangle;
    if (border) {
      border.setVisible(this.selectedUnitIds.includes(id));
    }

    this.clearFloatingPanel();
    this.showFloatingMultiSelectPanel();
    this.showPreview(id, true);
  }

  private toggleRelicSelection(id: number, container: any) {
    const idx = this.selectedRelicIds.indexOf(id);
    if (idx > -1) {
      this.selectedRelicIds.splice(idx, 1);
    } else if (this.selectedRelicIds.length < 3) {
      this.selectedRelicIds.push(id);
    }

    const border = (container as any).selectionBorder as Phaser.GameObjects.Rectangle;
    if (border) {
      border.setVisible(this.selectedRelicIds.includes(id));
    }

    this.clearFloatingPanel();
    this.showFloatingMultiSelectPanel();
    this.showPreview(id, false);
  }

  private showFloatingMultiSelectPanel() {
    this.clearFloatingPanel();

    const count = this.currentTab === 'units' 
      ? this.selectedUnitIds.length 
      : this.selectedRelicIds.length;

    if (count === 0) return;

    const isUnits = this.currentTab === 'units';
    const centerX = 480;

    this.floatingPanel = this.add.container(0, 0);

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

    prepareScene.addMultipleRelicsToEquipped([...this.selectedRelicIds]);

    this.relicsData = this.relicsData.filter(r => !this.selectedRelicIds.includes(r.id));
    this.selectedRelicIds = [];
    this.clearFloatingPanel();
    this.refreshGrid();
  }

  private addSelectedToTeam() {
    if (this.selectedUnitIds.length === 0) return;

    const prepareScene = this.scene.get('PrepareScene') as any;
    if (prepareScene && typeof prepareScene.addMultipleUnitsToTeam === 'function') {
      prepareScene.addMultipleUnitsToTeam([...this.selectedUnitIds]);
    }

    this.selectedUnitIds = [];
    this.clearFloatingPanel();
    this.refreshGrid();
  }

  private showPreview(id: number, isUnit: boolean) {
    if (this.previewShip) {
      const prev = this.previewShip as any;
      if (prev && typeof prev.destroy === 'function') prev.destroy(true);
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

      const container = UnitVisualFactory.createUnitWithFrame(
        this,
        this.PREVIEW_X,
        this.PREVIEW_Y,
        shipKey,
        unit.rarity,
        0.72,
        0.65
      );

      container.setDepth(15);
      this.children.bringToTop(container);
      this.previewShip = container as any;

      const ship = container.getAt(container.length - 1) as Phaser.GameObjects.Sprite;
      ship.setDepth(16);

      this.tweens.add({
        targets: ship,
        scale: ship.scale * 1.04,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      const t1 = this.add.text(this.PREVIEW_X, 585, `${this.getFactionName(unit.faction)} ${this.getClassName(unit.unitClass)}`, {
        fontSize: '29px', fill: '#00ffff', wordWrap: { width: wrapWidth }, align: 'center'
      }).setOrigin(0.5).setDepth(20);
      this.previewTexts.push(t1);

      const t2 = this.add.text(this.PREVIEW_X, 635, `ATK ${unit.attack}  DEF ${unit.defense}  SPD ${unit.speed}`, {
        fontSize: '26px', fill: '#ffaa00', wordWrap: { width: wrapWidth }
      }).setOrigin(0.5).setDepth(20);
      this.previewTexts.push(t2);

    } else {
      const relicData = this.relicsData.find(r => r.id === id)?.relic;
      if (!relicData) return;

      const relicMap: Record<number, string> = {
        0: 'quantum_strike', 1: 'void_shield', 2: 'nebula_dash',
        3: 'echo_core', 4: 'flux_overload', 5: 'last_stand'
      };
      const relicKey = relicMap[relicData.relicType] || 'quantum_strike';

      const container = this.add.container(this.PREVIEW_X, this.PREVIEW_Y - 5);

      const bg = this.add.rectangle(0, 0, 140, 140, 0x112233)
        .setStrokeStyle(4, 0xff00ff);

      const relicSprite = this.add.sprite(0, 0, relicKey)
        .setScale(1.35);

      container.add([bg, relicSprite]);
      container.setDepth(15);
      this.children.bringToTop(container);
      this.previewShip = container as any;

      this.tweens.add({
        targets: relicSprite,
        scale: relicSprite.scale * 1.025,
        duration: 3200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      const t1 = this.add.text(this.PREVIEW_X, 565, relicData.name.replace(/\s*\+\d+/, ''), {
        fontSize: '29px', fill: '#ff00ff', wordWrap: { width: 230 }, align: 'center'
      }).setOrigin(0.5).setDepth(20);
      this.previewTexts.push(t1);

      const t2 = this.add.text(this.PREVIEW_X, 635, `+${relicData.value} ${this.getRelicEffectDescription(relicData.relicType)}`, {
        fontSize: '25px', fill: '#ffff88', wordWrap: { width: 230 }, align: 'center'
      }).setOrigin(0.5).setDepth(20);
      this.previewTexts.push(t2);
    }
  }

private showCollectionTooltip(x: number, y: number, item: any, isRelic: boolean) {
  if (this.tooltip) this.tooltip.destroy();

  let tooltipText = 'ERROR: NO DATA';

  if (isRelic) {
    if (!item || item.relicType === undefined) {
      tooltipText = 'Relic data loading...';
    } else {
      const typeNames = [
        'Quantum Strike',
        'Void Shield',
        'Nebula Dash',
        'Echo Core',
        'Flux Overload',
        'Last Stand'
      ];
      const relicName = typeNames[item.relicType] || 'Unknown Relic';
      const effect = this.getRelicEffectDescription ? this.getRelicEffectDescription(item.relicType) : '';
      tooltipText = `${relicName}\n+${item.value} ${effect}`;
    }
  } else {
    if (!item) {
      tooltipText = 'Unit data error';
    } else {
      tooltipText = `${this.getFactionName(item.faction)} ${this.getRarityName(item.rarity)} ${this.getClassName(item.unitClass)}\nATK ${item.attack} DEF ${item.defense} SPD ${item.speed}`;
    }
  }

  this.tooltip = this.add.text(x + 10, y + 10, tooltipText, {
    fontSize: '22px',
    fill: '#ffffff',
    backgroundColor: '#111111',
    padding: { x: 12, y: 10 },
    wordWrap: { width: 280 }
  }).setOrigin(0).setDepth(1000);
}

  private hideTooltip() {
    if (this.tooltip) this.tooltip.setVisible(false);
  }

  private returnToPrepare() {
    this.scene.stop('CollectionScene');
  }

  private getShipKey(faction: number, unitClass: number): string {
    const map: Record<string, string> = {
      '0_0': 'emperial_fighter', '0_1': 'emperial_cruiser', '0_2': 'emperial_dreadnought', '0_3': 'emperial_droneswarm',
      '1_0': 'voidborn_fighter', '1_1': 'voidborn_cruiser', '1_2': 'voidborn_dreadnought', '1_3': 'voidborn_droneswarm',
      '2_0': 'mechanoid_fighter', '2_1': 'mechanoid_cruiser', '2_2': 'mechanoid_dreadnought', '2_3': 'mechanoid_droneswarm',
    };
    return map[`${faction}_${unitClass}`] || 'emperial_fighter';
  }

  private getFactionName(faction: number): string {
    if (isNaN(faction) || faction < 0 || faction > 2) return 'Any';
    return ['Empire', 'Voidborn', 'Mechanoids'][faction] || 'Any';
  }

  private getClassName(unitClass: number): string {
    if (isNaN(unitClass) || unitClass < 0 || unitClass > 3) return 'Any';
    return ['Fighter', 'Cruiser', 'Dreadnought', 'Drone Swarm'][unitClass] || 'Any';
  }

  private getRarityName(rarity: number): string {
    if (isNaN(rarity) || rarity < 0 || rarity > 2) return 'Any';
    return ['Common', 'Rare', 'Legendary'][rarity] || 'Any';
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

  private addButtonEffects(obj: Phaser.GameObjects.GameObject, scale: number = 1.08) {
    const img = obj as Phaser.GameObjects.Image;
    const originalWidth = img.displayWidth;
    const originalHeight = img.displayHeight;
    const hoverWidth = originalWidth * scale;
    const hoverHeight = originalHeight * scale;

    obj.on('pointerover', () => {
      this.tweens.add({ targets: img, displayWidth: hoverWidth, displayHeight: hoverHeight, duration: 120, ease: 'Sine.easeOut' });
      const text = (obj as any).linkedText as Phaser.GameObjects.Text;
      if (text) {
        text.setFill('#ffff88');
        this.tweens.add({ targets: text, scale: 1.1, duration: 120 });
      }
    });

    obj.on('pointerout', () => {
      this.tweens.add({ targets: img, displayWidth: originalWidth, displayHeight: originalHeight, duration: 120, ease: 'Sine.easeOut' });
      const text = (obj as any).linkedText as Phaser.GameObjects.Text;
      if (text) {
        text.setFill((text as any).originalFill || '#ffffff');
        this.tweens.add({ targets: text, scale: 1, duration: 120 });
      }
    });

    obj.on('pointerdown', () => {
      this.tweens.add({ targets: img, displayWidth: originalWidth * 0.95, displayHeight: originalHeight * 0.95, duration: 60, ease: 'Sine.easeOut' });
    });

    obj.on('pointerup', () => {
      this.tweens.add({ targets: img, displayWidth: hoverWidth, displayHeight: hoverHeight, duration: 80, ease: 'Sine.easeOut' });
    });
  }

  shutdown() {
    this.clearGrid();
    this.clearFloatingPanel();

    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }

    if (this.previewShip) {
      const prev = this.previewShip as any;
      if (prev && typeof prev.destroy === 'function') prev.destroy(true);
      this.previewShip = null;
    }

    if (this.darkOverlay) {
      this.darkOverlay.destroy();
      this.darkOverlay = null;
    }
  }
}