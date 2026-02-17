import { requestQortal } from '../qortal/qortalClient';

const FEEDBACK_SERVICE = 'PODCAST';
const FEEDBACK_PREFIX = 'qpodcasts-feedback-';

type FeedbackPayload = {
  version: 1;
  episodeId: string;
  userName: string;
  like: boolean;
  tipCount: number;
  tipTotal: number;
  updatedAt: number;
};

type SearchResult = {
  name: string;
  identifier: string;
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

const feedbackIdentifier = (episodeId: string, userName: string) => {
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
    typeof updatedAt !== 'number'
  ) {
    return null;
  }

  return {
    version: 1,
    episodeId,
    userName,
    like,
    tipCount,
    tipTotal,
    updatedAt,
  };
};

export const fetchAllFeedback = async (): Promise<FeedbackPayload[]> => {
  const search = await requestQortal<SearchResult[]>({
    action: 'SEARCH_QDN_RESOURCES',
    service: FEEDBACK_SERVICE,
    identifier: FEEDBACK_PREFIX,
    prefix: true,
    mode: 'ALL',
    reverse: true,
    limit: 1000,
    offset: 0,
  });

  if (!Array.isArray(search)) {
    return [];
  }

  const feedbacks = await Promise.all(
    search.map(async (item) => {
      try {
        const resource = await requestQortal<unknown>({
          action: 'FETCH_QDN_RESOURCE',
          service: FEEDBACK_SERVICE,
          name: item.name,
          identifier: item.identifier,
        });

        return parseFeedback(resource);
      } catch {
        return null;
      }
    })
  );

  return feedbacks.filter((item): item is FeedbackPayload => item !== null);
};

export const fetchUserFeedback = async (
  userName: string,
  episodeId: string
): Promise<FeedbackPayload | null> => {
  try {
    const resource = await requestQortal<unknown>({
      action: 'FETCH_QDN_RESOURCE',
      service: FEEDBACK_SERVICE,
      name: userName,
      identifier: feedbackIdentifier(episodeId, userName),
    });

    return parseFeedback(resource);
  } catch {
    return null;
  }
};

export const upsertFeedback = async (
  userName: string,
  episodeId: string,
  next: {
    like: boolean;
    tipCount: number;
    tipTotal: number;
  }
): Promise<FeedbackPayload> => {
  const payload: FeedbackPayload = {
    version: 1,
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
    identifier: feedbackIdentifier(episodeId, userName),
    title: `Feedback ${episodeId}`,
    description: 'Q-Podcasts engagement feedback',
    tags: ['podcast', 'feedback', 'engagement'],
    base64: encodeBase64Json(payload),
  });

  return payload;
};
