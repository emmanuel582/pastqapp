# Shared account database migration

Live QA reached the existing Supabase account provider and created the authorized temporary QA account. Its history write failed because the deployed exam_sessions table has no answered_count column. The browser source also writes this column, so this is a shared deployment mismatch.

Run migrations/001_student_data_only.sql in the existing Supabase project's SQL Editor as the project owner. It is copied from the original application's existing migration, wrapped in a transaction, with a PostgREST schema refresh. It adds student progress tables/summary fields and owner-only row policies. It does not delete questions, downloads, accounts, or history.

The mobile app must keep failed synchronization in its local outbox until this is applied. Never put a service role key or database password in EXPO_PUBLIC_* variables.

After applying, run npx tsx scripts/check-account-sync.ts using the ignored .qa/account.json temporary account, then finish the live upload test once the VPS is reachable from the laptop.


See [native push delivery](NATIVE_PUSH.md) for the mobile device registration, administrator campaigns, upload completion alerts and VPS patch.
