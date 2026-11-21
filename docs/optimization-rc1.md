# Q-Podcasts 1.0.1-rc.1 — optimization test package

Status update: RC.1, RC.2 and RC.3 have passed the user's runtime checks. This report records the RC.1 implementation; its remaining-work list below has since been addressed by the RC.2 and RC.3 reports where indicated. All three phases are included in release 1.0.1-rc.3.

Date: 21 November 2026. Base: `2158ee0989eaa75435ee4eab5ca3f242ae107fde`. Local changes only; no commit, push or QDN deployment.

## Scope

This candidate addresses the audited startup, loading and operation-result problems while retaining the existing visual layout, published identifiers, JSON version and shared links. The uploaded published main JavaScript matched the base build after normalizing referenced asset hashes; additional published route chunks were not compared at the user's request.

## Audit coverage

| Audit IDs | Result in this package                                                                                                                                                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01–02     | Background concurrency limited to two; four metadata workers; progressive episode callbacks; interactive requests bypass the app's background queue.                                                                                                                                   |
| 03        | qapp-core removed from runtime dependencies; small identity provider replaces its unused global video/index infrastructure.                                                                                                                                                            |
| 04        | Shared in-memory feed/index and request-flight caches persist across route remounts. Explicit Refresh clears request-result cache.                                                                                                                                                     |
| 05        | Real limit/offset paging, 20 resources per batch; exact author filter for My Published; loaded search scope is stated in Browse.                                                                                                                                                       |
| 06        | Core's custom-timeout function used when available; action-specific defaults; uncertain writes never automatically replayed. Older bridges retain their own timeout limits.                                                                                                            |
| 07        | Payment success survives feedback failure. Cross-route pending/unknown transfer guard; explicit wallet-check step before repeating an uncertain payment.                                                                                                                               |
| 08        | Global publisher and save state; stable draft ID and confirmed-stage journal in tab session storage. No automatic replay of uncertain resources. Full cross-device/file recovery is outside this candidate.                                                                            |
| 09        | Read-back compares all parsed metadata, including expected status/version/content; stale responses produce pending verification, not verified success.                                                                                                                                 |
| 10–11     | Viewport-triggered thumbnail lookup and browser lazy decoding; shared URL cache; removed the page-wide thumbnail batches and unstable object-dependent effect.                                                                                                                         |
| 12–13     | Audio buffering/end/error events, stale-response invalidation on close, current-audio resume, versioned media URLs and touch dragging. Core download/build progress percentages are not provided by this candidate.                                                                    |
| 14        | Privileged playlist reads happen when Playlists is opened. The unused legacy likes-list startup read is removed. Public-node restrictions are shown through the existing playlist error area.                                                                                          |
| 15        | Missing playlist references resolved on demand; write errors reach the form; new normalized-name collisions rejected. Old colliding names are not automatically migrated.                                                                                                              |
| 16        | Lazy global composer is available on Home, Browse and My Published.                                                                                                                                                                                                                    |
| 17–18     | Loading/partial/error feedback, catalog/statistics retry controls, route load recovery, caught download/delete promises.                                                                                                                                                               |
| 19        | Numeric/boolean errors rejected; informational success messages accepted; structured errors normalized.                                                                                                                                                                                |
| 20        | Feedback author checked against resource publisher; finite nonnegative counters; canonical/legacy latest-record deduplication; optional owner reference on new feedback. Legacy records cannot unambiguously distinguish an artificially reused episode UUID across different authors. |
| 21        | Full app JSON preserved; index title/description constrained by UTF-8 bytes, at most five valid short index tags.                                                                                                                                                                      |
| 22        | Failed replacement thumbnail does not publish metadata with a removed old cover. Successful prior audio stages can be reused on retry. Automatic cover resizing is not included.                                                                                                       |
| 23        | Shared-link resolution is no longer cancelled by every incremental feed update. Name/list reads guard against stale account responses. Browser autoplay restrictions still apply.                                                                                                      |
| 24        | WOFF2/fonts with swap; inline default locale; player position saved after dragging; source-aware download extensions; explicit-origin embed URLs; version labeling, README, tests and CI updated.                                                                                      |

## Validation

- `npm run lint`: passes, zero errors. Five pre-existing Fast Refresh export-layout warnings remain.
- `npm test`: 16 passing regression/integration tests, including app navigation and global composer availability from Browse.
- `npm run build`: TypeScript and production Vite build pass.
- The generated app does not include the video.js dependency tree.
- Full WOFF2 glyph coverage is preserved from the repository's Inter TTF files.

Build byte counts are recorded in `build-metrics.json`. Transfer sizes are calculated gzip sizes; actual QDN/server compression may differ. Smaller JS is a measurable startup cost reduction, not a claim that a live cold QDN launch is a fixed number of seconds faster.

## Runtime checks requested

Open the optimization ZIP as APP/Q-Podcasts in your test environment. Check Home → Browse → Home, an older own episode via Load more, opening playlists, opening Publish from Browse, Play/pause/resume and switching tracks on mobile. If publishing or tipping is tested, distinguish the Hub approval result from later QDN propagation/statistics. Do not resend an action merely because propagation is pending.

Real QDN resource availability, Hub/Go approval timing, real audio decoding and real payments/publications were not exercised in the automated suite. A browser screenshot/real mobile run is not claimed. No settings on the user's nodes were changed.

## Remaining work after runtime feedback

The global feedback model still scans paged resources on the first session load, but now does so with bounded background capacity and progressive statistics; an aggregate index would be a separate compatibility-sensitive enhancement. Exact all-network search/ranking is not claimed for an incrementally loaded catalog. Node-local playlists remain node-local. Full closed-tab publication recovery, image resizing and optional Core QDN download-progress display can be considered separately after this candidate is verified.
