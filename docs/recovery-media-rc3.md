# Q-Podcasts 1.0.1-rc.3 — recovery and media

Date: 21 November 2026. Base: the source ZIP of RC.2, whose runtime test passed. The original Git base is `2158ee0989eaa75435ee4eab5ca3f242ae107fde`. RC.3 subsequently passed the user runtime check and was approved for main and GitHub release publication. QDN deployment remains separate.

## Point 3: interrupted publishing

- Starting Publish, Update or Delete saves a job before the first QDN write. Form data, original episode reference, stable episode ID, operation timestamp and selected files are committed atomically in IndexedDB. New covers are optimized before saving. Unsubmitted form typing is not autosaved.
- The app shows unfinished jobs above page content for the selected publisher, including after the app/tab is closed and reopened. It offers Continue publication, Check status and Remove local draft.
- Retrying an identical unfinished form finds its existing job. Its content signature includes actual file bytes, not just filename, size and modification date.
- The persistent per-resource journal writes a pending marker before asking the bridge to publish. Acknowledged matching stages are skipped. Ambiguous file stages require a READY resource and exact streamed SHA-256 verification before they can be reused. Metadata is compared as exact bytes during ambiguous recovery, including update/delete markers. Same-sized but different content is rejected.
- Check status reads resources without asking for a paid publication. A metadata submission interrupted before the job result was stored can still be reconciled into the local feed from its saved metadata.
- Unverified steps are never automatically resubmitted. An explicit Resubmit unconfirmed step choice explains the potential additional fee and retains the original episode ID. Confirmed stages are still skipped.
- Atomic IndexedDB leases coordinate jobs, forms and resources across tabs. An abruptly closed tab's lease expires after two minutes. A waiting draft may briefly report that another tab is handling it; retry after that lease expires. Pending resource markers continue to protect against automatic replay.
- If the initial durable save fails, the first upload is prevented. Successful verification removes the job's saved audio/cover blobs. Removing a local draft does not remove content already published to QDN.

Storage is local to the same browser profile, app origin and device. Clearing site data, private-session cleanup or browser storage eviction can remove drafts. A different app origin or device cannot access them. RC.2 uploads that predate durable storage cannot acquire missing original files retroactively. Existing same-tab RC.2 journal markers are migrated conservatively on reuse and require verification. Payments are unchanged in this phase.

## Point 4: media loading

- Playback asks Core for `GET_QDN_RESOURCE_STATUS` with `build: true` before resolving the audio URL. The UI distinguishes availability checking, download progress, preparation and native audio buffering.
- Percentages come from Core's `percentLoaded` or local/total chunk counts. No synthetic percent is displayed when the node lacks those values. DOWNLOADED/BUILDING is not treated as READY.
- Polling stops after five minutes for audio and offers retry. Cover polling is bounded to twenty seconds, uses background request slots and only starts near the viewport. Covers offer a retry action after failure.
- Changing an episode, closing the player or unmounting cancels obsolete wait loops and ignores late bridge responses. The already-issued bridge request itself cannot be recalled. Native events from replaced audio elements and late rejected play promises are ignored.
- A browser autoplay restriction displays a manual Play instruction. Download readiness does not override browser gesture requirements.
- New cover images keep their aspect ratio, do not upscale and fit within 1024 × 1024. Files already within that size and 512 KiB are preserved for JPEG/PNG/WebP. Others are encoded as WebP or white-backed JPEG, with a 512 KiB output limit and further reduction if necessary. Originals larger than 10 MiB are rejected before publication. Decoded image resources are released on success and failure.
- Existing published audio and covers, metadata schema, resource identifiers, shared links and playlists remain compatible. No audio transcoding or republishing of existing content is performed.

Core's status fields and `build` request were checked against the available current Core source (`ArbitraryResourceStatus.java` and `q-apps.js`). Qortal Hub forwards that action through its message listener.

## Validation

- 48 Node/jsdom regression tests passed, using a mocked Qortal bridge and fake IndexedDB. This includes the preceding 32 tests plus cold-module recovery, stable timestamps/identifiers, no repeated acknowledged audio, exact streaming verification of ambiguous audio, read-only reconciliation, missing storage, duplicate form suppression, tab leases, local blob cleanup, publisher filtering, QDN cancellation/status errors and cover processing.
- SHA-256 is tested against a known vector and a multi-chunk stream. Encoding tests use mocked bitmap/canvas APIs; actual browser image compression remains a runtime check.
- Production build and TypeScript project checks passed.
- ESLint has no errors; the five existing React Fast Refresh export warnings remain. Formatting is checked before packaging.
- Build sizes and baseline comparison are recorded in `build-metrics-rc3.json`. The publication job engine remains a separate on-demand chunk. Font bytes match the validated earlier build.
- Automated checks did not perform live QDN writes, real fees, payments or deliberate device/app termination. The user separately reported RC.3 runtime passed.

## Runtime check

1. Confirm version 1.0.1-rc.3, open a few existing episodes and switch/close during a slow load. Check download/build/buffer text and cover retry.
2. Publish a small test episode with a large cover. Confirm that its reduced cover displays correctly.
3. Interrupt a test publication after the draft has been saved. Reopen the same app on the same device, select its publisher and use Check status/Continue publication. Confirm that acknowledged stages do not prompt for payment again. Allow up to two minutes for a closed tab's lease to expire.
4. Confirm an update and deletion still reconcile correctly, and that completed jobs disappear from the unfinished list. Remove unwanted local drafts with the app's button rather than clearing all site storage.

Use the runtime ZIP whose root contains `index.html`. The source ZIP is a separate code backup. The user has approved RC.3 runtime and requested main/release publication. See the release notes for the published package layout and validation status.
