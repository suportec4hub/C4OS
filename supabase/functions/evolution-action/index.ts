import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });

/** Sanitiza nome da empresa para uso como nome de instância */
const sanitizeName = (nome: string) =>
  nome.trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 28);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const GLOBAL_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
  const GLOBAL_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
  const SUPA_URL   = Deno.env.get("SUPABASE_URL") || "";

  try {
    const body = await req.json();
    const { action, empresa_id } = body;

    if (!empresa_id) return json({ error: "empresa_id obrigatório" }, 400);

    const { data: emp, error: empErr } = await supabase
      .from("empresas")
      .select("id, nome, evolution_instance_id, evolution_instance_token, evolution_api_url, evolution_connected")
      .eq("id", empresa_id)
      .single();

    if (empErr || !emp) return json({ error: "Empresa não encontrada" }, 404);

    const evoUrl        = ((emp.evolution_api_url?.trim() || GLOBAL_URL) || "").replace(/\/$/, "");
    const instanceToken = emp.evolution_instance_token || "";
    const instanceId    = emp.evolution_instance_id    || "";
    // Nome legível: c4HUB - Nome Empresa
    const instanceName  = `c4HUB-${sanitizeName(emp.nome || empresa_id.slice(0, 12))}`;

    if (!evoUrl) return json({ error: "Servidor Evolution não configurado. Acesse Minha Empresa e configure a URL." }, 400);

    const globalFetch = (path: string, opts: RequestInit = {}) =>
      fetch(`${evoUrl}${path}`, {
        ...opts,
        headers: { "Content-Type": "application/json", "apikey": GLOBAL_KEY, ...(opts.headers || {}) },
      });

    const instanceFetch = (path: string, opts: RequestInit = {}) =>
      fetch(`${evoUrl}${path}`, {
        ...opts,
        headers: { "Content-Type": "application/json", "apikey": instanceToken, ...(opts.headers || {}) },
      });

    // ── CREATE ──────────────────────────────────────────────────────────
    if (action === "create") {
      const myToken = crypto.randomUUID();

      const res  = await globalFetch("/instance/create", {
        method: "POST",
        body: JSON.stringify({
          name:        instanceName,
          token:       myToken,
          integration: "WHATSAPP-BAILEYS",
        }),
      });
      const data = await res.json();
      console.log("[create] status:", res.status, JSON.stringify(data).slice(0, 500));

      if (!res.ok) return json({ error: data.message || data.error || JSON.stringify(data) }, 400);

      const createdId    = data?.data?.id    || data?.id    || "";
      // CORREÇÃO: usa o token retornado pela API (pode ser diferente do myToken)
      const createdToken = data?.data?.token || data?.token || myToken;
      // CORREÇÃO: monta URL do webhook com o token que vai ser salvo no banco
      const webhookUrl   = `${SUPA_URL}/functions/v1/evolution-webhook?token=${createdToken}`;

      await supabase.from("empresas").update({
        evolution_instance_id:    createdId || null,
        evolution_instance_token: createdToken,
        evolution_connected:      false,
        evolution_qr_temp:        null,
      }).eq("id", empresa_id);

      // Configura webhook via connect imediatamente após criar
      if (createdId) {
        try {
          const connectRes = await fetch(`${evoUrl}/instance/connect`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": createdToken },
            body: JSON.stringify({ id: createdId, webhookUrl }),
          });
          console.log("[create→connect] status:", connectRes.status);
        } catch (e) {
          console.error("[create→connect] erro:", e);
        }
      }

      return json({ success: true, instanceId: createdId, token: createdToken, instanceName, webhookUrl });
    }

    if (!instanceToken) return json({ error: "Instância não criada. Execute 'create' primeiro." }, 400);

    // ── CONNECT ─────────────────────────────────────────────────────────
    if (action === "connect") {
      if (!instanceId) return json({ error: "ID da instância não encontrado. Recrie a instância." }, 400);

      // Webhook URL usa sempre o token armazenado no banco
      const webhookUrl = `${SUPA_URL}/functions/v1/evolution-webhook?token=${instanceToken}`;

      const res  = await instanceFetch("/instance/connect", {
        method: "POST",
        body: JSON.stringify({ id: instanceId, webhookUrl }),
      });
      const data = await res.json();
      console.log("[connect] status:", res.status, JSON.stringify(data).slice(0, 600));

      if (!res.ok) return json({ error: data.message || data.error || JSON.stringify(data) }, res.status);

      let qrBase64 = "", pairingCode = "";
      try {
        const qrRes  = await instanceFetch(`/instance/qr?id=${instanceId}`);
        const qrData = await qrRes.json();
        qrBase64    = qrData?.data?.Qrcode || "";
        pairingCode = qrData?.data?.Code   || "";
        if (qrBase64) {
          await supabase.from("empresas")
            .update({ evolution_qr_temp: qrBase64 })
            .eq("id", empresa_id);
        }
      } catch (_) { /* best-effort */ }

      return json({ success: true, qrBase64, pairingCode, data, webhookUrl });
    }

    // ── RESET WEBHOOK (reconfigura URL sem gerar QR) ──────────────────
    if (action === "resetWebhook") {
      if (!instanceId) return json({ error: "ID da instância não encontrado." }, 400);
      const webhookUrl = `${SUPA_URL}/functions/v1/evolution-webhook?token=${instanceToken}`;
      try {
        const res = await instanceFetch("/instance/connect", {
          method: "POST",
          body: JSON.stringify({ id: instanceId, webhookUrl }),
        });
        const data = await res.json();
        console.log("[resetWebhook] status:", res.status, JSON.stringify(data).slice(0, 300));
        return json({ success: true, webhookUrl });
      } catch (e) {
        return json({ error: (e as Error).message }, 500);
      }
    }

    // ── RECONNECT (força reconexão para re-sincronizar histórico) ──────
    if (action === "reconnect") {
      if (!instanceId) return json({ error: "ID da instância não encontrado." }, 400);
      try {
        const res = await instanceFetch("/instance/reconnect", {
          method: "POST",
          body: JSON.stringify({ id: instanceId }),
        });
        const data = await res.json();
        console.log("[reconnect] status:", res.status, JSON.stringify(data).slice(0, 300));
        return json({ success: true, data });
      } catch (e) {
        return json({ error: (e as Error).message }, 500);
      }
    }

    // ── QR ───────────────────────────────────────────────────────────────
    if (action === "qr") {
      if (instanceId) {
        try {
          const qrRes    = await instanceFetch(`/instance/qr?id=${instanceId}`);
          const qrData   = await qrRes.json();
          const qrBase64 = qrData?.data?.Qrcode || "";
          if (qrBase64) {
            await supabase.from("empresas")
              .update({ evolution_qr_temp: qrBase64 })
              .eq("id", empresa_id);
            return json({ data: { Qrcode: qrBase64, Code: qrData?.data?.Code || "" } });
          }
        } catch (_) { /* fallback to DB */ }
      }
      const { data: freshEmp } = await supabase
        .from("empresas")
        .select("evolution_qr_temp, evolution_connected")
        .eq("id", empresa_id)
        .single();
      return json({ data: { Qrcode: freshEmp?.evolution_qr_temp || null, Connected: freshEmp?.evolution_connected || false } });
    }

    // ── STATUS ───────────────────────────────────────────────────────────
    if (action === "status") {
      if (!instanceId) {
        const { data: freshEmp } = await supabase
          .from("empresas")
          .select("evolution_connected")
          .eq("id", empresa_id)
          .single();
        const c = freshEmp?.evolution_connected || false;
        return json({ data: { Connected: c, LoggedIn: c } });
      }
      const res  = await globalFetch(`/instance/info/${instanceId}`);
      const data = await res.json();
      const isConnected = data?.data?.connected === true;
      if (isConnected) {
        await supabase.from("empresas").update({ evolution_connected: true, evolution_qr_temp: null }).eq("id", empresa_id);
      } else {
        await supabase.from("empresas").update({ evolution_connected: false }).eq("id", empresa_id);
      }
      return json({ data: { Connected: isConnected, LoggedIn: isConnected, jid: data?.data?.jid || "" } });
    }

    // ── SEND TEXT ────────────────────────────────────────────────────────
    if (action === "send") {
      const { phone, message } = body;
      if (!phone || !message) return json({ error: "phone e message obrigatórios" }, 400);
      if (!instanceId) return json({ error: "ID da instância não encontrado." }, 400);
      const cleanPhone = String(phone).replace(/\D/g, "");
      const res = await instanceFetch("/send/text", {
        method: "POST",
        body: JSON.stringify({ id: instanceId, number: cleanPhone, text: message }),
      });
      const resData = await res.json();
      console.log("[send] status:", res.status, "phone:", cleanPhone, JSON.stringify(resData).slice(0, 300));
      if (!res.ok) return json({ error: resData.message || resData.error || JSON.stringify(resData) }, res.status);
      return json(resData);
    }

    // ── LOGOUT ───────────────────────────────────────────────────────────
    if (action === "disconnect" || action === "logout") {
      if (instanceId) {
        try {
          await instanceFetch("/instance/logout", {
            method: "DELETE",
            body: JSON.stringify({ id: instanceId }),
          });
        } catch (_) { /* best-effort */ }
      }
      await supabase.from("empresas").update({ evolution_connected: false, evolution_qr_temp: null }).eq("id", empresa_id);
      return json({ success: true });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error("evolution-action error:", e);
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});
