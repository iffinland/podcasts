import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PodcastEpisode } from '../../../types/podcast';
import { getAudioResourceUrl } from '../../../services/qdn/podcastQdnService';

import {
  waitForQdnMedia,
  forgetMediaReady,
  type MediaProgress,
} from '../../../services/media/qdnMedia';

interface GlobalPlaybackContextValue {
  playEpisode: (episode: PodcastEpisode) => Promise<void>;
  closePlayer: () => void;
  currentEpisode: PodcastEpisode | null;
  audioUrl: string | null;
  isPlayerOpen: boolean;
  isAudioLoading: boolean;
  isPlaying: boolean;
  playbackError: string | null;
  autoPlaySignal: number;
  mediaProgress: MediaProgress | null;
  setBuffering: (loading: boolean) => void;
  setPlayingState: (isPlaying: boolean) => void;
  setPlaybackError: (message: string | null) => void;
  isCurrentEpisode: (episode: PodcastEpisode) => boolean;
}

const GlobalPlaybackContext = createContext<GlobalPlaybackContextValue | null>(
  null
);

export const GlobalPlaybackProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const loadRequestRef = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      ++loadRequestRef.current;
    },
    []
  );
  const [mediaProgress, setMediaProgress] = useState<MediaProgress | null>(
    null
  );
  const setBuffering = useCallback((loading: boolean) => {
    setIsAudioLoading(loading);
    setMediaProgress(
      loading ? { phase: 'buffering', message: 'Buffering audio...' } : null
    );
  }, []);
  const selection = useRef<string | null>(null);
  const resolved = useRef<string | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PodcastEpisode | null>(
    null
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [autoPlaySignal, setAutoPlaySignal] = useState(0);

  const playEpisode = useCallback(async (episode: PodcastEpisode) => {
    const key = `${episode.ownerName}::${episode.episodeId}::${episode.updatedAt}`;
    if (selection.current === key && resolved.current) {
      setIsPlayerOpen(true);
      setAutoPlaySignal((value) => value + 1);
      return;
    }
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    selection.current = key;
    resolved.current = null;
    setAudioUrl(null);
    setIsPlaying(false);
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setIsPlayerOpen(true);
    setCurrentEpisode(episode);
    setPlaybackError(null);
    setIsAudioLoading(true);
    setMediaProgress({
      phase: 'checking',
      message: 'Checking QDN availability...',
    });

    try {
      await waitForQdnMedia(episode.audio, {
        signal: abort.signal,
        version: episode.updatedAt,
        onProgress: (progress) => {
          if (loadRequestRef.current === requestId) setMediaProgress(progress);
        },
      });
      if (loadRequestRef.current !== requestId) return;
      const resolvedUrl = await getAudioResourceUrl(episode);
      if (loadRequestRef.current !== requestId) {
        return;
      }
      setMediaProgress({ phase: 'buffering', message: 'Buffering audio...' });
      resolved.current = resolvedUrl;
      setAudioUrl(resolvedUrl);
      setAutoPlaySignal((value) => value + 1);
    } catch (error) {
      if (loadRequestRef.current !== requestId) {
        return;
      }
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load episode audio.';
      forgetMediaReady(episode.audio, episode.updatedAt);
      setMediaProgress(null);
      setPlaybackError(message);
      setIsAudioLoading(false);
      setAudioUrl(null);
    }
  }, []);

  const closePlayer = useCallback(() => {
    controller.current?.abort();
    ++loadRequestRef.current;
    selection.current = null;
    resolved.current = null;
    setMediaProgress(null);
    setIsPlayerOpen(false);
    setIsAudioLoading(false);
    setIsPlaying(false);
    setPlaybackError(null);
    setCurrentEpisode(null);
    setAudioUrl(null);
  }, []);

  const isCurrentEpisode = useCallback(
    (episode: PodcastEpisode) => {
      return Boolean(
        currentEpisode &&
          currentEpisode.episodeId === episode.episodeId &&
          currentEpisode.ownerName === episode.ownerName
      );
    },
    [currentEpisode]
  );

  const value = useMemo(
    () => ({
      playEpisode,
      closePlayer,
      currentEpisode,
      audioUrl,
      isPlayerOpen,
      isAudioLoading,
      isPlaying,
      playbackError,
      autoPlaySignal,
      mediaProgress,
      setBuffering,
      setPlayingState: setIsPlaying,
      setPlaybackError,
      isCurrentEpisode,
    }),
    [
      playEpisode,
      closePlayer,
      currentEpisode,
      audioUrl,
      isPlayerOpen,
      isAudioLoading,
      isPlaying,
      playbackError,
      autoPlaySignal,
      mediaProgress,
      setBuffering,
      isCurrentEpisode,
    ]
  );

  return (
    <GlobalPlaybackContext.Provider value={value}>
      {children}
    </GlobalPlaybackContext.Provider>
  );
};

export const useGlobalPlayback = () => {
  const context = useContext(GlobalPlaybackContext);

  if (!context) {
    throw new Error(
      'useGlobalPlayback must be used within GlobalPlaybackProvider'
    );
  }

  return context;
};
