import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIdentity } from '../../identity/context/IdentityContext';
import EmbedCodeModal from '../components/EmbedCodeModal';
import EpisodeDetailsModal from '../components/EpisodeDetailsModal';
import EpisodeQuickActions from '../components/EpisodeQuickActions';
import EpisodeThumbnail from '../components/EpisodeThumbnail';
import PlaylistManagerModal from '../components/PlaylistManagerModal';
import SendTipModal from '../components/SendTipModal';
import { useEpisodeComposer } from '../context/EpisodeComposerContext';
import { useEpisodeEngagement } from '../hooks/useEpisodeEngagement';
import { useOpenSharedEpisode } from '../hooks/useOpenSharedEpisode';
import { useGlobalPlayback } from '../context/GlobalPlaybackContext';
import { toEpisodeKey } from '../hooks/podcastKeys';
import { usePodcastCrud } from '../hooks/usePodcastCrud';
import { usePodcastSocial } from '../hooks/usePodcastSocial';
import {
  buildDownloadFilename,
  buildHtmlAudioEmbedCode,
} from '../utils/embedCode';
import { renderQortalLinkedText } from '../utils/qortalDescription';
import {
  buildEpisodeDeepLink,
  copyToClipboard,
  triggerFileDownload,
} from '../utils/shareAndClipboard';
import { PodcastEpisode } from '../../../types/podcast';
import './my-published-episodes-page.css';

const MyPublishedEpisodesPage = () => {
  const { activeName } = useIdentity();
  const composer = useEpisodeComposer();
  const social = usePodcastSocial(activeName);
  const engagement = useEpisodeEngagement(activeName);
  const { mapLikesSetByKey } = engagement;
  const {
    playEpisode,
    currentEpisode,
    isCurrentEpisode,
    isPlaying,
    isPlayerOpen,
  } = useGlobalPlayback();
  const podcastCrud = usePodcastCrud(activeName ?? '', Boolean(activeName));
  const { resolveAudioUrl } = podcastCrud;
  const thumbnailUrls: Record<string, string | null> = {};
  const [detailsEpisode, setDetailsEpisode] = useState<PodcastEpisode | null>(
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

  const handlePlay = (episode: PodcastEpisode) => {
    void playEpisode(episode);
  };

  const handleLike = async (episode: PodcastEpisode) => {
    try {
      await engagement.toggleLike(episode);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not save like.';
      window.alert(message);
    }
  };

  const handleTip = (episode: PodcastEpisode) => {
    setTipEpisode(episode);
  };

  const handleShare = async (episode: PodcastEpisode) => {
    const link = buildEpisodeDeepLink(toEpisodeKey(episode));
    const isCopied = await copyToClipboard(link);
    if (!isCopied) {
      window.prompt('Copy episode link:', link);
    }
    return isCopied;
  };

  const handleEmbed = (episode: PodcastEpisode) => {
    setEmbedEpisode(episode);
  };

  const handleDownload = (episode: PodcastEpisode) => {
    void resolveAudioUrl(episode)
      .then((audioUrl) => {
        triggerFileDownload(
          audioUrl,
          buildDownloadFilename(episode.title, episode.audio.filename)
        );
      })
      .catch((error) =>
        window.alert(
          error instanceof Error ? error.message : 'Download failed.'
        )
      );
  };

  const handleDelete = async (episode: PodcastEpisode) => {
    const confirmed = window.confirm(`Delete "${episode.title}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await podcastCrud.removeEpisode(episode);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Delete failed.');
    }
  };

  const handleOpenSharedEpisode = useCallback(
    (episode: PodcastEpisode) => {
      setDetailsEpisode(null);
      void playEpisode(episode);
    },
    [playEpisode]
  );

  useEffect(() => {
    if (!embedEpisode) {
      setHtmlEmbedCode('');
      setIsHtmlEmbedLoading(false);
      return;
    }

    let cancelled = false;
    setIsHtmlEmbedLoading(true);
    setHtmlEmbedCode('');

    void resolveAudioUrl(embedEpisode)
      .then((audioUrl) => {
        if (cancelled) {
          return;
        }
        setHtmlEmbedCode(
          buildHtmlAudioEmbedCode(
            audioUrl,
            embedEpisode.title,
            buildEpisodeDeepLink(toEpisodeKey(embedEpisode))
          )
        );
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
  }, [embedEpisode, resolveAudioUrl]);

  const likedByEpisodeKey = useMemo(() => {
    return mapLikesSetByKey(myEpisodes);
  }, [mapLikesSetByKey, myEpisodes]);
  const episodeIndex = useMemo(() => {
    return podcastCrud.episodes.reduce<Record<string, PodcastEpisode>>(
      (accumulator, episode) => {
        accumulator[toEpisodeKey(episode)] = episode;
        return accumulator;
      },
      {}
    );
  }, [podcastCrud.episodes]);

  useOpenSharedEpisode({
    episodes: podcastCrud.episodes,
    resolveEpisodeByKey: podcastCrud.findEpisodeByKey,
    onMatch: handleOpenSharedEpisode,
  });

  return (
    <>
      <SendTipModal
        senderKey={activeName ?? undefined}
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
      <PlaylistManagerModal
        isOpen={composer.isPlaylistOpen}
        onClose={composer.closePlaylists}
        activeName={activeName}
        featuredEpisode={composer.playlistEpisode ?? currentEpisode}
        playlists={social.playlists}
        isLoading={social.isLoading}
        error={social.error}
        onCreatePlaylist={social.createNewPlaylist}
        onAddEpisode={social.addEpisode}
        onRemoveEpisode={social.removeEpisode}
        onPlayEpisode={async (episode) => {
          await playEpisode(episode);
        }}
        episodeIndex={episodeIndex}
        thumbnailUrls={thumbnailUrls}
      />
      <EpisodeDetailsModal
        isOpen={Boolean(detailsEpisode)}
        episode={detailsEpisode}
        thumbnailUrl={
          detailsEpisode
            ? (thumbnailUrls[toEpisodeKey(detailsEpisode)] ?? null)
            : null
        }
        isLiked={
          detailsEpisode
            ? likedByEpisodeKey.has(toEpisodeKey(detailsEpisode))
            : false
        }
        disableEngagement={!activeName}
        disableAll={podcastCrud.isSaving}
        onLike={handleLike}
        onTip={handleTip}
        onShare={handleShare}
        onEmbed={handleEmbed}
        onAddToPlaylist={(episode) => composer.openPlaylists(episode)}
        onDownload={handleDownload}
        onClose={() => setDetailsEpisode(null)}
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

        <button
          type="button"
          disabled={podcastCrud.isLoading}
          onClick={() => void podcastCrud.loadEpisodes()}
        >
          Refresh
        </button>
        {podcastCrud.hasMore && (
          <button
            type="button"
            disabled={podcastCrud.isLoading}
            onClick={() => void podcastCrud.loadMore()}
          >
            Load more episodes
          </button>
        )}
        <div className="my-episodes__list">
          {myEpisodes.map((episode) => {
            const key = toEpisodeKey(episode);

            return (
              <article key={key} className="my-episodes__item">
                <EpisodeThumbnail
                  episode={episode}
                  src={thumbnailUrls[key] ?? null}
                  alt={`${episode.title} thumbnail`}
                  size="sm"
                />
                <div className="my-episodes__item-text">
                  <h3>{episode.title}</h3>
                  <p>{renderQortalLinkedText(episode.description)}</p>
                  <small>{episode.tags.join(', ') || 'no tags'}</small>
                  <div className="my-episodes__item-actions">
                    <EpisodeQuickActions
                      isPlaying={isPlayerOpen && isCurrentEpisode(episode)}
                      isLiked={likedByEpisodeKey.has(key)}
                      onPlay={() => handlePlay(episode)}
                      onDetails={() => setDetailsEpisode(episode)}
                      onLike={() => void handleLike(episode)}
                      onTip={() => handleTip(episode)}
                      onShare={() => handleShare(episode)}
                      onEmbed={() => handleEmbed(episode)}
                      onAddToPlaylist={() => composer.openPlaylists(episode)}
                      onDownload={() => handleDownload(episode)}
                      onEdit={() => composer.openEdit(episode)}
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
