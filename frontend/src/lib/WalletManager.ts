// frontend/src/lib/WalletManager.ts
import { createPublicClient, http, formatEther, type Address } from 'viem';
import { somniaTestnet } from 'viem/chains';

class WalletManager {
  private static instance: WalletManager;
  
  public account: Address | null = null;
  public chainId: number = 50312;

  private publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http('https://dream-rpc.somnia.network'),
  });

  static getInstance(): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager();
    }
    return WalletManager.instance;
  }

  async connect(): Promise<Address> {
    // Здесь будет реальное подключение через RainbowKit
    // Пока заглушка, чтобы не падало
    if (!this.account) {
      this.account = '0x0000000000000000000000000000000000000001'; // временно
    }
    return this.account;
  }

  async getBalance(): Promise<string> {
    if (!this.account) return '0';
    const balance = await this.publicClient.getBalance({ address: this.account });
    return formatEther(balance);
  }

  getPublicClient() {
    return this.publicClient;
  }

  disconnect(): void {
    this.account = null;
  }

  isConnected(): boolean {
    return !!this.account;
  }
}

export default WalletManager;