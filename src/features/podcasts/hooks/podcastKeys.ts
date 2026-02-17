import { PodcastEpisode } from '../../../types/podcast';

export const toEpisodeKey = (episode: PodcastEpisode): string => {
  return `${episode.ownerName}::${episode.episodeId}`;
};
