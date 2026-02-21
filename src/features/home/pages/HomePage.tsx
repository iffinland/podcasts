import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIdentity } from '../../identity/context/IdentityContext';
import EpisodeComposerModal from '../../podcasts/components/EpisodeComposerModal';
import EmbedCodeModal from '../../podcasts/components/EmbedCodeModal';
import PlaylistManagerModal from '../../podcasts/components/PlaylistManagerModal';
import RecentEpisodesPanel from '../../podcasts/components/RecentEpisodesPanel';
import SendTipModal from '../../podcasts/components/SendTipModal';
import { useEpisodeComposer } from '../../podcasts/context/EpisodeComposerContext';
import { useGlobalPlayback } from '../../podcasts/context/GlobalPlaybackContext';
import { useTagFilter } from '../../podcasts/context/TagFilterContext';
import { useTopEpisodes } from '../../podcasts/context/TopEpisodesContext';
import { useEpisodeEngagement } from '../../podcasts/hooks/useEpisodeEngagement';
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

type TagAccumulator = {
  count: number;
  label: string;
};

const HomePage = () => {
  const { activeName } = useIdentity();
  const podcastCrud = usePodcastCrud();
  const social = usePodcastSocial(activeName);
  const engagement = useEpisodeEngagement(activeName);
  const { playEpisode, currentEpisode } = useGlobalPlayback();
  const { setTopEpisodes } = useTopEpisodes();
  const {
    selectedTags,
    setSelectedTags,
    setTopTags,
    setAllTags,
    selectedCategory,
    setSelectedCategory,
    setTopCategories,
    setAllCategories,
  } = useTagFilter();
  const composer = useEpisodeComposer();
  const [thumbnailUrls, setThumbnailUrls] = useState<
    Record<string, string | null>
  >({});
  const [tipEpisode, setTipEpisode] = useState<PodcastEpisode | null>(null);
  const [embedEpisode, setEmbedEpisode] = useState<PodcastEpisode | null>(null);
  const [htmlEmbedCode, setHtmlEmbedCode] = useState('');
  const [isHtmlEmbedLoading, setIsHtmlEmbedLoading] = useState(false);
  const handledSharedEpisodeKey = useRef<string | null>(null);

  const episodeIndex = useMemo(() => {
    return podcastCrud.episodes.reduce<Record<string, PodcastEpisode>>(
      (accumulator, episode) => {
        accumulator[toEpisodeKey(episode)] = episode;
        return accumulator;
      },
      {}
    );
  }, [podcastCrud.episodes]);

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();

    podcastCrud.episodes.forEach((episode) => {
      episode.categories.forEach((category) => {
        counts.set(category, (counts.get(category) ?? 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort(
        (first, second) =>
          second.count - first.count || first.name.localeCompare(second.name)
      );
  }, [podcastCrud.episodes]);

  useEffect(() => {
    setAllCategories(categoryOptions);
    setTopCategories(categoryOptions.slice(0, 6));
  }, [categoryOptions, setAllCategories, setTopCategories]);

  const filteredEpisodes = useMemo(() => {
    return podcastCrud.episodes.filter((episode) => {
      const categoryMatch =
        !selectedCategory || episode.categories.includes(selectedCategory);
      const normalizedEpisodeTags = episode.tags.map((tag) =>
        tag.trim().toLowerCase()
      );
      const tagMatch =
        selectedTags.length === 0 ||
        selectedTags.every((selectedTag) =>
          normalizedEpisodeTags.includes(selectedTag.toLowerCase())
        );
      return categoryMatch && tagMatch;
    });
  }, [podcastCrud.episodes, selectedCategory, selectedTags]);

  useEffect(() => {
    let cancelled = false;

    const resolveMissingThumbnails = async () => {
      const missing = podcastCrud.episodes.filter((episode) => {
        const key = toEpisodeKey(episode);
        return thumbnailUrls[key] === undefined;
      });

      if (missing.length === 0) {
        return;
      }

      const resolved = await Promise.all(
        missing.map(async (episode) => {
          const key = toEpisodeKey(episode);
          const value = episode.thumbnail
            ? await podcastCrud.resolveThumbnailUrl(episode).catch(() => null)
            : null;
          return [key, value] as const;
        })
      );

      if (cancelled) {
        return;
      }

      setThumbnailUrls((previous) => {
        const next = { ...previous };
        resolved.forEach(([key, value]) => {
          next[key] = value;
        });
        return next;
      });
    };

    void resolveMissingThumbnails();

    return () => {
      cancelled = true;
    };
  }, [podcastCrud.episodes, podcastCrud.resolveThumbnailUrl, thumbnailUrls]);

  useEffect(() => {
    if (!selectedCategory) {
      return;
    }

    const hasCategory = categoryOptions.some(
      (item) => item.name === selectedCategory
    );
    if (!hasCategory) {
      setSelectedCategory(null);
    }
  }, [categoryOptions, selectedCategory]);

  useEffect(() => {
    const map = podcastCrud.episodes.reduce<Map<string, TagAccumulator>>(
      (accumulator, episode) => {
        episode.tags.forEach((rawTag) => {
          const normalized = rawTag.trim().toLowerCase();

          if (!normalized) {
            return;
          }

          const existing = accumulator.get(normalized);
          if (existing) {
            existing.count += 1;
            return;
          }

          accumulator.set(normalized, {
            count: 1,
            label: rawTag.trim(),
          });
        });

        return accumulator;
      },
      new Map()
    );

    const ranked = Array.from(map.entries())
      .map(([normalized, value]) => ({
        tag: value.label || normalized,
        normalized,
        count: value.count,
      }))
      .sort(
        (first, second) =>
          second.count - first.count || first.tag.localeCompare(second.tag)
      )
      .map(({ tag, count }) => ({ tag, count }));

    setAllTags(ranked);
    setTopTags(ranked.slice(0, 8));
  }, [podcastCrud.episodes, setAllTags, setTopTags]);

  useEffect(() => {
    if (selectedTags.length === 0) {
      return;
    }

    const nextSelected = selectedTags.filter((selectedTag) =>
      podcastCrud.episodes.some((episode) =>
        episode.tags.some(
          (tag) => tag.trim().toLowerCase() === selectedTag.toLowerCase()
        )
      )
    );

    if (nextSelected.length !== selectedTags.length) {
      setSelectedTags(nextSelected);
    }
  }, [podcastCrud.episodes, selectedTags, setSelectedTags]);

  const updateEpisodeParam = useCallback((episode: PodcastEpisode) => {
    const key = toEpisodeKey(episode);
    const current = new URL(window.location.href);
    current.searchParams.set('episode', key);
    window.history.replaceState({}, '', current.toString());
  }, []);

  const handlePlayEpisode = useCallback(
    async (episode: PodcastEpisode) => {
      await playEpisode(episode);
      updateEpisodeParam(episode);
    },
    [playEpisode, updateEpisodeParam]
  );

  const handleSelectEpisode = useCallback(
    async (episode: PodcastEpisode) => {
      await handlePlayEpisode(episode);
    },
    [handlePlayEpisode]
  );

  const handleToggleLike = async (episode: PodcastEpisode) => {
    await engagement.toggleLike(episode);
  };

  const handleSendTip = (episode: PodcastEpisode) => {
    setTipEpisode(episode);
  };

  const handleShareEpisode = useCallback((episode: PodcastEpisode) => {
    const link = buildEpisodeDeepLink(toEpisodeKey(episode));
    void copyToClipboard(link).then((isCopied) => {
      if (!isCopied) {
        window.prompt('Copy episode link:', link);
      }
    });
  }, []);

  const handleEmbedEpisode = useCallback((episode: PodcastEpisode) => {
    setEmbedEpisode(episode);
  }, []);

  const handleDownloadEpisode = useCallback(
    (episode: PodcastEpisode) => {
      void podcastCrud.resolveAudioUrl(episode).then((audioUrl) => {
        triggerFileDownload(audioUrl, buildDownloadFilename(episode.title));
      });
    },
    [podcastCrud.resolveAudioUrl]
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
    return engagement.mapLikesSetByKey(podcastCrud.episodes);
  }, [engagement.mapLikesSetByKey, podcastCrud.episodes]);

  useEffect(() => {
    const top = engagement.getTopEpisodes(podcastCrud.episodes).map((item) => ({
      episodeId: item.episode.episodeId,
      title: item.episode.title,
      ownerName: item.episode.ownerName,
      likes: item.likes,
      tips: item.tips,
      episode: item.episode,
    }));
    setTopEpisodes(top);
  }, [engagement.getTopEpisodes, podcastCrud.episodes, setTopEpisodes]);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const key = search.get('episode');

    if (!key || key === handledSharedEpisodeKey.current) {
      return;
    }

    const target = podcastCrud.episodes.find(
      (episode) => toEpisodeKey(episode) === key
    );

    if (!target) {
      return;
    }

    handledSharedEpisodeKey.current = key;
    void handlePlayEpisode(target);
  }, [podcastCrud.episodes, handlePlayEpisode]);

  return (
    <>
      <EpisodeComposerModal
        isOpen={composer.isOpen}
        mode={composer.mode}
        activeName={activeName}
        editingEpisode={composer.editingEpisode}
        isSaving={podcastCrud.isSaving}
        errorMessage={podcastCrud.error}
        saveProgress={podcastCrud.saveProgress}
        onClose={composer.close}
        onCreate={async (payload) => {
          const created = await podcastCrud.createEpisode(payload);
          setThumbnailUrls((previous) => {
            const next = { ...previous };
            delete next[toEpisodeKey(created)];
            return next;
          });
          await handleSelectEpisode(created);
        }}
        onEdit={async (payload) => {
          const updated = await podcastCrud.editEpisode(payload);
          setThumbnailUrls((previous) => {
            const next = { ...previous };
            delete next[toEpisodeKey(updated)];
            return next;
          });
          await handleSelectEpisode(updated);
        }}
      />
      <PlaylistManagerModal
        isOpen={composer.isPlaylistOpen}
        onClose={composer.closePlaylists}
        activeName={activeName}
        featuredEpisode={currentEpisode}
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

      <section className="home-page">
        {podcastCrud.error ? (
          <p className="home-page__error-toast">{podcastCrud.error}</p>
        ) : null}

        <section className="home-grid">
          <section className="surface home-grid__panel">
            <RecentEpisodesPanel
              episodes={filteredEpisodes}
              selectedCategory={selectedCategory}
              selectedTags={selectedTags}
              thumbnailUrls={thumbnailUrls}
              onPlayEpisode={handlePlayEpisode}
              onLikeEpisode={handleToggleLike}
              onTipEpisode={handleSendTip}
              onShareEpisode={handleShareEpisode}
              onEmbedEpisode={handleEmbedEpisode}
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
