-- Tabela de instâncias WhatsApp adicionais por empresa (multi-número)
-- A instância principal permanece na tabela empresas; instâncias secundárias ficam aqui.
CREATE TABLE IF NOT EXISTS empresa_instancias (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id               uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome                     text NOT NULL,
  evolution_instance_id    text,
  evolution_instance_token text,
  evolution_api_url        text,
  eh_principal             boolean NOT NULL DEFAULT false,
  ativo                    boolean NOT NULL DEFAULT true,
  evolution_connected      boolean NOT NULL DEFAULT false,
  evolution_phone          text,
  evolution_qr_temp        text,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empresa_instancias_empresa  ON empresa_instancias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresa_instancias_token    ON empresa_instancias(evolution_instance_token) WHERE evolution_instance_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_empresa_instancias_inst_id  ON empresa_instancias(evolution_instance_id)    WHERE evolution_instance_id    IS NOT NULL;

ALTER TABLE empresa_instancias ENABLE ROW LEVEL SECURITY;

-- Usuários da empresa podem ver suas próprias instâncias
CREATE POLICY "empresa_instancias_select" ON empresa_instancias
  FOR SELECT USING (
    empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  );

-- Apenas o service_role pode inserir/atualizar/deletar (via edge functions)
CREATE POLICY "empresa_instancias_all_service" ON empresa_instancias
  FOR ALL USING (auth.role() = 'service_role');
