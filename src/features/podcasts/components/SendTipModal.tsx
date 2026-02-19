import { FormEvent, useMemo, useState } from 'react';
import { getNameData, sendQort } from '../../../services/qortal/walletService';
import '../styles/send-tip-modal.css';

interface SendTipModalProps {
  isOpen: boolean;
  publisherName: string | null;
  onSent: (amount: number) => Promise<void> | void;
  onClose: () => void;
}

const SendTipModal = ({
  isOpen,
  publisherName,
  onSent,
  onClose,
}: SendTipModalProps) => {
  const [amount, setAmount] = useState('0.1');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const parsed = Number(amount);
    return (
      Boolean(publisherName) &&
      Number.isFinite(parsed) &&
      parsed > 0 &&
      !isSending
    );
  }, [amount, isSending, publisherName]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!publisherName) {
      return;
    }

    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      const nameData = await getNameData(publisherName);
      await sendQort({
        recipient: nameData.owner,
        amount: parsed,
        coin: 'QORT',
      });
      await onSent(parsed);
      setSuccess(`Tip sent to ${publisherName}`);
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : 'Failed to send tip.';
      setError(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="episode-modal__backdrop" onClick={onClose}>
      <section
        className="episode-modal surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="episode-modal__head">
          <h3>Send Tips</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <form
          className="episode-modal__form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <label>
            Publisher
            <input type="text" value={publisherName ?? ''} readOnly />
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
              disabled={isSending}
            />
          </label>

          <button type="submit" disabled={!canSubmit}>
            {isSending ? 'Sending...' : 'Send tip'}
          </button>
        </form>

        {error ? <p className="send-tip__error">{error}</p> : null}
        {success ? <p className="send-tip__success">{success}</p> : null}
      </section>
    </div>
  );
};

export default SendTipModal;
