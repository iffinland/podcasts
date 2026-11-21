import type {
  PodcastEpisode,
  PublishPodcastInput,
  UpdatePodcastInput,
} from '../../types/podcast';
import {
  publishPodcast,
  updatePodcast,
  deletePodcast,
  type PublishProgressUpdate,
} from './podcastQdnService';
import {
  publicationAll,
  publicationGet,
  publicationPut,
  publicationTransaction,
  publicationId,
  withPublicationLock,
  notifyPublicationChange,
} from './publicationStorage';
import {
  checkPublicationResource,
  getPublicationEntry,
  resetUnconfirmedResource,
  PendingPublicationError,
} from './publicationJournal';
import { prepareCover } from '../media/prepareCover';
import { hashBlob } from '../media/contentHash';
import type { MediaResource } from '../media/qdnMedia';
export type PublicationOperation = 'create' | 'edit' | 'delete';
type StoredFile = {
  key: string;
  blob: Blob;
  name: string;
  type: string;
  modified: number;
};
export type PublicationJob = {
  key: string;
  inputHash: string;
  operation: PublicationOperation;
  ownerName: string;
  episodeId: string;
  operationTime: number;
  updatedAt: number;
  status:
    | 'saved'
    | 'running'
    | 'pending'
    | 'needs-review'
    | 'failed'
    | 'complete';
  message: string;
  data: {
    title: string;
    description: string;
    tags: string[];
    categories: string[];
    episode?: PodcastEpisode;
  };
  audioKey?: string;
  coverKey?: string;
  result?: PodcastEpisode;
};
export const listPublicationJobs = async (ownerName: string) =>
  (await publicationAll<PublicationJob>('jobs'))
    .filter((job) => job.ownerName === ownerName && job.status !== 'complete')
    .sort((a, b) => b.updatedAt - a.updatedAt);
export const getPublicationJob = (id: string) =>
  publicationGet<PublicationJob>('jobs', id);
const storeFile = (key: string, file: File): StoredFile => ({
  key,
  blob: file,
  name: file.name,
  type: file.type,
  modified: file.lastModified,
});
const restoreFile = async (key: string | undefined) => {
  if (!key) return undefined;
  const stored = await publicationGet<StoredFile>('files', key);
  if (!stored?.blob)
    throw new Error(
      'The saved file is unavailable on this device. Keep the unfinished publication and restore the original file before continuing.'
    );
  return new File([stored.blob], stored.name, {
    type: stored.type,
    lastModified: stored.modified,
  });
};
const resourcesFor = (job: PublicationJob): MediaResource[] => {
  const episode = job.data.episode;
  const result: MediaResource[] = [];
  if (job.audioKey)
    result.push({
      service: 'AUDIO',
      name: episode?.audio.name ?? job.ownerName,
      identifier:
        episode?.audio.identifier ?? `qpodcasts-episode-${job.episodeId}-audio`,
    });
  if (job.coverKey)
    result.push({
      service: 'IMAGE',
      name: job.ownerName,
      identifier:
        episode?.thumbnail?.identifier ??
        `qpodcasts-episode-${job.episodeId}-thumb`,
    });
  result.push({
    service: 'PODCAST',
    name: job.ownerName,
    identifier:
      episode?.metadataIdentifier ?? `qpodcasts-episode-${job.episodeId}-meta`,
  });
  return result;
};
export async function savePublicationJob(
  operation: PublicationOperation,
  input: PublishPodcastInput | UpdatePodcastInput | PodcastEpisode,
  onProgress?: (update: PublishProgressUpdate) => void
) {
  onProgress?.({
    step: 'validating',
    message: 'Saving a recoverable draft on this device...',
  });
  const created =
    operation === 'create' ? (input as PublishPodcastInput) : undefined;
  const edited =
    operation === 'edit' ? (input as UpdatePodcastInput) : undefined;
  const episode =
    operation === 'delete' ? (input as PodcastEpisode) : edited?.episode;
  const audio = created?.audioFile ?? edited?.newAudioFile;
  const originalCover = created?.thumbnailFile ?? edited?.newThumbnailFile;
  if (audio && audio.size > 250 * 1024 * 1024)
    throw new Error('Audio file exceeds 250 MB.');
  let cover: File | undefined;
  if (originalCover) {
    onProgress?.({
      step: 'validating',
      message: 'Preparing a smaller cover image...',
    });
    cover = await prepareCover(originalCover);
  }
  const inputHash = await hashBlob(
    new Blob([
      JSON.stringify([
        operation,
        created?.ownerName ?? episode?.ownerName,
        episode,
        created?.title ?? edited?.title,
        created?.description ?? edited?.description,
        created?.tags ?? edited?.tags,
        created?.categories ?? edited?.categories,
        audio ? await hashBlob(audio) : null,
        audio?.name,
        cover ? await hashBlob(cover) : null,
        cover?.name,
      ]),
    ])
  );
  return withPublicationLock(`form:${inputHash}`, async () => {
    const owner = created?.ownerName ?? episode?.ownerName ?? '';
    const previous = (await listPublicationJobs(owner)).find(
      (job) => job.inputHash === inputHash
    );
    if (previous) return previous;
    const key = publicationId();
    const now = Date.now();
    const job: PublicationJob = {
      key,
      inputHash,
      operation,
      ownerName: created?.ownerName ?? episode?.ownerName ?? '',
      episodeId: episode?.episodeId ?? publicationId(),
      operationTime: now,
      updatedAt: now,
      status: 'saved',
      message: 'Draft saved on this device.',
      data: {
        title: created?.title ?? edited?.title ?? episode?.title ?? '',
        description:
          created?.description ??
          edited?.description ??
          episode?.description ??
          '',
        tags: created?.tags ?? edited?.tags ?? episode?.tags ?? [],
        categories:
          created?.categories ??
          edited?.categories ??
          episode?.categories ??
          [],
        episode,
      },
      audioKey: audio ? `${key}:audio` : undefined,
      coverKey: cover ? `${key}:cover` : undefined,
    };
    if (!job.ownerName) throw new Error('Select a publisher name first.');
    try {
      await publicationTransaction<void>(
        ['jobs', 'files'],
        'readwrite',
        (tx, done) => {
          tx.objectStore('jobs').put(job);
          if (audio)
            tx.objectStore('files').put(storeFile(job.audioKey!, audio));
          if (cover)
            tx.objectStore('files').put(storeFile(job.coverKey!, cover));
          done();
        }
      );
    } catch {
      throw new Error(
        'Could not save the draft and files on this device. Free browser storage and retry. Nothing was published.'
      );
    }
    notifyPublicationChange();
    return job;
  });
}
const completeJob = async (job: PublicationJob) => {
  if (!job.result) {
    const metadata = await getPublicationEntry(
      resourcesFor(job).find((resource) => resource.service === 'PODCAST')!
    );
    if (metadata?.expectedBase64) {
      const bytes = Uint8Array.from(
        atob(metadata.expectedBase64),
        (character) => character.charCodeAt(0)
      );
      const document = JSON.parse(new TextDecoder().decode(bytes));
      job = {
        ...job,
        result: {
          ...document,
          ownerName: job.ownerName,
          metadataIdentifier: metadata.resource.identifier,
        },
      };
    }
  }
  const completed = {
    ...job,
    status: 'complete' as const,
    message: 'Publication verified.',
    updatedAt: Date.now(),
  };
  await publicationTransaction<void>(
    ['jobs', 'files'],
    'readwrite',
    (tx, done) => {
      tx.objectStore('jobs').put(completed);
      if (job.audioKey) tx.objectStore('files').delete(job.audioKey);
      if (job.coverKey) tx.objectStore('files').delete(job.coverKey);
      done();
    }
  );
  notifyPublicationChange();
  return completed;
};
export async function runPublicationJob(
  id: string,
  ownerName: string,
  options: {
    checkOnly?: boolean;
    resubmitUnconfirmed?: boolean;
    onProgress?: (update: PublishProgressUpdate) => void;
  } = {}
) {
  return withPublicationLock(`job:${id}`, async () => {
    let job = await getPublicationJob(id);
    if (!job || job.ownerName !== ownerName)
      throw new Error(
        'Select the publisher name belonging to this saved draft.'
      );
    if (job.status === 'complete') return job;
    const resources = resourcesFor(job);
    const startingStatus = job.status;
    let writes = Promise.resolve();
    let lastSaved = 0;
    let lastStep = '';
    const onProgress = (update: PublishProgressUpdate) => {
      options.onProgress?.(update);
      job = { ...job!, message: update.message, updatedAt: Date.now() };
      if (update.step !== lastStep || Date.now() - lastSaved > 500) {
        lastStep = update.step;
        lastSaved = Date.now();
        const saved = { ...job };
        writes = writes
          .then(() => publicationPut('jobs', saved))
          .then(notifyPublicationChange)
          .catch(() => {});
      }
    };
    try {
      job = {
        ...job,
        status: 'running',
        message: options.checkOnly
          ? 'Checking submitted resources...'
          : 'Continuing saved publication...',
        updatedAt: Date.now(),
      };
      await publicationPut('jobs', job);
      notifyPublicationChange();
      if (options.checkOnly || startingStatus === 'pending') {
        let allConfirmed = true;
        for (const resource of resources) {
          const entry = await getPublicationEntry(resource);
          if (!entry) {
            allConfirmed = false;
            continue;
          }
          if (entry.state === 'pending' || resource.service === 'PODCAST') {
            const verified = await checkPublicationResource(resource, {
              force: resource.service === 'PODCAST',
              onProgress: (message) =>
                onProgress({ step: 'verifying-metadata', message }),
            });
            if (!verified) allConfirmed = false;
          }
        }
        await writes;
        if (allConfirmed) return completeJob(job);
        if (options.checkOnly || startingStatus === 'pending') {
          job = {
            ...job,
            status: startingStatus === 'pending' ? 'pending' : 'needs-review',
            message:
              'Some submitted resources are not verified yet. Check again later, or continue the remaining steps.',
            updatedAt: Date.now(),
          };
          await publicationPut('jobs', job);
          notifyPublicationChange();
          return job;
        }
      }
      if (options.resubmitUnconfirmed)
        for (const resource of resources)
          await resetUnconfirmedResource(resource);
      const audio = await restoreFile(job.audioKey);
      const cover = await restoreFile(job.coverKey);
      let verified = false;
      const publishOptions = {
        episodeId: job.episodeId,
        operationTime: job.operationTime,
        onProgress,
        onVerification: (value: boolean) => {
          verified = value;
        },
      };
      if (job.operation === 'create') {
        if (!audio) throw new Error('Saved audio file is unavailable.');
        const result = await publishPodcast(
          {
            ownerName: job.ownerName,
            ...job.data,
            audioFile: audio,
            thumbnailFile: cover,
          },
          publishOptions
        );
        job = { ...job, result };
      } else if (job.operation === 'edit') {
        if (!job.data.episode)
          throw new Error('Saved episode reference is unavailable.');
        const result = await updatePodcast(
          {
            ...job.data,
            episode: job.data.episode,
            newAudioFile: audio,
            newThumbnailFile: cover,
          },
          publishOptions
        );
        job = { ...job, result };
      } else {
        if (!job.data.episode)
          throw new Error('Saved episode reference is unavailable.');
        await deletePodcast(job.data.episode, publishOptions);
        job.result = job.data.episode;
      }
      await writes;
      if (verified) return completeJob(job);
      job = {
        ...job,
        status: 'pending',
        message:
          'Publication submitted. QDN verification is pending; use Check status.',
        updatedAt: Date.now(),
      };
      await publicationPut('jobs', job);
      notifyPublicationChange();
      return job;
    } catch (error) {
      await writes;
      job = {
        ...job,
        status:
          error instanceof PendingPublicationError ? 'needs-review' : 'failed',
        message:
          error instanceof Error
            ? error.message
            : 'Publication interrupted. The draft remains saved.',
        updatedAt: Date.now(),
      };
      await publicationPut('jobs', job).catch(() => {});
      notifyPublicationChange();
      throw error;
    }
  });
}
export const forgetPublicationJob = (id: string, ownerName: string) =>
  withPublicationLock(`job:${id}`, async () => {
    const job = await getPublicationJob(id);
    if (!job || job.ownerName !== ownerName)
      throw new Error('Select the draft publisher first.');
    await publicationTransaction<void>(
      ['jobs', 'files'],
      'readwrite',
      (tx, done) => {
        tx.objectStore('jobs').delete(id);
        if (job.audioKey) tx.objectStore('files').delete(job.audioKey);
        if (job.coverKey) tx.objectStore('files').delete(job.coverKey);
        done();
      }
    );
    notifyPublicationChange();
  });
