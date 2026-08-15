// @ts-nocheck
import * as Phaser from 'phaser';
import { UnitVisualFactory } from '../utils/UnitVisualFactory';
import {
  HUD,
  hudText,
  displayText,
  gridFirstCenter,
  relicMeta,
  relicEffect,
  factionName,
  className,
  rarityName,
  rarityColor,
  shipKey
} from '../utils/HudChrome';
import { compactTeamIds } from '../lib/prepareSession';

type CollectionTab = 'units' | 'relics';

type UnitItem = {
  id: number;
  unit: {
    faction: number;
    rarity: number;
    unitClass: number;
    attack: number;
    defense: number;
    speed: number;
  };
};

type RelicItem = {
  id: number;
  relic: {
    relicType: number;
    value: number;
    name: string;
  };
};

type ChipSpec = {
  key: string;
  label: string;
};

export default class CollectionScene extends Phaser.Scene {
  private walletManager: any;
  private gameContract: any;
  private nftContract: any;
  private relicContract: any;
  private account: `0x${string}` | undefined;
  private publicClient: any;

  private equippedRelicIds: number[] = [];
  private teamIds: number[] = [];
  private currentTab: CollectionTab = 'units';
  private unitsData: UnitItem[] = [];
  private relicsData: RelicItem[] = [];
  private selectedUnitIds: number[] = [];
  private selectedRelicIds: number[] = [];

  private filters = {
    rarity: 'all',
    faction: 'all',
    unitClass: 'all',
    relicType: 'all'
  };

  private readonly PANEL_W = 960;
  private readonly GRID_X = 24;
  private readonly GRID_Y = 228;
  private readonly GRID_W = 600;
  private readonly GRID_H = 660;
  private readonly CELL = 118;
  private readonly CELL_GAP = 22;
  private readonly COLS = 4;
  private readonly INSPECTOR_X = 804;
  private readonly INSPECTOR_Y = 558;

  private darkPanel: Phaser.GameObjects.Rectangle | null = null;
  private rightVeil: Phaser.GameObjects.Rectangle | null = null;
  private gridContainer: Phaser.GameObjects.Container | null = null;
  private contentContainer: Phaser.GameObjects.Container | null = null;
  private filterLayer: Phaser.GameObjects.Container | null = null;
  private inspectorLayer: Phaser.GameObjects.Container | null = null;
  private dockLayer: Phaser.GameObjects.Container | null = null;
  private headerCountText: Phaser.GameObjects.Text | null = null;
  private emptyHintText: Phaser.GameObjects.Text | null = null;
  private toastText: Phaser.GameObjects.Text | null = null;
  private unitsTabBtn: Phaser.GameObjects.Image | null = null;
  private relicsTabBtn: Phaser.GameObjects.Image | null = null;
  private unitsTabText: Phaser.GameObjects.Text | null = null;
  private relicsTabText: Phaser.GameObjects.Text | null = null;
  private tabUnderline: Phaser.GameObjects.Rectangle | null = null;
  private scrollTrack: Phaser.GameObjects.Rectangle | null = null;
  private scrollThumb: Phaser.GameObjects.Rectangle | null = null;
  private cardBorders = new Map<number, Phaser.GameObjects.Rectangle>();

  private collectionMaxScroll = 0;
  private collectionDragStartY = 0;
  private collectionContentStartY = 0;
  private isScrollDragging = false;

  constructor() {
    super({ key: 'CollectionScene' });
  }

  init(data: any) {
    this.walletManager = data.walletManager || window.walletManager;
    this.gameContract = data.gameContract;
    this.nftContract = data.nftContract;
    this.relicContract = data.relicContract;
    this.account = data.account || this.walletManager?.account || window.account;
    this.publicClient = data.publicClient || this.walletManager?.getPublicClient() || window.publicClient;
    this.equippedRelicIds = (data.equippedRelicIds || []).filter((id: number) => id > 0);
    this.teamIds = compactTeamIds(data.teamIds || []);
  }

  create() {
    this.children.getAll().forEach((child) => {
      if (child instanceof Phaser.GameObjects.GameObject) child.destroy();
    });

    this.selectedUnitIds = [];
    this.selectedRelicIds = [];
    this.cardBorders.clear();
    this.currentTab = 'units';
    this.filters = { rarity: 'all', faction: 'all', unitClass: 'all', relicType: 'all' };
    this.collectionMaxScroll = 0;
    this.isScrollDragging = false;

    const prepare = this.scene.get('PrepareScene');
    if (prepare?.input) {
      prepare.input.enabled = false;
    }

    this.buildChrome();
    this.createTabs();
    this.createFilterBar();
    this.createGrid();
    this.createInspector();
    this.createDock();
    this.refreshInspector();
    this.refreshDock();

    this.emptyHintText = this.add.text(this.GRID_X + this.GRID_W / 2, 520, 'Loading hangar...', hudText({
      fontSize: HUD.BODY,
      fill: HUD.color.muted,
      align: 'center',
      wordWrap: { width: 480 }
    })).setOrigin(0.5).setDepth(22);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x > this.PANEL_W) {
        this.returnToPrepare();
      }
    });
    this.input.keyboard?.on('keydown-ESC', () => this.returnToPrepare());
    this.input.on('wheel', this.onCollectionWheel, this);
    this.input.on('pointermove', this.onCollectionDrag, this);
    this.input.on('pointerup', () => {
      this.isScrollDragging = false;
    });

    void this.loadCollectionData();
  }

  private buildChrome() {
    this.darkPanel = this.add.rectangle(this.PANEL_W / 2, 540, this.PANEL_W, 1080, 0x080d16, 0.97)
      .setDepth(1)
      .setInteractive();

    this.rightVeil = this.add.rectangle(1440, 540, 960, 1080, 0x02040a, 0.45)
      .setDepth(1)
      .setInteractive();

    this.add.rectangle(958, 540, 4, 1080, 0x5ee7ff, 0.42).setDepth(24);
    this.add.rectangle(this.PANEL_W / 2, 2, this.PANEL_W, 4, 0xf6e27a, 0.28).setDepth(24);

    if (this.textures.exists('ui_titlebar')) {
      this.add.image(this.PANEL_W / 2, 40, 'ui_titlebar')
        .setDisplaySize(920, 64)
        .setDepth(8)
        .setAlpha(0.92);
    } else {
      this.add.rectangle(this.PANEL_W / 2, 40, 920, 64, 0x101826, 0.9)
        .setStrokeStyle(1, 0x2ec7d6, 0.35)
        .setDepth(8);
    }

    this.add.text(48, 40, 'COLLECTION', displayText({
      fontSize: '28px',
      fill: HUD.color.gold
    })).setOrigin(0, 0.5).setDepth(12);

    this.headerCountText = this.add.text(912, 40, '', hudText({
      fontSize: '16px',
      fill: HUD.color.muted
    })).setOrigin(1, 0.5).setDepth(12);

    this.add.rectangle(324, this.GRID_Y + this.GRID_H / 2, this.GRID_W + 16, this.GRID_H + 16, 0x0c1420, 0.72)
      .setStrokeStyle(1, 0x1f3a4d, 0.8)
      .setDepth(6);

    this.add.rectangle(this.INSPECTOR_X, this.GRID_Y + this.GRID_H / 2, 276, this.GRID_H + 16, 0x101826, 0.88)
      .setStrokeStyle(1, 0x5ee7ff, 0.28)
      .setDepth(6);
  }

  private createTabs() {
    this.unitsTabBtn = this.add.image(168, 112, 'button_base')
      .setDisplaySize(200, 50)
      .setInteractive({ useHandCursor: true })
      .setDepth(12);
    this.unitsTabText = this.add.text(168, 112, 'SHIPS', hudText({
      fontSize: '22px',
      fill: HUD.color.accent
    })).setOrigin(0.5).setDepth(13);
    (this.unitsTabBtn as any).linkedText = this.unitsTabText;
    (this.unitsTabText as any).originalFill = HUD.color.accent;
    this.addButtonEffects(this.unitsTabBtn);
    this.unitsTabBtn.on('pointerdown', () => this.switchTab('units'));

    this.relicsTabBtn = this.add.image(388, 112, 'button_base')
      .setDisplaySize(200, 50)
      .setInteractive({ useHandCursor: true })
      .setDepth(12);
    this.relicsTabText = this.add.text(388, 112, 'RELICS', hudText({
      fontSize: '22px',
      fill: '#e080ff'
    })).setOrigin(0.5).setDepth(13);
    (this.relicsTabBtn as any).linkedText = this.relicsTabText;
    (this.relicsTabText as any).originalFill = '#e080ff';
    this.addButtonEffects(this.relicsTabBtn);
    this.relicsTabBtn.on('pointerdown', () => this.switchTab('relics'));

    this.tabUnderline = this.add.rectangle(168, 142, 132, 3, 0x5ee7ff)
      .setOrigin(0.5)
      .setDepth(13);
  }

  private switchTab(tab: CollectionTab) {
    if (this.currentTab === tab) {
      return;
    }
    this.currentTab = tab;
    this.selectedUnitIds = [];
    this.selectedRelicIds = [];
    if (this.tabUnderline) {
      this.tabUnderline.setPosition(tab === 'units' ? 168 : 388, 142);
      this.tabUnderline.setFillStyle(tab === 'units' ? 0x5ee7ff : 0xe080ff);
    }
    this.createFilterBar();
    this.refreshInspector();
    this.refreshDock();
    this.refreshGrid();
  }

  private createFilterBar() {
    this.filterLayer?.destroy(true);
    this.filterLayer = this.add.container(0, 0).setDepth(14);

    const rows: ChipSpec[][] = this.currentTab === 'units'
      ? [
        [
          { key: 'rarity:all', label: 'All' },
          { key: 'rarity:0', label: 'Common' },
          { key: 'rarity:1', label: 'Rare' },
          { key: 'rarity:2', label: 'Legendary' }
        ],
        [
          { key: 'faction:all', label: 'Any flag' },
          { key: 'faction:0', label: 'Empire' },
          { key: 'faction:1', label: 'Void' },
          { key: 'faction:2', label: 'Mech' },
          { key: 'unitClass:0', label: 'Ftr' },
          { key: 'unitClass:1', label: 'Cru' },
          { key: 'unitClass:2', label: 'Drd' },
          { key: 'unitClass:3', label: 'Swarm' }
        ]
      ]
      : [[
        { key: 'relicType:all', label: 'All' },
        { key: 'relicType:0', label: 'ATK' },
        { key: 'relicType:1', label: 'DEF' },
        { key: 'relicType:2', label: 'SPD' },
        { key: 'relicType:3', label: 'HP' },
        { key: 'relicType:4', label: 'CRIT' },
        { key: 'relicType:5', label: 'Stand' }
      ]];

    rows.forEach((row, rowIndex) => {
      let x = 36;
      const y = 164 + rowIndex * 30;
      row.forEach((chip) => {
        const width = Math.max(58, chip.label.length * 8 + 22);
        const [group, value] = chip.key.split(':');
        const active = this.filters[group] === value;
        const bg = this.add.rectangle(x + width / 2, y, width, 24, active ? 0x16485a : 0x0c1624)
          .setStrokeStyle(1, active ? 0x5ee7ff : 0x2a3f55, active ? 0.95 : 0.7)
          .setInteractive({ useHandCursor: true });
        const label = this.add.text(x + width / 2, y, chip.label, hudText({
          fontSize: '15px',
          fill: active ? HUD.color.accent : HUD.color.muted
        })).setOrigin(0.5);
        bg.on('pointerdown', () => {
          if (group === 'unitClass' && this.filters.unitClass === value) {
            this.filters.unitClass = 'all';
          } else {
            this.filters[group] = value;
          }
          this.createFilterBar();
          this.refreshGrid();
        });
        this.filterLayer!.add([bg, label]);
        x += width + 6;
      });
    });
  }

  private createGrid() {
    this.gridContainer = this.add.container(this.GRID_X, this.GRID_Y).setDepth(12);
    this.contentContainer = this.add.container(0, 0);
    this.gridContainer.add(this.contentContainer);

    const maskGraphics = this.make.graphics();
    maskGraphics.fillRect(this.GRID_X, this.GRID_Y, this.GRID_W, this.GRID_H);
    this.gridContainer.setMask(maskGraphics.createGeometryMask());

    this.scrollTrack = this.add.rectangle(this.GRID_X + this.GRID_W + 8, this.GRID_Y + this.GRID_H / 2, 4, this.GRID_H, 0x163044, 0.7)
      .setDepth(14)
      .setVisible(false);
    this.scrollThumb = this.add.rectangle(this.GRID_X + this.GRID_W + 8, this.GRID_Y + 40, 6, 80, 0x5ee7ff, 0.7)
      .setDepth(15)
      .setVisible(false);
  }

  private createInspector() {
    this.inspectorLayer = this.add.container(this.INSPECTOR_X, this.INSPECTOR_Y).setDepth(16);
  }

  private createDock() {
    this.dockLayer = this.add.container(0, 0).setDepth(18);
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

  private async loadCollectionData() {
    if (!this.account || !this.gameContract || !this.nftContract || !this.relicContract) {
      this.setEmptyHint('Connect wallet to open the hangar.');
      return;
    }

    try {
      const unitIds: bigint[] = await this.gameContract.read.getPlayerUnits([this.account]);
      const loadedUnits = await Promise.all(
        unitIds.map(async (idBig) => {
          const id = Number(idBig);
          try {
            const raw = await this.nftContract.read.getUnit([idBig]);
            return { id, unit: this.normalizeUnit(raw) } as UnitItem;
          } catch {
            return null;
          }
        })
      );
      this.unitsData = loadedUnits.filter(Boolean) as UnitItem[];

      const prepare = this.scene.get('PrepareScene') as any;
      this.teamIds = compactTeamIds(Array.isArray(prepare?.team) ? prepare.team : this.teamIds);
      if (Array.isArray(prepare?.equippedRelics)) {
        this.equippedRelicIds = prepare.equippedRelics.filter((id: number) => id > 0);
      }
      this.unitsData = this.unitsData.filter((item) => !this.teamIds.includes(item.id));
      this.unitsData.sort((a, b) => {
        if (b.unit.rarity !== a.unit.rarity) return b.unit.rarity - a.unit.rarity;
        return b.unit.attack - a.unit.attack;
      });

      const relicIds: bigint[] = await this.gameContract.read.getPlayerRelics([this.account]);
      const loadedRelics = await Promise.all(
        relicIds.map(async (idBig) => {
          const id = Number(idBig);
          try {
            const raw = await this.relicContract.read.getRelic([idBig]);
            const relicType = Number(Array.isArray(raw) ? raw[0] : raw.relicType);
            const value = Number(Array.isArray(raw) ? raw[1] : raw.value);
            const name = Array.isArray(raw) ? '' : (raw.name || '');
            return { id, relic: { relicType, value, name } } as RelicItem;
          } catch {
            return null;
          }
        })
      );
      this.relicsData = (loadedRelics.filter(Boolean) as RelicItem[])
        .filter((item) => !this.equippedRelicIds.includes(item.id))
        .sort((a, b) => b.relic.value - a.relic.value);

      this.updateHeaderCount();
      this.refreshGrid();
      this.refreshInspector();
      this.refreshDock();
    } catch (error) {
      console.error('loadCollectionData error:', error);
      this.setEmptyHint('Failed to load collection.');
    }
  }

  private updateHeaderCount() {
    if (!this.headerCountText) {
      return;
    }
    const fleet = this.teamIds.length;
    const hangar = this.unitsData.length;
    const relics = this.relicsData.length;
    const equipped = this.equippedRelicIds.length;
    this.headerCountText.setText(`${fleet}/8  ·  ${hangar} hangar  ·  ${relics} relics`);
  }

  private filteredData(): Array<UnitItem | RelicItem> {
    if (this.currentTab === 'units') {
      return this.unitsData.filter((item) => {
        const unit = item.unit;
        if (this.filters.rarity !== 'all' && String(unit.rarity) !== this.filters.rarity) return false;
        if (this.filters.faction !== 'all' && String(unit.faction) !== this.filters.faction) return false;
        if (this.filters.unitClass !== 'all' && String(unit.unitClass) !== this.filters.unitClass) return false;
        return true;
      });
    }
    return this.relicsData.filter((item) => {
      if (this.filters.relicType !== 'all' && String(item.relic.relicType) !== this.filters.relicType) return false;
      return true;
    });
  }

  private setEmptyHint(message: string) {
    if (this.emptyHintText) {
      this.emptyHintText.destroy();
    }
    this.emptyHintText = this.add.text(this.GRID_X + this.GRID_W / 2, this.GRID_Y + 280, message, hudText({
      fontSize: HUD.BODY,
      fill: HUD.color.muted,
      align: 'center',
      wordWrap: { width: 500 }
    })).setOrigin(0.5).setDepth(22);
  }

  private refreshGrid() {
    const keepScroll = this.contentContainer ? this.contentContainer.y : 0;
    this.cardBorders.clear();
    if (this.contentContainer) {
      this.contentContainer.removeAll(true);
    }
    if (this.emptyHintText) {
      this.emptyHintText.destroy();
      this.emptyHintText = null;
    }

    const data = this.filteredData();
    if (!this.contentContainer || data.length === 0) {
      const message = this.currentTab === 'units'
        ? (this.teamIds.length >= 8
          ? 'Fleet is full. Clear a slot to add more.'
          : this.unitsData.length === 0
            ? (this.teamIds.length > 0 ? 'All ships are already in the fleet.' : 'No ships yet. Generate 10 first.')
            : 'No ships match these filters.')
        : (this.relicsData.length === 0
          ? (this.equippedRelicIds.length > 0 ? 'All relics are equipped.' : 'No relics. Reroll the shop.')
          : 'No relics match this filter.');
      this.setEmptyHint(message);
      this.collectionMaxScroll = 0;
      if (this.contentContainer) {
        this.contentContainer.y = 0;
      }
      this.scrollTrack?.setVisible(false);
      this.scrollThumb?.setVisible(false);
      return;
    }

    const step = this.CELL + this.CELL_GAP;
    const startX = gridFirstCenter(this.GRID_W / 2, this.COLS, this.CELL, this.CELL_GAP);
    const startY = this.CELL / 2 + 10;

    data.forEach((item, index) => {
      const col = index % this.COLS;
      const row = Math.floor(index / this.COLS);
      const x = startX + col * step;
      const y = startY + row * step;
      const card = this.currentTab === 'units'
        ? this.createUnitCard(x, y, item as UnitItem)
        : this.createRelicCard(x, y, item as RelicItem);
      this.contentContainer!.add(card);
    });

    const totalRows = Math.ceil(data.length / this.COLS);
    const totalHeight = totalRows * step + 18;
    this.collectionMaxScroll = Math.max(0, totalHeight - this.GRID_H);
    if (this.contentContainer) {
      this.contentContainer.y = Phaser.Math.Clamp(keepScroll, -this.collectionMaxScroll, 0);
    }
    this.updateScrollThumb();
  }

  private updateScrollThumb() {
    const show = this.collectionMaxScroll > 0;
    this.scrollTrack?.setVisible(show);
    this.scrollThumb?.setVisible(show);
    if (!show || !this.scrollThumb || !this.contentContainer) {
      return;
    }
    const trackH = this.GRID_H;
    const thumbH = Math.max(48, trackH * (this.GRID_H / (this.GRID_H + this.collectionMaxScroll)));
    const t = this.collectionMaxScroll === 0 ? 0 : (-this.contentContainer.y) / this.collectionMaxScroll;
    const thumbY = this.GRID_Y + thumbH / 2 + t * (trackH - thumbH);
    this.scrollThumb.setDisplaySize(6, thumbH);
    this.scrollThumb.setPosition(this.GRID_X + this.GRID_W + 8, thumbY);
  }

  private onCollectionWheel(pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, deltaY: number) {
    if (!this.contentContainer || this.collectionMaxScroll <= 0) {
      return;
    }
    if (pointer.x > this.GRID_X + this.GRID_W + 20 || pointer.x < 0) {
      return;
    }
    this.contentContainer.y = Phaser.Math.Clamp(
      this.contentContainer.y - deltaY * 0.7,
      -this.collectionMaxScroll,
      0
    );
    this.updateScrollThumb();
  }

  private onCollectionDrag(pointer: Phaser.Input.Pointer) {
    if (!pointer.isDown || !this.contentContainer || this.collectionMaxScroll <= 0) {
      return;
    }
    if (pointer.x < this.GRID_X || pointer.x > this.GRID_X + this.GRID_W) {
      return;
    }
    if (!this.isScrollDragging) {
      if (Math.abs(pointer.y - this.collectionDragStartY) < 12) {
        return;
      }
      this.isScrollDragging = true;
    }
    this.contentContainer.y = Phaser.Math.Clamp(
      this.collectionContentStartY + (pointer.y - this.collectionDragStartY),
      -this.collectionMaxScroll,
      0
    );
    this.updateScrollThumb();
  }

  private bindCardInput(
    hit: Phaser.GameObjects.GameObject,
    onSelect: () => void,
    onAdd: () => void
  ) {
    let clicks = 0;
    let timer: Phaser.Time.TimerEvent | null = null;
    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.collectionDragStartY = pointer.y;
      this.collectionContentStartY = this.contentContainer ? this.contentContainer.y : 0;
      this.isScrollDragging = false;
      clicks += 1;
      if (clicks === 1) {
        timer = this.time.delayedCall(260, () => {
          if (!this.isScrollDragging) {
            onSelect();
          }
          clicks = 0;
        });
        return;
      }
      timer?.remove(false);
      timer = null;
      clicks = 0;
      if (!this.isScrollDragging) {
        onAdd();
      }
    });
  }

  private createUnitCard(x: number, y: number, item: UnitItem): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const slot = this.add.image(0, 0, 'slot_team').setDisplaySize(this.CELL, this.CELL);
    const visual = UnitVisualFactory.createUnitWithFrame(
      this,
      0,
      -4,
      shipKey(item.unit.faction, item.unit.unitClass),
      item.unit.rarity,
      this.CELL
    );
    const caption = this.add.text(0, this.CELL / 2 + 8, rarityName(item.unit.rarity).toUpperCase(), hudText({
      fontSize: '12px',
      fill: rarityColor(item.unit.rarity)
    })).setOrigin(0.5);
    const selected = this.selectedUnitIds.includes(item.id);
    const border = this.add.rectangle(0, 0, this.CELL - 6, this.CELL - 6)
      .setStrokeStyle(3, selected ? 0x5dffb0 : 0x000000, selected ? 1 : 0)
      .setFillStyle(0x000000, 0);
    const hit = this.add.rectangle(0, 0, this.CELL - 10, this.CELL - 10, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });

    container.add([slot, visual, caption, border, hit]);
    this.cardBorders.set(item.id, border);
    this.bindCardInput(
      hit,
      () => this.toggleUnitSelection(item.id),
      () => this.addSingleUnit(item.id)
    );
    return container;
  }

  private createRelicCard(x: number, y: number, item: RelicItem): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const slot = this.add.image(0, 0, 'slot_equipped').setDisplaySize(this.CELL, this.CELL);
    const icon = this.add.image(0, -8, relicMeta(item.relic.relicType).key)
      .setDisplaySize(68, 68);
    const caption = this.add.text(0, this.CELL / 2 + 8, `+${item.relic.value} ${relicMeta(item.relic.relicType).short}`, hudText({
      fontSize: '12px',
      fill: '#e080ff'
    })).setOrigin(0.5);
    const selected = this.selectedRelicIds.includes(item.id);
    const border = this.add.rectangle(0, 0, this.CELL - 6, this.CELL - 6)
      .setStrokeStyle(3, selected ? 0x5dffb0 : 0x000000, selected ? 1 : 0)
      .setFillStyle(0x000000, 0);
    const hit = this.add.rectangle(0, 0, this.CELL - 10, this.CELL - 10, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });

    container.add([slot, icon, caption, border, hit]);
    this.cardBorders.set(item.id, border);
    this.bindCardInput(
      hit,
      () => this.toggleRelicSelection(item.id),
      () => this.addSingleRelic(item.id)
    );
    return container;
  }

  private paintSelection() {
    this.cardBorders.forEach((border, id) => {
      const on = this.currentTab === 'units'
        ? this.selectedUnitIds.includes(id)
        : this.selectedRelicIds.includes(id);
      border.setStrokeStyle(3, on ? 0x5dffb0 : 0x000000, on ? 1 : 0);
    });
  }

  private toggleUnitSelection(id: number) {
    const idx = this.selectedUnitIds.indexOf(id);
    if (idx > -1) {
      this.selectedUnitIds.splice(idx, 1);
    } else if (this.selectedUnitIds.length < 8) {
      this.selectedUnitIds.push(id);
    }
    this.paintSelection();
    this.refreshInspector();
    this.refreshDock();
  }

  private toggleRelicSelection(id: number) {
    const idx = this.selectedRelicIds.indexOf(id);
    if (idx > -1) {
      this.selectedRelicIds.splice(idx, 1);
    } else if (this.selectedRelicIds.length < 3) {
      this.selectedRelicIds.push(id);
    }
    this.paintSelection();
    this.refreshInspector();
    this.refreshDock();
  }

  private lastSelectedId(): number {
    if (this.currentTab === 'units') {
      return this.selectedUnitIds[this.selectedUnitIds.length - 1] || 0;
    }
    return this.selectedRelicIds[this.selectedRelicIds.length - 1] || 0;
  }

  private refreshInspector() {
    this.inspectorLayer?.removeAll(true);
    if (!this.inspectorLayer) {
      return;
    }

    const id = this.lastSelectedId();
    if (!id) {
      this.inspectorLayer.add(
        this.add.text(0, 0, 'Select a card\nin the hangar', hudText({
          fontSize: HUD.BODY,
          fill: HUD.color.muted,
          align: 'center'
        })).setOrigin(0.5)
      );
      return;
    }

    if (this.currentTab === 'units') {
      const item = this.unitsData.find((entry) => entry.id === id);
      if (!item) {
        return;
      }
      const visual = UnitVisualFactory.createUnitWithFrame(
        this,
        0,
        -210,
        shipKey(item.unit.faction, item.unit.unitClass),
        item.unit.rarity,
        176
      );
      const title = this.add.text(0, -98, `${factionName(item.unit.faction)} ${className(item.unit.unitClass)}`, hudText({
        fontSize: '20px',
        fill: HUD.color.text,
        align: 'center',
        wordWrap: { width: 250 }
      })).setOrigin(0.5);
      const rarity = this.add.text(0, -68, rarityName(item.unit.rarity).toUpperCase(), hudText({
        fontSize: '16px',
        fill: rarityColor(item.unit.rarity)
      })).setOrigin(0.5);
      const idText = this.add.text(0, -44, `SHIP #${item.id}`, hudText({
        fontSize: '14px',
        fill: HUD.color.muted
      })).setOrigin(0.5);
      this.inspectorLayer.add([visual, title, rarity, idText]);
      this.addStatBar(-70, 'ATK', item.unit.attack, 0xff6b88);
      this.addStatBar(-20, 'DEF', item.unit.defense, 0x5ee7ff);
      this.addStatBar(30, 'SPD', item.unit.speed, 0x5dffb0);
      this.addInspectorButton(90, 'ADD TO FLEET', HUD.color.warn, () => this.addSingleUnit(item.id));
      this.inspectorLayer.add(
        this.add.text(0, 138, 'Local only  ·  no wallet', hudText({
          fontSize: '14px',
          fill: HUD.color.muted
        })).setOrigin(0.5)
      );
      return;
    }

    const item = this.relicsData.find((entry) => entry.id === id);
    if (!item) {
      return;
    }
    const frame = this.add.image(0, -200, 'slot_equipped').setDisplaySize(160, 160);
    const icon = this.add.image(0, -200, relicMeta(item.relic.relicType).key)
      .setDisplaySize(92, 92);
    const title = this.add.text(0, -96, item.relic.name || relicMeta(item.relic.relicType).name, hudText({
      fontSize: '18px',
      fill: '#e080ff',
      align: 'center',
      wordWrap: { width: 250 }
    })).setOrigin(0.5);
    const value = this.add.text(0, -60, `+${item.relic.value}`, displayText({
      fontSize: '28px',
      fill: HUD.color.gold
    })).setOrigin(0.5);
    const effect = this.add.text(0, -18, relicEffect(item.relic.relicType), hudText({
      fontSize: HUD.SMALL,
      fill: HUD.color.text,
      align: 'center',
      wordWrap: { width: 240 }
    })).setOrigin(0.5);
    this.inspectorLayer.add([frame, icon, title, value, effect]);
    this.addInspectorButton(72, 'EQUIP', HUD.color.accent, () => this.addSingleRelic(item.id));
    this.inspectorLayer.add(
      this.add.text(0, 118, 'Local slot  ·  no wallet', hudText({
        fontSize: '14px',
        fill: HUD.color.muted,
        align: 'center',
        wordWrap: { width: 240 }
      })).setOrigin(0.5)
    );
  }

  private addStatBar(y: number, label: string, value: number, color: number) {
    if (!this.inspectorLayer) {
      return;
    }
    const caption = this.add.text(-116, y, `${label}  ${value}`, hudText({
      fontSize: '16px',
      fill: HUD.color.text
    })).setOrigin(0, 0.5);
    const bg = this.add.rectangle(20, y + 22, 200, 8, 0x112233).setOrigin(0.5);
    const fillW = Phaser.Math.Clamp((value / 24) * 200, 8, 200);
    const fill = this.add.rectangle(20 - 100 + fillW / 2, y + 22, fillW, 8, color).setOrigin(0.5);
    this.inspectorLayer.add([caption, bg, fill]);
  }

  private addInspectorButton(y: number, label: string, color: string, onClick: () => void) {
    if (!this.inspectorLayer) {
      return;
    }
    const btn = this.add.image(0, y, 'button_base')
      .setDisplaySize(220, 52)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(0, y, label, hudText({
      fontSize: '20px',
      fill: color
    })).setOrigin(0.5);
    (btn as any).linkedText = text;
    (text as any).originalFill = color;
    this.addButtonEffects(btn);
    btn.on('pointerdown', onClick);
    this.inspectorLayer.add([btn, text]);
  }

  private refreshDock() {
    this.dockLayer?.removeAll(true);
    if (!this.dockLayer) {
      return;
    }

    const back = this.add.image(168, 1018, 'button_base')
      .setDisplaySize(220, 56)
      .setInteractive({ useHandCursor: true });
    const backText = this.add.text(168, 1018, 'GO BACK', hudText({
      fontSize: '22px',
      fill: '#ffffff'
    })).setOrigin(0.5);
    (back as any).linkedText = backText;
    (backText as any).originalFill = '#ffffff';
    this.addButtonEffects(back);
    back.on('pointerdown', () => this.returnToPrepare());
    this.dockLayer.add([back, backText]);

    const count = this.currentTab === 'units' ? this.selectedUnitIds.length : this.selectedRelicIds.length;
    const countText = this.add.text(480, 1018, count > 0 ? `SELECTED  ${count}` : 'Click select  ·  Double-click add', hudText({
      fontSize: '16px',
      fill: count > 0 ? HUD.color.good : HUD.color.muted
    })).setOrigin(0.5);
    this.dockLayer.add(countText);

    if (count > 0) {
      const isUnits = this.currentTab === 'units';
      const action = this.add.image(792, 1018, 'button_base')
        .setDisplaySize(240, 56)
        .setInteractive({ useHandCursor: true });
      const actionLabel = isUnits ? `ADD ${count} TO FLEET` : `EQUIP ${count} LOCALLY`;
      const actionText = this.add.text(792, 1018, actionLabel, hudText({
        fontSize: '18px',
        fill: isUnits ? HUD.color.warn : HUD.color.accent
      })).setOrigin(0.5);
      (action as any).linkedText = actionText;
      (actionText as any).originalFill = isUnits ? HUD.color.warn : HUD.color.accent;
      this.addButtonEffects(action);
      action.on('pointerdown', () => {
        if (isUnits) {
          void this.addSelectedToTeam();
        } else {
          this.activateSelectedRelics();
        }
      });
      this.dockLayer.add([action, actionText]);
    }
  }

  private addSingleUnit(unitId: number): boolean {
    const prepare = this.scene.get('PrepareScene') as any;
    if (!prepare || typeof prepare.addSingleUnitToTeam !== 'function') {
      return false;
    }
    const success = prepare.addSingleUnitToTeam(unitId);
    if (!success) {
      this.showToast(this.teamIds.length >= 8 ? 'Fleet is already full.' : 'Could not add that ship.');
      return false;
    }
    this.unitsData = this.unitsData.filter((item) => item.id !== unitId);
    this.selectedUnitIds = this.selectedUnitIds.filter((id) => id !== unitId);
    this.teamIds = compactTeamIds(prepare.team || this.teamIds);
    this.updateHeaderCount();
    this.refreshGrid();
    this.refreshInspector();
    this.refreshDock();
    this.showToast('Ship added to fleet.');
    return true;
  }

  private addSingleRelic(relicId: number): boolean {
    const prepare = this.scene.get('PrepareScene') as any;
    if (!prepare || typeof prepare.equipSingleRelic !== 'function') {
      return false;
    }
    const success = prepare.equipSingleRelic(relicId);
    if (!success) {
      this.showToast('No free relic slot.');
      return false;
    }
    this.relicsData = this.relicsData.filter((item) => item.id !== relicId);
    this.selectedRelicIds = this.selectedRelicIds.filter((id) => id !== relicId);
    this.equippedRelicIds = Array.isArray(prepare.equippedRelics)
      ? prepare.equippedRelics.filter((id: number) => id > 0)
      : this.equippedRelicIds;
    this.updateHeaderCount();
    this.refreshGrid();
    this.refreshInspector();
    this.refreshDock();
    this.showToast('Relic equipped.');
    return true;
  }

  private async addSelectedToTeam() {
    if (this.selectedUnitIds.length === 0) {
      return;
    }
    const prepare = this.scene.get('PrepareScene') as any;
    const ids = [...this.selectedUnitIds];
    if (prepare && typeof prepare.addMultipleUnitsToTeam === 'function') {
      await prepare.addMultipleUnitsToTeam(ids);
    }
    this.unitsData = this.unitsData.filter((item) => !ids.includes(item.id));
    this.teamIds = compactTeamIds(prepare?.team || this.teamIds);
    this.selectedUnitIds = [];
    this.updateHeaderCount();
    this.refreshGrid();
    this.refreshInspector();
    this.refreshDock();
    this.showToast('Selected ships moved to fleet.');
  }

  private activateSelectedRelics() {
    if (this.selectedRelicIds.length === 0) {
      return;
    }
    const prepare = this.scene.get('PrepareScene') as any;
    if (!prepare || typeof prepare.addMultipleRelicsToEquipped !== 'function') {
      return;
    }
    const ids = [...this.selectedRelicIds];
    prepare.addMultipleRelicsToEquipped(ids);
    this.relicsData = this.relicsData.filter((item) => !ids.includes(item.id));
    this.equippedRelicIds = Array.isArray(prepare.equippedRelics)
      ? prepare.equippedRelics.filter((id: number) => id > 0)
      : this.equippedRelicIds;
    this.selectedRelicIds = [];
    this.updateHeaderCount();
    this.refreshGrid();
    this.refreshInspector();
    this.refreshDock();
    this.showToast('Relics equipped.');
  }

  public applyFiltersAndSort() {
    this.refreshGrid();
  }

  private showToast(message: string) {
    this.toastText?.destroy();
    this.toastText = this.add.text(480, 955, message, hudText({
      fontSize: '20px',
      fill: HUD.color.good,
      backgroundColor: '#081018',
      padding: { x: 14, y: 8 }
    })).setOrigin(0.5).setDepth(40);
    this.time.delayedCall(1600, () => {
      this.toastText?.destroy();
      this.toastText = null;
    });
  }

  private restorePrepareInput() {
    const prepare = this.scene.get('PrepareScene');
    if (prepare?.input) {
      prepare.input.enabled = true;
    }
  }

  private returnToPrepare() {
    this.restorePrepareInput();
    this.scene.stop('CollectionScene');
  }

  private addButtonEffects(obj: Phaser.GameObjects.GameObject, scale: number = 1.06) {
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
        duration: 60
      });
    });
    obj.on('pointerup', () => {
      this.tweens.add({
        targets: img,
        displayWidth: hoverWidth,
        displayHeight: hoverHeight,
        duration: 80
      });
    });
  }

  shutdown() {
    this.restorePrepareInput();
    this.input.keyboard?.off('keydown-ESC');
    this.input.off('wheel', this.onCollectionWheel, this);
    this.input.off('pointermove', this.onCollectionDrag, this);
    this.cardBorders.clear();
    this.filterLayer?.destroy(true);
    this.inspectorLayer?.destroy(true);
    this.dockLayer?.destroy(true);
    this.gridContainer?.destroy(true);
    this.darkPanel?.destroy();
    this.rightVeil?.destroy();
    this.emptyHintText?.destroy();
    this.toastText?.destroy();
  }
}
