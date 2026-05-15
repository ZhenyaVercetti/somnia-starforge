import { 
  createPublicClient, 
  createWalletClient, 
  custom, 
  http, 
  formatEther, 
  type Address 
} from 'viem';

const SOMNIA_TESTNET = {
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'SOM', symbol: 'SOM', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://dream-rpc.somnia.network'] },
  },
} as const;

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: any[]) => void) => void;
      removeListener?: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

class WalletManager {
  private static instance: WalletManager;
  public account: Address | null = null;
  public chainId: number | null = null;
  private walletClient: ReturnType<typeof createWalletClient> | null = null;
  public publicClient = createPublicClient({
    chain: SOMNIA_TESTNET,
    transport: http('https://dream-rpc.somnia.network'),
  });

  static getInstance(): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager();
    }
    return WalletManager.instance;
  }

  async connect(): Promise<Address> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask не найден. Установи расширение.');
    }

    this.walletClient = createWalletClient({
      chain: SOMNIA_TESTNET,
      transport: custom(window.ethereum),
    });

    const addresses = await this.walletClient.requestAddresses();
    this.account = addresses[0] as Address;
    this.chainId = await this.walletClient.getChainId();

    if (this.chainId !== 50312) {
      await this.switchChain();
    }

    // Подписываемся на смену аккаунта
    if (window.ethereum?.on) {
      window.ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this));
    }

    return this.account;
  }

  private handleAccountsChanged(accounts: string[]) {
    if (accounts.length === 0) {
      this.disconnect();
    } else {
      this.account = accounts[0] as Address;
    }
  }

  private async switchChain(): Promise<void> {
    if (!this.walletClient) return;

    try {
      await this.walletClient.switchChain({ id: 50312 });
      this.chainId = 50312;
    } catch (error: any) {
      if (error.code === 4902) {
        await this.walletClient.addChain({ chain: SOMNIA_TESTNET });
        await this.walletClient.switchChain({ id: 50312 });
        this.chainId = 50312;
      } else {
        throw error;
      }
    }
  }

  async getBalance(): Promise<string> {
    if (!this.account) return '0';
    const balance = await this.publicClient.getBalance({ address: this.account });
    return formatEther(balance);
  }

  getWalletClient() {
    return this.walletClient;
  }

  disconnect(): void {
    this.account = null;
    this.chainId = null;
    this.walletClient = null;
  }

  isConnected(): boolean {
    return !!this.account;
  }
}

export default WalletManager;