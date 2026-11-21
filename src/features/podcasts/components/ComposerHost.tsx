import { lazy, Suspense } from 'react';
import { useIdentity } from '../../identity/context/IdentityContext';
import { useEpisodeComposer } from '../context/EpisodeComposerContext';
import { usePodcastCrud } from '../hooks/usePodcastCrud';
const EpisodeComposerModal = lazy(() => import('./EpisodeComposerModal'));
export default function ComposerHost() {
  const composer = useEpisodeComposer();
  const { activeName } = useIdentity();
  const crud = usePodcastCrud('', false);
  return (
    <>
      {crud.saveProgress && (
        <p className="publication-status" role="status">
          {crud.saveProgress.message}
        </p>
      )}
      {composer.isOpen && (
        <Suspense fallback={<p role="status">Loading publisher...</p>}>
          <EpisodeComposerModal
            isOpen
            mode={composer.mode}
            activeName={activeName}
            editingEpisode={composer.editingEpisode}
            isSaving={crud.isSaving}
            errorMessage={crud.saveError}
            saveProgress={crud.saveProgress}
            onClose={() => {
              if (!crud.isSaving) composer.close();
            }}
            onCreate={async (input) => {
              await crud.createEpisode(input);
            }}
            onEdit={async (input) => {
              await crud.editEpisode(input);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
