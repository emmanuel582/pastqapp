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

Swipe left across the CBT question area for the next question; swipe right for the previous one. This follows the visible subject order, preserves answers and never submits an exam. Vertical reading, taps, multi-touch and open tools do not navigate. Reduced-motion settings are respected.

Home retains the PastQ wordmark. Library, Discover and Preferences use their own compact titles without repeating the main heading.

Study reminders use native iOS/Android notifications, selected weekdays, quiet hours, pause dates and completed-day skipping. Permission is requested only when enabling or testing reminders. Tapping a reminder opens the Library; a tap during CBT waits until the exam has been left. Plans cover the next 28 days and renew when opening/resuming the app or completing study. Disabling reminders or signing out cancels that account’s plan. Remote VPS push delivery is a separate release gate.

The live personal-material upload was accepted but processing paused because the VPS provider returned OpenRouter 401 (User not found). Correct the provider credential on the server, resume the saved processing job, and rerun the check before accepting live extraction. Service failures now show a saved-material recovery message rather than asking for a replacement photo.

## Offline study

After the initial sign-in and downloading your materials, saved-question search, CBT, answer selection, solving tools, results, topic tables, history and saved reasoning use device storage. Previously signed-in learners can open cached study data while their network session refreshes in the background. New downloads, joining live sessions, account changes and AI extraction require a connection.

Each question has its own working paper. Strokes save on the device after gestures and when backgrounding or closing the board; submitting waits for the current working to save. A new question starts blank, returning restores its paper, and completed-answer review shows the original working without changing it. Backups include these papers.

Past sessions are grouped by local calendar day for evening review. Deleting a session removes its local answers, paper, working and pending result uploads together, while keeping downloaded material. A small local deletion marker keeps a synced account summary from reappearing on this device. Account summaries on other devices remain unchanged. An explicit backup import can restore a deleted session.

The standalone preview APK contains the JavaScript and artwork, so it does not need Expo Go or a laptop development server. First sign-in/download still needs internet; extracting new question photos/PDFs uses the VPS.

## Native builds

EAS preview and production profiles are in eas.json. The preview profile builds standalone, signed phone apps with eas build --profile preview --platform all. Android produces an APK for ARM32/ARM64 phones with release code and resource shrinking; emulator architectures and the development launcher are excluded. iOS internal distribution requires Apple signing and a provisioning profile containing the test device. This app is linked to emmanuelwritecode/focalpoint (project ID 2a3c3ccd-bfc5-48af-9615-f33b8de210f6); the display name remains PastQ. iOS compilation requires EAS or macOS/Xcode. The first signed Android build is recorded in docs/android-build.json. Build artifacts are distributed through EAS install links, not downloaded by the build workflow. No store submission has been made.

Use Expo Go for local development. A custom development client requires installing expo-dev-client and configuring a separate development build profile. Google sign-in still uses the existing browser OAuth flow; native Google registration was explicitly deferred. Email sign-in remains inside the app.

Allow pastq://auth/callback in the existing Supabase redirect settings before accepting standalone OAuth/recovery. Expo Go callbacks differ; verify the actual callback URL on each device. Remote native push needs a development build, project push credentials and a native server delivery integration. Existing web push subscriptions cannot deliver native APNs/FCM notifications. Local reminders and the VPS inbox are implemented separately.
