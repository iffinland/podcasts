import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEpisodeComposer } from '../../features/podcasts/context/EpisodeComposerContext';
import { useGlobalPlayback } from '../../features/podcasts/context/GlobalPlaybackContext';
import { useTagFilter } from '../../features/podcasts/context/TagFilterContext';
import { useTopEpisodes } from '../../features/podcasts/context/TopEpisodesContext';
import '../../features/podcasts/styles/episode-composer-modal.css';

interface AppSidebarProps {
  side: 'left' | 'right';
}

const AppSidebar = ({ side }: AppSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isBrowsePage = location.pathname === '/episodes';
  const isMyEpisodesPage = location.pathname === '/my-episodes';
  const { openCreate, openPlaylists } = useEpisodeComposer();
  const { playEpisode, isCurrentEpisode, isPlaying, isPlayerOpen } =
    useGlobalPlayback();
  const { topEpisodes } = useTopEpisodes();
  const {
    topTags,
    allTags,
    selectedTags,
    setSelectedTags,
    selectedCategory,
    setSelectedCategory,
    topCategories,
    allCategories,
  } = useTagFilter();
  const [isAllTagsModalOpen, setIsAllTagsModalOpen] = useState(false);
  const [isAllCategoriesModalOpen, setIsAllCategoriesModalOpen] =
    useState(false);

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

  const toggleCategory = (category: string) => {
    if (selectedCategory === category) {
      setSelectedCategory(null);
      return;
    }
    setSelectedCategory(category);
  };

  if (side === 'left') {
    return (
      <div className="app-sidebar__content">
        <h2>Menu</h2>
        <button
          type="button"
          className={`app-sidebar__primary-action${isBrowsePage ? ' is-home-return' : ''}`}
          onClick={() =>
            void navigate(isBrowsePage ? '/' : '/episodes')
          }
        >
          {isBrowsePage ? 'Back to Home' : 'Browse all Episodes'}
        </button>
        <button
          type="button"
          className="app-sidebar__primary-action"
          onClick={openCreate}
        >
          Publish New Episode
        </button>
        <button
          type="button"
          className="app-sidebar__primary-action"
          onClick={() => openPlaylists()}
        >
          My Playlists
        </button>
        <button
          type="button"
          className={`app-sidebar__primary-action${isMyEpisodesPage ? ' is-home-return' : ''}`}
          onClick={() =>
            void navigate(isMyEpisodesPage ? '/' : '/my-episodes')
          }
        >
          {isMyEpisodesPage ? 'Back to Home' : 'My Published Episodes'}
        </button>
        <h2>Top 6 Category</h2>
        <div className="app-sidebar__filter-actions">
          <button
            type="button"
            className="app-sidebar__tag-reset"
            onClick={() => setIsAllCategoriesModalOpen(true)}
          >
            All Categories
          </button>
          <button
            type="button"
            className={`app-sidebar__tag-reset${selectedCategory === null ? ' is-active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            Clear selected
          </button>
        </div>
        {topCategories.length === 0 ? <p>No categories yet.</p> : null}
        <div className="app-sidebar__tag-cloud">
          {topCategories.map((category) => {
            const isActive = selectedCategory === category.name;

            return (
              <button
                key={category.name}
                type="button"
                className={`app-sidebar__tag-chip${isActive ? ' is-active' : ''}`}
                onClick={() => toggleCategory(category.name)}
                title={`${category.name} (${category.count})`}
              >
                {category.name} ({category.count})
              </button>
            );
          })}
        </div>

        <h2>Top 8 Tags</h2>
        <div className="app-sidebar__filter-actions">
          <button
            type="button"
            className="app-sidebar__tag-reset"
            onClick={() => setIsAllTagsModalOpen(true)}
          >
            All Tags
          </button>
          <button
            type="button"
            className={`app-sidebar__tag-reset${selectedTags.length === 0 ? ' is-active' : ''}`}
            onClick={() => setSelectedTags([])}
          >
            Clear selected
          </button>
        </div>
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
        {isAllCategoriesModalOpen ? (
          <div
            className="episode-modal__backdrop"
            onClick={() => setIsAllCategoriesModalOpen(false)}
          >
            <section
              className="episode-modal surface app-sidebar__all-tags-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="episode-modal__head">
                <h3>All Categories</h3>
                <button
                  type="button"
                  onClick={() => setIsAllCategoriesModalOpen(false)}
                >
                  Close
                </button>
              </div>
              {allCategories.length === 0 ? <p>No categories yet.</p> : null}
              <div className="app-sidebar__all-tags-cloud">
                {allCategories.map((category) => {
                  const isActive = selectedCategory === category.name;

                  return (
                    <button
                      key={category.name}
                      type="button"
                      className={`app-sidebar__tag-chip${isActive ? ' is-active' : ''}`}
                      onClick={() => toggleCategory(category.name)}
                      title={`${category.name} (${category.count})`}
                    >
                      {category.name} ({category.count})
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}
        {isAllTagsModalOpen ? (
          <div
            className="episode-modal__backdrop"
            onClick={() => setIsAllTagsModalOpen(false)}
          >
            <section
              className="episode-modal surface app-sidebar__all-tags-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="episode-modal__head">
                <h3>All Tags</h3>
                <button
                  type="button"
                  onClick={() => setIsAllTagsModalOpen(false)}
                >
                  Close
                </button>
              </div>
              {allTags.length === 0 ? <p>No tags yet.</p> : null}
              <div className="app-sidebar__all-tags-cloud">
                {allTags.map((item) => {
                  const isActive = selectedTags.some(
                    (tag) => tag.toLowerCase() === item.tag.toLowerCase()
                  );

                  return (
                    <button
                      key={item.tag}
                      type="button"
                      className={`app-sidebar__tag-chip${isActive ? ' is-active' : ''}`}
                      onClick={() => toggleTag(item.tag)}
                      title={`${item.tag} (${item.count})`}
                    >
                      {item.tag} ({item.count})
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}
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
              {isPlayerOpen && isCurrentEpisode(item.episode)
                ? isPlaying
                  ? '● Playing'
                  : '● Paused'
                : 'Play'}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
};

export default AppSidebar;
