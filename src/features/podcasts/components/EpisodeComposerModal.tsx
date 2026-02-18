import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PodcastEpisode } from '../../../types/podcast';
import { PODCAST_CATEGORIES } from '../constants/podcastCategories';
import type { SaveProgress } from '../hooks/usePodcastCrud';
import '../styles/episode-composer-modal.css';

interface EpisodeComposerModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  activeName: string | null;
  editingEpisode: PodcastEpisode | null;
  isSaving: boolean;
  errorMessage: string | null;
  saveProgress: SaveProgress | null;
  onClose: () => void;
  onCreate: (payload: {
    ownerName: string;
    title: string;
    description: string;
    tags: string[];
    categories: string[];
    audioFile: File;
    thumbnailFile?: File;
  }) => Promise<void>;
  onEdit: (payload: {
    episode: PodcastEpisode;
    title: string;
    description: string;
    tags: string[];
    categories: string[];
    newAudioFile?: File;
    newThumbnailFile?: File;
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
  errorMessage,
  saveProgress,
  onClose,
  onCreate,
  onEdit,
}: EpisodeComposerModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (mode === 'edit' && editingEpisode) {
      setTitle(editingEpisode.title);
      setDescription(editingEpisode.description);
      setTagsInput(tagsToText(editingEpisode.tags));
      setCategories(editingEpisode.categories);
      setAudioFile(null);
      setThumbnailFile(null);
      setSubmitError(null);
      return;
    }

    setTitle('');
    setDescription('');
    setTagsInput('');
    setCategories([]);
    setAudioFile(null);
    setThumbnailFile(null);
    setSubmitError(null);
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

  const toggleCategory = (category: string) => {
    setCategories((previous) => {
      if (previous.includes(category)) {
        return previous.filter((item) => item !== category);
      }

      return [...previous, category];
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeName) {
      return;
    }

    const tags = toTagsArray(tagsInput);

    setSubmitError(null);

    try {
      if (mode === 'edit' && editingEpisode) {
        await onEdit({
          episode: editingEpisode,
          title,
          description,
          tags,
          categories,
          newAudioFile: audioFile ?? undefined,
          newThumbnailFile: thumbnailFile ?? undefined,
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
        categories,
        audioFile,
        thumbnailFile: thumbnailFile ?? undefined,
      });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save episode.';
      setSubmitError(message);
    }
  };

  const visibleError = submitError ?? errorMessage;
  const showProgress =
    isSaving &&
    saveProgress &&
    ((mode === 'create' && saveProgress.operation === 'create') ||
      (mode === 'edit' && saveProgress.operation === 'edit'));

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
          {showProgress ? <p className="episode-modal__status">{saveProgress.message}</p> : null}
          {visibleError ? <p className="episode-modal__error">{visibleError}</p> : null}

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

          <fieldset className="episode-modal__categories">
            <legend>Categories</legend>
            <div className="episode-modal__categories-list">
              {PODCAST_CATEGORIES.map((category) => (
                <label key={category} className="episode-modal__category-option">
                  <input
                    type="checkbox"
                    checked={categories.includes(category)}
                    onChange={() => toggleCategory(category)}
                    disabled={isSaving || !activeName}
                  />
                  <span>{category}</span>
                </label>
              ))}
            </div>
          </fieldset>

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

          <label>
            Thumbnail image (optional)
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setThumbnailFile(event.target.files?.[0] ?? null)}
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
