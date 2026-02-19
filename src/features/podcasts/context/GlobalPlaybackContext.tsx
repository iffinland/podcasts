import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import { PodcastEpisode } from '../../../types/podcast';

type PlayHandler = (episode: PodcastEpisode) => Promise<void> | void;

interface GlobalPlaybackContextValue {
  playEpisode: (episode: PodcastEpisode) => Promise<void>;
  registerPlayHandler: (handler: PlayHandler | null) => void;
}

const GlobalPlaybackContext = createContext<GlobalPlaybackContextValue | null>(
  null
);

export const GlobalPlaybackProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const handlerRef = useRef<PlayHandler | null>(null);

  const registerPlayHandler = useCallback((handler: PlayHandler | null) => {
    handlerRef.current = handler;
  }, []);

  const playEpisode = useCallback(async (episode: PodcastEpisode) => {
    if (!handlerRef.current) {
      return;
    }

    await handlerRef.current(episode);
  }, []);

  const value = useMemo(
    () => ({
      playEpisode,
      registerPlayHandler,
    }),
    [playEpisode, registerPlayHandler]
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
