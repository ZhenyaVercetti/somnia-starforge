// frontend/src/utils/UnitVisualFactory.ts
import * as Phaser from 'phaser';

export class UnitVisualFactory {

  /**
   * Создаёт контейнер с юнитом + фреймом редкости (статичный, полная яркость)
   */
  static createUnitWithFrame(
    scene: Phaser.Scene,
    x: number,
    y: number,
    shipKey: string,
    rarity: number,
    scale: number = 1
  ): Phaser.GameObjects.Container {

    const container = scene.add.container(x, y);

    // === ФРЕЙМ (для всех редкостей, полная яркость) ===
    if (rarity === 2) {
      // Legendary - золотой
      const frame = scene.add.image(0, 0, 'legendary_frame')
        .setScale(scale * 1.28);
      container.add(frame);

    } else if (rarity === 1) {
      // Rare - зелёный
      const frame = scene.add.image(0, 0, 'rare_frame')
        .setScale(scale * 1.22);
      container.add(frame);

    } else {
      // Common - синий
      const frame = scene.add.image(0, 0, 'common_frame')
        .setScale(scale * 1.18);
      container.add(frame);
    }

    // === Сам корабль ===
    const ship = scene.add.sprite(0, 0, shipKey)
      .setScale(scale);

    container.add(ship);

    return container;
  }
}