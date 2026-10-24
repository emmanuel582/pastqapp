# PastQ native replication plan

Created 21 October 2026. Source: C:/Users/DELL/PastQ/client. Native destination: C:/Users/DELL/PastQMobile. The web repository is read-only for this project.

## Non-negotiable acceptance criteria
- Preserve the current mobile web design, including copy, hierarchy, positioning, palette, typography, artwork, navigation curve and motion. Do not introduce a new design system.
- Build real React Native views for iOS and Android, using Expo and TypeScript. No whole-app WebView.
- Keep code, dependencies, builds and generated caches outside the web app. Retain a frozen source reference and hashes for verification.
- Do not claim pixel equivalence or measured performance without device comparisons and profiling.

## 1. Source audit and reference
Read App.tsx, every extracted screen, all CSS (including mobile breakpoints), navigation, local persistence and API services. Inventory welcome; signup/signin/reset/recovery; onboarding path and school/exam picker; home empty/saved states; library Explore/All materials/Saved and nested catalog; study spaces; setup; exam and review; results; Discover and join dialog; uploads/camera/manual entry/processing/review; preferences/theme/reminders/notifications/history/bookmarks/storage/reports/profile/about/support. Preserve source files in reference/web. Record exact fonts, colours, borders, spacings, responsive breakpoints and animations in DESIGN_AUDIT.md.

## 2. Native foundation
Use SDK-compatible React/React Native versions selected by the Expo template. TypeScript strict mode. Native stack with explicit route types; custom bottom navigation retains the original SVG path and central 52px camera action. Safe area only for OS-owned insets. Bundle exact Manrope, Outfit, Lora and JetBrains Mono faces and original artwork. Central tokens are direct CSS transcriptions; follow dark/light/system preferences. Accessibility labels, keyboard avoidance, screen reader support and reduced motion.

## 3. Persistence and service adapters
Port pure exam/filter/navigation/scoring utilities unchanged where possible. Replace localStorage/IndexedDB with transactional SQLite, tokens with SecureStore, browser networking with authenticated native fetch, file inputs with document/image pickers, service-worker notifications with native notifications. Keep the existing server routes and Supabase auth. Public configuration comes from EXPO_PUBLIC_* environment variables; no server credentials. Cache bundles once, persist attempts/checkpoints/bookmarks/preferences; preserve unknown answers and theory questions; never guess answer keys. Scope user records by owner. Use durable checkpoints, time deadlines and app lifecycle events so backgrounding does not extend exams.

## 4. Screen implementation order
1. Shared native primitives, fonts, themes, SVG artwork and mascot.
2. Welcome and account flows, OAuth deep link, onboarding catalog.
3. Home, catalog navigation, library/search/downloads/study spaces.
4. Session setup: subjects, topics, years, mode, count, duration, shuffle.
5. Exam: question media/math, options/theory, timer, navigator, flag/bookmark, tools, submit dialog. Results and answer review.
6. Discover/join; upload/pick/camera/reorder/manual/processing/question confirmation.
7. Preferences: theme previews, reminders, notification inbox, past sessions/resume/review, saved notes, storage/backup, question reports, profile and support.

## 5. Performance design
Hermes/new architecture through Expo. Native-driver transforms and opacity for transitions. Keep timers in a small component; memoize question/options/artwork. Virtualize catalog, bookmarks and history; stable keys, bounded render windows. Lazy-load expensive tools and math rendering; use a small isolated math renderer only for mathematical source markup. Do not decode a 9x8 atlas as dozens of full-size images: pre-crop original frames once and load only visible poses. Native image cache and sizes; no base64 copies of bundles in state. Store large questions in SQLite, not navigation params. Cancel requests on unmount and bound concurrency; stop animation and polling when backgrounded. Keep dependency surface small.

## 6. Verification gates
- TypeScript, compatible dependencies (expo install --check / expo-doctor), meaningful deterministic tests for timer restoration, filtering, scoring, persisted checkpoints, bookmark isolation and API contracts.
- Export Android and iOS JS/Hermes bundles. This checks bundling, not compilation, signing or runtime correctness.
- Preview native React Native Web implementation at mobile widths against frozen original source (360, 390, 430). Test all reachable screens and flows. Record known mismatches honestly.
- On Android and iOS devices: compare screenshots side-by-side in both themes, safe areas and keyboard; verify back gestures, permissions, deep links, offline restart and killed-app exam restoration.
- Release profiling: cold/warm start, JS/UI frame time during scrolling and transitions, peak memory in large libraries and media questions, binary size and battery/polling behaviour. Target 60fps interactions; report actual measurements before claiming.

## 7. Delivery
Separate ready-to-run project, pinned lockfile, setup/env examples, EAS development/preview/production profiles, design traceability matrix and validation report. Android builds can run locally with Android SDK/JDK or EAS. iOS compilation/signing requires macOS/Xcode or EAS and Apple signing credentials. App-store upload is a later explicitly authorised release step.

## Progress
- [x] Separate destination and frozen web reference created.
- [x] Web source hashes captured.
- [x] Native screens and service/storage adapters implemented; live/release gates below remain open.
- [x] TypeScript, regression tests, SQLite lifecycle checks, dual-platform exports and source integrity check.
- [ ] Shared database migration confirmed and live upload/two-client sync accepted.
- [ ] Physical device parity and release performance measurements.

## Requested mobile polish — 23 October 2026
- [x] Commit and push the separate mobile baseline before follow-up changes.
- [x] Add deliberate CBT next/previous swipes with cross-subject order, retained answers, bounds and reduced-motion support.
- [x] Replace the wordmark on other main tabs with their own compact heading; remove duplicate titles.
- [x] Add native reminder tap handling, lifecycle renewal, account cleanup, scheduling rollback and CBT foreground suppression.
- [x] Reduce repeated exam scans and stop redundant/overlapping paused processing polls.
- [x] Repeat a browser student walkthrough, regression tests, source-integrity check and native exports.
- [x] Correct VPS extraction-provider authentication and verify the synthetic personal upload.
- [ ] Apply the shared Supabase progress/history migration and rerun account-sync checks.
- [ ] Accept native swipes/notifications on both phones, configure remote push delivery and complete device release profiling/signing.

## Student experience follow-up — 24 October

Implement compact exam controls, one bottom question counter and no flags/progress strip. Make finish/result summaries open filtered question numbers and jump to the selected saved question, using green/red plus textual status without revealing answers in active exams. Keep the movable calculator. Animate the real deadline clock, simplify Preferences to five labelled scores and remove repeated sync banners while preserving the local outbox. Validate at 320/390 pixels, run regression/source checks, then compile signed Android/iOS previews and record physical acceptance separately.

## Admin phone announcements — 24 October

- [x] Publish the separate admin image drop area and phone/browser delivery reporting.
- [x] Verify real admin Google login, image upload, all-account audience preview and native JPEG artwork serving without sending a campaign.
- [x] Deploy persistent native image delivery and recipient status queries with isolated tests and rollback backups.
- [x] Configure the dedicated Android FCM V1 identity privately in Expo and include public Firebase app configuration.
- [x] Compile and sign Android 1.0.6; verify artifact size by HEAD without downloading the APK.
- [x] Implement quiet iPhone provisional updates with opt-out and a separate banners/sound option.
- [x] Finish the new iOS image extension signing profile and compile the iPhone 1.0.6 release.
- [x] Confirm a real Android 1.0.6 test alert arrives (owner-reported physical check).
- [ ] Verify admin artwork push, iPhone delivery and app-closed upload completion on installed Android/iPhone devices.

## Topic guidance and resilient downloads — 24 October (build on hold)

- [x] Record the owner-confirmed iPhone 1.0.6 test alert; permission had been enabled manually in Settings.
- [x] Request normal phone notification permission once on first study-room entry after onboarding, respecting denial and opt-out.
- [x] Remove the answer-number colour legend.
- [x] Replace the Preferences score chart with a dedicated topic progress page: subject/time filters, correct/wrong/skipped counts, ungraded separation, weak-topic guidance, real per-topic trends and topic-only offline practice.
- [x] Save compact topic totals with completed sessions and avoid refreshing the page for active-answer changes.
- [x] Preserve interrupted download selections and verified chunks; persist native pause state; enqueue native background transfers before waiting; retain transfer work when leaving the screen and coalesce duplicate transfer/pause requests.
- [x] Verify TypeScript, 85 regression tests, browser subject/time filters, chart taps, topic-only practice and 320/390-pixel layouts.
- [ ] Wait for the owner’s additional update before any Android/iOS build.
- [ ] After that build, verify first-use prompts, screen-lock/background transfer, interrupted resume and OS termination behaviour on real phones.

## Compact Preferences summary — 24 October

- [x] Keep full subject/topic analytics on their dedicated Progress page.
- [x] Add one compact Preferences card with total completed sessions and seven real daily activity counts.
- [x] Match the existing warm dark/light palette, fonts, borders and navigation icons.
- [x] Verify the card opens Progress, empty activity has no invented bars, and 320/390px phone layouts fit.
- [x] TypeScript and all 89 mobile tests pass; native builds remain on hold.
