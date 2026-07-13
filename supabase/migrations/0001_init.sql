-- Migrations Dashboard -- Postgres schema (replaces the Firestore collections used in
-- the earlier Vercel/Next.js/Firebase version: tickets, companies, managerRoster,
-- ticketNotes, settings/capacityRules, settings/emrTable).
--
-- Run via `supabase db push` (or it applies automatically on `supabase start` /
-- when linked to a hosted project and you run `supabase migration up`).

-- ---------------------------------------------------------------------------
-- companies  (HubSpot Company object)
-- ---------------------------------------------------------------------------
create table if not exists companies (
  id text primary key,                 -- HubSpot company record id
  medspa_id text unique,
  medspa_name text,
  onboarding_manager text,
  migrations_manager text,
  product_manager text,
  provider_success_manager text,
  provider_segment text,               -- Enterprise / Gold / Silver / Experienced / Growth / Beginner / No Segment
  avg_l3m_revenue numeric default 0,   -- GMV -- feeds the $100K+ travel rule + capacity weighting
  full_address text,
  raw jsonb,                           -- full HubSpot properties payload, for anything not modeled above
  synced_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- tickets  (HubSpot Ticket object)
-- ---------------------------------------------------------------------------
create table if not exists tickets (
  id text primary key,                 -- HubSpot ticket record id
  hs_ticket_id text,                   -- duplicate of id, kept for the "Open in HubSpot" link builder
  medspa_id text references companies(medspa_id),
  client_name text,
  pipeline text,
  stage text,                          -- hs_pipeline_stage -- one of the 15 migration stages
  lifecycle_stage text,                -- lifecycle_stage_company_sync -- "onboarding" or "pre-launch"
  priority text,
  source_emr_system text,              -- matched against emr_table for the migrated/scraper flags
  scope_of_migration text,
  years_using_emr text,
  ticket_owner_id text,
  ticket_owner_name text,              -- resolved from HubSpot owners.read, cached here to avoid a lookup per row
  target_launch_date date,
  prev_launch_date date,
  launch_date_changed_at timestamptz,
  create_date timestamptz,
  migration_scoping_date timestamptz,
  service_menu_mapping_date timestamptz,
  migration_complete_date timestamptz,
  closed_date timestamptz,
  rework_date timestamptz,
  delayed_reason_details text,
  notes_remarks text,
  migration_notes text,
  migration_complexity_score numeric,
  gmv numeric default 0,               -- denormalized from companies.avg_l3m_revenue at sync time, for fast filtering
  on_hold boolean default false,
  travel_start_date date,              -- filled in manually on the Travel tab, not sourced from HubSpot
  travel_end_date date,
  travel_note text,
  raw jsonb,
  synced_at timestamptz default now()
);

create index if not exists tickets_stage_idx on tickets (stage);
create index if not exists tickets_manager_idx on tickets (ticket_owner_name);
create index if not exists tickets_launch_idx on tickets (target_launch_date);

-- ---------------------------------------------------------------------------
-- manager_roster  (who's allowed to see the dashboard + own migrations)
-- ---------------------------------------------------------------------------
create table if not exists manager_roster (
  email text primary key,
  name text,
  role text,                           -- e.g. "Migrations Manager", "Admin"
  calendar_status text default 'none', -- 'connected' | 'pending' | 'none'
  added_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- ticket_notes  (dashboard-authored notes, synced back to HubSpot + @mention alerts)
-- ---------------------------------------------------------------------------
create table if not exists ticket_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id text references tickets(id) on delete cascade,
  author_email text,
  body text not null,
  tagged_email text,                   -- set when the note body contains an @mention
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- emr_table  (mirrors the Notion "Known EMR Systems & Nuances For Migration" database)
-- ---------------------------------------------------------------------------
create table if not exists emr_table (
  system text primary key,
  confidence_level text,               -- e.g. "Fully Confident" / "Not Yet Migrated"
  has_scraper boolean default false,
  synced_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- capacity_settings  (single-row table of the editable capacity factors from Settings)
-- ---------------------------------------------------------------------------
create table if not exists capacity_settings (
  id int primary key default 1,
  complexity_ranges jsonb not null default '[
    {"min":0,"max":2,"hours":4},
    {"min":2,"max":4,"hours":6},
    {"min":4,"max":6,"hours":8},
    {"min":6,"max":8,"hours":10},
    {"min":8,"max":10.01,"hours":14}
  ]'::jsonb,
  segment_hours jsonb not null default '{
    "Enterprise":10,"Gold":8,"Silver":7,"Experienced":6,"Growth":5,"Beginner":4,"No Segment":3
  }'::jsonb,
  emr_migrated_hours jsonb not null default '{"yes":4,"no":10}'::jsonb,
  travel_extra_days numeric not null default 2,
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);
insert into capacity_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security -- the domain-restriction signup hook (0002_domain_gate.sql) is
-- the real access gate (it stops non-@joinmoxie.com accounts from ever being created),
-- so anyone with a valid Supabase session here is already a Moxie employee. Policies
-- below just require "signed in" rather than modeling per-row ownership -- revisit if
-- you ever want managers to see only their own tickets.
-- ---------------------------------------------------------------------------
alter table companies enable row level security;
alter table tickets enable row level security;
alter table manager_roster enable row level security;
alter table ticket_notes enable row level security;
alter table emr_table enable row level security;
alter table capacity_settings enable row level security;

create policy "authenticated read companies" on companies for select using (auth.role() = 'authenticated');
create policy "authenticated read tickets" on tickets for select using (auth.role() = 'authenticated');
create policy "authenticated write tickets" on tickets for update using (auth.role() = 'authenticated');
create policy "authenticated read roster" on manager_roster for select using (auth.role() = 'authenticated');
create policy "authenticated read notes" on ticket_notes for select using (auth.role() = 'authenticated');
create policy "authenticated write notes" on ticket_notes for insert with check (auth.role() = 'authenticated');
create policy "authenticated read emr" on emr_table for select using (auth.role() = 'authenticated');
create policy "authenticated read capacity settings" on capacity_settings for select using (auth.role() = 'authenticated');
create policy "authenticated write capacity settings" on capacity_settings for update using (auth.role() = 'authenticated');

-- Edge Functions use the service_role key (bypasses RLS entirely), so the nightly
-- HubSpot/Notion sync can always write regardless of the policies above.
