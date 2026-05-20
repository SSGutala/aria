-- ============================================================================
-- 20260520_role_onboarding.sql
-- Adds persistent role-based onboarding fields to profiles, plus chat-level
-- role context columns on conversations so each chat preserves the role
-- context it was created with.
-- ============================================================================

-- --- profiles: extend with role/seniority/identity fields --------------------
alter table public.profiles
  add column if not exists company text,
  add column if not exists department text,
  add column if not exists selected_role text,
  add column if not exists custom_role text,
  add column if not exists seniority_level text,
  add column if not exists intended_use_cases text[] default '{}',
  add column if not exists onboarding_completed boolean default false;

-- --- conversations: role context snapshot at creation time -------------------
-- We store the role/seniority/use cases that were active when each chat began.
-- Editing a profile later WILL NOT rewrite existing chats — those are frozen.
-- A user can optionally override per chat.
alter table public.conversations
  add column if not exists role_context text,
  add column if not exists custom_role_context text,
  add column if not exists seniority_context text,
  add column if not exists intended_use_cases text[] default '{}',
  add column if not exists role_overridden boolean default false;

-- --- Index for quick role-filtered conversation lookups ----------------------
create index if not exists conversations_role_context_idx
  on public.conversations(role_context);
