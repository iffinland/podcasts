import {
  requestQortal,
  type QortalRequestOptions,
} from '../qortal/qortalClient';
export type MediaResource = {
  service: string;
  name: string;
  identifier: string;
};
export type MediaProgress = {
  phase: 'checking' | 'downloading' | 'building' | 'ready' | 'buffering';
  message: string;
  percent?: number;
};
export type QdnStatus = {
  status: string;
  localChunkCount?: number;
  totalChunkCount?: number;
  percentLoaded?: number;
};
export const getQdnStatus = async (
  resource: MediaResource,
  priority: QortalRequestOptions['priority'] = 'interactive'
): Promise<QdnStatus> => {
  const raw = await requestQortal<Record<string, unknown>>(
    { action: 'GET_QDN_RESOURCE_STATUS', ...resource, build: true },
    { priority, timeoutMs: 15_000 }
  );
  const status =
    typeof raw?.status === 'string'
      ? raw.status
      : typeof raw?.id === 'string'
        ? raw.id
        : '';
  if (!status) throw new Error('QDN returned an invalid resource status.');
  return {
    status,
    localChunkCount:
      typeof raw.localChunkCount === 'number' ? raw.localChunkCount : undefined,
    totalChunkCount:
      typeof raw.totalChunkCount === 'number' ? raw.totalChunkCount : undefined,
    percentLoaded:
      typeof raw.percentLoaded === 'number' ? raw.percentLoaded : undefined,
  };
};
export const describeQdnStatus = (status: QdnStatus): MediaProgress => {
  let percent = Number.isFinite(status.percentLoaded)
    ? status.percentLoaded
    : undefined;
  if (
    percent === undefined &&
    Number.isFinite(status.localChunkCount) &&
    Number.isFinite(status.totalChunkCount) &&
    status.totalChunkCount! > 0
  )
    percent = (status.localChunkCount! / status.totalChunkCount!) * 100;
  if (percent !== undefined) percent = Math.max(0, Math.min(100, percent));
  if (status.status === 'READY')
    return { phase: 'ready', message: 'Audio ready. Buffering...' };
  if (['BUILDING', 'DOWNLOADED'].includes(status.status))
    return { phase: 'building', message: 'Preparing downloaded files...' };
  return {
    phase: 'downloading',
    message:
      percent === undefined
        ? 'Locating and downloading from QDN...'
        : `Downloading from QDN: ${Math.floor(percent)}%`,
    percent,
  };
};
const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Cancelled', 'AbortError'));
      return;
    }
    const finish = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new DOMException('Cancelled', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
const ready = new Map<string, number>();
export const forgetMediaReady = (resource: MediaResource, version: number) =>
  ready.delete(JSON.stringify([resource, version]));
export async function waitForQdnMedia(
  resource: MediaResource,
  options: {
    signal?: AbortSignal;
    onProgress?: (progress: MediaProgress) => void;
    priority?: QortalRequestOptions['priority'];
    maxWaitMs?: number;
    version?: number;
  } = {}
) {
  const key = JSON.stringify([resource, options.version]);
  if ((ready.get(key) ?? 0) > Date.now()) return;
  const started = Date.now();
  options.onProgress?.({
    phase: 'checking',
    message: 'Checking QDN availability...',
  });
  while (true) {
    if (options.signal?.aborted)
      throw new DOMException('Cancelled', 'AbortError');
    const status = await getQdnStatus(resource, options.priority);
    if (options.signal?.aborted)
      throw new DOMException('Cancelled', 'AbortError');
    if (
      ['BLOCKED', 'UNSUPPORTED', 'NOT_PUBLISHED', 'BUILD_FAILED'].includes(
        status.status
      )
    )
      throw new Error(
        status.status === 'NOT_PUBLISHED'
          ? 'This resource is not published on this node yet. Try again later.'
          : `QDN resource is ${status.status.toLowerCase().replace(/_/g, ' ')}.`
      );
    options.onProgress?.(describeQdnStatus(status));
    if (status.status === 'READY') {
      if (ready.size >= 500) ready.delete(ready.keys().next().value!);
      ready.set(key, Date.now() + 300_000);
      return;
    }
    if (Date.now() - started >= (options.maxWaitMs ?? 300_000))
      throw new Error(
        'QDN is still preparing this resource. Use Retry to check again.'
      );
    await delay(Date.now() - started > 60_000 ? 5000 : 1500, options.signal);
  }
}
