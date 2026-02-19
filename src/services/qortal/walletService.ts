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

export const sendQort = async ({
  recipient,
  amount,
  coin = 'QORT',
}: SendCoinInput) => {
  return requestQortal<unknown>({
    action: 'SEND_COIN',
    coin,
    recipient,
    amount,
  });
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
