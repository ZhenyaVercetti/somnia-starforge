// @ts-nocheck

import React from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from './lib/wagmiConfig';
import { WalletModal } from './components/WalletModal';

import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

let root: ReactDOM.Root | null = null;

export function openWalletModal() {
  const container = document.getElementById('react-root');
  if (!container) return;

  if (!root) {
    root = ReactDOM.createRoot(container);
  }

  root.render(
    <React.StrictMode>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <WalletModal 
              onClose={() => {
                if (root) {
                  root.unmount();
                  root = null;
                }
                if ((window as any).startGame) {
                  (window as any).startGame();
                }
              }} 
            />
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </React.StrictMode>
  );
}

export function startGame() {
  setTimeout(() => {
    const game = (window as any).game;
    if (game && game.scene) {
      // Сохраняем account и publicClient глобально
      const account = (window as any).account;
      const publicClient = (window as any).publicClient;
      
      game.scene.start('PrepareScene', {
        account: account || null,
        publicClient: publicClient || null
      });
    }
  }, 200);
}

(window as any).openWalletModal = openWalletModal;
(window as any).startGame = startGame;