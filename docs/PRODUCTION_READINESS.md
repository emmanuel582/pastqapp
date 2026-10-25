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

- Public policy and deletion-request pages are live (HTTP 200); ownership verification and actual deletion fulfilment still need operational validation.
- Children/mixed-audience data and provider compliance; current app has not been audited as child-directed.
- Supabase migration acceptance and browser/mobile history write/read parity.
- Mobile callback allowlist is verified. Complete a Google sign-in return-to-app check on the latest signed device builds. Native Google Sign-In registrations remain deferred; the current flow uses system-browser OAuth.
- New personal Google Play account: 12 opted-in testers continuously for 14 days, then production-access review.
- Licensed question content, complete rating questionnaire (including biology/anatomy content) and real review credentials.

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

Final source commit: bb6154e. Preview Android version code 11; iPhone build number 10. The production AAB increments Android to 12. Earlier Android codes 9/10 and iPhone build 9 predate these last review changes and should not be distributed as the final update.

Final signed builds (all FINISHED; artifact header checks returned 200):

- [Android APK](https://expo.dev/accounts/emmanuelwritecode/projects/focalpoint/builds/d300ae7f-0371-4865-96a3-f5fb787a7e73)
- [Registered iPhone](https://expo.dev/accounts/emmanuelwritecode/projects/focalpoint/builds/6076abbf-3c15-4142-a161-5fe15c7697ad)
- [Play internal-testing AAB](https://expo.dev/accounts/emmanuelwritecode/projects/focalpoint/builds/55a7e185-7663-4b7d-8f3b-e48e2a265800)

Security tooling audit on 25 October: npm audit --omit=dev reports five high-severity package findings arising from two advisories, node-forge <=1.4.0 (GHSA-86w9-cpqp-85rv) and Zod <4.6.6 (GHSA-mrhx-c7xc-m3w5). npm explain places these under Expo CLI/code-signing tooling. The current registry node-forge latest is 1.4.0; forcing Zod 4 into a tool expecting Zod 3 or downgrading Expo to 44 is not a validated fix. These findings remain tracked; a clean dependency security audit is not claimed.

## Signed device build results, 25 October

- Final Android APK d300ae7f-0371-4865-96a3-f5fb787a7e73 (version code 11): FINISHED.
- Final iPhone 6076abbf-3c15-4142-a161-5fe15c7697ad (build 10): FINISHED; signed IPA HTTP HEAD 200, 15,003,402 bytes.
- Play AAB 55a7e185-7663-4b7d-8f3b-e48e2a265800 (code 12): FINISHED; artifact HTTP HEAD 200, 77,600,377 bytes.

No APK/IPA was downloaded to the laptop. These results establish successful native builds, not physical-device background behavior, complete cross-device analytics, all-age compliance or large-scale capacity. The gates above still apply before public publication.

Final live smoke checks: health, privacy, terms, support and deletion-request resources returned 200. Private vision-session and transfer endpoints returned 401 without authentication. Android APK header check returned 200 with 60,923,884 bytes.

## 25 October 1.0.9 upload and catalogue update

- Preferences prioritises past sessions, saved questions, uploads and reminders. Help & privacy is near the bottom. The device test-notification button and Home upload-management prompts are removed.
- Upload management is a dedicated Preferences page with owner-only, paginated server summaries and offline cache. Completed uploads open normal practice setup directly; stale local confirmation cannot bypass an explicit unapproved server state.
- Navigation is blocked while files/text are being sent. Once the VPS accepts the files, processing can continue independently and existing native push delivery reports ready/attention states. App termination and background execution remain controlled by the OS.
- The real failed 109-question upload contained two type-other questions with no CBT options. Review now presents unresolved questions first, requires an explicit CBT/Written choice, validates edits locally and permits removing extraction artefacts. The server accepts only a nonempty subset of original IDs, rejects foreign/duplicate IDs and gives question-specific errors. No answer is fabricated.
- Open page clarifications stay on Processing until handled; the ready-questions bypass and delayed redirect are removed. Notification taps use the same clarification gate. A completed material does not enqueue another extraction-completion alert.
- Student uploads previously entered the shared catalogue automatically. Shared publication now requires a server-owned flag set only from authenticated admin identity; a student request cannot opt itself into publication. Existing private source uploads are preserved.
- At the owner's request six shared entries were recoverably archived, leaving only Chemistry Remix (1,899 questions) in Other materials. UTME and both WAEC banks remain. Four exact, provenance-verified QA upload sessions were archived; no real student upload was removed. Public catalogue and the actual browser view show only Chemistry Remix in Other materials.
- Archive receipts are retained privately under .qa. VPS recovery locations: /var/lib/pastq/qa-archive/library-20261025-1792898573232 and /var/lib/pastq/qa-archive/uploads-20261025-1792899127451. Original catalogue/aliases, exact bundle files, QA session/page files and reviewed rows are retained for restoration.
- Current VPS image: focalpoint-api:upload-flow-20261025. Consistent pre-deployment data backup: /opt/pastq/backups/focalpoint-upload-flow-20261025/student-data.tar. Rollback image: pastq-api:rollback-upload-flow-20261025. Deployment checked zero active extraction jobs and passed readiness health checks.
- Verification: TypeScript, 129 mobile tests, Android and iOS production exports passed. Backend unit tests passed 16/16; isolated deployed-image HTTP tests passed 2/2. Browser checks verified Preferences ordering, no test-notification button, upload list state, DOCX Complete to practice setup, subsequent completed-material reopening, and archived uploads disappearing from the list.
- All previous public-release gates still apply, including physical-device background/network-loss tests, detailed Supabase analytics migration, content rights, age/data compliance and Play testing access. Native build success is recorded separately after completion.

## 25 October code audit and 1.0.10 candidate

Reviewed the app entry/navigation, auth and account boundaries, queued sync, uploads/download recovery, private media, exam completion, working-paper persistence, backup validation, notification scheduling, library/search and release inputs. This is a bounded code and test audit, not a guarantee that every possible failure has been eliminated.

- Owner-bound API options stop a queued report, reminder, upload list, private download or upload creation from starting under a newly signed-in account. Already-cancelled requests stop before auth/network work. Profile metadata updates also verify their current owner.
- Native SecureStore reads, writes and removals are serialised per key. Concurrent token refresh cannot invalidate an in-flight read or resurrect a signed-out session. Failed/oversized writes preserve the previous session; malformed chunk counts stay bounded. The existing storage format remains readable.
- Reminder saves and retries are ordered per account and reject obsolete snapshots. Acknowledgements compare the queued version before removal. Manual settings persist before the network request; late initial fetches cannot replace edited or queued settings. Background scheduling reuses the current local settings instead of overwriting a newer manual schedule.
- Exam completion, the history outbox and learning evidence now commit in one SQLite/IndexedDB transaction. A simulated storage failure rolls back the entire completion and succeeds on retry. A failed UI refresh cannot misreport an already-persisted exam as unsaved. Completed exams reject further answer edits.
- Written-answer backups recognise all supported written formats, including essay and structured questions. Self-assessment values are bounded. Manual uploads cannot recreate their draft through a late autosave after acceptance. Inbox polling no longer overlaps on slow requests.
- Private diagrams use the existing content-addressed asset map. Repeated figures and rich-text references store the image once; unchanged saved assets do not download again. The regression fixture is less than half the previous repeated-image representation. This is a storage optimisation, not a claim about all papers' size.
- Removed remaining test-reminder UI and mobile diagnostic notification exports, unused imports/state/calculations, empty UI branches, two unreachable modules (including an obsolete embedded greeting), and three unused startup font faces (about 268 KB of uncompressed font assets). The used design fonts and native identifiers remain.
- Removed four unused Vite/Tailwind dev dependencies and 34 packages. Local authoring scripts and unused source artwork are excluded from EAS archives. Tests, QA credentials, reference files, server sources and store documents remain excluded from the mobile release; useful regression tests stay in the repository. No production entry imports question fixtures or fabricated student progress.
- TypeScript now enforces unused-local and unused-parameter checks. All 145 mobile tests pass. SDK dependency compatibility and final Android/iOS production exports pass after the font reduction. The local preview uses the normal app entry, with automatic QA sign-in removed. Shared catalogue QA cleanup remains live.
- Dependency audit: five high findings remain in the production npm dependency tree under Expo CLI/signing tooling. The complete development tree reports seven high and three moderate findings. A non-forced repair dry run leaves those counts unchanged; the suggested major Expo downgrade was not applied. No clean security audit is claimed.
- Public-release gates remain: detailed Supabase analytics schema, physical-device background/network-loss/OAuth verification, dependency advisories, content rights, age/data compliance, operational account deletion and Play testing/production access. The existing single VPS has not been certified for million-user concurrency.

The earlier 1.0.9 preview builds (Android 5607cbbb-a361-43f4-a43c-d0d0d3ed9100 and iPhone 631f248c-87fd-4eb6-b2a1-f8948d30c6cc) finished, but predate this audit. The replacement candidate is 1.0.10, preview Android code 14 and iPhone build 12. Do not distribute the older packages as this audited update.

## 1.0.10 signed-build outcome, 25 October

Source commit 22f64f2 passed 145 mobile tests, strict TypeScript checks and Android/iOS production exports. The EAS upload archive was 6.0 MB, compared with 7.6 MB for the preceding candidate; this is not an installed-app size measurement.

- iPhone preview build 12: FINISHED. [Install on the registered iPhone](https://expo.dev/accounts/emmanuelwritecode/projects/focalpoint/builds/f84a8c01-e9b7-4a00-92d2-dc992a8a0e52). Installer HTTP HEAD returned 200 with 15,178,708 bytes. No binary was downloaded to the laptop.
- Android was attempted first. EAS rejected the new build because the current account exhausted its monthly Free-plan Android allowance. Its stated reset is 1 November 2026. No 1.0.10 APK or Play AAB has been generated; an account change has not yet been performed.
- The existing 1.0.9 APK remains available at build 5607cbbb-a361-43f4-a43c-d0d0d3ed9100; its installer HEAD returned 200. It predates the 1.0.10 audit fixes and must not be described as the audited update.

Successful compilation and installer availability do not close the public-release gates documented above.

## Android build account, 25 October

The owner authorised Android builds under Expo account wealthdigitals. Project @wealthdigitals/focalpoint has ID 6428833a-bccf-43b0-b02d-5ddc9225336a. Source commit baf98be adds an Android preview profile and a validated, opt-in build-ownership override.

The base app.json and its existing notification project ID remain unchanged. The native push service explicitly uses that stable ID; the existing FCM/APNs registrations and iPhone build remain on the original project. This is a separate Android build project, not a transfer of the iPhone/push project. Runtime push delivery on the replacement APK still needs a physical-device check.

Android uses the existing com.pastq.study application ID, version 1.0.10/code 14, public Firebase app configuration and original signing keystore. The locally exported signing files are ignored by Git and excluded from the source archive; EAS receives them through its supported local-credentials channel. Only the three verified public API/Supabase variables and the disabled design-preview flag were copied into the new project's preview environment.

For subsequent Android builds on the authenticated wealthdigitals CLI, use PowerShell:

```powershell
$env:FOCALPOINT_EAS_OWNER = 'wealthdigitals'
$env:FOCALPOINT_EAS_PROJECT_ID = '6428833a-bccf-43b0-b02d-5ddc9225336a'
eas build --platform android --profile preview-android
```

Clear those two shell variables before working with the original iPhone project and sign into an Expo account with access to it. Never commit credentials.json or the keystore. Configuration checks verified that the override preserves both platform identifiers, leaves the base notification ID unchanged and rejects partial overrides.

Android 1.0.10/code 14 completed successfully: [Install APK](https://expo.dev/accounts/wealthdigitals/projects/focalpoint/builds/4a2da8ec-8de0-450f-8cee-eb2e3a3c4f8f). Installer HTTP HEAD returned 200 with 61,092,188 bytes. The artifact was verified as an APK; no application binary was downloaded to the laptop. No new Play AAB was built in this account-switch step. Physical-device install/update and notification delivery checks remain.
