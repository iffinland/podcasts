export const publicationId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
export type PublicationStore =
  | 'jobs'
  | 'files'
  | 'resources'
  | 'drafts'
  | 'leases';
let database: Promise<IDBDatabase> | undefined;
const open = () => {
  if (!database)
    database = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(
          new Error(
            'Draft storage is unavailable. Enable browser storage or free space on this device.'
          )
        );
        return;
      }
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          database = undefined;
          reject(
            new Error(
              'Draft storage did not respond. Publication progress could not be saved.'
            )
          );
        }
      }, 5000);
      try {
        const request = indexedDB.open('qpodcasts-publications', 1);
        request.onupgradeneeded = () => {
          for (const name of ['jobs', 'files', 'resources', 'drafts', 'leases'])
            if (!request.result.objectStoreNames.contains(name))
              request.result.createObjectStore(name, { keyPath: 'key' });
        };
        request.onsuccess = () => {
          clearTimeout(timer);
          if (settled) {
            request.result.close();
            return;
          }
          settled = true;
          request.result.onversionchange = () => {
            request.result.close();
            database = undefined;
          };
          resolve(request.result);
        };
        request.onerror = () => {
          clearTimeout(timer);
          settled = true;
          database = undefined;
          reject(new Error('Cannot save publication progress on this device.'));
        };
        request.onblocked = () => {
          clearTimeout(timer);
          settled = true;
          database = undefined;
          reject(
            new Error(
              'Draft storage is busy in another tab. Close that tab and retry.'
            )
          );
        };
      } catch {
        clearTimeout(timer);
        database = undefined;
        reject(new Error('Cannot access publication storage.'));
      }
    });
  return database.catch((error) => {
    database = undefined;
    throw error;
  });
};
export const publicationTransaction = async <T>(
  names: PublicationStore[],
  mode: IDBTransactionMode,
  operation: (transaction: IDBTransaction, done: (value: T) => void) => void
): Promise<T> => {
  const db = await open();
  return new Promise((resolve, reject) => {
    let value: T;
    const transaction = db.transaction(names, mode);
    const timer = setTimeout(() => {
      try {
        transaction.abort();
      } catch {
        /* Already completed. */
      }
    }, 15000);
    transaction.oncomplete = () => {
      clearTimeout(timer);
      resolve(value);
    };
    transaction.onerror = transaction.onabort = () => {
      clearTimeout(timer);
      reject(
        new Error(
          'Could not save publication progress. Free device storage and check the last action before retrying.'
        )
      );
    };
    try {
      operation(transaction, (result) => {
        value = result;
      });
    } catch (error) {
      clearTimeout(timer);
      transaction.abort();
      reject(error);
    }
  });
};
export const publicationGet = <T>(store: PublicationStore, key: string) =>
  publicationTransaction<T | undefined>([store], 'readonly', (tx, done) => {
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => done(request.result as T | undefined);
  });
export const publicationAll = <T>(store: PublicationStore) =>
  publicationTransaction<T[]>([store], 'readonly', (tx, done) => {
    const request = tx.objectStore(store).getAll();
    request.onsuccess = () => done(request.result as T[]);
  });
export const publicationPut = <T extends { key: string }>(
  store: PublicationStore,
  value: T
) =>
  publicationTransaction<void>([store], 'readwrite', (tx, done) => {
    tx.objectStore(store).put(value);
    done();
  });
export const publicationDelete = (store: PublicationStore, key: string) =>
  publicationTransaction<void>([store], 'readwrite', (tx, done) => {
    tx.objectStore(store).delete(key);
    done();
  });
export const notifyPublicationChange = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('qpodcasts-publications-changed'));
  if (typeof window.BroadcastChannel === 'function') {
    const channel = new window.BroadcastChannel('qpodcasts-publications');
    channel.postMessage('changed');
    channel.close();
  }
};
export async function withPublicationLock<T>(
  key: string,
  action: () => Promise<T>
): Promise<T> {
  const token = publicationId();
  const claim = () =>
    publicationTransaction<boolean>(['leases'], 'readwrite', (tx, done) => {
      const store = tx.objectStore('leases');
      const request = store.get(key);
      request.onsuccess = () => {
        const previous = request.result as
          | { token: string; expires: number }
          | undefined;
        if (
          previous &&
          previous.token !== token &&
          previous.expires > Date.now()
        ) {
          done(false);
          return;
        }
        store.put({ key, token, expires: Date.now() + 120_000 });
        done(true);
      };
    });
  if (!(await claim()))
    throw new Error(
      'This publication is already being handled in another tab.'
    );
  const heartbeat = setInterval(() => {
    void claim().catch(() => {});
  }, 20_000);
  try {
    return await action();
  } finally {
    clearInterval(heartbeat);
    await publicationTransaction<void>(['leases'], 'readwrite', (tx, done) => {
      const store = tx.objectStore('leases');
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result?.token === token) store.delete(key);
        done();
      };
    }).catch(() => {});
  }
}
