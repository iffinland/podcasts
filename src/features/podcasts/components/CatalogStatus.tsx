import { ensureCompleteCatalog, usePodcastCrud } from '../hooks/usePodcastCrud';
export default function CatalogStatus() {
  const catalog = usePodcastCrud('', false);
  return (
    <div role="status" className="catalog-status">
      {catalog.catalogLoading ? (
        <p>
          {catalog.catalogDiscovering
            ? `Checking the full catalog (${catalog.catalogDiscovered} resources found)...`
            : `Searching the full catalog: ${catalog.catalogProcessed} / ${catalog.catalogDiscovered} checked. Matches appear as they are found.`}
        </p>
      ) : catalog.catalogComplete ? (
        <p>
          Full catalog checked: {catalog.episodes.length} available episodes.
        </p>
      ) : (
        <p>
          Catalog results are incomplete. {catalog.catalogProcessed} resources
          checked.
        </p>
      )}
      {catalog.catalogError && <p>{catalog.catalogError}</p>}
      {!catalog.catalogLoading && !catalog.catalogComplete && (
        <button type="button" onClick={() => void ensureCompleteCatalog(true)}>
          Check full catalog
        </button>
      )}
    </div>
  );
}
