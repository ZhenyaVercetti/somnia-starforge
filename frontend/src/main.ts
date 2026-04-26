// @ts-nocheck
// // frontend/src/main.ts
import * as Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import PrepareScene from './scenes/PrepareScene';
import BattleScene from './scenes/BattleScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#0a0a2a',
  scene: [BootScene, PrepareScene, BattleScene]
};

new Phaser.Game(config);