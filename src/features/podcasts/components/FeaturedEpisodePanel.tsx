import { useEffect, useRef } from 'react';
import { PodcastEpisode } from '../../../types/podcast';
import EpisodeThumbnail from './EpisodeThumbnail';
import '../styles/episode-thumbnail.css';

interface FeaturedEpisodePanelProps {
  episode: PodcastEpisode | null;
  audioUrl: string | null;
  thumbnailUrl: string | null;
  autoPlaySignal: number;
  liked: boolean;
  likeCount: number;
  tipCount: number;
  onToggleLike: (episode: PodcastEpisode) => void;
  onSendTip: (episode: PodcastEpisode) => void;
  onShareEpisode: (episode: PodcastEpisode) => void;
  onEmbedEpisode: (episode: PodcastEpisode) => void;
  onShowDetails: (episode: PodcastEpisode) => void;
}

const FeaturedEpisodePanel = ({
  episode,
  audioUrl,
  thumbnailUrl,
  autoPlaySignal,
  liked,
  likeCount,
  tipCount,
  onToggleLike,
  onSendTip,
  onShareEpisode,
  onEmbedEpisode,
  onShowDetails,
}: FeaturedEpisodePanelProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastHandledAutoPlaySignalRef = useRef(autoPlaySignal);

  useEffect(() => {
    const shouldAutoPlay =
      autoPlaySignal > lastHandledAutoPlaySignalRef.current;

    if (!shouldAutoPlay || !audioRef.current || !audioUrl) {
      return;
    }

    lastHandledAutoPlaySignalRef.current = autoPlaySignal;
    audioRef.current.currentTime = 0;
    void audioRef.current.play().catch(() => {});
  }, [audioUrl, autoPlaySignal]);

  if (!episode) {
    return (
      <div className="featured-episode">
        <h2>Featured Episode Stream</h2>
        <p>Select an episode from the list to start playback.</p>
      </div>
    );
  }

  const description = episode.description ?? '';
  const isLongDescription = description.length > 200;
  const previewDescription = isLongDescription
    ? `${description.slice(0, 200).trimEnd()}…`
    : description;

  return (
    <div className="featured-episode">
      <div className="featured-episode__head">
        <div className="featured-episode__meta">
          <EpisodeThumbnail
            src={thumbnailUrl}
            alt={`${episode.title} thumbnail`}
            size="lg"
          />
          <div>
            <h2>{episode.title}</h2>
            <p>@{episode.ownerName}</p>
          </div>
        </div>

        <div className="featured-episode__actions">
          <button type="button" onClick={() => onToggleLike(episode)}>
            {liked ? 'Unlike' : 'Like'} ({likeCount})
          </button>
          <button type="button" onClick={() => onSendTip(episode)}>
            Send Tips ({tipCount})
          </button>
          <button type="button" onClick={() => onShareEpisode(episode)}>
            Share Link
          </button>
          <button type="button" onClick={() => onEmbedEpisode(episode)}>
            Embed Code
          </button>
        </div>
      </div>

      <p>
        {previewDescription}
        {isLongDescription ? (
          <>
            {' '}
            <button
              type="button"
              className="featured-episode__read-more"
              onClick={() => onShowDetails(episode)}
            >
              read more
            </button>
          </>
        ) : null}
      </p>
      {episode.categories.length > 0 ? (
        <small>Categories: {episode.categories.join(', ')}</small>
      ) : null}

      <div className="featured-episode__player-slot">
        {audioUrl ? (
          <audio ref={audioRef} controls src={audioUrl} preload="none" />
        ) : (
          <p>Loading audio stream...</p>
        )}
      </div>
    </div>
  );
};

export default FeaturedEpisodePanel;
