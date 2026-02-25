import { PodcastEpisode } from '../../../types/podcast';
import { requestQortal } from '../../../services/qortal/qortalClient';
import { useGlobalPlayback } from '../context/GlobalPlaybackContext';
import EpisodeQuickActions from './EpisodeQuickActions';
import { renderQortalLinkedTextWithOptions } from '../utils/qortalDescription';
import EpisodeThumbnail from './EpisodeThumbnail';
import '../styles/episode-composer-modal.css';
import '../styles/episode-details-modal.css';
import '../styles/episode-quick-actions.css';

interface EpisodeDetailsModalProps {
  isOpen: boolean;
  episode: PodcastEpisode | null;
  thumbnailUrl: string | null;
  isLiked?: boolean;
  disableEngagement?: boolean;
  disableAll?: boolean;
  onLike?: (episode: PodcastEpisode) => Promise<void> | void;
  onTip?: (episode: PodcastEpisode) => void;
  onShare?: (episode: PodcastEpisode) => Promise<boolean>;
  onEmbed?: (episode: PodcastEpisode) => void;
  onAddToPlaylist?: (episode: PodcastEpisode) => void;
  onDownload?: (episode: PodcastEpisode) => void;
  onClose: () => void;
}

const formatTimestamp = (value: number): string => {
  if (!value) {
    return 'Unknown';
  }
  return new Date(value).toLocaleString();
};

const EpisodeDetailsModal = ({
  isOpen,
  episode,
  thumbnailUrl,
  isLiked = false,
  disableEngagement = false,
  disableAll = false,
  onLike = () => {},
  onTip = () => {},
  onShare = async () => false,
  onEmbed = () => {},
  onAddToPlaylist = () => {},
  onDownload = () => {},
  onClose,
}: EpisodeDetailsModalProps) => {
  const { playEpisode, isCurrentEpisode, isPlayerOpen } = useGlobalPlayback();

  if (!isOpen || !episode) {
    return null;
  }

  return (
    <div className="episode-modal__backdrop" onClick={onClose}>
      <section
        className="episode-modal surface episode-details-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="episode-modal__head">
          <h3>Episode details</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="episode-details-modal__layout">
          <EpisodeThumbnail
            src={thumbnailUrl}
            alt={`${episode.title} thumbnail`}
            size="lg"
          />
          <div className="episode-details-modal__content">
            <div className="episode-details-modal__hero-text">
              <h4>{episode.title}</h4>
              <p>@{episode.ownerName}</p>
              <small>Created: {formatTimestamp(episode.createdAt)}</small>
              <small>Updated: {formatTimestamp(episode.updatedAt)}</small>
              <EpisodeQuickActions
                isPlaying={isPlayerOpen && isCurrentEpisode(episode)}
                isLiked={isLiked}
                showDetailsButton={false}
                onPlay={() => void playEpisode(episode)}
                onDetails={() => {}}
                onLike={() => void onLike(episode)}
                onTip={() => onTip(episode)}
                onShare={() => onShare(episode)}
                onEmbed={() => onEmbed(episode)}
                onAddToPlaylist={() => onAddToPlaylist(episode)}
                onDownload={() => onDownload(episode)}
                disableEngagement={disableEngagement}
                disableAll={disableAll}
              />
            </div>

            <div className="episode-details-modal__section">
              <h4>Description</h4>
              <p>
                {episode.description
                  ? renderQortalLinkedTextWithOptions(episode.description, {
                      openInNewTab: false,
                      onLinkClick: (link, event) => {
                        event.preventDefault();
                        void requestQortal<unknown>({
                          action: 'OPEN_NEW_TAB',
                          qortalLink: link,
                        });
                      },
                    })
                  : 'No description provided.'}
              </p>
            </div>

            <div className="episode-details-modal__section">
              <h4>Tags</h4>
              <p>{episode.tags.join(', ') || 'No tags'}</p>
            </div>

            <div className="episode-details-modal__section">
              <h4>Categories</h4>
              <p>{episode.categories.join(', ') || 'No categories'}</p>
            </div>

            <div className="episode-details-modal__section">
              <h4>Identifiers</h4>
              <p>Episode ID: {episode.episodeId}</p>
              <p>Metadata: {episode.metadataIdentifier}</p>
            </div>

            <div className="episode-details-modal__section">
              <h4>Media</h4>
              <p>Audio file: {episode.audio.filename}</p>
              <p>Audio identifier: {episode.audio.identifier}</p>
              <p>Thumbnail: {episode.thumbnail?.filename ?? 'No thumbnail'}</p>
              {episode.thumbnail ? (
                <p>Thumbnail identifier: {episode.thumbnail.identifier}</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EpisodeDetailsModal;
