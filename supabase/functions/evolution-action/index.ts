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
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 28);

/** Eventos do webhook que queremos receber */
const WEBHOOK_EVENTS = [
  "MESSAGE", "MESSAGES_UPSERT", "messages.upsert",
  "CONNECTION_UPDATE", "connection.update",
  "QRCODE_UPDATED", "qrcode.updated",
  "HISTORY_SYNC", "messaging-history.set",
];

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

    /** Tenta configurar webhook via endpoint dedicado /webhook/set.
     *  NÃO faz fallback para /instance/connect (evita double-connect que apaga webhookUrl).
     */
    const trySetWebhook = async (token: string, id: string, webhookUrl: string) => {
      try {
        const r = await fetch(`${evoUrl}/webhook/set`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": token },
          body: JSON.stringify({ id, url: webhookUrl, events: WEBHOOK_EVENTS, enabled: true }),
        });
        const ok = r.ok;
        console.log("[trySetWebhook] /webhook/set status:", r.status, ok ? "OK" : "SKIP");
        return ok;
      } catch (_) { return false; }
    };

    // ── CREATE ──────────────────────────────────────────────────────────
    if (action === "create") {
      const myToken    = crypto.randomUUID();
      const webhookUrl = `${SUPA_URL}/functions/v1/evolution-webhook?token=${myToken}`;

      const res = await globalFetch("/instance/create", {
        method: "POST",
        body: JSON.stringify({
          name:        instanceName,
          token:       myToken,
          integration: "WHATSAPP-BAILEYS",
          // Inclui webhook no body do create para garantir configuração imediata
          webhook: {
            url:    webhookUrl,
            events: WEBHOOK_EVENTS,
          },
        }),
      });
      const data = await res.json();
      console.log("[create] status:", res.status, JSON.stringify(data).slice(0, 500));

      if (!res.ok) return json({ error: data.message || data.error || JSON.stringify(data) }, 400);

      const createdId    = data?.data?.id    || data?.id    || "";
      // Usa o token retornado pela API (pode ser diferente do myToken)
      const createdToken = data?.data?.token || data?.token || myToken;
      // Reconstrói a webhookUrl com o token correto
      const finalWebhookUrl = `${SUPA_URL}/functions/v1/evolution-webhook?token=${createdToken}`;

      await supabase.from("empresas").update({
        evolution_instance_id:    createdId || null,
        evolution_instance_token: createdToken,
        evolution_connected:      false,
        evolution_qr_temp:        null,
      }).eq("id", empresa_id);

      // Tenta configurar webhook via endpoint dedicado (best-effort)
      if (createdId) {
        await trySetWebhook(createdToken, createdId, finalWebhookUrl);
      }

      return json({ success: true, instanceId: createdId, token: createdToken, instanceName, webhookUrl: finalWebhookUrl });
    }

    if (!instanceToken) return json({ error: "Instância não criada. Execute 'create' primeiro." }, 400);

    // ── CONNECT ─────────────────────────────────────────────────────────
    if (action === "connect") {
      if (!instanceId) return json({ error: "ID da instância não encontrado. Recrie a instância." }, 400);

      const webhookUrl = `${SUPA_URL}/functions/v1/evolution-webhook?token=${instanceToken}`;

      // 1. Tenta configurar webhook via endpoint dedicado (best-effort, não bloqueia)
      trySetWebhook(instanceToken, instanceId, webhookUrl).catch(() => {});

      // 2. ÚNICA chamada de connect — inclui webhookUrl no body para garantir configuração
      //    (Evolution GO usa webhookUrl aqui para configurar webhook E gerar QR)
      const res  = await instanceFetch("/instance/connect", {
        method: "POST",
        body: JSON.stringify({ id: instanceId, webhookUrl }),
      });
      const data = await res.json();
      console.log("[connect] status:", res.status, JSON.stringify(data).slice(0, 600));

      if (!res.ok) return json({ error: data.message || data.error || JSON.stringify(data) }, res.status);

      // 3. QR pode vir direto na resposta do connect
      let qrBase64 =
        data?.data?.Qrcode || data?.data?.qrcode || data?.Qrcode || data?.qrcode || "";
      let pairingCode =
        data?.data?.Code   || data?.data?.code   || data?.Code   || data?.pairingCode || "";

      // 4. Se não veio no connect, tenta endpoint /instance/qr com retry
      if (!qrBase64) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (attempt > 0) await new Promise(r => setTimeout(r, 1200));
            const qrRes  = await instanceFetch(`/instance/qr?id=${instanceId}`);
            const qrData = await qrRes.json();
            qrBase64    = qrData?.data?.Qrcode || qrData?.data?.qrcode || qrData?.Qrcode || "";
            pairingCode = qrData?.data?.Code   || qrData?.data?.code   || qrData?.Code   || "";
            if (qrBase64) break;
          } catch (_) { /* retry */ }
        }
      }

      // 5. Se obteve QR, salva no banco (o webhook QRCODE_UPDATED também salva — dupla garantia)
      if (qrBase64) {
        await supabase.from("empresas")
          .update({ evolution_qr_temp: qrBase64 })
          .eq("id", empresa_id);
      }

      console.log("[connect] qrBase64 length:", qrBase64.length, "pairingCode:", pairingCode);
      return json({ success: true, qrBase64, pairingCode, data, webhookUrl });
    }

    // ── RESET WEBHOOK ─────────────────────────────────────────────────
    if (action === "resetWebhook") {
      if (!instanceId) return json({ error: "ID da instância não encontrado." }, 400);
      const webhookUrl = `${SUPA_URL}/functions/v1/evolution-webhook?token=${instanceToken}`;
      try {
        // Tenta /webhook/set; se não funcionar, usa /instance/connect com webhookUrl
        const ok1 = await trySetWebhook(instanceToken, instanceId, webhookUrl);
        if (!ok1) {
          const r = await instanceFetch("/instance/connect", {
            method: "POST",
            body: JSON.stringify({ id: instanceId, webhookUrl }),
          });
          console.log("[resetWebhook] fallback /instance/connect status:", r.status);
        }
        return json({ success: true, webhookUrl });
      } catch (e) {
        return json({ error: (e as Error).message }, 500);
      }
    }

    // ── RECONNECT ─────────────────────────────────────────────────────
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
      // 1. Lê do banco primeiro (o webhook QRCODE_UPDATED já pode ter salvo)
      const { data: freshEmp } = await supabase
        .from("empresas")
        .select("evolution_qr_temp, evolution_connected")
        .eq("id", empresa_id)
        .single();

      if (freshEmp?.evolution_connected) {
        return json({ data: { Connected: true } });
      }

      if (freshEmp?.evolution_qr_temp) {
        return json({ data: { Qrcode: freshEmp.evolution_qr_temp, Code: "" } });
      }

      // 2. Banco vazio: tenta endpoint /instance/qr (pode não existir em todas as versões)
      if (instanceId) {
        try {
          const qrRes    = await instanceFetch(`/instance/qr?id=${instanceId}`);
          const qrData   = await qrRes.json();
          const qrBase64 = qrData?.data?.Qrcode || qrData?.data?.qrcode || qrData?.Qrcode || "";
          const code     = qrData?.data?.Code   || qrData?.data?.code   || qrData?.Code   || "";
          if (qrBase64) {
            await supabase.from("empresas")
              .update({ evolution_qr_temp: qrBase64 })
              .eq("id", empresa_id);
            return json({ data: { Qrcode: qrBase64, Code: code } });
          }
        } catch (_) { /* sem QR disponível ainda */ }
      }

      return json({ data: { Qrcode: null, Connected: false } });
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
      try {
        // Tenta com instanceToken primeiro, fallback para globalKey
        let res = await instanceFetch(`/instance/info/${instanceId}`);
        if (!res.ok) res = await globalFetch(`/instance/info/${instanceId}`);
        const data = await res.json();

        // Evolution GO pode retornar o estado em diferentes campos dependendo da versão
        const isConnected =
          data?.data?.connected === true  ||
          data?.data?.state     === "open" ||
          data?.data?.State     === "open" ||
          data?.connected       === true  ||
          data?.state           === "open";

        if (isConnected) {
          const jid   = data?.data?.jid || data?.data?.Jid || data?.jid || "";
          const phone = jid.replace(/@s\.whatsapp\.net$/, "").replace(/:.*$/, "");
          await supabase.from("empresas").update({
            evolution_connected: true,
            evolution_qr_temp:   null,
            ...(phone ? { evolution_phone: phone } : {}),
          }).eq("id", empresa_id);
        } else {
          await supabase.from("empresas").update({ evolution_connected: false }).eq("id", empresa_id);
        }
        return json({ data: {
          Connected: isConnected,
          LoggedIn:  isConnected,
          jid:       data?.data?.jid || data?.jid || "",
        }});
      } catch (_) {
        // Fallback: retorna estado do banco
        const { data: freshEmp } = await supabase
          .from("empresas")
          .select("evolution_connected")
          .eq("id", empresa_id)
          .single();
        const c = freshEmp?.evolution_connected || false;
        return json({ data: { Connected: c, LoggedIn: c } });
      }
    }

    // ── SEND TEXT ────────────────────────────────────────────────────────
    if (action === "send") {
      const { phone, message } = body;
      if (!phone || !message) return json({ error: "phone e message obrigatórios" }, 400);
      if (!instanceId)         return json({ error: "ID da instância não encontrado." }, 400);

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
