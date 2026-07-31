import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CRON_TOKEN = Deno.env.get("CRON_TOKEN") ?? "";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Default messages — used when cliente has no custom message configured
const DEFAULTS = {
  "2d_antes": "Olá {nome}! 👋 Sua fatura de *{valor}* vence em 2 dias ({data_vencimento}). Para evitar interrupções no seu acesso, efetue o pagamento até a data.\n\n{link_pagamento}\n\nQualquer dúvida é só chamar!",
  "vencimento": "Olá {nome}! Hoje ({data_vencimento}) é o dia de vencimento da sua fatura de *{valor}*.\n\n{link_pagamento}\n\nEfetue o pagamento para manter seu acesso ativo. Obrigado! 🙏",
  "5d_apos": "Olá {nome}! Identificamos que sua fatura de *{valor}* (vencimento: {data_vencimento}) ainda está em aberto.\n\n{link_pagamento}\n\nRegularize o pagamento para evitar a suspensão do serviço. Precisando de ajuda, é só chamar!",
  "20d_apos": "Atenção {nome}! Sua fatura de *{valor}* está em atraso há 20 dias.\n\n{link_pagamento}\n\nEntre em contato urgente para regularizar a situação e evitar o cancelamento do seu plano. 📋",
};

function substituir(msg: string, vars: Record<string, string>): string {
  return msg.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

// Returns today's date in BRT (UTC-3) as { year, month, day }
function todayBRT() {
  const now = new Date();
  // BRT = UTC-3
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return {
    year:  brt.getUTCFullYear(),
    month: brt.getUTCMonth() + 1, // 1-12
    day:   brt.getUTCDate(),
  };
}

// Returns days difference (today - targetDate). Positive = past due.
function daysDiff(today: { year: number; month: number; day: number }, targetYear: number, targetMonth: number, targetDay: number): number {
  const t = Date.UTC(today.year, today.month - 1, today.day);
  const d = Date.UTC(targetYear, targetMonth - 1, targetDay);
  return Math.round((t - d) / 86400000);
}

// Format date as DD/MM/YYYY
function fmtDate(year: number, month: number, day: number): string {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

// Determine vencimento year/month for the billing cycle.
// If today is before or on the due day → current month; otherwise → next month.
function calcVencimento(today: { year: number; month: number; day: number }, diaVenc: number) {
  let year  = today.year;
  let month = today.month;

  // For D+5 and D+20, we might be checking past the due date of the current month.
  // The simple rule: use current month's due date; if today > day+20, use next month.
  if (today.day > diaVenc + 20) {
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return { year, month, day: diaVenc };
}

Deno.serve(async (req) => {
  const cronToken = req.headers.get("x-cron-token");
  const auth      = req.headers.get("authorization") ?? "";
  // CRON_TOKEN vazio = segredo ainda não configurado (ver send-followup-sequences).
  if (CRON_TOKEN !== "" && cronToken !== CRON_TOKEN && !auth.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = todayBRT();
  const mesRef = `${today.year}-${String(today.month).padStart(2, "0")}`;

  // 1. Find C4HUB's own empresa_id (sender instance)
  const { data: c4hub } = await db
    .from("empresas")
    .select("id")
    .eq("is_c4hub", true)
    .limit(1)
    .maybeSingle();

  if (!c4hub) {
    return json({ error: "C4HUB empresa não encontrada" }, 500);
  }
  const c4hubEmpresaId = c4hub.id;

  // 2. Load all active billing configs with related company info
  const { data: configs, error: cfgErr } = await db
    .from("cobranca_config")
    .select(`
      id, empresa_id, dia_vencimento, whatsapp_cobranca, ativo,
      msg_2_dias_antes, msg_dia_vencimento, msg_5_dias_apos, msg_20_dias_apos,
      valor_mensal, abacatepay_url, abacatepay_billing_mes,
      empresas ( nome, telefone, mrr, plano_id, status )
    `)
    .eq("ativo", true);

  if (cfgErr) return json({ error: cfgErr.message }, 500);
  if (!configs?.length) return json({ ok: true, sent: 0, reason: "no_active_configs" });

  const results: { empresa: string; tipo: string; ok: boolean; err?: string }[] = [];

  for (const cfg of configs) {
    const emp = (cfg as Record<string, unknown>).empresas as {
      nome: string; telefone: string | null; mrr: number | null; status: string;
    } | null;

    if (!emp || emp.status === "cancelado") continue;

    const phone = (cfg.whatsapp_cobranca as string | null) || emp.telefone;
    if (!phone) continue; // no phone to send to

    const diaVenc = cfg.dia_vencimento as number;
    const venc    = calcVencimento(today, diaVenc);
    const diff    = daysDiff(today, venc.year, venc.month, venc.day);

    // Map diff to tipo
    let tipo: string | null = null;
    if (diff === -2) tipo = "2d_antes";
    else if (diff === 0)  tipo = "vencimento";
    else if (diff === 5)  tipo = "5d_apos";
    else if (diff === 20) tipo = "20d_apos";

    if (!tipo) continue; // not a billing day for this client

    // Check if already sent this month for this tipo
    const { data: alreadySent } = await db
      .from("cobranca_log")
      .select("id")
      .eq("empresa_id", cfg.empresa_id as string)
      .eq("tipo", tipo)
      .eq("mes_referencia", mesRef)
      .maybeSingle();

    if (alreadySent) continue; // already sent

    // Build message
    // valor_mensal é o que foi acordado para a cobrança; mrr fica como reserva.
    const valorNum = cfg.valor_mensal != null ? Number(cfg.valor_mensal)
                   : emp.mrr != null ? Number(emp.mrr) : null;
    const valor = valorNum != null
      ? `R$ ${valorNum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : "—";
    const dataVenc = fmtDate(venc.year, venc.month, diaVenc);

    // Link do mês. Em cobrança avulsa cada ciclo é uma cobrança nova: o link do
    // mês anterior já foi pago e não serve. Gera na primeira mensagem do ciclo
    // e reaproveita nas seguintes.
    let link = "";
    if (cfg.abacatepay_billing_mes === mesRef && cfg.abacatepay_url) {
      link = String(cfg.abacatepay_url);
    } else if (valorNum && valorNum > 0) {
      try {
        const { data: cob } = await db.functions.invoke("abacatepay-action", {
          body: { action: "criar_cobranca", empresa_id: cfg.empresa_id, valor: valorNum },
          headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        });
        if (cob?.url) {
          link = String(cob.url);
          await db.from("cobranca_config")
            .update({ abacatepay_billing_mes: mesRef })
            .eq("empresa_id", cfg.empresa_id as string);
        }
      } catch (e) {
        console.error("[send-cobranca] falha ao gerar cobrança:", e);
      }
    }
    // Sem link a mensagem continua saindo, apenas sem a linha de pagamento.
    const linhaLink = link ? `💳 Pague aqui: ${link}` : "";

    const templateField = {
      "2d_antes":   cfg.msg_2_dias_antes,
      "vencimento": cfg.msg_dia_vencimento,
      "5d_apos":    cfg.msg_5_dias_apos,
      "20d_apos":   cfg.msg_20_dias_apos,
    }[tipo] as string | null;

    const template = templateField?.trim() || DEFAULTS[tipo as keyof typeof DEFAULTS];
    const mensagem = substituir(template, {
      nome:           emp.nome,
      valor,
      data_vencimento: dataVenc,
      link_pagamento:  linhaLink,
    });

    // Send via evolution-action (from C4HUB's instance)
    try {
      const sendResp = await db.functions.invoke("evolution-action", {
        body: {
          action:     "send",
          empresa_id: c4hubEmpresaId,
          phone:      String(phone).replace(/\D/g, ""),
          message:    mensagem,
        },
      });

      const ok = !sendResp.error;

      // Auto-block on D+5 if send succeeded
      if (tipo === "5d_apos" && ok) {
        await db.from("empresas").update({
          bloqueado:     true,
          bloqueado_por: "auto",
          bloqueado_em:  new Date().toISOString(),
        }).eq("id", cfg.empresa_id as string);
      }

      // Log the send attempt
      await db.from("cobranca_log").insert({
        empresa_id:     cfg.empresa_id,
        tipo,
        mes_referencia: mesRef,
        telefone:       String(phone).replace(/\D/g, ""),
        mensagem,
        status:         ok ? "enviado" : "erro",
      });

      results.push({ empresa: emp.nome, tipo, ok });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.from("cobranca_log").insert({
        empresa_id:     cfg.empresa_id,
        tipo,
        mes_referencia: mesRef,
        telefone:       String(phone).replace(/\D/g, ""),
        mensagem,
        status: "erro",
      });
      results.push({ empresa: emp.nome, tipo, ok: false, err: msg });
    }
  }

  return json({ ok: true, sent: results.filter(r => r.ok).length, total: results.length, results });
});
