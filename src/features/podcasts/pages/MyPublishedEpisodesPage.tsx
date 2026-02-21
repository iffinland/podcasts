import { useEffect, useMemo, useState } from 'react';
import { useIdentity } from '../../identity/context/IdentityContext';
import EmbedCodeModal from '../components/EmbedCodeModal';
import EpisodeComposerModal from '../components/EpisodeComposerModal';
import EpisodeQuickActions from '../components/EpisodeQuickActions';
import EpisodeThumbnail from '../components/EpisodeThumbnail';
import SendTipModal from '../components/SendTipModal';
import { useEpisodeEngagement } from '../hooks/useEpisodeEngagement';
import { useGlobalPlayback } from '../context/GlobalPlaybackContext';
import { toEpisodeKey } from '../hooks/podcastKeys';
import { usePodcastCrud } from '../hooks/usePodcastCrud';
import {
  buildDownloadFilename,
  buildHtmlAudioEmbedCode,
} from '../utils/embedCode';
import {
  buildEpisodeDeepLink,
  copyToClipboard,
  triggerFileDownload,
} from '../utils/shareAndClipboard';
import { PodcastEpisode } from '../../../types/podcast';
import './my-published-episodes-page.css';

const MyPublishedEpisodesPage = () => {
  const { activeName } = useIdentity();
  const engagement = useEpisodeEngagement(activeName);
  const { playEpisode, isCurrentEpisode, isPlaying, isPlayerOpen } =
    useGlobalPlayback();
  const podcastCrud = usePodcastCrud();
  const [thumbnailUrls, setThumbnailUrls] = useState<
    Record<string, string | null>
  >({});
  const [editingEpisode, setEditingEpisode] = useState<PodcastEpisode | null>(
    null
  );
  const [tipEpisode, setTipEpisode] = useState<PodcastEpisode | null>(null);
  const [embedEpisode, setEmbedEpisode] = useState<PodcastEpisode | null>(null);
  const [htmlEmbedCode, setHtmlEmbedCode] = useState('');
  const [isHtmlEmbedLoading, setIsHtmlEmbedLoading] = useState(false);

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
    void playEpisode(episode);
  };

  const handleLike = async (episode: PodcastEpisode) => {
    await engagement.toggleLike(episode);
  };

  const handleTip = (episode: PodcastEpisode) => {
    setTipEpisode(episode);
  };

  const handleShare = (episode: PodcastEpisode) => {
    const link = buildEpisodeDeepLink(toEpisodeKey(episode));
    void copyToClipboard(link).then((isCopied) => {
      if (!isCopied) {
        window.prompt('Copy episode link:', link);
      }
    });
  };

  const handleEmbed = (episode: PodcastEpisode) => {
    setEmbedEpisode(episode);
  };

  const handleDownload = (episode: PodcastEpisode) => {
    void podcastCrud.resolveAudioUrl(episode).then((audioUrl) => {
      triggerFileDownload(audioUrl, buildDownloadFilename(episode.title));
    });
  };

  const handleDelete = async (episode: PodcastEpisode) => {
    const confirmed = window.confirm(`Delete "${episode.title}"?`);
    if (!confirmed) {
      return;
    }

    await podcastCrud.removeEpisode(episode);
  };

  useEffect(() => {
    if (!embedEpisode) {
      setHtmlEmbedCode('');
      setIsHtmlEmbedLoading(false);
      return;
    }

    let cancelled = false;
    setIsHtmlEmbedLoading(true);
    setHtmlEmbedCode('');

    void podcastCrud
      .resolveAudioUrl(embedEpisode)
      .then((audioUrl) => {
        if (cancelled) {
          return;
        }
        setHtmlEmbedCode(buildHtmlAudioEmbedCode(audioUrl, embedEpisode.title));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setHtmlEmbedCode('');
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setIsHtmlEmbedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [embedEpisode, podcastCrud.resolveAudioUrl]);

  const likedByEpisodeKey = useMemo(() => {
    return engagement.mapLikesSetByKey(myEpisodes);
  }, [engagement.mapLikesSetByKey, myEpisodes]);

  return (
    <>
      <SendTipModal
        isOpen={Boolean(tipEpisode)}
        publisherName={tipEpisode?.ownerName ?? null}
        onSent={async (amount) => {
          if (!tipEpisode) {
            return;
          }
          await engagement.registerTip(tipEpisode, amount);
        }}
        onClose={() => setTipEpisode(null)}
      />
      <EmbedCodeModal
        isOpen={Boolean(embedEpisode)}
        htmlCode={htmlEmbedCode}
        isHtmlLoading={isHtmlEmbedLoading}
        onClose={() => setEmbedEpisode(null)}
      />
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
                  <div className="my-episodes__item-actions">
                    <EpisodeQuickActions
                      isPlaying={isPlayerOpen && isCurrentEpisode(episode)}
                      isLiked={likedByEpisodeKey.has(key)}
                      onPlay={() => handlePlay(episode)}
                      onLike={() => void handleLike(episode)}
                      onTip={() => handleTip(episode)}
                      onShare={() => handleShare(episode)}
                      onEmbed={() => handleEmbed(episode)}
                      onDownload={() => handleDownload(episode)}
                      onEdit={() => setEditingEpisode(episode)}
                      onDelete={() => void handleDelete(episode)}
                      disableEngagement={!activeName}
                      disableAll={podcastCrud.isSaving}
                    />
                    {isPlayerOpen && isCurrentEpisode(episode) ? (
                      <small>{isPlaying ? 'Playing now' : 'Paused'}</small>
                    ) : null}
                  </div>
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
