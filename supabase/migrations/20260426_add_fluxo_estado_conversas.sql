-- Adiciona coluna fluxo_estado na tabela conversas
-- Armazena o estado atual da execução do fluxo visual por conversa
-- Estrutura: { fluxo_id, no_atual_id, variaveis: {}, aguardando_opcao?, aguardando_variavel? }

ALTER TABLE conversas
  ADD COLUMN IF NOT EXISTS fluxo_estado JSONB DEFAULT NULL;

COMMENT ON COLUMN conversas.fluxo_estado IS
  'Estado de execução do fluxo visual: { fluxo_id, no_atual_id, variaveis }. NULL quando não há fluxo ativo.';
