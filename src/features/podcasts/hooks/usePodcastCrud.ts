import { useCallback, useEffect, useState } from 'react';
import {
  deletePodcast,
  getAudioResourceUrl,
  publishPodcast,
  searchPodcasts,
  updatePodcast,
} from '../../../services/qdn/podcastQdnService';
import { PodcastEpisode, PublishPodcastInput, UpdatePodcastInput } from '../../../types/podcast';

export const usePodcastCrud = () => {
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEpisodes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await searchPodcasts({ limit: 50, offset: 0 });
      setEpisodes(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load podcasts.';
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

    try {
      const created = await publishPodcast(input);
      setEpisodes((previous) => [created, ...previous]);
      return created;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to publish episode.';
      setError(message);
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const editEpisode = useCallback(async (input: UpdatePodcastInput) => {
    setIsSaving(true);
    setError(null);

    try {
      const updated = await updatePodcast(input);
      setEpisodes((previous) =>
        previous.map((episode) =>
          episode.episodeId === updated.episodeId && episode.ownerName === updated.ownerName
            ? updated
            : episode
        )
      );
      return updated;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to update episode.';
      setError(message);
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const removeEpisode = useCallback(async (episode: PodcastEpisode) => {
    setIsSaving(true);
    setError(null);

    try {
      await deletePodcast(episode);
      setEpisodes((previous) =>
        previous.filter(
          (item) =>
            !(item.episodeId === episode.episodeId && item.ownerName === episode.ownerName)
        )
      );
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to delete episode.';
      setError(message);
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const resolveAudioUrl = useCallback(async (episode: PodcastEpisode) => {
    return getAudioResourceUrl(episode);
  }, []);

  return {
    episodes,
    isLoading,
    isSaving,
    error,
    loadEpisodes,
    createEpisode,
    editEpisode,
    removeEpisode,
    resolveAudioUrl,
  };
};
