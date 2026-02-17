export type PodcastAudioReference = {
  service: 'AUDIO';
  identifier: string;
  name: string;
  filename: string;
};

export type PodcastLifecycle = 'active' | 'deleted';

export interface PodcastMetadata {
  version: 1;
  episodeId: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  status: PodcastLifecycle;
  audio: PodcastAudioReference;
}

export interface PodcastEpisode {
  episodeId: string;
  ownerName: string;
  metadataIdentifier: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  audio: PodcastAudioReference;
}

export interface PublishPodcastInput {
  ownerName?: string;
  title: string;
  description: string;
  tags: string[];
  audioFile: File;
}

export interface UpdatePodcastInput {
  episode: PodcastEpisode;
  title: string;
  description: string;
  tags: string[];
  newAudioFile?: File;
}

export interface SearchPodcastInput {
  limit?: number;
  offset?: number;
  query?: string;
}
