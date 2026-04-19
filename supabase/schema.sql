-- ============================================================
-- BagxPress — Schema SQL para Supabase
-- ============================================================
-- INSTRUÇÃO DE USO:
--   Execute cada BLOCO separadamente no SQL Editor do Supabase.
--   Todos os blocos são seguros para re-executar (idempotentes).
--   https://supabase.com/dashboard/project/_/sql
-- ============================================================


-- ============================================================
-- BLOCO 1: TABELAS BASE
-- ============================================================

-- 1. PROFILES — Extende auth.users com dados de perfil
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text,
  display_name text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: user can read own" on public.profiles;
create policy "profiles: user can read own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles: user can update own" on public.profiles;
create policy "profiles: user can update own" on public.profiles
  for update using (auth.uid() = id);


-- 2. WALLETS — Uma wallet Solana por usuário, private key criptografada
create table if not exists public.wallets (
  id                    uuid default gen_random_uuid() primary key,
  user_id               uuid references public.profiles(id) on delete cascade unique not null,
  public_key            text not null,
  encrypted_private_key text not null,  -- AES-256-GCM base64
  encryption_iv         text not null,  -- IV base64
  network               text default 'devnet',
  -- God Stack: ZK Compression
  is_compressed         boolean default false,
  compressed_account_hash text,
  tree_address          text,
  created_at            timestamptz default now()
);

alter table public.wallets enable row level security;

drop policy if exists "wallets: user can read own" on public.wallets;
create policy "wallets: user can read own" on public.wallets
  for select using (auth.uid() = user_id);

drop policy if exists "wallets: service role only insert" on public.wallets;
create policy "wallets: service role only insert" on public.wallets
  for insert with check (false);


-- 3. ORDERS — Registro de cada intenção de compra
create table if not exists public.orders (
  id                        uuid default gen_random_uuid() primary key,
  user_id                   uuid references public.profiles(id) on delete set null,
  stripe_payment_intent_id  text unique,
  amount_usd                numeric not null,
  token_mint                text,
  creator_handle            text,
  creator_wallet            text,
  creator_royalty_percent   numeric default 0,
  status                    text default 'pending',
  -- status: pending | paid | executing | completed | failed
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

alter table public.orders enable row level security;

drop policy if exists "orders: user can read own" on public.orders;
create policy "orders: user can read own" on public.orders
  for select using (auth.uid() = user_id);

drop policy if exists "orders: authenticated can insert" on public.orders;
create policy "orders: authenticated can insert" on public.orders
  for insert with check (auth.uid() = user_id);


-- 4. TRANSACTIONS — Resultados on-chain de cada order
create table if not exists public.transactions (
  id               uuid default gen_random_uuid() primary key,
  order_id         uuid references public.orders(id) on delete cascade unique not null,
  user_id          uuid references public.profiles(id) on delete set null,
  tx_hash          text,
  delivered_amount numeric,
  is_real_tx       boolean default false,
  network          text default 'devnet',
  explorer_url     text,
  status           text default 'pending',
  -- status: pending | confirmed | failed
  created_at       timestamptz default now()
);

alter table public.transactions enable row level security;

drop policy if exists "transactions: user can read own" on public.transactions;
create policy "transactions: user can read own" on public.transactions
  for select using (auth.uid() = user_id);

drop policy if exists "transactions: service role only" on public.transactions;
create policy "transactions: service role only" on public.transactions
  for all using (false);


-- 5. Índices de performance
create index if not exists idx_wallets_user_id       on public.wallets(user_id);
create index if not exists idx_orders_user_id        on public.orders(user_id);
create index if not exists idx_orders_stripe_pi      on public.orders(stripe_payment_intent_id);
create index if not exists idx_transactions_order_id on public.transactions(order_id);
create index if not exists idx_transactions_user_id  on public.transactions(user_id);


-- ============================================================
-- BLOCO 2: TRIGGER DE PERFIL AUTOMÁTICO
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- BLOCO 3: GOD STACK — TABELAS AUXILIARES
-- ============================================================

-- 6. COMPRESSED_ACCOUNTS — Registro de contas ZK comprimidas (Light Protocol)
create table if not exists public.compressed_accounts (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  public_key      text not null,
  account_hash    text,
  tree_address    text,
  token_mint      text,
  lamports        bigint default 0,
  token_amount    bigint default 0,
  network         text default 'devnet',
  last_synced_at  timestamptz default now(),
  created_at      timestamptz default now()
);

alter table public.compressed_accounts enable row level security;

drop policy if exists "compressed_accounts: user can read own" on public.compressed_accounts;
create policy "compressed_accounts: user can read own" on public.compressed_accounts
  for select using (auth.uid() = user_id);

drop policy if exists "compressed_accounts: service role only" on public.compressed_accounts;
create policy "compressed_accounts: service role only" on public.compressed_accounts
  for all using (false);

create index if not exists idx_compressed_accounts_user_id    on public.compressed_accounts(user_id);
create index if not exists idx_compressed_accounts_public_key on public.compressed_accounts(public_key);
create index if not exists idx_compressed_accounts_token_mint on public.compressed_accounts(token_mint);


-- 7. RELAYER_LOGS — Registro de transações patrocinadas (Gasless Engine)
create table if not exists public.relayer_logs (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references public.profiles(id) on delete set null,
  user_signer     text not null,
  fee_payer       text,
  fee_sponsored   bigint,
  tx_hash         text,
  event_type      text not null,
  network         text default 'devnet',
  error_message   text,
  created_at      timestamptz default now()
);

alter table public.relayer_logs enable row level security;

drop policy if exists "relayer_logs: service role only" on public.relayer_logs;
create policy "relayer_logs: service role only" on public.relayer_logs
  for all using (false);

create index if not exists idx_relayer_logs_user_id on public.relayer_logs(user_id);
create index if not exists idx_relayer_logs_tx_hash  on public.relayer_logs(tx_hash);


-- ============================================================
-- BLOCO 4: BURN_EVENTS — Helius Webhook + Supabase Realtime
-- ============================================================

create table if not exists public.burn_events (
  id            uuid        primary key default gen_random_uuid(),
  tx_hash       text        unique not null,
  amount_burned numeric     not null,
  burned_at     timestamptz not null,
  source        text        default 'helius',
  created_at    timestamptz default now()
);

alter table public.burn_events enable row level security;

drop policy if exists "burn_events: public read" on public.burn_events;
create policy "burn_events: public read" on public.burn_events
  for select using (true);

drop policy if exists "burn_events: service role only write" on public.burn_events;
create policy "burn_events: service role only write" on public.burn_events
  for insert with check (false);

create index if not exists idx_burn_events_burned_at on public.burn_events(burned_at desc);
create index if not exists idx_burn_events_tx_hash   on public.burn_events(tx_hash);


-- ============================================================
-- BLOCO 5: REALTIME — Executar APÓS o Bloco 4 ter sucesso
-- ============================================================
-- Se aparecer "relation already exists in publication", ignore.
-- Significa que já estava habilitado — tudo certo.

alter publication supabase_realtime add table public.burn_events;
