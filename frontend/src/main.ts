// frontend/src/main.ts
import * as Phaser from 'phaser';
import { createWalletClient, custom } from 'viem';
import { somniaTestnet } from 'viem/chains';
import { getContract } from 'viem';

const GAME_CONTRACT = '0xEF96B4574ca47815D2D9ae35FD7EBBe90f228847';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#0a0a2a',
  scene: { preload, create, update }
};

new Phaser.Game(config);

let gameContract: any;
let team: number[] = [];
let isWalletReady = false;
let account: `0x${string}` | undefined;
let ownedSprites: Phaser.GameObjects.Sprite[] = [];
let shopSprites: Phaser.GameObjects.Sprite[] = [];

async function preload(this: Phaser.Scene) {
  this.load.image('bg', 'https://via.placeholder.com/1280x720/0a0a2a/112233?text=Somnia+Space');
  this.load.image('ship', 'https://via.placeholder.com/64x64/00ffff/000000?text=SHIP');
}

function create(this: Phaser.Scene) {
  this.add.image(640, 360, 'bg');

  const connectBtn = this.add.text(500, 300, 'ПОДКЛЮЧИТЬ METAMASK', {
    fontSize: '36px',
    fill: '#00ff00',
    backgroundColor: '#112233',
    padding: { x: 20, y: 10 }
  })
    .setInteractive()
    .on('pointerdown', () => initWalletAndButtons(this));

  this.add.text(100, 100, 'Сначала подключи MetaMask', { fontSize: '20px', fill: '#888888' });
}

async function initWalletAndButtons(scene: Phaser.Scene) {
  if (typeof window.ethereum === 'undefined') return alert('Установи MetaMask');

  const walletClient = createWalletClient({ chain: somniaTestnet, transport: custom(window.ethereum) });
  await walletClient.request({ method: 'eth_requestAccounts' });

  const addresses = await walletClient.getAddresses();
  if (addresses.length === 0) return alert('В MetaMask нажми "Подключить"');

  account = addresses[0];

  const abi = [
    { "inputs": [], "name": "buyUnit", "outputs": [], "stateMutability": "payable", "type": "function" },
    { "inputs": [], "name": "rerollShop", "outputs": [], "stateMutability": "payable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "slot", "type": "uint256" }], "name": "buyFromShop", "outputs": [], "stateMutability": "payable", "type": "function" },
    { "inputs": [{ "internalType": "uint256[]", "name": "team", "type": "uint256[]" }], "name": "startMatch", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getPlayerUnits", "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getPlayerShop", "outputs": [{ "internalType": "uint256[5]", "name": "", "type": "uint256[5]" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "unitNFT", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
    { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "player", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "UnitBought", "type": "event" },
    { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "player", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "score", "type": "uint256" }, { "indexed": false, "internalType": "uint256[]", "name": "rewards", "type": "uint256[]" }], "name": "MatchPlayed", "type": "event" },
    { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "player", "type": "address" }], "name": "ShopRerolled", "type": "event" }
  ];

  gameContract = getContract({ address: GAME_CONTRACT, abi, client: { ...walletClient, account } });

  isWalletReady = true;
  console.log('✅ MetaMask подключён:', account);

  scene.children.getAll().forEach(child => {
    if (child instanceof Phaser.GameObjects.Text && child.text.includes('ПОДКЛЮЧИТЬ')) child.destroy();
  });

  addGameUI(scene);
  await Promise.all([loadOwnedUnits(scene), loadPlayerShop(scene)]);
}

async function loadOwnedUnits(scene: Phaser.Scene) {
  if (!account || !gameContract) return;
  ownedSprites.forEach(s => s.destroy());
  ownedSprites = [];

  try {
    const ownedIds: bigint[] = await gameContract.read.getPlayerUnits([account]);
    console.log('📦 Твои юниты:', ownedIds);

    scene.add.text(50, 150, `ТВОИ ЮНИТЫ (${ownedIds.length})`, { fontSize: '18px', fill: '#ffff00' });

    ownedIds.forEach((tokenIdBig, index) => {
      const tokenId = Number(tokenIdBig);
      const sprite = scene.add.sprite(120 + (index % 8) * 70, 200 + Math.floor(index / 8) * 90, 'ship').setInteractive();
      (sprite as any).tokenId = tokenId;
      scene.input.setDraggable(sprite);

      sprite.on('drag', (_: any, dragX: number, dragY: number) => { sprite.x = dragX; sprite.y = dragY; });
      sprite.on('dragend', (pointer: any) => {
        const gridSlots = scene.children.getAll().filter(c => c instanceof Phaser.GameObjects.Rectangle && (c as any).isGridSlot);
        const slotIndex = gridSlots.findIndex((s: any) => Math.abs(s.x - pointer.x) < 45 && Math.abs(s.y - pointer.y) < 45);
        if (slotIndex !== -1 && !team.includes(tokenId)) {
          team.push(tokenId);
          sprite.setPosition(gridSlots[slotIndex].x, gridSlots[slotIndex].y);
          sprite.disableInteractive();
          console.log('✅ Добавлен в команду tokenId:', tokenId);
        } else {
          sprite.x = 120 + (index % 8) * 70;
          sprite.y = 200 + Math.floor(index / 8) * 90;
        }
      });
      ownedSprites.push(sprite);
    });
  } catch (e) { console.error('loadOwnedUnits error', e); }
}

async function loadPlayerShop(scene: Phaser.Scene) {
  if (!account || !gameContract) return;
  shopSprites.forEach(s => s.destroy());
  shopSprites = [];

  try {
    const shopIds: bigint[] = await gameContract.read.getPlayerShop([account]);
    console.log('🛒 Shop:', shopIds);

    scene.add.text(650, 80, 'SHOP (5 слотов)', { fontSize: '22px', fill: '#ff00ff' });

    for (let i = 0; i < 5; i++) {
      const tokenId = Number(shopIds[i]);
      const x = 680 + i * 100;
      const y = 140;

      const slotRect = scene.add.rectangle(x, y, 80, 80, 0x112233).setStrokeStyle(3, 0xff00ff);
      const sprite = scene.add.sprite(x, y, 'ship').setInteractive();
      (sprite as any).shopSlot = i;
      (sprite as any).tokenId = tokenId;

      if (tokenId !== 0) {
        scene.add.text(x - 30, y + 50, `#${tokenId}`, { fontSize: '14px', fill: '#ffff00' });
      } else {
        scene.add.text(x - 20, y + 50, 'EMPTY', { fontSize: '14px', fill: '#666666' });
      }

      const buyBtn = scene.add.text(x - 20, y + 80, 'BUY', { fontSize: '18px', fill: '#00ff00' })
        .setInteractive()
        .on('pointerdown', () => buyFromShopSlot(i, scene));

      shopSprites.push(sprite);
    }
  } catch (e) { console.error('loadPlayerShop error', e); }
}

async function buyFromShopSlot(slot: number, scene: Phaser.Scene) {
  if (!isWalletReady || !gameContract || !account) return alert('Сначала подключи MetaMask');
  try {
    await gameContract.write.buyFromShop([BigInt(slot)], { account, value: 1000000000000000n });
    scene.add.text(400, 300, `Юнит из слота ${slot} куплен!`, { fontSize: '28px', fill: '#00ff00' });
    setTimeout(() => {
      loadPlayerShop(scene);
      loadOwnedUnits(scene);
    }, 2500);
  } catch (e: any) {
    alert(e.shortMessage || e.message);
  }
}

function addGameUI(scene: Phaser.Scene) {
  const gridSlots: Phaser.GameObjects.Rectangle[] = [];
  for (let i = 0; i < 8; i++) {
    const x = 420 + (i % 4) * 90;
    const y = 380 + Math.floor(i / 4) * 90;
    const slot = scene.add.rectangle(x, y, 80, 80, 0x112233).setStrokeStyle(3, 0x00ffff);
    (slot as any).isGridSlot = true;
    gridSlots.push(slot);
  }

  scene.add.text(100, 100, 'BUY (0.001 STT)', { fontSize: '22px', fill: '#00ffff' })
    .setInteractive().on('pointerdown', () => buyUnit(scene));

  scene.add.text(100, 140, 'REROLL SHOP (0.0005 STT)', { fontSize: '22px', fill: '#ff00ff' })
    .setInteractive().on('pointerdown', () => rerollShop(scene));

  scene.add.text(100, 180, 'REFRESH OWNED', { fontSize: '22px', fill: '#ffff00' })
    .setInteractive().on('pointerdown', () => loadOwnedUnits(scene));

  scene.add.text(900, 600, '▶ START BATTLE', { fontSize: '42px', fill: '#ff3333' })
    .setInteractive().on('pointerdown', () => startBattle(scene));
}

async function buyUnit(scene: Phaser.Scene) {
  if (!isWalletReady || !gameContract || !account) return alert('Сначала подключи MetaMask');
  try {
    await gameContract.write.buyUnit([], { account, value: 1000000000000000n });
    scene.add.text(400, 300, 'Юнит куплен on-chain!', { fontSize: '32px', fill: '#00ff00' });
    setTimeout(() => {
      loadOwnedUnits(scene);
      loadPlayerShop(scene);
    }, 3000);
  } catch (e) { alert((e as Error).message); }
}

async function rerollShop(scene: Phaser.Scene) {
  if (!isWalletReady || !gameContract || !account) return alert('Сначала подключи MetaMask');
  try {
    await gameContract.write.rerollShop([], { account, value: 500000000000000n });
    scene.add.text(400, 340, 'Shop rerolled', { fontSize: '28px', fill: '#ffff00' });
    setTimeout(() => loadPlayerShop(scene), 2000);
  } catch (e) { alert((e as Error).message); }
}

async function startBattle(scene: Phaser.Scene) {
  if (!isWalletReady || !gameContract || !account) return alert('Сначала подключи MetaMask');
  if (team.length < 4) return scene.add.text(500, 500, 'Нужно минимум 4 юнита!', { fontSize: '28px', fill: '#ff0000' });

  try {
    const teamBigInt = team.map(id => BigInt(id));
    console.log('📤 Отправляем команду:', teamBigInt);

    const { request } = await gameContract.simulate.startMatch([teamBigInt], { account });
    await gameContract.write.startMatch([teamBigInt], { account, ...request });

    scene.add.text(500, 280, 'TX отправлена on-chain...', { fontSize: '24px', fill: '#ffff00' });
    playVisualBattle(scene);
    team = [];
    setTimeout(() => {
      loadOwnedUnits(scene);
      loadPlayerShop(scene);
    }, 4000);
  } catch (e: any) {
    console.error('❌ startMatch error:', e);
    alert(e.shortMessage || e.message);
  }
}

function playVisualBattle(scene: Phaser.Scene) {
  const cx = 640, cy = 400;
  for (let w = 0; w < 3; w++) {
    setTimeout(() => {
      for (let i = 0; i < 4; i++) {
        const x = 420 + (i % 4) * 90;
        const y = 380 + Math.floor(i / 4) * 90;
        const laser = scene.add.line(0, 0, x, y, cx, cy, 0x00ffff).setLineWidth(3);
        scene.tweens.add({ targets: laser, alpha: 0, duration: 400, onComplete: () => laser.destroy() });
      }
      if (w === 2) {
        const boom = scene.add.circle(cx, cy, 70, 0xffaa00).setAlpha(0.85);
        scene.tweens.add({
          targets: boom, scale: 3, alpha: 0, duration: 700,
          onComplete: () => {
            boom.destroy();
            scene.add.text(480, 280, 'ПОБЕДА! +1 юнит (on-chain)', { fontSize: '36px', fill: '#00ff00' });
          }
        });
      }
    }, w * 650);
  }
}

function update() {}