import { PodcastEpisode } from '../../../types/podcast';
import { useGlobalPlayback } from '../context/GlobalPlaybackContext';
import { toEpisodeKey } from '../hooks/podcastKeys';
import EpisodeThumbnail from './EpisodeThumbnail';
import '../styles/episode-thumbnail.css';

interface RecentEpisodesPanelProps {
  episodes: PodcastEpisode[];
  selectedCategory: string | null;
  selectedTags: string[];
  thumbnailUrls: Record<string, string | null>;
  onPlayEpisode: (episode: PodcastEpisode) => Promise<void>;
}

const buildPreview = (value: string, limit = 200): string => {
  if (!value) {
    return '';
  }
  return value.length > limit ? `${value.slice(0, limit).trimEnd()}…` : value;
};

const RecentEpisodesPanel = ({
  episodes,
  selectedCategory,
  selectedTags,
  thumbnailUrls,
  onPlayEpisode,
}: RecentEpisodesPanelProps) => {
  const { isCurrentEpisode, isPlaying, isPlayerOpen } = useGlobalPlayback();
  const latest = episodes.slice(0, 20);
  const filterSuffix = [
    selectedCategory,
    selectedTags.length > 0
      ? selectedTags.map((tag) => `#${tag}`).join(', ')
      : null,
  ]
    .filter(Boolean)
    .join(' + ');

  return (
    <section className="recent-episodes">
      <h3>
        {filterSuffix ? `Latest 20: ${filterSuffix}` : 'Latest 20 Episodes'}
      </h3>
      {latest.length === 0 ? (
        <p>
          {filterSuffix
            ? `No episodes for ${filterSuffix}.`
            : 'No fresh episodes yet.'}
        </p>
      ) : null}

      <div className="recent-episodes__list">
        {latest.map((episode) => (
          <article
            key={`${episode.ownerName}-${episode.episodeId}`}
            className="recent-episodes__item"
          >
            <div className="recent-episodes__meta">
              <EpisodeThumbnail
                src={thumbnailUrls[toEpisodeKey(episode)] ?? null}
                alt={`${episode.title} thumbnail`}
                size="sm"
              />
              <div className="recent-episodes__text">
                <h4>{episode.title}</h4>
                <p>@{episode.ownerName}</p>
                <p className="recent-episodes__description">
                  {buildPreview(episode.description)}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => void onPlayEpisode(episode)}>
              {isPlayerOpen && isCurrentEpisode(episode)
                ? isPlaying
                  ? '● Playing'
                  : '● Paused'
                : 'Play'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
};

export default RecentEpisodesPanel;
