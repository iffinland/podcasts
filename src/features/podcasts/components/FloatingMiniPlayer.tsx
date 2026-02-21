import { MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
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

const clampPosition = (position: Position): Position => {
  const maxX = Math.max(EDGE_GAP, window.innerWidth - PLAYER_WIDTH - EDGE_GAP);
  const maxY = Math.max(EDGE_GAP, window.innerHeight - PLAYER_HEIGHT - EDGE_GAP);

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
  const dragOffsetRef = useRef<Position | null>(null);
  const [position, setPosition] = useState<Position>(() => readStoredPosition());
  const [isDragging, setIsDragging] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailKey, setThumbnailKey] = useState<string | null>(null);
  const {
    currentEpisode,
    audioUrl,
    isPlayerOpen,
    isAudioLoading,
    isPlaying,
    playbackError,
    autoPlaySignal,
    closePlayer,
    setPlayingState,
    setPlaybackError,
  } = useGlobalPlayback();

  useEffect(() => {
    const handleResize = () => {
      setPosition((previous) => clampPosition(previous));
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    if (!isPlayerOpen || !audioRef.current || !audioUrl) {
      return;
    }

    void audioRef.current.play().catch((error) => {
      const message =
        error instanceof Error
          ? error.message
          : 'Playback was blocked by the browser.';
      setPlaybackError(message);
      setPlayingState(false);
    });
  }, [audioUrl, autoPlaySignal, isPlayerOpen, setPlaybackError, setPlayingState]);

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

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragOffsetRef.current) {
        return;
      }

      const next = clampPosition({
        x: event.clientX - dragOffsetRef.current.x,
        y: event.clientY - dragOffsetRef.current.y,
      });
      setPosition(next);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragOffsetRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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

  const handleDragStart = (event: ReactMouseEvent<HTMLDivElement>) => {
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
        className={`floating-mini-player surface${isDragging ? ' is-dragging' : ''}`}
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
      >
        <div className="floating-mini-player__drag-handle" onMouseDown={handleDragStart}>
          Mini Player
        </div>
        <p className="floating-mini-player__title" title={titleText}>
          {titleText}
        </p>
        <audio
          ref={audioRef}
          controls
          preload="none"
          src={audioUrl ?? undefined}
          onPlay={() => setPlayingState(true)}
          onPause={() => setPlayingState(false)}
          onError={() => {
            setPlaybackError('Audio playback failed.');
            setPlayingState(false);
          }}
        />
        <div className="floating-mini-player__actions">
          <button type="button" onClick={() => setIsDetailsOpen(true)}>
            View Details
          </button>
          <button type="button" onClick={handleClose}>
            Close
          </button>
        </div>
        {isAudioLoading ? <small>Loading audio...</small> : null}
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
