import { useEffect, useMemo, useState } from 'react';
import EpisodeThumbnail from '../components/EpisodeThumbnail';
import EmbedCodeModal from '../components/EmbedCodeModal';
import EpisodeQuickActions from '../components/EpisodeQuickActions';
import EpisodeDetailsModal from '../components/EpisodeDetailsModal';
import PlaylistManagerModal from '../components/PlaylistManagerModal';
import SendTipModal from '../components/SendTipModal';
import { useIdentity } from '../../identity/context/IdentityContext';
import { useEpisodeComposer } from '../context/EpisodeComposerContext';
import { useEpisodeEngagement } from '../hooks/useEpisodeEngagement';
import { useGlobalPlayback } from '../context/GlobalPlaybackContext';
import { useTagFilter } from '../context/TagFilterContext';
import { toEpisodeKey } from '../hooks/podcastKeys';
import { usePodcastCrud } from '../hooks/usePodcastCrud';
import { usePodcastSocial } from '../hooks/usePodcastSocial';
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
import './browse-episodes-page.css';

const PAGE_SIZE = 20;
const MAX_VISIBLE_PAGE_BUTTONS = 7;

type TagAccumulator = {
  count: number;
  label: string;
};

type SortOrder = 'title-asc' | 'title-desc' | 'owner-asc' | 'owner-desc';

const buildPreview = (
  value: string,
  limit = 200
): { text: string; isLong: boolean } => {
  if (!value) {
    return { text: '', isLong: false };
  }
  const isLong = value.length > limit;
  return {
    text: isLong ? `${value.slice(0, limit).trimEnd()}…` : value,
    isLong,
  };
};

const getVisiblePageNumbers = (current: number, total: number): number[] => {
  if (total <= MAX_VISIBLE_PAGE_BUTTONS) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const halfWindow = Math.floor(MAX_VISIBLE_PAGE_BUTTONS / 2);
  let start = Math.max(1, current - halfWindow);
  let end = start + MAX_VISIBLE_PAGE_BUTTONS - 1;

  if (end > total) {
    end = total;
    start = end - MAX_VISIBLE_PAGE_BUTTONS + 1;
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

const BrowseEpisodesPage = () => {
  const { activeName } = useIdentity();
  const { playEpisode, currentEpisode, isCurrentEpisode, isPlaying, isPlayerOpen } =
    useGlobalPlayback();
  const composer = useEpisodeComposer();
  const social = usePodcastSocial(activeName);
  const engagement = useEpisodeEngagement(activeName);
  const { episodes, isLoading, error, resolveThumbnailUrl, resolveAudioUrl } =
    usePodcastCrud();
  const {
    selectedTags,
    setSelectedTags,
    setTopTags,
    setAllTags,
    selectedCategory,
    setSelectedCategory,
    allCategories,
    setTopCategories,
    setAllCategories,
  } = useTagFilter();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('title-asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [thumbnailUrls, setThumbnailUrls] = useState<
    Record<string, string | null>
  >({});
  const [detailsEpisode, setDetailsEpisode] = useState<PodcastEpisode | null>(
    null
  );
  const [tipEpisode, setTipEpisode] = useState<PodcastEpisode | null>(null);
  const [embedEpisode, setEmbedEpisode] = useState<PodcastEpisode | null>(null);
  const [htmlEmbedCode, setHtmlEmbedCode] = useState('');
  const [isHtmlEmbedLoading, setIsHtmlEmbedLoading] = useState(false);

  useEffect(() => {
    const missing = episodes.filter((episode) => {
      const key = `${episode.ownerName}-${episode.episodeId}`;
      return !(key in thumbnailUrls);
    });

    if (missing.length === 0) {
      return;
    }

    let cancelled = false;

    void Promise.all(
      missing.map(async (episode) => {
        const key = `${episode.ownerName}-${episode.episodeId}`;
        try {
          const url = await resolveThumbnailUrl(episode);
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
  }, [episodes, resolveThumbnailUrl, thumbnailUrls]);

  useEffect(() => {
    const categoryCounts = episodes.reduce<Map<string, number>>(
      (accumulator, episode) => {
        episode.categories.forEach((category) => {
          accumulator.set(category, (accumulator.get(category) ?? 0) + 1);
        });
        return accumulator;
      },
      new Map<string, number>()
    );

    const rankedCategories = Array.from(categoryCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort(
        (first, second) =>
          second.count - first.count || first.name.localeCompare(second.name)
      );

    setAllCategories(rankedCategories);
    setTopCategories(rankedCategories.slice(0, 6));
  }, [episodes, setAllCategories, setTopCategories]);

  useEffect(() => {
    const map = episodes.reduce<Map<string, TagAccumulator>>(
      (accumulator, episode) => {
        episode.tags.forEach((tag) => {
          const normalized = tag.toLowerCase();
          const existing = accumulator.get(normalized);
          if (existing) {
            existing.count += 1;
            return;
          }

          accumulator.set(normalized, { count: 1, label: tag });
        });
        return accumulator;
      },
      new Map<string, TagAccumulator>()
    );

    const ranked = Array.from(map.entries())
      .sort(([, left], [, right]) => right.count - left.count)
      .map(([, value]) => ({
        tag: value.label,
        count: value.count,
      }));

    setAllTags(ranked);
    setTopTags(ranked.slice(0, 8));
  }, [episodes, setAllTags, setTopTags]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredEpisodes = useMemo(() => {
    const filtered = episodes.filter((episode) => {
      const categoryMatches =
        !selectedCategory || episode.categories.includes(selectedCategory);
      const tagsMatch =
        selectedTags.length === 0 ||
        selectedTags.every((tag) =>
          episode.tags.some(
            (episodeTag) => episodeTag.toLowerCase() === tag.toLowerCase()
          )
        );
      const searchable =
        `${episode.title} ${episode.description} ${episode.ownerName}`.toLowerCase();
      const searchMatches =
        normalizedQuery.length === 0 || searchable.includes(normalizedQuery);

      return categoryMatches && tagsMatch && searchMatches;
    });

    return filtered.sort((left, right) => {
      if (sortOrder === 'owner-asc' || sortOrder === 'owner-desc') {
        const ownerResult = left.ownerName.localeCompare(
          right.ownerName,
          undefined,
          { sensitivity: 'base' }
        );
        return sortOrder === 'owner-asc' ? ownerResult : -ownerResult;
      }

      const titleResult = left.title.localeCompare(right.title, undefined, {
        sensitivity: 'base',
      });
      return sortOrder === 'title-asc' ? titleResult : -titleResult;
    });
  }, [episodes, normalizedQuery, selectedCategory, selectedTags, sortOrder]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEpisodes.length / PAGE_SIZE)
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedCategory,
    selectedTags,
    searchQuery,
    sortOrder,
    filteredEpisodes.length,
  ]);

  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageEpisodes = filteredEpisodes.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );
  const pageNumbers = getVisiblePageNumbers(safePage, totalPages);
  const episodeIndex = useMemo(() => {
    return episodes.reduce<Record<string, PodcastEpisode>>(
      (accumulator, episode) => {
        accumulator[toEpisodeKey(episode)] = episode;
        return accumulator;
      },
      {}
    );
  }, [episodes]);

  const handlePlayFromBrowse = (episode: PodcastEpisode) => {
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

  const handleAddToPlaylist = (episode: PodcastEpisode) => {
    composer.openPlaylists(episode);
  };

  const handleDownload = (episode: PodcastEpisode) => {
    void resolveAudioUrl(episode).then((audioUrl) => {
      triggerFileDownload(audioUrl, buildDownloadFilename(episode.title));
    });
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

    void resolveAudioUrl(embedEpisode)
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
  }, [embedEpisode, resolveAudioUrl]);

  const likedByEpisodeKey = useMemo(() => {
    return engagement.mapLikesSetByKey(episodes);
  }, [engagement.mapLikesSetByKey, episodes]);

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
        onClose={() => setDetailsEpisode(null)}
      />
      <section className="surface browse-episodes">
        <header className="browse-episodes__header">
          <h2>Browse All Episodes</h2>
          <p>
            Showing {pageEpisodes.length === 0 ? 0 : startIndex + 1}-
            {startIndex + pageEpisodes.length} of {filteredEpisodes.length}
          </p>
        </header>

        <div className="browse-episodes__filters">
          <label className="browse-episodes__search">
            Search
            <input
              type="text"
              placeholder="Title, description, @name"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>

          <label>
            Category
            <select
              value={selectedCategory ?? ''}
              onChange={(event) =>
                setSelectedCategory(event.target.value || null)
              }
            >
              <option value="">All categories</option>
              {allCategories.map((category) => (
                <option key={category.name} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sort
            <select
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value as SortOrder)
              }
            >
              <option value="title-asc">Title A-Z</option>
              <option value="title-desc">Title Z-A</option>
              <option value="owner-asc">Owner A-Z</option>
              <option value="owner-desc">Owner Z-A</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => setSelectedTags([])}
            disabled={selectedTags.length === 0}
          >
            Clear tag filter
          </button>
        </div>

        {isLoading ? <p>Loading episodes...</p> : null}
        {error ? <p className="browse-episodes__error">{error}</p> : null}
        {!isLoading && pageEpisodes.length === 0 ? (
          <p>No episodes found for current filters.</p>
        ) : null}

        <div className="browse-episodes__list">
          {pageEpisodes.map((episode) => {
            const key = toEpisodeKey(episode);
            return (
              <article key={key} className="browse-episodes__item">
                <EpisodeThumbnail
                  src={thumbnailUrls[key] ?? null}
                  alt={`${episode.title} thumbnail`}
                  size="sm"
                />
                <div className="browse-episodes__item-text">
                  <h3>{episode.title}</h3>
                  {(() => {
                    const preview = buildPreview(episode.description);
                    return (
                      <p>
                        {preview.text}
                        {preview.isLong ? (
                          <>
                            {' '}
                            <button
                              type="button"
                              className="browse-episodes__read-more"
                              onClick={() => setDetailsEpisode(episode)}
                            >
                              read more
                            </button>
                          </>
                        ) : null}
                      </p>
                    );
                  })()}
                  <small>
                    @{episode.ownerName} |{' '}
                    {episode.tags.join(', ') || 'no tags'}
                  </small>
                  {episode.categories.length > 0 ? (
                    <small>Categories: {episode.categories.join(', ')}</small>
                  ) : null}
                  <div className="browse-episodes__item-actions">
                    <EpisodeQuickActions
                      isPlaying={isPlayerOpen && isCurrentEpisode(episode)}
                      isLiked={likedByEpisodeKey.has(key)}
                      onPlay={() => handlePlayFromBrowse(episode)}
                      onDetails={() => setDetailsEpisode(episode)}
                      onLike={() => void handleLike(episode)}
                      onTip={() => handleTip(episode)}
                      onShare={() => handleShare(episode)}
                      onEmbed={() => handleEmbed(episode)}
                      onAddToPlaylist={() => handleAddToPlaylist(episode)}
                      onDownload={() => handleDownload(episode)}
                      disableEngagement={!activeName}
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

        <footer className="browse-episodes__pagination">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={safePage <= 1}
          >
            Previous
          </button>
          <div className="browse-episodes__page-numbers">
            {pageNumbers[0] > 1 ? (
              <>
                <button type="button" onClick={() => setCurrentPage(1)}>
                  1
                </button>
                {pageNumbers[0] > 2 ? <span>...</span> : null}
              </>
            ) : null}

            {pageNumbers.map((page) => (
              <button
                type="button"
                key={page}
                onClick={() => setCurrentPage(page)}
                className={page === safePage ? 'is-active' : ''}
              >
                {page}
              </button>
            ))}

            {pageNumbers[pageNumbers.length - 1] < totalPages ? (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 ? (
                  <span>...</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                >
                  {totalPages}
                </button>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            disabled={safePage >= totalPages}
          >
            Next
          </button>
        </footer>
      </section>
    </>
  );
};

export default BrowseEpisodesPage;
