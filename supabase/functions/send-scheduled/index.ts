import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPA_URL       = Deno.env.get("SUPABASE_URL")!;
const SUPA_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GLOBAL_EVO_URL = "https://evolution-api-xrrw.srv1583408.hstgr.cloud";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (_req) => {
  const db = createClient(SUPA_URL, SUPA_KEY);

  // Busca mensagens pendentes cuja hora já passou
  const { data: pending, error } = await db
    .from("mensagens_agendadas")
    .select("id, empresa_id, destinatario, mensagem, empresas(evolution_instance_id, evolution_instance_token, evolution_api_url)")
    .eq("status", "pendente")
    .lte("agendado_para", new Date().toISOString())
    .limit(50);

  if (error) return json({ error: error.message }, 500);
  if (!pending?.length) return json({ sent: 0, failed: 0 });

  let sent = 0;
  let failed = 0;

  for (const msg of pending) {
    const emp = (msg as any).empresas;
    if (!emp?.evolution_instance_id || !emp?.evolution_instance_token) {
      await db.from("mensagens_agendadas")
        .update({ status: "falhou", erro: "Instância Evolution não configurada" })
        .eq("id", msg.id);
      failed++;
      continue;
    }

    const evoUrl    = (emp.evolution_api_url?.trim() || GLOBAL_EVO_URL).replace(/\/$/, "");
    const instName  = emp.evolution_instance_id as string;
    const instToken = emp.evolution_instance_token as string;
    const phone     = String(msg.destinatario).replace(/\D/g, "");

    let ok = false;
    let lastErr = "";

    // Tentativa 1: formato v2 básico
    try {
      const r = await fetch(`${evoUrl}/message/sendText/${instName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": instToken },
        body: JSON.stringify({ number: phone, text: msg.mensagem }),
      });
      if (r.ok) {
        ok = true;
      } else {
        lastErr = await r.text().catch(() => String(r.status));
      }
    } catch (e) {
      lastErr = (e as Error).message;
    }

    // Tentativa 2: formato v2 com options
    if (!ok) {
      try {
        const r2 = await fetch(`${evoUrl}/message/sendText/${instName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": instToken },
          body: JSON.stringify({
            number:      phone,
            options:     { delay: 1200, presence: "composing", linkPreview: false },
            textMessage: { text: msg.mensagem },
          }),
        });
        if (r2.ok) ok = true;
        else lastErr = await r2.text().catch(() => String(r2.status));
      } catch (e) {
        lastErr = (e as Error).message;
      }
    }

    if (ok) {
      await db.from("mensagens_agendadas").update({
        status:     "enviado",
        enviado_em: new Date().toISOString(),
      }).eq("id", msg.id);
      sent++;
    } else {
      await db.from("mensagens_agendadas").update({
        status: "falhou",
        erro:   lastErr.slice(0, 500),
      }).eq("id", msg.id);
      failed++;
    }
  }

  console.log(`[send-scheduled] sent=${sent} failed=${failed}`);
  return json({ sent, failed });
});
