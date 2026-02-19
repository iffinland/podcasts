import { useCallback, useEffect, useState } from 'react';
import {
  getQortBalance,
  getUserAccount,
  sendQort,
} from '../../../services/qortal/walletService';
import { UserAccount, WalletBalance } from '../../../types/qortal';

export const useWalletActions = () => {
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccountAndBalance = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [nextAccount, nextBalance] = await Promise.all([
        getUserAccount(),
        getQortBalance(),
      ]);
      setAccount(nextAccount);
      setBalance(nextBalance);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load wallet data.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccountAndBalance();
  }, [loadAccountAndBalance]);

  const sendCoin = useCallback(async (recipient: string, amount: number) => {
    setIsLoading(true);
    setError(null);

    try {
      await sendQort({ recipient, amount, coin: 'QORT' });
      const refreshed = await getQortBalance();
      setBalance(refreshed);
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : 'Failed to send QORT.';
      setError(message);
      throw sendError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    account,
    balance,
    isLoading,
    error,
    loadAccountAndBalance,
    sendCoin,
  };
};
