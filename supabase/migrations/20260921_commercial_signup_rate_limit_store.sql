-- Server-side signup abuse protection for the commercial flow.
create table if not exists public.commercial_signup_attempts (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_commercial_signup_attempts_lookup
  on public.commercial_signup_attempts(scope, key_hash, created_at desc);

alter table public.commercial_signup_attempts enable row level security;

-- No authenticated/anon policies. Service role only.
