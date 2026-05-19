// @ts-nocheck
import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface WalletModalProps {
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ onClose }) => {
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

        <p style={{ color: '#888', fontSize: '14px', marginTop: '20px' }}>
          После подключения ты автоматически попадёшь в игру
        </p>
      </div>
    </div>
  );
};