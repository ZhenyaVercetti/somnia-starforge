import * as Phaser from 'phaser';

type LinkedImage = Phaser.GameObjects.Image & {
  linkedText?: Phaser.GameObjects.Text;
};

type LinkedText = Phaser.GameObjects.Text & {
  originalFill?: string;
};

export function addButtonEffects(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.GameObject,
  scale = 1.08
): void {
  const img = obj as LinkedImage;
  const originalWidth = img.displayWidth;
  const originalHeight = img.displayHeight;
  const hoverWidth = originalWidth * scale;
  const hoverHeight = originalHeight * scale;

  obj.on('pointerover', () => {
    scene.tweens.add({
      targets: img,
      displayWidth: hoverWidth,
      displayHeight: hoverHeight,
      duration: 120,
      ease: 'Sine.easeOut'
    });
    const text = img.linkedText;
    if (text) {
      text.setFill('#ffff88');
    }
  });

  obj.on('pointerout', () => {
    scene.tweens.add({
      targets: img,
      displayWidth: originalWidth,
      displayHeight: originalHeight,
      duration: 120,
      ease: 'Sine.easeOut'
    });
    const text = img.linkedText as LinkedText | undefined;
    if (text) {
      text.setFill(text.originalFill || '#ffffff');
    }
  });

  obj.on('pointerdown', () => {
    scene.tweens.add({
      targets: img,
      displayWidth: originalWidth * 0.95,
      displayHeight: originalHeight * 0.95,
      duration: 60
    });
  });

  obj.on('pointerup', () => {
    scene.tweens.add({
      targets: img,
      displayWidth: hoverWidth,
      displayHeight: hoverHeight,
      duration: 80
    });
  });
}
