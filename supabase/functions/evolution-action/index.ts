import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });

/** Sanitiza nome da empresa para instanceName (sem acentos, sem espaços) */
const sanitizeName = (nome: string) =>
  nome.trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28) || "instance";

/** Eventos do webhook que queremos receber — todos os eventos suportados pelo Evolution GO */
const WEBHOOK_EVENTS = [
  // Mensagens
  "MESSAGE", "MESSAGES_UPSERT", "messages.upsert",
  "MESSAGES_UPDATE", "messages.update",
  "MESSAGES_DELETE", "messages.delete",
  "SEND_MESSAGE", "send.message",
  // Conexão e QR
  "CONNECTION_UPDATE", "connection.update",
  "QRCODE_UPDATED", "qrcode.updated",
  // Histórico
  "HISTORY_SYNC", "messaging-history.set",
  // Recibo de leitura
  "READ_RECEIPT", "message.ack",
  // Presença
  "PRESENCE", "CHAT_PRESENCE", "presence.update",
  // Ligações
  "CALL",
  // Etiquetas
  "LABELS_EDIT", "labels.edit",
  "LABELS_ASSOCIATION", "labels.association",
  // Contatos e chats
  "CONTACTS_SET", "CONTACTS_UPDATE", "CONTACTS_UPSERT", "contacts.upsert", "contacts.update",
  "CHATS_SET", "CHATS_UPDATE", "CHATS_UPSERT", "CHATS_DELETE", "chats.upsert", "chats.update",
  // Grupos
  "GROUPS_UPSERT", "GROUP_UPDATE", "GROUP_PARTICIPANTS_UPDATE", "groups.upsert", "groups.update",
  // Newsletter
  "NEW_JWT_TOKEN",
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

    const evoUrl       = ((emp.evolution_api_url?.trim() || GLOBAL_URL) || "").replace(/\/$/, "");
    const instToken    = emp.evolution_instance_token || "";
    // evolution_instance_id guarda o instanceName (string como "c4HUB-Lucas-Machado")
    const instName     = emp.evolution_instance_id || `c4HUB-${sanitizeName(emp.nome || empresa_id.slice(0, 12))}`;
    const computedName = `c4HUB-${sanitizeName(emp.nome || empresa_id.slice(0, 12))}`;

    if (!evoUrl) return json({ error: "Servidor Evolution não configurado." }, 400);

    /** Fetch autenticado com global apikey */
    const gFetch = (path: string, opts: RequestInit = {}) =>
      fetch(`${evoUrl}${path}`, {
        ...opts,
        headers: { "Content-Type": "application/json", "apikey": GLOBAL_KEY, ...(opts.headers || {}) },
      });

    /** Fetch autenticado com instance apikey */
    const iFetch = (path: string, opts: RequestInit = {}) =>
      fetch(`${evoUrl}${path}`, {
        ...opts,
        headers: { "Content-Type": "application/json", "apikey": instToken || GLOBAL_KEY, ...(opts.headers || {}) },
      });

    // ────────────────────────────────────────────────────────────────────────
    // CREATE — cria instância e configura webhook
    // ────────────────────────────────────────────────────────────────────────
    if (action === "create") {
      const myToken    = crypto.randomUUID();
      const webhookUrl = `${SUPA_URL}/functions/v1/evolution-webhook?token=${myToken}`;
      const name       = computedName;

      const res  = await gFetch("/instance/create", {
        method: "POST",
        body: JSON.stringify({
          instanceName: name,          // Evolution GO usa "instanceName"
          name,                        // fallback para versões que usam "name"
          token:        myToken,
          qrcode:       true,          // pede QR na criação
          integration:  "WHATSAPP-BAILEYS",
          webhook: { url: webhookUrl, events: WEBHOOK_EVENTS },
          webhookUrl,                  // fallback plano para versões antigas
        }),
      });
      const data = await res.json();
      console.log("[create] status:", res.status, JSON.stringify(data).slice(0, 600));

      if (!res.ok) return json({ error: data.message || data.error || JSON.stringify(data) }, 400);

      // Evolution GO pode retornar hash.apikey ou data.token como token da instância
      const savedToken = data?.hash?.apikey || data?.data?.token || data?.token || myToken;
      // Usa nome computado como ID (mais estável que UUID para path-based endpoints)
      const savedName  = data?.instance?.instanceName || data?.data?.name || data?.name || name;
      // QR pode vir na resposta do create (qrcode: true)
      const createQr   =
        data?.qrcode?.base64 || data?.data?.Qrcode || data?.Qrcode ||
        data?.instance?.qrcode?.base64 || "";

      const finalWebhookUrl = `${SUPA_URL}/functions/v1/evolution-webhook?token=${savedToken}`;

      await supabase.from("empresas").update({
        evolution_instance_id:    savedName,
        evolution_instance_token: savedToken,
        evolution_connected:      false,
        evolution_qr_temp:        createQr || null,
      }).eq("id", empresa_id);

      // Tenta configurar webhook explicitamente caso não venha no create
      try {
        await fetch(`${evoUrl}/webhook/set`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": savedToken },
          body: JSON.stringify({ instanceName: savedName, url: finalWebhookUrl, events: WEBHOOK_EVENTS, enabled: true }),
        });
      } catch (_) { /* best-effort */ }

      return json({ success: true, instanceName: savedName, token: savedToken, webhookUrl: finalWebhookUrl, qrBase64: createQr });
    }

    if (!instToken) return json({ error: "Instância não criada. Clique em 'Conectar WhatsApp' primeiro." }, 400);

    // ────────────────────────────────────────────────────────────────────────
    // CONNECT — gera QR Code OU Pairing Code (quando phone é fornecido)
    // ────────────────────────────────────────────────────────────────────────
    if (action === "connect") {
      const { phone } = body; // número do WhatsApp para pairing code (ex: "5511999998888")
      const webhookUrl = `${SUPA_URL}/functions/v1/evolution-webhook?token=${instToken}`;

      // Configura webhook (best-effort, não bloqueia)
      fetch(`${evoUrl}/webhook/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": instToken },
        body: JSON.stringify({ instanceName: instName, url: webhookUrl, events: WEBHOOK_EVENTS, enabled: true }),
      }).catch(() => {});

      let qrBase64 = "", pairingCode = "";

      // ── PAIRING CODE via telefone ────────────────────────────────────────
      // Evolution GO: POST /instance/connect/{instanceName} com { phone } retorna pairing code
      if (phone) {
        const cleanPhone = String(phone).replace(/\D/g, "");
        try {
          const pcRes  = await iFetch(`/instance/connect/${instName}`, {
            method: "POST",
            body: JSON.stringify({ phone: cleanPhone }),
          });
          const pcData = await pcRes.json();
          console.log("[connect/pairing] status:", pcRes.status, JSON.stringify(pcData).slice(0, 300));
          pairingCode = pcData?.code || pcData?.Code || pcData?.pairingCode ||
                        pcData?.data?.code || pcData?.data?.Code || "";
          // Alguns builds retornam o QR mesmo com phone
          qrBase64 = pcData?.base64 || pcData?.qrcode?.base64 || pcData?.Qrcode || "";
        } catch (e) {
          console.error("[connect/pairing] error:", e);
        }
        if (pairingCode) {
          return json({ success: true, qrBase64, pairingCode, webhookUrl });
        }
        // Se não obteve pairing code, cai no fluxo QR normal abaixo
      }

      // ── QR CODE ──────────────────────────────────────────────────────────
      // Estratégia 1: GET /instance/connect/{instanceName}
      try {
        const qrRes  = await iFetch(`/instance/connect/${instName}`);
        const qrData = await qrRes.json();
        console.log("[connect] GET /instance/connect status:", qrRes.status, JSON.stringify(qrData).slice(0, 300));
        qrBase64    = qrData?.base64 || qrData?.qrcode?.base64 || qrData?.Qrcode || qrData?.data?.Qrcode || "";
        pairingCode = qrData?.code   || qrData?.Code           || qrData?.pairingCode || qrData?.data?.Code || "";
      } catch (_) { /* next */ }

      // Estratégia 2: POST /instance/connect com webhookUrl
      if (!qrBase64) {
        try {
          const connRes  = await iFetch("/instance/connect", {
            method: "POST",
            body: JSON.stringify({ id: instName, instanceName: instName, webhookUrl }),
          });
          const connData = await connRes.json();
          console.log("[connect] POST /instance/connect status:", connRes.status, JSON.stringify(connData).slice(0, 400));
          qrBase64    = connData?.base64 || connData?.qrcode?.base64 || connData?.Qrcode ||
                        connData?.data?.Qrcode || connData?.data?.qrcode || "";
          pairingCode = connData?.code || connData?.Code || connData?.pairingCode || "";
        } catch (_) { /* next */ }
      }

      // Estratégia 3: GET /instance/qr?id={instName} (fallback para variações de API)
      if (!qrBase64) {
        try {
          await new Promise(r => setTimeout(r, 1000));
          const qrRes  = await iFetch(`/instance/qr?id=${instName}`);
          const qrData = await qrRes.json();
          qrBase64    = qrData?.data?.Qrcode || qrData?.data?.qrcode || qrData?.Qrcode || "";
          pairingCode = qrData?.data?.Code   || qrData?.data?.code   || qrData?.Code   || "";
        } catch (_) { /* segue */ }
      }

      if (qrBase64) {
        await supabase.from("empresas").update({ evolution_qr_temp: qrBase64 }).eq("id", empresa_id);
      }

      console.log("[connect] qrBase64 length:", qrBase64.length, "pairing:", pairingCode);
      return json({ success: true, qrBase64, pairingCode, webhookUrl });
    }

    // ────────────────────────────────────────────────────────────────────────
    // QR — polling do frontend (lê banco primeiro, depois API)
    // ────────────────────────────────────────────────────────────────────────
    if (action === "qr") {
      // 1. Banco (preenchido pelo webhook QRCODE_UPDATED ou pela action connect)
      const { data: freshEmp } = await supabase
        .from("empresas")
        .select("evolution_qr_temp, evolution_connected")
        .eq("id", empresa_id)
        .single();

      if (freshEmp?.evolution_connected) return json({ data: { Connected: true } });
      if (freshEmp?.evolution_qr_temp)   return json({ data: { Qrcode: freshEmp.evolution_qr_temp } });

      // 2. Tenta GET /instance/connect/{instanceName} para buscar QR atualizado
      try {
        const qrRes  = await iFetch(`/instance/connect/${instName}`);
        const qrData = await qrRes.json();
        const qr     = qrData?.base64 || qrData?.qrcode?.base64 || qrData?.Qrcode || qrData?.data?.Qrcode || "";
        if (qr) {
          await supabase.from("empresas").update({ evolution_qr_temp: qr }).eq("id", empresa_id);
          return json({ data: { Qrcode: qr } });
        }
      } catch (_) { /* sem QR ainda */ }

      return json({ data: { Qrcode: null, Connected: false } });
    }

    // ────────────────────────────────────────────────────────────────────────
    // STATUS — verifica se WhatsApp está conectado
    // ────────────────────────────────────────────────────────────────────────
    if (action === "status") {
      try {
        // GET /instance/connectionState/{instanceName} — endpoint padrão Evolution GO
        let res = await iFetch(`/instance/connectionState/${instName}`);
        if (!res.ok) res = await gFetch(`/instance/connectionState/${instName}`);

        let isConnected = false;
        let jid = "";

        if (res.ok) {
          const data = await res.json();
          console.log("[status] connectionState:", JSON.stringify(data).slice(0, 300));
          const state =
            data?.instance?.state || data?.state || data?.data?.state ||
            data?.data?.State     || data?.State  || "";
          isConnected = state === "open";
          jid         = data?.instance?.jid || data?.jid || data?.data?.jid || "";
        } else {
          // Fallback: GET /instance/info/{instanceName} ou fetchInstances
          const infoRes  = await iFetch(`/instance/info/${instName}`);
          const infoData = await infoRes.json();
          isConnected =
            infoData?.data?.connected === true  ||
            infoData?.data?.state     === "open" ||
            infoData?.data?.State     === "open" ||
            infoData?.connected       === true;
          jid = infoData?.data?.jid || "";
        }

        if (isConnected) {
          const phone = jid.replace(/@s\.whatsapp\.net$/, "").replace(/:.*$/, "");
          await supabase.from("empresas").update({
            evolution_connected: true,
            evolution_qr_temp:   null,
            ...(phone ? { evolution_phone: phone } : {}),
          }).eq("id", empresa_id);
        } else {
          await supabase.from("empresas").update({ evolution_connected: false }).eq("id", empresa_id);
        }
        return json({ data: { Connected: isConnected, LoggedIn: isConnected, jid } });
      } catch (_) {
        const { data: freshEmp } = await supabase
          .from("empresas").select("evolution_connected").eq("id", empresa_id).single();
        const c = freshEmp?.evolution_connected || false;
        return json({ data: { Connected: c, LoggedIn: c } });
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // RESET WEBHOOK — reconfigura URL do webhook na instância
    // ────────────────────────────────────────────────────────────────────────
    if (action === "resetWebhook") {
      const webhookUrl = `${SUPA_URL}/functions/v1/evolution-webhook?token=${instToken}`;
      try {
        // Tenta /webhook/set (endpoint dedicado)
        const r1 = await fetch(`${evoUrl}/webhook/set`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": instToken },
          body: JSON.stringify({ instanceName: instName, url: webhookUrl, events: WEBHOOK_EVENTS, enabled: true }),
        });
        if (!r1.ok) {
          // Fallback: POST /instance/connect com webhookUrl (não usa GET para não gerar novo QR)
          await iFetch("/instance/connect", {
            method: "POST",
            body: JSON.stringify({ instanceName: instName, webhookUrl }),
          });
        }
        return json({ success: true, webhookUrl });
      } catch (e) {
        return json({ error: (e as Error).message }, 500);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // SEND — envia mensagem de texto via WhatsApp
    // ────────────────────────────────────────────────────────────────────────
    if (action === "send") {
      const { phone, message } = body;
      if (!phone || !message) return json({ error: "phone e message obrigatórios" }, 400);

      const cleanPhone = String(phone).replace(/\D/g, "");

      // Evolution GO: POST /send/text com {instanceName, number, text}
      // (também suporta formato antigo {id, number, text})
      const res = await iFetch("/send/text", {
        method: "POST",
        body: JSON.stringify({
          instanceName: instName,
          id:           instName,
          number:       cleanPhone,
          text:         message,
        }),
      });
      const resData = await res.json();
      console.log("[send] status:", res.status, "to:", cleanPhone, JSON.stringify(resData).slice(0, 300));

      if (!res.ok) return json({ error: resData.message || resData.error || JSON.stringify(resData) }, res.status);
      return json(resData);
    }

    // ────────────────────────────────────────────────────────────────────────
    // LOGOUT / DISCONNECT — desconecta WhatsApp
    // ────────────────────────────────────────────────────────────────────────
    if (action === "disconnect" || action === "logout") {
      try {
        // DELETE /instance/logout/{instanceName} — padrão Evolution GO
        await iFetch(`/instance/logout/${instName}`, { method: "DELETE" });
      } catch (_) {
        // Fallback: DELETE /instance/logout com body
        try {
          await iFetch("/instance/logout", {
            method: "DELETE",
            body: JSON.stringify({ instanceName: instName }),
          });
        } catch (_) { /* best-effort */ }
      }
      await supabase.from("empresas").update({
        evolution_connected: false,
        evolution_qr_temp:   null,
      }).eq("id", empresa_id);
      return json({ success: true });
    }

    // ────────────────────────────────────────────────────────────────────────
    // RECONNECT — tenta reconectar sem gerar novo QR
    // ────────────────────────────────────────────────────────────────────────
    if (action === "reconnect") {
      try {
        const res  = await iFetch(`/instance/restart/${instName}`, { method: "PUT" });
        const data = await res.json();
        console.log("[reconnect] status:", res.status, JSON.stringify(data).slice(0, 200));
        return json({ success: true, data });
      } catch (e) {
        return json({ error: (e as Error).message }, 500);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // BROADCAST — dispara campanha para lista de contatos com intervalo aleatório
    // ────────────────────────────────────────────────────────────────────────
    if (action === "broadcast") {
      const { campanha_id } = body;
      if (!campanha_id) return json({ error: "campanha_id obrigatório" }, 400);

      const { data: camp } = await supabase.from("campanhas")
        .select("id, mensagem, intervalo_min, intervalo_max, total_contatos")
        .eq("id", campanha_id).eq("empresa_id", empresa_id).single();
      if (!camp) return json({ error: "Campanha não encontrada" }, 404);

      const { data: contatos } = await supabase.from("transmissao_contatos")
        .select("id, nome, telefone").eq("campanha_id", campanha_id).eq("status", "pendente");
      if (!contatos?.length) return json({ error: "Nenhum contato pendente" }, 400);

      // Marca campanha como enviando
      await supabase.from("campanhas").update({ status: "enviando", enviados: 0 }).eq("id", campanha_id);

      let enviados = 0;
      const minMs = (camp.intervalo_min || 5) * 1000;
      const maxMs = (camp.intervalo_max || 15) * 1000;

      for (const contato of contatos) {
        try {
          const mensagem = (camp.mensagem as string)
            .replace(/\{nome\}/gi, contato.nome || "")
            .replace(/\{telefone\}/gi, contato.telefone || "");

          const res = await iFetch("/send/text", {
            method: "POST",
            body: JSON.stringify({
              instanceName: instName, id: instName,
              number: String(contato.telefone).replace(/\D/g, ""),
              text: mensagem,
            }),
          });

          if (res.ok) {
            await supabase.from("transmissao_contatos")
              .update({ status: "enviado", enviado_em: new Date().toISOString() }).eq("id", contato.id);
            enviados++;
          } else {
            const err = await res.text();
            await supabase.from("transmissao_contatos")
              .update({ status: "falhou", erro_msg: err.slice(0, 200) }).eq("id", contato.id);
          }

          await supabase.from("campanhas").update({ enviados }).eq("id", campanha_id);

          // Intervalo aleatório entre mensagens para evitar bloqueio
          const delay = minMs + Math.random() * (maxMs - minMs);
          await new Promise(r => setTimeout(r, delay));
        } catch (e) {
          await supabase.from("transmissao_contatos")
            .update({ status: "falhou", erro_msg: (e as Error).message }).eq("id", contato.id);
        }
      }

      await supabase.from("campanhas").update({ status: "concluido", enviados }).eq("id", campanha_id);
      return json({ success: true, enviados });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error("evolution-action error:", e);
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});
