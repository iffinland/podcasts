import { PodcastEpisode } from '../../../types/podcast';
import { toEpisodeKey } from '../hooks/podcastKeys';
import EpisodeThumbnail from './EpisodeThumbnail';
import '../styles/podcast-crud.css';
import '../styles/episode-thumbnail.css';

interface PodcastCrudPanelProps {
  activeName: string | null;
  episodes: PodcastEpisode[];
  selectedCategory: string | null;
  selectedTags: string[];
  thumbnailUrls: Record<string, string | null>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  likedSet: Set<string>;
  likeCounts: Record<string, number>;
  tipCounts: Record<string, number>;
  onDeleteEpisode: (episode: PodcastEpisode) => Promise<void>;
  onPlayEpisode: (episode: PodcastEpisode) => Promise<void>;
  onToggleLike: (episode: PodcastEpisode) => Promise<void>;
  onSendTip: (episode: PodcastEpisode) => void;
  onShareEpisode: (episode: PodcastEpisode) => void;
  onEmbedEpisode: (episode: PodcastEpisode) => void;
  onRequestEdit: (episode: PodcastEpisode) => void;
}

const PodcastCrudPanel = ({
  activeName,
  episodes,
  selectedCategory,
  selectedTags,
  thumbnailUrls,
  isLoading,
  isSaving,
  error,
  likedSet,
  likeCounts,
  tipCounts,
  onDeleteEpisode,
  onPlayEpisode,
  onToggleLike,
  onSendTip,
  onShareEpisode,
  onEmbedEpisode,
  onRequestEdit,
}: PodcastCrudPanelProps) => {
  const filterSuffix = [
    selectedCategory,
    selectedTags.length > 0 ? selectedTags.map((tag) => `#${tag}`).join(', ') : null,
  ]
    .filter(Boolean)
    .join(' + ');

  return (
    <section className="podcast-crud__list-wrap">
      <h3>{filterSuffix ? `Episodes: ${filterSuffix}` : 'Episodes'}</h3>
      {isLoading ? <p>Loading episodes...</p> : null}
      {error ? <p className="podcast-crud__error">{error}</p> : null}

      <div className="podcast-crud__list">
        {episodes.map((episode) => {
          const isOwner = activeName === episode.ownerName;
          const episodeKey = toEpisodeKey(episode);
          const isLiked = likedSet.has(episodeKey);
          const likeCount = likeCounts[episode.episodeId] ?? 0;
          const tipCount = tipCounts[episode.episodeId] ?? 0;

          return (
            <article key={`${episode.ownerName}-${episode.episodeId}`} className="podcast-crud__item">
              <div>
                <div className="podcast-crud__item-head">
                  <EpisodeThumbnail
                    src={thumbnailUrls[episodeKey] ?? null}
                    alt={`${episode.title} thumbnail`}
                    size="md"
                  />
                  <div>
                    <h4>{episode.title}</h4>
                    <p>{episode.description}</p>
                    <small>
                      @{episode.ownerName} | {episode.tags.join(', ') || 'no tags'}
                    </small>
                    {episode.categories.length > 0 ? (
                      <small>Categories: {episode.categories.join(', ')}</small>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="podcast-crud__item-actions">
                <button type="button" onClick={() => void onPlayEpisode(episode)} disabled={isSaving}>
                  Play
                </button>
                <button type="button" onClick={() => void onToggleLike(episode)} disabled={isSaving}>
                  {isLiked ? 'Unlike' : 'Like'} ({likeCount})
                </button>
                <button type="button" onClick={() => onSendTip(episode)} disabled={isSaving}>
                  Send Tips ({tipCount})
                </button>
                <button type="button" onClick={() => onShareEpisode(episode)} disabled={isSaving}>
                  Share Link
                </button>
                <button type="button" onClick={() => onEmbedEpisode(episode)} disabled={isSaving}>
                  Embed Code
                </button>
                <button
                  type="button"
                  onClick={() => onRequestEdit(episode)}
                  disabled={isSaving || !isOwner}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteEpisode(episode)}
                  className="podcast-crud__danger"
                  disabled={isSaving || !isOwner}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default PodcastCrudPanel;
