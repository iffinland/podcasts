import { useEffect, useMemo } from 'react';
import { useIdentity } from '../../identity/context/IdentityContext';
import { useTopEpisodes } from '../context/TopEpisodesContext';
import { useTagFilter } from '../context/TagFilterContext';
import { usePodcastCrud, ensureCompleteCatalog } from '../hooks/usePodcastCrud';
import { useEpisodeEngagement } from '../hooks/useEpisodeEngagement';
import { catalogTaxonomy } from '../utils/catalogFilters';
export default function CommunityIndexSync() {
  const { activeName } = useIdentity();
  const catalog = usePodcastCrud('', false);
  const { getTopEpisodes } = useEpisodeEngagement(activeName);
  const { setTopEpisodes } = useTopEpisodes();
  const { setAllTags, setTopTags, setAllCategories, setTopCategories } =
    useTagFilter();
  const taxonomy = useMemo(
    () => catalogTaxonomy(catalog.episodes),
    [catalog.episodes]
  );
  useEffect(() => {
    setAllTags(taxonomy.tags);
    setTopTags(taxonomy.tags.slice(0, 8));
    setAllCategories(taxonomy.categories);
    setTopCategories(taxonomy.categories.slice(0, 6));
  }, [taxonomy, setAllTags, setTopTags, setAllCategories, setTopCategories]);
  useEffect(() => {
    setTopEpisodes(
      getTopEpisodes(catalog.episodes).map((item) => ({
        episodeId: item.episode.episodeId,
        title: item.episode.title,
        ownerName: item.episode.ownerName,
        likes: item.likes,
        tips: item.tips,
        episode: item.episode,
      }))
    );
  }, [catalog.episodes, getTopEpisodes, setTopEpisodes]);
  // Preserve RC.1's first usable batch; complete the catalog in bounded background slots.
  useEffect(() => {
    if (catalog.episodes.length > 0 && !catalog.catalogStarted)
      void ensureCompleteCatalog();
  }, [catalog.episodes.length, catalog.catalogStarted]);
  return null;
}
