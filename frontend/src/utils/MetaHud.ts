import * as Phaser from 'phaser';
import { HUD, displayText, hudText, plateWell } from './HudChrome';
import { gameAudio } from '../lib/gameAudio';
import {
  ACHIEVEMENTS,
  type AchievementDef,
  getUnlocked
} from '../lib/achievements';
import {
  TUTORIAL_STEPS,
  type TutorialStep,
  completeTutorial,
  currentTutorialStep,
  isTutorialDone,
  nextTutorialStep,
  resetTutorial,
  setTutorialIndex
} from '../lib/tutorial';

const DEPTH = 980;

export function attachAudioUnlock(scene: Phaser.Scene): void {
  scene.input.on('pointerdown', () => gameAudio.unlock());
}

export function addMetaButtons(
  scene: Phaser.Scene,
  opts: {
    account?: string | null;
    onHelp: () => void;
    onMedals: () => void;
    y?: number;
  }
): void {
  const y = opts.y ?? 48;
  const items: Array<{ x: number; label: () => string; click: () => void }> = [
    {
      x: 1568,
      label: () => (gameAudio.isMuted() ? 'SOUND OFF' : 'SOUND ON'),
      click: () => {
        gameAudio.unlock();
        gameAudio.toggleMute();
      }
    },
    { x: 1704, label: () => 'HELP', click: opts.onHelp },
    { x: 1840, label: () => 'MEDALS', click: opts.onMedals }
  ];

  items.forEach((item) => {
    const base = scene.add.image(item.x, y, 'button_base')
      .setDisplaySize(124, 46)
      .setInteractive({ useHandCursor: true })
      .setDepth(40)
      .setScrollFactor(0);
    const text = scene.add.text(item.x, y, item.label(), hudText({
      fontSize: '16px',
      fill: HUD.color.text
    })).setOrigin(0.5).setDepth(41).setScrollFactor(0);
    (base as any).linkedText = text;
    base.on('pointerdown', () => {
      gameAudio.click();
      item.click();
      text.setText(item.label());
    });
    base.on('pointerover', () => {
      gameAudio.hover();
      text.setColor(HUD.color.gold);
    });
    base.on('pointerout', () => text.setColor(HUD.color.text));
  });
}

export function showAchievementToasts(scene: Phaser.Scene, unlocked: AchievementDef[]): void {
  if (unlocked.length === 0) {
    return;
  }
  if (unlocked.length > 2) {
    gameAudio.unlockJingle();
    const plate = scene.add.rectangle(960, 86, 640, 64, 0x080d16, 0.94)
      .setStrokeStyle(1, 0xf6e27a, 0.55)
      .setDepth(DEPTH + 8)
      .setScrollFactor(0);
    const title = scene.add.text(960, 86, `${unlocked.length} MEDALS UNLOCKED  ·  open MEDALS`, displayText({
      fontSize: '18px',
      fill: HUD.color.gold
    })).setOrigin(0.5).setDepth(DEPTH + 9).setScrollFactor(0);
    scene.time.delayedCall(2400, () => {
      plate.destroy();
      title.destroy();
    });
    return;
  }
  gameAudio.unlockJingle();
  unlocked.forEach((item, index) => {
    scene.time.delayedCall(index * 900, () => {
      const plate = scene.add.rectangle(960, 86, 620, 64, 0x080d16, 0.94)
        .setStrokeStyle(1, 0xf6e27a, 0.55)
        .setDepth(DEPTH + 8)
        .setScrollFactor(0)
        .setAlpha(0);
      const title = scene.add.text(960, 74, `MEDAL  ·  ${item.title}`, displayText({
        fontSize: '18px',
        fill: HUD.color.gold
      })).setOrigin(0.5).setDepth(DEPTH + 9).setScrollFactor(0).setAlpha(0);
      const hint = scene.add.text(960, 98, item.hint, hudText({
        fontSize: '15px',
        fill: HUD.color.text
      })).setOrigin(0.5).setDepth(DEPTH + 9).setScrollFactor(0).setAlpha(0);
      scene.tweens.add({ targets: [plate, title, hint], alpha: 1, duration: 180 });
      scene.time.delayedCall(2200, () => {
        scene.tweens.add({
          targets: [plate, title, hint],
          alpha: 0,
          duration: 240,
          onComplete: () => {
            plate.destroy();
            title.destroy();
            hint.destroy();
          }
        });
      });
    });
  });
}

export function showAchievementPanel(scene: Phaser.Scene, account: string): void {
  const unlocked = new Set(getUnlocked(account));
  const plateW = 1080;
  const plateH = 860;
  const well = plateWell(960, 540, plateW, plateH, { left: 19, right: 19, top: 10, bottom: 10 });
  const cols = 2;
  const rowsN = Math.ceil(ACHIEVEMENTS.length / cols);
  const gapX = 14;
  const gapY = 6;
  const headerH = 44;
  const closeH = 52;
  const gridTop = well.top + headerH;
  const gridBot = well.bottom - closeH - 8;
  const cardW = (well.width - gapX) / cols;
  const cardH = (gridBot - gridTop - (rowsN - 1) * gapY) / rowsN;
  const gridLeft = well.left;

  const veil = scene.add.rectangle(960, 540, 1920, 1080, 0x050010, 0.62)
    .setDepth(DEPTH)
    .setScrollFactor(0)
    .setInteractive();
  const plate = scene.add.image(960, 540, 'ui_plate')
    .setDisplaySize(plateW, plateH)
    .setAlpha(0.97)
    .setDepth(DEPTH + 1)
    .setScrollFactor(0);
  const title = scene.add.text(960, well.top + 8, `MEDALS   ${unlocked.size} / ${ACHIEVEMENTS.length}`, displayText({
    fontSize: '24px',
    fill: HUD.color.gold
  })).setOrigin(0.5, 0).setDepth(DEPTH + 2).setScrollFactor(0);

  const rows: Phaser.GameObjects.GameObject[] = [veil, plate, title];
  ACHIEVEMENTS.forEach((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = gridLeft + cardW / 2 + col * (cardW + gapX);
    const y = gridTop + cardH / 2 + row * (cardH + gapY);
    const on = unlocked.has(item.id);
    const card = scene.add.rectangle(x, y, cardW, cardH, 0x0c1420, on ? 0.9 : 0.52)
      .setStrokeStyle(1, on ? 0xf6e27a : 0x1f3a4d, on ? 0.7 : 0.4)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0);
    const name = scene.add.text(x, y - 11, on ? item.title : '????', hudText({
      fontSize: '16px',
      fill: on ? HUD.color.gold : HUD.color.muted
    })).setOrigin(0.5).setDepth(DEPTH + 3).setScrollFactor(0);
    const hint = scene.add.text(x, y + 12, item.hint, hudText({
      fontSize: '13px',
      fill: on ? HUD.color.text : HUD.color.muted,
      align: 'center',
      wordWrap: { width: cardW - 20 }
    })).setOrigin(0.5).setDepth(DEPTH + 3).setScrollFactor(0);
    rows.push(card, name, hint);
  });

  const closeY = well.bottom - closeH / 2;
  const close = scene.add.image(960, closeY, 'button_base')
    .setDisplaySize(200, 48)
    .setInteractive({ useHandCursor: true })
    .setDepth(DEPTH + 3)
    .setScrollFactor(0);
  const closeText = scene.add.text(960, closeY, 'CLOSE', hudText({
    fontSize: '18px',
    fill: HUD.color.text
  })).setOrigin(0.5).setDepth(DEPTH + 4).setScrollFactor(0);
  rows.push(close, closeText);

  const destroy = () => {
    gameAudio.click();
    rows.forEach((obj) => obj.destroy());
  };
  close.on('pointerdown', destroy);
  veil.on('pointerdown', destroy);
}

export function showTutorialCard(
  scene: Phaser.Scene,
  account: string,
  step: TutorialStep,
  onChange?: (next: TutorialStep | null) => void
): void {
  clearTutorialCard(scene);
  const layer = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
  (scene as any).__tutorialLayer = layer;

  if (step.focus) {
    const { x, y, w, h } = step.focus;
    const left = Math.max(0, x - w / 2);
    const right = Math.min(1920, x + w / 2);
    const top = Math.max(0, y - h / 2);
    const bottom = Math.min(1080, y + h / 2);
    const dim = 0x050010;
    const shade = (rx: number, ry: number, rw: number, rh: number) => {
      if (rw < 2 || rh < 2) {
        return null;
      }
      return scene.add.rectangle(rx, ry, rw, rh, dim, 0.5)
        .setOrigin(0, 0)
        .setScrollFactor(0);
    };
    const boxes = [
      shade(0, 0, 1920, top),
      shade(0, bottom, 1920, 1080 - bottom),
      shade(0, top, left, bottom - top),
      shade(right, top, 1920 - right, bottom - top)
    ].filter(Boolean) as Phaser.GameObjects.Rectangle[];
    const ring = scene.add.rectangle(x, y, w, h)
      .setStrokeStyle(2, 0x5ee7ff, 0.9)
      .setFillStyle(0x000000, 0)
      .setScrollFactor(0);
    layer.add([...boxes, ring]);
  }

  const collection = scene.scene.key === 'CollectionScene';
  const cx = collection ? 480 : 960;
  const plateW = collection ? 720 : 860;
  const wrapW = collection ? 620 : 760;
  let cardY = 780;
  if (step.focus && step.focus.y > 700) {
    cardY = 220;
  }
  if (collection) {
    cardY = step.focus && step.focus.y > 780 ? 220 : 820;
  }
  const nextX = cx + 140;
  const skipX = cx - 140;
  const plate = scene.add.image(cx, cardY, 'ui_plate')
    .setDisplaySize(plateW, 168)
    .setAlpha(0.96)
    .setScrollFactor(0);
  const heading = scene.add.text(cx, cardY - 48, step.title, displayText({
    fontSize: '24px',
    fill: HUD.color.gold
  })).setOrigin(0.5).setScrollFactor(0);
  const body = scene.add.text(cx, cardY - 4, step.body, hudText({
    fontSize: '18px',
    fill: HUD.color.text,
    align: 'center',
    wordWrap: { width: wrapW }
  })).setOrigin(0.5).setScrollFactor(0);

  const nextBtn = scene.add.image(nextX, cardY + 52, 'button_base')
    .setDisplaySize(180, 46)
    .setInteractive({ useHandCursor: true })
    .setScrollFactor(0);
  const nextText = scene.add.text(nextX, cardY + 52, 'NEXT', hudText({
    fontSize: '18px',
    fill: HUD.color.accent
  })).setOrigin(0.5).setScrollFactor(0);
  const skipBtn = scene.add.image(skipX, cardY + 52, 'button_base')
    .setDisplaySize(180, 46)
    .setInteractive({ useHandCursor: true })
    .setScrollFactor(0);
  const skipText = scene.add.text(skipX, cardY + 52, 'SKIP', hudText({
    fontSize: '18px',
    fill: HUD.color.muted
  })).setOrigin(0.5).setScrollFactor(0);

  layer.add([plate, heading, body, nextBtn, nextText, skipBtn, skipText]);

  nextBtn.on('pointerdown', () => {
    gameAudio.click();
    const next = nextTutorialStep(account);
    clearTutorialCard(scene);
    onChange?.(next);
  });
  skipBtn.on('pointerdown', () => {
    gameAudio.click();
    completeTutorial(account);
    clearTutorialCard(scene);
    onChange?.(null);
  });
}

export function clearTutorialCard(scene: Phaser.Scene): void {
  const layer = (scene as any).__tutorialLayer as Phaser.GameObjects.Container | undefined;
  layer?.destroy(true);
  (scene as any).__tutorialLayer = null;
}

export function beginOrResumeTutorial(
  scene: Phaser.Scene,
  account: string,
  sceneKey: TutorialStep['scene'],
  force = false
): void {
  if (force) {
    resetTutorial(account);
  } else if (isTutorialDone(account)) {
    return;
  }
  const step = currentTutorialStep(account);
  if (!step) {
    return;
  }
  presentStep(scene, account, step, sceneKey);
}

function presentStep(
  scene: Phaser.Scene,
  account: string,
  step: TutorialStep,
  sceneKey: TutorialStep['scene']
): void {
  if (step.scene !== sceneKey) {
    return;
  }
  showTutorialCard(scene, account, step, (next) => {
    if (!next) {
      return;
    }
    if (next.scene === sceneKey) {
      presentStep(scene, account, next, sceneKey);
      return;
    }
    // Leave the pointer on this step so the next scene can pick it up.
    const index = TUTORIAL_STEPS.findIndex((item) => item.id === next.id);
    if (index >= 0) {
      setTutorialIndex(account, index);
    }
  });
}
