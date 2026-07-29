import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_TOKEN   = Deno.env.get("CRON_TOKEN") ?? "";
const META_API_VER = "v19.0";
const BASE_URL     = `https://graph.facebook.com/${META_API_VER}`;

const db = createClient(SUPABASE_URL, SERVICE_KEY);

async function metaGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}/${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) throw new Error(`Meta API: ${json.error.message}`);
  return json;
}

async function syncConta(conta: {
  id: string; ad_account_id: string; access_token: string;
}) {
  const token = conta.access_token;
  const act   = conta.ad_account_id.startsWith("act_")
    ? conta.ad_account_id
    : `act_${conta.ad_account_id}`;

  // --- Campaigns ---
  const campsData = await metaGet(`${act}/campaigns`, token, {
    fields: "id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time",
    limit: "200",
  });

  const campaigns = campsData.data ?? [];
  for (const c of campaigns) {
    const { error: ceErr } = await db.from("meta_campanhas").upsert({
      meta_conta_id:    conta.id,
      campaign_id:      c.id,
      nome:             c.name,
      objetivo:         c.objective,
      status:           c.status,
      orcamento_diario: c.daily_budget ? Number(c.daily_budget) / 100 : null,
      orcamento_total:  c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
      data_inicio:      c.start_time ? c.start_time.split("T")[0] : null,
      data_fim:         c.stop_time  ? c.stop_time.split("T")[0]  : null,
      synced_at:        new Date().toISOString(),
    }, { onConflict: "campaign_id" });
    if (ceErr) console.error("upsert campanha", ceErr);

    // --- Ad Sets ---
    const { data: dbCamp } = await db.from("meta_campanhas")
      .select("id").eq("campaign_id", c.id).single();
    if (!dbCamp) continue;

    const adsetsData = await metaGet(`${c.id}/adsets`, token, {
      fields: "id,name,status,daily_budget,start_time,end_time",
      limit: "200",
    }).catch(() => ({ data: [] }));

    for (const s of adsetsData.data ?? []) {
      const { error: sErr } = await db.from("meta_adsets").upsert({
        campanha_id:      dbCamp.id,
        adset_id:         s.id,
        nome:             s.name,
        status:           s.status,
        orcamento_diario: s.daily_budget ? Number(s.daily_budget) / 100 : null,
        data_inicio:      s.start_time ? s.start_time.split("T")[0] : null,
        data_fim:         s.end_time   ? s.end_time.split("T")[0]   : null,
        synced_at:        new Date().toISOString(),
      }, { onConflict: "adset_id" });
      if (sErr) console.error("upsert adset", sErr);

      // --- Ads ---
      const { data: dbAdset } = await db.from("meta_adsets")
        .select("id").eq("adset_id", s.id).single();
      if (!dbAdset) continue;

      const adsData = await metaGet(`${s.id}/ads`, token, {
        fields: "id,name,status,creative{thumbnail_url,video_id}",
        limit: "200",
      }).catch(() => ({ data: [] }));

      for (const a of adsData.data ?? []) {
        const isVideo = !!(a.creative?.video_id);
        await db.from("meta_anuncios").upsert({
          adset_id:      dbAdset.id,
          ad_id:         a.id,
          nome:          a.name,
          status:        a.status,
          thumbnail_url: a.creative?.thumbnail_url ?? null,
          is_video:      isVideo,
          synced_at:     new Date().toISOString(),
        }, { onConflict: "ad_id" });
      }
    }

    // --- Campaign-level insights (last 30 days) ---
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const insightsData = await metaGet(`${c.id}/insights`, token, {
      fields: "impressions,reach,clicks,spend,actions,video_play_actions,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_thruplay_watched_actions",
      time_increment: "1",
      since: since.toISOString().split("T")[0],
      until: new Date().toISOString().split("T")[0],
      limit: "200",
    }).catch(() => ({ data: [] }));

    const insightRows = (insightsData.data ?? []).map((row: Record<string, unknown>) => {
      const acts = (row.actions as {action_type:string,value:string}[] | undefined) ?? [];
      const leads = acts.find(a => a.action_type === "lead")?.value ?? "0";
      const videoPlays = (row.video_play_actions as {value:string}[] | undefined)?.[0]?.value ?? "0";
      const p25  = (row.video_p25_watched_actions as {value:string}[] | undefined)?.[0]?.value ?? "0";
      const p50  = (row.video_p50_watched_actions as {value:string}[] | undefined)?.[0]?.value ?? "0";
      const p75  = (row.video_p75_watched_actions as {value:string}[] | undefined)?.[0]?.value ?? "0";
      const p100 = (row.video_p100_watched_actions as {value:string}[] | undefined)?.[0]?.value ?? "0";
      const thru = (row.video_thruplay_watched_actions as {value:string}[] | undefined)?.[0]?.value ?? "0";
      return {
        meta_conta_id: conta.id,
        campaign_id:   c.id,
        ad_id:         "",
        data:          row.date_start as string,
        impressoes:    Number(row.impressions ?? 0),
        alcance:       Number(row.reach ?? 0),
        cliques:       Number(row.clicks ?? 0),
        gasto:         Number(row.spend ?? 0),
        leads:         Number(leads),
        video_plays:   Number(videoPlays),
        video_p25:     Number(p25),
        video_p50:     Number(p50),
        video_p75:     Number(p75),
        video_p100:    Number(p100),
        thruplays:     Number(thru),
      };
    });
    if (insightRows.length > 0) {
      await db.from("meta_insights").upsert(insightRows, {
        onConflict: "meta_conta_id,campaign_id,ad_id,data",
      });
    }
  }

  // --- Ad-level insights (last 30 days) ---
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);
  const adInsightsData = await metaGet(`${act}/insights`, token, {
    level: "ad",
    fields: "ad_id,campaign_id,impressions,reach,clicks,spend,actions,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_thruplay_watched_actions",
    time_increment: "1",
    since: since30.toISOString().split("T")[0],
    until: new Date().toISOString().split("T")[0],
    limit: "500",
  }).catch(() => ({ data: [] }));

  const adInsightRows = (adInsightsData.data ?? []).map((row: Record<string, unknown>) => {
    const acts = (row.actions as {action_type:string,value:string}[] | undefined) ?? [];
    const leads = acts.find(a => a.action_type === "lead")?.value ?? "0";
    const videoPlays = (row.video_play_actions as {value:string}[] | undefined)?.[0]?.value ?? "0";
    const p25  = (row.video_p25_watched_actions as {value:string}[] | undefined)?.[0]?.value ?? "0";
    const p50  = (row.video_p50_watched_actions as {value:string}[] | undefined)?.[0]?.value ?? "0";
    const p75  = (row.video_p75_watched_actions as {value:string}[] | undefined)?.[0]?.value ?? "0";
    const p100 = (row.video_p100_watched_actions as {value:string}[] | undefined)?.[0]?.value ?? "0";
    const thru = (row.video_thruplay_watched_actions as {value:string}[] | undefined)?.[0]?.value ?? "0";
    return {
      meta_conta_id: conta.id,
      campaign_id:   row.campaign_id as string,
      ad_id:         row.ad_id as string,
      data:          row.date_start as string,
      impressoes:    Number(row.impressions ?? 0),
      alcance:       Number(row.reach ?? 0),
      cliques:       Number(row.clicks ?? 0),
      gasto:         Number(row.spend ?? 0),
      leads:         Number(leads),
      video_plays:   Number(videoPlays),
      video_p25:     Number(p25),
      video_p50:     Number(p50),
      video_p75:     Number(p75),
      video_p100:    Number(p100),
      thruplays:     Number(thru),
    };
  });

  if (adInsightRows.length > 0) {
    await db.from("meta_insights").upsert(adInsightRows, {
      onConflict: "meta_conta_id,campaign_id,ad_id,data",
    });
  }

  await db.from("meta_contas").update({
    last_synced_at: new Date().toISOString(),
    sync_error:     null,
    status:         "ativa",
  }).eq("id", conta.id);
}

Deno.serve(async (req: Request) => {
  const cronHeader = req.headers.get("x-cron-token");
  const authHeader = req.headers.get("authorization");
  const isAdmin = authHeader?.includes("service_role");
  // CRON_TOKEN vazio = segredo ainda não configurado (ver send-followup-sequences).
  if (CRON_TOKEN !== "" && cronHeader !== CRON_TOKEN && !isAdmin) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: contas, error } = await db
    .from("meta_contas")
    .select("id,ad_account_id,access_token")
    .eq("status", "ativa");

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const results: Record<string, string> = {};
  for (const conta of contas ?? []) {
    try {
      await syncConta(conta);
      results[conta.ad_account_id] = "ok";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results[conta.ad_account_id] = `error: ${msg}`;
      await db.from("meta_contas").update({
        status: "erro",
        sync_error: msg,
      }).eq("id", conta.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
