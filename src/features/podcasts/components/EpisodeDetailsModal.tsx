import { PodcastEpisode } from '../../../types/podcast';
import { useGlobalPlayback } from '../context/GlobalPlaybackContext';
import EpisodeThumbnail from './EpisodeThumbnail';
import '../styles/episode-composer-modal.css';
import '../styles/episode-details-modal.css';

interface EpisodeDetailsModalProps {
  isOpen: boolean;
  episode: PodcastEpisode | null;
  thumbnailUrl: string | null;
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
  onClose,
}: EpisodeDetailsModalProps) => {
  const { playEpisode, isCurrentEpisode, isPlaying, isPlayerOpen } =
    useGlobalPlayback();

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

        <div className="episode-details-modal__hero">
          <EpisodeThumbnail
            src={thumbnailUrl}
            alt={`${episode.title} thumbnail`}
            size="lg"
          />
          <div className="episode-details-modal__hero-text">
            <h4>{episode.title}</h4>
            <p>@{episode.ownerName}</p>
            <small>Created: {formatTimestamp(episode.createdAt)}</small>
            <small>Updated: {formatTimestamp(episode.updatedAt)}</small>
            <button
              type="button"
              className="episode-details-modal__play"
              onClick={() => void playEpisode(episode)}
            >
              {isPlayerOpen && isCurrentEpisode(episode)
                ? isPlaying
                  ? '● Playing'
                  : '● Paused'
                : 'Play'}
            </button>
          </div>
        </div>

        <div className="episode-details-modal__section">
          <h4>Description</h4>
          <p>{episode.description || 'No description provided.'}</p>
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
      </section>
    </div>
  );
};

export default EpisodeDetailsModal;
