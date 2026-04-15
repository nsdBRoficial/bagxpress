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
