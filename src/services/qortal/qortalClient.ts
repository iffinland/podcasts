declare const qortalRequest: (request: unknown) => Promise<unknown>;
declare const qortalRequestWithTimeout:
  | undefined
  | ((request: unknown, timeout: number) => Promise<unknown>);
/** Reserve bridge capacity for playback, account requests and writes. */
export interface QortalRequestOptions {
  timeoutMs?: number;
  priority?: 'interactive' | 'normal' | 'background';
  cacheMs?: number;
  cacheKey?: string;
}

type Task = { run: () => void; background: boolean };
const queue: Task[] = [];
let active = 0;
let backgroundActive = 0;
const pending = new Map<string, Promise<unknown>>();
const cache = new Map<string, { value: unknown; expires: number }>();

const pump = () => {
  while (active < 6) {
    const index = queue.findIndex(
      (task) => !task.background || backgroundActive < 2
    );
    if (index < 0) return;
    const [task] = queue.splice(index, 1);
    active++;
    if (task.background) backgroundActive++;
    task.run();
  }
};

export const errorMessage = (value: unknown): string => {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const data = value as Record<string, unknown>;
    if (typeof data.message === 'string') return data.message;
    if (typeof data.error === 'string') return data.error;
  }
  return 'Qortal request failed.';
};

export const isQortalRequestAvailable = () =>
  typeof qortalRequest === 'function';
export const clearQortalCache = () => cache.clear();

const invoke = async (payload: Record<string, unknown>, timeout: number) => {
  // This is Core's bridge function, not merely an outer Promise.race timer.
  const bridge =
    typeof qortalRequestWithTimeout === 'function'
      ? qortalRequestWithTimeout
      : undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const request =
      typeof bridge === 'function'
        ? bridge(payload, timeout)
        : qortalRequest(payload as never);
    const response = await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `${payload.action} timed out. Its outcome may still be pending; do not repeat a payment or publication without checking.`
              )
            ),
          timeout
        );
      }),
    ]);
    if (response === null || response === undefined || response === false) {
      throw new Error('Qortal request returned no successful result.');
    }
    if (typeof response === 'object') {
      const data = response as Record<string, unknown>;
      if (
        (data.error !== undefined &&
          data.error !== null &&
          data.error !== false &&
          data.error !== 0) ||
        data.success === false
      ) {
        throw new Error(errorMessage(data));
      }
    }
    if (
      typeof response === 'string' &&
      /^(false|error\b)/i.test(response.trim())
    )
      throw new Error(response);
    return response;
  } catch (error) {
    throw new Error(errorMessage(error));
  } finally {
    clearTimeout(timer);
  }
};

export const requestQortal = <TResponse>(
  payload: Record<string, unknown>,
  options: QortalRequestOptions = {}
): Promise<TResponse> => {
  if (!isQortalRequestAvailable())
    return Promise.reject(
      new Error('Open this app in Qortal Hub or Qortal Go.')
    );
  const action = String(payload.action);
  const writes = /^(PUBLISH_|SEND_|ADD_|DELETE_|JOIN_|SIGN_)/.test(action);
  const asksPermission =
    writes || /^(GET_USER_ACCOUNT|GET_LIST_ITEMS|GET_WALLET_)/.test(action);
  const timeout =
    options.timeoutMs ??
    (writes
      ? 3_600_000
      : asksPermission
        ? 300_000
        : action === 'FETCH_QDN_RESOURCE'
          ? 60_000
          : 30_000);
  const key = JSON.stringify(payload) + (options.cacheKey ?? '');
  if (!writes) {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now())
      return Promise.resolve(hit.value as TResponse);
    const flight = pending.get(key);
    if (flight) return flight as Promise<TResponse>;
  }
  const execute = () => invoke(payload, timeout);
  const priority =
    options.priority ??
    (asksPermission || action === 'GET_QDN_RESOURCE_URL'
      ? 'interactive'
      : 'normal');
  const promise =
    priority === 'interactive'
      ? execute()
      : new Promise<unknown>((resolve, reject) => {
          const background = priority === 'background';
          const task = {
            background,
            run: () => {
              void execute()
                .then(resolve, reject)
                .finally(() => {
                  active--;
                  if (background) backgroundActive--;
                  pump();
                });
            },
          };
          if (background) queue.push(task);
          else queue.unshift(task);
          pump();
        });
  const result = promise
    .then((value) => {
      if (writes) clearQortalCache();
      else if (options.cacheMs) {
        if (cache.size > 500) cache.delete(cache.keys().next().value!);
        cache.set(key, { value, expires: Date.now() + options.cacheMs });
      }
      return value;
    })
    .finally(() => {
      if (pending.get(key) === result) pending.delete(key);
    });
  if (!writes) pending.set(key, result);
  return result as Promise<TResponse>;
};
