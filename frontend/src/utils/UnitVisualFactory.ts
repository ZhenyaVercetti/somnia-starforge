// frontend/src/utils/UnitVisualFactory.ts
import * as Phaser from 'phaser';

export class UnitVisualFactory {

  /**
   * Создаёт контейнер с юнитом + фреймом редкости (если нужно)
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

    // === ФРЕЙМ (только Rare и Legendary) ===
    if (rarity === 2) {
      // Legendary - золотой
      const frame = scene.add.image(0, 0, 'legendary_frame')
        .setScale(scale * 1.15);
      container.add(frame);

      // Пульсация золотого фрейма
      scene.tweens.add({
        targets: frame,
        scale: scale * 1.20,
        duration: 1450,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

    } else if (rarity === 1) {
      // Rare - зелёный
      const frame = scene.add.image(0, 0, 'rare_frame')
        .setScale(scale * 1.12);
      container.add(frame);

      // Пульсация зелёного фрейма
      scene.tweens.add({
        targets: frame,
        scale: scale * 1.16,
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    // === Сам корабль ===
    const ship = scene.add.sprite(0, 0, shipKey)
      .setScale(scale);

    container.add(ship);

    return container;
  }
}