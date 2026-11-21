import { usePodcastCrud } from '../hooks/usePodcastCrud';
import { mapConcurrent } from '../../../services/qortal/mapConcurrent';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PodcastEpisode } from '../../../types/podcast';
import { useGlobalPlayback } from '../context/GlobalPlaybackContext';
import { PlaylistMap } from '../hooks/usePodcastSocial';
import { toEpisodeKey } from '../hooks/podcastKeys';
import EpisodeThumbnail from './EpisodeThumbnail';
import '../styles/playlist-panel.css';
import '../styles/episode-thumbnail.css';

interface PlaylistPanelProps {
  activeName: string | null;
  featuredEpisode: PodcastEpisode | null;
  playlists: PlaylistMap;
  isLoading: boolean;
  error: string | null;
  onCreatePlaylist: (name: string) => Promise<void>;
  onAddEpisode: (playlistName: string, episodeKey: string) => Promise<void>;
  onRemoveEpisode: (playlistName: string, episodeKey: string) => Promise<void>;
  onPlayEpisode: (episode: PodcastEpisode) => Promise<void>;
  episodeIndex: Record<string, PodcastEpisode>;
  thumbnailUrls: Record<string, string | null>;
}

const PlaylistPanel = ({
  activeName,
  featuredEpisode,
  playlists,
  isLoading,
  error,
  onCreatePlaylist,
  onAddEpisode,
  onRemoveEpisode,
  onPlayEpisode,
  episodeIndex,
  thumbnailUrls,
}: PlaylistPanelProps) => {
  const { isCurrentEpisode, isPlaying, isPlayerOpen } = useGlobalPlayback();
  const { findEpisodeByKey } = usePodcastCrud('', false);
  const [resolvedEpisodes, setResolvedEpisodes] = useState<
    Record<string, PodcastEpisode>
  >({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setResolvedEpisodes({});
    const keys = Array.from(new Set(Object.values(playlists).flat())).filter(
      (key) => !episodeIndex[key]
    );
    void mapConcurrent(keys, 2, async (key) => {
      try {
        const episode = await findEpisodeByKey(key);
        if (episode && !cancelled)
          setResolvedEpisodes((previous) => ({ ...previous, [key]: episode }));
      } catch {
        if (!cancelled)
          setLocalError(
            'Some playlist episodes could not be loaded. Reopen the playlist to retry.'
          );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [playlists, episodeIndex, findEpisodeByKey, activeName]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      await action();
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'Playlist operation failed.'
      );
    } finally {
      setBusy(false);
    }
  };
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState('');

  const playlistNames = useMemo(() => Object.keys(playlists), [playlists]);
  const featuredEpisodeKey = featuredEpisode
    ? toEpisodeKey(featuredEpisode)
    : '';

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newPlaylistName.trim()) {
      return;
    }

    await onCreatePlaylist(newPlaylistName.trim());
    if (!selectedPlaylist) {
      setSelectedPlaylist(newPlaylistName.trim());
    }
    setNewPlaylistName('');
  };

  const handleAddFeatured = async () => {
    if (!selectedPlaylist || !featuredEpisodeKey) {
      return;
    }

    await onAddEpisode(selectedPlaylist, featuredEpisodeKey);
  };

  return (
    <div className="playlist-panel">
      <h3>Playlists</h3>
      <p>Owner: {activeName ?? '-'}</p>

      <form
        className="playlist-panel__create"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => handleCreate(event));
        }}
      >
        <input
          type="text"
          value={newPlaylistName}
          onChange={(event) => setNewPlaylistName(event.target.value)}
          placeholder="New playlist name"
          required
        />
        <button type="submit" disabled={isLoading || busy}>
          Create
        </button>
      </form>

      <div className="playlist-panel__selector">
        <select
          value={selectedPlaylist}
          onChange={(event) => setSelectedPlaylist(event.target.value)}
        >
          <option value="">Select playlist</option>
          {playlistNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void run(handleAddFeatured)}
          disabled={!selectedPlaylist || !featuredEpisode || isLoading || busy}
        >
          Add featured episode
        </button>
      </div>

      <div className="playlist-panel__lists">
        {playlistNames.map((name) => (
          <article key={name} className="playlist-panel__list-item">
            <h4>{name}</h4>
            {(playlists[name] ?? []).length === 0 ? (
              <p>No episodes yet.</p>
            ) : null}
            <ul>
              {(playlists[name] ?? []).map((episodeKey) => {
                const episode =
                  episodeIndex[episodeKey] ?? resolvedEpisodes[episodeKey];
                return (
                  <li key={episodeKey}>
                    <div className="playlist-panel__episode">
                      <EpisodeThumbnail
                        episode={episode}
                        src={thumbnailUrls[episodeKey] ?? null}
                        alt={
                          episode
                            ? `${episode.title} thumbnail`
                            : 'Episode thumbnail'
                        }
                        size="sm"
                      />
                      <span>{episode ? episode.title : episodeKey}</span>
                    </div>
                    <button
                      className="playlist-panel__action"
                      type="button"
                      onClick={() => episode && void onPlayEpisode(episode)}
                      disabled={!episode}
                    >
                      {episode && isPlayerOpen && isCurrentEpisode(episode)
                        ? isPlaying
                          ? '● Playing'
                          : '● Paused'
                        : 'Play'}
                    </button>
                    <button
                      className="playlist-panel__action"
                      type="button"
                      onClick={() =>
                        void run(() => onRemoveEpisode(name, episodeKey))
                      }
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>

      {localError && <p role="alert">{localError}</p>}
      {error ? <p className="playlist-panel__error">{error}</p> : null}
    </div>
  );
};

export default PlaylistPanel;
