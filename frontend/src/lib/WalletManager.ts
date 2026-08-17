import type { Address, PublicClient, WalletClient } from 'viem';

export type WalletSession = {
  account: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
};

declare global {
  interface Window {
    account?: Address;
    publicClient?: PublicClient;
    walletClient?: WalletClient;
    walletManager?: WalletManager;
    openWalletModal?: () => void;
    startGame?: () => void;
    game?: any;
  }
}

class WalletManager {
  private static instance: WalletManager;

  public account: Address | null = null;
  public publicClient: PublicClient | null = null;
  public walletClient: WalletClient | null = null;
  public chainId: number = 50312;

  static getInstance(): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager();
    }
    return WalletManager.instance;
  }

  setSession(session: WalletSession): void {
    this.account = session.account;
    this.publicClient = session.publicClient;
    this.walletClient = session.walletClient;
    const chain = Number(session.walletClient.chain?.id);
    if (Number.isFinite(chain) && chain > 0) {
      this.chainId = chain;
    }
    window.account = session.account;
    window.publicClient = session.publicClient;
    window.walletClient = session.walletClient;
    window.walletManager = this;
  }

  restoreFromWindow(): boolean {
    if (window.account && window.publicClient && window.walletClient) {
      this.account = window.account;
      this.publicClient = window.publicClient;
      this.walletClient = window.walletClient;
      return true;
    }
    return false;
  }

  getPublicClient(): PublicClient | null {
    return this.publicClient ?? window.publicClient ?? null;
  }

  getWalletClient(): WalletClient | null {
    return this.walletClient ?? window.walletClient ?? null;
  }

  disconnect(): void {
    this.account = null;
    this.publicClient = null;
    this.walletClient = null;
    delete window.account;
    delete window.publicClient;
    delete window.walletClient;
  }

  isConnected(): boolean {
    return !!this.account && !!this.getWalletClient();
  }
}

export default WalletManager;
