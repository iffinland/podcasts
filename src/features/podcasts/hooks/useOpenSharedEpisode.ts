import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { PodcastEpisode } from '../../../types/podcast';
import { toEpisodeKey } from './podcastKeys';

interface UseOpenSharedEpisodeInput {
  episodes: PodcastEpisode[];
  onMatch: (episode: PodcastEpisode) => void;
  resolveEpisodeByKey?: (episodeKey: string) => Promise<PodcastEpisode | null>;
}

export const useOpenSharedEpisode = ({
  episodes,
  onMatch,
  resolveEpisodeByKey,
}: UseOpenSharedEpisodeInput) => {
  const location = useLocation();
  const handledEpisodeKey = useRef<string | null>(null);
  const attemptedEpisodeKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const openSharedEpisode = async () => {
      const search = new URLSearchParams(location.search);
      const queryKey = search.get('episode');
      const pathMatch = location.pathname.match(/^\/e\/(.+)$/);
      let pathKey: string | null = null;
      if (pathMatch) {
        try {
          pathKey = decodeURIComponent(pathMatch[1]);
        } catch {
          pathKey = null;
        }
      }
      const key = pathKey || queryKey;

      if (!key || key === handledEpisodeKey.current) {
        return;
      }

      let target: PodcastEpisode | null = (
        episodes.find((episode) => toEpisodeKey(episode) === key) ?? null
      );

      if (
        !target &&
        resolveEpisodeByKey &&
        !attemptedEpisodeKeys.current.has(key)
      ) {
        attemptedEpisodeKeys.current.add(key);
        target = await resolveEpisodeByKey(key);
      }

      if (!target || cancelled) {
        return;
      }

      handledEpisodeKey.current = key;
      onMatch(target);
    };

    void openSharedEpisode();

    return () => {
      cancelled = true;
    };
  }, [episodes, location.pathname, location.search, onMatch, resolveEpisodeByKey]);
};
