import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PodcastEpisode } from '../../../types/podcast';
import { getAudioResourceUrl } from '../../../services/qdn/podcastQdnService';

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
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setIsPlayerOpen(true);
    setCurrentEpisode(episode);
    setPlaybackError(null);
    setIsAudioLoading(true);

    try {
      const resolvedUrl = await getAudioResourceUrl(episode);
      if (loadRequestRef.current !== requestId) {
        return;
      }
      setAudioUrl(resolvedUrl);
      setAutoPlaySignal((value) => value + 1);
    } catch (error) {
      if (loadRequestRef.current !== requestId) {
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Failed to load episode audio.';
      setPlaybackError(message);
      setAudioUrl(null);
    } finally {
      if (loadRequestRef.current === requestId) {
        setIsAudioLoading(false);
      }
    }
  }, []);

  const closePlayer = useCallback(() => {
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
