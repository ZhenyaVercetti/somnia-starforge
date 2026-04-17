// frontend/src/main.ts
import * as Phaser from 'phaser';
import { createPublicClient, http } from 'viem';
import { somniaTestnet } from 'viem/chains';
import { getContract } from 'viem';

const GAME_CONTRACT = '0xB7d3C65052C2FF34CDcafBe4Ce3338E0940f86f5';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#0a0a2a',
  scene: { preload, create, update }
};

new Phaser.Game(config);

let gameContract: any;
let shopText: Phaser.GameObjects.Text;

async function preload(this: Phaser.Scene) {
  this.load.image('bg', 'https://via.placeholder.com/1280x720/0a0a2a/112233?text=Somnia+Space');
}

async function create(this: Phaser.Scene) {
  this.add.image(640, 360, 'bg');

  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http('https://dream-rpc.somnia.network')
  });

  // ← ВСТАВЬ СЮДА ПОЛНЫЙ ABI ИЗ REMIX (StarForgeGame)
  const abi = [ 
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "name",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "faction",
				"type": "string"
			},
			{
				"internalType": "uint8",
				"name": "rarity",
				"type": "uint8"
			},
			{
				"internalType": "uint8",
				"name": "atk",
				"type": "uint8"
			},
			{
				"internalType": "uint8",
				"name": "def",
				"type": "uint8"
			},
			{
				"internalType": "uint8",
				"name": "spd",
				"type": "uint8"
			}
		],
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
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"name": "OwnableInvalidOwner",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "OwnableUnauthorizedAccount",
		"type": "error"
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
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "previousOwner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "OwnershipTransferred",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "renounceOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
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
		"inputs": [
			{
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
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
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "profiles",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "level",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "xp",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "REROLL_COST",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "SHOP_COST",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
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
    client: publicClient  // пока обычный вызов, gasless добавим позже
  });

  shopText = this.add.text(100, 100, 'Shop: нажми BUY (0.001 STT)', { fontSize: '24px', fill: '#00ffff' })
    .setInteractive()
    .on('pointerdown', () => buyUnit(this));

  this.add.text(100, 160, 'Reroll (0.0005 STT)', { fontSize: '24px', fill: '#ff00ff' })
    .setInteractive()
    .on('pointerdown', () => rerollShop(this));

  this.add.text(600, 600, '▶ START MATCH', { fontSize: '48px', fill: '#ff00ff' })
    .setInteractive()
    .on('pointerdown', () => startMatch(this));
}

function update() {}

async function buyUnit(scene: Phaser.Scene) {
  try {
    // Пока используем publicClient (потом заменим на walletClient)
    console.log('Buy unit called');
    scene.add.text(300, 200, 'Юнит куплен! (тест)', { fontSize: '32px', fill: '#00ff00' });
  } catch (e) { console.error(e); }
}

async function rerollShop(scene: Phaser.Scene) {
  try {
    console.log('Reroll called');
    scene.add.text(300, 250, 'Shop rerolled (тест)', { fontSize: '32px', fill: '#ffff00' });
  } catch (e) { console.error(e); }
}

async function startMatch(scene: Phaser.Scene) {
  const team = [1, 2, 3, 4];
  try {
    console.log('Start match called');
    scene.add.text(600, 300, 'Матч запущен on-chain! (тест)', { fontSize: '32px', fill: '#00ffff' });
  } catch (e) { console.error(e); }
}