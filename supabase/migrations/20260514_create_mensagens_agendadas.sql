-- Tabela de mensagens agendadas
create table if not exists public.mensagens_agendadas (
  id            uuid        default gen_random_uuid() primary key,
  empresa_id    uuid        references public.empresas(id) on delete cascade,
  conversa_id   uuid,
  destinatario  text        not null,
  mensagem      text        not null,
  agendado_para timestamptz not null,
  status        text        not null default 'pendente'
                            check (status in ('pendente','enviado','falhou','cancelado')),
  criado_por    uuid,
  criado_em     timestamptz default now(),
  enviado_em    timestamptz,
  erro          text
);

create index if not exists idx_mensagens_agendadas_pendentes
  on public.mensagens_agendadas (empresa_id, agendado_para)
  where status = 'pendente';

alter table public.mensagens_agendadas enable row level security;

create policy "empresa acessa próprias mensagens agendadas"
  on public.mensagens_agendadas for all
  using (empresa_id = (
    select empresa_id from public.usuarios
    where id = auth.uid()
    limit 1
  ));

-- Habilita pg_cron e pg_net
create extension if not exists pg_cron  with schema extensions;
create extension if not exists pg_net   with schema extensions;

-- Cron: chama Edge Function send-scheduled a cada minuto
select cron.schedule(
  'send-scheduled-messages',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://zexjmlthyxtunioojlga.supabase.co/functions/v1/send-scheduled',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);
