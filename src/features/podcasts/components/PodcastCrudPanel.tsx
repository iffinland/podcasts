import { PodcastEpisode } from '../../../types/podcast';
import { toEpisodeKey } from '../hooks/podcastKeys';
import '../styles/podcast-crud.css';

interface PodcastCrudPanelProps {
  activeName: string | null;
  episodes: PodcastEpisode[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  likedSet: Set<string>;
  onDeleteEpisode: (episode: PodcastEpisode) => Promise<void>;
  onPlayEpisode: (episode: PodcastEpisode) => Promise<void>;
  onToggleLike: (episode: PodcastEpisode) => Promise<void>;
  onRequestEdit: (episode: PodcastEpisode) => void;
}

const PodcastCrudPanel = ({
  activeName,
  episodes,
  isLoading,
  isSaving,
  error,
  likedSet,
  onDeleteEpisode,
  onPlayEpisode,
  onToggleLike,
  onRequestEdit,
}: PodcastCrudPanelProps) => {
  return (
    <section className="podcast-crud__list-wrap">
      <h3>Episodes</h3>
      {isLoading ? <p>Loading episodes...</p> : null}
      {error ? <p className="podcast-crud__error">{error}</p> : null}

      <div className="podcast-crud__list">
        {episodes.map((episode) => {
          const isOwner = activeName === episode.ownerName;
          const episodeKey = toEpisodeKey(episode);
          const isLiked = likedSet.has(episodeKey);

          return (
            <article key={`${episode.ownerName}-${episode.episodeId}`} className="podcast-crud__item">
              <div>
                <h4>{episode.title}</h4>
                <p>{episode.description}</p>
                <small>
                  @{episode.ownerName} | {episode.tags.join(', ') || 'no tags'}
                </small>
              </div>

              <div className="podcast-crud__item-actions">
                <button type="button" onClick={() => void onPlayEpisode(episode)} disabled={isSaving}>
                  Play
                </button>
                <button type="button" onClick={() => void onToggleLike(episode)} disabled={isSaving}>
                  {isLiked ? 'Unlike' : 'Like'}
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
