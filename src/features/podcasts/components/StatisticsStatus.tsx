import { useEpisodeEngagement } from '../hooks/useEpisodeEngagement';
export default function StatisticsStatus() {
  const statistics = useEpisodeEngagement(null);
  return (
    <div role="status" className="statistics-status">
      {statistics.isLoading ? (
        <p>
          {statistics.isCached
            ? 'Cached statistics; checking for changes. '
            : ''}
          {statistics.discovering
            ? `Checking feedback index (${statistics.total} resources found)...`
            : `Checking statistics: ${statistics.processed} / ${statistics.total}. Totals may still change.`}
        </p>
      ) : statistics.isComplete ? (
        <p>
          Statistics checked.
          {statistics.localPending > 0
            ? ' Recent feedback is awaiting the QDN index.'
            : ''}
        </p>
      ) : (
        <p>
          Statistics are incomplete.
          {statistics.isCached
            ? ' Previous totals are shown where available.'
            : ''}
        </p>
      )}
      {statistics.error && <p>{statistics.error}</p>}
      <button
        type="button"
        disabled={statistics.isLoading}
        onClick={() => void statistics.refresh()}
      >
        {statistics.error ? 'Retry statistics' : 'Refresh statistics'}
      </button>
    </div>
  );
}
