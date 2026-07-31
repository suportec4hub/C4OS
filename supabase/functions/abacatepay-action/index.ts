// Ações do C4OS contra a API do AbacatePay.
//
// A chave fica no secret ABACATEPAY_API_KEY, nunca no código.
// Só a equipe C4HUB pode chamar: são dados financeiros de todos os clientes.
//
// Ações:
//   sync_cliente     — cria/atualiza o cliente no AbacatePay e guarda o id
//   criar_cobranca   — cria a cobrança do valor configurado e devolve o link
//   status           — devolve o que está sincronizado, sem chamar a API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Lidos a cada requisição, não no carregamento do módulo: capturados no boot,
// uma instância já em execução seguia usando o valor antigo depois de o secret
// ser atualizado no painel, e a chave nova só passava a valer no próximo
// deploy. O trim cobre espaço ou quebra de linha colados junto, que corrompem
// o header sem deixar rastro.
const apiKey  = () => (Deno.env.get("ABACATEPAY_API_KEY") ?? "").trim();
const apiBase = () => (Deno.env.get("ABACATEPAY_API_URL") ?? "https://api.abacatepay.com/v2").trim().replace(/\/$/, "");
const appUrl  = () => (Deno.env.get("APP_URL") ?? "").trim().replace(/\/$/, "");

// O supabase-js envia x-client-info e apikey além do authorization; permitir só
// parte deles fazia o navegador barrar o preflight e a chamada nem chegava aqui.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  // Evita um preflight a cada clique nos botões de sincronizar e cobrar.
  "Access-Control-Max-Age": "86400",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

// Chamada à API. Devolve corpo e status crus: como a integração ainda não foi
// exercitada contra a API de produção, o erro precisa chegar inteiro à tela em
// vez de virar "falhou".
async function api(path: string, body?: unknown, method = "POST") {
  const r = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await r.text();
  // deno-lint-ignore no-explicit-any
  let dados: any = null;
  try { dados = JSON.parse(texto); } catch { /* resposta não-JSON vira erro legível */ }
  // A v2 responde no formato {success, data, error} e pode recusar com HTTP 200,
  // então o status sozinho não diz se deu certo.
  const ok = r.ok && dados?.success !== false && !dados?.error;
  return { ok, status: r.status, dados, texto: texto.slice(0, 800) };
}

const soDigitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!apiKey()) return json({ error: "ABACATEPAY_API_KEY não configurada" }, 503);

  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const db = createClient(SUPA_URL, SUPA_KEY);

  // Confere quem está chamando: a ação move dinheiro e enxerga todos os
  // clientes, então fica restrita à equipe C4HUB.
  const { data: userData } = await createClient(SUPA_URL, SUPA_KEY, {
    global: { headers: { Authorization: auth } },
  }).auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return json({ error: "unauthorized" }, 401);

  const { data: quem } = await db.from("usuarios").select("role").eq("id", uid).maybeSingle();
  if (!quem || !["c4hub_admin", "c4hub_vendedor"].includes(String(quem.role))) {
    return json({ error: "somente a equipe C4HUB pode usar a integração" }, 403);
  }

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch { /* ação obrigatória é validada abaixo */ }

  const acao = String(body?.action || "");
  const empresaId = String(body?.empresa_id || "");
  if (!acao || !empresaId) return json({ error: "action e empresa_id são obrigatórios" }, 400);

  const { data: emp } = await db.from("empresas")
    .select("id, nome, telefone, cnpj, abacatepay_customer_id")
    .eq("id", empresaId).maybeSingle();
  if (!emp) return json({ error: "empresa não encontrada" }, 404);

  const { data: cfg } = await db.from("cobranca_config")
    .select("*").eq("empresa_id", empresaId).maybeSingle();

  if (acao === "status") {
    return json({
      customer_id: emp.abacatepay_customer_id,
      billing_id:  cfg?.abacatepay_billing_id ?? null,
      url:         cfg?.abacatepay_url ?? null,
      valor_mensal: cfg?.valor_mensal ?? null,
      sincronizado_em: cfg?.abacatepay_sincronizado_em ?? null,
    });
  }

  // ── Cria ou reaproveita o cliente no AbacatePay ──────────────────────────
  if (acao === "sync_cliente") {
    if (emp.abacatepay_customer_id) {
      return json({ ok: true, customer_id: emp.abacatepay_customer_id, ja_existia: true });
    }

    // O AbacatePay exige e-mail válido ("Property 'email' should be email").
    // Ordem: o que veio da tela, o salvo na configuração, e por fim o e-mail do
    // administrador do cliente — que vive em auth.users e só é alcançável por
    // função security definer.
    let email = String(body?.email || cfg?.email_cobranca || "").trim();
    if (!email) {
      const { data: doAdmin } = await db.rpc("email_admin_da_empresa_interno", { p_empresa: empresaId });
      email = String(doAdmin || "").trim();
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "informe um e-mail válido para a fatura deste cliente" }, 400);
    }

    const r = await api("/customers/create", {
      name:      emp.nome,
      cellphone: soDigitos(emp.telefone),
      email,
      taxId:     soDigitos(emp.cnpj),
    });
    if (!r.ok) {
      const dica = /invalid or inactive api key/i.test(r.texto)
        ? "A chave do AbacatePay foi recusada. Confira o secret ABACATEPAY_API_KEY: chave certa, ativa e sem espaços."
        : /version mismatch/i.test(r.texto)
        ? "A chave é de outra versão da API. Ajuste o secret ABACATEPAY_API_URL para a versão da sua chave (v1 ou v2)."
        : "AbacatePay recusou a criação do cliente";
      return json({ error: dica, status: r.status, resposta: r.texto }, 502);
    }

    const customerId = r.dados?.data?.id ?? r.dados?.id ?? null;
    if (!customerId) return json({ error: "resposta sem id de cliente", resposta: r.texto }, 502);

    await db.from("empresas").update({ abacatepay_customer_id: customerId }).eq("id", empresaId);
    await db.from("cobranca_config").upsert(
      { empresa_id: empresaId, email_cobranca: email }, { onConflict: "empresa_id" },
    );
    return json({ ok: true, customer_id: customerId, email });
  }

  // ── Cria a cobrança e devolve o link de pagamento ────────────────────────
  // Na v2 o item do checkout referencia um produto já cadastrado: por isso o
  // produto é criado antes e só o id dele vai na cobrança. Assinatura exige que
  // o produto tenha ciclo definido e aceita um único item.
  if (acao === "criar_cobranca") {
    const valor = Number(body?.valor ?? cfg?.valor_mensal ?? 0);
    if (!(valor > 0)) return json({ error: "valor mensal não configurado para este cliente" }, 400);
    if (!emp.abacatepay_customer_id) {
      return json({ error: "sincronize o cliente com o AbacatePay antes de gerar a cobrança" }, 400);
    }

    const produto   = String(body?.produto_nome || cfg?.produto_nome || "Mensalidade C4OS");
    const descricao = String(body?.produto_descricao || cfg?.produto_descricao || produto);
    const ciclo     = String(body?.frequencia || cfg?.frequencia || "MONTHLY");
    const metodos   = (body?.metodos || cfg?.metodos || ["PIX"]) as string[];
    const assinatura = ciclo !== "ONE_TIME";
    const centavos  = Math.round(valor * 100);

    // Produto é recriado quando preço, nome ou ciclo mudam: o valor cobrado
    // mora no produto, então reaproveitar um antigo cobraria o preço velho.
    const externalId = `c4os-${empresaId}-${centavos}-${ciclo}`;
    let productId = cfg?.abacatepay_product_id ?? null;
    const mudou = Number(cfg?.valor_mensal) !== valor
      || String(cfg?.produto_nome ?? "") !== produto
      || String(cfg?.frequencia ?? "") !== ciclo;

    if (!productId || mudou) {
      const rp = await api("/products/create", {
        externalId,
        name: produto,
        description: descricao,
        // Centavos: a API trabalha nessa unidade e enviar reais cobraria cem
        // vezes menos.
        price: centavos,
        currency: "BRL",
        ...(assinatura ? { cycle: ciclo } : {}),
      });

      productId = rp.dados?.data?.id ?? rp.dados?.id ?? null;

      // externalId repetido significa que o produto já existe de uma tentativa
      // anterior: recupera pela listagem em vez de falhar.
      if (!productId) {
        const rl = await api("/products/list", undefined, "GET");
        // deno-lint-ignore no-explicit-any
        const lista: any[] = rl.dados?.data ?? rl.dados ?? [];
        productId = (Array.isArray(lista) ? lista : [])
          .find((pr) => String(pr?.externalId) === externalId)?.id ?? null;
      }
      if (!productId) {
        return json({ error: "AbacatePay não criou o produto", status: rp.status, resposta: rp.texto }, 502);
      }
    }

    const rota = assinatura ? "/subscriptions/create" : "/checkouts/create";
    const r = await api(rota, {
      items: [{ id: productId, quantity: 1 }],
      customerId: emp.abacatepay_customer_id,
      methods: metodos,
      returnUrl:     appUrl() || undefined,
      completionUrl: appUrl() || undefined,
    });
    if (!r.ok) {
      return json({
        error: assinatura ? "AbacatePay recusou a assinatura" : "AbacatePay recusou a cobrança",
        status: r.status, resposta: r.texto,
      }, 502);
    }

    const cob = r.dados?.data ?? r.dados ?? {};
    const billingId = cob?.id ?? null;
    const link = cob?.url ?? cob?.paymentUrl ?? null;
    if (!link) return json({ error: "resposta sem link de pagamento", resposta: r.texto }, 502);

    await db.from("cobranca_config").upsert({
      empresa_id: empresaId,
      valor_mensal: valor,
      produto_nome: produto,
      frequencia: ciclo,
      metodos,
      abacatepay_product_id: productId,
      abacatepay_billing_id: billingId,
      abacatepay_url: link,
      abacatepay_sincronizado_em: new Date().toISOString(),
    }, { onConflict: "empresa_id" });

    // Lançamento em aberto, para o webhook ter o que baixar quando pagar.
    const venc = new Date();
    venc.setDate(Number(cfg?.dia_vencimento ?? 10));
    if (venc < new Date()) venc.setMonth(venc.getMonth() + 1);

    await db.from("financeiro_lancamentos").insert({
      empresa_id: empresaId,
      tipo: "receita",
      categoria: "assinatura",
      descricao: `${produto} — ${emp.nome}`,
      valor,
      data_vencimento: venc.toISOString().slice(0, 10),
      status: "pendente",
      conta: "AbacatePay",
      abacatepay_billing_id: billingId,
    });

    return json({ ok: true, billing_id: billingId, url: link, product_id: productId });
  }

  return json({ error: `ação desconhecida: ${acao}` }, 400);
});
