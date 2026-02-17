export type PodcastAudioReference = {
  service: 'AUDIO';
  identifier: string;
  name: string;
  filename: string;
};

export type PodcastThumbnailReference = {
  service: 'IMAGE';
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
  categories: string[];
  createdAt: number;
  updatedAt: number;
  status: PodcastLifecycle;
  audio: PodcastAudioReference;
  thumbnail: PodcastThumbnailReference | null;
}

export interface PodcastEpisode {
  episodeId: string;
  ownerName: string;
  metadataIdentifier: string;
  title: string;
  description: string;
  tags: string[];
  categories: string[];
  createdAt: number;
  updatedAt: number;
  audio: PodcastAudioReference;
  thumbnail: PodcastThumbnailReference | null;
}

export interface PublishPodcastInput {
  ownerName?: string;
  title: string;
  description: string;
  tags: string[];
  categories: string[];
  audioFile: File;
  thumbnailFile?: File;
}

export interface UpdatePodcastInput {
  episode: PodcastEpisode;
  title: string;
  description: string;
  tags: string[];
  categories: string[];
  newAudioFile?: File;
  newThumbnailFile?: File;
}

export interface SearchPodcastInput {
  limit?: number;
  offset?: number;
  query?: string;
}
