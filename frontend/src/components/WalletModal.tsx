// @ts-nocheck
import React, { useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, usePublicClient } from 'wagmi';

interface WalletModalProps {
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ onClose }) => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  useEffect(() => {
    if (isConnected && address && publicClient) {
      // Сохраняем account и publicClient в window
      (window as any).account = address;
      (window as any).publicClient = publicClient;
      
      // Закрываем модал через 0.8 сек
      setTimeout(() => {
        onClose();
      }, 800);
    }
  }, [isConnected, address, publicClient, onClose]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(10, 0, 34, 0.95)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 99999
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#1a0033', border: '3px solid #00ffff',
        borderRadius: '20px', padding: '50px 60px', minWidth: '420px',
        textAlign: 'center', boxShadow: '0 0 60px rgba(0, 255, 255, 0.4)'
      }} onClick={e => e.stopPropagation()}>
        
        <h2 style={{ color: '#00ffff', marginBottom: '40px', fontSize: '32px' }}>
          Подключи кошелёк
        </h2>

        <div style={{ marginBottom: '30px' }}>
          <ConnectButton />
        </div>

        <p style={{ color: '#888', fontSize: '14px' }}>
          После подключения модал закроется автоматически
        </p>
      </div>
    </div>
  );
};