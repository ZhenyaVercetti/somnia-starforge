export const gameAbi = [
  {
    inputs: [],
    name: 'buyUnit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'buyUnitPrice',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'rerollShop',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'rerollPrice',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: 'slot', type: 'uint256' }],
    name: 'buyFromShop',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'buyRelicShopPrice',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    type: 'event',
    name: 'BattleResolved',
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'battleId', type: 'bytes32' },
      { indexed: true, internalType: 'address', name: 'player', type: 'address' },
      { indexed: false, internalType: 'bool', name: 'playerWon', type: 'bool' },
      { indexed: false, internalType: 'uint16[]', name: 'playerMaxHp', type: 'uint16[]' },
      { indexed: false, internalType: 'uint16[]', name: 'aiMaxHp', type: 'uint16[]' }
    ]
  },
  {
    type: 'event',
    name: 'BattleEventEmitted',
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'battleId', type: 'bytes32' },
      { indexed: false, internalType: 'uint8', name: 'round', type: 'uint8' },
      { indexed: false, internalType: 'bool', name: 'isPlayerSide', type: 'bool' },
      { indexed: false, internalType: 'uint8', name: 'attackerIndex', type: 'uint8' },
      { indexed: false, internalType: 'uint8', name: 'targetIndex', type: 'uint8' },
      { indexed: false, internalType: 'uint16', name: 'damage', type: 'uint16' },
      { indexed: false, internalType: 'uint16', name: 'remainingHp', type: 'uint16' },
      { indexed: false, internalType: 'uint8', name: 'specialEffect', type: 'uint8' }
    ]
  },
  {
    inputs: [
      { internalType: 'uint256[]', name: 'team', type: 'uint256[]' },
      { internalType: 'uint256[]', name: 'equipped', type: 'uint256[]' }
    ],
    name: 'startMatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'player', type: 'address' }],
    name: 'getCurrentAI',
    outputs: [{
      components: [
        { internalType: 'bool', name: 'isRelic', type: 'bool' },
        { internalType: 'uint256', name: 'id', type: 'uint256' },
        { internalType: 'uint8', name: 'faction', type: 'uint8' },
        { internalType: 'uint8', name: 'rarity', type: 'uint8' },
        { internalType: 'uint8', name: 'unitClass', type: 'uint8' },
        { internalType: 'uint8', name: 'attack', type: 'uint8' },
        { internalType: 'uint8', name: 'defense', type: 'uint8' },
        { internalType: 'uint8', name: 'speed', type: 'uint8' },
        { internalType: 'uint8', name: 'relicType', type: 'uint8' },
        { internalType: 'uint8', name: 'relicValue', type: 'uint8' }
      ],
      internalType: 'struct StarForgeGame.ShopItem[8]',
      name: '',
      type: 'tuple[8]'
    }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256[3]', name: 'relics', type: 'uint256[3]' }],
    name: 'equipRelics',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'player', type: 'address' }],
    name: 'getEquippedRelics',
    outputs: [{ internalType: 'uint256[3]', name: '', type: 'uint256[3]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'player', type: 'address' }],
    name: 'getLastBattleSummary',
    outputs: [{
      components: [
        { internalType: 'bool', name: 'playerWon', type: 'bool' },
        { internalType: 'uint16[]', name: 'playerFinalHp', type: 'uint16[]' },
        { internalType: 'uint16[]', name: 'aiFinalHp', type: 'uint16[]' },
        { internalType: 'bytes32', name: 'battleId', type: 'bytes32' },
        { internalType: 'uint64', name: 'timestamp', type: 'uint64' }
      ],
      internalType: 'struct StarForgeGame.BattleSummary',
      name: '',
      type: 'tuple'
    }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'generateTenShips',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'player', type: 'address' }],
    name: 'getPlayerUnits',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'player', type: 'address' }],
    name: 'getPlayerRelics',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'player', type: 'address' }],
    name: 'getPlayerShop',
    outputs: [{
      components: [
        { internalType: 'bool', name: 'isRelic', type: 'bool' },
        { internalType: 'uint256', name: 'id', type: 'uint256' },
        { internalType: 'uint8', name: 'faction', type: 'uint8' },
        { internalType: 'uint8', name: 'rarity', type: 'uint8' },
        { internalType: 'uint8', name: 'unitClass', type: 'uint8' },
        { internalType: 'uint8', name: 'attack', type: 'uint8' },
        { internalType: 'uint8', name: 'defense', type: 'uint8' },
        { internalType: 'uint8', name: 'speed', type: 'uint8' },
        { internalType: 'uint8', name: 'relicType', type: 'uint8' },
        { internalType: 'uint8', name: 'relicValue', type: 'uint8' }
      ],
      internalType: 'struct StarForgeGame.ShopItem[3]',
      name: '',
      type: 'tuple[3]'
    }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'player', type: 'address' }],
    name: 'getRemainingBuys',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'player', type: 'address' }],
    name: 'canReroll',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'player', type: 'address' }],
    name: 'pendingLevelUpShips',
    outputs: [{ internalType: 'uint16', name: '', type: 'uint16' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'claimLevelUpShips',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

export const nftAbi = [
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'getUnit',
    outputs: [{
      components: [
        { internalType: 'uint8', name: 'faction', type: 'uint8' },
        { internalType: 'uint8', name: 'rarity', type: 'uint8' },
        { internalType: 'uint8', name: 'unitClass', type: 'uint8' },
        { internalType: 'uint8', name: 'attack', type: 'uint8' },
        { internalType: 'uint8', name: 'defense', type: 'uint8' },
        { internalType: 'uint8', name: 'speed', type: 'uint8' }
      ],
      internalType: 'struct StarForgeUnitNFT.Unit',
      name: '',
      type: 'tuple'
    }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

export const relicAbi = [
  {
    inputs: [{ internalType: 'uint256', name: 'id', type: 'uint256' }],
    name: 'getRelic',
    outputs: [{
      components: [
        { internalType: 'uint8', name: 'relicType', type: 'uint8' },
        { internalType: 'uint8', name: 'value', type: 'uint8' },
        { internalType: 'string', name: 'name', type: 'string' }
      ],
      internalType: 'struct StarForgeRelic.RelicData',
      name: '',
      type: 'tuple'
    }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

export const profileAbi = [
  {
    inputs: [{ internalType: 'address', name: 'player', type: 'address' }],
    name: 'getProfile',
    outputs: [{
      components: [
        { internalType: 'uint16', name: 'level', type: 'uint16' },
        { internalType: 'uint32', name: 'xp', type: 'uint32' },
        { internalType: 'uint256', name: 'wins', type: 'uint256' },
        { internalType: 'uint256', name: 'losses', type: 'uint256' },
        { internalType: 'uint16', name: 'currentAITier', type: 'uint16' }
      ],
      internalType: 'struct StarForgePlayerProfile.PlayerProfile',
      name: '',
      type: 'tuple'
    }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;
