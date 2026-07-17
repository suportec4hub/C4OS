-- Fix auth_rls_initplan: wrap auth.uid()/auth.role() in (select ...) to prevent
-- per-row re-evaluation. Eliminates full-table scans and reduces disk IO significantly.
-- Fixes 82 policies across 40+ tables flagged by Supabase Performance Linter.

-- ─── logs_auditoria ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "logs_insert" ON public.logs_auditoria;
CREATE POLICY "logs_insert" ON public.logs_auditoria FOR INSERT
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ─── leads ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "leads_select" ON public.leads;
CREATE POLICY "leads_select" ON public.leads FOR SELECT
  USING (
    (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
  );

DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads FOR INSERT
  WITH CHECK (
    (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
  );

DROP POLICY IF EXISTS "leads_update" ON public.leads;
CREATE POLICY "leads_update" ON public.leads FOR UPDATE
  USING (
    (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
  );

DROP POLICY IF EXISTS "leads_delete" ON public.leads;
CREATE POLICY "leads_delete" ON public.leads FOR DELETE
  USING (
    (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
  );

-- ─── deals ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deals_select" ON public.deals;
CREATE POLICY "deals_select" ON public.deals FOR SELECT
  USING (
    (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
  );

DROP POLICY IF EXISTS "deals_insert" ON public.deals;
CREATE POLICY "deals_insert" ON public.deals FOR INSERT
  WITH CHECK (
    (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
  );

DROP POLICY IF EXISTS "deals_update" ON public.deals;
CREATE POLICY "deals_update" ON public.deals FOR UPDATE
  USING (
    (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
  );

DROP POLICY IF EXISTS "deals_delete" ON public.deals;
CREATE POLICY "deals_delete" ON public.deals FOR DELETE
  USING (
    (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
  );

-- ─── usuarios ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "usuarios_update" ON public.usuarios;
CREATE POLICY "usuarios_update" ON public.usuarios FOR UPDATE
  USING (
    (id = (select auth.uid()))
    OR (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = (select auth.uid()) AND u.role = ANY (ARRAY['c4hub_admin','client_admin'])))
  );

DROP POLICY IF EXISTS "usuario_update_own_password_flag" ON public.usuarios;
CREATE POLICY "usuario_update_own_password_flag" ON public.usuarios FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- ─── empresas ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "empresas_insert" ON public.empresas;
CREATE POLICY "empresas_insert" ON public.empresas FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'));

DROP POLICY IF EXISTS "empresas_update" ON public.empresas;
CREATE POLICY "empresas_update" ON public.empresas FOR UPDATE
  USING (
    (id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = ANY (ARRAY['c4hub_admin','client_admin'])))
    OR (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
  );

-- ─── planos ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "planos_update" ON public.planos;
CREATE POLICY "planos_update" ON public.planos FOR UPDATE
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'));

-- ─── campanhas ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "campanhas_select" ON public.campanhas;
CREATE POLICY "campanhas_select" ON public.campanhas FOR SELECT
  USING (
    (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
  );

DROP POLICY IF EXISTS "campanhas_insert" ON public.campanhas;
CREATE POLICY "campanhas_insert" ON public.campanhas FOR INSERT
  WITH CHECK (
    (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
  );

DROP POLICY IF EXISTS "campanhas_update" ON public.campanhas;
CREATE POLICY "campanhas_update" ON public.campanhas FOR UPDATE
  USING (
    (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
  );

-- ─── follow_ups ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "followups_select" ON public.follow_ups;
CREATE POLICY "followups_select" ON public.follow_ups FOR SELECT
  USING (
    (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
  );

DROP POLICY IF EXISTS "followups_insert" ON public.follow_ups;
CREATE POLICY "followups_insert" ON public.follow_ups FOR INSERT
  WITH CHECK (
    (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
  );

DROP POLICY IF EXISTS "followups_update" ON public.follow_ups;
CREATE POLICY "followups_update" ON public.follow_ups FOR UPDATE
  USING (
    (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
  );

-- ─── departamentos ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "empresa_rls_deps" ON public.departamentos;
CREATE POLICY "empresa_rls_deps" ON public.departamentos FOR ALL
  USING (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

DROP POLICY IF EXISTS "insert_deps" ON public.departamentos;
CREATE POLICY "insert_deps" ON public.departamentos FOR INSERT
  WITH CHECK (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

DROP POLICY IF EXISTS "update_deps" ON public.departamentos;
CREATE POLICY "update_deps" ON public.departamentos FOR UPDATE
  USING (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

DROP POLICY IF EXISTS "delete_deps" ON public.departamentos;
CREATE POLICY "delete_deps" ON public.departamentos FOR DELETE
  USING (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

-- ─── setor_usuarios ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "setor_usuarios_empresa" ON public.setor_usuarios;
CREATE POLICY "setor_usuarios_empresa" ON public.setor_usuarios FOR ALL
  USING (setor_id IN (
    SELECT setores.id FROM setores
    WHERE setores.empresa_id IN (
      SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())
    )
  ));

-- ─── etiquetas ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "etiquetas_empresa" ON public.etiquetas;
CREATE POLICY "etiquetas_empresa" ON public.etiquetas FOR ALL
  USING (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

-- ─── conversa_etiquetas ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "conversa_etiquetas_empresa" ON public.conversa_etiquetas;
CREATE POLICY "conversa_etiquetas_empresa" ON public.conversa_etiquetas FOR ALL
  USING (conversa_id IN (
    SELECT conversas.id FROM conversas
    WHERE conversas.empresa_id IN (
      SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())
    )
  ));

-- ─── chatbot_fluxos ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chatbot_fluxos_empresa" ON public.chatbot_fluxos;
CREATE POLICY "chatbot_fluxos_empresa" ON public.chatbot_fluxos FOR ALL
  USING (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

-- ─── mensagens_agendadas ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "msg_agendadas_empresa" ON public.mensagens_agendadas;
CREATE POLICY "msg_agendadas_empresa" ON public.mensagens_agendadas FOR ALL
  USING (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

DROP POLICY IF EXISTS "empresa acessa próprias mensagens agendadas" ON public.mensagens_agendadas;
CREATE POLICY "empresa acessa próprias mensagens agendadas" ON public.mensagens_agendadas FOR ALL
  USING (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid()) LIMIT 1));

-- ─── transmissao_contatos ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "transmissao_contatos_empresa" ON public.transmissao_contatos;
CREATE POLICY "transmissao_contatos_empresa" ON public.transmissao_contatos FOR ALL
  USING (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

-- ─── fila_espera ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fila_espera_empresa" ON public.fila_espera;
CREATE POLICY "fila_espera_empresa" ON public.fila_espera FOR ALL
  USING (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

-- ─── logs_atendimento ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "logs_atendimento_empresa" ON public.logs_atendimento;
CREATE POLICY "logs_atendimento_empresa" ON public.logs_atendimento FOR ALL
  USING (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

-- ─── metricas_atendimento ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "metricas_empresa" ON public.metricas_atendimento;
CREATE POLICY "metricas_empresa" ON public.metricas_atendimento FOR ALL
  USING (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

-- ─── webhooks_saida ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "webhooks_saida_empresa" ON public.webhooks_saida;
CREATE POLICY "webhooks_saida_empresa" ON public.webhooks_saida FOR ALL
  USING (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

-- ─── workspace_reactions ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reactions_insert" ON public.workspace_reactions;
CREATE POLICY "reactions_insert" ON public.workspace_reactions FOR INSERT
  WITH CHECK ((select auth.uid()) = usuario_id);

DROP POLICY IF EXISTS "reactions_delete" ON public.workspace_reactions;
CREATE POLICY "reactions_delete" ON public.workspace_reactions FOR DELETE
  USING ((select auth.uid()) = usuario_id);

-- ─── workspace_canal_reads ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reads_all" ON public.workspace_canal_reads;
CREATE POLICY "reads_all" ON public.workspace_canal_reads FOR ALL
  USING ((select auth.uid()) = usuario_id);

-- ─── notificacoes ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notificacoes_select" ON public.notificacoes;
CREATE POLICY "notificacoes_select" ON public.notificacoes FOR SELECT
  USING ((usuario_id = (select auth.uid())) OR is_c4hub_admin());

DROP POLICY IF EXISTS "notificacoes_update" ON public.notificacoes;
CREATE POLICY "notificacoes_update" ON public.notificacoes FOR UPDATE
  USING ((usuario_id = (select auth.uid())) OR is_c4hub_admin());

-- ─── pipeline_etapas ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Empresa ve suas etapas" ON public.pipeline_etapas;
CREATE POLICY "Empresa ve suas etapas" ON public.pipeline_etapas FOR ALL
  USING (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

-- ─── metas ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "metas_empresa" ON public.metas;
CREATE POLICY "metas_empresa" ON public.metas FOR ALL
  USING (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid()) LIMIT 1));

DROP POLICY IF EXISTS "metas_all" ON public.metas;
CREATE POLICY "metas_all" ON public.metas FOR ALL
  USING (
    (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR ((SELECT usuarios.role FROM usuarios WHERE usuarios.id = (select auth.uid())) = 'c4hub_admin')
  );

-- ─── meta_vendedores ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "meta_vendedores_empresa" ON public.meta_vendedores;
CREATE POLICY "meta_vendedores_empresa" ON public.meta_vendedores FOR ALL
  USING (meta_id IN (
    SELECT metas.id FROM metas
    WHERE metas.empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid()) LIMIT 1)
  ));

-- ─── agencias_filiadas ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "agencias_empresa" ON public.agencias_filiadas;
CREATE POLICY "agencias_empresa" ON public.agencias_filiadas FOR ALL
  USING (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid()) LIMIT 1));

-- ─── meta_agencias ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "meta_agencias_empresa" ON public.meta_agencias;
CREATE POLICY "meta_agencias_empresa" ON public.meta_agencias FOR ALL
  USING (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid()) LIMIT 1));

-- ─── meta_agencia_vendedores ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "meta_ag_vend_empresa" ON public.meta_agencia_vendedores;
CREATE POLICY "meta_ag_vend_empresa" ON public.meta_agencia_vendedores FOR ALL
  USING (agencia_id IN (
    SELECT agencias_filiadas.id FROM agencias_filiadas
    WHERE agencias_filiadas.empresa_id = (
      SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid()) LIMIT 1
    )
  ));

-- ─── metas_vendedores ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "metas_vend_all" ON public.metas_vendedores;
CREATE POLICY "metas_vend_all" ON public.metas_vendedores FOR ALL
  USING (
    (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR ((SELECT usuarios.role FROM usuarios WHERE usuarios.id = (select auth.uid())) = 'c4hub_admin')
  );

-- ─── vendas_realizadas ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vendas_all" ON public.vendas_realizadas;
CREATE POLICY "vendas_all" ON public.vendas_realizadas FOR ALL
  USING (
    (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())))
    OR ((SELECT usuarios.role FROM usuarios WHERE usuarios.id = (select auth.uid())) = 'c4hub_admin')
  );

-- ─── followup_sequencias ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "followup_seq_empresa" ON public.followup_sequencias;
CREATE POLICY "followup_seq_empresa" ON public.followup_sequencias FOR ALL
  USING (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

-- ─── followup_passos ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "followup_passos_empresa" ON public.followup_passos;
CREATE POLICY "followup_passos_empresa" ON public.followup_passos FOR ALL
  USING (sequencia_id IN (
    SELECT followup_sequencias.id FROM followup_sequencias
    WHERE followup_sequencias.empresa_id IN (
      SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())
    )
  ));

-- ─── followup_execucoes ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "followup_exec_empresa" ON public.followup_execucoes;
CREATE POLICY "followup_exec_empresa" ON public.followup_execucoes FOR ALL
  USING (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

-- ─── fluxos_vendedor ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "empresa_fluxos" ON public.fluxos_vendedor;
CREATE POLICY "empresa_fluxos" ON public.fluxos_vendedor FOR ALL
  USING (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

DROP POLICY IF EXISTS "empresa_fluxos_insert" ON public.fluxos_vendedor;
CREATE POLICY "empresa_fluxos_insert" ON public.fluxos_vendedor FOR INSERT
  WITH CHECK (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

DROP POLICY IF EXISTS "empresa_fluxos_update" ON public.fluxos_vendedor;
CREATE POLICY "empresa_fluxos_update" ON public.fluxos_vendedor FOR UPDATE
  USING (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

DROP POLICY IF EXISTS "empresa_fluxos_delete" ON public.fluxos_vendedor;
CREATE POLICY "empresa_fluxos_delete" ON public.fluxos_vendedor FOR DELETE
  USING (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

-- ─── fluxos_passos ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "empresa_fluxos_passos" ON public.fluxos_passos;
CREATE POLICY "empresa_fluxos_passos" ON public.fluxos_passos FOR ALL
  USING (fluxo_id IN (
    SELECT fluxos_vendedor.id FROM fluxos_vendedor
    WHERE fluxos_vendedor.empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "empresa_fluxos_passos_insert" ON public.fluxos_passos;
CREATE POLICY "empresa_fluxos_passos_insert" ON public.fluxos_passos FOR INSERT
  WITH CHECK (fluxo_id IN (
    SELECT fluxos_vendedor.id FROM fluxos_vendedor
    WHERE fluxos_vendedor.empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "empresa_fluxos_passos_update" ON public.fluxos_passos;
CREATE POLICY "empresa_fluxos_passos_update" ON public.fluxos_passos FOR UPDATE
  USING (fluxo_id IN (
    SELECT fluxos_vendedor.id FROM fluxos_vendedor
    WHERE fluxos_vendedor.empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "empresa_fluxos_passos_delete" ON public.fluxos_passos;
CREATE POLICY "empresa_fluxos_passos_delete" ON public.fluxos_passos FOR DELETE
  USING (fluxo_id IN (
    SELECT fluxos_vendedor.id FROM fluxos_vendedor
    WHERE fluxos_vendedor.empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid()))
  ));

-- ─── distribuicao_atendimento ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "distribuicao_empresa_select" ON public.distribuicao_atendimento;
CREATE POLICY "distribuicao_empresa_select" ON public.distribuicao_atendimento FOR SELECT
  USING (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

DROP POLICY IF EXISTS "distribuicao_empresa_insert" ON public.distribuicao_atendimento;
CREATE POLICY "distribuicao_empresa_insert" ON public.distribuicao_atendimento FOR INSERT
  WITH CHECK (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

DROP POLICY IF EXISTS "distribuicao_empresa_update" ON public.distribuicao_atendimento;
CREATE POLICY "distribuicao_empresa_update" ON public.distribuicao_atendimento FOR UPDATE
  USING (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

DROP POLICY IF EXISTS "distribuicao_empresa_delete" ON public.distribuicao_atendimento;
CREATE POLICY "distribuicao_empresa_delete" ON public.distribuicao_atendimento FOR DELETE
  USING (empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

DROP POLICY IF EXISTS "distribuicao_service_role" ON public.distribuicao_atendimento;
CREATE POLICY "distribuicao_service_role" ON public.distribuicao_atendimento FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ─── notificacoes_sistema ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notif_sistema_select" ON public.notificacoes_sistema;
CREATE POLICY "notif_sistema_select" ON public.notificacoes_sistema FOR SELECT
  USING (
    (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'))
    OR (
      ativo = true
      AND (expires_at IS NULL OR expires_at > now())
      AND (empresa_id IS NULL OR empresa_id = (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid()) LIMIT 1))
    )
  );

DROP POLICY IF EXISTS "notif_sistema_insert" ON public.notificacoes_sistema;
CREATE POLICY "notif_sistema_insert" ON public.notificacoes_sistema FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'));

DROP POLICY IF EXISTS "notif_sistema_update" ON public.notificacoes_sistema;
CREATE POLICY "notif_sistema_update" ON public.notificacoes_sistema FOR UPDATE
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'));

DROP POLICY IF EXISTS "notif_sistema_delete" ON public.notificacoes_sistema;
CREATE POLICY "notif_sistema_delete" ON public.notificacoes_sistema FOR DELETE
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'));

-- ─── empresa_instancias ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "empresa_instancias_select" ON public.empresa_instancias;
CREATE POLICY "empresa_instancias_select" ON public.empresa_instancias FOR SELECT
  USING (empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = (select auth.uid())));

DROP POLICY IF EXISTS "empresa_instancias_all_service" ON public.empresa_instancias;
CREATE POLICY "empresa_instancias_all_service" ON public.empresa_instancias FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ─── cobranca_config ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "c4hub_cobranca_config" ON public.cobranca_config;
CREATE POLICY "c4hub_cobranca_config" ON public.cobranca_config FOR ALL
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = ANY (ARRAY['c4hub_admin','c4hub_vendedor'])));

-- ─── cobranca_log ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "c4hub_cobranca_log" ON public.cobranca_log;
CREATE POLICY "c4hub_cobranca_log" ON public.cobranca_log FOR ALL
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = ANY (ARRAY['c4hub_admin','c4hub_vendedor'])));

-- ─── changelog ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "c4hub_admin_write_changelog" ON public.changelog;
CREATE POLICY "c4hub_admin_write_changelog" ON public.changelog FOR ALL
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'));

-- ─── checkout_config ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "checkout_config_write" ON public.checkout_config;
CREATE POLICY "checkout_config_write" ON public.checkout_config FOR ALL
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = (select auth.uid()) AND usuarios.role = 'c4hub_admin'));

-- ─── meta_contas ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "c4hub_meta_contas" ON public.meta_contas;
CREATE POLICY "c4hub_meta_contas" ON public.meta_contas FOR ALL
  USING (EXISTS (
    SELECT 1 FROM usuarios u JOIN empresas e ON u.empresa_id = e.id
    WHERE u.id = (select auth.uid()) AND e.is_c4hub = true
  ));

-- ─── meta_campanhas ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "c4hub_meta_campanhas" ON public.meta_campanhas;
CREATE POLICY "c4hub_meta_campanhas" ON public.meta_campanhas FOR ALL
  USING (EXISTS (
    SELECT 1 FROM usuarios u JOIN empresas e ON u.empresa_id = e.id
    WHERE u.id = (select auth.uid()) AND e.is_c4hub = true
  ));

-- ─── meta_adsets ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "c4hub_meta_adsets" ON public.meta_adsets;
CREATE POLICY "c4hub_meta_adsets" ON public.meta_adsets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM usuarios u JOIN empresas e ON u.empresa_id = e.id
    WHERE u.id = (select auth.uid()) AND e.is_c4hub = true
  ));

-- ─── meta_anuncios ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "c4hub_meta_anuncios" ON public.meta_anuncios;
CREATE POLICY "c4hub_meta_anuncios" ON public.meta_anuncios FOR ALL
  USING (EXISTS (
    SELECT 1 FROM usuarios u JOIN empresas e ON u.empresa_id = e.id
    WHERE u.id = (select auth.uid()) AND e.is_c4hub = true
  ));

-- ─── meta_insights ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "c4hub_meta_insights" ON public.meta_insights;
CREATE POLICY "c4hub_meta_insights" ON public.meta_insights FOR ALL
  USING (EXISTS (
    SELECT 1 FROM usuarios u JOIN empresas e ON u.empresa_id = e.id
    WHERE u.id = (select auth.uid()) AND e.is_c4hub = true
  ));

-- ─── meta_leads ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "c4hub_meta_leads" ON public.meta_leads;
CREATE POLICY "c4hub_meta_leads" ON public.meta_leads FOR ALL
  USING (EXISTS (
    SELECT 1 FROM usuarios u JOIN empresas e ON u.empresa_id = e.id
    WHERE u.id = (select auth.uid()) AND e.is_c4hub = true
  ));
