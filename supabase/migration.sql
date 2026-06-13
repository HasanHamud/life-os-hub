-- Life OS — Supabase Schema
-- Run this in the Supabase SQL Editor after creating the project.

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ===================== TASKS =====================
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  title text not null default 'Untitled',
  description text,
  status text not null default 'todo' check (status in ('backlog','todo','in_progress','blocked','done')),
  priority text not null default 'med' check (priority in ('low','med','high','urgent')),
  effort integer,
  deadline double precision,
  project_id uuid,
  goal_id uuid,
  tag_ids jsonb default '[]'::jsonb,
  parent_task_id uuid,
  depends_on_ids jsonb default '[]'::jsonb,
  recurrence jsonb,
  recurrence_parent_id uuid,
  archived boolean default false,
  completed_at double precision,
  created_at double precision not null default extract(epoch from now()) * 1000,
  updated_at double precision not null default extract(epoch from now()) * 1000
);
alter table tasks enable row level security;
create policy "Users own their tasks" on tasks for all using (auth.uid() = user_id);
create index idx_tasks_user on tasks(user_id);
create index idx_tasks_status on tasks(status);

-- ===================== TIME BLOCKS =====================
create table if not exists time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  task_id uuid,
  title text not null default 'Time Block',
  start_time double precision not null,
  end_time double precision not null,
  type text not null default 'work' check (type in ('work','freelance','personal','studies','university')),
  is_completed boolean default false,
  notes text,
  recurrence jsonb,
  recurrence_parent_id uuid,
  created_at double precision not null default extract(epoch from now()) * 1000
);
alter table time_blocks enable row level security;
create policy "Users own their time blocks" on time_blocks for all using (auth.uid() = user_id);
create index idx_time_blocks_user on time_blocks(user_id);
create index idx_time_blocks_start on time_blocks(start_time);

-- ===================== PROJECTS =====================
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null default 'Untitled Project',
  description text,
  color text default '#d4a574',
  category text,
  archived boolean default false,
  created_at double precision not null default extract(epoch from now()) * 1000
);
alter table projects enable row level security;
create policy "Users own their projects" on projects for all using (auth.uid() = user_id);
create index idx_projects_user on projects(user_id);

-- ===================== GOALS =====================
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  title text not null default 'Untitled Goal',
  description text,
  duration_days integer not null default 30,
  start_date double precision not null,
  end_date double precision not null,
  linked_task_ids jsonb default '[]'::jsonb,
  created_at double precision not null default extract(epoch from now()) * 1000
);
alter table goals enable row level security;
create policy "Users own their goals" on goals for all using (auth.uid() = user_id);
create index idx_goals_user on goals(user_id);

-- ===================== SESSIONS =====================
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  task_id uuid,
  start_time double precision not null,
  end_time double precision not null,
  duration integer not null,
  type text not null check (type in ('focus','break')),
  notes text
);
alter table sessions enable row level security;
create policy "Users own their sessions" on sessions for all using (auth.uid() = user_id);
create index idx_sessions_user on sessions(user_id);
create index idx_sessions_start on sessions(start_time);

-- ===================== TAGS =====================
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  color text not null default '#d4a574'
);
alter table tags enable row level security;
create policy "Users own their tags" on tags for all using (auth.uid() = user_id);
create index idx_tags_user on tags(user_id);

-- ===================== LOGS =====================
create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  date text not null,
  content text not null default '',
  related_task_id uuid,
  mood integer check (mood between 1 and 5),
  energy integer check (energy between 1 and 5),
  created_at double precision not null default extract(epoch from now()) * 1000
);
alter table logs enable row level security;
create policy "Users own their logs" on logs for all using (auth.uid() = user_id);
create index idx_logs_user on logs(user_id);
create index idx_logs_date on logs(date);

-- ===================== SETTINGS =====================
create table if not exists settings (
  id text primary key default 'global',
  user_id uuid references auth.users not null default auth.uid(),
  pomodoro_focus integer not null default 25,
  pomodoro_break integer not null default 5,
  pomodoro_long_break integer not null default 15,
  pomodoro_long_every integer not null default 4,
  notifications_enabled boolean default false,
  workday_start integer not null default 8,
  workday_end integer not null default 20,
  base_currency text not null default 'USD',
  usd_to_lbp_rate double precision not null default 90000
);
alter table settings enable row level security;
create policy "Users own their settings" on settings for all using (auth.uid() = user_id);
create index idx_settings_user on settings(user_id);

-- ===================== FINANCE: ACCOUNTS =====================
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  type text not null check (type in ('cash','bank','savings','credit')),
  initial_balance double precision not null default 0,
  balance double precision not null default 0,
  currency text not null default 'USD',
  color text default '#d4a574',
  archived boolean default false,
  created_at double precision not null default extract(epoch from now()) * 1000
);
alter table accounts enable row level security;
create policy "Users own their accounts" on accounts for all using (auth.uid() = user_id);
create index idx_accounts_user on accounts(user_id);

-- ===================== FINANCE: TRANSACTIONS =====================
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  type text not null check (type in ('income','expense','transfer')),
  amount double precision not null,
  category_id uuid,
  account_id uuid not null,
  to_account_id uuid,
  date double precision not null,
  note text,
  related_task_id uuid,
  related_goal_id uuid,
  recurrence jsonb,
  recurrence_parent_id uuid,
  created_at double precision not null default extract(epoch from now()) * 1000
);
alter table transactions enable row level security;
create policy "Users own their transactions" on transactions for all using (auth.uid() = user_id);
create index idx_transactions_user on transactions(user_id);
create index idx_transactions_date on transactions(date);
create index idx_transactions_account on transactions(account_id);

-- ===================== FINANCE: CATEGORIES =====================
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  type text not null check (type in ('income','expense')),
  parent_category_id uuid,
  color text default '#d4a574',
  icon text,
  created_at double precision not null default extract(epoch from now()) * 1000
);
alter table categories enable row level security;
create policy "Users own their categories" on categories for all using (auth.uid() = user_id);
create index idx_categories_user on categories(user_id);
create index idx_categories_type on categories(type);

-- ===================== FINANCE: BUDGETS =====================
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  category_id uuid not null,
  limit_amount double precision not null,
  period text not null default 'monthly' check (period in ('monthly','weekly')),
  start_date double precision not null,
  created_at double precision not null default extract(epoch from now()) * 1000
);
alter table budgets enable row level security;
create policy "Users own their budgets" on budgets for all using (auth.uid() = user_id);
create index idx_budgets_user on budgets(user_id);

-- ===================== FINANCE: SAVINGS GOALS =====================
create table if not exists savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  title text not null,
  target_amount double precision not null,
  current_amount double precision not null default 0,
  currency text default 'USD',
  deadline double precision,
  linked_goal_id uuid,
  account_id uuid,
  color text default '#90b890',
  created_at double precision not null default extract(epoch from now()) * 1000
);
alter table savings_goals enable row level security;
create policy "Users own their savings goals" on savings_goals for all using (auth.uid() = user_id);
create index idx_savings_goals_user on savings_goals(user_id);

-- ===================== NOTES =====================
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  title text not null default 'Untitled',
  content text not null default '',
  type text not null default 'text' check (type in ('text','checklist','code','idea','meeting','doc','sql','api')),
  status text not null default 'active' check (status in ('draft','active','archived','trashed')),
  category text,
  tag_ids jsonb default '[]'::jsonb,
  priority text check (priority in ('low','med','high')),
  favorite boolean default false,
  pinned boolean default false,
  color text,
  icon text,
  project_id uuid,
  language text,
  attachments jsonb default '[]'::jsonb,
  is_template boolean default false,
  created_at double precision not null default extract(epoch from now()) * 1000,
  updated_at double precision not null default extract(epoch from now()) * 1000,
  trashed_at double precision
);
alter table notes enable row level security;
create policy "Users own their notes" on notes for all using (auth.uid() = user_id);
create index idx_notes_user on notes(user_id);
create index idx_notes_updated on notes(updated_at);
create index idx_notes_status on notes(status);

-- ===================== LEARNING: CONCEPTS =====================
create table if not exists concepts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  subject text not null default '',
  topic text not null default '',
  title text not null default 'Untitled',
  phase integer not null default 1,
  clarity_rating integer not null default 1 check (clarity_rating between 1 and 5),
  can_explain_without_notes boolean default false,
  notes text,
  resource_links jsonb default '[]'::jsonb,
  tags jsonb default '[]'::jsonb,
  problem_ids jsonb default '[]'::jsonb,
  created_at double precision not null default extract(epoch from now()) * 1000,
  updated_at double precision not null default extract(epoch from now()) * 1000
);
alter table concepts enable row level security;
create policy "Users own their concepts" on concepts for all using (auth.uid() = user_id);
create index idx_concepts_user on concepts(user_id);
create index idx_concepts_subject on concepts(subject);
create index idx_concepts_phase on concepts(phase);

-- ===================== LEARNING: INSIGHTS =====================
create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  date text not null,
  subject text not null default '',
  key_idea text not null,
  source text,
  tags jsonb default '[]'::jsonb,
  next_review_at double precision,
  created_at double precision not null default extract(epoch from now()) * 1000
);
alter table insights enable row level security;
create policy "Users own their insights" on insights for all using (auth.uid() = user_id);
create index idx_insights_user on insights(user_id);
create index idx_insights_date on insights(date);
create index idx_insights_subject on insights(subject);

-- ===================== LEARNING: PROBLEMS =====================
create table if not exists problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  title text not null default 'Untitled',
  subject text not null default '',
  source text,
  difficulty integer default 1 check (difficulty between 1 and 5),
  pattern_class text,
  time_to_solve integer,
  notes text,
  tags jsonb default '[]'::jsonb,
  completed boolean default false,
  completed_at double precision,
  created_at double precision not null default extract(epoch from now()) * 1000
);
alter table problems enable row level security;
create policy "Users own their problems" on problems for all using (auth.uid() = user_id);
create index idx_problems_user on problems(user_id);
create index idx_problems_subject on problems(subject);
create index idx_problems_difficulty on problems(difficulty);

-- ===================== LEARNING: SESSIONS =====================
create table if not exists learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  date text not null,
  subject text not null default '',
  duration_minutes integer not null,
  concepts_reviewed integer,
  problems_solved integer,
  notes text,
  created_at double precision not null default extract(epoch from now()) * 1000
);
alter table learning_sessions enable row level security;
create policy "Users own their learning sessions" on learning_sessions for all using (auth.uid() = user_id);
create index idx_learning_sessions_user on learning_sessions(user_id);
create index idx_learning_sessions_date on learning_sessions(date);

-- ===================== LEARNING: ROTATION =====================
create table if not exists rotation_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  day_of_week integer not null check (day_of_week between 0 and 6),
  subject text not null,
  icon text,
  enabled boolean default true
);
alter table rotation_entries enable row level security;
create policy "Users own their rotation entries" on rotation_entries for all using (auth.uid() = user_id);
create index idx_rotation_entries_user on rotation_entries(user_id);
create index idx_rotation_entries_day on rotation_entries(day_of_week);

-- ===================== WEEKLY PLANS =====================
create table if not exists weekly_plans (
  id text primary key,
  user_id uuid references auth.users not null default auth.uid(),
  week_start double precision not null,
  intention text default '',
  goals jsonb default '[]'::jsonb,
  categories jsonb default '["Work","Freelance","Personal","Studies","University"]'::jsonb,
  category_notes jsonb default '{}'::jsonb,
  notes text default '',
  reflection text,
  created_at double precision not null default extract(epoch from now()) * 1000,
  updated_at double precision not null default extract(epoch from now()) * 1000
);
alter table weekly_plans enable row level security;
create policy "Users own their weekly plans" on weekly_plans for all using (auth.uid() = user_id);
create index idx_weekly_plans_user on weekly_plans(user_id);

-- ===================== WEEK TEMPLATES =====================
create table if not exists week_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null default 'Untitled Template',
  days jsonb default '[]'::jsonb,
  created_at double precision not null default extract(epoch from now()) * 1000
);
alter table week_templates enable row level security;
create policy "Users own their week templates" on week_templates for all using (auth.uid() = user_id);
create index idx_week_templates_user on week_templates(user_id);
