-- Dashboard Data Issue Diagnostic Script
-- Run this in Supabase SQL Editor to analyze real data

-- 1. Check database structure and table counts
SELECT
  'orders' as table_name,
  (SELECT COUNT(*) FROM public.orders) as record_count
UNION ALL
SELECT
  'transactions' as table_name,
  (SELECT COUNT(*) FROM public.transactions) as record_count
UNION ALL
SELECT
  'pending_claims' as table_name,
  (SELECT COUNT(*) FROM pending_claims) as record_count
UNION ALL
SELECT
  'profiles' as table_name,
  (SELECT COUNT(*) FROM public.profiles) as record_count;

-- 2. Find 3 real orders with their details
SELECT
  o.id,
  o.stripe_payment_intent_id,
  o.amount_usd,
  o.status,
  o.user_id,
  o.created_at,
  p.email,
  p.display_name,
  t.tx_hash,
  t.delivered_amount,
  t.is_real_tx,
  t.created_at as tx_created_at
FROM public.orders o
LEFT JOIN public.profiles p ON o.user_id = p.id
LEFT JOIN public.transactions t ON o.id = t.order_id
WHERE o.status = 'completed' AND t.is_real_tx = true
LIMIT 3;

-- 3. Analyze identity patterns in orders table
SELECT
  COUNT(*) as total_orders,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as auth_users,
  COUNT(CASE WHEN user_id IS NULL THEN 1 END) as anonymous_orders,
  COUNT(CASE WHEN EXISTS (SELECT 1 FROM public.transactions t WHERE t.order_id = o.id) THEN 1 END) as has_transaction
FROM public.orders o;

-- 4. Analyze identity patterns in transactions table
SELECT
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as auth_users,
  COUNT(CASE WHEN user_id IS NULL THEN 1 END) as anonymous_transactions
FROM public.transactions t;

-- 5. Check pending_claims table patterns
SELECT
  COUNT(*) as total_claims,
  COUNT(CASE WHEN claimed = true THEN 1 END) as claimed,
  COUNT(CASE WHEN claimed = false THEN 1 END) as unclaimed,
  COUNT(CASE WHEN claimed_by IS NOT NULL THEN 1 END) as has_destination,
  COUNT(CASE WHEN claimed_by IS NULL THEN 1 END) as no_destination,
  COUNT(CASE WHEN claimed = true AND claimed_by IS NOT NULL THEN 1 END) as properly_claimed
FROM pending_claims;

-- 6. Find examples of claim records
SELECT
  id,
  order_id,
  wallet_pubkey,
  amount,
  token_mint,
  claimed,
  claimed_by,
  claimed_at,
  expires_at,
  created_at
FROM pending_claims
ORDER BY created_at DESC
LIMIT 3;

-- 7. Check wallet addresses in claims
SELECT
  DISTINCT wallet_pubkey,
  COUNT(*) as claim_count
FROM pending_claims
GROUP BY wallet_pubkey
ORDER BY claim_count DESC
LIMIT 5;

-- 8. Dashboard Query simulation - fetching orders for authenticated users
-- This simulates what the dashboard API does for authenticated users
SELECT
  o.id,
  o.amount_usd,
  o.status,
  o.created_at,
  o.stripe_payment_intent_id,
  t.tx_hash,
  t.is_real_tx,
  t.created_at as tx_created_at
FROM public.orders o
LEFT JOIN public.transactions t ON o.id = t.order_id
WHERE o.user_id IS NOT NULL
LIMIT 5;

-- 9. Dashboard Query simulation - fetching orders for phantom wallets
-- This simulates what the dashboard API does for phantom users
SELECT
  o.id,
  o.amount_usd,
  o.status,
  o.created_at,
  o.stripe_payment_intent_id,
  t.tx_hash,
  t.is_real_tx,
  t.created_at as tx_created_at
FROM public.orders o
LEFT JOIN public.transactions t ON o.id = t.order_id
WHERE o.id IN (
  SELECT DISTINCT order_id FROM pending_claims WHERE claimed_by IS NOT NULL
)
LIMIT 5;

-- 10. Check any orphaned orders (no transactions)
SELECT
  o.id,
  o.amount_usd,
  o.status,
  o.created_at
FROM public.orders o
WHERE NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.order_id = o.id)
LIMIT 3;