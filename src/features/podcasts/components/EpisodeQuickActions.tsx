import '../styles/episode-quick-actions.css';

interface EpisodeQuickActionsProps {
  isPlaying: boolean;
  isLiked: boolean;
  onPlay: () => void;
  onLike: () => void;
  onTip: () => void;
  onShare: () => void;
  onEmbed: () => void;
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
  onLike,
  onTip,
  onShare,
  onEmbed,
  onDownload,
  onEdit,
  onDelete,
  disableEngagement = false,
  disableAll = false,
}: EpisodeQuickActionsProps) => {
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
      <button type="button" onClick={onShare} disabled={disableAll} title="Share link">
        🔗
      </button>
      <button type="button" onClick={onEmbed} disabled={disableAll} title="Embed code">
        {'</>'}
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
