# focalPoint production readiness

Updated 25 October 2026. Scope: separate mobile app and its VPS overlay. Original web source is not edited.

## Delivery order

1. Fix results layout, neutral overview, direct Question 1 review and outcome grid.
2. Rebrand visible UI, installed app, notifications, launcher/store artwork and support content. Preserve installed-app identifiers, local data, signing and legacy callbacks.
3. Remove development fixture imports, seeded student accounts and synthetic catalog/navigation branches from the application. Keep isolated unit-test fixtures outside src. Real empty states and real API failures remain visible.
4. Add accessible privacy, support, terms and account-deletion-request paths. Publish accurate policy resources; verify real support handling and deletion workflow before declaring compliance.
5. Audit client request races, account isolation, retry/cancellation, upload/download persistence and backend authentication, queues, resource limits and data ownership. Fix demonstrated defects with targeted tests.
6. Verify shared Supabase schema, real signup/login, upload/review, offline practice, results/history and device notification delivery. No synthetic data or test broadcast to real students.
7. Complete Play Console answer pack, original brand assets and release checks. Produce a signed production-configuration AAB for internal testing; publish only after release gates pass. Never claim successful builds prove production compliance.

## Capacity gate

The current VPS is one application container with about 8 GB RAM and local persistent storage. File-based sessions, in-memory rate limits and local SQLite workers require single-writer discipline. They are not a horizontally scalable million-concurrent-user design. A million registered accounts and a million simultaneous sessions are different workloads.
Before a scale claim: establish expected active/concurrent users and request mix; use a staging environment, durable shared jobs, object storage/CDN, managed database, shared rate limits, worker leases, backups/restore and observability; run measured load and failure tests. No large load test or unvalidated multi-replica rollout against the live service.

## Release gates still to prove

- Public policy and account deletion resources and an operational deletion process.
- Children/mixed-audience data and provider compliance; current app has not been audited as child-directed.
- Supabase migration acceptance and browser/mobile history write/read parity.
- OAuth callback allowlist and Android Play signing client registration where applicable.
- New personal Google Play account: 12 opted-in testers continuously for 14 days, then production-access review.
- Licensed question content, complete rating questionnaire (including biology/anatomy content) and real review credentials.
- Production EAS environment is populated with validated public API/auth configuration. No preview/demo switch is used.

## Evidence

Latest installed-device baseline: 1.0.7, commit 78b53f6. Release candidate 1.0.8 includes rebranding, clean screens and durable transfers. Current checks: TypeScript passes; 121 mobile tests and 11 backend tests pass; SDK dependency compatibility passes. Signed 1.0.8 builds are recorded below once verified.

## 24 October upload and offline verification

- Rebranded display name, wordmark, launcher assets, native permission text, legal/support pages and store artwork to focalPoint. Bundle IDs, existing signing and pastq callbacks remain compatible. No production screen imports test questions or a synthetic catalog.
- Supabase callback verification accepts both mobile callback schemes. A recreated temporary QA account signs in. The existing database has legacy exam summaries, without the detailed analytics tables; the app now writes its actual legacy columns and verifies duplicate retries. Two authenticated clients read back the new summary. Detailed topic outcomes remain on-device and queued; cross-device topic analytics is still a schema gate.
- Live PNG, PDF and DOCX uploads each produced two questions through the real extraction provider. The VPS started each job from receipt of the final part, without an app-side start request. Confirmed private material and approvedAt persisted; reopening loads a normal practice paper. Only the authorized QA account was used.
- Native upload tasks stage durable, owner-scoped files, checksum four-MB parts, enqueue native background network work and retry only missing acknowledgements. Source files survive an interrupted transfer. Account changes cancel native tasks; double taps share one transfer.
- Downloads retain completed parts, SDK pause state and available partial bytes. Byte-range recovery and full-response fallback pass native-adapter tests. Explicit pause remains paused.
- OS-scheduled recovery can retry started jobs after process restart when the OS grants execution. iOS/Android control background timing; force-stop/force-quit cannot be promised to continue. Physical-device suspension, network loss, relaunch and battery-restriction tests are still required on the new signed build.
- Staged VPS tests (internet disabled, separate temporary data) verified auth ownership, campaign delivery, real DOCX conversion and PDF preparation restart without duplicate page IDs. Production deployment retained a full data backup and rollback image after confirming zero active extraction jobs. The original web checkout was not edited by this work.
- Public HTTPS health, privacy, deletion-request and support pages return 200. The deletion resource starts an ownership-verified email request; operation and fulfilment remain an owner responsibility.

Production deployment image: focalpoint-api:uploads-20261024. Backup: /opt/pastq/backups/focalpoint-uploads-20261024/student-data.tar. Previous image retained as pastq-api:rollback-uploads-20261024.

## 25 October final recovery and UI audit

- Camera button is centered within the navigation frame rather than the browser/window width. Verified in the actual signed-in QA preview: camera center and app center both 159.5 px at a 319 px app width; tapping opens Upload material.
- An actual QA DOCX upload reopened directly into practice setup, completed with one correct and one wrong answer, opened Review answers at Question 1 and showed Correct/Wrong outcomes in the navigator. No test fixtures are imported by the shipped application.
- SQLite and IndexedDB draft acknowledgements compare the stored version atomically; an older transfer cannot remove a newer upload. Owner changes do not persist a prior account's draft into the new account.
- Foreground and recovery share upload session creation. Failed uploads do not block download recovery; separate accounts have independent recovery runs.
- React Native's installed AbortController drops abort reasons. Recovery now retains its reason separately and propagates it to the download controller, keeping background expiry/account changes eligible for retry while preserving manual pauses. Regression tests use the installed native-compatible abort-controller and real SQLite.
- Production EAS variables now point to the live HTTPS VPS and the correct Supabase project using only the public client key. This is build preparation, not Play publication approval.

## Final review simplification and build candidates

The review screen shows the question and highlighted answer options. Redundant Correct/Wrong status headings, visible Your answer captions and the entire All/Correct/Wrong/Unanswered/Saved filter strip were removed at the owner's request. Screen-reader answer semantics remain. The actual QA session reopened from history and the new layout was visually verified.

Final source commit: bb6154e. Preview Android version code 11; iPhone build number 10. The production AAB increments Android to 12. Earlier code-9/code-10 builds predate these last review changes and should not be distributed as the final update.

Final build candidates (status must be checked before installation):

- Android APK: d300ae7f-0371-4865-96a3-f5fb787a7e73
- Registered iPhone: 6076abbf-3c15-4142-a161-5fe15c7697ad
- Play internal-testing AAB: 55a7e185-7663-4b7d-8f3b-e48e2a265800

Security tooling audit on 25 October: npm audit --omit=dev reports five high-severity package findings arising from two advisories, node-forge <=1.4.0 (GHSA-86w9-cpqp-85rv) and Zod <4.6.6 (GHSA-mrhx-c7xc-m3w5). npm explain places these under Expo CLI/code-signing tooling. The current registry node-forge latest is 1.4.0; forcing Zod 4 into a tool expecting Zod 3 or downgrading Expo to 44 is not a validated fix. These findings remain tracked; a clean dependency security audit is not claimed.
