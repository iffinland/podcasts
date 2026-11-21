import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { PodcastEpisode } from '../../../types/podcast';
import { toEpisodeKey } from './podcastKeys';
import {
  fetchAllFeedback,
  fetchUserFeedback,
  upsertFeedback,
  type FeedbackPayload,
  type FeedbackSyncProgress,
} from '../../../services/engagement/episodeEngagementService';
import { errorMessage } from '../../../services/qortal/qortalClient';
let snapshot = {
  feedback: [] as FeedbackPayload[],
  isLoading: false,
  error: null as string | null,
  loadedAt: 0,
  isComplete: false,
  isCached: false,
  processed: 0,
  total: 0,
  failed: 0,
  discovering: false,
  localPending: 0,
};
const listeners = new Set<() => void>();
const locks = new Set<string>();
const localFeedback = new Map<string, FeedbackPayload>();
const feedbackKey = (item: FeedbackPayload) =>
  `${item.userName.toLowerCase()}::${item.episodeId}`;
let flight: Promise<void> | null = null;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const patch = (value: Partial<typeof snapshot>) => {
  snapshot = { ...snapshot, ...value };
  listeners.forEach((fn) => fn());
};
const mergeFeedback = (incoming: FeedbackPayload[]) => {
  const all = new Map<string, FeedbackPayload>();
  for (const item of [...snapshot.feedback, ...incoming]) {
    const key = `${item.userName.toLowerCase()}::${item.episodeId}`;
    if (!all.has(key) || all.get(key)!.updatedAt <= item.updatedAt)
      all.set(key, item);
  }
  return [...all.values()];
};
const reconcile = (incoming: FeedbackPayload[]) => {
  const current = new Map(incoming.map((item) => [feedbackKey(item), item]));
  for (const [key, item] of localFeedback) {
    const remote = current.get(key);
    if (remote && remote.updatedAt >= item.updatedAt) {
      localFeedback.delete(key);
      continue;
    }
    current.set(key, item);
  }
  return [...current.values()];
};
const refresh = () => {
  if (flight) return flight;
  let progress: FeedbackSyncProgress = {
    discovered: 0,
    processed: 0,
    failed: 0,
    ignored: 0,
    discovering: true,
    cached: false,
  };
  patch({ isLoading: true, isComplete: false, error: null, discovering: true });
  flight = fetchAllFeedback(
    (feedback) => patch({ feedback: mergeFeedback(feedback) }),
    (value) => {
      progress = value;
      patch({
        processed: value.processed,
        total: value.discovered,
        failed: value.failed,
        discovering: value.discovering,
        isCached: value.cached,
      });
    }
  )
    .then((feedback) =>
      patch({
        feedback: reconcile(feedback),
        loadedAt: Date.now(),
        isComplete: progress.failed === 0,
        isCached: progress.failed > 0,
        error: progress.failed
          ? `${progress.failed} feedback resources are unavailable. Statistics are incomplete; retry to check them.`
          : null,
        localPending: localFeedback.size,
      })
    )
    .catch((error) => patch({ error: errorMessage(error), isComplete: false }))
    .finally(() => {
      flight = null;
      patch({ isLoading: false, discovering: false });
    });
  return flight;
};
const put = (feedback: FeedbackPayload) => {
  localFeedback.set(feedbackKey(feedback), feedback);
  patch({
    feedback: reconcile(
      snapshot.feedback.filter(
        (item) => feedbackKey(item) !== feedbackKey(feedback)
      )
    ),
    localPending: localFeedback.size,
  });
};
type AggregateIndex = {
  stats: Map<string, { likes: number; tips: number }>;
  likedByUser: Map<string, Set<string>>;
};
const aggregateCache = new WeakMap<FeedbackPayload[], AggregateIndex>();
const aggregateKey = (episodeId: string, ownerName?: string) =>
  JSON.stringify([ownerName?.toLowerCase() ?? null, episodeId]);
const aggregateFeedback = (feedback: FeedbackPayload[]) => {
  const hit = aggregateCache.get(feedback);
  if (hit) return hit;
  const stats = new Map<string, { likes: number; tips: number }>();
  const likedByUser = new Map<string, Set<string>>();
  for (const item of feedback) {
    const key = aggregateKey(item.episodeId, item.ownerName);
    const previous = stats.get(key) ?? { likes: 0, tips: 0 };
    stats.set(key, {
      likes: previous.likes + (item.like ? 1 : 0),
      tips: previous.tips + item.tipCount,
    });
    if (item.like) {
      const user = item.userName.toLowerCase();
      if (!likedByUser.has(user)) likedByUser.set(user, new Set());
      likedByUser.get(user)!.add(key);
    }
  }
  const result = { stats, likedByUser };
  aggregateCache.set(feedback, result);
  return result;
};
export const useEpisodeEngagement = (activeName: string | null) => {
  const state = useSyncExternalStore(subscribe, () => snapshot);
  useEffect(() => {
    if (
      (!snapshot.loadedAt || Date.now() - snapshot.loadedAt > 120_000) &&
      !flight
    )
      void refresh();
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - snapshot.loadedAt > 120_000
      )
        void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  const aggregates = useMemo(
    () => aggregateFeedback(state.feedback),
    [state.feedback]
  );
  const getStats = useCallback(
    (episode: PodcastEpisode) => {
      const own = aggregates.stats.get(
        aggregateKey(episode.episodeId, episode.ownerName)
      );
      const legacy = aggregates.stats.get(aggregateKey(episode.episodeId));
      return {
        likes: (own?.likes ?? 0) + (legacy?.likes ?? 0),
        tips: (own?.tips ?? 0) + (legacy?.tips ?? 0),
      };
    },
    [aggregates]
  );
  const mapLikesSetByKey = useCallback(
    (episodes: PodcastEpisode[]) => {
      const liked = aggregates.likedByUser.get(activeName?.toLowerCase() ?? '');
      return new Set(
        episodes
          .filter(
            (episode) =>
              liked?.has(aggregateKey(episode.episodeId, episode.ownerName)) ||
              liked?.has(aggregateKey(episode.episodeId))
          )
          .map(toEpisodeKey)
      );
    },
    [aggregates, activeName]
  );
  const toggleLike = useCallback(
    async (episode: PodcastEpisode) => {
      if (!activeName) throw new Error('Select a Qortal name first.');
      const key = `${activeName}::${toEpisodeKey(episode)}`;
      if (locks.has(key)) return;
      locks.add(key);
      try {
        const current = await fetchUserFeedback(activeName, episode.episodeId);
        put(
          await upsertFeedback(activeName, episode.episodeId, {
            like: !current?.like,
            tipCount: current?.tipCount ?? 0,
            tipTotal: current?.tipTotal ?? 0,
            ownerName: episode.ownerName,
          })
        );
      } finally {
        locks.delete(key);
      }
    },
    [activeName]
  );
  const registerTip = useCallback(
    async (episode: PodcastEpisode, amount: number) => {
      if (!activeName || amount <= 0) return;
      const key = `${activeName}::${toEpisodeKey(episode)}`;
      if (locks.has(key))
        throw new Error(
          'Feedback update is busy; the payment was already sent.'
        );
      locks.add(key);
      try {
        const current = await fetchUserFeedback(activeName, episode.episodeId);
        put(
          await upsertFeedback(activeName, episode.episodeId, {
            like: current?.like ?? false,
            tipCount: (current?.tipCount ?? 0) + 1,
            tipTotal: (current?.tipTotal ?? 0) + amount,
            ownerName: episode.ownerName,
          })
        );
      } finally {
        locks.delete(key);
      }
    },
    [activeName]
  );
  const getTopEpisodes = useCallback(
    (episodes: PodcastEpisode[]) =>
      episodes
        .map((episode) => ({ episode, ...getStats(episode) }))
        .filter((item) => item.likes > 0 || item.tips > 0)
        .sort((a, b) => b.likes - a.likes || b.tips - a.tips)
        .slice(0, 15),
    [getStats]
  );
  return useMemo(
    () => ({
      ...state,
      refresh,
      getStats,
      mapLikesSetByKey,
      toggleLike,
      registerTip,
      getTopEpisodes,
    }),
    [state, getStats, mapLikesSetByKey, toggleLike, registerTip, getTopEpisodes]
  );
};
