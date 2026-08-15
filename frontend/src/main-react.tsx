// @ts-nocheck
import React from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from './lib/wagmiConfig';
import { WalletModal } from './components/WalletModal';
import WalletManager from './lib/WalletManager';

import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

let root: ReactDOM.Root | null = null;

function unmountModal() {
  if (!root) {
    return;
  }
  root.unmount();
  root = null;
}

export function openWalletModal() {
  const container = document.getElementById('react-root');
  if (!container) {
    return;
  }

  if (!root) {
    root = ReactDOM.createRoot(container);
  }

  root.render(
    <React.StrictMode>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <WalletModal
              onConnected={() => {
                unmountModal();
                startGame();
              }}
              onDismiss={() => {
                unmountModal();
              }}
            />
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </React.StrictMode>
  );
}

export function startGame() {
  const walletManager = WalletManager.getInstance();
  if (!walletManager.restoreFromWindow() && !walletManager.isConnected()) {
    console.warn('startGame blocked: wallet is not connected');
    return;
  }

  window.setTimeout(() => {
    const game = window.game;
    if (!game?.scene) {
      return;
    }

    if (game.scene.isActive('BootScene') || game.scene.isSleeping('BootScene')) {
      game.scene.stop('BootScene');
    }

    game.scene.start('PrepareScene', {
      account: walletManager.account,
      publicClient: walletManager.getPublicClient(),
      walletClient: walletManager.getWalletClient(),
      walletManager
    });
  }, 200);
}

window.openWalletModal = openWalletModal;
window.startGame = startGame;
