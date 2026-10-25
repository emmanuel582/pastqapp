# PastQ Mobile

A separate React Native application for iOS and Android, using Expo SDK 57 to match the supplied Expo Go version. The original web project is at C:/Users/DELL/PastQ and was not edited by this work. Frozen source references and the initial 183 source hashes are in reference/web and docs/web-source-sha256.json.

## Inspect on iPhone

1. Connect the laptop and iPhone to the same Wi-Fi.
2. Install dependencies with npm ci if this folder has just been copied.
3. On iPhone, first sign into Expo Go and run npx expo login --browser on the laptop using the same Expo account. Verify with npx expo whoami.
4. Run npm run preview:iphone. This selects the current Wi-Fi address, regenerates docs/iphone-preview-qr.png, and starts Expo Go on port 8081 with real authentication enabled.
5. Scan that QR with the iPhone Camera and choose Expo Go. Allow local network access when iOS requests it.
6. Sign in with the same PastQ account used in the browser. Keep the laptop running during inspection.

Android can scan the same QR from Expo Go. A VPN, guest Wi-Fi, or hotspot client isolation can prevent LAN access. The actual API remains the configured HTTPS VPS.

## Configuration

Copy .env.example to .env and supply the existing public API/Supabase settings. EXPO_PUBLIC_* values are bundled client configuration. Never include service role keys, database credentials, OCR provider keys, or SSH secrets.

Normal previews use EXPO_PUBLIC_DESIGN_PREVIEW=false. An explicit development-only fixture preview can be started in another terminal with that flag set true; it uses local sample questions and does not prove VPS integration.

## Checks

- npm run verify: TypeScript and meaningful domain/SQLite regression tests.
- npm run verify:source: verify the original source snapshot remains unchanged.
- npm run check:vps: live readiness, catalog, private-route authentication and verified download-part contracts.
- npm run check:account-sync: two independent authenticated clients, both history directions, and retry-safe analytics, using the explicitly authorized ignored .qa/account.json account.
- npm run check:personal-upload: resume the authorized synthetic personal-material upload, confirm the reviewed questions, and load the resulting private material from a second authenticated client. The saved job ID prevents duplicate submissions on reruns.
- npm run export:ios / npm run export:android: production Hermes bundles. These do not compile or sign native binaries.

## Project structure

- src/screens and src/components: native views, original artwork, fonts, palette and navigation.
- src/domain: filtering, setup, attempts, scoring, topic breakdowns, search, history and backup validation.
- src/storage: transactional owner-scoped SQLite on devices; IndexedDB only for browser QA. Large public banks use immutable per-part rows. Selected questions and diagrams are copied into saved session papers so removing a bank does not break history.
- src/services: Supabase account lifecycle and outcome sync, VPS library/downloads/uploads, media, reminders and reports.
- backend/migrations: a copy of the existing shared student-data migration, prepared after live QA found missing deployed history fields. It has not been applied automatically.
- docs/IMPLEMENTATION_PLAN.md, DESIGN_AUDIT.md and VALIDATION.md: scope, design traceability, checks and remaining release gates.

## Shared sync

Accounts, profiles and completed-result summaries use the same Supabase project as the configured VPS. Reviewed personal uploads, processing, public banks, report statuses and the notification inbox use existing VPS routes. Failed result/report/reminder synchronization remains in owner-scoped local queues.

Profile names and contact phone use the existing account profile/metadata. Selected profile photos are saved privately on the device; provider avatar URLs remain shared.

Detailed saved answer papers, in-progress checkpoints, bookmarks/notes and downloaded banks remain device-local, matching the existing browser architecture. Browser-compatible private backups move them between devices. The current web/VPS API does not provide automatic cloud archive synchronization for those payloads; do not describe them as automatically synchronized.

The live account test found exam_sessions.answered_count missing. Apply backend/migrations/001_student_data_only.sql in the existing Supabase SQL Editor, then rerun the sync check. Until that succeeds, full progress sync is not accepted as complete.

## Mobile interactions

Swipe left across the CBT question area for the next question; swipe right for the previous one. This follows the visible subject order, preserves answers and never submits an exam. Vertical reading, taps, multi-touch, calculator dragging/resizing and drawing do not change questions. Swipe the uncovered question area to navigate while a tool is open. Reduced-motion settings are respected.

Home retains the FocalPoint wordmark. Library, Discover and Preferences use their own compact titles without repeating the main heading.

Study reminders use native iOS/Android notifications, selected weekdays, quiet hours, pause dates and completed-day skipping. Permission is requested only when enabling or testing reminders. Tapping a reminder opens the Library; a tap during CBT waits until the exam has been left. Plans cover the next 28 days and renew when opening/resuming the app or completing study. Disabling reminders or signing out cancels that account’s plan. Remote VPS push delivery is a separate release gate.

The VPS extraction credential was corrected and the saved synthetic upload resumed successfully. All three sample questions were extracted, reviewed and opened from a second signed-in client. docs/personal-upload-check.json records the scope; physical photo/PDF capture and shared progress sync have separate acceptance checks.

## Offline study

After the initial sign-in and downloading your materials, saved-question search, CBT, answer selection, solving tools, results, topic tables, history and saved reasoning use device storage. Previously signed-in learners can open cached study data while their network session refreshes in the background. New downloads, joining live sessions, account changes and AI extraction require a connection.

Each question has its own working paper. Strokes save on the device after gestures and when backgrounding or closing the board; submitting waits for the current working to save. A new question starts blank, returning restores its paper, and completed-answer review shows the original working without changing it. Backups include these papers.

Past sessions are grouped by local calendar day for evening review. Deleting a session removes its local answers, paper, working and pending result uploads together, while keeping downloaded material. A small local deletion marker keeps a synced account summary from reappearing on this device. Account summaries on other devices remain unchanged. An explicit backup import can restore a deleted session.

The standalone preview APK contains the JavaScript and artwork, so it does not need Expo Go or a laptop development server. First sign-in/download still needs internet; extracting new question photos/PDFs uses the VPS.

## Native builds

The installed app is FocalPoint; the Play Store title is FocalPoint CBT, published by Wealth Consort with support at wealthconsort@gmail.com. Android builds use wealthdigitals/focalpoint: preview-android produces a signed ARM32/ARM64 APK; production-android produces a store App Bundle. The package is com.wealthconsort.focalpoint, matching the existing Play Console app, and reuses the locally preserved signing key. Earlier com.pastq.study test apps are a separate installation and cannot update to this package. Private signing files are ignored by Git and supplied through EAS local credentials. Production uses verified live API/auth settings and disables design preview. Increment app.json's Android versionCode for each Play upload; the current candidate is 1.0.11/code 16.

Android push registration uses extra.androidPushProjectId for the wealthdigitals project and its registered Firebase application. The base app.json retains the original iPhone project for iOS push registration and signing; its bundle identifier is an internal compatibility identifier, not the public brand. The app.config.js override selects Android build ownership. See docs/PRODUCTION_READINESS.md for exact account/environment commands and verified installer links. iPhone internal distribution requires its registered test device; store publication is a separate action. No application binary is downloaded by this build workflow.

Use Expo Go for local development. Google sign-in uses the system-browser OAuth flow with the app callback; both pastq://auth/callback and focalpoint://auth/callback are allowlisted in the existing Supabase project. Native Google registration remains deferred. Android FCM and iPhone APNs are configured; the owner confirmed baseline test delivery on both platforms. Latest-build background, rich-image and interruption checks still need physical-device acceptance. Web push and the VPS inbox are separate from native notifications.

## Version 1.0.3 changes

The shared download/upload cancellation check now supports React Native's AbortSignal implementation. Real UTME, WAEC CBT and WAEC Theory VPS parts passed pause/resume and offline SQLite reopening checks; see docs/live-native-download-check.json. Preferences has a compact account-email popover and a touch-selectable chart sized to the actual screen. Native page transitions avoid crossfading two screens, and category changes wait for the new content commit.

The calculator uses basic arithmetic only. Exam tools dock below questions in portrait and alongside them in landscape; question changes and explicit exits wait for the working paper to save. The welcome bitmap has a sharper transparent version with its old second-face overlay removed.

The VPS native notification patch is deployed. iPhone push credentials are configured in EAS; Android Firebase setup is complete, and the owner confirmed a real Android 1.0.6 test alert arrived. iPhone and image/closed-app upload delivery acceptance remain pending. See backend/NATIVE_PUSH.md. Google uses the secure OS authorization session and requests pastq://auth/callback; that exact callback must be allowed in the shared Supabase project. EAS release profiles explicitly disable design fixtures.

## Version 1.0.4 changes

The calculator is a movable, resizable floating panel. Drag its title bar to reposition it, drag the bottom-right corner to resize, or use reset to restore the default frame. Its size/position are retained when reopened in the current exam, and screen rotation keeps its controls reachable. Calculator gestures are separate from question navigation. The drawing board retains its existing docked layout. TypeScript and 68 mobile tests pass; browser drag, resize, arithmetic and rotation checks passed. Physical touch acceptance remains pending.

## Version 1.0.5 changes

Exam controls use one compact icon row on the right. The progress strip, flag controls and duplicate top counter are removed; the bottom number control opens the whole paper. Finish-dialog Answered/Remaining boxes open the matching question numbers. Result boxes open correct, wrong or unanswered numbers, and selecting one opens that exact saved question. Correct answers are green, wrong answers red, with labels and symbols. Theory/unknown keys remain ungraded.

The clock hand ticks with the real deadline-based countdown, which catches up after backgrounding and expires once. Preferences has no Profile row and shows five real scored tests as labelled bars with date, percentage and correct/total details. Repeated sync banners are removed from Preferences/history; durable local records, retry queues and pull-to-refresh remain. This UI change does not repair the outstanding shared database migration.

Account options at the bottom of Preferences keeps password, Help/About and confirmed Sign out available after removing Profile; the header avatar still shows only the compact email popup.

## Version 1.0.6 notifications

The deployed admin Notifications page supports an optional image, title/message, destination and a reviewed all-account audience. Phone and browser delivery statuses are reported separately. No student campaign was sent during verification. Android FCM V1 and iPhone APNs credentials are configured. Both signed phone builds finished; iPhone includes the native image notification extension. The owner confirmed an Android test alert arrived on 24 October. Rich-image and closed-app upload completion delivery still need installed-phone acceptance on both platforms.

iPhone can register provisional quiet updates, respecting existing opt-out choices. Quiet updates appear in Notification Centre; use Enable banners and sound in Notifications for full alerts. Android follows its normal permission flow.

## Prepared update — native builds on hold

Preferences shows a compact total-session count and seven-day activity chart in the existing dark/light palette. Tapping the card opens Your progress: per-topic performance with subject and time filters, clear answer counts, real topic trends and a button to practise only that topic from saved questions. Completed sessions store compact topic totals. Normal phone-notification permission is requested once after onboarding when entering the study room; an existing denial or opt-out is respected. The answer-colour legend is removed.

Interrupted downloads keep their selected subjects and verified chunks. Native file tasks use background sessions, retain OS-provided pause state, and continue when leaving the download screen. Library exposes interrupted downloads; Storage clears temporary transfer files. If partial-byte resume is unavailable, only the interrupted chunk retries. OS force-quit/process death and power restrictions still require real-phone acceptance and cannot be promised to continue. TypeScript and 89 tests pass; browser checks cover 320/390px layouts, both themes, empty activity, summary-card navigation, filters and topic-only practice. These changes are source only: the owner requested additional updates before another build.
