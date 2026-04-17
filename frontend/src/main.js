// frontend/src/main.js
import Phaser from 'phaser';
import { Sequence } from '@0xsequence/sequence';
import { SomniaForge } from '@somniaforge/sdk';
import { createWalletClient, http } from 'viem';
import { somniaTestnet } from 'viem/chains';
import { getContract } from 'viem';

const GAME_CONTRACT = '0xB7d3C65052C2FF34CDcafBe4Ce3338E0940f86f5';
const UNIT_NFT = '0x9739fC5b63e6d63206fD0E9364B6D6c8B05F75dE';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#0a0a2a',
  scene: { preload, create, update }
};

new Phaser.Game(config);

let forge, walletClient, gameContract, unitNFTContract;
let shopText, teamGrid = [];

async function preload() {
  this.load.image('bg', 'https://via.placeholder.com/1280x720/0a0a2a/112233?text=Somnia+Space');
}

async function create() {
  this.add.image(640, 360, 'bg');

  // Подключение wallet (gasless Sequence)
  walletClient = await Sequence.initWallet('somnia-testnet');

  // SomniaForge для real-time
  forge = new SomniaForge({ chainId: 50312 });

  // Клиент viem
  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http('https://dream-rpc.somnia.network')
  });

  gameContract = getContract({
    address: GAME_CONTRACT,
    abi: [ /* вставь ABI из Remix → Compile → ABI copy */ ],
    client: walletClient
  });

  // Shop UI
  shopText = this.add.text(100, 100, 'Shop: нажми BUY (0.001 STT)', { fontSize: '24px', fill: '#00ffff' })
    .setInteractive()
    .on('pointerdown', () => buyUnit(this));

  this.add.text(100, 160, 'Reroll (0.0005 STT)', { fontSize: '24px', fill: '#ff00ff' })
    .setInteractive()
    .on('pointerdown', () => rerollShop(this));

  // Grid для команды (4x2 для MVP)
  for (let i = 0; i < 8; i++) {
    const slot = this.add.rectangle(400 + (i % 4) * 80, 400 + Math.floor(i / 4) * 80, 70, 70, 0x112233)
      .setStrokeStyle(4, 0x00ffff);
    teamGrid.push(slot);
  }

  this.add.text(600, 600, '▶ START MATCH', { fontSize: '48px', fill: '#ff00ff' })
    .setInteractive()
    .on('pointerdown', () => startMatch(this));
}

function update() {}

async function buyUnit(scene) {
  try {
    await gameContract.write.buyUnit(['Fighter X-1', 'Empire', 1, 6, 4, 5], { value: 1000000000000000n }); // 0.001 STT
    scene.add.text(300, 200, 'Юнит куплен!', { fontSize: '32px', fill: '#00ff00' });
  } catch (e) { console.error(e); }
}

async function rerollShop(scene) {
  try {
    await gameContract.write.rerollShop([], { value: 500000000000000n }); // 0.0005 STT
    scene.add.text(300, 250, 'Shop rerolled', { fontSize: '32px', fill: '#ffff00' });
  } catch (e) { console.error(e); }
}

async function startMatch(scene) {
  // Пример: передаём первые 4 токена (в реале берём из профайла)
  const team = [1, 2, 3, 4]; // заменишь на реальные tokenId
  try {
    await gameContract.write.startMatch([team]);
    scene.add.text(600, 300, 'Матч запущен on-chain!', { fontSize: '32px', fill: '#00ffff' });
  } catch (e) { console.error(e); }
}
