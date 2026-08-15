// @ts-nocheck
import React, { useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import WalletManager from '../lib/WalletManager';

interface WalletModalProps {
  onConnected: () => void;
  onDismiss: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ onConnected, onDismiss }) => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    if (!isConnected || !address || !publicClient || !walletClient) {
      return;
    }

    WalletManager.getInstance().setSession({
      account: address,
      publicClient,
      walletClient
    });

    const timer = window.setTimeout(() => {
      onConnected();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [isConnected, address, publicClient, walletClient, onConnected]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(2, 4, 10, 0.62)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          backgroundColor: 'rgba(8, 13, 22, 0.96)',
          border: '1px solid rgba(94, 231, 255, 0.45)',
          boxShadow: '0 0 40px rgba(8, 20, 32, 0.8)',
          padding: '42px 48px 36px',
          minWidth: '420px',
          textAlign: 'center'
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            fontFamily: 'Orbitron, Rajdhani, sans-serif',
            color: '#f6e27a',
            fontSize: '22px',
            letterSpacing: '0.08em',
            marginBottom: '10px'
          }}
        >
          STARFORGE
        </div>
        <h2
          style={{
            fontFamily: 'Rajdhani, Arial, sans-serif',
            color: '#e8f4ff',
            margin: '0 0 28px',
            fontSize: '26px',
            fontWeight: 700
          }}
        >
          Connect to enter the hangar
        </h2>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '22px' }}>
          <ConnectButton />
        </div>

        <p
          style={{
            fontFamily: 'Rajdhani, Arial, sans-serif',
            color: '#7f96ad',
            fontSize: '15px',
            margin: 0
          }}
        >
          Somnia Testnet · Chain 50312
        </p>
      </div>
    </div>
  );
};
