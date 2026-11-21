import { readQdnDocument, type QdnResource } from '../cache/qdnDocumentCache';
import { draftIdentity, publishResourceOnce } from './publicationJournal';
import { mapConcurrent } from '../qortal/mapConcurrent';
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
const PODCAST_IMAGE_SERVICE = 'IMAGE';
const PODCAST_IDENTIFIER_PREFIX = 'qpodcasts-episode-';
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;
const MAX_CATEGORIES = 8;
const MAX_CATEGORY_LENGTH = 48;
const MAX_AUDIO_SIZE_BYTES = 250 * 1024 * 1024;
const MAX_THUMBNAIL_SIZE_BYTES = 10 * 1024 * 1024;
const METADATA_VERIFY_RETRIES = 2;
const METADATA_VERIFY_DELAY_MS = 1500;
const AUDIO_PUBLISH_TIMEOUT_MS = 15 * 60 * 1000;
const IMAGE_PUBLISH_TIMEOUT_MS = 5 * 60 * 1000;

type SearchQdnResourceResult = QdnResource;

export type PublishProgressStep =
  | 'validating'
  | 'uploading-audio'
  | 'uploading-thumbnail'
  | 'publishing-metadata'
  | 'verifying-metadata'
  | 'completed';

export interface PublishProgressUpdate {
  step: PublishProgressStep;
  message: string;
}

export interface PublishOptions {
  episodeId?: string;
  operationTime?: number;
  onVerification?: (verified: boolean) => void;
  onProgress?: (update: PublishProgressUpdate) => void;
}

const createEpisodeId = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const values = crypto.getRandomValues(new Uint32Array(1));
    return `${Date.now()}-${values[0].toString(16)}`;
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const toMetadataIdentifier = (episodeId: string) => {
  return `${PODCAST_IDENTIFIER_PREFIX}${episodeId}-meta`;
};

const toAudioIdentifier = (episodeId: string) => {
  return `${PODCAST_IDENTIFIER_PREFIX}${episodeId}-audio`;
};

const toThumbnailIdentifier = (episodeId: string) => {
  return `${PODCAST_IDENTIFIER_PREFIX}${episodeId}-thumb`;
};

const mergeTagsAndCategories = (
  tags: string[],
  categories: string[]
): string[] => {
  return Array.from(new Set([...tags, ...categories]));
};

const sleep = async (durationMs: number) => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
};

const normalizeList = (items: string[]): string[] => {
  return Array.from(
    new Set(items.map((item) => item.trim()).filter((item) => item.length > 0))
  );
};

const validateTagsAndCategories = (tags: string[], categories: string[]) => {
  if (tags.length > MAX_TAGS) {
    throw new Error(`Too many tags. Maximum allowed is ${MAX_TAGS}.`);
  }

  if (categories.length > MAX_CATEGORIES) {
    throw new Error(
      `Too many categories. Maximum allowed is ${MAX_CATEGORIES}.`
    );
  }

  const invalidTag = tags.find((tag) => tag.length > MAX_TAG_LENGTH);
  if (invalidTag) {
    throw new Error(
      `Tag "${invalidTag}" is too long. Max length is ${MAX_TAG_LENGTH}.`
    );
  }

  const invalidCategory = categories.find(
    (category) => category.length > MAX_CATEGORY_LENGTH
  );
  if (invalidCategory) {
    throw new Error(
      `Category "${invalidCategory}" is too long. Max length is ${MAX_CATEGORY_LENGTH}.`
    );
  }
};

const validateFileSize = (file: File, maxSizeBytes: number, label: string) => {
  if (file.size <= maxSizeBytes) {
    return;
  }

  const maxSizeMb = Math.round(maxSizeBytes / (1024 * 1024));
  throw new Error(
    `${label} is too large (${file.name}). Maximum allowed size is ${maxSizeMb} MB.`
  );
};

const emitProgress = (
  options: PublishOptions | undefined,
  step: PublishProgressStep,
  message: string
) => {
  options?.onProgress?.({ step, message });
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

export const parsePodcastMetadata = (raw: unknown): PodcastMetadata | null => {
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

  if (!isObject(normalized) || normalized.version !== 1) {
    return null;
  }

  const audio = normalized.audio;
  const thumbnail = normalized.thumbnail;
  const tags = normalized.tags;
  const categories = normalized.categories;

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

  let parsedCategories: string[] = [];
  if (categories !== undefined) {
    if (
      !Array.isArray(categories) ||
      !categories.every((category) => typeof category === 'string')
    ) {
      return null;
    }

    parsedCategories = categories;
  }

  let parsedThumbnail: PodcastMetadata['thumbnail'] = null;
  if (thumbnail !== null && thumbnail !== undefined) {
    if (!isObject(thumbnail)) {
      return null;
    }

    if (thumbnail.service !== PODCAST_IMAGE_SERVICE) {
      return null;
    }

    if (
      typeof thumbnail.identifier !== 'string' ||
      typeof thumbnail.name !== 'string' ||
      typeof thumbnail.filename !== 'string'
    ) {
      return null;
    }

    parsedThumbnail = {
      service: PODCAST_IMAGE_SERVICE,
      identifier: thumbnail.identifier,
      name: thumbnail.name,
      filename: thumbnail.filename,
    };
  }

  return {
    version: 1,
    episodeId,
    title,
    description,
    tags,
    categories: parsedCategories,
    createdAt,
    updatedAt,
    status,
    audio: {
      service: PODCAST_AUDIO_SERVICE,
      identifier: audio.identifier,
      name: audio.name,
      filename: audio.filename,
    },
    thumbnail: parsedThumbnail,
  };
};

export const buildEpisodeFromMetadata = (
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
    categories: metadata.categories,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    audio: metadata.audio,
    thumbnail: metadata.thumbnail,
  };
};

const truncateUtf8 = (value: string, bytes: number) => {
  let result = '';
  for (const character of value) {
    if (new TextEncoder().encode(result + character).length > bytes) break;
    result += character;
  }
  return result;
};
const publishMetadata = async (
  ownerName: string,
  metadataIdentifier: string,
  metadata: PodcastMetadata
) => {
  await publishResourceOnce({
    action: 'PUBLISH_QDN_RESOURCE',
    service: PODCAST_METADATA_SERVICE,
    name: ownerName,
    identifier: metadataIdentifier,
    title: truncateUtf8(metadata.title, 80),
    description: truncateUtf8(metadata.description, 240),
    tags: mergeTagsAndCategories(metadata.tags, metadata.categories)
      .filter((tag) => tag.length <= 20)
      .slice(0, 5),
    base64: encodeBase64Json(metadata),
  });
};

const publishAudioFile = async (
  ownerName: string,
  audioIdentifier: string,
  audioFile: File,
  options?: PublishOptions
) => {
  await publishResourceOnce(
    {
      action: 'PUBLISH_QDN_RESOURCE',
      service: PODCAST_AUDIO_SERVICE,
      name: ownerName,
      identifier: audioIdentifier,
      filename: audioFile.name,
      file: audioFile,
    },
    AUDIO_PUBLISH_TIMEOUT_MS,
    {
      onProgress: (message) =>
        emitProgress(options, 'uploading-audio', message),
    }
  );
};

const publishThumbnailFile = async (
  ownerName: string,
  thumbnailIdentifier: string,
  thumbnailFile: File,
  options?: PublishOptions
) => {
  await publishResourceOnce(
    {
      action: 'PUBLISH_QDN_RESOURCE',
      service: PODCAST_IMAGE_SERVICE,
      name: ownerName,
      identifier: thumbnailIdentifier,
      filename: thumbnailFile.name,
      file: thumbnailFile,
    },
    IMAGE_PUBLISH_TIMEOUT_MS,
    {
      onProgress: (message) =>
        emitProgress(options, 'uploading-thumbnail', message),
    }
  );
};

const resolveOwnerName = async (providedName?: string): Promise<string> => {
  if (providedName && providedName.trim().length > 0) {
    return providedName.trim();
  }

  const account = await getUserAccount();

  if (account.name && account.name.trim().length > 0) {
    return account.name.trim();
  }

  throw new Error(
    'Authenticated user has no Qortal name. Register a name first.'
  );
};

const verifyMetadataPublication = async (
  ownerName: string,
  metadataIdentifier: string,
  expected: PodcastMetadata
) => {
  for (let attempt = 1; attempt <= METADATA_VERIFY_RETRIES; attempt += 1) {
    try {
      const rawMetadata = await requestQortal<unknown>(
        {
          action: 'FETCH_QDN_RESOURCE',
          service: PODCAST_METADATA_SERVICE,
          name: ownerName,
          identifier: metadataIdentifier,
        },
        { timeoutMs: 12_000 }
      );

      const parsedMetadata = parsePodcastMetadata(rawMetadata);
      if (
        parsedMetadata &&
        JSON.stringify(parsedMetadata) === JSON.stringify(expected)
      ) {
        return true;
      }
    } catch {
      // Retry until attempts are exhausted.
    }

    if (attempt < METADATA_VERIFY_RETRIES) {
      await sleep(METADATA_VERIFY_DELAY_MS);
    }
  }

  return false;
};

export const publishPodcast = async (
  input: PublishPodcastInput,
  options?: PublishOptions
): Promise<PodcastEpisode> => {
  const ownerName = await resolveOwnerName(input.ownerName);
  const draft = options?.episodeId
    ? { id: options.episodeId, createdAt: options.operationTime ?? Date.now() }
    : await draftIdentity(
        JSON.stringify([
          ownerName,
          input.title,
          input.description,
          input.tags,
          input.categories,
          input.audioFile.name,
          input.audioFile.size,
          input.audioFile.lastModified,
          input.thumbnailFile?.name,
          input.thumbnailFile?.size,
          input.thumbnailFile?.lastModified,
        ]),
        createEpisodeId
      );
  const episodeId = draft.id;
  const metadataIdentifier = toMetadataIdentifier(episodeId);
  const audioIdentifier = toAudioIdentifier(episodeId);
  const thumbnailIdentifier = toThumbnailIdentifier(episodeId);
  const tags = normalizeList(input.tags);
  const categories = normalizeList(input.categories);
  const now = options?.operationTime ?? draft.createdAt;
  let publishedThumbnail = false;

  emitProgress(options, 'validating', 'Validating episode data...');
  validateTagsAndCategories(tags, categories);
  validateFileSize(input.audioFile, MAX_AUDIO_SIZE_BYTES, 'Audio file');
  if (input.thumbnailFile) {
    validateFileSize(
      input.thumbnailFile,
      MAX_THUMBNAIL_SIZE_BYTES,
      'Thumbnail image'
    );
  }

  emitProgress(
    options,
    'uploading-audio',
    'Publishing your Podcast file on QDN...'
  );
  await publishAudioFile(ownerName, audioIdentifier, input.audioFile, options);

  if (input.thumbnailFile) {
    emitProgress(
      options,
      'uploading-thumbnail',
      'Publishing thumbnail to QDN...'
    );

    await publishThumbnailFile(
      ownerName,
      thumbnailIdentifier,
      input.thumbnailFile,
      options
    );
    publishedThumbnail = true;
  }

  const metadata: PodcastMetadata = {
    version: 1,
    episodeId,
    title: input.title,
    description: input.description,
    tags,
    categories,
    createdAt: now,
    updatedAt: now,
    status: 'active',
    audio: {
      service: PODCAST_AUDIO_SERVICE,
      identifier: audioIdentifier,
      name: ownerName,
      filename: input.audioFile.name,
    },
    thumbnail:
      input.thumbnailFile && publishedThumbnail
        ? {
            service: PODCAST_IMAGE_SERVICE,
            identifier: thumbnailIdentifier,
            name: ownerName,
            filename: input.thumbnailFile.name,
          }
        : null,
  };

  emitProgress(
    options,
    'publishing-metadata',
    'Publishing episode metadata to QDN...'
  );
  await publishMetadata(ownerName, metadataIdentifier, metadata);

  emitProgress(
    options,
    'verifying-metadata',
    'Verifying metadata availability on QDN...'
  );
  const verified = await verifyMetadataPublication(
    ownerName,
    metadataIdentifier,
    metadata
  );
  options?.onVerification?.(verified);
  emitProgress(
    options,
    'completed',
    verified
      ? 'Publish completed.'
      : 'Publication submitted. QDN availability is pending; do not publish it again.'
  );

  return buildEpisodeFromMetadata(ownerName, metadataIdentifier, metadata);
};

export const searchPodcastPage = async (
  input: SearchPodcastInput = {}
): Promise<{
  episodes: PodcastEpisode[];
  hasMore: boolean;
  failed: number;
}> => {
  const {
    limit = 20,
    offset = 0,
    query,
    ownerName,
    onEpisode,
    onDeleted,
  } = input;

  const searchResponse = await requestQortal<SearchQdnResourceResult[]>(
    {
      action: 'SEARCH_QDN_RESOURCES',
      service: PODCAST_METADATA_SERVICE,
      identifier: PODCAST_IDENTIFIER_PREFIX,
      prefix: true,
      mode: 'ALL',
      reverse: true,
      limit,
      offset,
      query,
      ...(ownerName ? { name: ownerName, exactMatchNames: true } : {}),
    },
    { cacheMs: 30_000 }
  );

  if (!Array.isArray(searchResponse))
    throw new Error('Invalid QDN search response.');
  let failed = 0;

  const results = await mapConcurrent(searchResponse, 4, async (item) => {
    try {
      const rawMetadata = await readQdnDocument('episodes', item);

      const metadata = parsePodcastMetadata(rawMetadata);

      if (
        !metadata ||
        toMetadataIdentifier(metadata.episodeId) !== item.identifier
      ) {
        failed++;
        return null;
      }
      if (metadata.status === 'deleted') {
        onDeleted?.(
          buildEpisodeFromMetadata(item.name, item.identifier, metadata)
        );
        return null;
      }

      const episode = buildEpisodeFromMetadata(
        item.name,
        item.identifier,
        metadata
      );
      onEpisode?.(episode);
      return episode;
    } catch {
      failed++;
      return null;
    }
  });

  return {
    episodes: results
      .filter((entry): entry is PodcastEpisode => entry !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt),
    hasMore: searchResponse.length === limit,
    failed,
  };
};

export const searchPodcasts = async (input: SearchPodcastInput = {}) => {
  return (await searchPodcastPage(input)).episodes;
};

export const getPodcastByOwnerAndEpisodeId = async (
  ownerName: string,
  episodeId: string
): Promise<PodcastEpisode | null> => {
  const normalizedOwnerName = ownerName.trim();
  const normalizedEpisodeId = episodeId.trim();

  if (!normalizedOwnerName || !normalizedEpisodeId) {
    return null;
  }

  const metadataIdentifier = toMetadataIdentifier(normalizedEpisodeId);

  try {
    const rawMetadata = await requestQortal<unknown>({
      action: 'FETCH_QDN_RESOURCE',
      service: PODCAST_METADATA_SERVICE,
      name: normalizedOwnerName,
      identifier: metadataIdentifier,
    });

    const metadata = parsePodcastMetadata(rawMetadata);
    if (
      !metadata ||
      metadata.status === 'deleted' ||
      metadata.episodeId !== normalizedEpisodeId
    ) {
      return null;
    }

    return buildEpisodeFromMetadata(
      normalizedOwnerName,
      metadataIdentifier,
      metadata
    );
  } catch {
    return null;
  }
};

export const updatePodcast = async (
  input: UpdatePodcastInput,
  options?: PublishOptions
): Promise<PodcastEpisode> => {
  const { episode, title, description, tags, newAudioFile, newThumbnailFile } =
    input;
  const normalizedTags = normalizeList(tags);
  const normalizedCategories = normalizeList(input.categories);
  let publishedThumbnail = Boolean(episode.thumbnail);

  emitProgress(options, 'validating', 'Validating updated episode data...');
  validateTagsAndCategories(normalizedTags, normalizedCategories);
  if (newAudioFile) {
    validateFileSize(newAudioFile, MAX_AUDIO_SIZE_BYTES, 'Audio file');
  }
  if (newThumbnailFile) {
    validateFileSize(
      newThumbnailFile,
      MAX_THUMBNAIL_SIZE_BYTES,
      'Thumbnail image'
    );
  }

  if (newAudioFile) {
    emitProgress(
      options,
      'uploading-audio',
      'Publishing updated audio file to QDN...'
    );
    await publishAudioFile(
      episode.ownerName,
      episode.audio.identifier,
      newAudioFile,
      options
    );
  }

  if (newThumbnailFile) {
    emitProgress(
      options,
      'uploading-thumbnail',
      'Publishing updated thumbnail to QDN...'
    );

    try {
      await publishThumbnailFile(
        episode.ownerName,
        episode.thumbnail?.identifier ??
          toThumbnailIdentifier(episode.episodeId),
        newThumbnailFile,
        options
      );

      publishedThumbnail = true;
    } catch (error) {
      publishedThumbnail = Boolean(episode.thumbnail);
      throw error;
    }
  }

  const updatedMetadata: PodcastMetadata = {
    version: 1,
    episodeId: episode.episodeId,
    title,
    description,
    tags: normalizedTags,
    categories: normalizedCategories,
    createdAt: episode.createdAt,
    updatedAt: options?.operationTime ?? Date.now(),
    status: 'active',
    audio: {
      ...episode.audio,
      filename: newAudioFile ? newAudioFile.name : episode.audio.filename,
    },
    thumbnail: newThumbnailFile
      ? publishedThumbnail
        ? {
            service: PODCAST_IMAGE_SERVICE,
            identifier:
              episode.thumbnail?.identifier ??
              toThumbnailIdentifier(episode.episodeId),
            name: episode.ownerName,
            filename: newThumbnailFile.name,
          }
        : null
      : episode.thumbnail,
  };

  emitProgress(
    options,
    'publishing-metadata',
    'Publishing updated metadata to QDN...'
  );
  await publishMetadata(
    episode.ownerName,
    episode.metadataIdentifier,
    updatedMetadata
  );
  emitProgress(
    options,
    'verifying-metadata',
    'Verifying updated metadata on QDN...'
  );
  const verified = await verifyMetadataPublication(
    episode.ownerName,
    episode.metadataIdentifier,
    updatedMetadata
  );
  options?.onVerification?.(verified);
  emitProgress(
    options,
    'completed',
    verified
      ? 'Update completed.'
      : 'Update submitted; QDN verification is pending.'
  );
  return buildEpisodeFromMetadata(
    episode.ownerName,
    episode.metadataIdentifier,
    updatedMetadata
  );
};

export const deletePodcast = async (
  episode: PodcastEpisode,
  options?: PublishOptions
): Promise<void> => {
  const deletedMetadata: PodcastMetadata = {
    version: 1,
    episodeId: episode.episodeId,
    title: episode.title,
    description: episode.description,
    tags: episode.tags,
    categories: episode.categories,
    createdAt: episode.createdAt,
    updatedAt: options?.operationTime ?? Date.now(),
    status: 'deleted',
    audio: episode.audio,
    thumbnail: episode.thumbnail,
  };

  emitProgress(
    options,
    'publishing-metadata',
    'Publishing delete marker to QDN...'
  );
  await publishMetadata(
    episode.ownerName,
    episode.metadataIdentifier,
    deletedMetadata
  );

  emitProgress(
    options,
    'verifying-metadata',
    'Verifying delete marker on QDN...'
  );
  const verified = await verifyMetadataPublication(
    episode.ownerName,
    episode.metadataIdentifier,
    deletedMetadata
  );
  options?.onVerification?.(verified);
  emitProgress(
    options,
    'completed',
    verified
      ? 'Episode marked as deleted.'
      : 'Delete marker submitted; QDN verification is pending.'
  );
};

export const getAudioResourceUrl = async (
  episode: PodcastEpisode
): Promise<string> => {
  const url = await requestQortal<string>(
    {
      action: 'GET_QDN_RESOURCE_URL',
      service: episode.audio.service,
      name: episode.audio.name,
      identifier: episode.audio.identifier,
    },
    { cacheMs: 300_000, priority: 'interactive' }
  );
  if (typeof url !== 'string' || !url)
    throw new Error('QDN returned an invalid media URL.');
  return `${url}${url.includes('?') ? '&' : '?'}v=${episode.updatedAt}`;
};

export const getThumbnailResourceUrl = async (
  episode: PodcastEpisode
): Promise<string | null> => {
  if (!episode.thumbnail) {
    return null;
  }

  const url = await requestQortal<string>(
    {
      action: 'GET_QDN_RESOURCE_URL',
      service: episode.thumbnail.service,
      name: episode.thumbnail.name,
      identifier: episode.thumbnail.identifier,
    },
    { cacheMs: 300_000, priority: 'interactive' }
  );
  if (typeof url !== 'string' || !url)
    throw new Error('QDN returned an invalid media URL.');
  return `${url}${url.includes('?') ? '&' : '?'}v=${episode.updatedAt}`;
};
