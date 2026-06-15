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

  // Credenciais do servidor Evolution API — altere aqui se mudar o servidor.
  // Não lê variável de ambiente para evitar sobrescrever com valor inválido de sessão anterior.
  const GLOBAL_KEY = "C4@Hub123#@#";
  const GLOBAL_URL = "http://18.230.11.58:8080";
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
          instanceName:    name,
          name,
          token:           myToken,
          qrcode:          true,
          integration:     "WHATSAPP-BAILEYS",
          // webhookByEvents: false garante que o Evolution API NÃO append
          // "/event-name" ao token na URL, evitando 404 nas Edge Functions
          webhookByEvents: false,
          webhook_by_events: false,
          syncFullHistory: true,
          webhook: {
            url:            webhookUrl,
            events:         WEBHOOK_EVENTS,
            webhookByEvents: false,
            base64:         true,       // imagens/áudios em base64
          },
          webhookUrl,
        }),
      });
      const data = await res.json();
      console.log("[create] status:", res.status, JSON.stringify(data).slice(0, 600));

      if (!res.ok) return json({ error: data.message || data.error || JSON.stringify(data) }, 400);

      const savedToken = data?.hash?.apikey || data?.data?.token || data?.token || myToken;
      const savedName  = data?.instance?.instanceName || data?.data?.name || data?.name || name;
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

      // Configura webhook explicitamente com webhookByEvents=false
      try {
        await fetch(`${evoUrl}/webhook/set`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": savedToken },
          body: JSON.stringify({
            instanceName:    savedName,
            url:             finalWebhookUrl,
            events:          WEBHOOK_EVENTS,
            enabled:         true,
            webhookByEvents: false,
            base64:          true,
          }),
        });
      } catch (_) { /* best-effort */ }

      return json({ success: true, instanceName: savedName, token: savedToken, webhookUrl: finalWebhookUrl, qrBase64: createQr });
    }

    // Guard: bloqueia ações que precisam de instância (exceto connect que auto-cria)
    if (!instToken && action !== "connect") {
      return json({ error: "Instância não criada. Clique em 'Conectar WhatsApp' primeiro." }, 400);
    }

    // ────────────────────────────────────────────────────────────────────────
    // CONNECT — gera QR Code
    //   • Se não há instância no banco → cria nova automaticamente
    //   • Se há instância no banco mas foi deletada na API → detecta e recria
    //   • webhookByEvents: false para evitar sufixo de evento na URL do webhook
    //   • base64: true para imagens e áudios inline
    //   • syncFullHistory: true para sincronizar histórico completo
    // ────────────────────────────────────────────────────────────────────────
    if (action === "connect") {
      let effectiveToken = instToken;
      let effectiveName  = instName;

      /** Cria instância do zero e devolve { effectiveToken, effectiveName, immediateQr } */
      const createFresh = async () => {
        const myToken = crypto.randomUUID();
        const whUrl   = `${SUPA_URL}/functions/v1/evolution-webhook?token=${myToken}`;
        const name    = computedName;

        // Salva token ANTES de chamar a API para evitar race condition com webhooks
        await supabase.from("empresas").update({
          evolution_instance_id:    name,
          evolution_instance_token: myToken,
          evolution_connected:      false,
          evolution_qr_temp:        null,
        }).eq("id", empresa_id);

        const cr = await gFetch("/instance/create", {
          method: "POST",
          body: JSON.stringify({
            instanceName:    name,
            name,
            token:           myToken,
            qrcode:          true,
            integration:     "WHATSAPP-BAILEYS",
            syncFullHistory: true,
            webhookByEvents: false,
            webhook_by_events: false,
            webhook: {
              url:             whUrl,
              events:          WEBHOOK_EVENTS,
              webhookByEvents: false,
              base64:          true,
            },
            webhookUrl: whUrl,
          }),
        });
        const cd = await cr.json();
        console.log("[connect] createFresh status:", cr.status, JSON.stringify(cd).slice(0, 400));

        if (!cr.ok) {
          await supabase.from("empresas").update({
            evolution_instance_id: null, evolution_instance_token: null,
          }).eq("id", empresa_id);
          throw new Error(cd.message || cd.error || JSON.stringify(cd));
        }

        const tok  = cd?.hash?.apikey || cd?.data?.token || cd?.token || myToken;
        const nm   = cd?.instance?.instanceName || cd?.data?.name || cd?.name || name;
        const qr   = cd?.qrcode?.base64 || cd?.data?.Qrcode || cd?.Qrcode || cd?.instance?.qrcode?.base64 || "";

        await supabase.from("empresas").update({
          evolution_instance_id:    nm,
          evolution_instance_token: tok,
          evolution_connected:      false,
          evolution_qr_temp:        qr || null,
        }).eq("id", empresa_id);

        // Configura webhook explicitamente com webhookByEvents=false
        fetch(`${evoUrl}/webhook/set`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": tok },
          body: JSON.stringify({
            instanceName:    nm,
            url:             `${SUPA_URL}/functions/v1/evolution-webhook?token=${tok}`,
            events:          WEBHOOK_EVENTS,
            enabled:         true,
            webhookByEvents: false,
            base64:          true,
          }),
        }).catch(() => {});

        return { tok, nm, qr };
      };

      // ── Caso 1: sem instância no banco → cria nova ────────────────────────
      if (!effectiveToken) {
        try {
          const { tok, nm, qr } = await createFresh();
          effectiveToken = tok;
          effectiveName  = nm;
          if (qr) return json({ success: true, qrBase64: qr, newInstance: true,
            webhookUrl: `${SUPA_URL}/functions/v1/evolution-webhook?token=${tok}` });
        } catch (e) {
          return json({ error: (e as Error).message }, 400);
        }
      }

      const webhookUrl = `${SUPA_URL}/functions/v1/evolution-webhook?token=${effectiveToken}`;

      const cFetch = (path: string, opts: RequestInit = {}) =>
        fetch(`${evoUrl}${path}`, {
          ...opts,
          headers: { "Content-Type": "application/json", "apikey": effectiveToken || GLOBAL_KEY, ...(opts.headers || {}) },
        });

      // Atualiza webhook para garantir webhookByEvents=false (best-effort)
      fetch(`${evoUrl}/webhook/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": effectiveToken },
        body: JSON.stringify({
          instanceName:    effectiveName,
          url:             webhookUrl,
          events:          WEBHOOK_EVENTS,
          enabled:         true,
          webhookByEvents: false,
          base64:          true,
        }),
      }).catch(() => {});

      let qrBase64 = "";
      const tried: string[] = [];
      let instanceMissing = false;  // sinaliza instância deletada na API

      const extractQr = (d: Record<string, unknown>): string =>
        (d?.base64 || d?.qrcode?.base64 || d?.Qrcode || d?.data?.Qrcode ||
         d?.data?.qrcode || d?.instance?.qrcode?.base64 || "") as string;

      const isMissingResponse = (status: number, d: Record<string, unknown>): boolean => {
        const sc = (d?.statusCode ?? d?.status ?? status) as number;
        const msg = ((d?.message || d?.error || d?.response || "") as string).toLowerCase();
        return sc === 404 || sc === 401 ||
          msg.includes("not found") || msg.includes("no instance") ||
          msg.includes("not exists") || msg.includes("doesn't exist") ||
          msg.includes("instance not") || msg.includes("unauthorized") ||
          msg.includes("bad request");
      };

      // Estratégia 1: GET /instance/connect/{name} com token da instância
      try {
        const r = await cFetch(`/instance/connect/${effectiveName}`);
        const d = await r.json();
        console.log("[connect] S1 status:", r.status, JSON.stringify(d).slice(0, 400));
        tried.push(`S1:${r.status}`);
        if (!r.ok) instanceMissing = isMissingResponse(r.status, d);
        qrBase64 = extractQr(d);
        const state = d?.instance?.state || d?.state || d?.data?.state || "";
        if (!qrBase64 && state === "open") {
          await supabase.from("empresas").update({ evolution_connected: true, evolution_qr_temp: null }).eq("id", empresa_id);
          return json({ success: true, alreadyConnected: true, webhookUrl });
        }
      } catch (e) { tried.push("S1:err"); instanceMissing = true; }

      // Estratégia 2: GET com global apikey
      if (!qrBase64 && !instanceMissing) {
        try {
          const r = await gFetch(`/instance/connect/${effectiveName}`);
          const d = await r.json();
          console.log("[connect] S2 status:", r.status, JSON.stringify(d).slice(0, 400));
          tried.push(`S2:${r.status}`);
          if (!r.ok) instanceMissing = isMissingResponse(r.status, d);
          qrBase64 = extractQr(d);
        } catch (e) { tried.push("S2:err"); instanceMissing = true; }
      }

      // Estratégia 3: POST /instance/connect
      if (!qrBase64 && !instanceMissing) {
        try {
          const r = await cFetch("/instance/connect", {
            method: "POST",
            body: JSON.stringify({ id: effectiveName, instanceName: effectiveName, webhookUrl, qrcode: true }),
          });
          const d = await r.json();
          console.log("[connect] S3 status:", r.status, JSON.stringify(d).slice(0, 400));
          tried.push(`S3:${r.status}`);
          qrBase64 = extractQr(d);
        } catch (e) { tried.push("S3:err"); }
      }

      // Estratégia 4: GET /instance/qr
      if (!qrBase64 && !instanceMissing) {
        try {
          await new Promise(r => setTimeout(r, 800));
          const r = await cFetch(`/instance/qr?id=${effectiveName}`);
          const d = await r.json();
          console.log("[connect] S4 status:", r.status, JSON.stringify(d).slice(0, 400));
          tried.push(`S4:${r.status}`);
          qrBase64 = extractQr(d) || (d?.data?.Qrcode ?? "");
        } catch (e) { tried.push("S4:err"); }
      }

      console.log("[connect] qrBase64 length:", qrBase64.length, "tried:", tried.join(", "), "instanceMissing:", instanceMissing);

      // ── Caso 2/3: sem QR → recria instância (cobre instâncias deletadas E migração de servidor) ──
      if (!qrBase64) {
        console.log("[connect] sem QR — recriando instância no servidor atual...");
        // Best-effort delete para evitar conflito de nome
        try { await gFetch(`/instance/delete/${effectiveName}`, { method: "DELETE" }); } catch (_) {}
        try {
          const { tok, nm, qr } = await createFresh();
          effectiveToken = tok;
          effectiveName  = nm;
          if (qr) return json({ success: true, qrBase64: qr, newInstance: true,
            webhookUrl: `${SUPA_URL}/functions/v1/evolution-webhook?token=${tok}` });

          // QR não veio no create — servidor precisa de alguns segundos para inicializar.
          // Polling agressivo: tenta 5x com 2.5s de intervalo (total ~14s).
          await new Promise(r => setTimeout(r, 2000));
          for (let i = 0; i < 5; i++) {
            const r2 = await fetch(`${evoUrl}/instance/connect/${nm}`, {
              headers: { "Content-Type": "application/json", "apikey": tok },
            });
            const d2 = await r2.json();
            console.log(`[connect] post-create poll ${i + 1}/5:`, r2.status, JSON.stringify(d2).slice(0, 300));
            qrBase64 = extractQr(d2);
            if (qrBase64) {
              await supabase.from("empresas").update({ evolution_qr_temp: qrBase64 }).eq("id", empresa_id);
              return json({ success: true, qrBase64, newInstance: true,
                webhookUrl: `${SUPA_URL}/functions/v1/evolution-webhook?token=${tok}` });
            }
            if (i < 4) await new Promise(r => setTimeout(r, 2500));
          }

          // Instância criada mas QR ainda não disponível — retorna 200 com flag needsRetry
          // para o frontend mostrar mensagem amigável (não erro) e pedir que tente novamente.
          return json({ success: true, qrBase64: "", newInstance: true, needsRetry: true,
            webhookUrl: `${SUPA_URL}/functions/v1/evolution-webhook?token=${tok}` });
        } catch (e) {
          return json({ error: `Falha ao criar instância: ${(e as Error).message}` }, 400);
        }
      }

      await supabase.from("empresas").update({ evolution_qr_temp: qrBase64 }).eq("id", empresa_id);
      return json({ success: true, qrBase64, webhookUrl });
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
      const webhookBody = {
        instanceName:    instName,
        url:             webhookUrl,
        events:          WEBHOOK_EVENTS,
        enabled:         true,
        webhookByEvents: false,   // evita sufixo /event-name na URL
        base64:          true,    // imagens e áudios em base64
      };
      try {
        const r1 = await fetch(`${evoUrl}/webhook/set`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": instToken },
          body: JSON.stringify(webhookBody),
        });
        if (!r1.ok) {
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
    // Tenta 3 formatos de endpoint para compatibilidade com Evolution API v2
    // (Node.js) e Evolution GO, sem depender da versão instalada.
    // ────────────────────────────────────────────────────────────────────────
    if (action === "send") {
      const { phone, message } = body;
      if (!phone || !message) return json({ error: "phone e message obrigatórios" }, 400);

      // Preserva @g.us para grupos e @s.whatsapp.net para individuais.
      const rawPhone   = String(phone).trim();
      const cleanPhone = rawPhone.includes("@") ? rawPhone : rawPhone.replace(/\D/g, "");

      let lastErr    = "Falha ao enviar mensagem";
      let lastStatus = 400;

      // ── Tentativa 1: Evolution API v2 — POST /message/sendText/{instanceName}
      // Formato básico: { number, text }
      try {
        const r1 = await iFetch(`/message/sendText/${instName}`, {
          method: "POST",
          body: JSON.stringify({ number: cleanPhone, text: message }),
        });
        const d1 = await r1.json().catch(() => ({}));
        console.log("[send] v2-basic status:", r1.status, JSON.stringify(d1).slice(0, 200));
        if (r1.ok) return json(d1);
        lastErr    = d1.message || d1.error || JSON.stringify(d1);
        lastStatus = r1.status;
      } catch (e) { console.log("[send] v2-basic err:", (e as Error).message); }

      // ── Tentativa 2: Evolution API v2 — formato com textMessage + options
      try {
        const r2 = await iFetch(`/message/sendText/${instName}`, {
          method: "POST",
          body: JSON.stringify({
            number:      cleanPhone,
            options:     { delay: 1200, presence: "composing", linkPreview: false },
            textMessage: { text: message },
          }),
        });
        const d2 = await r2.json().catch(() => ({}));
        console.log("[send] v2-ext status:", r2.status, JSON.stringify(d2).slice(0, 200));
        if (r2.ok) return json(d2);
        lastErr    = d2.message || d2.error || JSON.stringify(d2);
        lastStatus = r2.status;
      } catch (e) { console.log("[send] v2-ext err:", (e as Error).message); }

      // ── Tentativa 3: Evolution GO — POST /send/text
      try {
        const r3 = await iFetch("/send/text", {
          method: "POST",
          body: JSON.stringify({
            instanceName: instName,
            id:           instName,
            number:       cleanPhone,
            text:         message,
          }),
        });
        const d3 = await r3.json().catch(() => ({}));
        console.log("[send] go status:", r3.status, JSON.stringify(d3).slice(0, 200));
        if (r3.ok) return json(d3);
        lastErr    = d3.message || d3.error || JSON.stringify(d3);
        lastStatus = r3.status;
      } catch (e) { console.log("[send] go err:", (e as Error).message); }

      // Todas as tentativas falharam — retorna o último erro com status 400
      // (garante que o frontend receba corpo legível em vez de status HTTP arbitrário)
      return json({ error: lastErr }, 400);
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
    // Suporta: texto, imagem, vídeo, áudio, documento, PIX
    // ────────────────────────────────────────────────────────────────────────
    if (action === "broadcast") {
      const { campanha_id } = body;
      if (!campanha_id) return json({ error: "campanha_id obrigatório" }, 400);

      const { data: camp } = await supabase.from("campanhas")
        .select("id, mensagem, intervalo_min, intervalo_max, total_contatos, tipo_midia, url_midia, chave_pix, caption")
        .eq("id", campanha_id).eq("empresa_id", empresa_id).single();
      if (!camp) return json({ error: "Campanha não encontrada" }, 404);

      const { data: contatos } = await supabase.from("transmissao_contatos")
        .select("id, nome, telefone, empresa").eq("campanha_id", campanha_id).eq("status", "pendente");
      if (!contatos?.length) return json({ error: "Nenhum contato pendente" }, 400);

      // Marca campanha como enviando
      await supabase.from("campanhas").update({ status: "enviando", enviados: 0 }).eq("id", campanha_id);

      let enviados = 0;
      const minMs = (camp.intervalo_min || 5) * 1000;
      const maxMs = (camp.intervalo_max || 15) * 1000;
      const tipoMidia = (camp.tipo_midia as string) || "texto";

      // Mapa de tipo de mídia → mediatype da Evolution API
      const mediaTypeMap: Record<string, string> = {
        imagem: "image", video: "video", audio: "audio", documento: "document",
      };

      const sendMsg = async (num: string, texto: string): Promise<boolean> => {
        for (const [path, bd] of [
          [`/message/sendText/${instName}`, JSON.stringify({ number: num, text: texto })],
          ["/send/text", JSON.stringify({ instanceName: instName, id: instName, number: num, text: texto })],
        ] as [string, string][]) {
          const res = await iFetch(path, { method: "POST", body: bd }).catch(() => null);
          if (res?.ok) return true;
        }
        return false;
      };

      const getMimetype = (url: string, type: string): string => {
        const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
        const mm: Record<string, string> = {
          jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", gif:"image/gif", webp:"image/webp",
          mp4:"video/mp4", mov:"video/quicktime", webm:"video/webm",
          mp3:"audio/mpeg", ogg:"audio/ogg", wav:"audio/wav", m4a:"audio/mp4",
          pdf:"application/pdf", doc:"application/msword",
          docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        };
        return mm[ext] || (type==="image"?"image/jpeg":type==="video"?"video/mp4":type==="audio"?"audio/mpeg":"application/octet-stream");
      };

      const sendMedia = async (num: string, mediatype: string, mediaUrl: string, caption: string): Promise<{ ok: boolean; err: string }> => {
        const fileName = decodeURIComponent(mediaUrl.split("?")[0].split("/").pop() || "file");
        const mimetype = getMimetype(mediaUrl, mediatype);

        // Áudio: Evolution API Baileys usa /message/sendWhatsAppAudio (converte para ogg/opus automaticamente)
        if (mediatype === "audio") {
          try {
            const r1 = await iFetch(`/message/sendWhatsAppAudio/${instName}`, {
              method: "POST",
              body: JSON.stringify({ number: num, audio: mediaUrl, encoding: true }),
            });
            const d1 = await r1.json().catch(() => ({}));
            console.log("[broadcast] sendWhatsAppAudio status:", r1.status, JSON.stringify(d1).slice(0, 200));
            if (r1.ok) return { ok: true, err: "" };
            // Tentativa 2: sendMedia com audio
            const r2 = await iFetch(`/message/sendMedia/${instName}`, {
              method: "POST",
              body: JSON.stringify({ number: num, mediatype: "audio", mimetype, media: mediaUrl }),
            });
            const d2 = await r2.json().catch(() => ({}));
            console.log("[broadcast] sendMedia audio status:", r2.status, JSON.stringify(d2).slice(0, 200));
            if (r2.ok) return { ok: true, err: "" };
            return { ok: false, err: JSON.stringify(d2 || d1).slice(0, 300) };
          } catch (e) { return { ok: false, err: (e as Error).message }; }
        }

        // Imagem, vídeo, documento
        const payload = { number: num, mediatype, mimetype, media: mediaUrl, caption, fileName };

        // Tentativa 1: /message/sendMedia v2 com mimetype
        try {
          const r1 = await iFetch(`/message/sendMedia/${instName}`, {
            method: "POST", body: JSON.stringify(payload),
          });
          const d1 = await r1.json().catch(() => ({}));
          console.log("[broadcast] sendMedia v2 status:", r1.status, JSON.stringify(d1).slice(0, 200));
          if (r1.ok) return { ok: true, err: "" };

          // Tentativa 2: com options/delay
          const r2 = await iFetch(`/message/sendMedia/${instName}`, {
            method: "POST",
            body: JSON.stringify({ number: num, options: { delay: 1200, presence: "composing" }, ...payload }),
          });
          const d2 = await r2.json().catch(() => ({}));
          console.log("[broadcast] sendMedia v2+opts status:", r2.status, JSON.stringify(d2).slice(0, 200));
          if (r2.ok) return { ok: true, err: "" };

          // Tentativa 3: mediaMessage aninhado
          const r3 = await iFetch(`/message/sendMedia/${instName}`, {
            method: "POST",
            body: JSON.stringify({ number: num, mediaMessage: { mediatype, mimetype, media: mediaUrl, caption, fileName } }),
          });
          const d3 = await r3.json().catch(() => ({}));
          console.log("[broadcast] sendMedia nested status:", r3.status, JSON.stringify(d3).slice(0, 200));
          if (r3.ok) return { ok: true, err: "" };

          return { ok: false, err: (JSON.stringify(d3 || d2 || d1)).slice(0, 300) };
        } catch (e) { return { ok: false, err: (e as Error).message }; }
      };

      for (const contato of contatos) {
        try {
          const num = String(contato.telefone).replace(/\D/g, "");
          const interpolate = (t: string) => t
            .replace(/\{nome\}/gi, (contato as Record<string, string>).nome || "")
            .replace(/\{empresa\}/gi, (contato as Record<string, string>).empresa || "")
            .replace(/\{telefone\}/gi, num);

          const mensagem = interpolate((camp.mensagem as string) || "");
          let sent = false;

          if (tipoMidia === "pix") {
            // PIX: mensagem de texto + chave PIX em destaque
            const pixKey = (camp.chave_pix as string) || "";
            const texto  = pixKey ? `${mensagem}\n\n💳 *Chave PIX:* ${pixKey}` : mensagem;
            sent = await sendMsg(num, texto);

          } else if (tipoMidia !== "texto" && camp.url_midia) {
            // Mídia (imagem, vídeo, áudio, documento)
            const mediatype = mediaTypeMap[tipoMidia] || "image";
            const caption   = interpolate((camp.caption as string) || mensagem);
            const mResult   = await sendMedia(num, mediatype, camp.url_midia as string, caption);
            sent = mResult.ok;
            if (!mResult.ok) {
              await supabase.from("transmissao_contatos")
                .update({ status: "falhou", erro_msg: mResult.err || "Falha ao enviar mídia" }).eq("id", contato.id);
              await supabase.from("campanhas").update({ enviados }).eq("id", campanha_id);
              const delay2 = minMs + Math.random() * (maxMs - minMs);
              await new Promise(r => setTimeout(r, delay2));
              continue;
            }

          } else {
            // Texto simples
            sent = await sendMsg(num, mensagem);
          }

          if (sent) {
            await supabase.from("transmissao_contatos")
              .update({ status: "enviado", enviado_em: new Date().toISOString() }).eq("id", contato.id);
            enviados++;
          } else {
            await supabase.from("transmissao_contatos")
              .update({ status: "falhou", erro_msg: "Falha ao enviar" }).eq("id", contato.id);
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

    // ────────────────────────────────────────────────────────────────────────
    // IMPORT HISTORY — busca mensagens antigas via REST e envia ao webhook
    // ────────────────────────────────────────────────────────────────────────
    if (action === "importHistory") {
      const startPage = Number(body.page) || 1;
      const pageSize  = 50;
      const maxPages  = 4; // 200 msgs por chamada (dentro do timeout de 60s)
      const webhookUrl = `${SUPA_URL}/functions/v1/evolution-webhook?token=${instToken}`;

      let imported = 0;
      let total    = 0;
      let pages    = 0;

      for (let p = startPage; p < startPage + maxPages; p++) {
        try {
          const res = await iFetch(`/chat/findMessages/${instName}`, {
            method: "POST",
            body: JSON.stringify({ limit: pageSize, page: p }),
          });
          if (!res.ok) break;
          const d = await res.json();
          const records = d?.messages?.records || [];
          total = d?.messages?.total  || total;
          pages = d?.messages?.pages  || pages;
          if (!records.length) break;

          // Envia ao webhook como HISTORY_SYNC — aproveita toda a lógica de dedup
          const wh = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "HISTORY_SYNC", data: { messages: records } }),
          });
          if (wh.ok) imported += records.length;
          if (p >= pages) break;
        } catch (e) {
          console.error("[importHistory] page", p, "error:", e);
          break;
        }
      }

      const nextPage = startPage + maxPages;
      return json({
        success: true,
        imported,
        total,
        pages,
        nextPage: nextPage <= pages ? nextPage : null,
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // FETCH GROUPS — lista grupos do WhatsApp e sincroniza nomes no banco
    // ────────────────────────────────────────────────────────────────────────
    if (action === "fetchGroups") {
      type GroupEntry = { id: string; subject?: string; name?: string; [k: string]: unknown };
      let groupList: GroupEntry[] = [];

      // Endpoint 1: GET /group/fetchAllGroups/{instanceName}?getParticipants=false
      try {
        const r1 = await iFetch(`/group/fetchAllGroups/${instName}?getParticipants=false`);
        if (r1.ok) {
          const d1 = await r1.json();
          const arr: GroupEntry[] = Array.isArray(d1) ? d1 : (d1?.groups || d1?.data || []);
          if (arr.length) groupList = arr;
        }
      } catch (_) { /* endpoint pode não existir */ }

      // Endpoint 2: POST fallback
      if (!groupList.length) {
        try {
          const r2 = await iFetch(`/group/fetchAllGroups/${instName}`, {
            method: "POST",
            body: JSON.stringify({ getParticipants: false }),
          });
          if (r2.ok) {
            const d2 = await r2.json();
            const arr: GroupEntry[] = Array.isArray(d2) ? d2 : (d2?.groups || d2?.data || []);
            if (arr.length) groupList = arr;
          }
        } catch (_) { /* sem grupos ou endpoint indisponível */ }
      }

      let updated = 0;
      let created = 0;
      for (const g of groupList) {
        const gJid    = g.id?.includes("@g.us") ? g.id : (g.id ? `${g.id}@g.us` : null);
        const subject = (g.subject || g.name || "") as string;
        if (!gJid || !subject) continue;

        const { data: existing } = await supabase.from("conversas")
          .select("id").eq("empresa_id", empresa_id).eq("contato_telefone", gJid).maybeSingle();

        if (existing) {
          await supabase.from("conversas")
            .update({ contato_nome: subject }).eq("id", existing.id);
          updated++;
        } else {
          await supabase.from("conversas").insert({
            empresa_id,
            contato_nome:     subject,
            contato_telefone: gJid,
            ultima_mensagem:  "",
            ultima_hora:      new Date().toISOString(),
            nao_lidas:        0,
            status:           "aberta",
            bot_ativo:        false,
          });
          created++;
        }
      }

      return json({ success: true, total: groupList.length, updated, created });
    }

    // ── FETCH CONTACTS — busca contatos do WhatsApp
    if (action === "fetchContacts") {
      type ContactEntry = { id: string; pushName?: string; name?: string; number?: string; [k: string]: unknown };
      let contactList: ContactEntry[] = [];

      // Endpoint 1: GET /contact/findContacts/{instanceName}
      try {
        const r1 = await iFetch(`/contact/findContacts/${instName}`);
        if (r1.ok) {
          const d1 = await r1.json();
          const arr: ContactEntry[] = Array.isArray(d1) ? d1 : (d1?.contacts || d1?.data || []);
          if (arr.length) contactList = arr;
        }
      } catch (_) {}

      // Endpoint 2: POST fallback
      if (!contactList.length) {
        try {
          const r2 = await iFetch(`/contact/findContacts/${instName}`, {
            method: "POST",
            body: JSON.stringify({ instanceName: instName }),
          });
          if (r2.ok) {
            const d2 = await r2.json();
            const arr: ContactEntry[] = Array.isArray(d2) ? d2 : (d2?.contacts || d2?.data || []);
            if (arr.length) contactList = arr;
          }
        } catch (_) {}
      }

      // Filtra apenas contatos individuais (não grupos) e formata
      const contacts = contactList
        .filter(c => c.id && !c.id.endsWith("@g.us") && !c.id.endsWith("@broadcast"))
        .map(c => ({
          id:       c.id,
          nome:     c.pushName || c.name || c.id.replace("@s.whatsapp.net", ""),
          numero:   (c.number || c.id.replace("@s.whatsapp.net", "")).replace(/\D/g, ""),
          pushName: c.pushName || "",
        }));

      return json({ success: true, contacts, total: contacts.length });
    }

    // ── SYNC ALL — força sincronização completa de conversas e grupos
    if (action === "syncAll") {
      const results: Record<string, unknown> = {};

      // 1. Busca grupos
      try {
        type GroupEntry2 = { id: string; subject?: string; name?: string; [k: string]: unknown };
        let groupList: GroupEntry2[] = [];
        const rg = await iFetch(`/group/fetchAllGroups/${instName}?getParticipants=false`);
        if (rg.ok) {
          const dg = await rg.json();
          groupList = Array.isArray(dg) ? dg : (dg?.groups || dg?.data || []);
        }
        let gUpdated = 0, gCreated = 0;
        for (const g of groupList) {
          const gJid = g.id?.includes("@g.us") ? g.id : (g.id ? `${g.id}@g.us` : null);
          const subject = (g.subject || g.name || "") as string;
          if (!gJid || !subject) continue;
          const { data: ex } = await supabase.from("conversas").select("id").eq("empresa_id", empresa_id).eq("contato_telefone", gJid).maybeSingle();
          if (ex) { await supabase.from("conversas").update({ contato_nome: subject }).eq("id", ex.id); gUpdated++; }
          else { await supabase.from("conversas").insert({ empresa_id, contato_nome: subject, contato_telefone: gJid, ultima_mensagem: "", ultima_hora: new Date().toISOString(), nao_lidas: 0, status: "aberta", bot_ativo: false }); gCreated++; }
        }
        results.grupos = { total: groupList.length, updated: gUpdated, created: gCreated };
      } catch (e) { results.grupos = { error: (e as Error).message }; }

      // 2. Importa histórico (primeiras 200 mensagens)
      const webhookUrl = `${SUPA_URL}/functions/v1/evolution-webhook?token=${instToken}`;
      let imported = 0;
      try {
        for (let p = 1; p <= 4; p++) {
          const res = await iFetch(`/chat/findMessages/${instName}`, { method: "POST", body: JSON.stringify({ limit: 50, page: p }) });
          if (!res.ok) break;
          const d = await res.json();
          const records = d?.messages?.records || [];
          if (!records.length) break;
          const wh = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "HISTORY_SYNC", data: { messages: records } }) });
          if (wh.ok) imported += records.length;
          if (p >= (d?.messages?.pages || 1)) break;
        }
      } catch (_) {}
      results.historico = { imported };

      return json({ success: true, ...results });
    }

    // ────────────────────────────────────────────────────────────────────────
    // SEND MEDIA — envia imagem/vídeo/áudio/documento pelo chat
    // ────────────────────────────────────────────────────────────────────────
    if (action === "sendMedia") {
      const { phone, url: mediaUrl, tipo, caption } = body;
      if (!phone || !mediaUrl) return json({ error: "phone e url obrigatórios" }, 400);

      const rawPhone   = String(phone).trim();
      const cleanPhone = rawPhone.includes("@") ? rawPhone : rawPhone.replace(/\D/g, "");

      const mediaTypeMap: Record<string, string> = {
        imagem: "image", video: "video", audio: "audio", documento: "document",
      };
      const mediatype = mediaTypeMap[tipo as string] || "image";
      const cap = (caption as string) || "";

      const getExt = (url: string) => url.split("?")[0].split(".").pop()?.toLowerCase() || "";
      const getMime = (url: string, type: string): string => {
        const mm: Record<string, string> = {
          jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", gif:"image/gif", webp:"image/webp",
          mp4:"video/mp4", mov:"video/quicktime", webm:"video/webm",
          mp3:"audio/mpeg", ogg:"audio/ogg", wav:"audio/wav", m4a:"audio/mp4",
          pdf:"application/pdf", doc:"application/msword",
          docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        };
        return mm[getExt(url)] || (type==="image"?"image/jpeg":type==="video"?"video/mp4":type==="audio"?"audio/mpeg":"application/octet-stream");
      };
      const mimetype = getMime(mediaUrl, mediatype);
      const fileName = decodeURIComponent(mediaUrl.split("?")[0].split("/").pop() || "file");

      // Áudio: endpoint dedicado sendWhatsAppAudio (converte para ogg/opus)
      if (mediatype === "audio") {
        try {
          const r1 = await iFetch(`/message/sendWhatsAppAudio/${instName}`, {
            method: "POST",
            body: JSON.stringify({ number: cleanPhone, audio: mediaUrl, encoding: true }),
          });
          const d1 = await r1.json().catch(() => ({}));
          console.log("[sendMedia] sendWhatsAppAudio status:", r1.status, JSON.stringify(d1).slice(0, 200));
          if (r1.ok) return json(d1);
        } catch (e) { console.log("[sendMedia] sendWhatsAppAudio err:", (e as Error).message); }

        // Fallback: sendMedia com audio
        try {
          const r2 = await iFetch(`/message/sendMedia/${instName}`, {
            method: "POST",
            body: JSON.stringify({ number: cleanPhone, mediatype: "audio", mimetype, media: mediaUrl }),
          });
          const d2 = await r2.json().catch(() => ({}));
          console.log("[sendMedia] sendMedia audio status:", r2.status, JSON.stringify(d2).slice(0, 200));
          if (r2.ok) return json(d2);
          return json({ error: JSON.stringify(d2).slice(0, 200) }, 400);
        } catch (e) { return json({ error: (e as Error).message }, 400); }
      }

      // Imagem, vídeo, documento
      const payload = { number: cleanPhone, mediatype, mimetype, media: mediaUrl, caption: cap, fileName };

      // Tentativa 1: /message/sendMedia v2 com mimetype
      try {
        const r1 = await iFetch(`/message/sendMedia/${instName}`, {
          method: "POST", body: JSON.stringify(payload),
        });
        const d1 = await r1.json().catch(() => ({}));
        console.log("[sendMedia] v2 status:", r1.status, JSON.stringify(d1).slice(0, 200));
        if (r1.ok) return json(d1);

        // Tentativa 2: com options
        const r2 = await iFetch(`/message/sendMedia/${instName}`, {
          method: "POST",
          body: JSON.stringify({ ...payload, options: { delay: 1200, presence: "composing" } }),
        });
        const d2 = await r2.json().catch(() => ({}));
        console.log("[sendMedia] v2+opts status:", r2.status, JSON.stringify(d2).slice(0, 200));
        if (r2.ok) return json(d2);

        // Tentativa 3: mediaMessage aninhado
        const r3 = await iFetch(`/message/sendMedia/${instName}`, {
          method: "POST",
          body: JSON.stringify({ number: cleanPhone, mediaMessage: { mediatype, mimetype, media: mediaUrl, caption: cap, fileName } }),
        });
        const d3 = await r3.json().catch(() => ({}));
        console.log("[sendMedia] nested status:", r3.status, JSON.stringify(d3).slice(0, 200));
        if (r3.ok) return json(d3);

        return json({ error: JSON.stringify(d3 || d2 || d1).slice(0, 200) }, 400);
      } catch (e) { return json({ error: (e as Error).message }, 400); }
    }

    // ────────────────────────────────────────────────────────────────────────
    // FETCH PROFILE PHOTO — busca foto de perfil de contato/grupo
    // ────────────────────────────────────────────────────────────────────────
    if (action === "fetchProfilePhoto") {
      const { phone } = body;
      if (!phone) return json({ error: "phone obrigatório" }, 400);

      const rawPhone = String(phone).trim();
      const extractUrl = (d: Record<string, unknown>): string | null =>
        (d?.profilePictureUrl || d?.url || d?.data?.url || d?.picture ||
         d?.profilePicture || d?.imgUrl || null) as string | null;

      const isGroup = rawPhone.endsWith("@g.us");
      // Para contatos, limpa sufixo JID (@s.whatsapp.net etc.) — mantém @g.us para grupos
      const cleanPhone = isGroup ? rawPhone : rawPhone.split("@")[0];

      // Grupos: tenta endpoints específicos de grupo antes dos genéricos
      if (isGroup) {
        // Tentativa G1: GET /group/fetchGroupProfilePicture/{instanceName}?groupJid={jid}
        try {
          const r = await iFetch(`/group/fetchGroupProfilePicture/${instName}?groupJid=${encodeURIComponent(cleanPhone)}`);
          if (r.ok) { const d = await r.json(); const u = extractUrl(d); if (u) return json({ success: true, photoUrl: u }); }
        } catch (_) {}

        // Tentativa G2: POST /group/fetchGroupProfilePicture/{instanceName}
        try {
          const r = await iFetch(`/group/fetchGroupProfilePicture/${instName}`, {
            method: "POST", body: JSON.stringify({ groupJid: cleanPhone }),
          });
          if (r.ok) { const d = await r.json(); const u = extractUrl(d); if (u) return json({ success: true, photoUrl: u }); }
        } catch (_) {}

        // Tentativa G3: POST /group/pictureUrl/{instanceName}
        try {
          const r = await iFetch(`/group/pictureUrl/${instName}`, {
            method: "POST", body: JSON.stringify({ groupJid: cleanPhone }),
          });
          if (r.ok) { const d = await r.json(); const u = extractUrl(d); if (u) return json({ success: true, photoUrl: u }); }
        } catch (_) {}
      }

      // Tentativa 1: GET /chat/fetchProfilePicture/{instanceName}?number={cleanPhone}
      try {
        const r1 = await iFetch(`/chat/fetchProfilePicture/${instName}?number=${cleanPhone}`);
        if (r1.ok) { const d = await r1.json(); const u = extractUrl(d); if (u) return json({ success: true, photoUrl: u }); }
      } catch (_) {}

      // Tentativa 2: POST /chat/fetchProfilePicture/{instanceName}
      try {
        const r2 = await iFetch(`/chat/fetchProfilePicture/${instName}`, {
          method: "POST", body: JSON.stringify({ number: cleanPhone }),
        });
        if (r2.ok) { const d = await r2.json(); const u = extractUrl(d); if (u) return json({ success: true, photoUrl: u }); }
      } catch (_) {}

      // Tentativa 3: GET /contact/getProfilePicture/{instanceName}?number={cleanPhone}
      try {
        const r3 = await iFetch(`/contact/getProfilePicture/${instName}?number=${cleanPhone}`);
        if (r3.ok) { const d = await r3.json(); const u = extractUrl(d); if (u) return json({ success: true, photoUrl: u }); }
      } catch (_) {}

      // Tentativa 4: POST /contact/getProfilePicture
      try {
        const r4 = await iFetch(`/contact/getProfilePicture/${instName}`, {
          method: "POST", body: JSON.stringify({ number: cleanPhone }),
        });
        if (r4.ok) { const d = await r4.json(); const u = extractUrl(d); if (u) return json({ success: true, photoUrl: u }); }
      } catch (_) {}

      return json({ success: true, photoUrl: null });
    }

    // ────────────────────────────────────────────────────────────────────────
    // FETCH MEDIA — descriptografa mídia do WhatsApp via Evolution API
    // ────────────────────────────────────────────────────────────────────────
    if (action === "fetchMedia") {
      const { wamid } = body;
      if (!wamid) return json({ error: "wamid obrigatório" }, 400);
      try {
        const r = await iFetch(`/message/getBase64FromMediaMessage/${instName}`, {
          method: "POST",
          body: JSON.stringify({ id: String(wamid) }),
        });
        if (!r.ok) {
          const errTxt = await r.text().catch(() => "");
          return json({ error: `Evolution ${r.status}: ${errTxt.slice(0, 120)}` }, 502);
        }
        const d = await r.json();
        // Evolution pode retornar em diferentes formatos dependendo da versão
        const base64   = d?.base64   ?? d?.data?.base64   ?? d?.media?.base64   ?? null;
        const mimetype = d?.mimetype ?? d?.data?.mimetype ?? d?.media?.mimetype ?? d?.type ?? "application/octet-stream";
        if (base64) return json({ success: true, base64, mimetype });
        return json({ success: false, error: "Mídia não disponível ou expirada" });
      } catch (e) {
        return json({ error: (e as Error).message }, 500);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // PROXY MEDIA — busca mídia (áudio/imagem) server-side evitando CORS
    // ────────────────────────────────────────────────────────────────────────
    if (action === "proxyMedia") {
      const { url: mediaUrl } = body;
      if (!mediaUrl) return json({ error: "url obrigatória" }, 400);
      try {
        const r = await fetch(String(mediaUrl), {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; C4OS/1.0)" },
        });
        if (!r.ok) return json({ error: `Upstream ${r.status}` }, 502);
        const buffer = await r.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        const contentType = r.headers.get("content-type") || "application/octet-stream";
        return json({ success: true, base64, contentType });
      } catch (e) {
        return json({ error: (e as Error).message }, 500);
      }
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error("evolution-action error:", e);
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});
