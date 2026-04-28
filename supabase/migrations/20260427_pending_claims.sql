-- =============================================================================
-- MISSÃO V11 — Zero UX Trust Layer
-- Migration: pending_claims
--
-- Propósito: Armazenar claims de BXP de usuários anônimos para recuperação
-- posterior via Phantom, Magic Link ou Email Recovery.
--
-- Aplicar no Supabase Dashboard → SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS pending_claims (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         TEXT         NOT NULL,
  wallet_pubkey    TEXT         NOT NULL,        -- public key da wallet transitória
  encrypted_secret TEXT         NOT NULL,        -- private key criptografada AES-256-GCM
  encryption_iv    TEXT         NOT NULL,        -- IV único por registro
  amount           NUMERIC      NOT NULL,        -- quantidade de BXP entregue
  token_mint       TEXT         NOT NULL,        -- mint do token SPL
  claimed          BOOLEAN      DEFAULT FALSE,
  claimed_by       TEXT,                         -- public key destino do claim (preenchida ao resgatar)
  claimed_at       TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ  DEFAULT NOW() + INTERVAL '30 days',
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pending_claims_order_id   ON pending_claims(order_id);
CREATE INDEX IF NOT EXISTS idx_pending_claims_claimed     ON pending_claims(claimed);
CREATE INDEX IF NOT EXISTS idx_pending_claims_expires_at  ON pending_claims(expires_at);

-- Row Level Security — somente service_role acessa
ALTER TABLE pending_claims ENABLE ROW LEVEL SECURITY;

-- Bloqueia tudo por padrão (service_role bypassa RLS automaticamente)
CREATE POLICY "No public access to pending_claims"
  ON pending_claims
  FOR ALL
  TO authenticated, anon
  USING (false);

-- Comentários de documentação
COMMENT ON TABLE pending_claims IS
  'Stores ephemeral wallet claims for anonymous BXP purchases. '
  'Only accessible via service_role. Expires after 30 days.';
COMMENT ON COLUMN pending_claims.encrypted_secret IS
  'AES-256-GCM encrypted private key — never expose to frontend.';
COMMENT ON COLUMN pending_claims.encryption_iv IS
  'Random 96-bit IV used during encryption — required for decryption.';
