import { useEpisodeComposer } from '../context/EpisodeComposerContext';
import { mapConcurrent } from '../../../services/qortal/mapConcurrent';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addEpisodeToPlaylist,
  createPlaylist,
  loadPlaylistEpisodeKeys,
  loadPlaylistNames,
  removeEpisodeFromPlaylist,
} from '../../../services/social/podcastSocialService';

export type PlaylistMap = Record<string, string[]>;

export const usePodcastSocial = (activeName: string | null) => {
  const { isPlaylistOpen } = useEpisodeComposer();
  const generation = useRef(0);
  const currentName = useRef(activeName);
  currentName.current = activeName;
  const [playlists, setPlaylists] = useState<PlaylistMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!activeName) {
      setPlaylists({});
      return;
    }

    const requestId = ++generation.current;
    setIsLoading(true);
    setError(null);

    try {
      const playlistNames = await loadPlaylistNames(activeName);

      const playlistItems = await mapConcurrent(
        playlistNames,
        2,
        async (name) => {
          const items = await loadPlaylistEpisodeKeys(activeName, name);
          return [name, items] as const;
        }
      );

      const nextMap: PlaylistMap = {};
      playlistItems.forEach(([name, items]) => {
        nextMap[name] = items;
      });

      if (requestId === generation.current) setPlaylists(nextMap);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : 'Could not load likes or playlists.';
      if (requestId === generation.current) setError(message);
    } finally {
      if (requestId === generation.current) setIsLoading(false);
    }
  }, [activeName]);

  const invalidate = useCallback(() => {
    ++generation.current;
  }, []);
  useEffect(() => {
    invalidate();
    setPlaylists({});
    setError(null);
    if (isPlaylistOpen) void reload();
    return invalidate;
  }, [reload, isPlaylistOpen, invalidate]);

  const createNewPlaylist = useCallback(
    async (playlistName: string) => {
      if (!activeName || !playlistName.trim())
        throw new Error('Select an account and enter a playlist name.');

      const normalized = playlistName.trim();
      const listKey = (name: string) => name.toLowerCase().replace(/\s+/g, '-');
      if (
        Object.keys(playlists).some(
          (name) => name !== normalized && listKey(name) === listKey(normalized)
        )
      )
        throw new Error(
          'This name conflicts with an existing playlist. Choose a distinct name.'
        );

      try {
        await createPlaylist(activeName, normalized);
        if (currentName.current !== activeName) return;
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
          playlistError instanceof Error
            ? playlistError.message
            : 'Could not create playlist.';
        setError(message);
        throw playlistError;
      }
    },
    [activeName, playlists]
  );

  const addEpisode = useCallback(
    async (playlistName: string, episodeKey: string) => {
      if (!activeName || !playlistName || !episodeKey) {
        return;
      }

      try {
        await addEpisodeToPlaylist(activeName, playlistName, episodeKey);
        if (currentName.current !== activeName) return;
        setPlaylists((previous) => {
          const existing = previous[playlistName] ?? [];

          return {
            ...previous,
            [playlistName]: Array.from(new Set([...existing, episodeKey])),
          };
        });
      } catch (playlistError) {
        const message =
          playlistError instanceof Error
            ? playlistError.message
            : 'Could not add episode to playlist.';
        setError(message);
        throw playlistError;
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
        if (currentName.current !== activeName) return;
        setPlaylists((previous) => ({
          ...previous,
          [playlistName]: (previous[playlistName] ?? []).filter(
            (key) => key !== episodeKey
          ),
        }));
      } catch (playlistError) {
        const message =
          playlistError instanceof Error
            ? playlistError.message
            : 'Could not remove episode from playlist.';
        setError(message);
        throw playlistError;
      }
    },
    [activeName]
  );

  return {
    playlists,
    isLoading,
    error,
    reload,
    createNewPlaylist,
    addEpisode,
    removeEpisode,
  };
};
