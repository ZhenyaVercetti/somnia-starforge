import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { somniaTestnet } from 'viem/chains';

export const config = getDefaultConfig({
  appName: 'Somnia StarForge',
  projectId: '79a5509a7deb1555059b927ba77dbad0', // ← ОБЯЗАТЕЛЬНО замени на свой!
  chains: [somniaTestnet],
  ssr: false,
});
