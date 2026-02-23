import { useEffect, useRef, useState } from 'react';
import '../styles/episode-quick-actions.css';

interface EpisodeQuickActionsProps {
  isPlaying: boolean;
  isLiked: boolean;
  onPlay: () => void;
  onDetails: () => void;
  onLike: () => void;
  onTip: () => void;
  onShare: () => Promise<boolean>;
  onEmbed: () => void;
  onAddToPlaylist: () => void;
  onDownload: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  disableEngagement?: boolean;
  disableAll?: boolean;
}

const EpisodeQuickActions = ({
  isPlaying,
  isLiked,
  onPlay,
  onDetails,
  onLike,
  onTip,
  onShare,
  onEmbed,
  onAddToPlaylist,
  onDownload,
  onEdit,
  onDelete,
  disableEngagement = false,
  disableAll = false,
}: EpisodeQuickActionsProps) => {
  const [shareFeedback, setShareFeedback] = useState<
    'copied' | 'manual' | null
  >(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  const handleShareClick = async () => {
    const isCopied = await onShare();
    setShareFeedback(isCopied ? 'copied' : 'manual');

    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }

    feedbackTimeoutRef.current = window.setTimeout(() => {
      setShareFeedback(null);
      feedbackTimeoutRef.current = null;
    }, 1800);
  };

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="episode-quick-actions">
      <button
        type="button"
        className={isPlaying ? 'is-active' : ''}
        onClick={onPlay}
        disabled={disableAll}
        title="Play"
      >
        ▶
      </button>
      <button type="button" onClick={onDetails} disabled={disableAll} title="View details">
        🔍
      </button>
      <button
        type="button"
        className={isLiked ? 'is-active' : ''}
        onClick={onLike}
        disabled={disableAll || disableEngagement}
        title="Like"
      >
        ♥
      </button>
      <button
        type="button"
        onClick={onTip}
        disabled={disableAll || disableEngagement}
        title="Send tip"
      >
        💸
      </button>
      <div className="episode-quick-actions__share-wrap">
        <button
          type="button"
          onClick={() => void handleShareClick()}
          disabled={disableAll}
          title="Share link"
        >
          🔗
        </button>
        {shareFeedback ? (
          <span className="episode-quick-actions__share-feedback" role="status">
            {shareFeedback === 'copied' ? 'Link copied' : 'Press Ctrl/Cmd+C'}
          </span>
        ) : null}
      </div>
      <button type="button" onClick={onEmbed} disabled={disableAll} title="Embed code">
        {'</>'}
      </button>
      <button
        type="button"
        onClick={onAddToPlaylist}
        disabled={disableAll}
        title="Add to playlist"
      >
        🗂
      </button>
      <button type="button" onClick={onDownload} disabled={disableAll} title="Download">
        ⬇
      </button>
      {onEdit ? (
        <button type="button" onClick={onEdit} disabled={disableAll} title="Edit">
          ✏
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          className="episode-quick-actions__danger"
          onClick={onDelete}
          disabled={disableAll}
          title="Delete"
        >
          🗑
        </button>
      ) : null}
    </div>
  );
};

export default EpisodeQuickActions;
