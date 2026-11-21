# Q-Podcasts 1.0.1-rc.2 — full catalog and statistics

Date: 21 November 2026. Starting point: runtime-approved 1.0.1-rc.1, based on repository commit `2158ee0989eaa75435ee4eab5ca3f242ae107fde`. RC.2 subsequently passed the user runtime check and is included in the approved RC.3 main/release update. QDN deployment remains separate.

## Authorized scope

1. Search/filter the full episode catalog without manually loading additional batches.
2. Reduce repeated Likes & Tips document reads and clearly distinguish cached, loading, partial and checked statistics.

Closed-tab publication recovery and additional audio/image-loading work were deferred to RC.3. Within RC.2, RC.1's publisher, payment, player, image and publication-journal implementations are unchanged. Automated comparisons against the RC.1 source ZIP confirm that the publication/update/delete and media URL sections of the QDN service are also unchanged.

## Catalog behavior

- The first usable episode batch stays on the RC.1 foreground path. A shared two-worker background scan then discovers all catalog resource references. Browse and the tag/category selectors can also request this scan directly.
- Discovery uses node-provided creation time as its upper bound when available, ascending offset pages of 100, duplicate suppression and a guard against a non-advancing endpoint. No application-level total-result cap is imposed.
- Search uses title, full JSON description, author/@author, tags and categories. It does not rely on Core's shorter indexed description/tags. Tags/categories use consistent trimmed, case-insensitive comparison and count each episode once.
- Visible pages still contain 20 results. The app searches all checked episodes automatically; there is no Browse Load more requirement. My Published retains its existing author-scoped paging.
- Resource checks and cached hydration update the shared catalog in batches. New results do not reset the current visible page repeatedly. Taxonomy and rankings use a single central synchronizer, so navigating away from Home does not stop updates.
- A complete index check removes withdrawn resources from both global and previously loaded author feeds. Explicit delete markers remove the matching episode; a newer active revision can restore it. Confirmed local publications are protected from snapshot pruning until the resource index acknowledges their content.
- Missing/invalid document resources make the check incomplete, with progress and a retry action. A zero-match result is only final when the check completes successfully. Full catalog means the connected node's indexed resource set; inaccessible network data cannot be invented or treated as verified.

## Cache and statistics

- Public metadata/feedback bodies are stored in an app-specific IndexedDB document store with a scope index. No audio files, private wallet data or new QDN resources are stored by this phase. Memory caching remains usable when browser storage is blocked or full.
- Cached bodies are reused only when the resource's Core-created/updated revision matches. Reads with different revisions use different in-flight keys. A late older read cannot replace a newer cached revision. Nodes without revision fields use a 60-second body lifetime.
- Each refresh still paginates the lightweight resource index to discover new, changed and withdrawn records. It does not refetch unchanged cached bodies. Catalog checks are shared across routes, and a just-completed successful check is reused for two minutes unless explicitly refreshed.
- Statistics hydrate from cache, then revalidate the complete index with at most two workers sharing the existing background queue. Failed bodies do not stop checking later resources. Previously cached totals may be retained for unavailable resources, but remain labeled incomplete.
- A complete successful check replaces obsolete totals rather than permanently merging withdrawn records. Local confirmed feedback pending index propagation is overlaid until the index acknowledges it.
- Canonical/legacy feedback is deduplicated by publisher/episode using the resource's chain revision, with canonical preference on a tie. A self-declared JSON timestamp cannot make an older legacy record override a newer chain-indexed resource.
- Aggregate counts and per-user like sets are indexed once per feedback snapshot and shared across hook consumers. Sidebar rankings no longer repeatedly filter the entire feedback array for every episode on every render.
- The sidebar distinguishes cached/checking/incomplete/checked state, reports resource progress, offers refresh/retry, and states when rankings still cover an incomplete catalog. Returning to a visible app rechecks stale statistics.

## Validation

`npm run lint`, TypeScript, `npm test` and the production build pass. Five pre-existing Fast Refresh export-layout warnings remain; no lint errors or hook-dependency warnings.

32 regression/integration tests cover the RC.1 baseline plus:

- A 235-resource catalog and a match beyond the Core indexed-description length.
- An older episode found in Browse without Load more, with selected filters retained.
- Warm document reuse and exactly one body refetch after one revision changes.
- Persistent-cache reuse by a fresh module instance; storage-unavailable fallback.
- Late old/new revision races and expiry for timestamp-less resources.
- Failed-resource continuation, partial status, retry, withdrawn/deleted rows and restoration.
- Cached feedback retry, like removal, withdrawn-feedback cleanup, and chain-based legacy deduplication.
- @author/tag/category search and normalized taxonomy counts.

The bridge and IndexedDB are simulated in tests (jsdom and fake-indexeddb). Real-node search availability, long QDN downloads and actual mobile/browser storage behavior were covered by the user's subsequent RC.2 runtime approval. No real payment/publication is sent by the tests.

Build sizes are recorded in [build-metrics-rc2.json](build-metrics-rc2.json). No fixed live-network speed improvement is claimed.

## Runtime check

Search for an older episode, a phrase near the end of its description, a tag and a category. Confirm the progress/status changes and that Browse needs no manual Load more. Reopen the app and refresh Likes & Tips to check cached revalidation, stable counts and clear partial/error feedback. The first catalog population can take longer on a cold node; it remains in background capacity and does not monopolize playback requests.
