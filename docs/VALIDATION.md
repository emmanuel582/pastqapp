# Validation record — 21–22 October 2026

## Confirmed

- TypeScript and 27 tests passed in the final checks. Tests include real SQLite schema/query behavior using the actual native bank implementation, owner isolation, staging/commit, revision retention, search/hydration, timer restart, unknown keys, theory totals, topic filters, backup ownership, history merge, and opaque analytics contracts.
- Both Android and iOS production Hermes bundles exported successfully. Bundle size fell from 7.3MB to 5.2MB per platform after importing only used icons; original exam artwork dropped from 1.18MB to 83KB. Final bundle file sizes are recorded in build-check.json. Export success is not a compiled/signed binary or physical-device runtime test.
- The SDK 57 local dependency compatibility check passed in offline mode against Expo's installed version map. Online validation timed out during a network change.
- All 183 original web source files matched the initial hashes.
- Live VPS readiness/catalog/public download SHA-256 checks passed earlier; docs/vps-check.json contains the evidence. Later laptop requests timed out after the network changed; the user reported the health page opening independently. The later failed checks must not be represented as successful.
- Authorized live QA account signup and Other learner onboarding completed through the mobile browser preview using the existing Supabase provider.
- Student walkthrough: choose subject → switch to topic study → search topics → deselect/reselect → validate zero selection → set up session → answer one correct and one incorrect, leave one unanswered → submit → verify 33% and exact topic counts → reload history → review explanations → filter missed questions → save/bookmark a question.
- Downloaded-question search found a scalar question by wording and opened a one-question practice session. The same result component now serves preparation mode; saved-question search includes topics, sections and notes.
- Focused 390×844 browser QA confirmed question wording search, the compact topic table and the replicated profile form. Corrected the profile save-button surface and replaced FlatList header/footer/empty React.Fragment wrappers with native View wrappers after React reported invalid onLayout props. The refreshed history walkthrough produced no new console errors. A development-only native-animation warning on web was addressed with the platform-specific driver flag.

## Live blocker and next check

The independent-client sync test reached Supabase but the actual database rejected the write: missing exam_sessions.answered_count. A reviewed copy of the existing source migration is in backend/migrations/001_student_data_only.sql. The user chose to run it in the SQL Editor; application has not yet been confirmed. Rerun npm run check:account-sync after confirmation and record the outcome. Do not mark two-way history or analytics sync complete before it passes.

Live personal text/photo/PDF extraction → confirmation → practice → cross-client result verification remains pending reliable laptop VPS access and the shared migration. The code uses the existing protected owner-scoped endpoints, supports resuming confirmed photo batches, and keeps failed work locally; code review and pure tests are not substitutes for this live journey.

## Release gates still open

- Physical iPhone and Android QA: native camera/document permissions, rich diagrams/math, keyboard, background/killed-app resume, offline restart, themes, screen readers, deep links and local notifications.
- Signing/build credentials and physical native builds; no store or TestFlight release yet. Expo project linkage completed as requested: emmanuelwritecode/focalpoint, ID 2a3c3ccd-bfc5-48af-9615-f33b8de210f6, using EAS CLI 25.3.0.
- Standalone OAuth/password-recovery redirect allowlist.
- Native remote push integration/credentials; VPS web push is not native push.
- Automatic cross-device syncing of detailed papers/bookmarks/checkpoints has no existing backend contract; private compatible backups provide transfer.
- Device profiling for cold start, scrolling frame times, peak memory, large banks, binary size and battery. Performance design has been implemented, but no device numbers or guaranteed 60fps claim is made.

## Dependency audit

The last registry audit reported 23 production advisories (15 high, 8 moderate); a later full dependency install reported 24 including development dependencies in Expo/Metro tooling dependency chains. Direct vulnerable roots include braces <=3.0.3 and node-forge <=1.4.0; those were also the latest available registry versions when checked. Do not apply npm audit fix --force: its proposed Expo 44 / React Native 0.72 downgrade breaks the SDK 57 requirement. The JSON report is saved as dependency-audit.json. Reassess upstream patches before release; no vulnerability-free claim is made.
