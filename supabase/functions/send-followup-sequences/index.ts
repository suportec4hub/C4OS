import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPA_URL       = Deno.env.get("SUPABASE_URL")!;
const SUPA_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GLOBAL_EVO_URL = "https://evolution-evolution-api.ng5obv.easypanel.host";
const CRON_TOKEN     = "c4os-cron-2025";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  });

function substituirVariaveis(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

Deno.serve(async (req) => {
  const cronToken = req.headers.get("x-cron-token");
  const authHeader = req.headers.get("authorization") || "";
  const isAuthenticated = cronToken === CRON_TOKEN || authHeader.startsWith("Bearer ");
  if (!isAuthenticated) return new Response("Unauthorized", { status: 401 });

  const db = createClient(SUPA_URL, SUPA_KEY);
  const now = new Date().toISOString();

  // 1. Busca execuções pendentes cujo proximo_envio já venceu
  const { data: execucoes, error: fetchErr } = await db
    .from("followup_execucoes")
    .select(`
      id, sequencia_id, lead_id, conversa_id, empresa_id, passo_atual,
      followup_sequencias!sequencia_id ( nome, horas_espera )
    `)
    .eq("status", "ativo")
    .lte("proximo_envio", now)
    .limit(30);

  if (fetchErr) return json({ error: fetchErr.message }, 500);

  let sent = 0, failed = 0, finished = 0;

  for (const exec of (execucoes || [])) {
    // Lock atômico
    const { data: locked } = await db
      .from("followup_execucoes")
      .update({ status: "processando" })
      .eq("id", exec.id)
      .eq("status", "ativo")
      .select("id");

    if (!locked?.length) continue;

    // 2. Busca próximo passo
    const { data: passo } = await db
      .from("followup_passos")
      .select("id, ordem, delay_horas, mensagem")
      .eq("sequencia_id", exec.sequencia_id)
      .eq("ordem", exec.passo_atual)
      .eq("ativo", true)
      .single();

    if (!passo) {
      // Sem mais passos — conclui a execução
      await db.from("followup_execucoes").update({
        status: "concluido",
        concluido_em: now,
      }).eq("id", exec.id);
      finished++;
      continue;
    }

    // 3. Busca dados do lead/conversa para substituir variáveis
    let leadNome = "";
    let leadTelefone = "";
    let empresaNome = "";

    if (exec.conversa_id) {
      const { data: conv } = await db
        .from("conversas")
        .select("contato_nome, telefone, empresas!empresa_id ( nome )")
        .eq("id", exec.conversa_id)
        .single();

      if (conv) {
        leadNome = conv.contato_nome || "";
        leadTelefone = conv.telefone || "";
        empresaNome = (conv.empresas as { nome: string } | null)?.nome || "";
      }
    }

    const mensagem = substituirVariaveis(passo.mensagem, {
      nome: leadNome,
      telefone: leadTelefone,
      empresa: empresaNome,
    });

    // 4. Busca credenciais da empresa
    const { data: emp } = await db
      .from("empresas")
      .select("evolution_instance_id, evolution_instance_token, evolution_api_url")
      .eq("id", exec.empresa_id)
      .single();

    if (!emp?.evolution_instance_id || !emp?.evolution_instance_token) {
      await db.from("followup_execucoes").update({ status: "ativo" }).eq("id", exec.id);
      failed++;
      continue;
    }

    // 5. Busca telefone do destinatário
    let destPhone = leadTelefone;
    if (!destPhone && exec.conversa_id) {
      const { data: conv } = await db
        .from("conversas")
        .select("telefone")
        .eq("id", exec.conversa_id)
        .single();
      destPhone = conv?.telefone || "";
    }

    if (!destPhone) {
      await db.from("followup_execucoes").update({ status: "ativo" }).eq("id", exec.id);
      failed++;
      continue;
    }

    const evoUrl   = (emp.evolution_api_url?.trim() || GLOBAL_EVO_URL).replace(/\/$/, "");
    const instName = emp.evolution_instance_id as string;
    const instToken = emp.evolution_instance_token as string;
    const phone    = destPhone.replace(/\D/g, "");

    // 6. Envia mensagem via Evolution API
    let ok = false;
    try {
      const r = await fetch(`${evoUrl}/message/sendText/${instName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": instToken },
        body: JSON.stringify({ number: phone, text: mensagem }),
      });
      if (r.ok) ok = true;
    } catch (_) { /* ignora */ }

    if (!ok) {
      try {
        const r2 = await fetch(`${evoUrl}/message/sendText/${instName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": instToken },
          body: JSON.stringify({
            number: phone,
            options: { delay: 1200, presence: "composing", linkPreview: false },
            textMessage: { text: mensagem },
          }),
        });
        if (r2.ok) ok = true;
      } catch (_) { /* ignora */ }
    }

    if (!ok) {
      await db.from("followup_execucoes").update({ status: "ativo" }).eq("id", exec.id);
      failed++;
      continue;
    }

    // 7. Registra mensagem no histórico da conversa
    if (exec.conversa_id) {
      const sentAt = new Date().toISOString();
      await db.from("mensagens").insert({
        conversa_id: exec.conversa_id,
        empresa_id:  exec.empresa_id,
        de:          "me",
        remetente:   "followup",
        texto:       mensagem,
        tipo:        "texto",
        hora:        sentAt,
        status:      "enviado",
      });
      await db.from("conversas").update({
        ultima_mensagem: mensagem,
        ultima_hora:     sentAt,
      }).eq("id", exec.conversa_id);
    }

    // 8. Avança para o próximo passo
    const { data: proximoPasso } = await db
      .from("followup_passos")
      .select("ordem, delay_horas")
      .eq("sequencia_id", exec.sequencia_id)
      .gt("ordem", passo.ordem)
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .limit(1)
      .single();

    if (proximoPasso) {
      const proximoEnvio = new Date(Date.now() + proximoPasso.delay_horas * 3_600_000).toISOString();
      await db.from("followup_execucoes").update({
        status:       "ativo",
        passo_atual:  proximoPasso.ordem,
        proximo_envio: proximoEnvio,
      }).eq("id", exec.id);
    } else {
      await db.from("followup_execucoes").update({
        status:       "concluido",
        concluido_em: new Date().toISOString(),
      }).eq("id", exec.id);
      finished++;
    }

    sent++;
  }

  console.log(`[send-followup-sequences] sent=${sent} failed=${failed} finished=${finished}`);
  return json({ sent, failed, finished });
});
