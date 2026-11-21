import {
  cachedDocuments,
  documentKey,
  pruneDocuments,
  readQdnDocument,
  type QdnResource,
} from '../cache/qdnDocumentCache';
import { discoverResources } from '../qdn/resourceDiscovery';
import { mapConcurrent } from '../qortal/mapConcurrent';
import { requestQortal } from '../qortal/qortalClient';

const FEEDBACK_SERVICE = 'PODCAST';
const FEEDBACK_PREFIX = 'qpodcasts-feedback-';

export type FeedbackPayload = {
  ownerName?: string;
  version: 1;
  episodeId: string;
  userName: string;
  like: boolean;
  tipCount: number;
  tipTotal: number;
  updatedAt: number;
};

type SearchResult = QdnResource;

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

const feedbackIdentifier = (episodeId: string) => {
  return `${FEEDBACK_PREFIX}${episodeId}`;
};

const legacyFeedbackIdentifier = (episodeId: string, userName: string) => {
  return `${FEEDBACK_PREFIX}${episodeId}-${userName.toLowerCase()}`;
};

const parseFeedback = (raw: unknown): FeedbackPayload | null => {
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

  const episodeId = normalized.episodeId;
  const userName = normalized.userName;
  const like = normalized.like;
  const tipCount = normalized.tipCount;
  const tipTotal = normalized.tipTotal;
  const updatedAt = normalized.updatedAt;

  if (
    typeof episodeId !== 'string' ||
    typeof userName !== 'string' ||
    typeof like !== 'boolean' ||
    typeof tipCount !== 'number' ||
    typeof tipTotal !== 'number' ||
    typeof updatedAt !== 'number' ||
    !Number.isFinite(tipCount) ||
    tipCount < 0 ||
    !Number.isInteger(tipCount) ||
    !Number.isFinite(tipTotal) ||
    tipTotal < 0 ||
    !Number.isFinite(updatedAt)
  ) {
    return null;
  }

  return {
    version: 1,
    ...(typeof normalized.ownerName === 'string'
      ? { ownerName: normalized.ownerName }
      : {}),
    episodeId,
    userName,
    like,
    tipCount,
    tipTotal,
    updatedAt,
  };
};

export type FeedbackSyncProgress = {
  discovered: number;
  processed: number;
  failed: number;
  ignored: number;
  discovering: boolean;
  cached: boolean;
};
const trustedFeedback = (raw: unknown, resource: QdnResource) => {
  const feedback = parseFeedback(raw);
  if (
    !feedback ||
    feedback.userName.toLowerCase() !== resource.name.toLowerCase()
  )
    return null;
  if (
    ![
      feedbackIdentifier(feedback.episodeId),
      legacyFeedbackIdentifier(feedback.episodeId, resource.name),
    ].includes(resource.identifier)
  )
    return null;
  return feedback;
};
export const fetchAllFeedback = async (
  onBatch?: (feedback: FeedbackPayload[]) => void,
  onProgress?: (progress: FeedbackSyncProgress) => void
): Promise<FeedbackPayload[]> => {
  const progress: FeedbackSyncProgress = {
    discovered: 0,
    processed: 0,
    failed: 0,
    ignored: 0,
    discovering: true,
    cached: false,
  };
  const cached = await cachedDocuments('feedback');
  const fallback = new Map(cached.map((entry) => [entry.key, entry]));
  const latest = new Map<
    string,
    { feedback: FeedbackPayload; revision: number; canonical: boolean }
  >();
  const accept = (feedback: FeedbackPayload, resource: QdnResource) => {
    const key = `${feedback.userName.toLowerCase()}::${feedback.episodeId}`;
    const revision = resource.updated ?? resource.created ?? feedback.updatedAt;
    const canonical =
      resource.identifier === feedbackIdentifier(feedback.episodeId);
    const previous = latest.get(key);
    if (
      !previous ||
      revision > previous.revision ||
      (revision === previous.revision && canonical)
    )
      latest.set(key, { feedback, revision, canonical });
  };
  for (const entry of cached) {
    const feedback = trustedFeedback(entry.value, entry.resource);
    if (feedback) accept(feedback, entry.resource);
  }
  if (latest.size) {
    progress.cached = true;
    onBatch?.([...latest.values()].map((item) => item.feedback));
  }
  onProgress?.({ ...progress });
  const resources = await discoverResources(FEEDBACK_PREFIX, (items) => {
    progress.discovered = items.length;
    onProgress?.({ ...progress });
  });
  // Cached entries absent from a complete resource index must not live forever.
  latest.clear();
  progress.discovering = false;
  onProgress?.({ ...progress });
  await mapConcurrent(resources, 2, async (resource) => {
    try {
      const raw = await readQdnDocument('feedback', resource, {
        priority: 'background',
      });
      const feedback = trustedFeedback(raw, resource);
      if (feedback) accept(feedback, resource);
      else progress.ignored++;
    } catch {
      progress.failed++;
      const previous = fallback.get(documentKey('feedback', resource));
      const feedback =
        previous && trustedFeedback(previous.value, previous.resource);
      if (feedback) accept(feedback, previous!.resource);
    }
    progress.processed++;
    if (
      progress.processed % 20 === 0 ||
      progress.processed === resources.length
    ) {
      onBatch?.([...latest.values()].map((item) => item.feedback));
      onProgress?.({ ...progress });
    }
  });
  await pruneDocuments(
    'feedback',
    new Set(resources.map((resource) => documentKey('feedback', resource)))
  );
  const result = [...latest.values()].map((item) => item.feedback);
  onBatch?.(result);
  onProgress?.({ ...progress, cached: progress.failed > 0 && progress.cached });
  return result;
};

export const fetchUserFeedback = async (
  userName: string,
  episodeId: string
): Promise<FeedbackPayload | null> => {
  const search = await requestQortal<SearchResult[]>(
    {
      action: 'SEARCH_QDN_RESOURCES',
      service: FEEDBACK_SERVICE,
      name: userName,
      exactMatchNames: true,
      identifier: feedbackIdentifier(episodeId),
      prefix: true,
      mode: 'ALL',
      limit: 20,
    },
    { priority: 'interactive' }
  );
  if (!Array.isArray(search))
    throw new Error('Could not check existing feedback.');
  const matches = search.filter(
    (item) =>
      item.name.toLowerCase() === userName.toLowerCase() &&
      [
        feedbackIdentifier(episodeId),
        legacyFeedbackIdentifier(episodeId, userName),
      ].includes(item.identifier)
  );
  const feedback = await Promise.all(
    matches.map(async (item) => {
      const raw = await requestQortal<unknown>(
        {
          action: 'FETCH_QDN_RESOURCE',
          service: FEEDBACK_SERVICE,
          name: userName,
          identifier: item.identifier,
        },
        { priority: 'interactive' }
      );
      const parsed = parseFeedback(raw);
      if (
        !parsed ||
        parsed.episodeId !== episodeId ||
        parsed.userName.toLowerCase() !== userName.toLowerCase()
      )
        throw new Error('Invalid feedback data.');
      return parsed;
    })
  );
  return feedback.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
};

export const upsertFeedback = async (
  userName: string,
  episodeId: string,
  next: {
    like: boolean;
    tipCount: number;
    tipTotal: number;
    ownerName?: string;
  }
): Promise<FeedbackPayload> => {
  const payload: FeedbackPayload = {
    version: 1,
    ownerName: next.ownerName,
    episodeId,
    userName,
    like: next.like,
    tipCount: next.tipCount,
    tipTotal: next.tipTotal,
    updatedAt: Date.now(),
  };

  await requestQortal<unknown>({
    action: 'PUBLISH_QDN_RESOURCE',
    service: FEEDBACK_SERVICE,
    name: userName,
    identifier: feedbackIdentifier(episodeId),
    title: `Feedback ${episodeId}`,
    description: 'Q-Podcasts engagement feedback',
    tags: ['podcast', 'feedback', 'engagement'],
    base64: encodeBase64Json(payload),
  });

  return payload;
};
