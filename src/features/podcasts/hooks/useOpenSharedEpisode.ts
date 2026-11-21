import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import type { PodcastEpisode } from '../../../types/podcast';
import { toEpisodeKey } from './podcastKeys';
interface UseOpenSharedEpisodeInput {
  episodes: PodcastEpisode[];
  onMatch: (episode: PodcastEpisode) => void;
  resolveEpisodeByKey?: (key: string) => Promise<PodcastEpisode | null>;
}
export const useOpenSharedEpisode = ({
  episodes,
  onMatch,
  resolveEpisodeByKey,
}: UseOpenSharedEpisodeInput) => {
  const location = useLocation();
  const latest = useRef(episodes);
  latest.current = episodes;
  const handled = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let key = new URLSearchParams(location.search).get('episode');
    const match = location.pathname.match(/^\/e\/(.+)$/);
    if (match) {
      try {
        key = decodeURIComponent(match[1]);
      } catch {
        return;
      }
    }
    if (!key || key === handled.current) return;
    const requestedKey = key;
    const known = latest.current.find(
      (episode) => toEpisodeKey(episode) === requestedKey
    );
    void Promise.resolve(known ?? resolveEpisodeByKey?.(requestedKey))
      .then((episode) => {
        if (!cancelled && episode) {
          handled.current = requestedKey;
          onMatch(episode);
        }
      })
      .catch(() => {
        /* The feed remains usable; opening the shared link again can retry. */
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, onMatch, resolveEpisodeByKey]);
};
