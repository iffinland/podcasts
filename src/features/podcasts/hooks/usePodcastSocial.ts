import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addEpisodeToPlaylist,
  addLike,
  createPlaylist,
  loadLikedEpisodeKeys,
  loadPlaylistEpisodeKeys,
  loadPlaylistNames,
  removeEpisodeFromPlaylist,
  removeLike,
} from '../../../services/social/podcastSocialService';

export type PlaylistMap = Record<string, string[]>;

export const usePodcastSocial = (activeName: string | null) => {
  const [likedKeys, setLikedKeys] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const likedSet = useMemo(() => new Set(likedKeys), [likedKeys]);

  const reload = useCallback(async () => {
    if (!activeName) {
      setLikedKeys([]);
      setPlaylists({});
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [likes, playlistNames] = await Promise.all([
        loadLikedEpisodeKeys(activeName),
        loadPlaylistNames(activeName),
      ]);

      const playlistItems = await Promise.all(
        playlistNames.map(async (name) => {
          const items = await loadPlaylistEpisodeKeys(activeName, name);
          return [name, items] as const;
        })
      );

      const nextMap: PlaylistMap = {};
      playlistItems.forEach(([name, items]) => {
        nextMap[name] = items;
      });

      setLikedKeys(likes);
      setPlaylists(nextMap);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load likes or playlists.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [activeName]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleLike = useCallback(
    async (episodeKey: string) => {
      if (!activeName) {
        return;
      }

      const alreadyLiked = likedSet.has(episodeKey);

      try {
        if (alreadyLiked) {
          await removeLike(activeName, episodeKey);
          setLikedKeys((previous) => previous.filter((key) => key !== episodeKey));
          return;
        }

        await addLike(activeName, episodeKey);
        setLikedKeys((previous) => Array.from(new Set([...previous, episodeKey])));
      } catch (likeError) {
        const message = likeError instanceof Error ? likeError.message : 'Could not update like.';
        setError(message);
      }
    },
    [activeName, likedSet]
  );

  const createNewPlaylist = useCallback(
    async (playlistName: string) => {
      if (!activeName || !playlistName.trim()) {
        return;
      }

      const normalized = playlistName.trim();

      try {
        await createPlaylist(activeName, normalized);
        setPlaylists((previous) => {
          if (previous[normalized]) {
            return previous;
          }

          return {
            ...previous,
            [normalized]: [],
          };
        });
      } catch (playlistError) {
        const message =
          playlistError instanceof Error ? playlistError.message : 'Could not create playlist.';
        setError(message);
      }
    },
    [activeName]
  );

  const addEpisode = useCallback(
    async (playlistName: string, episodeKey: string) => {
      if (!activeName || !playlistName || !episodeKey) {
        return;
      }

      try {
        await addEpisodeToPlaylist(activeName, playlistName, episodeKey);
        setPlaylists((previous) => {
          const existing = previous[playlistName] ?? [];

          return {
            ...previous,
            [playlistName]: Array.from(new Set([...existing, episodeKey])),
          };
        });
      } catch (playlistError) {
        const message =
          playlistError instanceof Error ? playlistError.message : 'Could not add episode to playlist.';
        setError(message);
      }
    },
    [activeName]
  );

  const removeEpisode = useCallback(
    async (playlistName: string, episodeKey: string) => {
      if (!activeName || !playlistName || !episodeKey) {
        return;
      }

      try {
        await removeEpisodeFromPlaylist(activeName, playlistName, episodeKey);
        setPlaylists((previous) => ({
          ...previous,
          [playlistName]: (previous[playlistName] ?? []).filter((key) => key !== episodeKey),
        }));
      } catch (playlistError) {
        const message =
          playlistError instanceof Error
            ? playlistError.message
            : 'Could not remove episode from playlist.';
        setError(message);
      }
    },
    [activeName]
  );

  return {
    likedSet,
    playlists,
    isLoading,
    error,
    reload,
    toggleLike,
    createNewPlaylist,
    addEpisode,
    removeEpisode,
  };
};
