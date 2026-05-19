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
  console.log('✅ openWalletModal вызвана'); // ← отладка

  const container = document.getElementById('react-root');
  if (!container) {
    console.error('❌ Контейнер #react-root не найден!');
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
            <WalletModal onClose={() => {
              console.log('✅ Модал закрыт');
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

(window as any).openWalletModal = openWalletModal;
console.log('✅ main-react.tsx загружен');