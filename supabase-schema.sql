-- Users are handled by Supabase Auth

-- Conversations (each chat session)
create table conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null default 'New conversation',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Messages within each conversation
create table messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  message_type text default 'text' check (message_type in ('text', 'clarification', 'confirmation', 'app_card')),
  metadata jsonb default '{}',
  created_at timestamp with time zone default now()
);

-- Generated apps
create table generated_apps (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations on delete cascade not null,
  user_id uuid references auth.users not null,
  title text not null,
  workflow_type text not null check (workflow_type in ('approval_workflow', 'intake_tracker', 'status_board')),
  schema jsonb not null,
  table_name text not null unique,
  notification_config jsonb default '{}',
  status text default 'deployed' check (status in ('generating', 'deployed', 'error')),
  slug text not null unique,
  created_at timestamp with time zone default now()
);

-- Dynamic app data (submissions from generated apps)
create table app_submissions (
  id uuid default gen_random_uuid() primary key,
  app_id uuid references generated_apps on delete cascade not null,
  ticket_id text not null,
  data jsonb not null,
  status text default 'Pending',
  submitted_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS policies
alter table conversations enable row level security;
alter table messages enable row level security;
alter table generated_apps enable row level security;
alter table app_submissions enable row level security;

create policy "Users own their conversations" on conversations for all using (auth.uid() = user_id);
create policy "Users see their messages" on messages for all using (
  conversation_id in (select id from conversations where user_id = auth.uid())
);
create policy "Users own their apps" on generated_apps for all using (auth.uid() = user_id);
create policy "Anyone can submit to an app" on app_submissions for insert with check (true);
create policy "App owners can view submissions" on app_submissions for select using (
  app_id in (select id from generated_apps where user_id = auth.uid())
);
create policy "App owners can update submissions" on app_submissions for update using (
  app_id in (select id from generated_apps where user_id = auth.uid())
);
