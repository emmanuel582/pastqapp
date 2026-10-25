# focalPoint production readiness

Updated 25 October 2026. Scope: separate mobile app and its VPS overlay. Original web source is not edited.

## Current closed-test preparation - 25 October 2026

This section supersedes historical build/package/draft status recorded further below. Separate mobile project only; original web source remains untouched.

- FocalPoint CBT, Wealth Consort, wealthconsort@gmail.com. Correct Android identity com.wealthconsort.focalpoint, 1.0.11/code 16, source 8ba777d.
- AAB 952e5052-6454-474b-9d73-bb047f22c2c1 and APK 6ba6b522-4961-41e8-add3-df7b93393716 both FINISHED. Full AAB static verification passed (store/android-1.0.11-16-verification.json). Mobile tests 146/146; TypeScript and Android/iOS production JS exports passed. iOS 1.0.11 has not been signed/built.
- Owner authorised downloading only this AAB for Play upload. Downloaded SHA-256 matches the original audited bundle; ignored local file .qa/play-release/focalpoint-1.0.11-16.aab. Google accepted version 16 (1.0.11), target SDK 36, and the release preview shows Ready to release, with no blocking errors shown. Google estimates 20.1 MB for a new install; per-device delivery differs from the 77.8 MB upload bundle.
- All app-content declarations are actioned. Intended ages 13-15, 16-17 and 18+; Data safety saved with actual account, upload, study and messaging identifiers; IARC completed (Generic 12+, ESRB Everyone 10+, PEGI parental guidance). Content ratings do not certify production readiness.
- Listing FocalPoint CBT is ready to send for review, including six actual 800x1280 Android screenshots. Owner-confirmed AI mascot screenshot is individually labelled. Exact copy is in store/listing-en-GB.json; relevant exam names distinguish existing downloadable banks from user-provided papers. Four clean captures at 1080px or more on each side remain an asset improvement for enhanced promotion.
- Closed Alpha track 4698960041490294754: Nigeria only for testing, existing 15-person list selected, feedback wealthconsort@gmail.com, actual release notes saved. Worldwide production availability is requested for after production access; it is not yet configured or publicly launched.
- Public health, privacy, deletion-request and support routes returned 200 in fresh checks. Policies name Wealth Consort and ages 13+. Dedicated confirmed reviewer access is saved privately in Console; keep it active.
- The closed-test release and 14 prepared changes were sent for review; Console confirms Changes in review with automated quick checks in progress. Pending: successful Google checks/review, closed-test availability and 12 continuous opted-in testers for 14 days with genuine engagement/feedback. The clock has not started merely because the release was submitted. No public production release was submitted; do not promise approval.
- Public-production evidence still needed: operational account-deletion fulfilment, latest new-package physical OAuth/push/background/recovery/account-isolation checks and real 16 KB runtime. Detailed cloud topic sync still lacks the Supabase schema; no complete detailed cross-device sync is advertised. Known npm advisories remain. The single VPS is not million-user load certified.

Detailed current Console answers and actual limits: store/PLAY_CONSOLE_ANSWERS.md. Older chronological sections below are historical, not current release status.
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

## Current Play identity correction — 25 October 2026

This section supersedes earlier package/build-ownership instructions. App: FocalPoint. Play title: FocalPoint CBT. Publisher: Wealth Consort. Public support: wealthconsort@gmail.com. The existing paid Play account app uses com.wealthconsort.focalpoint, not com.pastq.study. Earlier APK/AAB links are not compatible with that Console entry.

Candidate 1.0.11/code 16 corrects the Android package, keeps the original signing key, removes unused SYSTEM_ALERT_WINDOW, and registers Android push against Expo project 6428833a-bccf-43b0-b02d-5ddc9225336a. Firebase registration verified: app 1:1081502964642:android:3657b87cf44cc3c31570fb under existing project pastq-4c772. Public config uses that verified app ID and package; no private key was read or committed. The owner privately uploaded the existing FCM key and provided EAS confirmation that it is assigned to com.wealthconsort.focalpoint. No new service account or IAM permissions were created. iOS preserves its existing signing/push project.

Validation: TypeScript passes; 146 mobile tests pass, including Android/iOS push-project isolation. Android production export passes. Replacement signed build and physical push/install checks remain pending.

Previous 1.0.10/code 15 AAB static audit: bundletool validation passed, target SDK 36, non-debuggable, expected signing certificate, all 64-bit ELF load alignments at least 16 KB, bundle PAGE_ALIGNMENT_16K enabled. No AD_ID or READ_MEDIA_IMAGES/VIDEO permissions. That binary uses the wrong Play package and must not be uploaded. These binary checks must be repeated on the replacement; static checks do not prove physical 16 KB runtime compatibility. Binaries were inspected only in an isolated VPS temporary directory, not downloaded to the laptop.

Console listing title/description saved as draft. Education category and wealthconsort@gmail.com saved. The owner confirmed intended audience 13+ and rights to distribute current banks. Reviewer email/password login and authenticated VPS access verified; ignored credentials are in .qa/play-reviewer-account.json. No real student progress was fabricated.

The 15 people added to internal testing are not closed-test opt-ins. Console showed 0 closed testers and no active closed release. The 14-day clock has not started. Use store/CLOSED_TEST_PLAN.md and the empty evidence log for actual results; Google retains production-access approval discretion.

Remaining gates include the signed corrected-package binary, actual device acceptance, real listing screenshots, Console content/data declarations, provider data handling, operational deletion, detailed analytics schema, known dependency advisories, and closed-test access. The single VPS has no million-user concurrency certification. Public policy source now names Wealth Consort and the 13+ audience; live replacement text still requires deployment verification.

### Live policy and current store drafts

The public Wealth Consort/13+ policy was deployed as focalpoint-api:policy-20261025 after checking zero active jobs/running sessions. The 28 pending upload records were older idle drafts, not processing work. Exact previous policy backup: /opt/pastq/backups/focalpoint-policy-20261025/legal-content.json; prior image retained as pastq-api:rollback-policy-20261025. API health, privacy, terms and account-deletion routes returned HTTP 200 after restart. Privacy contains Wealth Consort and the age-13 audience text.

Owner explicitly approved free download with future paid features. Console pricing was changed to Free and saved. Default listing draft includes the real 512px icon and 1024×500 feature graphic; real phone screenshots remain pending. Android corrected-package store build queued as 952e5052-6454-474b-9d73-bb047f22c2c1. Source commit 8ba777d. Both Android and iOS production exports passed; no claim is made that iOS 1.0.11 has been signed/built.

### Correct-package AAB verified

Build 952e5052-6454-474b-9d73-bb047f22c2c1 finished successfully. Version 1.0.11/code 16, package com.wealthconsort.focalpoint, artifact HEAD 200, 77,774,459 bytes. Actual signed binary passed bundletool validation, expected certificate, target SDK 36, release/non-debuggable, all 64-bit ELF load alignments ≥16 KB and enabled PAGE_ALIGNMENT_16K. No SYSTEM_ALERT_WINDOW, AD_ID or READ_MEDIA_IMAGES/VIDEO permissions remain. Full public static evidence: store/android-1.0.11-16-verification.json. Physical 16 KB/device, OAuth, background transfer and real push acceptance remain pending for this new identity.

VPS optional EXPO_ACCESS_TOKEN is not configured; its per-device push requests can reach both Expo project identities without old-account access-token scoping. The approved reviewer credentials/instructions are saved privately in Play Console; optional additional Google/partner-device feedback access was disabled. Privacy URL saved in Console. Matching APK build queued: 6ba6b522-4961-41e8-add3-df7b93393716.

## Chromebook compatibility update — 26 October 2026

Google Play Device catalog confirms that some Chromebooks are unsupported in the active closed Alpha because version 1.0.11 (16) implicitly requires `android.hardware.camera`. The CAMERA permission alone implies a rear-facing camera unless explicitly overridden.

Android 1.0.12 (17) now declares camera, autofocus, flash and touchscreen features optional, enables a resizable main activity, and retries with the front camera when the rear camera cannot open. The production AAB retains all four Android ABIs. This widens eligible devices; it does not override minimum Android versions, device certification, country/account eligibility or managed-device restrictions.

Validation: strict TypeScript and all 148 mobile tests pass. Expo's final Android manifest introspection confirms the optional hardware declarations and resizable, unrestricted-orientation activity. A cloud build and Play processing are still required before current testers receive this fix. Physical Dell Chromebook 3100 installation and camera acceptance remain pending.

Private feedback is provided from the enrolled tester's Android Play Store app, not a guaranteed browser feedback URL. Email to wealthconsort@gmail.com remains a valid supported reporting channel. Google does not publish a daily-minutes requirement or its complete tester-engagement scoring method.

Android 1.0.12 (17) cloud build 57cdcfb2-ef3f-44ad-b176-8505165af8b2 finished successfully. The signed AAB was checked directly: all optional hardware declarations and resizable activity survived compilation, all four ABIs remain included, and all 64-bit native libraries retain 16 KB alignment. Google Play accepted the existing signing identity. Its release preview reports Chromebook support increasing from 10 to 77 models, zero previously supported models dropped across all form factors, 20.1 MB estimated new install and 366 KB estimated update (device dependent).

The update was submitted to the existing closed Alpha track. Publishing overview confirms Changes in review with automated quick checks running. It is not yet available to testers; the current 1.0.11 release continues while Google processes the update. No tester enrollment, country availability or exclusion rules were changed. Android Go remains allowed, and no devices are manually excluded. Actual Dell Chromebook 3100 installation must be confirmed after the update becomes available. Public release evidence: store/android-1.0.12-17-verification.json.
