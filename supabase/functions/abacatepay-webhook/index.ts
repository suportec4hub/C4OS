// Recebe os eventos do AbacatePay.
//
// URL a configurar no painel do AbacatePay:
//   https://<projeto>.supabase.co/functions/v1/abacatepay-webhook?webhookSecret=<segredo>
//
// O segredo vai na query string, que é como o AbacatePay envia. Ele fica no
// secret ABACATEPAY_WEBHOOK_SECRET — nunca no código. Sem o secret configurado
// a função recusa tudo: aceitar qualquer chamada deixaria qualquer um dar baixa
// em cobrança dizendo que um cliente pagou.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Lido a cada requisição pelo mesmo motivo da chave da API: capturado no boot,
// atualizar o secret não teria efeito nas instâncias já em execução.
const webhookSecret = () => (Deno.env.get("ABACATEPAY_WEBHOOK_SECRET") ?? "").trim();

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

// Comparação em tempo constante: comparar segredo com === vaza, pelo tempo de
// resposta, quantos caracteres iniciais estavam certos.
function segredoConfere(recebido: string, esperado: string): boolean {
  if (recebido.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < recebido.length; i++) diff |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return diff === 0;
}

// Eventos que significam dinheiro recebido, nas duas versões da API.
const EVENTOS_PAGOS = new Set([
  "billing.paid", "checkout.completed", "transparent.completed",
  "subscription.completed", "subscription.renewed",
]);
// Eventos que desfazem um pagamento.
const EVENTOS_ESTORNO = new Set([
  "billing.refunded", "checkout.refunded", "transparent.refunded",
  "checkout.disputed", "transparent.disputed",
]);

Deno.serve(async (req) => {
  const esperado = webhookSecret();
  if (!esperado) {
    console.error("[abacatepay-webhook] ABACATEPAY_WEBHOOK_SECRET não configurado");
    return json({ error: "webhook não configurado" }, 503);
  }

  const url = new URL(req.url);
  const recebido = url.searchParams.get("webhookSecret") ?? "";
  if (!segredoConfere(recebido, esperado)) {
    return json({ error: "unauthorized" }, 401);
  }

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "json inválido" }, 400); }

  const db = createClient(SUPA_URL, SUPA_KEY);

  const evento    = String(body?.event || body?.type || "desconhecido");
  const eventoId  = body?.id ? String(body.id) : null;
  const d         = body?.data ?? {};
  const billingId = String(d?.billing?.id || d?.id || d?.billingId || "") || null;
  const customerId = String(
    d?.customer?.id || d?.billing?.customer?.id || d?.customerId || "",
  ) || null;

  // Valores do AbacatePay vêm em centavos.
  const centavos = Number(d?.amount ?? d?.billing?.amount ?? d?.paidAmount ?? 0);
  const valor = centavos > 0 ? centavos / 100 : null;

  // Descobre o cliente pelo id do AbacatePay; se não achar, pela cobrança.
  let empresaId: string | null = null;
  if (customerId) {
    const { data: e } = await db.from("empresas")
      .select("id").eq("abacatepay_customer_id", customerId).maybeSingle();
    empresaId = e?.id ?? null;
  }
  if (!empresaId && billingId) {
    const { data: c } = await db.from("cobranca_config")
      .select("empresa_id").eq("abacatepay_billing_id", billingId).maybeSingle();
    empresaId = c?.empresa_id ?? null;
  }

  // Registra antes de agir. O índice único em evento_id torna o reenvio inócuo:
  // o AbacatePay reenvia quando não recebe 200, e sem isso um pagamento seria
  // creditado duas vezes.
  const { data: registro, error: insErr } = await db.from("abacatepay_eventos").insert({
    evento_id: eventoId, evento, empresa_id: empresaId,
    billing_id: billingId, customer_id: customerId, valor, payload: body,
  }).select("id").single();
  if (insErr) {
    // 23505 = violação de unicidade: já processamos este evento.
    if (String(insErr.code) === "23505") return json({ ok: true, duplicado: true });
    console.error("[abacatepay-webhook] falha ao registrar evento:", insErr.message);
    return json({ error: "erro ao registrar" }, 500);
  }

  try {
    if (EVENTOS_PAGOS.has(evento) && empresaId) {
      const hoje = new Date().toISOString().slice(0, 10);

      // Baixa o lançamento desta cobrança; se não houver, cria um já pago para
      // o pagamento não ficar invisível no financeiro.
      const { data: baixados } = await db.from("financeiro_lancamentos")
        .update({ status: "pago", data_pagamento: hoje })
        .eq("empresa_id", empresaId)
        .eq("abacatepay_billing_id", billingId)
        .neq("status", "pago")
        .select("id");

      if (!baixados?.length) {
        await db.from("financeiro_lancamentos").insert({
          empresa_id: empresaId,
          tipo: "receita",
          categoria: "assinatura",
          descricao: `Pagamento AbacatePay${billingId ? ` (${billingId})` : ""}`,
          valor: valor ?? 0,
          data_vencimento: hoje,
          data_pagamento: hoje,
          status: "pago",
          conta: "AbacatePay",
          abacatepay_billing_id: billingId,
        });
      }

      // Pagamento em dia reativa quem estava suspenso por inadimplência.
      await db.from("empresas").update({ status: "ativo" })
        .eq("id", empresaId).in("status", ["inativo", "trial"]);
    }

    if (EVENTOS_ESTORNO.has(evento) && empresaId && billingId) {
      await db.from("financeiro_lancamentos")
        .update({ status: "estornado", data_pagamento: null })
        .eq("empresa_id", empresaId)
        .eq("abacatepay_billing_id", billingId);
    }

    await db.from("abacatepay_eventos").update({ processado: true })
      .eq("id", registro.id);
  } catch (e) {
    console.error("[abacatepay-webhook] erro ao processar:", e);
    await db.from("abacatepay_eventos")
      .update({ erro: String(e).slice(0, 500) })
      .eq("id", registro.id);
    // Responde 200 mesmo assim: o evento está gravado e pode ser reprocessado,
    // e devolver erro faria o AbacatePay reenviar em laço.
  }

  return json({ ok: true });
});
