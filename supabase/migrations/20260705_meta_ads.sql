-- Meta Ads Integration
-- Contas de anúncio conectadas
CREATE TABLE IF NOT EXISTS meta_contas (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  label            text        NOT NULL,
  ad_account_id    text        NOT NULL UNIQUE,
  account_name     text,
  access_token     text        NOT NULL,
  token_expires_at timestamptz,
  currency         text        DEFAULT 'BRL',
  timezone_name    text        DEFAULT 'America/Sao_Paulo',
  status           text        NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','pausada','erro')),
  last_synced_at   timestamptz,
  sync_error       text,
  created_at       timestamptz DEFAULT now()
);

-- Campanhas
CREATE TABLE IF NOT EXISTS meta_campanhas (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_conta_id    uuid        NOT NULL REFERENCES meta_contas(id) ON DELETE CASCADE,
  campaign_id      text        NOT NULL UNIQUE,
  nome             text,
  objetivo         text,
  status           text,
  orcamento_diario numeric,
  orcamento_total  numeric,
  data_inicio      date,
  data_fim         date,
  synced_at        timestamptz DEFAULT now()
);

-- Conjuntos de anúncio (Ad Sets)
CREATE TABLE IF NOT EXISTS meta_adsets (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id      uuid        NOT NULL REFERENCES meta_campanhas(id) ON DELETE CASCADE,
  adset_id         text        NOT NULL UNIQUE,
  nome             text,
  status           text,
  orcamento_diario numeric,
  data_inicio      date,
  data_fim         date,
  synced_at        timestamptz DEFAULT now()
);

-- Anúncios individuais
CREATE TABLE IF NOT EXISTS meta_anuncios (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  adset_id         uuid        NOT NULL REFERENCES meta_adsets(id) ON DELETE CASCADE,
  ad_id            text        NOT NULL UNIQUE,
  nome             text,
  status           text,
  thumbnail_url    text,
  is_video         boolean     DEFAULT false,
  synced_at        timestamptz DEFAULT now()
);

-- Insights diários — ad_id='' significa nível campanha
CREATE TABLE IF NOT EXISTS meta_insights (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_conta_id   uuid        NOT NULL REFERENCES meta_contas(id) ON DELETE CASCADE,
  campaign_id     text        NOT NULL,
  ad_id           text        NOT NULL DEFAULT '',
  data            date        NOT NULL,
  impressoes      bigint      DEFAULT 0,
  alcance         bigint      DEFAULT 0,
  cliques         bigint      DEFAULT 0,
  gasto           numeric     DEFAULT 0,
  leads           int         DEFAULT 0,
  video_plays     bigint      DEFAULT 0,
  video_p25       bigint      DEFAULT 0,
  video_p50       bigint      DEFAULT 0,
  video_p75       bigint      DEFAULT 0,
  video_p100      bigint      DEFAULT 0,
  thruplays       bigint      DEFAULT 0,
  UNIQUE(meta_conta_id, campaign_id, ad_id, data)
);

-- Leads capturados de formulários Meta
CREATE TABLE IF NOT EXISTS meta_leads (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_conta_id   uuid        NOT NULL REFERENCES meta_contas(id) ON DELETE CASCADE,
  lead_id         text        NOT NULL UNIQUE,
  form_id         text,
  ad_id           text,
  campaign_id     text,
  nome            text,
  email           text,
  telefone        text,
  campos          jsonb,
  importado_crm   boolean     DEFAULT false,
  criado_em       timestamptz,
  synced_at       timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meta_campanhas_conta    ON meta_campanhas(meta_conta_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_campanha    ON meta_adsets(campanha_id);
CREATE INDEX IF NOT EXISTS idx_meta_anuncios_adset     ON meta_anuncios(adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_insights_conta_data ON meta_insights(meta_conta_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_meta_insights_campaign  ON meta_insights(campaign_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_meta_leads_conta        ON meta_leads(meta_conta_id);
CREATE INDEX IF NOT EXISTS idx_meta_leads_nao_importados ON meta_leads(importado_crm) WHERE importado_crm = false;

-- RLS — apenas equipe C4HUB
ALTER TABLE meta_contas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_adsets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_anuncios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_insights  ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_leads     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "c4hub_meta_contas"    ON meta_contas    USING (EXISTS (SELECT 1 FROM usuarios u JOIN empresas e ON u.empresa_id=e.id WHERE u.id=auth.uid() AND e.is_c4hub=true));
CREATE POLICY "c4hub_meta_campanhas" ON meta_campanhas USING (EXISTS (SELECT 1 FROM usuarios u JOIN empresas e ON u.empresa_id=e.id WHERE u.id=auth.uid() AND e.is_c4hub=true));
CREATE POLICY "c4hub_meta_adsets"    ON meta_adsets    USING (EXISTS (SELECT 1 FROM usuarios u JOIN empresas e ON u.empresa_id=e.id WHERE u.id=auth.uid() AND e.is_c4hub=true));
CREATE POLICY "c4hub_meta_anuncios"  ON meta_anuncios  USING (EXISTS (SELECT 1 FROM usuarios u JOIN empresas e ON u.empresa_id=e.id WHERE u.id=auth.uid() AND e.is_c4hub=true));
CREATE POLICY "c4hub_meta_insights"  ON meta_insights  USING (EXISTS (SELECT 1 FROM usuarios u JOIN empresas e ON u.empresa_id=e.id WHERE u.id=auth.uid() AND e.is_c4hub=true));
CREATE POLICY "c4hub_meta_leads"     ON meta_leads     USING (EXISTS (SELECT 1 FROM usuarios u JOIN empresas e ON u.empresa_id=e.id WHERE u.id=auth.uid() AND e.is_c4hub=true));

-- Cron diário às 15h UTC (12h BRT)
SELECT cron.schedule(
  'meta-sync-diario',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://zexjmlthyxtunioojlga.supabase.co/functions/v1/meta-sync',
    headers := '{"Content-Type":"application/json","x-cron-token":"c4os-cron-2025"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);
