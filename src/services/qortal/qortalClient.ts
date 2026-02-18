const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const REQUEST_TIMEOUT_MS = 120_000;

const parseRequestError = (response: unknown): string | null => {
  if (response === null || response === undefined) {
    return 'Qortal request returned an empty response.';
  }

  if (typeof response === 'string') {
    const trimmed = response.trim();

    if (trimmed.length === 0) {
      return 'Qortal request returned an empty response.';
    }

    if (trimmed.toLowerCase() === 'false' || trimmed.toLowerCase().startsWith('error')) {
      return trimmed;
    }

    return null;
  }

  if (!isObject(response)) {
    return null;
  }

  const error = response.error;
  const message = response.message;
  const success = response.success;

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }

  if (error === true) {
    return 'Qortal request failed.';
  }

  if (success === false) {
    return 'Qortal request failed.';
  }

  return null;
};

export const isQortalRequestAvailable = () => {
  return typeof qortalRequest === 'function';
};

export const requestQortal = async <TResponse>(
  payload: Record<string, unknown>
): Promise<TResponse> => {
  if (!isQortalRequestAvailable()) {
    throw new Error('Qortal request interface is not available in this environment.');
  }

  const action = typeof payload.action === 'string' ? payload.action : 'UNKNOWN_ACTION';
  const service = typeof payload.service === 'string' ? payload.service : undefined;
  const identifier = typeof payload.identifier === 'string' ? payload.identifier : undefined;
  const startedAt = Date.now();
  const label = [action, service, identifier].filter(Boolean).join(':');
  let didTimeout = false;

  console.info(`[qortal] request:start ${label}`);

  const baseRequestPromise = Promise.resolve(qortalRequest(payload as never));
  baseRequestPromise.catch((lateError) => {
    if (!didTimeout) {
      return;
    }

    console.warn(`[qortal] request:late-error ${label}`, lateError);
  });

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      didTimeout = true;
      reject(new Error(`Qortal request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds (${label}).`));
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    const response = (await Promise.race([baseRequestPromise, timeoutPromise])) as unknown;
    const errorMessage = parseRequestError(response);

    if (errorMessage) {
      throw new Error(errorMessage);
    }

    console.info(`[qortal] request:ok ${label} (${Date.now() - startedAt}ms)`);
    return response as TResponse;
  } catch (error) {
    console.error(`[qortal] request:failed ${label} (${Date.now() - startedAt}ms)`, error);
    throw error;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};
