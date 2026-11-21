import { requestQortal } from '../qortal/qortalClient';
import { hashBlob, hashBase64, hashResponse } from '../media/contentHash';
import { getQdnStatus, type MediaResource } from '../media/qdnMedia';
import {
  publicationGet,
  publicationPut,
  publicationDelete,
  withPublicationLock,
} from './publicationStorage';
export type PublicationEntry = {
  key: string;
  resource: MediaResource;
  hash: string;
  size: number;
  state: 'pending' | 'confirmed';
  expectedBase64?: string;
  filename?: string;
  updatedAt: number;
};
export class PendingPublicationError extends Error {
  constructor() {
    super(
      'A submitted resource is not yet verified. Check its status before resubmitting. No duplicate was sent.'
    );
    this.name = 'PendingPublicationError';
  }
}
export const resourceJournalKey = (resource: MediaResource) =>
  JSON.stringify([resource.service, resource.name, resource.identifier]);
export const draftIdentity = async (
  fingerprint: string,
  createId: () => string
) =>
  withPublicationLock(`draft:${fingerprint}`, async () => {
    const previous = await publicationGet<{
      key: string;
      id: string;
      createdAt: number;
    }>('drafts', fingerprint);
    if (previous) return previous;
    let legacy: { id: string; createdAt: number } | undefined;
    try {
      legacy = JSON.parse(
        sessionStorage.getItem('qpodcasts-publication-journal-v1') ?? '{}'
      ).drafts?.[fingerprint];
    } catch {
      /* A legacy tab draft may be absent. */
    }
    const entry = {
      key: fingerprint,
      id: legacy?.id ?? createId(),
      createdAt: legacy?.createdAt ?? Date.now(),
    };
    await publicationPut('drafts', entry);
    return entry;
  });
export const getPublicationEntry = (resource: MediaResource) =>
  publicationGet<PublicationEntry>('resources', resourceJournalKey(resource));
export async function checkPublicationResource(
  resource: MediaResource,
  options: { force?: boolean; onProgress?: (message: string) => void } = {}
): Promise<boolean> {
  const entry = await getPublicationEntry(resource);
  if (!entry) return false;
  if (entry.state === 'confirmed' && !options.force) return true;
  options.onProgress?.(
    `Checking previously submitted ${resource.service.toLowerCase()}...`
  );
  try {
    const status = await getQdnStatus(resource);
    if (status.status !== 'READY') return false;
    let actual: string;
    if (entry.expectedBase64 !== undefined) {
      const raw = await requestQortal<unknown>(
        { action: 'FETCH_QDN_RESOURCE', ...resource, encoding: 'base64' },
        { priority: 'interactive' }
      );
      if (typeof raw !== 'string') return false;
      actual = hashBase64(raw.trim()).hash;
    } else {
      const url = await requestQortal<string>(
        { action: 'GET_QDN_RESOURCE_URL', ...resource },
        { priority: 'interactive' }
      );
      if (typeof url !== 'string') return false;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 900_000);
      try {
        const base =
          typeof window === 'undefined'
            ? 'http://localhost/'
            : window.location.origin;
        const target = new URL(url, base);
        target.searchParams.set('verify', entry.hash);
        const response = await fetch(target, {
          cache: 'no-store',
          signal: controller.signal,
        });
        actual = await hashResponse(
          response,
          entry.size,
          controller.signal,
          (percent) =>
            options.onProgress?.(
              `Verifying existing ${resource.service.toLowerCase()}: ${Math.floor(percent)}%`
            )
        );
      } finally {
        clearTimeout(timer);
      }
    }
    if (actual !== entry.hash) return false;
    await publicationPut('resources', {
      ...entry,
      state: 'confirmed' as const,
      updatedAt: Date.now(),
    });
    return true;
  } catch {
    return false;
  }
}
export const resetUnconfirmedResource = (resource: MediaResource) =>
  withPublicationLock(`resource:${resourceJournalKey(resource)}`, async () => {
    const entry = await getPublicationEntry(resource);
    if (entry?.state === 'pending')
      await publicationDelete('resources', entry.key);
    try {
      const legacy = JSON.parse(
        sessionStorage.getItem('qpodcasts-publication-journal-v1') ?? '{}'
      );
      if (
        legacy.resources?.[resourceJournalKey(resource)]?.state === 'pending'
      ) {
        delete legacy.resources[resourceJournalKey(resource)];
        sessionStorage.setItem(
          'qpodcasts-publication-journal-v1',
          JSON.stringify(legacy)
        );
      }
    } catch {
      /* Legacy state is optional. */
    }
  });
export const publishResourceOnce = async (
  payload: Record<string, unknown>,
  timeoutMs?: number,
  options: { onProgress?: (message: string) => void } = {}
) => {
  const resource = {
    service: String(payload.service),
    name: String(payload.name),
    identifier: String(payload.identifier),
  };
  const key = resourceJournalKey(resource);
  const file = payload.file as File | undefined;
  const expected = file
    ? { hash: await hashBlob(file), size: file.size }
    : hashBase64(String(payload.base64));
  await withPublicationLock(`resource:${key}`, async () => {
    let previous = await getPublicationEntry(resource);
    if (!previous) {
      try {
        const legacy = JSON.parse(
          sessionStorage.getItem('qpodcasts-publication-journal-v1') ?? '{}'
        ).resources?.[key];
        const oldFingerprint = JSON.stringify(
          file
            ? {
                filename: file.name,
                size: file.size,
                modified: file.lastModified,
              }
            : payload.base64
        );
        if (
          legacy &&
          (legacy.state === 'pending' || legacy.fingerprint === oldFingerprint)
        ) {
          previous = {
            key,
            resource,
            ...expected,
            state: 'pending',
            expectedBase64: file ? undefined : String(payload.base64),
            filename: file?.name,
            updatedAt: Date.now(),
          };
          await publicationPut('resources', previous);
        }
      } catch {
        /* The new persistent journal is authoritative. */
      }
    }
    if (previous?.state === 'confirmed' && previous.hash === expected.hash)
      return;
    if (previous?.state === 'pending') {
      if (
        previous.hash === expected.hash &&
        (await checkPublicationResource(resource, options))
      )
        return;
      throw new PendingPublicationError();
    }
    const entry: PublicationEntry = {
      key,
      resource,
      ...expected,
      state: 'pending',
      expectedBase64: file ? undefined : String(payload.base64),
      filename: file?.name,
      updatedAt: Date.now(),
    };
    // This commit must finish before the bridge can transmit a publication.
    await publicationPut('resources', entry);
    try {
      await requestQortal(payload, { timeoutMs });
      await publicationPut('resources', {
        ...entry,
        state: 'confirmed',
        updatedAt: Date.now(),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        /declined|denied|rejected by user|user rejected/i.test(error.message)
      )
        await publicationDelete('resources', key);
      throw error;
    }
  });
};
