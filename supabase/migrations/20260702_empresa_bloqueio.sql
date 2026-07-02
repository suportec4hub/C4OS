-- Bloqueio de acesso por inadimplência ou ação manual
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS bloqueado       boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloqueio_msg    text,        -- null = use global default
  ADD COLUMN IF NOT EXISTS bloqueado_em   timestamptz,
  ADD COLUMN IF NOT EXISTS bloqueado_por  text CHECK (bloqueado_por IN ('auto','manual'));

-- Index for fast lookup on login
CREATE INDEX IF NOT EXISTS idx_empresas_bloqueado ON empresas (bloqueado) WHERE bloqueado = true;
