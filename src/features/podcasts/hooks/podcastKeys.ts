import { PodcastEpisode } from '../../../types/podcast';

export const toEpisodeKey = (episode: PodcastEpisode): string => {
  return `${episode.ownerName}::${episode.episodeId}`;
};

export const parseEpisodeKey = (
  episodeKey: string
): { ownerName: string; episodeId: string } | null => {
  const separatorIndex = episodeKey.indexOf('::');
  if (separatorIndex <= 0 || separatorIndex >= episodeKey.length - 2) {
    return null;
  }

  const ownerName = episodeKey.slice(0, separatorIndex).trim();
  const episodeId = episodeKey.slice(separatorIndex + 2).trim();

  if (!ownerName || !episodeId) {
    return null;
  }

  return { ownerName, episodeId };
};
