import { useCallback, useEffect, useState } from 'react';
import {
  deletePodcast,
  getAudioResourceUrl,
  getThumbnailResourceUrl,
  publishPodcast,
  searchPodcasts,
  updatePodcast,
} from '../../../services/qdn/podcastQdnService';
import type { PublishProgressUpdate } from '../../../services/qdn/podcastQdnService';
import {
  PodcastEpisode,
  PublishPodcastInput,
  UpdatePodcastInput,
} from '../../../types/podcast';

export interface SaveProgress {
  operation: 'create' | 'edit' | 'delete';
  step: PublishProgressUpdate['step'];
  message: string;
}

const toFriendlySaveErrorMessage = (
  error: unknown,
  fallbackMessage: string
): string => {
  const message = error instanceof Error ? error.message : fallbackMessage;
  if (
    message.includes('Qortal request timed out') &&
    message.includes('PUBLISH_QDN_RESOURCE:AUDIO')
  ) {
    return 'Audio upload timed out on QDN. The file may be too large or the connection too slow. Please try again or use a smaller/compressed audio file.';
  }
  if (
    message.includes('PUBLISH_QDN_RESOURCE:AUDIO') &&
    message.includes('Metadata mismatch: title')
  ) {
    return 'Audio upload failed during QDN finalize (metadata mismatch). Please retry publish once. If it repeats, rename the episode slightly and try again.';
  }

  return message;
};

export const usePodcastCrud = () => {
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveProgress, setSaveProgress] = useState<SaveProgress | null>(null);

  const loadEpisodes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await searchPodcasts({ limit: 50, offset: 0 });
      setEpisodes(data);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load podcasts.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEpisodes();
  }, [loadEpisodes]);

  const createEpisode = useCallback(async (input: PublishPodcastInput) => {
    setIsSaving(true);
    setError(null);
    setSaveProgress({
      operation: 'create',
      step: 'validating',
      message: 'Preparing publish...',
    });

    try {
      const created = await publishPodcast(input, {
        onProgress: (update) => {
          setSaveProgress({
            operation: 'create',
            step: update.step,
            message: update.message,
          });
        },
      });
      setEpisodes((previous) => [created, ...previous]);
      return created;
    } catch (saveError) {
      const message = toFriendlySaveErrorMessage(
        saveError,
        'Failed to publish episode.'
      );
      setError(message);
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const editEpisode = useCallback(async (input: UpdatePodcastInput) => {
    setIsSaving(true);
    setError(null);
    setSaveProgress({
      operation: 'edit',
      step: 'validating',
      message: 'Preparing update...',
    });

    try {
      const updated = await updatePodcast(input, {
        onProgress: (update) => {
          setSaveProgress({
            operation: 'edit',
            step: update.step,
            message: update.message,
          });
        },
      });
      setEpisodes((previous) =>
        previous.map((episode) =>
          episode.episodeId === updated.episodeId &&
          episode.ownerName === updated.ownerName
            ? updated
            : episode
        )
      );
      return updated;
    } catch (saveError) {
      const message = toFriendlySaveErrorMessage(
        saveError,
        'Failed to update episode.'
      );
      setError(message);
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const removeEpisode = useCallback(async (episode: PodcastEpisode) => {
    setIsSaving(true);
    setError(null);
    setSaveProgress({
      operation: 'delete',
      step: 'validating',
      message: 'Preparing delete...',
    });

    try {
      await deletePodcast(episode, {
        onProgress: (update) => {
          setSaveProgress({
            operation: 'delete',
            step: update.step,
            message: update.message,
          });
        },
      });
      setEpisodes((previous) =>
        previous.filter(
          (item) =>
            !(
              item.episodeId === episode.episodeId &&
              item.ownerName === episode.ownerName
            )
        )
      );
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : 'Failed to delete episode.';
      setError(message);
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const resolveAudioUrl = useCallback(async (episode: PodcastEpisode) => {
    return getAudioResourceUrl(episode);
  }, []);

  const resolveThumbnailUrl = useCallback(async (episode: PodcastEpisode) => {
    return getThumbnailResourceUrl(episode);
  }, []);

  return {
    episodes,
    isLoading,
    isSaving,
    error,
    saveProgress,
    loadEpisodes,
    createEpisode,
    editEpisode,
    removeEpisode,
    resolveAudioUrl,
    resolveThumbnailUrl,
  };
};
