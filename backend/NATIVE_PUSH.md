# Native notifications for the existing VPS

The mobile repository contains a narrow overlay for the existing backend, keeping the original web workspace unchanged. Production uses the same admin campaign inbox and web push routes, extended with native Expo push delivery.

## Deployed behavior

- Signed-in devices register an Expo push token bound to the verified Supabase account. An installation secret permits revocation after offline sign-out without retaining the account password or session.
- Administrator campaigns queue a native message for opted-in devices, alongside their existing browser notification and in-app inbox. Campaign responses include nativePush delivery counts.
- Saved completed extraction sessions queue an owner-only completion alert. Processing remains on the VPS after the app closes; the app is not the worker. Pending local file transfers still require the app to finish sending the files.
- A persistent SQLite outbox deduplicates events, retries temporary failures with backoff, polls Expo receipts, expires stale messages and removes expired device tokens. Provider acceptance is not proof that a person read a notification. A crash after provider acceptance but before a local write can rarely duplicate a delivery; Expo does not offer an exactly-once transport.
- Native opt-in is separate from scheduled study reminders. Notification taps open the appropriate app screen and defer navigation during an exam.

## Credentials and testing

Android requires google-services.json for com.pastq.study and an FCM V1 service account uploaded privately to EAS. iOS requires an Apple push key attached to the EAS project, separate from its distribution signing certificate. Private service-account and Apple keys must stay out of this repository. google-services.json is public app configuration and is included for native builds. Configure these in private setup windows and test a real installed release; Expo Go is not a remote-push test target.

The VPS patch was built on the existing Docker image, tested without network access, and deployed after a data backup and a check that no extraction was processing. Only five source files changed; the production environment file stayed in place. Code and image rollback copies are retained on the VPS. vps-baseline-sha256.json records the pre-patch source hashes; vps-overlay/Dockerfile.native shows the explicit source allowlist.

Local queue tests: npm run test:push-backend. Additional isolated VPS tests in vps-overlay/tests cover the real HTTP auth routes and admin-to-native campaign delivery using mocked provider responses.

The Apple push key and Android FCM V1 service account are configured in EAS. Physical-device admin push and app-closed completion delivery remain pending until device opt-in and delivery are verified.

## Admin artwork and phone delivery update — 24 October

The separate admin repository now provides a drag/drop image area, everyone/selected/conditional audiences, and separate phone and browser delivery results. The three-file VPS follow-up normalizes push artwork to JPEG for Apple attachments, includes Expo richContent images, and returns per-recipient native delivery counts. It was deployed with a data backup, source-hash checks, active-upload check, and rollback image; isolated network-disabled campaign tests passed. No real student broadcast was sent.

Firebase client configuration for com.pastq.study is now present. A dedicated FCM-only service identity and locally generated one-year key were verified against Google; the private material stays in the ignored QA folder with DELL/SYSTEM-only ACLs. The unused Google-generated key was deleted with owner approval. Key renewal is due before October 2027. The verified key is attached in EAS for com.pastq.study; physical-device delivery is recorded separately.

The 1.0.6 native source adds an iOS notification-service extension for JPEG artwork and quiet provisional registration on new signed-in iPhone installs. It respects app opt-out and OS denial. Banners and sound require explicit student action; Android 13+ continues to request the system notification permission after student opt-in. Existing signed 1.0.5 previews do not contain these new native changes.
