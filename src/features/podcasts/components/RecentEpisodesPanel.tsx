import { PodcastEpisode } from '../../../types/podcast';

interface RecentEpisodesPanelProps {
  episodes: PodcastEpisode[];
  onPlayEpisode: (episode: PodcastEpisode) => Promise<void>;
}

const RecentEpisodesPanel = ({ episodes, onPlayEpisode }: RecentEpisodesPanelProps) => {
  const latest = episodes.slice(0, 4);

  return (
    <section className="recent-episodes">
      <h3>Latest 4 Episodes</h3>
      {latest.length === 0 ? <p>No fresh episodes yet.</p> : null}

      <div className="recent-episodes__list">
        {latest.map((episode) => (
          <article key={`${episode.ownerName}-${episode.episodeId}`} className="recent-episodes__item">
            <div>
              <h4>{episode.title}</h4>
              <p>@{episode.ownerName}</p>
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
