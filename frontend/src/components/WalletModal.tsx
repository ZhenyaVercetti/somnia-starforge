import React, { useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

export const WalletModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { address, isConnected } = useAccount();

  useEffect(() => {
    if (isConnected && address) {
      setTimeout(() => {
        onClose();
        
        const game = (window as any).game;
        if (game && game.scene) {
          game.scene.start('PrepareScene', {
            walletManager: (window as any).walletManager
          });
        }
      }, 600);
    }
  }, [isConnected, address, onClose]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#0f0f23',
        padding: '40px',
        borderRadius: '20px',
        border: '2px solid #00f0ff',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#00ffff', marginBottom: '30px' }}>Подключить кошелёк</h2>
        
        <ConnectButton />
        
        <button 
          onClick={onClose}
          style={{
            marginTop: '30px',
            background: 'transparent',
            color: '#888',
            border: 'none',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Закрыть
        </button>
      </div>
    </div>
  );
};