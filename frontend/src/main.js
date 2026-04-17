// frontend/src/main.js
import Phaser from 'phaser';
import { Sequence } from '@0xsequence/sequence';
import { SomniaForge } from '@somniaforge/sdk';
import { createPublicClient, http } from 'viem';
import { somniaTestnet } from 'viem/chains';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#0a0a2a',
  scene: { preload, create, update }
};

new Phaser.Game(config);

let forge;
let wallet;

async function preload() {
  this.load.image('background', 'https://via.placeholder.com/1280x720/0a0a2a/00ffff?text=Space+Background'); // заменишь на свои
}

async function create() {
  // Подключение Somnia
  forge = new SomniaForge({ chainId: 50312 });
  wallet = await Sequence.initWallet('somnia-testnet');

  this.add.text(100, 100, 'Somnia StarForge — Auto-Battler', { fontSize: '32px', fill: '#00ffff' });

  // Пример кнопки "Start Match"
  const btn = this.add.text(500, 300, '▶ START MATCH', { fontSize: '48px', fill: '#ff00ff' })
    .setInteractive()
    .on('pointerdown', () => startMatchOnChain(this));
}

function update() {}

async function startMatchOnChain(scene) {
  // Здесь dev позже подключит wagmi + вызов startMatch
  console.log('Вызываем on-chain матч...');
  // Пример: await gameContract.write.startMatch([tokenId1, tokenId2...])
}
