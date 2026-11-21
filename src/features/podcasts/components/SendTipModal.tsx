import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  acknowledgeUnknownTransfer,
  getNameData,
  getQortBalance,
  sendQort,
} from '../../../services/qortal/walletService';
import '../styles/send-tip-modal.css';

interface SendTipModalProps {
  isOpen: boolean;
  publisherName: string | null;
  senderKey?: string;
  onSent: (amount: number) => Promise<void> | void;
  onClose: () => void;
}

const SendTipModal = ({
  isOpen,
  publisherName,
  senderKey,
  onSent,
  onClose,
}: SendTipModalProps) => {
  const sending = useRef(false);
  const attemptedTransfer = useRef<{
    recipient: string;
    amount: number;
    senderKey?: string;
  } | null>(null);
  const [paymentLocked, setPaymentLocked] = useState(false);
  const [feedbackWarning, setFeedbackWarning] = useState<string | null>(null);
  const [amount, setAmount] = useState('0');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const loadBalance = async () => {
    setIsBalanceLoading(true);
    setBalanceError(null);
    try {
      const nextBalance = await getQortBalance();
      setBalance(nextBalance.value);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load wallet balance.';
      setBalanceError(message);
    } finally {
      setIsBalanceLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadBalance();
  }, [isOpen]);

  const canSubmit = useMemo(() => {
    const parsed = Number(amount);
    return (
      Boolean(publisherName) &&
      Number.isFinite(parsed) &&
      parsed > 0 &&
      !isSending &&
      !paymentLocked
    );
  }, [amount, isSending, publisherName, paymentLocked]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!publisherName || sending.current || paymentLocked) {
      return;
    }

    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    sending.current = true;
    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      const nameData = await getNameData(publisherName);
      attemptedTransfer.current = {
        recipient: nameData.owner,
        amount: parsed,
        senderKey,
      };
      setPaymentLocked(true);
      await sendQort({
        senderKey,
        recipient: nameData.owner,
        amount: parsed,
        coin: 'QORT',
      });
      setSuccess(`Tip sent to ${publisherName}`);
      void Promise.resolve()
        .then(() => onSent(parsed))
        .catch(() =>
          setFeedbackWarning(
            'Payment was sent. Its statistics could not be updated; do not send the payment again.'
          )
        );
      void loadBalance();
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : 'Failed to send tip.';
      setError(
        paymentLocked
          ? message
          : `${message} Check your wallet before repeating a payment.`
      );
    } finally {
      sending.current = false;
      setIsSending(false);
    }
  };

  return (
    <div
      className="episode-modal__backdrop"
      onClick={() => {
        if (!sending.current) onClose();
      }}
    >
      <section
        className="episode-modal surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="episode-modal__head">
          <h3>Send Tips</h3>
          <button
            type="button"
            onClick={() => {
              if (!sending.current) onClose();
            }}
          >
            Close
          </button>
        </div>

        <form
          className="episode-modal__form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="send-tip__wallet-bar">
            <strong>
              Wallet balance:{' '}
              {balance !== null
                ? `${balance} QORT`
                : isBalanceLoading
                  ? 'Loading...'
                  : '-'}
            </strong>
            <button
              type="button"
              onClick={() => void loadBalance()}
              disabled={isBalanceLoading || isSending}
            >
              {isBalanceLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          {balanceError ? (
            <p className="send-tip__error">{balanceError}</p>
          ) : null}

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
        {error && paymentLocked && (
          <button
            type="button"
            onClick={() => {
              if (
                attemptedTransfer.current &&
                window.confirm(
                  'Only continue if you checked your wallet and this payment was not sent. Prepare a new tip?'
                )
              ) {
                acknowledgeUnknownTransfer(attemptedTransfer.current);
                setPaymentLocked(false);
                setError(null);
                setAmount('0');
              }
            }}
          >
            I checked my wallet; prepare a new tip
          </button>
        )}
        {feedbackWarning && <p role="status">{feedbackWarning}</p>}
        {success && (
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
              setError(null);
              setFeedbackWarning(null);
              setPaymentLocked(false);
              setAmount('0');
            }}
          >
            Prepare a new tip
          </button>
        )}
        {success ? <p className="send-tip__success">{success}</p> : null}
      </section>
    </div>
  );
};

export default SendTipModal;
