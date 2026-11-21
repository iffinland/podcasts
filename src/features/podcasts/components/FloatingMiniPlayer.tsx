import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { forgetMediaReady } from '../../../services/media/qdnMedia';
import { getThumbnailResourceUrl } from '../../../services/qdn/podcastQdnService';
import { useGlobalPlayback } from '../context/GlobalPlaybackContext';
import { toEpisodeKey } from '../hooks/podcastKeys';
import EpisodeDetailsModal from './EpisodeDetailsModal';
import '../styles/floating-mini-player.css';

type Position = {
  x: number;
  y: number;
};

const STORAGE_KEY = 'q-podcasts-mini-player-position';
const PLAYER_WIDTH = 320;
const PLAYER_HEIGHT = 168;
const EDGE_GAP = 12;

const clampPosition = (
  position: Position,
  size = { width: PLAYER_WIDTH, height: PLAYER_HEIGHT }
): Position => {
  const maxX = Math.max(EDGE_GAP, window.innerWidth - size.width - EDGE_GAP);
  const maxY = Math.max(EDGE_GAP, window.innerHeight - size.height - EDGE_GAP);

  return {
    x: Math.min(Math.max(position.x, EDGE_GAP), maxX),
    y: Math.min(Math.max(position.y, EDGE_GAP), maxY),
  };
};

const getDefaultPosition = (): Position => {
  return clampPosition({
    x: window.innerWidth - PLAYER_WIDTH - EDGE_GAP,
    y: window.innerHeight - PLAYER_HEIGHT - EDGE_GAP,
  });
};

const readStoredPosition = (): Position => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getDefaultPosition();
    }

    const parsed = JSON.parse(raw) as Position;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
      return getDefaultPosition();
    }

    return clampPosition(parsed);
  } catch {
    return getDefaultPosition();
  }
};

const FloatingMiniPlayer = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<HTMLElement | null>(null);
  const playerSize = useRef({ width: PLAYER_WIDTH, height: PLAYER_HEIGHT });
  const dragOffsetRef = useRef<Position | null>(null);
  const [position, setPosition] = useState<Position>(() =>
    readStoredPosition()
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailKey, setThumbnailKey] = useState<string | null>(null);
  const {
    currentEpisode,
    playEpisode,
    audioUrl,
    isPlayerOpen,
    isAudioLoading,
    mediaProgress,
    isPlaying,
    playbackError,
    autoPlaySignal,
    closePlayer,
    setPlayingState,
    setBuffering,
    setPlaybackError,
  } = useGlobalPlayback();

  useEffect(() => {
    const element = playerRef.current;
    if (!element) return;
    const adjust = () => {
      const rect = element.getBoundingClientRect();
      playerSize.current = { width: rect.width, height: rect.height };
      setPosition((previous) => clampPosition(previous, playerSize.current));
    };
    adjust();
    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(adjust) : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [isPlayerOpen]);

  useEffect(() => {
    const handleResize = () => {
      setPosition((previous) => clampPosition(previous, playerSize.current));
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (isDragging) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    } catch {
      /* Storage can be unavailable in embedded browsers. */
    }
  }, [position, isDragging]);

  useEffect(() => {
    if (!isPlayerOpen || !audioRef.current || !audioUrl) {
      return;
    }

    const audio = audioRef.current;
    let active = true;
    void audio.play().catch((error) => {
      if (!active || audioRef.current !== audio) return;
      const message =
        error instanceof Error
          ? error.message
          : 'Press Play to start listening.';
      setPlaybackError(
        error?.name === 'NotAllowedError'
          ? 'Audio ready. Press Play to start listening.'
          : message
      );
      setPlayingState(false);
      setBuffering(false);
    });
    return () => {
      active = false;
    };
  }, [
    audioUrl,
    autoPlaySignal,
    isPlayerOpen,
    setPlaybackError,
    setPlayingState,
    setBuffering,
  ]);

  useEffect(() => {
    if (!currentEpisode || !isDetailsOpen) {
      return;
    }

    const key = toEpisodeKey(currentEpisode);
    if (thumbnailKey === key) {
      return;
    }

    let cancelled = false;

    void getThumbnailResourceUrl(currentEpisode)
      .then((url) => {
        if (cancelled) {
          return;
        }
        setThumbnailUrl(url);
        setThumbnailKey(key);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setThumbnailUrl(null);
        setThumbnailKey(key);
      });

    return () => {
      cancelled = true;
    };
  }, [currentEpisode, isDetailsOpen, thumbnailKey]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handleMouseMove = (event: PointerEvent) => {
      if (!dragOffsetRef.current) {
        return;
      }

      const next = clampPosition(
        {
          x: event.clientX - dragOffsetRef.current.x,
          y: event.clientY - dragOffsetRef.current.y,
        },
        playerSize.current
      );
      setPosition(next);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragOffsetRef.current = null;
    };

    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);

    return () => {
      window.removeEventListener('pointermove', handleMouseMove);
      window.removeEventListener('pointerup', handleMouseUp);
    };
  }, [isDragging]);

  const titleText = useMemo(() => {
    if (!currentEpisode) {
      return '';
    }
    return `${currentEpisode.title} @${currentEpisode.ownerName}`;
  }, [currentEpisode]);

  if (!isPlayerOpen || !currentEpisode) {
    return null;
  }

  const handleDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    setIsDragging(true);
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsDetailsOpen(false);
    closePlayer();
  };

  return (
    <>
      <section
        ref={playerRef}
        className={`floating-mini-player surface${isDragging ? ' is-dragging' : ''}`}
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
      >
        <div
          className="floating-mini-player__drag-handle"
          onPointerDown={handleDragStart}
          style={{ touchAction: 'none' }}
        >
          Mini Player
        </div>
        <p className="floating-mini-player__title" title={titleText}>
          {titleText}
        </p>
        <audio
          key={`${currentEpisode.ownerName}::${currentEpisode.episodeId}::${currentEpisode.updatedAt}`}
          ref={audioRef}
          controls
          preload="none"
          src={audioUrl ?? undefined}
          onWaiting={(event) => {
            if (event.currentTarget === audioRef.current && audioUrl)
              setBuffering(true);
          }}
          onStalled={(event) => {
            if (event.currentTarget === audioRef.current && audioUrl)
              setBuffering(true);
          }}
          onCanPlay={(event) => {
            if (event.currentTarget === audioRef.current && audioUrl)
              setBuffering(false);
          }}
          onPlaying={(event) => {
            if (event.currentTarget !== audioRef.current || !audioUrl) return;
            setBuffering(false);
            setPlayingState(true);
          }}
          onEnded={(event) => {
            if (event.currentTarget !== audioRef.current || !audioUrl) return;
            setPlayingState(false);
            setBuffering(false);
          }}
          onPlay={(event) => {
            if (event.currentTarget === audioRef.current) {
              setPlaybackError(null);
              setPlayingState(true);
            }
          }}
          onPause={(event) => {
            if (event.currentTarget === audioRef.current)
              setPlayingState(false);
          }}
          onError={(event) => {
            if (event.currentTarget !== audioRef.current || !audioUrl) return;
            setBuffering(false);
            setPlaybackError(
              'Audio is not available yet. Use Retry to request it again.'
            );
            setPlayingState(false);
          }}
        />
        <div className="floating-mini-player__actions">
          <button type="button" onClick={() => setIsDetailsOpen(true)}>
            View Details
          </button>
          {playbackError && !playbackError.startsWith('Audio ready.') && (
            <button
              type="button"
              onClick={() => {
                const episode = currentEpisode;
                forgetMediaReady(episode.audio, episode.updatedAt);
                closePlayer();
                void playEpisode(episode);
              }}
            >
              Retry
            </button>
          )}
          <button type="button" onClick={handleClose}>
            Close
          </button>
        </div>
        {isAudioLoading ? (
          <small role="status">
            {mediaProgress?.message ?? 'Loading audio...'}
          </small>
        ) : null}
        {isAudioLoading && mediaProgress?.percent !== undefined ? (
          <progress
            max={100}
            value={mediaProgress.percent}
            aria-label="QDN download progress"
          />
        ) : null}
        {playbackError ? (
          <small className="floating-mini-player__error">{playbackError}</small>
        ) : null}
        {isPlaying ? <small>Playing</small> : null}
      </section>
      <EpisodeDetailsModal
        isOpen={isDetailsOpen}
        episode={currentEpisode}
        thumbnailUrl={thumbnailUrl}
        onClose={() => setIsDetailsOpen(false)}
      />
    </>
  );
};

export default FloatingMiniPlayer;
