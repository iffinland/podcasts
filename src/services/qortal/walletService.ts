import { requestQortal } from './qortalClient';
import { SendCoinInput, UserAccount, WalletBalance } from '../../types/qortal';

export const getUserAccount = async (): Promise<UserAccount> => {
  return requestQortal<UserAccount>({
    action: 'GET_USER_ACCOUNT',
  });
};

export const getQortBalance = async (): Promise<WalletBalance> => {
  const value = await requestQortal<number>({
    action: 'GET_WALLET_BALANCE',
    coin: 'QORT',
  });

  return {
    coin: 'QORT',
    value,
  };
};

const TRANSFER_STORAGE = 'qpodcasts-pending-transfers-v1';
const transfers = new Map<string, 'pending' | 'unknown'>();
try {
  const saved = sessionStorage.getItem(TRANSFER_STORAGE);
  if (saved)
    for (const key of JSON.parse(saved) as string[])
      transfers.set(key, 'unknown');
} catch {
  /* Memory protection remains available. */
}
const saveTransfers = () => {
  try {
    sessionStorage.setItem(
      TRANSFER_STORAGE,
      JSON.stringify([...transfers.keys()])
    );
  } catch {
    /* Embedded storage may be disabled. */
  }
};
const transferKey = (input: SendCoinInput) =>
  JSON.stringify([
    input.senderKey ?? '',
    input.recipient,
    input.amount,
    input.coin ?? 'QORT',
  ]);
export const acknowledgeUnknownTransfer = (input: SendCoinInput) => {
  const key = transferKey(input);
  if (transfers.get(key) === 'unknown') {
    transfers.delete(key);
    saveTransfers();
  }
};
export const sendQort = async (input: SendCoinInput) => {
  const { recipient, amount, coin = 'QORT' } = input;
  const key = transferKey(input);
  if (transfers.has(key))
    throw new Error(
      'An identical payment is pending or unconfirmed. Check your wallet before preparing another tip.'
    );
  transfers.set(key, 'pending');
  saveTransfers();
  try {
    const result = await requestQortal<unknown>({
      action: 'SEND_COIN',
      coin,
      recipient,
      amount,
    });
    transfers.delete(key);
    saveTransfers();
    return result;
  } catch (error) {
    if (
      error instanceof Error &&
      /declined|denied|user rejected|insufficient|invalid recipient|invalid amount/i.test(
        error.message
      )
    )
      transfers.delete(key);
    else transfers.set(key, 'unknown');
    saveTransfers();
    throw error;
  }
};

interface NameDataResponse {
  owner: string;
  name: string;
}

export const getNameData = async (name: string): Promise<NameDataResponse> => {
  return requestQortal<NameDataResponse>({
    action: 'GET_NAME_DATA',
    name,
  });
};
