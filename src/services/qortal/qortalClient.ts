const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const parseRequestError = (response: unknown): string | null => {
  if (!isObject(response)) {
    return null;
  }

  const error = response.error;
  const message = response.message;

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }

  if (error === true) {
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

  const response = await qortalRequest(payload as never);
  const errorMessage = parseRequestError(response);

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return response as TResponse;
};
