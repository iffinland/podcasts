import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { PodcastEpisode } from '../../../types/podcast';

type TopEpisodeEntry = {
  episodeId: string;
  title: string;
  ownerName: string;
  likes: number;
  tips: number;
  episode: PodcastEpisode;
};

interface TopEpisodesContextValue {
  topEpisodes: TopEpisodeEntry[];
  setTopEpisodes: (items: TopEpisodeEntry[]) => void;
}

const TopEpisodesContext = createContext<TopEpisodesContextValue | null>(null);

export const TopEpisodesProvider = ({ children }: { children: ReactNode }) => {
  const [topEpisodes, setTopEpisodes] = useState<TopEpisodeEntry[]>([]);

  const value = useMemo(
    () => ({
      topEpisodes,
      setTopEpisodes,
    }),
    [topEpisodes]
  );

  return <TopEpisodesContext.Provider value={value}>{children}</TopEpisodesContext.Provider>;
};

export const useTopEpisodes = () => {
  const context = useContext(TopEpisodesContext);

  if (!context) {
    throw new Error('useTopEpisodes must be used within TopEpisodesProvider');
  }

  return context;
};

export type { TopEpisodeEntry };
