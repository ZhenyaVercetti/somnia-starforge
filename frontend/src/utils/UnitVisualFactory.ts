// frontend/src/utils/UnitVisualFactory.ts
import * as Phaser from 'phaser';

export class UnitVisualFactory {
  static createUnitWithFrame(
    scene: Phaser.Scene,
    x: number,
    y: number,
    shipKey: string,
    rarity: number,
    slotSize: number
  ): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y);

    const frameKey = rarity === 2 ? 'legendary_frame' : rarity === 1 ? 'rare_frame' : 'common_frame';
    const frame = scene.add.image(0, 0, frameKey)
      .setDisplaySize(slotSize * 0.88, slotSize * 0.88);
    container.add(frame);

    const inner = Math.round(slotSize * 0.56);
    const ship = scene.add.sprite(0, 0, shipKey)
      .setDisplaySize(inner, inner);
    container.add(ship);

    (container as any).shipDisplay = inner;
    return container;
  }
}
