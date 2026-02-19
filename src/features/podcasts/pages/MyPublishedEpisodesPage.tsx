import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIdentity } from '../../identity/context/IdentityContext';
import EpisodeComposerModal from '../components/EpisodeComposerModal';
import EpisodeThumbnail from '../components/EpisodeThumbnail';
import { toEpisodeKey } from '../hooks/podcastKeys';
import { usePodcastCrud } from '../hooks/usePodcastCrud';
import { PodcastEpisode } from '../../../types/podcast';
import './my-published-episodes-page.css';

const MyPublishedEpisodesPage = () => {
  const navigate = useNavigate();
  const { activeName } = useIdentity();
  const podcastCrud = usePodcastCrud();
  const [thumbnailUrls, setThumbnailUrls] = useState<
    Record<string, string | null>
  >({});
  const [editingEpisode, setEditingEpisode] = useState<PodcastEpisode | null>(
    null
  );

  const myEpisodes = useMemo(() => {
    if (!activeName) {
      return [];
    }

    return podcastCrud.episodes.filter(
      (episode) => episode.ownerName === activeName
    );
  }, [activeName, podcastCrud.episodes]);

  useEffect(() => {
    const missing = myEpisodes.filter((episode) => {
      const key = toEpisodeKey(episode);
      return !(key in thumbnailUrls);
    });

    if (missing.length === 0) {
      return;
    }

    let cancelled = false;

    void Promise.all(
      missing.map(async (episode) => {
        const key = toEpisodeKey(episode);

        if (!episode.thumbnail) {
          return { key, url: null };
        }

        try {
          const url = await podcastCrud.resolveThumbnailUrl(episode);
          return { key, url };
        } catch {
          return { key, url: null };
        }
      })
    ).then((results) => {
      if (cancelled) {
        return;
      }

      setThumbnailUrls((previous) => {
        const next = { ...previous };
        results.forEach(({ key, url }) => {
          next[key] = url;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [myEpisodes, podcastCrud, thumbnailUrls]);

  const handlePlay = (episode: PodcastEpisode) => {
    const key = toEpisodeKey(episode);
    void navigate({
      pathname: '/',
      search: `?episode=${encodeURIComponent(key)}`,
    });
  };

  const handleDelete = async (episode: PodcastEpisode) => {
    const confirmed = window.confirm(`Delete "${episode.title}"?`);
    if (!confirmed) {
      return;
    }

    await podcastCrud.removeEpisode(episode);
  };

  return (
    <>
      <EpisodeComposerModal
        isOpen={Boolean(editingEpisode)}
        mode="edit"
        activeName={activeName}
        editingEpisode={editingEpisode}
        isSaving={podcastCrud.isSaving}
        errorMessage={podcastCrud.error}
        saveProgress={podcastCrud.saveProgress}
        onClose={() => setEditingEpisode(null)}
        onCreate={async () => {}}
        onEdit={async (payload) => {
          const updated = await podcastCrud.editEpisode(payload);
          setThumbnailUrls((previous) => {
            const next = { ...previous };
            delete next[toEpisodeKey(updated)];
            return next;
          });
          setEditingEpisode(null);
        }}
      />

      <section className="surface my-episodes">
        <header className="my-episodes__header">
          <h2>My Published Episodes</h2>
          <p>
            {activeName
              ? `Publisher: @${activeName}`
              : 'No active publisher selected.'}
          </p>
        </header>

        {podcastCrud.isLoading ? <p>Loading episodes...</p> : null}
        {podcastCrud.error ? (
          <p className="my-episodes__error">{podcastCrud.error}</p>
        ) : null}
        {!podcastCrud.isLoading && activeName && myEpisodes.length === 0 ? (
          <p>No published episodes yet.</p>
        ) : null}

        <div className="my-episodes__list">
          {myEpisodes.map((episode) => {
            const key = toEpisodeKey(episode);

            return (
              <article key={key} className="my-episodes__item">
                <EpisodeThumbnail
                  src={thumbnailUrls[key] ?? null}
                  alt={`${episode.title} thumbnail`}
                  size="sm"
                />
                <div className="my-episodes__item-text">
                  <h3>{episode.title}</h3>
                  <p>{episode.description}</p>
                  <small>{episode.tags.join(', ') || 'no tags'}</small>
                </div>
                <div className="my-episodes__item-actions">
                  <button
                    type="button"
                    onClick={() => handlePlay(episode)}
                    disabled={podcastCrud.isSaving}
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingEpisode(episode)}
                    disabled={podcastCrud.isSaving}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="my-episodes__danger"
                    onClick={() => void handleDelete(episode)}
                    disabled={podcastCrud.isSaving}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
};

export default MyPublishedEpisodesPage;
