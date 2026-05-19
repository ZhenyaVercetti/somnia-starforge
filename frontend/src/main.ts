// @ts-nocheck
// frontend/src/main.ts
import './main-react';
import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import WalletSelectScene from './scenes/WalletSelectScene';
import PrepareScene from './scenes/PrepareScene';
import BattleScene from './scenes/BattleScene';
import CollectionScene from './scenes/CollectionScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  parent: 'game',
  backgroundColor: '#0a0022',
  scene: [BootScene, WalletSelectScene, PrepareScene, BattleScene, CollectionScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);
(window as any).game = game;