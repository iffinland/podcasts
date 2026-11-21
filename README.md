# Q-Podcasts

Listen to, publish, share and download podcasts on Qortal's decentralized data network.

Current release: **1.0.1-rc.3**. RC.1, RC.2 and RC.3 passed the user's runtime checks. This version retains the tested rc.3 label. GitHub is the source of the latest code and release packages; QDN deployment is performed separately.

- [Release and downloads](https://github.com/iffinland/podcasts/releases/tag/v1.0.1-rc.3)
- [Uploadable Q-App ZIP](https://github.com/iffinland/podcasts/releases/download/v1.0.1-rc.3/Q-Podcasts_1.0.1-rc.3_recovery-media.zip)
- [Source ZIP](https://github.com/iffinland/podcasts/releases/download/v1.0.1-rc.3/Q-Podcasts_1.0.1-rc.3_source.zip)
- [Changelog](CHANGELOG.md) and [release notes](docs/releases/1.0.1-rc.3.md)

## Development

Requires Node.js 20 or later and npm.

```bash
npm ci
npm run lint
npm test
npm run build
```

`npm run dev` starts Vite. Account access, publishing, payments and QDN reads require the Qortal Hub/Go bridge. An ordinary browser can show the shell but cannot perform those operations without the bridge. `npm run preview` serves the production build locally.

Publish the **contents** of `dist/`, with `index.html` at the APP resource root. The release Q-App ZIP has the same layout. Keep the APP name **Q-Podcasts** to preserve existing shared links. The source ZIP contains code and tests, not the uploadable app.

## RC.3: publication recovery and media loading

Before a publication starts, its form, files, episode identifier and operation timestamp are saved atomically in IndexedDB. Reopening the same app on the same browser/device shows unfinished publications for the selected publisher. Continue reuses acknowledged stages; uncertain uploads require exact SHA-256 read-back or an explicit resubmission decision. Check status performs reads only. Completed jobs release saved file blobs. Browser storage is required for publishing; a failed draft save prevents the first upload. Drafts begin when Publish/Update/Delete is pressed, not while an unsubmitted form is being typed.

The mini player waits for QDN readiness and shows actual download progress where Core provides it, file preparation and audio buffering. Closing the player or choosing another episode cancels stale loading work. Covers load near the viewport and offer retry after failure. New cover uploads are reduced to at most 1024 pixels on the long edge and 512 KiB, using WebP with a JPEG fallback. Existing published media is unchanged.

Details and runtime checks: [RC.3 report](docs/recovery-media-rc3.md).

## RC.2: full catalog and statistics

Browse automatically checks the complete catalog indexed by the connected node. Home starts the bounded background check after the first usable episode batch. Search covers title, full JSON description, author (including @name), tags and categories. Category and tag options update from the same shared catalog. There is no Browse Load more requirement; visible results remain paginated locally.

The app shows catalog/feedback discovery and verification progress. A partial or failed check is not presented as an authoritative empty result or verified zero. Sidebar rankings update on all routes and explicitly identify an incomplete catalog.

Public episode metadata and feedback documents are cached in IndexedDB, with an in-memory fallback. Subsequent checks compare Core's created/updated resource revisions and read only changed or uncached document bodies. Lightweight index pagination still runs to discover additions, updates and withdrawals. Legacy nodes without revision timestamps use a short cache lifetime. Cached statistics are revalidated; deleted/unlisted records do not remain in totals after a complete check.

Details: [RC.2 report](docs/catalog-statistics-rc2.md). Closed-tab publication recovery and further media-loading changes were deferred to RC.3. RC.1's publication, payment and media logic was unchanged in RC.2.

## Optimization baseline (RC.1)

- Shared session-level episode feeds and request deduplication survive page navigation.
- Metadata appears progressively; normal reads use six slots at most, with at most two background requests. Playback and interactive operations bypass the background queue.
- My Published supports QDN pagination in batches of 20 and uses an exact publisher-name filter. Browse now completes its catalog automatically in RC.2.
- Statistics are loaded incrementally in the background, cached across routes and deduplicated by publisher/episode. Legacy feedback is read without counting it twice.
- Account access uses a small app-owned provider. The unused qapp-core video/index/encryption infrastructure is absent from the initial bundle. Inter fonts use WOFF2 with font-display swap.
- Pictures resolve near the viewport, share URL results and have load-error placeholders.
- A global lazy-loaded publisher works on every route and retains progress while navigating. The original PODCAST/AUDIO/IMAGE identifiers and JSON version remain compatible.
- Publication stages and draft IDs are retained in session storage when available. Confirmed stages are not sent again on retry; ambiguous stages require read-back/status checking. A pending QDN verification does not resubmit the publication.
- Payment submission is separated from feedback publication. In-flight and ambiguous identical payments are guarded across routes in the current session. A new attempt after an uncertain result requires the user to check their wallet explicitly.
- The audio player follows buffering/end events, invalidates late URL responses, supports touch dragging and reuses the current URL for resume.

See [the change report](docs/optimization-rc1.md) for audit coverage, validation and remaining limits.

## Data and compatibility

Existing episode references, shared links, tags, categories and node-local playlist names are preserved. Full text and taxonomy remain in the metadata JSON; QDN's separate index metadata is constrained to Core's limits. Existing playlists stay on their original node. This build does not migrate them to QDN or silently change their keys. New conflicting playlist names are rejected.

Live feed state and request-flight caches live in memory. Public document bodies persist in IndexedDB when available; Refresh revalidates the resource index and reuses bodies whose Core revisions are unchanged. Publication drafts, files and stage journals now persist in IndexedDB across closing and reopening the same app/browser on the same device. Clearing site data, changing origin, private browsing cleanup or browser storage eviction can remove them; this is not a cross-device backup. Uncertain-payment markers still use session storage; payment recovery was not changed in RC.3.

## Tests

`npm test` bundles the regression suite with esbuild and runs Node's test runner with a jsdom DOM. The 48-test suite covers scheduling, deduplication, progressive/full catalog loading, scoped pagination, persistent/revision-aware caches, partial statistics, withdrawals, full-text/filter matches, publication confirmation/retry, payment result isolation and uncertainty, feed remounts, playlist permissions, route navigation and player response races. RC.3 adds cold-module publication recovery, content hashing, ambiguous-upload verification, draft deduplication, strict storage failures, cross-tab leases, blob cleanup, publisher-scoped recovery UI, QDN readiness/cancellation and image sizing/encoding fallback checks. Only bridge responses are simulated; tests never send real payments or publications.

CI runs lint, regression tests and the production build. Five existing React Fast Refresh export-layout warnings remain; there are no lint errors or hook-dependency warnings.

## Release workflow

The Release workflow runs when `package.json` or the release workflow changes on main, and can also be started manually from Actions on main. An existing release for the package version is left unchanged. New releases run lint, formatting, the full regression suite and a production build, then verify every application file against `docs/runtime-<version>-manifest.json` before packaging. The source ZIP is produced from the exact committed Git tree; checksums and build provenance accompany the uploadable ZIP.

A new version requires release notes in `docs/releases/<version>.md` and a manifest of the runtime-approved build. Prerelease labels remain prereleases on GitHub. No workflow publishes to QDN.
