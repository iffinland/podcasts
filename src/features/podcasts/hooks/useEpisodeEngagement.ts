import { useCallback, useEffect, useMemo, useState } from 'react';
import { PodcastEpisode } from '../../../types/podcast';
import { toEpisodeKey } from './podcastKeys';
import { fetchAllFeedback, fetchUserFeedback, upsertFeedback } from '../../../services/engagement/episodeEngagementService';

type EpisodeStats = {
  likes: number;
  tips: number;
};

export const useEpisodeEngagement = (activeName: string | null) => {
  const [statsByEpisode, setStatsByEpisode] = useState<Record<string, EpisodeStats>>({});
  const [likedKeys, setLikedKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    try {
      const feedbacks = await fetchAllFeedback();
      const stats: Record<string, EpisodeStats> = {};
      const liked = new Set<string>();

      feedbacks.forEach((feedback) => {
        const current = stats[feedback.episodeId] ?? { likes: 0, tips: 0 };
        const likes = current.likes + (feedback.like ? 1 : 0);
        const tips = current.tips + feedback.tipCount;
        stats[feedback.episodeId] = { likes, tips };

        if (activeName && feedback.userName.toLowerCase() === activeName.toLowerCase() && feedback.like) {
          liked.add(feedback.episodeId);
        }
      });

      setStatsByEpisode(stats);
      setLikedKeys(liked);
    } finally {
      setIsLoading(false);
    }
  }, [activeName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getStats = useCallback(
    (episode: PodcastEpisode): EpisodeStats => {
      return statsByEpisode[episode.episodeId] ?? { likes: 0, tips: 0 };
    },
    [statsByEpisode]
  );

  const likedSet = useMemo(() => {
    const mapped = new Set<string>();
    likedKeys.forEach((episodeId) => mapped.add(episodeId));
    return mapped;
  }, [likedKeys]);

  const toggleLike = useCallback(
    async (episode: PodcastEpisode) => {
      if (!activeName) {
        return;
      }

      const current = await fetchUserFeedback(activeName, episode.episodeId);
      const nextLike = !(current?.like ?? false);
      const nextTipCount = current?.tipCount ?? 0;
      const nextTipTotal = current?.tipTotal ?? 0;

      await upsertFeedback(activeName, episode.episodeId, {
        like: nextLike,
        tipCount: nextTipCount,
        tipTotal: nextTipTotal,
      });

      setStatsByEpisode((previous) => {
        const existing = previous[episode.episodeId] ?? { likes: 0, tips: 0 };
        const likes = nextLike ? existing.likes + 1 : Math.max(existing.likes - 1, 0);
        return {
          ...previous,
          [episode.episodeId]: {
            likes,
            tips: existing.tips,
          },
        };
      });

      setLikedKeys((previous) => {
        const next = new Set(previous);
        if (nextLike) {
          next.add(episode.episodeId);
        } else {
          next.delete(episode.episodeId);
        }
        return next;
      });
    },
    [activeName]
  );

  const registerTip = useCallback(
    async (episode: PodcastEpisode, amount: number) => {
      if (!activeName || amount <= 0) {
        return;
      }

      const current = await fetchUserFeedback(activeName, episode.episodeId);
      await upsertFeedback(activeName, episode.episodeId, {
        like: current?.like ?? false,
        tipCount: (current?.tipCount ?? 0) + 1,
        tipTotal: (current?.tipTotal ?? 0) + amount,
      });

      setStatsByEpisode((previous) => {
        const existing = previous[episode.episodeId] ?? { likes: 0, tips: 0 };
        return {
          ...previous,
          [episode.episodeId]: {
            likes: existing.likes,
            tips: existing.tips + 1,
          },
        };
      });
    },
    [activeName]
  );

  const getTopEpisodes = useCallback(
    (episodes: PodcastEpisode[]) => {
      return [...episodes]
        .map((episode) => {
          const stats = statsByEpisode[episode.episodeId] ?? { likes: 0, tips: 0 };
          return {
            episode,
            likes: stats.likes,
            tips: stats.tips,
          };
        })
        .filter((item) => item.likes > 0 || item.tips > 0)
        .sort((a, b) => b.likes - a.likes || b.tips - a.tips)
        .slice(0, 6);
    },
    [statsByEpisode]
  );

  const mapLikesSetByKey = useCallback(
    (episodes: PodcastEpisode[]) => {
      const byKey = new Set<string>();
      episodes.forEach((episode) => {
        if (likedSet.has(episode.episodeId)) {
          byKey.add(toEpisodeKey(episode));
        }
      });
      return byKey;
    },
    [likedSet]
  );

  return {
    isLoading,
    refresh,
    toggleLike,
    registerTip,
    getStats,
    getTopEpisodes,
    mapLikesSetByKey,
  };
};
