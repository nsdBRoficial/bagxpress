-- ============================================================
-- BagxPress — Schema SQL para Supabase
-- Execute este script no SQL Editor do Supabase Dashboard
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. PROFILES — Extende auth.users com dados de perfil
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text,
  display_name text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- RLS: usuário só vê seu próprio perfil
alter table public.profiles enable row level security;

create policy "profiles: user can read own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: user can update own" on public.profiles
  for update using (auth.uid() = id);

-- Trigger para criar perfil automaticamente ao registrar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. WALLETS — Uma wallet Solana por usuário, private key criptografada
create table if not exists public.wallets (
  id                    uuid default gen_random_uuid() primary key,
  user_id               uuid references public.profiles(id) on delete cascade unique not null,
  public_key            text not null,
  encrypted_private_key text not null,  -- AES-256-GCM base64
  encryption_iv         text not null,  -- IV base64
  network               text default 'devnet',
  -- God Stack: ZK Compression
  is_compressed         boolean default false,   -- true se conta usa Light Protocol
  compressed_account_hash text,                 -- hash da conta no Merkle tree
  tree_address          text,                   -- state tree do Light Protocol
  created_at            timestamptz default now()
);

-- RLS: usuário só vê sua própria wallet
alter table public.wallets enable row level security;

create policy "wallets: user can read own" on public.wallets
  for select using (auth.uid() = user_id);

-- INSERT/UPDATE só pelo service role (nunca pelo cliente)
create policy "wallets: service role only insert" on public.wallets
  for insert with check (false);  -- bloqueado para anon/authenticated; service role bypassa RLS


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

-- RLS: usuário vê suas próprias orders
alter table public.orders enable row level security;

create policy "orders: user can read own" on public.orders
  for select using (auth.uid() = user_id);

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

-- RLS: usuário vê suas próprias transações
alter table public.transactions enable row level security;

create policy "transactions: user can read own" on public.transactions
  for select using (auth.uid() = user_id);

-- INSERT/UPDATE só pelo service role
create policy "transactions: service role only" on public.transactions
  for all using (false);


-- 5. Índices de performance
create index if not exists idx_wallets_user_id on public.wallets(user_id);
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_stripe_pi on public.orders(stripe_payment_intent_id);
create index if not exists idx_transactions_order_id on public.transactions(order_id);
create index if not exists idx_transactions_user_id on public.transactions(user_id);


-- =============================================================================
-- GOD STACK — Tabelas adicionais
-- =============================================================================

-- 6. COMPRESSED_ACCOUNTS — Registro de contas ZK comprimidas (Light Protocol)
-- Complementa a tabela wallets para usuários com contas comprimidas.
create table if not exists public.compressed_accounts (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  public_key      text not null,                -- owner da conta comprimida
  account_hash    text,                         -- hash no Merkle tree
  tree_address    text,                         -- state tree do Light Protocol
  token_mint      text,                         -- mint associado (ex: BXP)
  lamports        bigint default 0,
  token_amount    bigint default 0,             -- amount em unidades base
  network         text default 'devnet',
  last_synced_at  timestamptz default now(),
  created_at      timestamptz default now()
);

-- RLS: usuário só vê suas próprias contas comprimidas
alter table public.compressed_accounts enable row level security;

create policy "compressed_accounts: user can read own" on public.compressed_accounts
  for select using (auth.uid() = user_id);

-- INSERT/UPDATE só pelo service role
create policy "compressed_accounts: service role only" on public.compressed_accounts
  for all using (false);

-- Índices para lookup eficiente
create index if not exists idx_compressed_accounts_user_id
  on public.compressed_accounts(user_id);
create index if not exists idx_compressed_accounts_public_key
  on public.compressed_accounts(public_key);
create index if not exists idx_compressed_accounts_token_mint
  on public.compressed_accounts(token_mint);


-- 7. RELAYER_LOGS — Registro de transações patrocinadas (Gasless Engine)
create table if not exists public.relayer_logs (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references public.profiles(id) on delete set null,
  user_signer     text not null,                -- public key do usuário
  fee_payer       text,                         -- public key do fee payer
  fee_sponsored   bigint,                       -- lamports cobertos
  tx_hash         text,
  event_type      text not null,                -- fee_sponsored | fallback_self_pay | error
  network         text default 'devnet',
  error_message   text,
  created_at      timestamptz default now()
);

-- RLS: apenas service role acessa (dados sensíveis do relayer)
alter table public.relayer_logs enable row level security;

create policy "relayer_logs: service role only" on public.relayer_logs
  for all using (false);

create index if not exists idx_relayer_logs_user_id on public.relayer_logs(user_id);
create index if not exists idx_relayer_logs_tx_hash on public.relayer_logs(tx_hash);
