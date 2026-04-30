// @ts-nocheck
// // frontend/src/main.ts
import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import PrepareScene from './scenes/PrepareScene';
import BattleScene from './scenes/BattleScene';
import CollectionScene from './scenes/CollectionScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  parent: 'game',
  backgroundColor: '#0a0022',
  scene: [BootScene, PrepareScene, BattleScene, CollectionScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);