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
      (window as any).account = address;
      (window as any).publicClient = publicClient;

      setTimeout(() => {
        onClose();
      }, 800);
    }
  }, [isConnected, address, publicClient, onClose]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.08)',   // ← почти прозрачно
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: '140px',
      paddingLeft: '5px',
      zIndex: 99999
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'rgba(26, 0, 51, 0.88)',   // ← чуть прозрачнее
        border: '3px solid #00ffff',
        borderRadius: '20px',
        padding: '50px 60px',
        minWidth: '420px',
        textAlign: 'center',
        boxShadow: '0 0 60px rgba(0, 255, 255, 0.4)'
      }} onClick={e => e.stopPropagation()}>
        
        <h2 style={{ 
          color: '#00ffff', 
          marginBottom: '50px', 
          fontSize: '28px',
          lineHeight: '1.3'
        }}>
          Welcome to the StarForge:<br />The Void!
        </h2>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginBottom: '30px' 
        }}>
          <ConnectButton />
        </div>

        <p style={{ 
          color: '#888', 
          fontSize: '14px',
          marginTop: '10px'
        }}>
          Connect to Somnia Testnet
        </p>
      </div>
    </div>
  );
};