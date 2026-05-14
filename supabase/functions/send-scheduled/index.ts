import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPA_URL       = Deno.env.get("SUPABASE_URL")!;
const SUPA_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GLOBAL_EVO_URL = "https://evolution-api-xrrw.srv1583408.hstgr.cloud";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  });

async function logWA(
  db: ReturnType<typeof createClient>,
  opts: {
    empresa_id?:  string | null;
    conversa_id?: string | null;
    tipo:   string;
    nivel?: string;
    origem?: string;
    evento?: string;
    telefone?: string;
    resumo?: string;
    payload?: unknown;
  },
) {
  try {
    await db.from("logs_whatsapp").insert({
      empresa_id:  opts.empresa_id  ?? null,
      conversa_id: opts.conversa_id ?? null,
      tipo:        opts.tipo,
      nivel:       opts.nivel   ?? "info",
      origem:      opts.origem  ?? null,
      evento:      opts.evento  ?? null,
      telefone:    opts.telefone ?? null,
      resumo:      opts.resumo  ?? null,
      payload:     opts.payload  ?? null,
    });
  } catch (_) { /* nunca propaga */ }
}

Deno.serve(async (_req) => {
  const db = createClient(SUPA_URL, SUPA_KEY);

  // 1. Busca mensagens pendentes com hora já vencida
  const { data: pending, error: fetchErr } = await db
    .from("mensagens_agendadas")
    .select("id, empresa_id, conversa_id, destinatario, mensagem")
    .eq("status", "pendente")
    .lte("agendado_para", new Date().toISOString())
    .limit(20);

  if (fetchErr) return json({ error: fetchErr.message }, 500);
  if (!pending?.length) return json({ sent: 0, failed: 0 });

  let sent = 0, failed = 0;

  for (const msg of pending) {
    // 2. Lock atômico: muda para 'enviando' ANTES de enviar.
    const { data: locked } = await db
      .from("mensagens_agendadas")
      .update({ status: "enviando" })
      .eq("id", msg.id)
      .eq("status", "pendente")
      .select("id");

    if (!locked?.length) continue;

    // 3. Busca credenciais da empresa
    const { data: emp } = await db
      .from("empresas")
      .select("evolution_instance_id, evolution_instance_token, evolution_api_url")
      .eq("id", msg.empresa_id)
      .single();

    if (!emp?.evolution_instance_id || !emp?.evolution_instance_token) {
      const errMsg = "Instância Evolution não configurada";
      await db.from("mensagens_agendadas").update({
        status: "falhou",
        erro:   errMsg,
      }).eq("id", msg.id);
      await logWA(db, {
        empresa_id:  msg.empresa_id,
        conversa_id: msg.conversa_id ?? null,
        tipo:   "erro_api", nivel: "error",
        origem: "send-scheduled", evento: "config",
        telefone: String(msg.destinatario),
        resumo:  errMsg,
      });
      failed++;
      continue;
    }

    const evoUrl    = (emp.evolution_api_url?.trim() || GLOBAL_EVO_URL).replace(/\/$/, "");
    const instName  = emp.evolution_instance_id as string;
    const instToken = emp.evolution_instance_token as string;
    const phone     = String(msg.destinatario).replace(/\D/g, "");

    let ok = false;
    let lastErr = "";

    // 4a. Tentativa formato v2 básico
    try {
      const r = await fetch(`${evoUrl}/message/sendText/${instName}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "apikey": instToken },
        body:    JSON.stringify({ number: phone, text: msg.mensagem }),
      });
      if (r.ok) ok = true;
      else lastErr = await r.text().catch(() => String(r.status));
    } catch (e) { lastErr = (e as Error).message; }

    // 4b. Tentativa formato v2 com options
    if (!ok) {
      try {
        const r2 = await fetch(`${evoUrl}/message/sendText/${instName}`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", "apikey": instToken },
          body:    JSON.stringify({
            number:      phone,
            options:     { delay: 1200, presence: "composing", linkPreview: false },
            textMessage: { text: msg.mensagem },
          }),
        });
        if (r2.ok) ok = true;
        else lastErr = await r2.text().catch(() => String(r2.status));
      } catch (e) { lastErr = (e as Error).message; }
    }

    // 5. Atualiza status final
    if (ok) {
      const sentAt = new Date().toISOString();

      if (msg.conversa_id) {
        await db.from("mensagens").insert({
          conversa_id: msg.conversa_id,
          empresa_id:  msg.empresa_id,
          de:          "me",
          remetente:   "agendado",
          texto:       msg.mensagem,
          tipo:        "texto",
          hora:        sentAt,
          status:      "enviado",
        });
        await db.from("conversas").update({
          ultima_mensagem: msg.mensagem,
          ultima_hora:     sentAt,
        }).eq("id", msg.conversa_id);
      }

      await db.from("mensagens_agendadas").update({
        status:     "enviado",
        enviado_em: sentAt,
      }).eq("id", msg.id);

      await logWA(db, {
        empresa_id:  msg.empresa_id,
        conversa_id: msg.conversa_id ?? null,
        tipo:   "mensagem_agendada", nivel: "info",
        origem: "send-scheduled", evento: "sendText",
        telefone: phone,
        resumo:  `Mensagem agendada enviada: ${(msg.mensagem as string).slice(0, 100)}`,
        payload: { agendada_id: msg.id },
      });

      sent++;
    } else {
      await db.from("mensagens_agendadas").update({
        status: "falhou",
        erro:   lastErr.slice(0, 500),
      }).eq("id", msg.id);

      await logWA(db, {
        empresa_id:  msg.empresa_id,
        conversa_id: msg.conversa_id ?? null,
        tipo:   "erro_api", nivel: "error",
        origem: "send-scheduled", evento: "sendText",
        telefone: phone,
        resumo:  `Falha ao enviar mensagem agendada: ${lastErr.slice(0, 150)}`,
        payload: { agendada_id: msg.id, erro: lastErr.slice(0, 300) },
      });

      failed++;
    }
  }

  console.log(`[send-scheduled] sent=${sent} failed=${failed}`);
  return json({ sent, failed });
});
