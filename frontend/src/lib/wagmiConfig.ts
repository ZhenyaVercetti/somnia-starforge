import { createConfig, http } from 'wagmi';
import { defineChain } from 'viem';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  rainbowWallet,
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
} from '@rainbow-me/rainbowkit/wallets';

// Определяем Somnia Testnet
export const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Somnia Test Token',
    symbol: 'STT',
  },
  rpcUrls: {
    default: {
      http: ['https://dream-rpc.somnia.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Somnia Explorer',
      url: 'https://shannon-explorer.somnia.network',
    },
  },
  testnet: true,
});

const projectId = '79a5509a7deb1555059b927ba77dbad0'; // Замени на свой

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Рекомендуемые',
      wallets: [
        rainbowWallet,
        metaMaskWallet,
        walletConnectWallet,
        coinbaseWallet,
      ],
    },
  ],
  {
    appName: 'Somnia StarForge',
    projectId,
  }
);

export const config = createConfig({
  chains: [somniaTestnet],
  connectors,
  transports: {
    [somniaTestnet.id]: http(),
  },
  ssr: false,
});