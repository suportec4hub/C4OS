-- Consolidação das conversas duplicadas por @lid e trava contra reincidência.
--
-- Contexto: um chat de grupo endereçado por @lid fazia o webhook carimbar o
-- @lid do grupo em cada participante, porque o vínculo se apoiava em
-- key.participant. Uma empresa ficou com 28 telefones apontando para o mesmo
-- @lid, e o recibo de leitura de cada um ia para a conversa errada.
-- A causa está corrigida em evolution-webhook; aqui fica o efeito.

create table if not exists conversas_merge_backup (
  id uuid primary key default uuid_generate_v4(),
  executado_em timestamptz not null default now(),
  motivo text not null,
  conversa_origem_id uuid,
  conversa_destino_id uuid,
  origem_snapshot jsonb,
  mensagens_movidas int
);

create table if not exists conversas_lid_backup (
  id uuid primary key default uuid_generate_v4(),
  executado_em timestamptz not null default now(),
  conversa_id uuid,
  contato_lid_antigo text
);

-- Um @lid só pode pertencer a uma conversa dentro da empresa. Sem isso o
-- mapeamento errado volta em silêncio, e o sintoma (recibo no contato errado)
-- é difícil de perceber.
create unique index if not exists conversas_empresa_lid_unico
  on conversas (empresa_id, contato_lid)
  where contato_lid is not null;
