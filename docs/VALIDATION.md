# Validation record — 21–23 October 2026

## Confirmed

- TypeScript and 71 tests passed in the latest checks. Tests include real SQLite schema/query behavior using the actual native bank implementation, owner isolation, staging/commit, revision retention, search/hydration, timer restart, unknown keys, theory totals, topic filters, backup ownership, history merge, and opaque analytics contracts.
- Both Android and iOS production Hermes bundles exported successfully. Bundle size fell from 7.3MB to approximately 5.3MB per platform after importing only used icons; original exam artwork dropped from 1.18MB to 83KB. Final bundle file sizes are recorded in build-check.json. Export success is not a compiled/signed binary or physical-device runtime test.
- The final SDK 57 online dependency compatibility check passed after applying the recommended Expo, notification and sharing patch updates.
- All 183 original web source files matched the initial hashes.
- Live VPS readiness/catalog/public download SHA-256 checks passed earlier; docs/vps-check.json contains the evidence. Later laptop requests timed out after the network changed; the user reported the health page opening independently. The later failed checks must not be represented as successful.
- Authorized live QA account signup and Other learner onboarding completed through the mobile browser preview using the existing Supabase provider.
- Student walkthrough: choose subject → switch to topic study → search topics → deselect/reselect → validate zero selection → set up session → answer one correct and one incorrect, leave one unanswered → submit → verify 33% and exact topic counts → reload history → review explanations → filter missed questions → save/bookmark a question.
- Downloaded-question search found a scalar question by wording and opened a one-question practice session. The same result component now serves preparation mode; saved-question search includes topics, sections and notes.
- Focused 390×844 browser QA confirmed question wording search, the compact topic table and the replicated profile form. Corrected the profile save-button surface and replaced FlatList header/footer/empty React.Fragment wrappers with native View wrappers after React reported invalid onLayout props. The refreshed history walkthrough produced no new console errors. A development-only native-animation warning on web was addressed with the platform-specific driver flag.

## Live blocker and next check

The independent-client sync test reached Supabase but the actual database rejected the write: missing exam_sessions.answered_count. A reviewed copy of the existing source migration is in backend/migrations/001_student_data_only.sql. The user chose to run it in the SQL Editor; application has not yet been confirmed. Rerun npm run check:account-sync after confirmation and record the outcome. Do not mark two-way history or analytics sync complete before it passes.

The VPS credential was corrected and the previously paused authorized synthetic text upload completed. Three questions were extracted, reviewed and loaded from a second signed-in client, and local practice scored all three correctly. No duplicate extraction job was created. Physical photo/PDF capture and shared progress sync remain separate acceptance checks; the live database still lacks exam_sessions.answered_count.

## Release gates still open

- Physical iPhone and Android QA: native camera/document permissions, rich diagrams/math, keyboard, background/killed-app resume, offline restart, themes, screen readers, deep links and local notifications.
- Physical device acceptance remains open. The first signed Android native build completed successfully (docs/android-build.json); the updated phone APK and physical-iPhone build are tracked separately. No store or TestFlight release yet. Expo project linkage completed as requested: emmanuelwritecode/focalpoint, ID 2a3c3ccd-bfc5-48af-9615-f33b8de210f6, using EAS CLI 25.3.0.
- Standalone OAuth/password-recovery redirect allowlist.
- Android Firebase/FCM credentials and physical remote-push delivery acceptance; the VPS native delivery integration and iPhone APNs key are configured.
- Automatic cross-device syncing of detailed papers/bookmarks/checkpoints has no existing backend contract; private compatible backups provide transfer.
- Device profiling for cold start, scrolling frame times, peak memory, large banks, binary size and battery. Performance design has been implemented, but no device numbers or guaranteed 60fps claim is made.

## Dependency audit

The latest production dependency audit reports 15 high advisories, all propagated through the Expo/Metro/React Native tooling chains from braces <=3.0.3 and node-forge <=1.4.0. The registry suggests incompatible downgrades to Expo 44 / React Native 0.72 for several chains; those are not applied to this SDK 57 app. The audit is not clean, and physical release acceptance remains separate from passing build/test checks.

## Mobile experience follow-up — 23 October

- Baseline committed first (9f0dbac) and pushed to the requested emmanuel582/pastqapp repository before publishing the subsequent mobile improvements. Credentials, QA account details, source-reference copies, caches and generated bundles are excluded.
- Added deliberate horizontal CBT gestures, ordered cross-subject navigation and reduced-motion-aware native animation. Swipe bounds do not wrap or submit. Vertical and diagonal drags, taps and multi-touch are rejected by domain tests. Browser left/right dragging now advances and returns with saved choices; physical touch acceptance is still required.
- Native reminder tests exercise the actual adapter with mocked OS scheduling: permission denial preserves the old plan, partial scheduling rolls back, provisional iOS permission works, account cleanup is scoped, foreground CBT is quiet and a permission-dialog race cannot cancel a newly enabled plan. Notification taps only accept matching-owner, whitelisted destinations. Device delivery and cold-start behaviour remain physical checks.
- Reminder plans renew on app resume/day changes and study completion; previous owner requests and delivered reminders are removed on cleanup. This is local OS scheduling, not native remote push registration or VPS delivery.
- Library, Discover and Preferences now have compact, distinct headers; Home keeps the original wordmark. The 390×844 fixture walkthrough checked these headers, moved forward/back across subjects, retained the selected Mathematics answer and submitted two answered/one skipped questions. The result was 33%, one correct, one incorrect, one skipped; the topic table matched those counts. No new browser console errors appeared. This local fixture check does not prove live service sync.
- Processing stops polling while paused or awaiting input, avoids overlapping requests, restarts after explicit recovery and shows service failures without misleading photo replacement actions.
- Latest TypeScript, 47 regression tests and all 183 source-integrity checks passed. Prior iOS/Android Hermes exports passed; the current Android native builds validate the new gesture-handler integration.

## Offline-first follow-up — 23 October

- TypeScript and 47 tests pass. Added a real SQLite journey with network access disabled, fresh module instances reading saved answer papers and separate question working, completed review preservation, owner isolation, atomic deletion rollback, stale-save rejection, backup round-trip/restoration and local day grouping.
- Cached sign-in is loaded from existing secure auth storage without waiting for an expired-token refresh; cached catalog and private-material metadata render before network refresh. This does not authenticate offline requests to the server.
- Working papers are saved separately from answer metadata, with bounded stroke sampling and serialized session writes. Submit flushes the current board. Completed-session working is view-only.
- Session deletion is device-local and transactionally removes saved answers, working and outboxes; tombstones prevent synced summaries from reappearing and stale writes from recreating data. Downloaded banks and other owners are untouched.
- Browser fixture QA confirmed daily groups, a dedicated delete confirmation, separate review/delete controls, a new question’s blank board and restoration of an earlier question’s actual drawn stroke. Native touch/airplane-mode acceptance remains a physical-device check.
- The Android preview profile creates a standalone APK with real public API/account settings supplied by the existing EAS project’s preview environment and design fixtures disabled. Actual cloud build outcome is recorded separately after compilation.

Completed-session browser QA also reopened the saved result from daily history and displayed the actual retained drawing under Saved working, with editing controls absent. A separate delete confirmation was checked without deleting prior browser QA sessions.

## Phone build and interaction refinement

- 390x844 browser fixture QA confirmed a real leftward drag advances to the next subject, a rightward drag returns, and the selected answer stays saved. Native gesture recognition now handles horizontal intent alongside native vertical scrolling; cancellation, multiple pointers, active tools and stale questions cannot trigger navigation. Physical-device gesture acceptance remains pending.
- Library categories fade out before the new collection view slides in. Reduced-motion settings bypass the effect. Category expansion/collapse and separate download controls were checked through actual UI input.
- Preview releases omit the development launcher. The Android preview targets ARM32/ARM64 phones and enables release code/resource shrinking. Actual binary size will be recorded from the completed cloud artifact, without downloading it to this laptop. Native Google setup remains deferred at the user’s request.

Downloaded-exam category opening/back and switching between the full library and saved groups were also checked through the 390x844 fixture UI after the final animation change. The real iPhone preview bundle returned HTTP 200 from the refreshed local Expo server.

## Final Android APK — 23 October

EAS build 63ff8e4a-7a26-4aa6-893d-afeaebed906b finished from source b6d8e8bddc5f81783f95535629862c6384dbef61 with BUILD SUCCESSFUL in 6m 55s. Version 1.0.1 / versionCode 2 is 60726094 bytes by an HTTP HEAD response (200), 52.6% smaller than the first universal APK. The binary was not downloaded to this laptop and has not yet been physically installed by this agent. Size/build evidence is in android-phone-build.json; installation URLs are omitted from the public repository. Both normal and downloaded library transitions were checked through real browser UI input; physical gesture/notification acceptance is still pending.

iOS was retried after the user reported completing setup. EAS still found no suitable internal-distribution credentials; the credentials screen for this exact project showed no configured credentials. No iOS native compilation started. Apple signing must be saved against @emmanuelwritecode/focalpoint / com.pastq.study before the physical-iPhone build can proceed.

## Scholar playback and signed iPhone preview — 23 October

The original 260 ms tester tick was replaced with timestamp-driven, action-specific cadence and bounded crossfades, with correct portrait proportions for bonus images. Rapid action changes retain the currently blended image. The mobile app shares predecoded pose images, releases its image references after the final mascot unmounts, pauses timers on screen blur/background, preserves remaining holds across resume, and starts contextual gestures promptly. Existing art and layout are preserved.

TypeScript, 54 mobile tests and 3 tester timing tests pass. All 12 tester actions, speed changes, directional selection, pause/resume, and repeated mobile download-dialog mounting were checked in the browser with no console warnings/errors. All 183 original application source hashes still match; the user-requested tester changes are outside those application sources.

Both internal builds completed from 93e4006c54fe6d0db52340eec378cc374f72d576: Android 5b0b9c05-a71d-466c-9164-ca82b0e27aa9 (BUILD SUCCESSFUL in 6m 58s) and iOS bd8f46bf-0ad4-4ae1-aaa9-7253656fc875. Artifact HEAD requests returned HTTP 200; download sizes are 60730866 bytes for Android and 15028822 bytes for iOS. No binary was downloaded to this laptop. EAS accepted the Apple distribution certificate and ad hoc profile containing the test iPhone, resolving the earlier signing blocker. Installation URLs and device identifiers are omitted from public records. Physical-device smoothness/notification acceptance and the documented live backend corrections remain outstanding.


## Version 1.0.3 acceptance

- TypeScript and 66 mobile tests pass, including the actual React Native AbortController implementation used with native SQLite download staging, pause/resume and offline hydration.
- Live UTME, WAEC CBT and WAEC Theory parts passed the same path. This was a Node/SQLite native-adapter check with actual VPS data, not a physical-phone download.
- Both platform Hermes release exports pass. Updated compiled binaries are being built separately; exports alone are not native build evidence.
- 390-pixel and 844-pixel browser checks covered the compact Preferences account control, real-session chart point selection, sharper welcome art, and full-height landscape calculator beside the question. Browser mouse dragging is not acceptance evidence for physical touch gestures.
- The native push VPS patch passed 17 isolated route/admin/reminder/upload checks with a mocked Expo transport and no external sends. Its persistent outbox also passes four local SQLite tests. A legacy mock-only security-header test fails on the unchanged base image as well; the new real HTTP test verifies the actual nosniff header.
- The VPS was backed up, checked for active extraction, and updated with only the notification source patch. Automatic approval rejected copying the full production directory; the replacement staging build copied an explicit source allowlist onto the existing image and left secrets in place. Health and authenticated-device route checks pass after deployment.
- The replacement extraction key is stored only on the VPS. No provider key, signing material, device identifier or direct binary URL is part of the public change.
- iOS APNs push credentials are attached to the EAS project. Android Firebase/FCM setup and physical-device push receipts remain pending. Supabase callback allowlisting is being handled by the owner; shared history sync still requires the prepared migration.

## Movable calculator update — 1.0.4

The calculator floats above the question: move it by its title bar, resize it from the bottom-right handle, or reset its size and position. Its frame survives closing/reopening during the current exam, and the calculator stays mounted across question changes. Bounds constrain all handles to the usable screen after rotation. Drag/resize animated values update the panel without rendering the exam or keypad on each frame. The working paper keeps its existing docked layout.

Verification: 68 mobile tests pass, including phone/tablet/landscape bounds and independent move/resize geometry. Browser interaction at 390×844 verified real dragging, corner resizing, 2+3=5 after resizing and question changes without moving the calculator; 844×390 verified the panel remains reachable after rotation. Physical iOS/Android touch acceptance remains pending installation of this build.

## Student experience update — 24 October, version 1.0.5

- 71 mobile tests and TypeScript pass. New checks cover review filtering across correct/wrong/unanswered/theory questions, original question-number identity, deadline catch-up after missed seconds/background suspension, once-only expiration and a fresh timer after a new deadline. Responsive bar tests keep genuine zero/100 scores and choose only the latest five valid dated sessions.
- A 390×844 browser walkthrough answered one question correctly, one incorrectly and left one unanswered. Finish → Remaining opened only question 3, and pressing it jumped directly to Use of English. Submission produced 33%, one correct, one wrong and one unanswered. Wrong → question 2 opened Physics with the original selected wrong option red and the key green. The timer visibly changed from 20:00 to 19:48 and later 19:28 against its saved deadline.
- Preferences shows five labelled bars, including genuine zero scores; tapping a zero bar displayed 0 of 3 correct. The Profile row and repeated sync notices are absent. A 320-pixel check identified wrapped stat captions, now given equal label height for aligned numbers.
- The calculator remains draggable/resizable and its gesture surface is separate from the question. The original 183 web source hashes remain unchanged. Physical native touch/runtime acceptance is still required.
- The live account sync check still fails on missing exam_sessions.answered_count. Suppressing a repetitive offline banner does not mean cloud sync is verified; local storage and pending retries are preserved. Android remote push still needs Firebase/FCM setup; iOS physical push delivery and standalone callback allowlisting remain separate acceptance gates.

The removed Profile row previously held the only account-menu entry. A compact Account options control preserves Change password, About, Help and confirmed Sign out without restoring the Profile row or expanding the avatar email popup. Sign-out retains the existing reminder cancellation and device-token cleanup path.

Both final 1.0.5 signed builds finished from c2a14d063e74ca83c82bf1e2db2988dff0eb5399. android: 9038a5b7-bd4e-4e15-a963-9515dc6f5e62; ios: a862210c-1097-4e34-bbde-b3eb35be5596. Artifact HEAD requests returned HTTP 200, without downloading binaries to the laptop. Size records are in android-phone-build.json and ios-build.json. Physical installation/touch/push acceptance remains pending.

Admin push follow-up (24 October): 73 mobile tests and TypeScript passed, 7 admin tests and production build passed, and 5 local durable-queue tests passed. Five isolated VPS tests passed with network disabled, including admin artwork conversion and native payload ownership/deduplication. The three-file backend update is deployed and ready; admin commit f25bc09 deployed successfully through Vercel. Browser fixture checks used no real recipients. iOS extension/FCM configuration and quiet-update changes require a new 1.0.6 native release and physical phone acceptance. Windows cannot generate the iOS Xcode project; Expo config discovered the intended extension, and actual compilation remains an EAS check.

Android 1.0.6 build df58541c-b996-46a5-a0f2-955384ca307b finished from e0c7d7b672f78fc99afbbc7081fc09b942b084f1. Artifact HEAD returned HTTP 200 and 60,790,374 bytes; no APK was downloaded to the laptop. This is 52.5% below the first universal APK. A live Google administrator login, image upload, all-account preview (13 accounts; 1 push-eligible), and JPEG attachment HEAD also passed. The preview draft was cleared without sending. iPhone 1.0.6 needs a separate com.pastq.study.notifications profile before native compilation.

FCM send-permission check: Google projects.messages.send returned HTTP 200 with validate_only=true, confirming cloudmessaging.messages.create for the dedicated service identity without delivering a message. The repeat temporary-account sync check still reports missing exam_sessions.answered_count; the prepared Supabase migration remains required.

iPhone 1.0.6 build 8ed72daf-dd41-4f70-ab7f-e465e5b592e7 finished from 869cb2c9447bed6a9d6a75523090fc7650eb546c, including the native notification-service extension. Both ad hoc signing profiles include the registered test phone. Artifact HEAD returned HTTP 200 and 15091008 bytes; no IPA was downloaded to the laptop. Native compilation is verified; installed-phone image/quiet-notification acceptance remains pending.

On 24 October the owner confirmed that the Android 1.0.6 Send a test notification alert arrived. This verifies physical Android test delivery, separately from the successful FCM validate-only configuration check. It does not yet accept admin artwork campaigns, iPhone delivery, closed-app upload completion, touch performance or offline restart. No real student announcement was sent by this workflow.
