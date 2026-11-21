import {
  requestQortal,
  type QortalRequestOptions,
} from '../qortal/qortalClient';

export type QdnResource = {
  name: string;
  identifier: string;
  created?: number;
  updated?: number;
};
export type DocumentScope = 'episodes' | 'feedback';
export type CachedDocument = {
  key: string;
  scope: DocumentScope;
  resource: QdnResource;
  revision: string | null;
  savedAt: number;
  value: unknown;
};
const resourceTime = (entry: CachedDocument) =>
  entry.resource.updated ?? entry.resource.created ?? 0;
const prefer = (
  incoming: CachedDocument,
  current: CachedDocument | undefined
) =>
  !current ||
  resourceTime(incoming) > resourceTime(current) ||
  (resourceTime(incoming) === resourceTime(current) &&
    incoming.savedAt >= current.savedAt);
const memory = new Map<string, CachedDocument>();
const flights = new Map<string, Promise<unknown>>();
let database: Promise<IDBDatabase | null> | undefined;
const revisionOf = (resource: QdnResource) => {
  const created = Number.isFinite(resource.created)
    ? resource.created
    : undefined;
  const updated = Number.isFinite(resource.updated)
    ? resource.updated
    : undefined;
  return created === undefined && updated === undefined
    ? null
    : `${created ?? ''}:${updated ?? ''}`;
};
export const documentKey = (scope: DocumentScope, resource: QdnResource) =>
  JSON.stringify([scope, resource.name.toLowerCase(), resource.identifier]);
const openDatabase = () => {
  if (!database)
    database = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      let done = false;
      const finish = (db: IDBDatabase | null) => {
        if (done) {
          db?.close();
          return;
        }
        done = true;
        clearTimeout(timer);
        resolve(db);
      };
      const timer = setTimeout(() => finish(null), 1500);
      try {
        const request = indexedDB.open('qpodcasts-read-cache', 2);
        request.onupgradeneeded = () => {
          const store = request.result.objectStoreNames.contains('documents')
            ? request.transaction!.objectStore('documents')
            : request.result.createObjectStore('documents', { keyPath: 'key' });
          if (!store.indexNames.contains('scope'))
            store.createIndex('scope', 'scope');
        };
        request.onsuccess = () => {
          request.result.onversionchange = () => {
            request.result.close();
            database = undefined;
          };
          finish(request.result);
        };
        request.onerror = () => finish(null);
        request.onblocked = () => finish(null);
      } catch {
        finish(null);
      }
    });
  return database;
};
async function access<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | undefined> {
  const db = await openDatabase();
  if (!db) return undefined;
  return new Promise((resolve) => {
    let done = false;
    const finish = (value?: T) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(), 1500);
    try {
      const transaction = db.transaction('documents', mode);
      const request = operation(transaction.objectStore('documents'));
      let value: T;
      request.onsuccess = () => {
        value = request.result;
      };
      transaction.oncomplete = () => finish(value);
      transaction.onerror = () => finish();
      transaction.onabort = () => finish();
    } catch {
      finish();
    }
  });
}
const get = async (key: string) => {
  const hit = memory.get(key);
  if (hit) return hit;
  const stored = await access<CachedDocument | undefined>('readonly', (store) =>
    store.get(key)
  );
  if (stored?.key === key && typeof stored.savedAt === 'number') {
    memory.set(key, stored);
    return stored;
  }
  return undefined;
};
export const cachedDocuments = async (scope: DocumentScope) => {
  const stored = await access<CachedDocument[]>('readonly', (store) =>
    store.index('scope').getAll(scope)
  );
  for (const entry of stored ?? [])
    if (
      entry?.key &&
      entry.scope === scope &&
      typeof entry.savedAt === 'number'
    ) {
      const current = memory.get(entry.key);
      if (prefer(entry, current)) memory.set(entry.key, entry);
    }
  return [...memory.values()].filter((entry) => entry.scope === scope);
};
export const pruneDocuments = async (
  scope: DocumentScope,
  seen: Set<string>
) => {
  const entries = await cachedDocuments(scope);
  const obsolete = entries.filter((entry) => !seen.has(entry.key));
  if (!obsolete.length) return;
  for (const entry of obsolete) memory.delete(entry.key);
  await access('readwrite', (store) => {
    let result: IDBRequest<undefined>;
    for (const entry of obsolete) result = store.delete(entry.key);
    return result!;
  });
};
export const readQdnDocument = async (
  scope: DocumentScope,
  resource: QdnResource,
  options: QortalRequestOptions = {}
): Promise<unknown> => {
  const key = documentKey(scope, resource);
  const revision = revisionOf(resource);
  const flightKey = JSON.stringify([key, revision]);
  const existing = flights.get(flightKey);
  if (existing) return existing;
  const promise = (async () => {
    const hit = await get(key);
    if (
      hit &&
      (revision !== null
        ? hit.revision === revision
        : Date.now() >= hit.savedAt && Date.now() - hit.savedAt < 60_000)
    )
      return hit.value;
    // Revision participates in the app's in-flight key, never in the Core API payload.
    const value = await requestQortal<unknown>(
      {
        action: 'FETCH_QDN_RESOURCE',
        service: 'PODCAST',
        name: resource.name,
        identifier: resource.identifier,
      },
      { ...options, cacheKey: flightKey }
    );
    const entry = {
      key,
      scope,
      resource,
      revision,
      savedAt: Date.now(),
      value,
    };
    if (prefer(entry, memory.get(key))) {
      memory.set(key, entry);
      await access('readwrite', (store) => store.put(entry));
    }
    return value;
  })().finally(() => {
    if (flights.get(flightKey) === promise) flights.delete(flightKey);
  });
  flights.set(flightKey, promise);
  return promise;
};
