import '../styles/episode-composer-modal.css';
import '../styles/embed-code-modal.css';

interface EmbedCodeModalProps {
  isOpen: boolean;
  htmlCode: string;
  isHtmlLoading: boolean;
  onClose: () => void;
}

const copyValue = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  window.prompt('Copy embed code:', value);
};

const EmbedCodeModal = ({
  isOpen,
  htmlCode,
  isHtmlLoading,
  onClose,
}: EmbedCodeModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="episode-modal__backdrop" onClick={onClose}>
      <section
        className="episode-modal surface embed-code-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="episode-modal__head">
          <h3>Embed Code</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="embed-code-modal__section">
          <p className="embed-code-modal__label">HTML Embed (&lt;audio&gt;)</p>
          <textarea
            readOnly
            rows={5}
            value={isHtmlLoading ? 'Loading audio URL...' : htmlCode}
          />
          <button
            type="button"
            onClick={() => void copyValue(htmlCode)}
            disabled={isHtmlLoading || htmlCode.length === 0}
          >
            Copy HTML Embed
          </button>
        </div>
      </section>
    </div>
  );
};

export default EmbedCodeModal;
