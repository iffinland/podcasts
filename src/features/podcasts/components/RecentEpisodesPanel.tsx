import { PodcastEpisode } from '../../../types/podcast';
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

const RecentEpisodesPanel = ({
  episodes,
  selectedCategory,
  selectedTags,
  thumbnailUrls,
  onPlayEpisode,
}: RecentEpisodesPanelProps) => {
  const latest = episodes.slice(0, 4);
  const filterSuffix = [
    selectedCategory,
    selectedTags.length > 0 ? selectedTags.map((tag) => `#${tag}`).join(', ') : null,
  ]
    .filter(Boolean)
    .join(' + ');

  return (
    <section className="recent-episodes">
      <h3>{filterSuffix ? `Latest 4: ${filterSuffix}` : 'Latest 4 Episodes'}</h3>
      {latest.length === 0 ? (
        <p>{filterSuffix ? `No episodes for ${filterSuffix}.` : 'No fresh episodes yet.'}</p>
      ) : null}

      <div className="recent-episodes__list">
        {latest.map((episode) => (
          <article key={`${episode.ownerName}-${episode.episodeId}`} className="recent-episodes__item">
            <div className="recent-episodes__meta">
              <EpisodeThumbnail
                src={thumbnailUrls[toEpisodeKey(episode)] ?? null}
                alt={`${episode.title} thumbnail`}
                size="md"
              />
              <div>
              <h4>{episode.title}</h4>
              <p>@{episode.ownerName}</p>
              </div>
            </div>
            <button type="button" onClick={() => void onPlayEpisode(episode)}>
              Play
            </button>
          </article>
        ))}
      </div>
    </section>
  );
};

export default RecentEpisodesPanel;
