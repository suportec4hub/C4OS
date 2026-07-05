import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN    = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "c4os-meta-webhook-2025";
const META_API_VER    = "v19.0";
const BASE_URL        = `https://graph.facebook.com/${META_API_VER}`;

const db = createClient(SUPABASE_URL, SERVICE_KEY);

async function fetchLeadDetails(
  leadId: string,
  token: string,
): Promise<{
  nome?: string; email?: string; telefone?: string;
  form_id?: string; ad_id?: string; campaign_id?: string;
  campos?: Record<string, string>; criado_em?: string;
}> {
  const url = new URL(`${BASE_URL}/${leadId}`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("fields", "id,created_time,field_data,form_id,ad_id,campaign_id");
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) return {};

  const fields: Record<string, string> = {};
  for (const f of json.field_data ?? []) {
    fields[f.name] = Array.isArray(f.values) ? f.values[0] : f.values;
  }

  return {
    nome:        fields["full_name"] ?? fields["nome"] ?? fields["name"] ?? undefined,
    email:       fields["email"] ?? undefined,
    telefone:    fields["phone_number"] ?? fields["telefone"] ?? fields["phone"] ?? undefined,
    form_id:     json.form_id,
    ad_id:       json.ad_id,
    campaign_id: json.campaign_id,
    campos:      fields,
    criado_em:   json.created_time,
  };
}

Deno.serve(async (req: Request) => {
  // Webhook verification (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode      = url.searchParams.get("hub.mode");
    const token     = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // Event handling (POST)
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const entries = (body.entry as { changes?: {field: string; value: {leadgen_id?: string; page_id?: string}}[] }[]) ?? [];

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const leadId = change.value?.leadgen_id;
      if (!leadId) continue;

      // Find the conta whose token we can use (pick the first ativa one)
      const { data: contas } = await db
        .from("meta_contas")
        .select("id,access_token")
        .eq("status", "ativa")
        .limit(1);

      if (!contas?.length) continue;
      const conta = contas[0];

      const details = await fetchLeadDetails(leadId, conta.access_token).catch(() => ({}));

      await db.from("meta_leads").upsert({
        meta_conta_id: conta.id,
        lead_id:       leadId,
        form_id:       details.form_id ?? null,
        ad_id:         details.ad_id ?? null,
        campaign_id:   details.campaign_id ?? null,
        nome:          details.nome ?? null,
        email:         details.email ?? null,
        telefone:      details.telefone ?? null,
        campos:        details.campos ?? null,
        importado_crm: false,
        criado_em:     details.criado_em ?? null,
        synced_at:     new Date().toISOString(),
      }, { onConflict: "lead_id" });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
