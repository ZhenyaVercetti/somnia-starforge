// Shared HUD metrics for 1920x1080 scenes.
// Keep every interactive chrome on this rhythm so scenes do not drift.

export const HUD = {
  width: 1920,
  height: 1080,
  safe: 48,
  gap: 16,
  btnSm: { w: 240, h: 48, font: '20px' },
  btnMd: { w: 320, h: 52, font: '22px' },
  btnLg: { w: 360, h: 72, font: '28px' },
  color: {
    text: '#e8f6ff',
    accent: '#5ee7ff',
    good: '#5dffb0',
    warn: '#ffe566',
    bad: '#ff6b7d',
    muted: '#8aa0b8'
  }
};

export function attachHudButton(
  base: Phaser.GameObjects.Image,
  label: Phaser.GameObjects.Text,
  width: number,
  height: number
): void {
  base.setDisplaySize(width, height);
  base.setInteractive({ useHandCursor: true });
  (base as any).linkedText = label;

  base.on('pointerover', () => {
    base.setScale(base.scaleX * 1.04, base.scaleY * 1.04);
    label.setScale(1.04);
  });
  base.on('pointerout', () => {
    const sx = width / (base.width || width);
    const sy = height / (base.height || height);
    base.setScale(sx, sy);
    label.setScale(1);
  });
}
