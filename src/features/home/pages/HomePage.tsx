import CatalogStatus from '../../podcasts/components/CatalogStatus';
import { ensureCompleteCatalog } from '../../podcasts/hooks/usePodcastCrud';
import { matchesPodcastFilters } from '../../podcasts/utils/catalogFilters';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIdentity } from '../../identity/context/IdentityContext';
import EmbedCodeModal from '../../podcasts/components/EmbedCodeModal';
import EpisodeDetailsModal from '../../podcasts/components/EpisodeDetailsModal';
import PlaylistManagerModal from '../../podcasts/components/PlaylistManagerModal';
import RecentEpisodesPanel from '../../podcasts/components/RecentEpisodesPanel';
import SendTipModal from '../../podcasts/components/SendTipModal';
import { useEpisodeComposer } from '../../podcasts/context/EpisodeComposerContext';
import { useGlobalPlayback } from '../../podcasts/context/GlobalPlaybackContext';
import { useTagFilter } from '../../podcasts/context/TagFilterContext';
import { useEpisodeEngagement } from '../../podcasts/hooks/useEpisodeEngagement';
import { useOpenSharedEpisode } from '../../podcasts/hooks/useOpenSharedEpisode';
import { toEpisodeKey } from '../../podcasts/hooks/podcastKeys';
import { usePodcastCrud } from '../../podcasts/hooks/usePodcastCrud';
import { usePodcastSocial } from '../../podcasts/hooks/usePodcastSocial';
import {
  buildDownloadFilename,
  buildHtmlAudioEmbedCode,
} from '../../podcasts/utils/embedCode';
import {
  buildEpisodeDeepLink,
  copyToClipboard,
  triggerFileDownload,
} from '../../podcasts/utils/shareAndClipboard';
import { PodcastEpisode } from '../../../types/podcast';
import '../styles/home-page.css';

const HomePage = () => {
  const { activeName } = useIdentity();
  const podcastCrud = usePodcastCrud();
  const { resolveAudioUrl } = podcastCrud;
  const social = usePodcastSocial(activeName);
  const engagement = useEpisodeEngagement(activeName);
  const { mapLikesSetByKey } = engagement;
  const { playEpisode, currentEpisode } = useGlobalPlayback();
  const { selectedTags, selectedCategory } = useTagFilter();
  const composer = useEpisodeComposer();
  const thumbnailUrls: Record<string, string | null> = {};
  const [tipEpisode, setTipEpisode] = useState<PodcastEpisode | null>(null);
  const [embedEpisode, setEmbedEpisode] = useState<PodcastEpisode | null>(null);
  const [detailsEpisode, setDetailsEpisode] = useState<PodcastEpisode | null>(
    null
  );
  const [htmlEmbedCode, setHtmlEmbedCode] = useState('');
  const [isHtmlEmbedLoading, setIsHtmlEmbedLoading] = useState(false);

  const episodeIndex = useMemo(() => {
    return podcastCrud.episodes.reduce<Record<string, PodcastEpisode>>(
      (accumulator, episode) => {
        accumulator[toEpisodeKey(episode)] = episode;
        return accumulator;
      },
      {}
    );
  }, [podcastCrud.episodes]);

  const filteredEpisodes = useMemo(
    () =>
      podcastCrud.episodes.filter((episode) =>
        matchesPodcastFilters(episode, {
          tags: selectedTags,
          category: selectedCategory,
        })
      ),
    [podcastCrud.episodes, selectedTags, selectedCategory]
  );
  useEffect(() => {
    if (selectedTags.length || selectedCategory) void ensureCompleteCatalog();
  }, [selectedTags, selectedCategory]);

  const handlePlayEpisode = useCallback(
    async (episode: PodcastEpisode) => {
      await playEpisode(episode);
    },
    [playEpisode]
  );

  const handleToggleLike = async (episode: PodcastEpisode) => {
    try {
      await engagement.toggleLike(episode);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not save like.';
      window.alert(message);
    }
  };

  const handleSendTip = (episode: PodcastEpisode) => {
    setTipEpisode(episode);
  };

  const handleShareEpisode = useCallback(async (episode: PodcastEpisode) => {
    const link = buildEpisodeDeepLink(toEpisodeKey(episode));
    const isCopied = await copyToClipboard(link);
    if (!isCopied) {
      window.prompt('Copy episode link:', link);
    }
    return isCopied;
  }, []);

  const handleEmbedEpisode = useCallback((episode: PodcastEpisode) => {
    setEmbedEpisode(episode);
  }, []);

  const handleAddToPlaylistEpisode = useCallback(
    (episode: PodcastEpisode) => {
      composer.openPlaylists(episode);
    },
    [composer]
  );

  const handleDownloadEpisode = useCallback(
    (episode: PodcastEpisode) => {
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
    },
    [resolveAudioUrl]
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
    return mapLikesSetByKey(podcastCrud.episodes);
  }, [mapLikesSetByKey, podcastCrud.episodes]);

  const handleOpenSharedEpisode = useCallback(
    (episode: PodcastEpisode) => {
      setDetailsEpisode(null);
      void handlePlayEpisode(episode);
    },
    [handlePlayEpisode]
  );

  useOpenSharedEpisode({
    episodes: podcastCrud.episodes,
    onMatch: handleOpenSharedEpisode,
    resolveEpisodeByKey: podcastCrud.findEpisodeByKey,
  });

  return (
    <>
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
        onPlayEpisode={handlePlayEpisode}
        episodeIndex={episodeIndex}
        thumbnailUrls={thumbnailUrls}
      />
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
        onLike={handleToggleLike}
        onTip={handleSendTip}
        onShare={handleShareEpisode}
        onEmbed={handleEmbedEpisode}
        onAddToPlaylist={handleAddToPlaylistEpisode}
        onDownload={handleDownloadEpisode}
        onClose={() => setDetailsEpisode(null)}
      />

      <section className="home-page">
        {podcastCrud.error ? (
          <p className="home-page__error-toast">{podcastCrud.error}</p>
        ) : null}

        <section className="home-grid">
          <section className="surface home-grid__panel">
            <button
              type="button"
              disabled={podcastCrud.isLoading}
              onClick={() => void podcastCrud.loadEpisodes()}
            >
              Refresh
            </button>
            {(selectedTags.length > 0 || selectedCategory) && <CatalogStatus />}
            <RecentEpisodesPanel
              isLoading={podcastCrud.isLoading || podcastCrud.catalogLoading}
              isIncomplete={
                podcastCrud.catalogStarted && !podcastCrud.catalogComplete
              }
              episodes={filteredEpisodes}
              selectedCategory={selectedCategory}
              selectedTags={selectedTags}
              thumbnailUrls={thumbnailUrls}
              onPlayEpisode={handlePlayEpisode}
              onDetailsEpisode={(episode) => setDetailsEpisode(episode)}
              onLikeEpisode={handleToggleLike}
              onTipEpisode={handleSendTip}
              onShareEpisode={handleShareEpisode}
              onEmbedEpisode={handleEmbedEpisode}
              onAddToPlaylistEpisode={handleAddToPlaylistEpisode}
              onDownloadEpisode={handleDownloadEpisode}
              likedByEpisodeKey={likedByEpisodeKey}
              disableEngagement={!activeName}
            />
          </section>
        </section>
      </section>
    </>
  );
};

export default HomePage;
