import type { PodcastEpisode } from '../../../types/podcast';
export const normalizeFilter = (value: string) => value.trim().toLowerCase();
const searchText = new WeakMap<PodcastEpisode, string>();
export const matchesPodcastFilters = (
  episode: PodcastEpisode,
  filters: { query?: string; category?: string | null; tags?: string[] }
) => {
  if (
    filters.category &&
    !episode.categories.some(
      (value) => normalizeFilter(value) === normalizeFilter(filters.category!)
    )
  )
    return false;
  const tags = new Set(episode.tags.map(normalizeFilter));
  if (filters.tags?.some((value) => !tags.has(normalizeFilter(value))))
    return false;
  const query = normalizeFilter(filters.query ?? '');
  if (!query) return true;
  if (!searchText.has(episode))
    searchText.set(
      episode,
      normalizeFilter(
        [
          episode.title,
          episode.description,
          episode.ownerName,
          `@${episode.ownerName}`,
          ...episode.tags,
          ...episode.categories,
        ].join(' ')
      )
    );
  return searchText.get(episode)!.includes(query);
};
export const catalogTaxonomy = (episodes: PodcastEpisode[]) => {
  const tags = new Map<string, { tag: string; count: number }>();
  const categories = new Map<string, { name: string; count: number }>();
  for (const episode of episodes) {
    for (const key of new Set(
      episode.tags.map(normalizeFilter).filter(Boolean)
    )) {
      const current = tags.get(key);
      tags.set(key, {
        tag:
          current?.tag ??
          episode.tags.find((tag) => normalizeFilter(tag) === key)!.trim(),
        count: (current?.count ?? 0) + 1,
      });
    }
    for (const key of new Set(
      episode.categories.map(normalizeFilter).filter(Boolean)
    )) {
      const current = categories.get(key);
      categories.set(key, {
        name:
          current?.name ??
          episode.categories
            .find((category) => normalizeFilter(category) === key)!
            .trim(),
        count: (current?.count ?? 0) + 1,
      });
    }
  }
  return {
    tags: [...tags.values()].sort(
      (a, b) => b.count - a.count || a.tag.localeCompare(b.tag)
    ),
    categories: [...categories.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name)
    ),
  };
};
