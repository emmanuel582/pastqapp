-- Prepared for the existing PastQ browser and mobile clients. No question content or existing rows are removed.
BEGIN;
-- PastQ student-data schema
-- Run this in the Supabase SQL Editor after supabase/schema.sql.
--
-- DATA BOUNDARY: this database stores only data owned by a student. Do NOT put
-- question wording, choices, answers, explanations, PDF files, image files, or
-- extracted OCR text here. Those assets belong on the Hostinger VPS library.

alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists target_exam text;
alter table public.users add column if not exists target_university text;
alter table public.users add column if not exists timezone text not null default 'Africa/Lagos';

create table if not exists public.student_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  daily_goal_minutes integer not null default 30 check (daily_goal_minutes between 5 and 600),
  preferred_subjects text[] not null default '{}',
  difficulty_preference text not null default 'adaptive' check (difficulty_preference in ('easy', 'adaptive', 'challenging')),
  reminder_enabled boolean not null default false,
  reminder_time time,
  updated_at timestamptz not null default now()
);

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_bundle_id text not null,
  source_bundle_version text,
  mode text not null default 'practice' check (mode in ('practice', 'timed', 'mock', 'review')),
  configuration jsonb not null default '{}'::jsonb,
  question_count integer not null check (question_count >= 0),
  answered_count integer not null default 0 check (answered_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Keys reference Hostinger content only; no question content is duplicated.
  question_keys text[] not null default '{}'
);

create index if not exists practice_sessions_user_completed_idx
  on public.practice_sessions (user_id, completed_at desc);
create index if not exists practice_sessions_user_bundle_idx
  on public.practice_sessions (user_id, source_bundle_id, started_at desc);

create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  practice_session_id uuid not null references public.practice_sessions(id) on delete cascade,
  -- Stable opaque key from the Hostinger library, never question text/options.
  question_key text not null,
  topic_keys text[] not null default '{}',
  selected_option_index smallint check (selected_option_index between 0 and 9),
  is_correct boolean,
  response_time_ms integer check (response_time_ms is null or response_time_ms >= 0),
  confidence smallint check (confidence between 1 and 5),
  attempt_order integer not null check (attempt_order >= 0),
  created_at timestamptz not null default now(),
  unique (practice_session_id, question_key)
);

create index if not exists question_attempts_user_topic_idx
  on public.question_attempts using gin (topic_keys);
create index if not exists question_attempts_user_created_idx
  on public.question_attempts (user_id, created_at desc);

create table if not exists public.student_topic_mastery (
  user_id uuid not null references public.users(id) on delete cascade,
  topic_key text not null,
  attempts integer not null default 0 check (attempts >= 0),
  correct integer not null default 0 check (correct >= 0 and correct <= attempts),
  mastery_score numeric(5,4) not null default 0 check (mastery_score between 0 and 1),
  confidence_score numeric(5,4) not null default 0.5 check (confidence_score between 0 and 1),
  last_attempt_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_key)
);

create table if not exists public.recommendation_impressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  recommendation_type text not null check (recommendation_type in ('next_question', 'practice_set', 'revision_plan')),
  candidate_keys text[] not null default '{}',
  reason_codes text[] not null default '{}',
  algorithm_version text not null,
  selected_key text,
  acted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists recommendation_impressions_user_created_idx
  on public.recommendation_impressions (user_id, created_at desc);

create table if not exists public.learning_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  event_name text not null,
  event_data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists learning_events_user_occurred_idx
  on public.learning_events (user_id, occurred_at desc);

-- Existing history stays supported while the application migrates. It stores
-- only summary results, never a question payload.
alter table public.exam_sessions add column if not exists duration_seconds integer not null default 0;
alter table public.exam_sessions add column if not exists source_bundle_id text;
alter table public.exam_sessions add column if not exists source_bundle_version text;
alter table public.exam_sessions add column if not exists answered_count integer not null default 0;

alter table public.users enable row level security;
alter table public.student_preferences enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.question_attempts enable row level security;
alter table public.student_topic_mastery enable row level security;
alter table public.recommendation_impressions enable row level security;
alter table public.learning_events enable row level security;

-- Each table is directly accessible only to its owning authenticated student.
drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_insert_own" on public.users;
drop policy if exists "users_update_own" on public.users;
create policy "users_select_own" on public.users for select to authenticated using (auth.uid() = id);
create policy "users_insert_own" on public.users for insert to authenticated with check (auth.uid() = id);
create policy "users_update_own" on public.users for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "student_preferences_own" on public.student_preferences;
create policy "student_preferences_own" on public.student_preferences for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "practice_sessions_own" on public.practice_sessions;
create policy "practice_sessions_own" on public.practice_sessions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "question_attempts_own" on public.question_attempts;
create policy "question_attempts_own" on public.question_attempts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "student_topic_mastery_own" on public.student_topic_mastery;
create policy "student_topic_mastery_own" on public.student_topic_mastery for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "recommendation_impressions_own" on public.recommendation_impressions;
create policy "recommendation_impressions_own" on public.recommendation_impressions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "learning_events_own" on public.learning_events;
create policy "learning_events_own" on public.learning_events for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tighten the legacy summary table too. The old schema created only select and
-- insert policies, which blocked safe corrections/deletion by the owner.
drop policy if exists "exam_sessions_update_own" on public.exam_sessions;
drop policy if exists "exam_sessions_delete_own" on public.exam_sessions;
create policy "exam_sessions_update_own" on public.exam_sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exam_sessions_delete_own" on public.exam_sessions for delete to authenticated using (auth.uid() = user_id);

-- If an old deployment created public.library_bundles, do NOT drop it blindly:
-- first export/verify the Hostinger library. It is intentionally absent from
-- this schema because Supabase must not store question content going forward.

NOTIFY pgrst, 'reload schema';
COMMIT;
