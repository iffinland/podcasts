import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { PodcastEpisode } from '../../../types/podcast';

type ComposerMode = 'create' | 'edit';

interface EpisodeComposerContextValue {
  isOpen: boolean;
  mode: ComposerMode;
  editingEpisode: PodcastEpisode | null;
  isPlaylistOpen: boolean;
  playlistEpisode: PodcastEpisode | null;
  openCreate: () => void;
  openEdit: (episode: PodcastEpisode) => void;
  openPlaylists: (episode?: PodcastEpisode | null) => void;
  closePlaylists: () => void;
  close: () => void;
}

const EpisodeComposerContext =
  createContext<EpisodeComposerContextValue | null>(null);

export const EpisodeComposerProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ComposerMode>('create');
  const [editingEpisode, setEditingEpisode] = useState<PodcastEpisode | null>(
    null
  );
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [playlistEpisode, setPlaylistEpisode] = useState<PodcastEpisode | null>(
    null
  );

  const openCreate = () => {
    setMode('create');
    setEditingEpisode(null);
    setIsOpen(true);
  };

  const openEdit = (episode: PodcastEpisode) => {
    setMode('edit');
    setEditingEpisode(episode);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
  };

  const openPlaylists = (episode?: PodcastEpisode | null) => {
    setPlaylistEpisode(episode ?? null);
    setIsPlaylistOpen(true);
  };

  const closePlaylists = () => {
    setIsPlaylistOpen(false);
    setPlaylistEpisode(null);
  };

  const value = useMemo(
    () => ({
      isOpen,
      mode,
      editingEpisode,
      isPlaylistOpen,
      playlistEpisode,
      openCreate,
      openEdit,
      openPlaylists,
      closePlaylists,
      close,
    }),
    [isOpen, mode, editingEpisode, isPlaylistOpen, playlistEpisode]
  );

  return (
    <EpisodeComposerContext.Provider value={value}>
      {children}
    </EpisodeComposerContext.Provider>
  );
};

export const useEpisodeComposer = () => {
  const context = useContext(EpisodeComposerContext);

  if (!context) {
    throw new Error(
      'useEpisodeComposer must be used within EpisodeComposerProvider'
    );
  }

  return context;
};
