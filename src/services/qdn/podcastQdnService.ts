import {
  PodcastEpisode,
  PodcastMetadata,
  PublishPodcastInput,
  SearchPodcastInput,
  UpdatePodcastInput,
} from '../../types/podcast';
import { requestQortal } from '../qortal/qortalClient';
import { getUserAccount } from '../qortal/walletService';

const PODCAST_METADATA_SERVICE = 'PODCAST';
const PODCAST_AUDIO_SERVICE = 'AUDIO';
const PODCAST_IDENTIFIER_PREFIX = 'qpodcasts-episode-';

interface SearchQdnResourceResult {
  name: string;
  identifier: string;
  created?: number;
  updated?: number;
}

const createEpisodeId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}`;
};

const toMetadataIdentifier = (episodeId: string) => {
  return `${PODCAST_IDENTIFIER_PREFIX}${episodeId}-meta`;
};

const toAudioIdentifier = (episodeId: string) => {
  return `${PODCAST_IDENTIFIER_PREFIX}${episodeId}-audio`;
};

const encodeBase64Json = (value: unknown): string => {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
};

const decodeBase64Json = (value: string): unknown => {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const decoded = new TextDecoder().decode(bytes);
  return JSON.parse(decoded) as unknown;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const parsePodcastMetadata = (raw: unknown): PodcastMetadata | null => {
  let normalized: unknown = raw;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();

    try {
      normalized = JSON.parse(trimmed) as unknown;
    } catch {
      try {
        normalized = decodeBase64Json(trimmed);
      } catch {
        return null;
      }
    }
  }

  if (!isObject(normalized)) {
    return null;
  }

  const audio = normalized.audio;
  const tags = normalized.tags;

  if (!isObject(audio)) {
    return null;
  }

  if (audio.service !== PODCAST_AUDIO_SERVICE) {
    return null;
  }

  const episodeId = normalized.episodeId;
  const title = normalized.title;
  const description = normalized.description;
  const createdAt = normalized.createdAt;
  const updatedAt = normalized.updatedAt;
  const status = normalized.status;

  if (typeof episodeId !== 'string' || episodeId.length === 0) {
    return null;
  }

  if (typeof title !== 'string' || typeof description !== 'string') {
    return null;
  }

  if (typeof createdAt !== 'number' || typeof updatedAt !== 'number') {
    return null;
  }

  if (status !== 'active' && status !== 'deleted') {
    return null;
  }

  if (
    typeof audio.identifier !== 'string' ||
    typeof audio.name !== 'string' ||
    typeof audio.filename !== 'string'
  ) {
    return null;
  }

  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) {
    return null;
  }

  return {
    version: 1,
    episodeId,
    title,
    description,
    tags,
    createdAt,
    updatedAt,
    status,
    audio: {
      service: PODCAST_AUDIO_SERVICE,
      identifier: audio.identifier,
      name: audio.name,
      filename: audio.filename,
    },
  };
};

const buildEpisodeFromMetadata = (
  ownerName: string,
  metadataIdentifier: string,
  metadata: PodcastMetadata
): PodcastEpisode => {
  return {
    episodeId: metadata.episodeId,
    ownerName,
    metadataIdentifier,
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    audio: metadata.audio,
  };
};

const publishMetadata = async (
  ownerName: string,
  metadataIdentifier: string,
  metadata: PodcastMetadata
) => {
  await requestQortal<unknown>({
    action: 'PUBLISH_QDN_RESOURCE',
    service: PODCAST_METADATA_SERVICE,
    name: ownerName,
    identifier: metadataIdentifier,
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags,
    base64: encodeBase64Json(metadata),
  });
};

const publishAudioFile = async (
  ownerName: string,
  audioIdentifier: string,
  title: string,
  description: string,
  tags: string[],
  audioFile: File
) => {
  await requestQortal<unknown>({
    action: 'PUBLISH_QDN_RESOURCE',
    service: PODCAST_AUDIO_SERVICE,
    name: ownerName,
    identifier: audioIdentifier,
    title,
    description,
    tags,
    filename: audioFile.name,
    file: audioFile,
  });
};

const resolveOwnerName = async (providedName?: string): Promise<string> => {
  if (providedName && providedName.trim().length > 0) {
    return providedName.trim();
  }

  const account = await getUserAccount();

  if (account.name && account.name.trim().length > 0) {
    return account.name.trim();
  }

  throw new Error('Authenticated user has no Qortal name. Register a name first.');
};

export const publishPodcast = async (input: PublishPodcastInput): Promise<PodcastEpisode> => {
  const ownerName = await resolveOwnerName(input.ownerName);
  const episodeId = createEpisodeId();
  const metadataIdentifier = toMetadataIdentifier(episodeId);
  const audioIdentifier = toAudioIdentifier(episodeId);
  const now = Date.now();

  await publishAudioFile(
    ownerName,
    audioIdentifier,
    input.title,
    input.description,
    input.tags,
    input.audioFile
  );

  const metadata: PodcastMetadata = {
    version: 1,
    episodeId,
    title: input.title,
    description: input.description,
    tags: input.tags,
    createdAt: now,
    updatedAt: now,
    status: 'active',
    audio: {
      service: PODCAST_AUDIO_SERVICE,
      identifier: audioIdentifier,
      name: ownerName,
      filename: input.audioFile.name,
    },
  };

  await publishMetadata(ownerName, metadataIdentifier, metadata);
  return buildEpisodeFromMetadata(ownerName, metadataIdentifier, metadata);
};

export const searchPodcasts = async (
  input: SearchPodcastInput = {}
): Promise<PodcastEpisode[]> => {
  const { limit = 20, offset = 0, query } = input;

  const searchResponse = await requestQortal<SearchQdnResourceResult[]>({
    action: 'SEARCH_QDN_RESOURCES',
    service: PODCAST_METADATA_SERVICE,
    identifier: PODCAST_IDENTIFIER_PREFIX,
    prefix: true,
    mode: 'ALL',
    reverse: true,
    limit,
    offset,
    query,
  });

  if (!Array.isArray(searchResponse)) {
    return [];
  }

  const results = await Promise.all(
    searchResponse.map(async (item) => {
      try {
        const rawMetadata = await requestQortal<unknown>({
          action: 'FETCH_QDN_RESOURCE',
          service: PODCAST_METADATA_SERVICE,
          name: item.name,
          identifier: item.identifier,
        });

        const metadata = parsePodcastMetadata(rawMetadata);

        if (!metadata || metadata.status === 'deleted') {
          return null;
        }

        return buildEpisodeFromMetadata(item.name, item.identifier, metadata);
      } catch {
        return null;
      }
    })
  );

  return results
    .filter((entry): entry is PodcastEpisode => entry !== null)
    .sort((first, second) => second.updatedAt - first.updatedAt);
};

export const updatePodcast = async (input: UpdatePodcastInput): Promise<PodcastEpisode> => {
  const { episode, title, description, tags, newAudioFile } = input;

  if (newAudioFile) {
    await publishAudioFile(
      episode.ownerName,
      episode.audio.identifier,
      title,
      description,
      tags,
      newAudioFile
    );
  }

  const updatedMetadata: PodcastMetadata = {
    version: 1,
    episodeId: episode.episodeId,
    title,
    description,
    tags,
    createdAt: episode.createdAt,
    updatedAt: Date.now(),
    status: 'active',
    audio: {
      ...episode.audio,
      filename: newAudioFile ? newAudioFile.name : episode.audio.filename,
    },
  };

  await publishMetadata(episode.ownerName, episode.metadataIdentifier, updatedMetadata);
  return buildEpisodeFromMetadata(episode.ownerName, episode.metadataIdentifier, updatedMetadata);
};

export const deletePodcast = async (episode: PodcastEpisode): Promise<void> => {
  await requestQortal<unknown>({
    action: 'DELETE_HOSTED_DATA',
    hostedData: [
      {
        service: PODCAST_METADATA_SERVICE,
        name: episode.ownerName,
        identifier: episode.metadataIdentifier,
      },
      {
        service: PODCAST_AUDIO_SERVICE,
        name: episode.audio.name,
        identifier: episode.audio.identifier,
      },
    ],
  });
};

export const getAudioResourceUrl = async (episode: PodcastEpisode): Promise<string> => {
  return requestQortal<string>({
    action: 'GET_QDN_RESOURCE_URL',
    service: episode.audio.service,
    name: episode.audio.name,
    identifier: episode.audio.identifier,
  });
};
