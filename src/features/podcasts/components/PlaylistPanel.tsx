import { FormEvent, useMemo, useState } from 'react';
import { PodcastEpisode } from '../../../types/podcast';
import { PlaylistMap } from '../hooks/usePodcastSocial';
import { toEpisodeKey } from '../hooks/podcastKeys';
import '../styles/playlist-panel.css';

interface PlaylistPanelProps {
  activeName: string | null;
  featuredEpisode: PodcastEpisode | null;
  playlists: PlaylistMap;
  isLoading: boolean;
  error: string | null;
  onCreatePlaylist: (name: string) => Promise<void>;
  onAddEpisode: (playlistName: string, episodeKey: string) => Promise<void>;
  onRemoveEpisode: (playlistName: string, episodeKey: string) => Promise<void>;
  episodeIndex: Record<string, PodcastEpisode>;
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
  episodeIndex,
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
                    <span>{episode ? episode.title : episodeKey}</span>
                    <button
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
