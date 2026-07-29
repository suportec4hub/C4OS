import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
const META_API_VER = "v19.0";
const BASE_URL     = `https://graph.facebook.com/${META_API_VER}`;

const db = createClient(SUPABASE_URL, SERVICE_KEY);

async function metaReq(
  method: string,
  path: string,
  token: string,
  payload?: Record<string, unknown>,
) {
  const url = new URL(`${BASE_URL}/${path}`);
  url.searchParams.set("access_token", token);
  const opts: RequestInit = { method };
  if (payload && method !== "GET") {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(payload);
  }
  const res = await fetch(url.toString(), opts);
  return res.json();
}

async function getToken(contaId: string): Promise<string | null> {
  const { data } = await db.from("meta_contas").select("access_token,ad_account_id").eq("id", contaId).single();
  return data?.access_token ?? null;
}

async function getContaDetails(contaId: string) {
  const { data } = await db.from("meta_contas").select("access_token,ad_account_id").eq("id", contaId).single();
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });

  const userToken = authHeader.slice(7);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { authorization: `Bearer ${userToken}` } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: perfil } = await db
    .from("usuarios")
    .select("empresa_id, empresas(is_c4hub)")
    .eq("id", user.id)
    .single();
  if (!(perfil?.empresas as { is_c4hub?: boolean } | undefined)?.is_c4hub) {
    return new Response("Forbidden", { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const { action, conta_id } = body as { action: string; conta_id: string };
  const conta = await getContaDetails(conta_id);
  if (!conta) return new Response(JSON.stringify({ error: "conta not found" }), { status: 404 });

  const token = conta.access_token;
  const act   = conta.ad_account_id.startsWith("act_")
    ? conta.ad_account_id
    : `act_${conta.ad_account_id}`;

  // ── Pause / Activate ────────────────────────────────────────────────────────
  if (action === "pause" || action === "activate") {
    const { entity, entity_id } = body as { entity: string; entity_id: string };
    const status = action === "pause" ? "PAUSED" : "ACTIVE";
    const result = await metaReq("POST", entity_id, token, { status });
    if (result.error) return new Response(JSON.stringify({ error: result.error.message }), { status: 400 });

    if (entity === "campaign") await db.from("meta_campanhas").update({ status }).eq("campaign_id", entity_id);
    if (entity === "adset")    await db.from("meta_adsets").update({ status }).eq("adset_id", entity_id);
    if (entity === "ad")       await db.from("meta_anuncios").update({ status }).eq("ad_id", entity_id);

    return new Response(JSON.stringify({ ok: true, status }), { headers: { "Content-Type": "application/json" } });
  }

  // ── Create Campaign ─────────────────────────────────────────────────────────
  if (action === "create_campaign") {
    const { nome, objetivo, orcamento_diario, data_inicio, data_fim, status_inicial } = body as {
      nome: string; objetivo: string; orcamento_diario?: number;
      data_inicio?: string; data_fim?: string; status_inicial?: string;
    };

    const payload: Record<string, unknown> = {
      name:                  nome,
      objective:             objetivo,
      status:                status_inicial ?? "PAUSED",
      special_ad_categories: [],
    };
    if (orcamento_diario) payload.daily_budget = Math.round(orcamento_diario * 100);
    if (data_inicio) payload.start_time = `${data_inicio}T00:00:00-0300`;
    if (data_fim)    payload.stop_time  = `${data_fim}T23:59:59-0300`;

    const result = await metaReq("POST", `${act}/campaigns`, token, payload);
    if (result.error) return new Response(JSON.stringify({ error: result.error.message }), { status: 400 });

    // Sync to DB
    await db.from("meta_campanhas").upsert({
      meta_conta_id:    conta_id,
      campaign_id:      result.id,
      nome,
      objetivo,
      status:           status_inicial ?? "PAUSED",
      orcamento_diario: orcamento_diario ?? null,
      data_inicio:      data_inicio ?? null,
      data_fim:         data_fim ?? null,
      synced_at:        new Date().toISOString(),
    }, { onConflict: "campaign_id" });

    return new Response(JSON.stringify({ ok: true, id: result.id }), { headers: { "Content-Type": "application/json" } });
  }

  // ── Update Campaign ─────────────────────────────────────────────────────────
  if (action === "update_campaign") {
    const { campaign_id, nome, orcamento_diario, data_fim, status: newStatus } = body as {
      campaign_id: string; nome?: string; orcamento_diario?: number; data_fim?: string; status?: string;
    };

    const payload: Record<string, unknown> = {};
    if (nome) payload.name = nome;
    if (newStatus) payload.status = newStatus;
    if (orcamento_diario !== undefined) payload.daily_budget = Math.round(orcamento_diario * 100);
    if (data_fim) payload.stop_time = `${data_fim}T23:59:59-0300`;

    const result = await metaReq("POST", campaign_id, token, payload);
    if (result.error) return new Response(JSON.stringify({ error: result.error.message }), { status: 400 });

    const dbUpdate: Record<string, unknown> = { synced_at: new Date().toISOString() };
    if (nome) dbUpdate.nome = nome;
    if (newStatus) dbUpdate.status = newStatus;
    if (orcamento_diario !== undefined) dbUpdate.orcamento_diario = orcamento_diario;
    if (data_fim) dbUpdate.data_fim = data_fim;
    await db.from("meta_campanhas").update(dbUpdate).eq("campaign_id", campaign_id);

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }

  // ── Delete Campaign ─────────────────────────────────────────────────────────
  if (action === "delete_campaign") {
    const { campaign_id } = body as { campaign_id: string };
    const result = await metaReq("DELETE", campaign_id, token);
    if (result.error) return new Response(JSON.stringify({ error: result.error.message }), { status: 400 });
    await db.from("meta_campanhas").delete().eq("campaign_id", campaign_id);
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }

  // ── Create AdSet ────────────────────────────────────────────────────────────
  if (action === "create_adset") {
    const { campaign_id, nome, orcamento_diario, otimizacao, evento_cobranca, data_inicio, data_fim, status_inicial } = body as {
      campaign_id: string; nome: string; orcamento_diario: number;
      otimizacao?: string; evento_cobranca?: string;
      data_inicio?: string; data_fim?: string; status_inicial?: string;
    };

    const payload: Record<string, unknown> = {
      name:              nome,
      campaign_id,
      status:            status_inicial ?? "PAUSED",
      daily_budget:      Math.round(orcamento_diario * 100),
      optimization_goal: otimizacao ?? "LEAD_GENERATION",
      billing_event:     evento_cobranca ?? "IMPRESSIONS",
      targeting:         { geo_locations: { countries: ["BR"] } },
    };
    if (data_inicio) payload.start_time = `${data_inicio}T00:00:00-0300`;
    if (data_fim)    payload.end_time   = `${data_fim}T23:59:59-0300`;

    const result = await metaReq("POST", `${act}/adsets`, token, payload);
    if (result.error) return new Response(JSON.stringify({ error: result.error.message }), { status: 400 });

    // Get the local campaign UUID
    const { data: dbCamp } = await db.from("meta_campanhas")
      .select("id").eq("campaign_id", campaign_id).single();

    if (dbCamp) {
      await db.from("meta_adsets").upsert({
        campanha_id:      dbCamp.id,
        adset_id:         result.id,
        nome,
        status:           status_inicial ?? "PAUSED",
        orcamento_diario: orcamento_diario,
        data_inicio:      data_inicio ?? null,
        data_fim:         data_fim ?? null,
        synced_at:        new Date().toISOString(),
      }, { onConflict: "adset_id" });
    }

    return new Response(JSON.stringify({ ok: true, id: result.id }), { headers: { "Content-Type": "application/json" } });
  }

  // ── Update AdSet ────────────────────────────────────────────────────────────
  if (action === "update_adset") {
    const { adset_id, nome, orcamento_diario, status: newStatus } = body as {
      adset_id: string; nome?: string; orcamento_diario?: number; status?: string;
    };

    const payload: Record<string, unknown> = {};
    if (nome) payload.name = nome;
    if (newStatus) payload.status = newStatus;
    if (orcamento_diario !== undefined) payload.daily_budget = Math.round(orcamento_diario * 100);

    const result = await metaReq("POST", adset_id, token, payload);
    if (result.error) return new Response(JSON.stringify({ error: result.error.message }), { status: 400 });

    const dbUpdate: Record<string, unknown> = { synced_at: new Date().toISOString() };
    if (nome) dbUpdate.nome = nome;
    if (newStatus) dbUpdate.status = newStatus;
    if (orcamento_diario !== undefined) dbUpdate.orcamento_diario = orcamento_diario;
    await db.from("meta_adsets").update(dbUpdate).eq("adset_id", adset_id);

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }

  // ── Update AdSet Budget ─────────────────────────────────────────────────────
  if (action === "update_budget") {
    const { entity, entity_id, orcamento_diario } = body as {
      entity: string; entity_id: string; orcamento_diario: number;
    };
    const daily_budget = Math.round(orcamento_diario * 100);
    const result = await metaReq("POST", entity_id, token, { daily_budget });
    if (result.error) return new Response(JSON.stringify({ error: result.error.message }), { status: 400 });

    if (entity === "campaign") await db.from("meta_campanhas").update({ orcamento_diario }).eq("campaign_id", entity_id);
    if (entity === "adset")    await db.from("meta_adsets").update({ orcamento_diario }).eq("adset_id", entity_id);

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }

  // ── Import Lead to CRM ──────────────────────────────────────────────────────
  if (action === "import_lead") {
    const { lead_id } = body as { lead_id: string };
    const { data: lead } = await db.from("meta_leads").select("*").eq("id", lead_id).single();
    if (!lead) return new Response(JSON.stringify({ error: "lead not found" }), { status: 404 });

    const { error: lErr } = await db.from("leads").insert({
      empresa_id:  perfil.empresa_id,
      nome:        lead.nome ?? "Lead Meta",
      email:       lead.email ?? null,
      telefone:    lead.telefone ?? null,
      origem:      "meta_ads",
      status:      "novo",
      observacoes: `Lead Meta Ads\nCampanha: ${lead.campaign_id ?? ""}\nAnúncio: ${lead.ad_id ?? ""}\nFormulário: ${lead.form_id ?? ""}`,
    });

    if (!lErr) await db.from("meta_leads").update({ importado_crm: true }).eq("id", lead_id);
    return new Response(JSON.stringify({ ok: !lErr, error: lErr?.message }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Force Sync ──────────────────────────────────────────────────────────────
  if (action === "sync") {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-token": Deno.env.get("CRON_TOKEN") ?? "",
      },
      body: "{}",
    });
    const json = await res.json();
    return new Response(JSON.stringify({ ok: true, ...json }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "unknown action" }), { status: 400 });
});
