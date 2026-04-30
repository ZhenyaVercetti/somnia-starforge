// @ts-nocheck
// frontend/src/scenes/CollectionScene.ts
import * as Phaser from 'phaser';

export default class CollectionScene extends Phaser.Scene {
  private gameContract: any;
  private nftContract: any;
  private relicContract: any;
  private account: `0x${string}` | undefined;
  private publicClient: any;

  private currentTab: 'units' | 'relics' = 'units';
  private unitsData: any[] = [];
  private relicsData: any[] = [];
  private selectedUnitIds: number[] = [];
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

    console.log('✅ CollectionScene init — данные получены, returnTo:', this.returnToScene);
  }

  create() {
    this.children.getAll().forEach(child => {
      if (child instanceof Phaser.GameObjects.GameObject) child.destroy();
    });

    this.unitSprites = [];
    this.relicSprites = [];
    this.selectedUnitIds = [];
    this.previewTexts = [];
    this.tooltip = null;

    this.add.rectangle(960, 540, 1920, 1080, 0x0a0022).setAlpha(0.96);

    this.add.text(960, 45, 'МОЯ КОЛЛЕКЦИЯ', { 
      fontSize: '63px', 
      fill: '#ffff00', 
      fontStyle: 'bold' 
    }).setOrigin(0.5);

    this.createTabs();
    this.createFilters();
    this.createGridContainer();
    this.createPreviewPanel();
    this.createBottomPanel();

    this.loadCollectionData();

    console.log('✅ CollectionScene создана (rarity visuals максимально заметны)');
  }

  private createTabs() {
    const unitsTab = this.add.text(570, 135, 'ЮНИТЫ', { 
      fontSize: '42px', 
      fill: '#00ffff' 
    })
      .setInteractive()
      .on('pointerdown', () => this.switchTab('units'));

    const relicsTab = this.add.text(870, 135, 'РЕЛИКВИИ', { 
      fontSize: '42px', 
      fill: '#ff00ff' 
    })
      .setInteractive()
      .on('pointerdown', () => this.switchTab('relics'));

    this.unitsUnderline = this.add.rectangle(720, 172, 330, 9, 0x00ffff).setOrigin(0.5);
  }

  private switchTab(tab: 'units' | 'relics') {
    this.currentTab = tab;
    this.selectedUnitIds = [];
    if (this.unitsUnderline) {
      this.unitsUnderline.setPosition(tab === 'units' ? 720 : 1070, 172);
    }
    this.refreshGrid();
  }

  private createFilters() {
    this.add.text(150, 210, 'ФИЛЬТРЫ (клик для смены):', { fontSize: '27px', fill: '#aaaaaa' });

    const rarityBtn = this.add.text(150, 255, `Rarity: ${this.filters.rarity}`, { fontSize: '24px', fill: '#00ffff' })
      .setInteractive()
      .on('pointerdown', () => {
        const options: ('all' | '0' | '1' | '2')[] = ['all', '0', '1', '2'];
        const idx = options.indexOf(this.filters.rarity);
        this.filters.rarity = options[(idx + 1) % options.length];
        rarityBtn.setText(`Rarity: ${this.filters.rarity}`);
        this.refreshGrid();
      });

    const factionBtn = this.add.text(150, 292, `Faction: ${this.filters.faction}`, { fontSize: '24px', fill: '#00ffff' })
      .setInteractive()
      .on('pointerdown', () => {
        const options: ('all' | '0' | '1' | '2')[] = ['all', '0', '1', '2'];
        const idx = options.indexOf(this.filters.faction);
        this.filters.faction = options[(idx + 1) % options.length];
        factionBtn.setText(`Faction: ${this.filters.faction}`);
        this.refreshGrid();
      });

    const classBtn = this.add.text(150, 330, `Class: ${this.filters.unitClass}`, { fontSize: '24px', fill: '#00ffff' })
      .setInteractive()
      .on('pointerdown', () => {
        const options: ('all' | '0' | '1' | '2' | '3')[] = ['all', '0', '1', '2', '3'];
        const idx = options.indexOf(this.filters.unitClass);
        this.filters.unitClass = options[(idx + 1) % options.length];
        classBtn.setText(`Class: ${this.filters.unitClass}`);
        this.refreshGrid();
      });
  }

  private createGridContainer() {
    this.gridContainer = this.add.container(120, 285);

    const maskGraphics = this.make.graphics();
    maskGraphics.fillRect(120, 285, 1170, 690);
    const mask = maskGraphics.createGeometryMask();
    this.gridContainer.setMask(mask);
  }

  private createPreviewPanel() {
    this.previewRect = this.add.rectangle(1590, 510, 570, 780, 0x112233)
      .setStrokeStyle(4, 0x00ffff);
  }

  private createBottomPanel() {
    this.add.text(960, 1020, '← ВЕРНУТЬСЯ В ПОДГОТОВКУ', {
      fontSize: '48px', 
      fill: '#ffffff', 
      backgroundColor: '#112233', 
      padding: { x: 45, y: 18 }
    })
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => this.returnToPrepare());
  }

  private async loadCollectionData() {
    if (!this.account) return;

    try {
      const unitIds: bigint[] = await this.gameContract.read.getPlayerUnits([this.account]);
      this.unitsData = await Promise.all(unitIds.map(async (idBig) => {
        const id = Number(idBig);
        const unit = await this.nftContract.read.getUnit([idBig]);
        return { id, unit, inTeam: false };
      }));

      const relicIds: bigint[] = await this.gameContract.read.getPlayerRelics([this.account]);
      this.relicsData = await Promise.all(relicIds.map(async (idBig) => {
        const id = Number(idBig);
        const relic = await this.relicContract.read.getRelic([idBig]);
        return { id, relic };
      }));

      this.refreshGrid();
    } catch (e) {
      console.error('loadCollectionData error', e);
    }
  }

  private getRarityTintAndScale(rarity: number) {
    if (rarity === 2) return { tint: 0xffee00, scale: 1.22 };     // Legendary — золотой, большой
    if (rarity === 1) return { tint: 0x00ff77, scale: 1.10 };     // Rare — ярко-зелёный
    return { tint: 0x44aaff, scale: 0.96 };                       // Common — синий
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

    const startX = 0;
    const startY = 0;
    const spacingX = 142;
    const spacingY = 172;

    data.forEach((item, index) => {
      const col = index % 8;
      const row = Math.floor(index / 8);
      const x = startX + col * spacingX;
      const y = startY + row * spacingY;

      let sprite: Phaser.GameObjects.GameObject;

      if (this.currentTab === 'units') {
        const style = this.getRarityTintAndScale(item.unit.rarity);
        sprite = this.add.rectangle(x, y, 117, 147, 0x112233)
          .setStrokeStyle(8, style.tint)
          .setScale(style.scale)
          .setInteractive();

        (sprite as any).unitId = item.id;
        (sprite as any).isUnit = true;

        const check = this.add.rectangle(x - 42, y - 57, 27, 27, 
          this.selectedUnitIds.includes(item.id) ? 0x00ff00 : 0x666666)
          .setStrokeStyle(3, 0xffffff);
        this.gridContainer!.add(check);
        (sprite as any).checkBox = check;

        sprite.on('pointerdown', () => this.toggleUnitSelection(item.id, sprite as any));
        sprite.on('pointerover', () => this.showCollectionTooltip(x + 85, y - 35, item.unit));
        sprite.on('pointerout', () => this.hideTooltip());
      } else {
        sprite = this.add.rectangle(x, y, 117, 117, 0x112233)
          .setStrokeStyle(6, 0xffaa00)
          .setInteractive();
        (sprite as any).relicId = item.id;
        (sprite as any).isRelic = true;

        sprite.on('pointerover', () => {
          const relic = item.relic;
          this.showCollectionTooltip(x + 85, y - 35, null, relic);
        });
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
    } else {
      this.selectedUnitIds.push(id);
    }
    this.refreshGrid();
    this.showFloatingMultiSelectPanel();
    this.showPreview(id, true);
  }

  private showFloatingMultiSelectPanel() {
    this.children.getAll().forEach(child => {
      if (child instanceof Phaser.GameObjects.Text && child.text.includes('Выбрано')) child.destroy();
    });

    if (this.selectedUnitIds.length === 0) return;

    const panel = this.add.text(960, 825, `Выбрано: ${this.selectedUnitIds.length} юнитов`, {
      fontSize: '36px', fill: '#00ff88', backgroundColor: '#112233', padding: { x: 30, y: 15 }
    }).setOrigin(0.5);

    const addBtn = this.add.text(960, 885, 'ДОБАВИТЬ В КОМАНДУ', {
      fontSize: '42px', fill: '#ffff00', backgroundColor: '#223311', padding: { x: 45, y: 18 }
    }).setOrigin(0.5).setInteractive()
      .on('pointerdown', () => this.addSelectedToTeam());
  }

  private async addSelectedToTeam() {
    if (this.selectedUnitIds.length === 0) return;

    this.scene.start(this.returnToScene, {
      gameContract: this.gameContract,
      nftContract: this.nftContract,
      relicContract: this.relicContract,
      account: this.account,
      publicClient: this.publicClient,
      addUnits: [...this.selectedUnitIds]
    });
  }

  private showPreview(id: number, isUnit: boolean) {
    if (this.previewRect) this.previewRect.setFillStyle(0x112233);
    this.previewTexts.forEach(t => t.destroy());
    this.previewTexts = [];

    if (isUnit) {
      const unitData = this.unitsData.find(u => u.id === id);
      if (!unitData) return;
      const unit = unitData.unit;

      this.previewTexts.push(
        this.add.text(1590, 300, `ID: ${id}`, { fontSize: '33px', fill: '#ffff00' }).setOrigin(0.5)
      );
      this.previewTexts.push(
        this.add.text(1590, 390, `${this.getFactionName(unit.faction)} ${this.getClassName(unit.unitClass)}`, 
          { fontSize: '36px', fill: '#00ffff' }).setOrigin(0.5)
      );
      this.previewTexts.push(
        this.add.text(1590, 480, `ATK ${unit.attack}  DEF ${unit.defense}  SPD ${unit.speed}`, 
          { fontSize: '33px', fill: '#ffaa00' }).setOrigin(0.5)
      );
    } else {
      const relicData = this.relicsData.find(r => r.id === id)?.relic;
      if (relicData) {
        this.previewTexts.push(
          this.add.text(1590, 390, relicData.name, { fontSize: '36px', fill: '#ff00ff' }).setOrigin(0.5)
        );
      }
    }
  }

  private showCollectionTooltip(x: number, y: number, unit?: any, relic?: any) {
    if (!this.tooltip) {
      this.tooltip = this.add.text(0, 0, '', {
        fontSize: '24px',
        fill: '#ffffff',
        backgroundColor: '#112233',
        padding: { x: 18, y: 12 },
        align: 'left'
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
    this.scene.start(this.returnToScene, {
      gameContract: this.gameContract,
      nftContract: this.nftContract,
      relicContract: this.relicContract,
      account: this.account,
      publicClient: this.publicClient
    });
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
      'Увеличивает ATK всем юнитам',
      'Увеличивает DEF всем юнитам',
      'Увеличивает SPD всем юнитам',
      'Увеличивает HP всем юнитам',
      'Повышает шанс крита (Quantum Flux)',
      'Последний удар перед смертью (Last Stand)'
    ];
    return desc[relicType] || 'Эффект неизвестен';
  }

  shutdown() {
    this.unitSprites.forEach(s => s.destroy());
    this.relicSprites.forEach(s => s.destroy());
    if (this.tooltip) this.tooltip.destroy();
    console.log('✅ CollectionScene shutdown');
  }
}