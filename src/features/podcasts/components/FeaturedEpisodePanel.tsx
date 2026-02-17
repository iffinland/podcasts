import { PodcastEpisode } from '../../../types/podcast';
import { toEpisodeKey } from '../hooks/podcastKeys';

interface FeaturedEpisodePanelProps {
  episode: PodcastEpisode | null;
  audioUrl: string | null;
  liked: boolean;
  onToggleLike: (episode: PodcastEpisode) => void;
}

const FeaturedEpisodePanel = ({
  episode,
  audioUrl,
  liked,
  onToggleLike,
}: FeaturedEpisodePanelProps) => {
  if (!episode) {
    return (
      <div className="featured-episode">
        <h2>Featured Episode Stream</h2>
        <p>Select an episode from the list to start playback.</p>
      </div>
    );
  }

  return (
    <div className="featured-episode">
      <div className="featured-episode__head">
        <div>
          <h2>{episode.title}</h2>
          <p>@{episode.ownerName}</p>
        </div>

        <button type="button" onClick={() => onToggleLike(episode)}>
          {liked ? 'Unlike' : 'Like'}
        </button>
      </div>

      <p>{episode.description}</p>
      <small>Episode key: {toEpisodeKey(episode)}</small>

      {audioUrl ? <audio controls src={audioUrl} preload="none" /> : <p>Loading audio stream...</p>}
    </div>
  );
};

export default FeaturedEpisodePanel;
