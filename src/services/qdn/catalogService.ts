import {
  cachedDocuments,
  documentKey,
  pruneDocuments,
  readQdnDocument,
} from '../cache/qdnDocumentCache';
import { discoverResources } from './resourceDiscovery';
import {
  buildEpisodeFromMetadata,
  parsePodcastMetadata,
} from './podcastQdnService';
import { mapConcurrent } from '../qortal/mapConcurrent';
import type { PodcastEpisode } from '../../types/podcast';
export type CatalogProgress = {
  discovered: number;
  processed: number;
  failed: number;
  discovering: boolean;
};
export const cachedCatalog = async () => {
  const episodes: PodcastEpisode[] = [];
  for (const entry of await cachedDocuments('episodes')) {
    const metadata = parsePodcastMetadata(entry.value);
    if (
      metadata?.status === 'active' &&
      entry.resource.identifier ===
        `qpodcasts-episode-${metadata.episodeId}-meta`
    )
      episodes.push(
        buildEpisodeFromMetadata(
          entry.resource.name,
          entry.resource.identifier,
          metadata
        )
      );
  }
  return episodes;
};
export const scanCatalog = async (callbacks: {
  onEpisode: (episode: PodcastEpisode) => void;
  onDeleted: (episode: PodcastEpisode) => void;
  onProgress: (progress: CatalogProgress) => void;
}) => {
  const progress: CatalogProgress = {
    discovered: 0,
    processed: 0,
    failed: 0,
    discovering: true,
  };
  const resources = await discoverResources('qpodcasts-episode-', (items) => {
    progress.discovered = items.length;
    callbacks.onProgress({ ...progress });
  });
  progress.discovering = false;
  callbacks.onProgress({ ...progress });
  const seen = new Set(resources.map((item) => documentKey('episodes', item)));
  await mapConcurrent(resources, 2, async (resource) => {
    try {
      const raw = await readQdnDocument('episodes', resource, {
        priority: 'background',
      });
      const metadata = parsePodcastMetadata(raw);
      if (
        !metadata ||
        resource.identifier !== `qpodcasts-episode-${metadata.episodeId}-meta`
      )
        throw new Error('Invalid episode metadata.');
      const episode = buildEpisodeFromMetadata(
        resource.name,
        resource.identifier,
        metadata
      );
      if (metadata.status === 'deleted') callbacks.onDeleted(episode);
      else callbacks.onEpisode(episode);
    } catch {
      progress.failed++;
    }
    progress.processed++;
    callbacks.onProgress({ ...progress });
  });
  // Only prune after every index page was obtained; unavailable documents remain retryable.
  await pruneDocuments('episodes', seen);
  return { resources, progress };
};
