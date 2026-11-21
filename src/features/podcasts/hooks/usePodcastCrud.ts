import {
  cachedCatalog,
  scanCatalog,
} from '../../../services/qdn/catalogService';
import { useEffect, useSyncExternalStore } from 'react';
import {
  getPodcastByOwnerAndEpisodeId,
  getAudioResourceUrl,
  getThumbnailResourceUrl,
  searchPodcastPage,
} from '../../../services/qdn/podcastQdnService';
import type { PublishProgressUpdate } from '../../../services/qdn/podcastQdnService';
import type {
  PodcastEpisode,
  PublishPodcastInput,
  UpdatePodcastInput,
} from '../../../types/podcast';
import { parseEpisodeKey, toEpisodeKey } from './podcastKeys';
import {
  clearQortalCache,
  errorMessage,
} from '../../../services/qortal/qortalClient';

export interface SaveProgress {
  operation: 'create' | 'edit' | 'delete';
  step: PublishProgressUpdate['step'];
  message: string;
}
type Feed = {
  episodes: PodcastEpisode[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  offset: number;
  loadedAt: number;
  catalogStarted: boolean;
  catalogLoading: boolean;
  catalogComplete: boolean;
  catalogDiscovered: number;
  catalogProcessed: number;
  catalogFailed: number;
  catalogError: string | null;
  catalogDiscovering: boolean;
  catalogCheckedAt: number;
};
const feeds = new Map<string, Feed>();
const listeners = new Set<() => void>();
const index = new Map<string, PodcastEpisode>();
const deleted = new Map<string, number>();
const localChanges = new Map<string, number>();
const flights = new Map<string, Promise<void>>();
let save = {
  isSaving: false,
  saveProgress: null as SaveProgress | null,
  saveError: null as string | null,
};
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getFeed = (owner: string) => {
  if (!feeds.has(owner))
    feeds.set(owner, {
      episodes: [],
      isLoading: false,
      error: null,
      hasMore: true,
      offset: 0,
      loadedAt: 0,
      catalogStarted: false,
      catalogLoading: false,
      catalogComplete: false,
      catalogDiscovered: 0,
      catalogProcessed: 0,
      catalogFailed: 0,
      catalogError: null,
      catalogDiscovering: false,
      catalogCheckedAt: 0,
    });
  return feeds.get(owner)!;
};
const patch = (owner: string, value: Partial<Feed>) => {
  feeds.set(owner, { ...getFeed(owner), ...value });
  notify();
};
const merge = (owner: string, episode: PodcastEpisode) => {
  const key = toEpisodeKey(episode);
  if (
    (deleted.get(key) ?? 0) >= episode.updatedAt ||
    (index.get(key)?.updatedAt ?? 0) > episode.updatedAt
  )
    return;
  deleted.delete(key);
  index.set(key, episode);
  const feed = getFeed(owner);
  const episodes = [
    ...feed.episodes.filter(
      (item) => toEpisodeKey(item) !== toEpisodeKey(episode)
    ),
    episode,
  ].sort((a, b) => b.updatedAt - a.updatedAt);
  patch(owner, { episodes });
};
const updateEveryFeed = (episode: PodcastEpisode, removed = false) => {
  localChanges.set(toEpisodeKey(episode), Date.now());
  if (removed) {
    deleted.set(toEpisodeKey(episode), Date.now());
    index.delete(toEpisodeKey(episode));
  } else {
    deleted.delete(toEpisodeKey(episode));
    index.set(toEpisodeKey(episode), episode);
  }
  for (const [owner, feed] of feeds) {
    if (owner && owner !== episode.ownerName) continue;
    const episodes = feed.episodes.filter(
      (item) => toEpisodeKey(item) !== toEpisodeKey(episode)
    );
    if (!removed) episodes.push(episode);
    patch(owner, {
      episodes: episodes.sort((a, b) => b.updatedAt - a.updatedAt),
    });
  }
};
const load = (owner: string, more = false): Promise<void> => {
  const existing = flights.get(owner);
  if (existing) return existing;
  const feed = getFeed(owner);
  if (more && !feed.hasMore) return Promise.resolve();
  patch(owner, { isLoading: true, error: null });
  const offset = more ? feed.offset : 0;
  const flight = (async () => {
    try {
      const result = await searchPodcastPage({
        limit: 20,
        offset,
        ownerName: owner || undefined,
        onEpisode: (episode) => merge(owner, episode),
        onDeleted: (episode) => {
          if (
            (index.get(toEpisodeKey(episode))?.updatedAt ?? 0) <=
            episode.updatedAt
          )
            updateEveryFeed(episode, true);
        },
      });
      // Preserve already visible pages during refresh and in-flight mutations.
      patch(owner, {
        ...(!getFeed(owner).catalogComplete
          ? { offset: offset + 20, hasMore: result.hasMore }
          : {}),
        loadedAt: Date.now(),
        error:
          result.failed && !getFeed(owner).catalogComplete
            ? `${result.failed} resources are unavailable. Available episodes are shown; use Refresh to retry.`
            : null,
      });
    } catch (error) {
      if (!getFeed(owner).catalogComplete)
        patch(owner, { error: errorMessage(error) });
    } finally {
      patch(owner, { isLoading: false });
      flights.delete(owner);
    }
  })();
  flights.set(owner, flight);
  return flight;
};
let catalogFlight: Promise<void> | null = null;
export const ensureCompleteCatalog = (force = false): Promise<void> => {
  if (catalogFlight) return catalogFlight;
  const feed = getFeed('');
  if (
    !force &&
    feed.catalogComplete &&
    Date.now() - feed.catalogCheckedAt < 120_000
  )
    return Promise.resolve();
  patch('', {
    catalogStarted: true,
    catalogLoading: true,
    catalogComplete: false,
    catalogDiscovering: true,
    catalogProcessed: 0,
    catalogDiscovered: 0,
    catalogFailed: 0,
    catalogError: null,
  });
  catalogFlight = (async () => {
    const staged = new Map<string, PodcastEpisode>();
    let dirty = false;
    const accept = (episode: PodcastEpisode) => {
      const key = toEpisodeKey(episode);
      if ((deleted.get(key) ?? 0) >= episode.updatedAt) return;
      const current = index.get(key);
      if (
        localChanges.has(key) &&
        ((!current && deleted.has(key)) ||
          JSON.stringify(current) === JSON.stringify(episode))
      )
        localChanges.delete(key);
      const value =
        current && current.updatedAt > episode.updatedAt ? current : episode;
      deleted.delete(key);
      index.set(key, value);
      staged.set(key, value);
      dirty = true;
    };
    const flush = () => {
      if (!dirty) return;
      const combined = new Map(
        getFeed('').episodes.map((episode) => [toEpisodeKey(episode), episode])
      );
      for (const [key, episode] of staged)
        if (!deleted.has(key)) combined.set(key, index.get(key) ?? episode);
      patch('', {
        episodes: [...combined.values()].sort(
          (a, b) => b.updatedAt - a.updatedAt
        ),
      });
      dirty = false;
    };
    try {
      for (const episode of await cachedCatalog()) accept(episode);
      flush();
      const result = await scanCatalog({
        onEpisode: accept,
        onDeleted: (episode) => {
          const key = toEpisodeKey(episode);
          if (
            (localChanges.has(key) && index.has(key)) ||
            (index.get(key)?.updatedAt ?? 0) > episode.updatedAt
          )
            return;
          localChanges.delete(key);
          staged.delete(key);
          deleted.set(key, episode.updatedAt);
          index.delete(key);
          for (const [owner, feed] of feeds)
            patch(owner, {
              episodes: feed.episodes.filter(
                (item) => toEpisodeKey(item) !== key
              ),
            });
        },
        onProgress: (progress) => {
          if (
            progress.processed % 10 === 0 ||
            progress.processed === progress.discovered
          ) {
            flush();
            patch('', {
              catalogDiscovering: progress.discovering,
              catalogDiscovered: progress.discovered,
              catalogProcessed: progress.processed,
              catalogFailed: progress.failed,
            });
          }
        },
      });
      flush();
      const advertised = new Set(
        result.resources.map((resource) =>
          JSON.stringify([resource.name.toLowerCase(), resource.identifier])
        )
      );
      const keep = (episode: PodcastEpisode) =>
        advertised.has(
          JSON.stringify([
            episode.ownerName.toLowerCase(),
            episode.metadataIdentifier,
          ])
        ) || localChanges.has(toEpisodeKey(episode));
      const episodes = getFeed('').episodes.filter(keep);
      for (const [owner, feed] of feeds) {
        for (const episode of feed.episodes)
          if (!keep(episode)) index.delete(toEpisodeKey(episode));
        if (owner) patch(owner, { episodes: feed.episodes.filter(keep) });
      }
      patch('', {
        episodes,
        catalogComplete: result.progress.failed === 0,
        catalogCheckedAt: Date.now(),
        catalogError: result.progress.failed
          ? `${result.progress.failed} episode resources are unavailable. Results are incomplete; retry the catalog check.`
          : null,
        hasMore: false,
        offset: result.resources.length,
        error: null,
      });
    } catch (error) {
      flush();
      patch('', { catalogError: errorMessage(error) });
    } finally {
      patch('', { catalogLoading: false, catalogDiscovering: false });
      catalogFlight = null;
    }
  })();
  return catalogFlight;
};
const perform = async <T>(
  operation: SaveProgress['operation'],
  fn: (onProgress: (update: PublishProgressUpdate) => void) => Promise<T>
): Promise<T> => {
  if (save.isSaving)
    throw new Error('Another publication is still in progress.');
  save = {
    isSaving: true,
    saveError: null,
    saveProgress: {
      operation,
      step: 'validating',
      message: 'Preparing publication...',
    },
  };
  notify();
  try {
    return await fn((update) => {
      save = { ...save, saveProgress: { operation, ...update } };
      notify();
    });
  } catch (error) {
    save = { ...save, saveError: errorMessage(error) };
    throw error;
  } finally {
    save = { ...save, isSaving: false };
    notify();
  }
};
const executeSaved = async (
  id: string,
  ownerName: string,
  onProgress: (update: PublishProgressUpdate) => void,
  options: { checkOnly?: boolean; resubmitUnconfirmed?: boolean } = {}
) => {
  const { runPublicationJob } = await import(
    '../../../services/qdn/publicationJobs'
  );
  const job = await runPublicationJob(id, ownerName, {
    ...options,
    onProgress,
  });
  if (job.result) updateEveryFeed(job.result, job.operation === 'delete');
  return job;
};
const createEpisode = (input: PublishPodcastInput) =>
  perform('create', async (onProgress) => {
    const { savePublicationJob } = await import(
      '../../../services/qdn/publicationJobs'
    );
    const draft = await savePublicationJob('create', input, onProgress);
    const job = await executeSaved(draft.key, draft.ownerName, onProgress);
    if (!job.result)
      throw new Error(
        'The draft remains saved. Continue it from unfinished publications.'
      );
    return job.result;
  });
const editEpisode = (input: UpdatePodcastInput) =>
  perform('edit', async (onProgress) => {
    const { savePublicationJob } = await import(
      '../../../services/qdn/publicationJobs'
    );
    const draft = await savePublicationJob('edit', input, onProgress);
    const job = await executeSaved(draft.key, draft.ownerName, onProgress);
    if (!job.result)
      throw new Error(
        'The draft remains saved. Continue it from unfinished publications.'
      );
    return job.result;
  });
const removeEpisode = (episode: PodcastEpisode) =>
  perform('delete', async (onProgress) => {
    const { savePublicationJob } = await import(
      '../../../services/qdn/publicationJobs'
    );
    const draft = await savePublicationJob('delete', episode, onProgress);
    await executeSaved(draft.key, draft.ownerName, onProgress);
  });
const resumePublication = async (
  id: string,
  ownerName: string,
  options: { checkOnly?: boolean; resubmitUnconfirmed?: boolean } = {}
) => {
  const { getPublicationJob } = await import(
    '../../../services/qdn/publicationJobs'
  );
  const job = await getPublicationJob(id);
  if (!job) throw new Error('Saved draft not found.');
  return perform(job.operation, (onProgress) =>
    executeSaved(id, ownerName, onProgress, options)
  );
};
const findEpisodeByKey = async (key: string) => {
  if (deleted.has(key)) return null;
  const known = index.get(key);
  if (known) return known;
  const parsed = parseEpisodeKey(key);
  if (!parsed) return null;
  const episode = await getPodcastByOwnerAndEpisodeId(
    parsed.ownerName,
    parsed.episodeId
  );
  if (episode) index.set(key, episode);
  return episode;
};

export const usePodcastCrud = (ownerName = '', enabled = true) => {
  const feed = useSyncExternalStore(subscribe, () => getFeed(ownerName));
  const saving = useSyncExternalStore(subscribe, () => save);
  useEffect(() => {
    if (enabled && !getFeed(ownerName).loadedAt) void load(ownerName);
  }, [ownerName, enabled]);
  return {
    ...feed,
    ...saving,
    error: saving.saveError ?? feed.error,
    loadEpisodes: () => {
      clearQortalCache();
      return !ownerName && getFeed('').catalogStarted
        ? ensureCompleteCatalog(true)
        : load(ownerName);
    },
    loadMore: () => load(ownerName, true),
    createEpisode,
    editEpisode,
    removeEpisode,
    resumePublication,
    resolveAudioUrl: getAudioResourceUrl,
    resolveThumbnailUrl: getThumbnailResourceUrl,
    findEpisodeByKey,
  };
};
