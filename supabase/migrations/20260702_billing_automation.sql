-- cobranca_config: billing automation configuration per client company
CREATE TABLE IF NOT EXISTS cobranca_config (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id         uuid        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  dia_vencimento     smallint    NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 28),
  whatsapp_cobranca  text,       -- null = use empresas.telefone
  msg_2_dias_antes   text,       -- null = use default
  msg_dia_vencimento text,
  msg_5_dias_apos    text,
  msg_20_dias_apos   text,
  ativo              boolean     NOT NULL DEFAULT true,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  UNIQUE(empresa_id)
);

-- cobranca_log: prevents duplicate billing message sends
CREATE TABLE IF NOT EXISTS cobranca_log (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id      uuid        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo            text        NOT NULL CHECK (tipo IN ('2d_antes','vencimento','5d_apos','20d_apos')),
  mes_referencia  text        NOT NULL, -- format: "2026-07"
  enviado_em      timestamptz DEFAULT now(),
  status          text        DEFAULT 'enviado',
  telefone        text,
  mensagem        text
);

-- changelog: editable docs changelog (replaces hardcoded JSX array)
CREATE TABLE IF NOT EXISTS changelog (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  version     text        NOT NULL,
  date_label  text        NOT NULL,
  type        text        NOT NULL,
  type_color  text        NOT NULL DEFAULT '#1d4ed8',
  type_bg     text        NOT NULL DEFAULT '#eff6ff',
  items       jsonb       NOT NULL DEFAULT '[]',
  sort_order  int         DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE cobranca_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobranca_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE changelog       ENABLE ROW LEVEL SECURITY;

-- cobranca_config: only c4hub team can manage
CREATE POLICY "c4hub_cobranca_config" ON cobranca_config FOR ALL
  USING (EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND role IN ('c4hub_admin','c4hub_vendedor')
  ));

-- cobranca_log: only c4hub team can read/write
CREATE POLICY "c4hub_cobranca_log" ON cobranca_log FOR ALL
  USING (EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND role IN ('c4hub_admin','c4hub_vendedor')
  ));

-- changelog: anyone can read, only c4hub_admin can write
CREATE POLICY "public_read_changelog" ON changelog FOR SELECT USING (true);
CREATE POLICY "c4hub_admin_write_changelog" ON changelog FOR ALL
  USING (EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'c4hub_admin'
  ));

-- pg_cron: daily billing reminders at 8am BRT (11am UTC)
SELECT cron.schedule(
  'send-cobranca-diario',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://zexjmlthyxtunioojlga.supabase.co/functions/v1/send-cobranca',
    headers := '{"Content-Type":"application/json","x-cron-token":"c4os-cron-2025"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Seed changelog from existing hardcoded entries + new v2.4.0
INSERT INTO changelog (version, date_label, type, type_color, type_bg, items, sort_order) VALUES
('v2.4.0', 'Jul 2026', 'Novidade', '#1d4ed8', '#eff6ff',
  '["Cobrança automatizada: mensagens WhatsApp 2 dias antes do vencimento, no dia, 5 e 20 dias após","Configuração de mensagens por cliente com fallback para mensagens padrão","Dia de vencimento e WhatsApp de cobrança configuráveis por cliente","Changelog editável para Admin C4HUB diretamente no /C4DOCS","Correção: isolamento de fluxo por vendedor no chatbot (chatbot-engine v8)"]'::jsonb,
  0),
('v2.3.0', 'Abr 2025', 'Novidade', '#1d4ed8', '#eff6ff',
  '["Logs de WhatsApp e sistema na tela de Suporte (por empresa)","Auditoria completa de eventos: webhook, bot, conexão e erros de API","Novo helper logWA() em todos os Edge Functions"]'::jsonb,
  1),
('v2.2.1', 'Abr 2025', 'Correção', '#b45309', '#fff7ed',
  '["Corrigido bug onde mini-card Últimas Atividades ficava vazio na overview","SID de sessão parou de recomputar a cada re-render","Políticas RLS de INSERT com WITH CHECK adicionadas em conversas, mensagens e leads"]'::jsonb,
  2),
('v2.2.0', 'Mar 2025', 'Melhoria', '#15803d', '#dcfce7',
  '["9 novos índices de performance no banco de dados (carregamento 40% mais rápido)","Índices parciais para a fila de mensagens agendadas (WHERE status=pendente)","RLS de logs_whatsapp restrito por empresa_id"]'::jsonb,
  3),
('v2.1.0', 'Fev 2025', 'Novidade', '#1d4ed8', '#eff6ff',
  '["Módulo de Disparos em massa com personalização por variáveis","Agendamento de mensagens com fuso horário configurável","Relatório de entrega em tempo real (enviado / entregue / lido / respondido)"]'::jsonb,
  4),
('v2.0.0', 'Jan 2025', 'Novidade', '#1d4ed8', '#eff6ff',
  '["Chatbot Builder visual com arrastar e soltar (fluxos ilimitados)","Nós de condição, pergunta, transferência e tag","Ativação de fluxos por palavra-chave ou horário","Pipeline Kanban com etapas personalizáveis e valor por deal"]'::jsonb,
  5),
('v1.5.0', 'Dez 2024', 'Melhoria', '#15803d', '#dcfce7',
  '["Follow-up automático com sequências configuráveis por canal","Lead scoring baseado em comportamento de resposta","Importação de leads via CSV com relatório de validação"]'::jsonb,
  6),
('v1.0.0', 'Out 2024', 'Lançamento', '#7e22ce', '#faf5ff',
  '["Lançamento oficial do C4 OS","Integração com WhatsApp Business (QR Code e API oficial)","CRM básico com gestão de contatos e conversas","Dashboard com métricas de atendimento em tempo real","Módulo de equipe com perfis e setores"]'::jsonb,
  7);
