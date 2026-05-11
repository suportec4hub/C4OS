ALTER TABLE chatbot_config
  ADD COLUMN IF NOT EXISTS responder_grupos     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nao_responder_aberta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS desativar_assinatura boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS simular_digitando    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nao_responder_se_crm boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS responder_apenas_crm boolean NOT NULL DEFAULT false;
