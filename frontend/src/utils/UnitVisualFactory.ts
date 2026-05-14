// frontend/src/utils/UnitVisualFactory.ts
import * as Phaser from 'phaser';

export class UnitVisualFactory {

  /**
   * Создаёт контейнер с юнитом + фреймом редкости
   * @param scale — базовый масштаб (влияет на рамку)
   * @param shipScaleMultiplier — множитель размера корабля относительно рамки (по умолчанию 1.0)
   */
  static createUnitWithFrame(
    scene: Phaser.Scene,
    x: number,
    y: number,
    shipKey: string,
    rarity: number,
    scale: number = 1,
    shipScaleMultiplier: number = 1
  ): Phaser.GameObjects.Container {

    const container = scene.add.container(x, y);

    // === ФРЕЙМ (размер рамки) ===
    if (rarity === 2) {
      const frame = scene.add.image(0, 0, 'legendary_frame')
        .setScale(scale * 1.24);
      container.add(frame);
    } else if (rarity === 1) {
      const frame = scene.add.image(0, 0, 'rare_frame')
        .setScale(scale * 1.24);
      container.add(frame);
    } else {
      const frame = scene.add.image(0, 0, 'common_frame')
        .setScale(scale * 1.20);
      container.add(frame);
    }

    // === КОРАБЛЬ (отдельный масштаб) ===
    const ship = scene.add.sprite(0, 0, shipKey)
      .setScale(scale * shipScaleMultiplier);

    container.add(ship);

    return container;
  }
}