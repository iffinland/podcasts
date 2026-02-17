import { FormEvent, useMemo, useState } from 'react';
import { PodcastEpisode } from '../../../types/podcast';
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
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState('');

  const playlistNames = useMemo(() => Object.keys(playlists), [playlists]);
  const featuredEpisodeKey = featuredEpisode ? toEpisodeKey(featuredEpisode) : '';

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

      <form className="playlist-panel__create" onSubmit={(event) => void handleCreate(event)}>
        <input
          type="text"
          value={newPlaylistName}
          onChange={(event) => setNewPlaylistName(event.target.value)}
          placeholder="New playlist name"
          required
        />
        <button type="submit" disabled={isLoading}>
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
          onClick={() => void handleAddFeatured()}
          disabled={!selectedPlaylist || !featuredEpisode || isLoading}
        >
          Add featured episode
        </button>
      </div>

      <div className="playlist-panel__lists">
        {playlistNames.map((name) => (
          <article key={name} className="playlist-panel__list-item">
            <h4>{name}</h4>
            {(playlists[name] ?? []).length === 0 ? <p>No episodes yet.</p> : null}
            <ul>
              {(playlists[name] ?? []).map((episodeKey) => {
                const episode = episodeIndex[episodeKey];
                return (
                  <li key={episodeKey}>
                    <div className="playlist-panel__episode">
                      <EpisodeThumbnail
                        src={thumbnailUrls[episodeKey] ?? null}
                        alt={episode ? `${episode.title} thumbnail` : 'Episode thumbnail'}
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
                      Play
                    </button>
                    <button
                      className="playlist-panel__action"
                      type="button"
                      onClick={() => void onRemoveEpisode(name, episodeKey)}
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

      {error ? <p className="playlist-panel__error">{error}</p> : null}
    </div>
  );
};

export default PlaylistPanel;
