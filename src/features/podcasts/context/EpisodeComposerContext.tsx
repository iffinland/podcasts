import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { PodcastEpisode } from '../../../types/podcast';

type ComposerMode = 'create' | 'edit';

interface EpisodeComposerContextValue {
  isOpen: boolean;
  mode: ComposerMode;
  editingEpisode: PodcastEpisode | null;
  isPlaylistOpen: boolean;
  openCreate: () => void;
  openEdit: (episode: PodcastEpisode) => void;
  openPlaylists: () => void;
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

  const openPlaylists = () => {
    setIsPlaylistOpen(true);
  };

  const closePlaylists = () => {
    setIsPlaylistOpen(false);
  };

  const value = useMemo(
    () => ({
      isOpen,
      mode,
      editingEpisode,
      isPlaylistOpen,
      openCreate,
      openEdit,
      openPlaylists,
      closePlaylists,
      close,
    }),
    [isOpen, mode, editingEpisode, isPlaylistOpen]
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
