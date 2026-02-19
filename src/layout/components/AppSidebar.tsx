import { useLocation, useNavigate } from 'react-router-dom';
import { useEpisodeComposer } from '../../features/podcasts/context/EpisodeComposerContext';
import { useGlobalPlayback } from '../../features/podcasts/context/GlobalPlaybackContext';
import { useTagFilter } from '../../features/podcasts/context/TagFilterContext';
import { useTopEpisodes } from '../../features/podcasts/context/TopEpisodesContext';

interface AppSidebarProps {
  side: 'left' | 'right';
}

const AppSidebar = ({ side }: AppSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openCreate, openPlaylists } = useEpisodeComposer();
  const { playEpisode } = useGlobalPlayback();
  const { topEpisodes } = useTopEpisodes();
  const { topTags, selectedTags, setSelectedTags } = useTagFilter();

  const toggleTag = (tag: string) => {
    const normalized = tag.toLowerCase();
    const hasTag = selectedTags.some(
      (item) => item.toLowerCase() === normalized
    );

    if (hasTag) {
      setSelectedTags(
        selectedTags.filter((item) => item.toLowerCase() !== normalized)
      );
      return;
    }

    setSelectedTags([...selectedTags, tag]);
  };

  if (side === 'left') {
    return (
      <div className="app-sidebar__content">
        <h2>Menu</h2>
        <button
          type="button"
          className="app-sidebar__primary-action"
          onClick={openCreate}
        >
          Publish new episode
        </button>
        <button
          type="button"
          className="app-sidebar__primary-action"
          onClick={openPlaylists}
        >
          My Playists
        </button>
        <button
          type="button"
          className="app-sidebar__primary-action"
          onClick={() =>
            void navigate(location.pathname === '/episodes' ? '/' : '/episodes')
          }
        >
          {location.pathname === '/episodes'
            ? 'Back to Home'
            : 'Browse all episodes'}
        </button>
        <button
          type="button"
          className="app-sidebar__primary-action"
          onClick={() =>
            void navigate(
              location.pathname === '/my-episodes' ? '/' : '/my-episodes'
            )
          }
        >
          {location.pathname === '/my-episodes'
            ? 'Back to Home'
            : 'My Published Episodes'}
        </button>
        <h2>Top 20 Tags</h2>
        <button
          type="button"
          className={`app-sidebar__tag-reset${selectedTags.length === 0 ? ' is-active' : ''}`}
          onClick={() => setSelectedTags([])}
        >
          All Tags
        </button>
        {topTags.length === 0 ? <p>No tags yet.</p> : null}
        <div className="app-sidebar__tag-cloud">
          {topTags.map((item, index) => {
            const weightClass =
              index < 5 ? 'weight-3' : index < 12 ? 'weight-2' : 'weight-1';
            const isActive = selectedTags.some(
              (tag) => tag.toLowerCase() === item.tag.toLowerCase()
            );

            return (
              <button
                key={item.tag}
                type="button"
                className={`app-sidebar__tag-chip ${weightClass}${isActive ? ' is-active' : ''}`}
                onClick={() => toggleTag(item.tag)}
                title={`${item.tag} (${item.count})`}
              >
                {item.tag} ({item.count})
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="app-sidebar__content">
      <h2>Likes & Tips</h2>
      {topEpisodes.length === 0 ? <p>No ranked episodes yet.</p> : null}
      <div className="app-sidebar__ranking">
        {topEpisodes.map((item) => (
          <article
            key={`${item.ownerName}-${item.episodeId}`}
            className="app-sidebar__ranking-item"
          >
            <strong>{item.title}</strong>
            <small>@{item.ownerName}</small>
            <span>
              Likes: {item.likes} | Tips: {item.tips}
            </span>
            <button
              type="button"
              onClick={() => void playEpisode(item.episode)}
            >
              Play
            </button>
          </article>
        ))}
      </div>
    </div>
  );
};

export default AppSidebar;
