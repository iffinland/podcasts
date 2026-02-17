import { FormEvent, useState } from 'react';
import { useWalletActions } from '../hooks/useWalletActions';
import '../styles/wallet-panel.css';

interface WalletPanelProps {
  activeName: string | null;
  compact?: boolean;
}

const WalletPanel = ({ activeName, compact = false }: WalletPanelProps) => {
  const { account, balance, isLoading, error, loadAccountAndBalance, sendCoin } = useWalletActions();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('0.1');

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(amount);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    await sendCoin(recipient, parsed);
    setRecipient('');
  };

  return (
    <div className={`wallet-panel ${compact ? 'wallet-panel--compact' : ''}`}>
      <div className="wallet-panel__header">
        <h3>Wallet & Support</h3>
        <button type="button" onClick={() => void loadAccountAndBalance()} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <p>
        Active publisher: <strong>{activeName ?? '-'}</strong>
      </p>
      <p>
        Account name: <strong>{account?.name ?? '-'}</strong>
      </p>
      <p>
        Address: <strong>{account?.address ?? '-'}</strong>
      </p>
      <p>
        Balance: <strong>{balance ? `${balance.value} ${balance.coin}` : '-'}</strong>
      </p>

      <form className="wallet-panel__form" onSubmit={(event) => void handleSend(event)}>
        <label>
          Recipient address
          <input
            type="text"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="Q..."
            required
            disabled={isLoading}
          />
        </label>

        <label>
          Amount (QORT)
          <input
            type="number"
            min="0"
            step="0.00000001"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            disabled={isLoading}
          />
        </label>

        <button type="submit" disabled={isLoading}>
          Send coin
        </button>
      </form>

      {error ? <p className="wallet-panel__error">{error}</p> : null}
    </div>
  );
};

export default WalletPanel;
