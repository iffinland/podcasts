import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PodcastEpisode } from '../../../types/podcast';
import '../styles/episode-composer-modal.css';

interface EpisodeComposerModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  activeName: string | null;
  editingEpisode: PodcastEpisode | null;
  isSaving: boolean;
  onClose: () => void;
  onCreate: (payload: {
    ownerName: string;
    title: string;
    description: string;
    tags: string[];
    audioFile: File;
  }) => Promise<void>;
  onEdit: (payload: {
    episode: PodcastEpisode;
    title: string;
    description: string;
    tags: string[];
    newAudioFile?: File;
  }) => Promise<void>;
}

const toTagsArray = (value: string): string[] => {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
};

const tagsToText = (tags: string[]) => tags.join(', ');

const EpisodeComposerModal = ({
  isOpen,
  mode,
  activeName,
  editingEpisode,
  isSaving,
  onClose,
  onCreate,
  onEdit,
}: EpisodeComposerModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (mode === 'edit' && editingEpisode) {
      setTitle(editingEpisode.title);
      setDescription(editingEpisode.description);
      setTagsInput(tagsToText(editingEpisode.tags));
      setAudioFile(null);
      return;
    }

    setTitle('');
    setDescription('');
    setTagsInput('');
    setAudioFile(null);
  }, [isOpen, mode, editingEpisode]);

  const modalTitle = useMemo(() => {
    return mode === 'edit' ? 'Edit episode' : 'Publish new episode';
  }, [mode]);

  const submitLabel = useMemo(() => {
    if (isSaving) {
      return mode === 'edit' ? 'Saving...' : 'Publishing...';
    }

    return mode === 'edit' ? 'Save changes' : 'Publish episode';
  }, [isSaving, mode]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeName) {
      return;
    }

    const tags = toTagsArray(tagsInput);

    if (mode === 'edit' && editingEpisode) {
      await onEdit({
        episode: editingEpisode,
        title,
        description,
        tags,
        newAudioFile: audioFile ?? undefined,
      });
      onClose();
      return;
    }

    if (!audioFile) {
      return;
    }

    await onCreate({
      ownerName: activeName,
      title,
      description,
      tags,
      audioFile,
    });
    onClose();
  };

  return (
    <div className="episode-modal__backdrop" onClick={onClose}>
      <section
        className="episode-modal surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="episode-modal__head">
          <h3>{modalTitle}</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="episode-modal__form" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            Publish as
            <input type="text" value={activeName ?? ''} readOnly />
          </label>

          <label>
            Title
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              disabled={isSaving || !activeName}
            />
          </label>

          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              required
              disabled={isSaving || !activeName}
            />
          </label>

          <label>
            Tags
            <input
              type="text"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="web3, podcast, qortal"
              disabled={isSaving || !activeName}
            />
          </label>

          <label>
            Audio file {mode === 'edit' ? '(optional when editing)' : ''}
            <input
              type="file"
              accept="audio/*"
              onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
              required={mode === 'create'}
              disabled={isSaving || !activeName}
            />
          </label>

          <button type="submit" disabled={isSaving || !activeName}>
            {submitLabel}
          </button>
        </form>
      </section>
    </div>
  );
};

export default EpisodeComposerModal;
