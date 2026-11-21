export interface UserAccount {
  address: string;
  publicKey?: string;
  name?: string;
}

export interface WalletBalance {
  coin: 'QORT';
  value: number;
}

export interface SendCoinInput {
  senderKey?: string;
  recipient: string;
  amount: number;
  coin?: 'QORT';
}
