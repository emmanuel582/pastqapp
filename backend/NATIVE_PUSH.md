# Native notifications for the existing VPS

The mobile repository contains a narrow overlay for the existing backend, keeping the original web workspace unchanged. Production uses the same admin campaign inbox and web push routes, extended with native Expo push delivery.

## Deployed behavior

- Signed-in devices register an Expo push token bound to the verified Supabase account. An installation secret permits revocation after offline sign-out without retaining the account password or session.
- Administrator campaigns queue a native message for opted-in devices, alongside their existing browser notification and in-app inbox. Campaign responses include nativePush delivery counts.
- Saved completed extraction sessions queue an owner-only completion alert. Processing remains on the VPS after the app closes; the app is not the worker. Pending local file transfers still require the app to finish sending the files.
- A persistent SQLite outbox deduplicates events, retries temporary failures with backoff, polls Expo receipts, expires stale messages and removes expired device tokens. Provider acceptance is not proof that a person read a notification. A crash after provider acceptance but before a local write can rarely duplicate a delivery; Expo does not offer an exactly-once transport.
- Native opt-in is separate from scheduled study reminders. Notification taps open the appropriate app screen and defer navigation during an exam.

## Credentials and testing

Android requires google-services.json for com.pastq.study and an FCM V1 service account uploaded privately to EAS. iOS requires an Apple push key attached to the EAS project, separate from its distribution signing certificate. No keys belong in this repository. Configure these in private setup windows and test a real installed release; Expo Go is not a remote-push test target.

The VPS patch was built on the existing Docker image, tested without network access, and deployed after a data backup and a check that no extraction was processing. Only five source files changed; the production environment file stayed in place. Code and image rollback copies are retained on the VPS. vps-baseline-sha256.json records the pre-patch source hashes; vps-overlay/Dockerfile.native shows the explicit source allowlist.

Local queue tests: npm run test:push-backend. Additional isolated VPS tests in vps-overlay/tests cover the real HTTP auth routes and admin-to-native campaign delivery using mocked provider responses.

The Apple push key is now configured in EAS. Android Firebase setup is still pending. Physical-device admin push and app-closed completion delivery remain pending until device opt-in and delivery are verified.
