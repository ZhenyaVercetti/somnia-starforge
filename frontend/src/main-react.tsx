import React from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from './lib/wagmiConfig';
import { WalletModal } from './components/WalletModal';

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
            <WalletModal onClose={() => {
              if (root) {
                root.unmount();
                root = null;
              }
            }} />
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </React.StrictMode>
  );
}

// Делаем функцию глобальной, чтобы Phaser мог её вызывать
(window as any).openWalletModal = openWalletModal;