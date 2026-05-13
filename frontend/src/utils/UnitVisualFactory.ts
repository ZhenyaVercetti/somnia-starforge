// frontend/src/utils/UnitVisualFactory.ts
import * as Phaser from 'phaser';

export class UnitVisualFactory {

  /**
   * Создаёт контейнер с юнитом + фреймом редкости (статичный, приглушённый)
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

    // === ФРЕЙМ (только Rare и Legendary) — крупный + приглушённый ===
    if (rarity === 2) {
      // Legendary - золотой, большой, прозрачный
      const frame = scene.add.image(0, 0, 'legendary_frame')
        .setScale(scale * 1.28)
        .setAlpha(0.38);
      container.add(frame);

    } else if (rarity === 1) {
      // Rare - зелёный, большой, прозрачный
      const frame = scene.add.image(0, 0, 'rare_frame')
        .setScale(scale * 1.32)
        .setAlpha(0.30);
      container.add(frame);
    }

    // === Сам корабль ===
    const ship = scene.add.sprite(0, 0, shipKey)
      .setScale(scale);

    container.add(ship);

    return container;
  }
}