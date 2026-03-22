export interface ContributorData {
  address: string;
  githubHandle: string;
  totalEarned: string;
  totalPayouts: number;
  reputationScore: number;
  lastPaidAt: number;
}

export interface PayoutRecord {
  contributor: string;
  amount: number;
  score: number;
  txHash: string;
  timestamp: number;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on?: (event: string, handler: (...args: any[]) => void) => void;
      removeListener?: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}
