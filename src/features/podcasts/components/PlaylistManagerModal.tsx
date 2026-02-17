import { PodcastEpisode } from '../../../types/podcast';
import { PlaylistMap } from '../hooks/usePodcastSocial';
import PlaylistPanel from './PlaylistPanel';

interface PlaylistManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
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

const PlaylistManagerModal = ({
  isOpen,
  onClose,
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
}: PlaylistManagerModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="episode-modal__backdrop" onClick={onClose}>
      <section className="episode-modal surface" onClick={(event) => event.stopPropagation()}>
        <div className="episode-modal__head">
          <h3>Playlists</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <PlaylistPanel
          activeName={activeName}
          featuredEpisode={featuredEpisode}
          playlists={playlists}
          isLoading={isLoading}
          error={error}
          onCreatePlaylist={onCreatePlaylist}
          onAddEpisode={onAddEpisode}
          onRemoveEpisode={onRemoveEpisode}
          onPlayEpisode={onPlayEpisode}
          episodeIndex={episodeIndex}
          thumbnailUrls={thumbnailUrls}
        />
      </section>
    </div>
  );
};

export default PlaylistManagerModal;
