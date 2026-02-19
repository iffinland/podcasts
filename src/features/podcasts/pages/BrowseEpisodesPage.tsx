import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EpisodeThumbnail from '../components/EpisodeThumbnail';
import EpisodeDetailsModal from '../components/EpisodeDetailsModal';
import { PODCAST_CATEGORIES } from '../constants/podcastCategories';
import { useTagFilter } from '../context/TagFilterContext';
import { toEpisodeKey } from '../hooks/podcastKeys';
import { usePodcastCrud } from '../hooks/usePodcastCrud';
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
  const navigate = useNavigate();
  const { episodes, isLoading, error, resolveThumbnailUrl } = usePodcastCrud();
  const { selectedTags, setSelectedTags, setTopTags } = useTagFilter();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('title-asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [thumbnailUrls, setThumbnailUrls] = useState<
    Record<string, string | null>
  >({});
  const [detailsEpisode, setDetailsEpisode] = useState<PodcastEpisode | null>(
    null
  );

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
      .slice(0, 20)
      .map(([, value]) => ({
        tag: value.label,
        count: value.count,
      }));

    setTopTags(ranked);
  }, [episodes, setTopTags]);

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

  const handlePlayFromBrowse = (key: string) => {
    void navigate({
      pathname: '/',
      search: `?episode=${encodeURIComponent(key)}`,
    });
  };

  return (
    <>
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
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="">All categories</option>
              {PODCAST_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
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
                    <button
                      type="button"
                      onClick={() => handlePlayFromBrowse(key)}
                    >
                      Play
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailsEpisode(episode)}
                    >
                      View Details
                    </button>
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
