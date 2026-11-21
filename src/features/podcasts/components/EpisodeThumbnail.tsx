import { useEffect, useRef, useState } from 'react';
import type { PodcastEpisode } from '../../../types/podcast';
import { getThumbnailResourceUrl } from '../../../services/qdn/podcastQdnService';
import {
  waitForQdnMedia,
  forgetMediaReady,
} from '../../../services/media/qdnMedia';
interface EpisodeThumbnailProps {
  src: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  episode?: PodcastEpisode | null;
}
const EpisodeThumbnail = ({
  src,
  alt,
  size = 'md',
  episode,
}: EpisodeThumbnailProps) => {
  const target = useRef<HTMLDivElement>(null);
  const [resolved, setResolved] = useState<string | null>(src);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setFailed(false);
    setResolved(attempt > 0 ? null : src);
    if ((src && attempt === 0) || !episode?.thumbnail || !target.current)
      return;
    let cancelled = false;
    const controller = new AbortController();
    const load = () => {
      void waitForQdnMedia(episode.thumbnail!, {
        signal: controller.signal,
        priority: 'background',
        maxWaitMs: 20000,
        version: episode.updatedAt,
      })
        .then(() => (cancelled ? null : getThumbnailResourceUrl(episode)))
        .then((url) => {
          if (!cancelled)
            setResolved(
              url && attempt > 0
                ? `${url}${url.includes('?') ? '&' : '?'}coverRetry=${attempt}`
                : url
            );
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    };
    if (typeof IntersectionObserver === 'undefined') load();
    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                observer?.disconnect();
                load();
              }
            },
            { rootMargin: '150px' }
          )
        : null;
    if (observer) observer.observe(target.current);
    return () => {
      cancelled = true;
      controller.abort();
      observer?.disconnect();
    };
  }, [src, episode, attempt]);
  return (
    <div ref={target} className={`episode-thumb episode-thumb--${size}`}>
      {resolved && !failed ? (
        <img
          src={resolved}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 'inherit',
          }}
        />
      ) : (
        <span>
          Qortal-Podcasts
          {failed && episode?.thumbnail && (
            <button
              type="button"
              aria-label="Retry cover image"
              onClick={(event) => {
                event.stopPropagation();
                forgetMediaReady(episode.thumbnail!, episode.updatedAt);
                setAttempt((value) => value + 1);
              }}
            >
              Retry cover
            </button>
          )}
        </span>
      )}
    </div>
  );
};
export default EpisodeThumbnail;
