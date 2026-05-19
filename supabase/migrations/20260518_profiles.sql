-- Profiles table: stores job title, work category, use cases, and derived account type
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  job_title text,
  work_category text,
  use_cases text[] default '{}',
  account_type text check (account_type in ('builder', 'automator', 'strategist', 'full_access')) default 'full_access',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);
