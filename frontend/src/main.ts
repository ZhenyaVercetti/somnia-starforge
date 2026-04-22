// frontend/src/main.ts
import * as Phaser from 'phaser';
import { createWalletClient, custom } from 'viem';
import { somniaTestnet } from 'viem/chains';
import { getContract } from 'viem';

const GAME_CONTRACT = '0x2C98C6597CA8274D764344c27025694559109c91';

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
  if (typeof window.ethereum === 'undefined') {
    return alert('Установи MetaMask');
  }

  const walletClient = createWalletClient({
    chain: somniaTestnet,
    transport: custom(window.ethereum)
  });

  // ← ЭТА СТРОКА ЗАСТАВЛЯЕТ METAMASK ПОКАЗАТЬ ПОПАП
  await walletClient.request({ method: 'eth_requestAccounts' });

  const addresses = await walletClient.getAddresses();
  if (addresses.length === 0) {
    return alert('В MetaMask нажми "Подключить"');
  }

account = addresses[0];

  const abi = [
	{
		"inputs": [],
		"name": "buyUnit",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_unitNFT",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "player",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "score",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256[]",
				"name": "rewards",
				"type": "uint256[]"
			}
		],
		"name": "MatchPlayed",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "rerollShop",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256[]",
				"name": "team",
				"type": "uint256[]"
			}
		],
		"name": "startMatch",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "player",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "UnitBought",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "unitNFT",
		"outputs": [
			{
				"internalType": "contract StarForgeUnitNFT",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

  gameContract = getContract({
    address: GAME_CONTRACT,
    abi,
    client: { ...walletClient, account }
  });

  isWalletReady = true;
  console.log('MetaMask подключён:', account);

  // Убираем кнопку подключения
  scene.children.getAll().forEach(child => {
    if (child instanceof Phaser.GameObjects.Text && child.text.includes('ПОДКЛЮЧИТЬ')) {
      child.destroy();
    }
  });

  addGameUI(scene);
}

function addGameUI(scene: Phaser.Scene) {
  // GRID 4x2
  const gridSlots: Phaser.GameObjects.Rectangle[] = [];
  for (let i = 0; i < 8; i++) {
    const x = 420 + (i % 4) * 90;
    const y = 380 + Math.floor(i / 4) * 90;
    gridSlots.push(scene.add.rectangle(x, y, 80, 80, 0x112233).setStrokeStyle(3, 0x00ffff));
  }

  // OWNED UNITS (drag)
  for (let i = 0; i < 6; i++) {
    const sprite = scene.add.sprite(120 + i * 70, 200, 'ship').setInteractive();
    (sprite as any).tokenId = i + 1;
    scene.input.setDraggable(sprite);

    sprite.on('drag', (_: any, dragX: number, dragY: number) => { sprite.x = dragX; sprite.y = dragY; });

    sprite.on('dragend', (pointer: any) => {
      const slotIndex = gridSlots.findIndex(s => Math.abs(s.x - pointer.x) < 45 && Math.abs(s.y - pointer.y) < 45);
      if (slotIndex !== -1 && !team.includes((sprite as any).tokenId)) {
        team.push((sprite as any).tokenId);
        sprite.setPosition(gridSlots[slotIndex].x, gridSlots[slotIndex].y);
        sprite.disableInteractive();
      } else {
        sprite.x = 120 + i * 70;
        sprite.y = 200;
      }
    });
  }

  // BUTTONS
  scene.add.text(100, 100, 'BUY (0.001 STT)', { fontSize: '22px', fill: '#00ffff' })
    .setInteractive().on('pointerdown', () => buyUnit(scene));

  scene.add.text(100, 140, 'REROLL (0.0005 STT)', { fontSize: '22px', fill: '#ff00ff' })
    .setInteractive().on('pointerdown', () => rerollShop(scene));

  scene.add.text(900, 600, '▶ START BATTLE', { fontSize: '42px', fill: '#ff3333' })
    .setInteractive().on('pointerdown', () => startBattle(scene));
}

async function buyUnit(scene: Phaser.Scene) {
  if (!isWalletReady || !gameContract || !account) {
    return alert('Сначала подключи MetaMask');
  }
  try {
    await gameContract.write.buyUnit([], { account, value: 1000000000000000n });
    scene.add.text(400, 300, 'Юнит куплен on-chain!', { fontSize: '32px', fill: '#00ff00' });
  } catch (e) { alert((e as Error).message); }
}

async function rerollShop(scene: Phaser.Scene) {
  if (!isWalletReady || !gameContract || !account) {
    return alert('Сначала подключи MetaMask');
  }
  try {
    await gameContract.write.rerollShop([], { account, value: 500000000000000n });
    scene.add.text(400, 340, 'Shop rerolled', { fontSize: '28px', fill: '#ffff00' });
  } catch (e) { alert((e as Error).message); }
}

async function startBattle(scene: Phaser.Scene) {
  if (!isWalletReady || !gameContract || !account) {
    return alert('Сначала подключи MetaMask');
  }
  if (team.length < 4) {
    return scene.add.text(500, 500, 'Нужно минимум 4 юнита!', { fontSize: '28px', fill: '#ff0000' });
  }

  try {
await gameContract.write.startMatch([[1n, 2n, 3n, 4n]], { account });
    scene.add.text(500, 280, 'TX отправлена on-chain...', { fontSize: '24px', fill: '#ffff00' });
    playVisualBattle(scene);
  } catch (e) { alert((e as Error).message); }
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
            scene.add.text(480, 280, 'ПОБЕДА! +2 юнита (on-chain)', { fontSize: '36px', fill: '#00ff00' });
          }
        });
      }
    }, w * 650);
  }
}

function update() {}