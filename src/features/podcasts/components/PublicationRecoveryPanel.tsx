import { useCallback, useEffect, useRef, useState } from 'react';
import { useIdentity } from '../../identity/context/IdentityContext';
import { usePodcastCrud } from '../hooks/usePodcastCrud';
import type { PublicationJob } from '../../../services/qdn/publicationJobs';
export default function PublicationRecoveryPanel() {
  const { activeName } = useIdentity();
  const crud = usePodcastCrud('', false);
  const [jobs, setJobs] = useState<PublicationJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reloadId = useRef(0);
  const owner = useRef(activeName);
  owner.current = activeName;
  const reload = useCallback(async () => {
    const requestId = ++reloadId.current;
    if (!activeName) {
      setJobs([]);
      return;
    }
    const { listPublicationJobs } = await import(
      '../../../services/qdn/publicationJobs'
    );
    const found = await listPublicationJobs(activeName);
    if (owner.current === activeName && requestId === reloadId.current)
      setJobs(found);
  }, [activeName]);
  const invalidateReload = useCallback(() => {
    ++reloadId.current;
  }, []);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (!cancelled) void reload().catch(() => {});
    };
    refresh();
    window.addEventListener('qpodcasts-publications-changed', refresh);
    document.addEventListener('visibilitychange', refresh);
    const channel =
      typeof window.BroadcastChannel === 'function'
        ? new window.BroadcastChannel('qpodcasts-publications')
        : null;
    if (channel) channel.onmessage = refresh;
    return () => {
      cancelled = true;
      invalidateReload();
      window.removeEventListener('qpodcasts-publications-changed', refresh);
      document.removeEventListener('visibilitychange', refresh);
      channel?.close();
    };
  }, [reload, invalidateReload]);
  const run = async (
    job: PublicationJob,
    options: { checkOnly?: boolean; resubmitUnconfirmed?: boolean } = {}
  ) => {
    setError(null);
    try {
      await crud.resumePublication(job.key, activeName ?? '', options);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : 'Could not continue the saved draft.'
      );
    }
    await reload().catch(() => {});
  };
  const visibleJobs = jobs.filter((job) => job.ownerName === activeName);
  if (!visibleJobs.length) return null;
  return (
    <section
      className="surface publication-recovery"
      aria-label="Unfinished publications"
    >
      <h3>Unfinished publications on this device</h3>
      <p>Saved files and completed steps are retained when the app closes.</p>
      {error && <p role="alert">{error}</p>}
      {visibleJobs.map((job) => (
        <article key={job.key}>
          <strong>{job.data.title}</strong>
          <p>{job.message}</p>
          <button
            type="button"
            disabled={crud.isSaving}
            onClick={() => void run(job, { checkOnly: true })}
          >
            Check status
          </button>
          {job.status !== 'pending' && (
            <button
              type="button"
              disabled={crud.isSaving}
              onClick={() => void run(job)}
            >
              Continue publication
            </button>
          )}
          {job.status === 'needs-review' && (
            <button
              type="button"
              disabled={crud.isSaving}
              onClick={() => {
                if (
                  window.confirm(
                    'Only resubmit if you checked Qortal and the step was not sent. A repeated submission can incur another QDN fee. Resubmit the unconfirmed step using the same episode ID?'
                  )
                )
                  void run(job, { resubmitUnconfirmed: true });
              }}
            >
              Resubmit unconfirmed step
            </button>
          )}
          <button
            type="button"
            disabled={crud.isSaving}
            onClick={() => {
              if (
                window.confirm(
                  'Remove this saved draft and its local files? Content already submitted to QDN remains published.'
                )
              )
                void import('../../../services/qdn/publicationJobs')
                  .then(({ forgetPublicationJob }) =>
                    forgetPublicationJob(job.key, activeName ?? '')
                  )
                  .then(reload)
                  .catch((value) =>
                    setError(
                      value instanceof Error
                        ? value.message
                        : 'Could not remove the draft.'
                    )
                  );
            }}
          >
            Remove local draft
          </button>
        </article>
      ))}
    </section>
  );
}
