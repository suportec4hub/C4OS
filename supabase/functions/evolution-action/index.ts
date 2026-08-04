import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, _status = 200) =>
  new Response(JSON.stringify(data), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });

/** Sanitiza nome da empresa para instanceName (sem acentos, sem espaços) */
const sanitizeName = (nome: string) =>
  nome.trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28) || "instance";

/** Eventos do webhook — formato compatível com múltiplos builds da Evolution API */
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

// Evolution API v2 (NestJS) — apenas eventos testados e aceitos pelo servidor
const WEBHOOK_EVENTS_V2 = [
  "QRCODE_UPDATED",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "MESSAGES_DELETE",
  "SEND_MESSAGE",
  "CONTACTS_UPSERT",
  "CONTACTS_UPDATE",
  "CHATS_UPSERT",
  "CHATS_UPDATE",
  "CHATS_DELETE",
  "GROUPS_UPSERT",
  "GROUP_PARTICIPANTS_UPDATE",
  "CONNECTION_UPDATE",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Credenciais do servidor Evolution API — configure via Supabase Secrets:
  // EVOLUTION_GLOBAL_KEY e EVOLUTION_GLOBAL_URL (Settings → Edge Functions → Secrets)
  const GLOBAL_KEY = Deno.env.get("EVOLUTION_GLOBAL_KEY") || "";
  const GLOBAL_URL = Deno.env.get("EVOLUTION_GLOBAL_URL") || "";
  const SUPA_URL   = Deno.env.get("SUPABASE_URL") || "";

  try {
    const body = await req.json();
    const { action, empresa_id } = body;

    // resetAllWebhooks não precisa de empresa_id específica
    if (action === "resetAllWebhooks") {
      const evoUrl  = GLOBAL_URL.replace(/\/$/, "");
      const apiKey  = GLOBAL_KEY;
      if (!evoUrl) return json({ error: "EVOLUTION_GLOBAL_URL não configurado" }, 500);

      const [{ data: allEmps }, { data: allInsts }] = await Promise.all([
        supabase.from("empresas").select("evolution_instance_id, evolution_instance_token").not("evolution_instance_id", "is", null),
        supabase.from("empresa_instancias").select("evolution_instance_id, evolution_instance_token").not("evolution_instance_id", "is", null),
      ]);

      const allRows = [...(allEmps || []), ...(allInsts || [])];

      const setWebhook = async (iName: string, iToken: string) => {
        const wUrl  = `${SUPA_URL}/functions/v1/evolution-webhook?token=${iToken}`;
        // Evolution API v2: PUT /webhook/set/{instance} com body { webhook: { ... } }
        const wBody = JSON.stringify({ webhook: { url: wUrl, events: WEBHOOK_EVENTS_V2, enabled: true, webhookByEvents: false, base64: true } });
        const wHdr  = { "Content-Type": "application/json", "apikey": iToken };
        try {
          let r = await fetch(`${evoUrl}/webhook/set/${iName}`, { method: "PUT",  headers: wHdr, body: wBody, signal: AbortSignal.timeout(5000) });
          if (!r.ok) r = await fetch(`${evoUrl}/webhook/set/${iName}`, { method: "POST", headers: wHdr, body: wBody, signal: AbortSignal.timeout(5000) });
          const txt = await r.text().catch(() => "");
          return { instance: iName, ok: r.ok, err: r.ok ? undefined : `${r.status}: ${txt.slice(0, 100)}` };
        } catch (ex) {
          return { instance: iName, ok: false, err: (ex as Error).message };
        }
      };

      const results = await Promise.all(
        allRows.map(row => setWebhook(row.evolution_instance_id as string, (row.evolution_instance_token as string) || apiKey))
      );

      const ok   = results.filter(r => r.ok).length;
      const fail = results.filter(r => !r.ok);
      return json({ success: true, total: results.length, ok, failed: fail.length, failures: fail });
    }

    if (!empresa_id) return json({ error: "empresa_id obrigatório" }, 400);

    const { data: emp, error: empErr } = await supabase
      .from("empresas")
      .select("id, nome, evolution_instance_id, evolution_instance_token, evolution_connected")
      .eq("id", empresa_id)
      .single();

    if (empErr || !emp) return json({ error: "Empresa não encontrada" }, 404);

    // URL e chave lidos exclusivamente dos Supabase Secrets (EVOLUTION_GLOBAL_URL / EVOLUTION_GLOBAL_KEY)
    const evoUrl       = GLOBAL_URL.replace(/\/$/, "");
    const instToken    = emp.evolution_instance_token || "";
    // evolution_instance_id guarda o instanceName (string como "c4HUB-Lucas-Machado")
    const instName     = emp.evolution_instance_id || `c4HUB-${sanitizeName(emp.nome || empresa_id.slice(0, 12))}`;
    const computedName = `c4HUB-${sanitizeName(emp.nome || empresa_id.slice(0, 12))}`;
    const apiKey       = GLOBAL_KEY;

    console.log("[config] evoUrl set:", !!evoUrl, "| apiKey set:", !!apiKey, "| action:", action);

    // Desconectar/logout: limpa o banco SEMPRE, independente de URL configurada
    if ((action === "disconnect" || action === "logout") && !evoUrl) {
      await supabase.from("empresas").update({
        evolution_connected:      false,
        evolution_qr_temp:        null,
        evolution_instance_token: null,
        evolution_instance_id:    null,
      }).eq("id", empresa_id);
      return json({ success: true });
    }

    if (!evoUrl) return json({ error: "Servidor Evolution não configurado. Verifique as Secrets EVOLUTION_GLOBAL_URL e EVOLUTION_GLOBAL_KEY no Supabase." });

    /** Fetch autenticado com global apikey — usa apiKey do banco (ou GLOBAL_KEY como fallback) */
    const gFetch = (path: string, opts: RequestInit = {}) =>
      fetch(`${evoUrl}${path}`, {
        ...opts,
        headers: { "Content-Type": "application/json", "apikey": apiKey || GLOBAL_KEY, ...(opts.headers || {}) },
      });

    /** Fetch autenticado com instance apikey */
    const iFetch = (path: string, opts: RequestInit = {}) =>
      fetch(`${evoUrl}${path}`, {
        ...opts,
        headers: { "Content-Type": "application/json", "apikey": instToken || apiKey, ...(opts.headers || {}) },
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
        const _wb = JSON.stringify({ webhook: { url: finalWebhookUrl, events: WEBHOOK_EVENTS_V2, enabled: true, webhookByEvents: false, base64: true } });
        const _wh = { "Content-Type": "application/json", "apikey": savedToken };
        const wRes = await fetch(`${evoUrl}/webhook/set/${savedName}`, { method: "PUT", headers: _wh, body: _wb });
        if (!wRes.ok) await fetch(`${evoUrl}/webhook/set/${savedName}`, { method: "POST", headers: _wh, body: _wb });
      } catch (_) { /* best-effort */ }

      return json({ success: true, instanceName: savedName, token: savedToken, webhookUrl: finalWebhookUrl, qrBase64: createQr });
    }

    // ── syncContactLids: busca contatos da Evolution API e popula contato_lid ──
    // Resolve o mapeamento @lid ↔ telefone para que leituras no celular limpem o badge.
    if (action === "syncContactLids") {
      try {
        // Evolution API v2: tenta GET /contact/findContacts e fallbacks
        let r = await iFetch(`/contact/findContacts/${instName}`, { method: "GET" });
        if (!r.ok) r = await iFetch(`/contact/fetchContacts/${instName}`, { method: "GET" });
        if (!r.ok) r = await iFetch(`/contact/findContacts/${instName}`, {
          method: "POST", body: JSON.stringify({ where: {} }),
        });
        if (!r.ok) r = await iFetch(`/contact/${instName}`, { method: "GET" });
        if (!r.ok) return json({ ok: false, error: `findContacts status ${r.status}` });

        const contacts = await r.json();
        if (!Array.isArray(contacts)) return json({ ok: false, error: "Resposta inesperada da API" });

        const lidContacts = contacts.filter((c: Record<string, unknown>) =>
          c?.lid && String(c.lid).endsWith("@lid")
        );

        let updated = 0;
        for (const contact of lidContacts) {
          try {
            const phoneJid = String(contact.id || "");
            const lid      = String(contact.lid);
            if (!phoneJid) continue;
            const phone = phoneJid.replace(/@s\.whatsapp\.net$/, "").replace(/@c\.us$/, "").replace(/:.*$/, "");
            if (!phone || phone.includes("@")) continue;

            const variants = [phone];
            if (/^\d{10,11}$/.test(phone)) variants.push("55" + phone);
            if (/^55\d{10,11}$/.test(phone)) variants.push(phone.slice(2));

            for (const v of variants) {
              const { data: upd } = await supabase.from("conversas")
                .update({ contato_lid: lid })
                .eq("empresa_id", emp.id)
                .eq("contato_telefone", v)
                .is("contato_lid", null)
                .select("id");
              if (upd && upd.length > 0) { updated++; break; }
            }
          } catch (_) {}
        }

        await supabase.from("logs_whatsapp").insert({
          empresa_id: emp.id, tipo: "fluxo", nivel: "info",
          origem: "evolution-action", evento: "syncContactLids",
          resumo: `Mapeou contato_lid para ${updated} conversa(s) de ${lidContacts.length} contatos com @lid`,
          payload: { total: contacts.length, withLid: lidContacts.length, updated },
        }).then(() => {}).catch(() => {});

        return json({ ok: true, total: contacts.length, withLid: lidContacts.length, updated });
      } catch (ex) {
        return json({ ok: false, error: ex.message });
      }
    }

    // ── readMessages: marca mensagens como lidas no WhatsApp ao abrir no C4OS ──
    // DEVE ficar ANTES do guard de instToken para funcionar mesmo sem instância configurada.
    if (action === "readMessages") {
      const { conversa_id } = body;
      if (!conversa_id) return json({ ok: true });

      const { data: msgs } = await supabase.from("mensagens")
        .select("wamid")
        .eq("conversa_id", conversa_id)
        .eq("de", "contato")
        .not("wamid", "is", null)
        .order("hora", { ascending: false })
        .limit(20);

      if (!msgs || msgs.length === 0) return json({ ok: true });

      const { data: conv } = await supabase.from("conversas")
        .select("contato_telefone, contato_lid")
        .eq("id", conversa_id)
        .single();
      if (!conv) return json({ ok: true });

      const phone = conv.contato_telefone as string;
      const lid   = (conv.contato_lid as string | null) || "";

      const wamids = msgs
        .map((m: Record<string, string>) => m.wamid)
        .filter(Boolean);
      if (wamids.length === 0) return json({ ok: true });

      // A chave do recibo precisa ser idêntica à que o WhatsApp gravou —
      // remoteJid e, em conversa @lid, o participant. Montar a chave por
      // dedução (telefone@s.whatsapp.net ou o @lid da conversa) fazia a
      // Evolution responder "read: success" e nada acontecer: ela não valida
      // a chave, só repassa ao Baileys, e o servidor descarta o recibo cuja
      // chave não casa. Por isso a chave é buscada na própria Evolution, e
      // só se a busca falhar é que se recorre à dedução.
      const jidsCandidatos = [
        phone.endsWith("@g.us") ? phone : "",
        lid.endsWith("@lid") ? lid : "",
        phone.includes("@") ? phone : `${phone}@s.whatsapp.net`,
      ].filter(Boolean);

      const diag: string[] = [];
      // deno-lint-ignore no-explicit-any
      let chaves: any[] = [];
      let jidUsado = "";

      for (const cand of jidsCandidatos) {
        if (chaves.length > 0) break;
        try {
          const rf = await iFetch(`/chat/findMessages/${instName}`, {
            method: "POST",
            body: JSON.stringify({ where: { key: { remoteJid: cand } }, limit: 40 }),
          });
          if (!rf.ok) { diag.push(`findMessages(${cand}) -> ${rf.status}`); continue; }
          // deno-lint-ignore no-explicit-any
          const rj: any = await rf.json().catch(() => null);
          // A resposta ora vem como array, ora envelopada em messages.records.
          // deno-lint-ignore no-explicit-any
          const lista: any[] = Array.isArray(rj) ? rj
            : Array.isArray(rj?.messages?.records) ? rj.messages.records
            : Array.isArray(rj?.records) ? rj.records
            : Array.isArray(rj?.messages) ? rj.messages : [];

          const doContato = lista
            .map((m) => m?.key)
            .filter((k) => k && k.id && !k.fromMe);
          // Prioriza as mensagens que o C4OS conhece; se nenhuma casar, usa as
          // mais recentes do chat — o recibo da última já zera a conversa.
          const conhecidas = doContato.filter((k) => wamids.includes(k.id));
          const escolhidas = (conhecidas.length > 0 ? conhecidas : doContato).slice(0, 20);

          diag.push(`findMessages(${cand}) -> ${lista.length} msgs, ${escolhidas.length} chaves`);
          if (escolhidas.length > 0) {
            chaves = escolhidas.map((k) => ({
              remoteJid: k.remoteJid,
              fromMe: false,
              id: k.id,
              ...(k.participant ? { participant: k.participant } : {}),
            }));
            jidUsado = cand;
          }
        } catch (ex) {
          diag.push(`findMessages(${cand}) -> exceção ${(ex as Error).message}`);
        }
      }

      if (chaves.length === 0) {
        jidUsado = jidsCandidatos[0] || `${phone}@s.whatsapp.net`;
        chaves = wamids.map((id: string) => ({ remoteJid: jidUsado, fromMe: false, id }));
        diag.push(`sem chave real, deduzindo com ${jidUsado}`);
      }

      // markMessageAsRead é a única rota de leitura do chat controller — não
      // existe equivalente em nível de conversa. Ela chama readMessages do
      // Baileys com as chaves recebidas, sem validá-las: daí a insistência
      // acima em usar a chave real.
      const logPayload: Record<string, unknown> = {
        instName, jidUsado, msgCount: chaves.length,
        chaveExemplo: chaves[0], diag, hasInstToken: !!instToken,
      };

      const tentativas: string[] = [];
      const corpos = [
        { nome: "plano", corpo: { readMessages: chaves } },
        // deno-lint-ignore no-explicit-any
        { nome: "aninhado", corpo: { readMessages: chaves.map((k: any) => ({ key: k })) } },
      ];

      for (const c of corpos) {
        try {
          const r = await iFetch(`/chat/markMessageAsRead/${instName}`, {
            method: "POST", body: JSON.stringify(c.corpo),
          });
          const txt = await r.text().catch(() => "");
          tentativas.push(`${c.nome} -> ${r.status} ${txt.slice(0, 120)}`);
          if (r.ok) {
            logPayload.tentativas = tentativas;
            logPayload.formatoOk = c.nome;
            await supabase.from("logs_whatsapp").insert({
              empresa_id: emp.id, conversa_id, tipo: "fluxo", nivel: "info",
              origem: "evolution-action", evento: "readMessages-ok",
              resumo: `marcado como lido ${r.status} msgs:${chaves.length} jid:${jidUsado}`,
              payload: logPayload,
            }).then(() => {}).catch(() => {});
            return json({ ok: true });
          }
        } catch (ex) {
          tentativas.push(`${c.nome} -> exceção ${(ex as Error).message}`);
        }
      }

      logPayload.tentativas = tentativas;
      await supabase.from("logs_whatsapp").insert({
        empresa_id: emp.id, conversa_id, tipo: "erro_api", nivel: "error",
        origem: "evolution-action", evento: "readMessages-failed",
        resumo: `marcação recusada msgs:${chaves.length}`,
        payload: logPayload,
      }).then(() => {}).catch(() => {});
      return json({ ok: false });
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

        // ── Garante que não existe instância com esse nome no servidor ──
        // Tenta deletar com a global key, depois com o token antigo (migração de servidor)
        try { await gFetch(`/instance/delete/${name}`, { method: "DELETE" }); } catch (_) {}
        if (instToken && instToken !== myToken) {
          try {
            await fetch(`${evoUrl}/instance/delete/${name}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json", "apikey": instToken },
            });
          } catch (_) {}
        }
        // Pequena pausa para o servidor processar a deleção
        await new Promise(r => setTimeout(r, 500));

        // Salva token ANTES de chamar a API para evitar race condition com webhooks
        await supabase.from("empresas").update({
          evolution_instance_id:    name,
          evolution_instance_token: myToken,
          evolution_connected:      false,
          evolution_qr_temp:        null,
        }).eq("id", empresa_id);

        const doCreate = () => gFetch("/instance/create", {
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

        let cr = await doCreate();
        let cd = await cr.json();
        console.log("[connect] createFresh status:", cr.status, JSON.stringify(cd).slice(0, 400));

        // Se "already exists" → deleta e tenta novamente uma vez
        // Se "forbidden/403" e temos chave própria obsoleta → retenta com GLOBAL_KEY
        if (!cr.ok) {
          const sc = (cd?.statusCode ?? cd?.status ?? cr.status) as number;
          const errMsg = ((cd?.message || cd?.error || "") as string).toLowerCase();
          const alreadyExists = errMsg.includes("already") || errMsg.includes("exists") ||
            errMsg.includes("duplicate") || sc === 409;

          if (alreadyExists) {
            console.log("[connect] createFresh: instance already exists — deleting and retrying...");
            try { await gFetch(`/instance/delete/${name}`, { method: "DELETE" }); } catch (_) {}
            await new Promise(r => setTimeout(r, 1000));
            cr = await doCreate();
            cd = await cr.json();
            console.log("[connect] createFresh retry status:", cr.status, JSON.stringify(cd).slice(0, 400));
          }
        }

        if (!cr.ok) {
          await supabase.from("empresas").update({
            evolution_instance_id: null, evolution_instance_token: null,
          }).eq("id", empresa_id);
          const sc2 = (cd?.statusCode ?? cd?.status ?? cr.status) as number;
          const msg = String(cd?.message || cd?.error || JSON.stringify(cd));
          if (sc2 === 403) {
            throw new Error(`Chave EVOLUTION_GLOBAL_KEY inválida ou não configurada no Supabase Secrets. Verifique nas configurações. (${msg})`);
          }
          throw new Error(msg);
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
        const _wUrl = `${SUPA_URL}/functions/v1/evolution-webhook?token=${tok}`;
        const _wBody = JSON.stringify({ webhook: { url: _wUrl, events: WEBHOOK_EVENTS_V2, enabled: true, webhookByEvents: false, base64: true } });
        fetch(`${evoUrl}/webhook/set/${nm}`, { method: "PUT",  headers: { "Content-Type": "application/json", "apikey": tok }, body: _wBody })
          .then(r => r.ok ? r : fetch(`${evoUrl}/webhook/set/${nm}`, { method: "POST", headers: { "Content-Type": "application/json", "apikey": tok }, body: _wBody }))
          .catch(() => {});

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
          headers: { "Content-Type": "application/json", "apikey": effectiveToken || apiKey, ...(opts.headers || {}) },
        });

      // Atualiza webhook para garantir webhookByEvents=false (best-effort)
      const _wBody2 = JSON.stringify({ webhook: { url: webhookUrl, events: WEBHOOK_EVENTS_V2, enabled: true, webhookByEvents: false, base64: true } });
      fetch(`${evoUrl}/webhook/set/${effectiveName}`, { method: "PUT",  headers: { "Content-Type": "application/json", "apikey": effectiveToken }, body: _wBody2 })
        .then(r => r.ok ? r : fetch(`${evoUrl}/webhook/set/${effectiveName}`, { method: "POST", headers: { "Content-Type": "application/json", "apikey": effectiveToken }, body: _wBody2 }))
        .catch(() => {});

      let qrBase64 = "";
      const tried: string[] = [];
      let instanceMissing = false;  // sinaliza instância deletada na API

      const extractQr = (d: Record<string, unknown>): string =>
        (d?.base64 || d?.qrcode?.base64 || d?.Qrcode || d?.data?.Qrcode ||
         d?.data?.qrcode || d?.instance?.qrcode?.base64 || "") as string;

      const isMissingResponse = (status: number, d: Record<string, unknown>): boolean => {
        const sc = (d?.statusCode ?? d?.status ?? status) as number;
        const msg = ((d?.message || d?.error || d?.response || "") as string).toLowerCase();
        return sc === 404 || sc === 401 || sc === 403 ||
          msg.includes("not found") || msg.includes("no instance") ||
          msg.includes("not exists") || msg.includes("doesn't exist") ||
          msg.includes("instance not") || msg.includes("unauthorized") ||
          msg.includes("forbidden") || msg.includes("bad request");
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
      const webhookUrl  = `${SUPA_URL}/functions/v1/evolution-webhook?token=${instToken}`;
      const webhookBody = JSON.stringify({ webhook: { url: webhookUrl, events: WEBHOOK_EVENTS_V2, enabled: true, webhookByEvents: false, base64: true } });
      const webhookHdr  = { "Content-Type": "application/json", "apikey": instToken };
      try {
        let r1 = await fetch(`${evoUrl}/webhook/set/${instName}`, { method: "PUT",  headers: webhookHdr, body: webhookBody });
        if (!r1.ok) r1 = await fetch(`${evoUrl}/webhook/set/${instName}`, { method: "POST", headers: webhookHdr, body: webhookBody });
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
      // Limpa token + instance_id: na próxima conexão, vai para createFresh diretamente
      // sem tentar estratégias 1-4 com credenciais antigas (evita erro ao migrar servidor)
      await supabase.from("empresas").update({
        evolution_connected:      false,
        evolution_qr_temp:        null,
        evolution_instance_token: null,
        evolution_instance_id:    null,
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
        .select("id, mensagem, intervalo_min, intervalo_max, total_contatos, tipo_midia, url_midia, chave_pix, caption, repeticoes, repeticao_intervalo_seg, repeticao_modo, repeticao_parar_resposta, rodada_atual, proxima_rodada_em")
        .eq("id", campanha_id).eq("empresa_id", empresa_id).single();
      if (!camp) return json({ error: "Campanha não encontrada" }, 404);

      const repeticoes    = Math.max(1, Number(camp.repeticoes ?? 1));
      const repIntervaloMs = Math.max(1, Number(camp.repeticao_intervalo_seg ?? 60)) * 1000;
      const repModo       = String(camp.repeticao_modo || "contato");
      const pararResposta = camp.repeticao_parar_resposta !== false;
      const nowMs         = Date.now();

      // No modo campanha as rodadas são espaçadas: se a próxima ainda não
      // venceu, nada a fazer neste tick.
      if (camp.proxima_rodada_em && new Date(camp.proxima_rodada_em as string).getTime() > nowMs) {
        return json({ success: true, aguardando_rodada: camp.proxima_rodada_em, rodada: camp.rodada_atual });
      }

      // Lote limitado por execução: com o intervalo entre mensagens, campanhas
      // grandes estouram o tempo máximo da edge function e a campanha ficava
      // presa em "enviando" com contatos nunca enviados. O cron do
      // send-scheduled reprocessa a campanha até esgotar os pendentes.
      //
      // proximo_envio_em filtra as repetições que ainda não venceram: o
      // intervalo entre repetições é agendado, não aguardado, porque pode
      // chegar a horas — muito além do tempo de execução da função.
      const BATCH_LIMIT = 25;
      const buscarLote = async () => {
        const { data } = await supabase.from("transmissao_contatos")
          .select("id, nome, telefone, empresa, envios, enviado_em, tentativas")
          .eq("campanha_id", campanha_id).eq("status", "pendente")
          // Teto absoluto de envios por contato: alcançado o número de
          // repetições, o contato não é mais elegível, com ou sem resposta.
          .lt("envios", repeticoes)
          .or(`proximo_envio_em.is.null,proximo_envio_em.lte.${new Date().toISOString()}`)
          // No modo contato quem já começou vem primeiro, para concluir as
          // repetições de um contato antes de iniciar o próximo. No modo campanha
          // a ordem é pela hora agendada, mantendo as rodadas parelhas.
          .order("envios", { ascending: repModo !== "contato" })
          .order("proximo_envio_em", { ascending: true, nullsFirst: true })
          .limit(BATCH_LIMIT);
        return data || [];
      };

      // Soma de envios já realizados (conta repetições, não contatos).
      // Um contato marcado como enviado conta no mínimo 1 mesmo com envios=0:
      // linhas gravadas antes da coluna existir zerariam o progresso.
      const { data: enviosRows } = await supabase.from("transmissao_contatos")
        .select("envios, status").eq("campanha_id", campanha_id);
      const jaEnviados = (enviosRows || []).reduce((s, r) =>
        s + Math.max(Number(r.envios || 0), r.status === "enviado" ? 1 : 0), 0);

      // Decide o destino da campanha: seguir, abrir a próxima rodada ou fechar.
      // Usada nas duas saídas — quando o lote já vem vazio e quando o lote
      // termina. Antes a lógica de rodadas só existia na primeira: ao concluir
      // a rodada 1 dentro da mesma execução, a campanha era marcada como
      // concluída e as rodadas seguintes nunca saíam.
      // Sentinela: pede ao laço principal para seguir na mesma execução.
      const CONTINUAR = Symbol("continuar");
      const finalizar = async (total: number): Promise<Response | typeof CONTINUAR> => {
        // Campanha cancelada durante o lote não volta para 'enviando': só
        // registra o progresso e para.
        const { data: atual } = await supabase.from("campanhas")
          .select("status").eq("id", campanha_id).maybeSingle();
        if (atual && atual.status !== "enviando") {
          await supabase.from("campanhas")
            .update({ enviados: total, updated_at: new Date().toISOString() }).eq("id", campanha_id);
          return json({ success: true, enviados: total, interrompida: atual.status });
        }

        // Conta só quem ainda pode receber: um pendente que já bateu o teto de
        // repetições nunca sairia da fila e a campanha ficaria em 'enviando'.
        const { count: pendentes } = await supabase.from("transmissao_contatos")
          .select("id", { count: "exact", head: true })
          .eq("campanha_id", campanha_id).eq("status", "pendente")
          .lt("envios", repeticoes);

        if ((pendentes ?? 0) > 0) {
          // Há pendentes: se nenhum está vencido, são repetições agendadas para
          // o futuro e este tick não tem trabalho a fazer.
          const { count: vencidos } = await supabase.from("transmissao_contatos")
            .select("id", { count: "exact", head: true })
            .eq("campanha_id", campanha_id).eq("status", "pendente")
            .lt("envios", repeticoes)
            .or(`proximo_envio_em.is.null,proximo_envio_em.lte.${new Date().toISOString()}`);

          await supabase.from("campanhas")
            .update({ status: "enviando", enviados: total, updated_at: new Date().toISOString() })
            .eq("id", campanha_id);
          return json({
            success: true, enviados: total, restantes: pendentes,
            ...((vencidos ?? 0) === 0 ? { aguardando_repeticao: true } : {}),
          });
        }

        const rodada = Number(camp.rodada_atual ?? 0) + 1;
        if (repModo === "campanha" && rodada < repeticoes) {
          // Reabre a lista para a próxima rodada, preservando quem respondeu.
          const proxima = new Date(Date.now() + repIntervaloMs).toISOString();
          const reset = supabase.from("transmissao_contatos")
            .update({ status: "pendente", proximo_envio_em: proxima, erro_msg: null })
            .eq("campanha_id", campanha_id).eq("status", "enviado")
            .lt("envios", repeticoes);
          if (pararResposta) reset.is("respondeu_em", null);
          await reset;

          await supabase.from("campanhas").update({
            status: "enviando", rodada_atual: rodada,
            proxima_rodada_em: proxima, enviados: total,
            updated_at: new Date().toISOString(),
          }).eq("id", campanha_id);

          // Se a espera couber nesta execução, aguarda e roda a próxima rodada
          // aqui mesmo. Depender do cron esticava um intervalo de 30s para o
          // próximo minuto — e mais ainda quando outra campanha pegava a vaga.
          if ((Date.now() + repIntervaloMs) < bcDeadline) {
            await new Promise(r => setTimeout(r, repIntervaloMs));
            return CONTINUAR;
          }
          return json({ success: true, enviados: total, rodada_agendada: rodada + 1, em: proxima });
        }

        // Sem pendentes e sem rodada restante: fecha o status — antes retornava
        // 400 deixando a campanha presa em "enviando".
        await supabase.from("campanhas")
          .update({ status: "concluido", enviados: total, proxima_rodada_em: null,
                    updated_at: new Date().toISOString() })
          .eq("id", campanha_id);
        return json({ success: true, enviados: total, restantes: 0 });
      };

      let contatos = await buscarLote();
      if (!contatos.length) {
        const r = await finalizar(jaEnviados);
        if (r !== CONTINUAR) return r;
        contatos = await buscarLote();
      }

      await supabase.from("campanhas")
        .update({ status: "enviando", proxima_rodada_em: null }).eq("id", campanha_id);

      // Interrompe o lote antes do limite de execução para que o status final
      // seja sempre gravado e o próximo tick continue de onde parou. O
      // orçamento pode vir de quem chamou, para caber mais de uma campanha no
      // mesmo ciclo do cron e nenhuma monopolizar a vaga.
      const budgetMs = Math.min(100_000, Math.max(10_000, Number(body.budget_ms) || 100_000));
      const bcDeadline = Date.now() + budgetMs;
      let enviados = jaEnviados ?? 0;
      const minMs = (camp.intervalo_min || 5) * 1000;
      const maxMs = (camp.intervalo_max || 15) * 1000;
      const tipoMidia = (camp.tipo_midia as string) || "texto";

      // Mapa de tipo de mídia → mediatype da Evolution API
      const mediaTypeMap: Record<string, string> = {
        imagem: "image", video: "video", audio: "audio", documento: "document",
      };

      // A Evolution exige o número em formato internacional. Contatos brasileiros
      // salvos sem o DDI (10-11 dígitos) eram rejeitados — tentamos a variante
      // com 55 primeiro e caímos para o número original como fallback.
      const numCandidates = (raw: string): string[] => {
        const d = String(raw).replace(/\D/g, "");
        const out: string[] = [];
        if (/^\d{10,11}$/.test(d)) out.push("55" + d);
        if (d) out.push(d);
        return [...new Set(out)];
      };

      // Devolve o erro da Evolution, não só um booleano: antes o motivo real da
      // falha era descartado nos envios de texto e o contato ficava com um
      // "Falha ao enviar" que não distinguia número inexistente de instância
      // desconectada — o que também impedia classificar o erro como transitório.
      const sendMsg = async (nums: string[], texto: string): Promise<{ ok: boolean; err: string }> => {
        // Guarda o erro do endpoint oficial. O legado /send/text não existe na
        // v2 e responde sempre 404 "Cannot POST /send/text"; ao guardar o erro
        // da última tentativa, esse 404 sobrescrevia a causa real.
        let erroReal = "";
        for (const num of nums) {
          const res = await iFetch(`/message/sendText/${instName}`, {
            method: "POST", body: JSON.stringify({ number: num, text: texto }),
          }).catch(() => null);
          if (res?.ok) return { ok: true, err: "" };

          let erro = "";
          if (res) {
            const d = await res.json().catch(() => null);
            erro = d ? JSON.stringify(d).slice(0, 300) : `HTTP ${res.status}`;
          }
          if (!erroReal && erro) erroReal = erro;

          // Rota ausente indica Evolution antiga: só nesse caso vale tentar o
          // endpoint legado, e o erro dele não substitui o erro real.
          if (res?.status === 404 && /Cannot (POST|find)/i.test(erro)) {
            const alt = await iFetch("/send/text", {
              method: "POST",
              body: JSON.stringify({ instanceName: instName, id: instName, number: num, text: texto }),
            }).catch(() => null);
            if (alt?.ok) return { ok: true, err: "" };
          }
        }
        return { ok: false, err: erroReal || "Falha ao enviar" };
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

      const sendMedia = async (nums: string[], mediatype: string, mediaUrl: string, caption: string): Promise<{ ok: boolean; err: string }> => {
        let lastErr = "Falha ao enviar mídia";
        for (const num of nums) {
          const r = await sendMediaTo(num, mediatype, mediaUrl, caption);
          if (r.ok) return r;
          lastErr = r.err || lastErr;
        }
        return { ok: false, err: lastErr };
      };

      const sendMediaTo = async (num: string, mediatype: string, mediaUrl: string, caption: string): Promise<{ ok: boolean; err: string }> => {
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

          // Reporta o erro da primeira tentativa: antes havia uma terceira
          // tentativa com mediaMessage aninhado (sem mediatype no topo) que
          // sempre falhava com "requires property mediatype" e mascarava a
          // causa real registrada em erro_msg.
          return { ok: false, err: (JSON.stringify(d1) || JSON.stringify(d2)).slice(0, 300) };
        } catch (e) { return { ok: false, err: (e as Error).message }; }
      };

      // Detecta se o contato respondeu depois do último envio, para não seguir
      // insistindo com quem já respondeu (reduz risco de bloqueio no WhatsApp).
      const respondeuDepois = async (telefone: string, desde: string | null): Promise<boolean> => {
        if (!desde) return false;
        try {
          const variantes = numCandidates(telefone);
          const { data: convs } = await supabase.from("conversas")
            .select("id").eq("empresa_id", empresa_id).in("contato_telefone", variantes);
          if (!convs?.length) return false;
          const { count } = await supabase.from("mensagens")
            .select("id", { count: "exact", head: true })
            .in("conversa_id", convs.map(c => c.id))
            .eq("de", "contato")
            .gt("hora", desde);
          return (count ?? 0) > 0;
        } catch (_) { return false; }
      };

      // O botão Cancelar muda o status no banco, mas o lote em curso seguia
      // enviando por até ~100s. Verificado antes de cada envio.
      const cancelada = async (): Promise<boolean> => {
        const { data } = await supabase.from("campanhas")
          .select("status").eq("id", campanha_id).maybeSingle();
        return !!data && data.status !== "enviando";
      };

      // Laço externo: ao esgotar o lote, reavalia. No modo campanha a rodada
      // seguinte pode ter sido liberada dentro desta mesma execução.
      let interrompida = false;
      for (;;) {
      for (const contato of contatos) {
        if (Date.now() > bcDeadline) break;
        if (await cancelada()) { interrompida = true; break; }
        try {
          // Reconfere o teto: o cron dispara a cada minuto e um lote longo pode
          // se sobrepor ao seguinte, que traria o mesmo contato no lote.
          if (Number(contato.envios || 0) >= repeticoes) {
            await supabase.from("transmissao_contatos")
              .update({ status: "enviado", proximo_envio_em: null }).eq("id", contato.id);
            continue;
          }

          // Já respondeu desde o último envio: encerra as repetições dele.
          if (pararResposta && Number(contato.envios || 0) > 0 &&
              await respondeuDepois(String(contato.telefone), contato.enviado_em as string | null)) {
            await supabase.from("transmissao_contatos").update({
              status: "respondeu", respondeu_em: new Date().toISOString(), proximo_envio_em: null,
            }).eq("id", contato.id);
            continue;
          }

          const nums = numCandidates(String(contato.telefone));
          const num  = nums[nums.length - 1] || "";
          const interpolate = (t: string) => t
            .replace(/\{nome\}/gi, (contato as Record<string, string>).nome || "")
            .replace(/\{empresa\}/gi, (contato as Record<string, string>).empresa || "")
            .replace(/\{telefone\}/gi, num);

          const mensagem = interpolate((camp.mensagem as string) || "");

          // Um envio para este contato. Isolado numa função porque no modo
          // contato ele é chamado várias vezes, uma por repetição.
          const enviarUm = async (): Promise<{ ok: boolean; err: string }> => {
            if (tipoMidia === "pix") {
              const pixKey = (camp.chave_pix as string) || "";
              const texto  = pixKey ? `${mensagem}\n\n💳 *Chave PIX:* ${pixKey}` : mensagem;
              return await sendMsg(nums, texto);
            }
            if (tipoMidia !== "texto" && camp.url_midia) {
              const mediatype = mediaTypeMap[tipoMidia] || "image";
              const caption   = interpolate((camp.caption as string) || mensagem);
              const m = await sendMedia(nums, mediatype, camp.url_midia as string, caption);
              return { ok: m.ok, err: m.err || "Falha ao enviar mídia" };
            }
            return await sendMsg(nums, mensagem);
          };

          let feitos = Number(contato.envios || 0);
          let falhou = "";
          // Acompanha o horário do último envio: a checagem de resposta precisa
          // olhar a partir dele, não do valor lido do banco no início do lote.
          let ultimoEnvio = (contato.enviado_em as string | null) ?? null;

          // Repete enquanto couber no tempo desta execução. O que não couber
          // fica agendado em proximo_envio_em e o cron retoma — é o que permite
          // intervalos de horas sem travar a função.
          for (;;) {
            const r = await enviarUm();
            if (!r.ok) { falhou = r.err; break; }
            feitos++;
            enviados++;
            ultimoEnvio = new Date().toISOString();

            const faltaRepetir = repModo === "contato" && feitos < repeticoes;
            const cabeAgora = faltaRepetir && (Date.now() + repIntervaloMs) < bcDeadline;

            await supabase.from("transmissao_contatos").update({
              status: faltaRepetir ? "pendente" : "enviado",
              enviado_em: ultimoEnvio,
              envios: feitos,
              proximo_envio_em: faltaRepetir && !cabeAgora
                ? new Date(Date.now() + repIntervaloMs).toISOString() : null,
            }).eq("id", contato.id);
            await supabase.from("campanhas")
              .update({ enviados, updated_at: new Date().toISOString() }).eq("id", campanha_id);

            if (!cabeAgora) break;

            await new Promise(r2 => setTimeout(r2, repIntervaloMs));

            if (await cancelada()) { interrompida = true; break; }

            // Respondeu no meio das repetições: para de insistir.
            if (pararResposta && await respondeuDepois(String(contato.telefone), ultimoEnvio)) {
              await supabase.from("transmissao_contatos").update({
                status: "respondeu", respondeu_em: new Date().toISOString(), proximo_envio_em: null,
              }).eq("id", contato.id);
              falhou = "";
              break;
            }
          }

          if (falhou) {
            // Queda de sessão da instância ou 5xx da Evolution são transitórios:
            // o número existe e o envio deve ser retentado, não queimado. Só
            // erros definitivos (número inexistente) falham de vez.
            const transitorio = /Connection Closed|ECONNRESET|ETIMEDOUT|socket hang up|"status":\s*5\d\d/i.test(falhou);
            const tentativas = Number(contato.tentativas || 0) + 1;
            const MAX_TENTATIVAS = 5;
            const retentar = transitorio && tentativas < MAX_TENTATIVAS;

            // Traduz as causas comuns: o JSON cru da Evolution não diz nada ao
            // usuário. A classificação acima usa o erro cru, não este texto.
            const legivel =
              /"exists"\s*:\s*false/i.test(falhou)
                ? "Número não existe no WhatsApp — confira o DDD"
              : /Connection Closed|socket hang up/i.test(falhou)
                ? (retentar ? "WhatsApp desconectado — será retentado" : "WhatsApp desconectado")
              : transitorio
                ? (retentar ? "Erro temporário — será retentado" : "Erro temporário na Evolution")
              : falhou.slice(0, 300);

            await supabase.from("transmissao_contatos").update({
              status: retentar ? "pendente" : "falhou",
              erro_msg: legivel,
              tentativas,
              // Espera antes de retentar: insistir na hora só repete o erro
              // enquanto a instância não reconectou.
              proximo_envio_em: retentar
                ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null,
            }).eq("id", contato.id);
            await supabase.from("campanhas")
              .update({ enviados, updated_at: new Date().toISOString() }).eq("id", campanha_id);
          }

          // Intervalo aleatório entre contatos para evitar bloqueio
          const delay = minMs + Math.random() * (maxMs - minMs);
          await new Promise(r3 => setTimeout(r3, delay));
        } catch (e) {
          await supabase.from("transmissao_contatos")
            .update({ status: "falhou", erro_msg: (e as Error).message }).eq("id", contato.id);
        }
      }

      if (interrompida || Date.now() > bcDeadline) break;

      const prox = await buscarLote();
      if (prox.length > 0) { contatos = prox; continue; }

      // Só conclui quando não restar pendente nem rodada de repetição.
      const fim = await finalizar(enviados);
      if (fim !== CONTINUAR) return fim;
      contatos = await buscarLote();
      if (contatos.length === 0) break;
      }

      // Orçamento esgotado: o próximo ciclo do cron retoma de onde parou.
      const restante = await finalizar(enviados);
      return restante === CONTINUAR
        ? json({ success: true, enviados, continua: true })
        : restante;
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
    // SYNC CHATS — importa TODAS as conversas da Evolution API (lista de chats)
    // Cria entradas no banco para contatos que ainda não existem.
    // ────────────────────────────────────────────────────────────────────────
    if (action === "syncChats") {
      type ChatEntry = {
        id?: string; remoteJid?: string; name?: string; pushName?: string;
        subject?: string; unreadCount?: number; timestamp?: number;
        lastMessage?: { conversation?: string; [k: string]: unknown };
        [k: string]: unknown;
      };

      let chatList: ChatEntry[] = [];

      // Endpoint 1: GET /chat/findChats/{instance}
      try {
        const r1 = await iFetch(`/chat/findChats/${instName}`);
        if (r1.ok) {
          const d1 = await r1.json();
          const arr: ChatEntry[] = Array.isArray(d1) ? d1
            : (Array.isArray(d1?.chats) ? d1.chats
            : Array.isArray(d1?.data) ? d1.data : []);
          if (arr.length) chatList = arr;
        }
      } catch (_) {}

      // Endpoint 2: POST fallback
      if (!chatList.length) {
        try {
          const r2 = await iFetch(`/chat/findChats/${instName}`, {
            method: "POST", body: JSON.stringify({}),
          });
          if (r2.ok) {
            const d2 = await r2.json();
            const arr: ChatEntry[] = Array.isArray(d2) ? d2
              : (Array.isArray(d2?.chats) ? d2.chats
              : Array.isArray(d2?.data) ? d2.data : []);
            if (arr.length) chatList = arr;
          }
        } catch (_) {}
      }

      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      // Função auxiliar: bulk-sync lista de chats para uma empresa/instância
      type ParsedChat = { phone: string; name: string; instanciaId: string | null };
      const bulkSyncChats = async (chats: ChatEntry[], instanciaId: string | null) => {
        const parsed: ParsedChat[] = [];
        for (const chat of chats) {
          // remoteJid primeiro: o campo id da Evolution v2 é um CUID do banco.
          const jid = (chat.remoteJid || chat.id || "") as string;
          if (!jid || jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) continue;
          const isGroup = jid.endsWith("@g.us");
          if (!isGroup && !jid.endsWith("@s.whatsapp.net")) continue;
          const phone = isGroup ? jid : jid.replace(/@s\.whatsapp\.net$/, "");
          const name  = (chat.subject || chat.name || chat.pushName || phone) as string;
          parsed.push({ phone, name, instanciaId });
        }
        if (!parsed.length) return;

        // Batch-check existing (500 por vez)
        const existingMap = new Map<string, string>();  // phone -> contato_nome
        const BATCH = 500;
        for (let i = 0; i < parsed.length; i += BATCH) {
          const phones = parsed.slice(i, i + BATCH).map(c => c.phone);
          const { data: ex } = await supabase.from("conversas")
            .select("id, contato_telefone, contato_nome")
            .eq("empresa_id", empresa_id)
            .in("contato_telefone", phones);
          (ex ?? []).forEach(r => existingMap.set(r.contato_telefone, r.contato_nome ?? ""));
        }

        // Insere novas conversas em lotes de 200
        const toInsert = parsed
          .filter(c => !existingMap.has(c.phone))
          .map(c => ({
            empresa_id,
            contato_nome:     c.name,
            contato_telefone: c.phone,
            ultima_mensagem:  "",
            ultima_hora:      null,
            nao_lidas:        0,
            status:           "aberta",
            bot_ativo:        null,
            whatsapp_numero:  c.phone,
            instancia_id:     c.instanciaId,
          }));

        for (let i = 0; i < toInsert.length; i += 200) {
          const { error: ie } = await supabase.from("conversas").insert(toInsert.slice(i, i + 200));
          if (ie && ie.code !== "23505") errors.push(ie.message);
          else created += Math.min(200, toInsert.length - i);
        }

        // Atualiza nomes em branco (phone como nome) — apenas os que existiam
        const toUpdateName = parsed.filter(c => {
          const existingName = existingMap.get(c.phone);
          return existingName !== undefined
            && c.name && c.name !== c.phone
            && (!existingName || existingName === c.phone);
        });
        for (const c of toUpdateName) {
          await supabase.from("conversas")
            .update({ contato_nome: c.name })
            .eq("empresa_id", empresa_id)
            .eq("contato_telefone", c.phone);
          updated++;
        }
      };

      await bulkSyncChats(chatList, null);

      // ── Instâncias secundárias (empresa_instancias) ──────────────────────
      const { data: secInsts } = await supabase.from("empresa_instancias")
        .select("id, evolution_instance_id, evolution_instance_token")
        .eq("empresa_id", empresa_id)
        .eq("ativo", true)
        .not("evolution_instance_id", "is", null);

      for (const secInst of secInsts ?? []) {
        const secName  = (secInst.evolution_instance_id || "") as string;
        const secToken = (secInst.evolution_instance_token || apiKey) as string;
        const iFetchSec = (path: string, opts: RequestInit = {}) =>
          fetch(`${evoUrl}${path}`, {
            ...opts,
            headers: { "Content-Type": "application/json", "apikey": secToken, ...(opts.headers || {}) },
          });

        let secChats: ChatEntry[] = [];
        try {
          const r = await iFetchSec(`/chat/findChats/${secName}`);
          if (r.ok) { const d = await r.json(); secChats = Array.isArray(d) ? d : (d?.chats ?? d?.data ?? []); }
        } catch (_) {}
        if (!secChats.length) {
          try {
            const r2 = await iFetchSec(`/chat/findChats/${secName}`, { method: "POST", body: JSON.stringify({}) });
            if (r2.ok) { const d2 = await r2.json(); secChats = Array.isArray(d2) ? d2 : (d2?.chats ?? d2?.data ?? []); }
          } catch (_) {}
        }

        await bulkSyncChats(secChats, secInst.id as string);
      }

      return json({ success: true, total: chatList.length, created, updated, errors: errors.slice(0, 10) });
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

      const extractB64 = (d: Record<string, unknown>) => {
        type Nested = { base64?: string; mimetype?: string };
        const rawB64 = (d?.base64 ?? (d?.data as Nested)?.base64 ?? (d?.media as Nested)?.base64 ?? null) as string | null;
        const mimetype = ((d?.mimetype ?? (d?.data as Nested)?.mimetype ?? (d?.media as Nested)?.mimetype ?? d?.type ?? "application/octet-stream") as string);
        const base64 = typeof rawB64 === "string" && rawB64.startsWith("data:")
          ? (rawB64.indexOf(",") >= 0 ? rawB64.slice(rawB64.indexOf(",") + 1) : null)
          : rawB64;
        return base64 ? { base64, mimetype } : null;
      };

      // Try standard payload first, then legacy nested format as fallback
      const payloads = [
        { id: String(wamid) },
        { message: { key: { id: String(wamid) } } },
      ];

      let lastErr = "Mídia não disponível ou expirada";
      for (const payload of payloads) {
        try {
          const r = await iFetch(`/message/getBase64FromMediaMessage/${instName}`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          if (!r.ok) {
            const errTxt = await r.text().catch(() => "");
            lastErr = `Evolution ${r.status}: ${errTxt.slice(0, 120)}`;
            console.warn(`fetchMedia attempt failed (${JSON.stringify(payload)}): ${lastErr}`);
            continue;
          }
          const d = await r.json() as Record<string, unknown>;
          const result = extractB64(d);
          if (result) return json({ success: true, ...result });
          lastErr = "Mídia não disponível ou expirada";
        } catch (e) {
          lastErr = (e as Error).message;
          console.warn(`fetchMedia attempt threw: ${lastErr}`);
        }
      }

      console.error(`fetchMedia falhou para wamid=${wamid} inst=${instName}: ${lastErr}`);
      return json({ success: false, error: lastErr });
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

    // ────────────────────────────────────────────────────────────────────────
    // MULTI-INSTÂNCIA: listInstancias — lista instâncias secundárias da empresa
    // ────────────────────────────────────────────────────────────────────────
    if (action === "listInstancias") {
      const { data: insts, error: instErr } = await supabase
        .from("empresa_instancias")
        .select("id, nome, evolution_instance_id, evolution_connected, evolution_phone, eh_principal, ativo, evolution_qr_temp")
        .eq("empresa_id", empresa_id)
        .order("created_at");
      if (instErr) return json({ error: instErr.message }, 500);
      return json({ success: true, instancias: insts || [] });
    }

    // ────────────────────────────────────────────────────────────────────────
    // MULTI-INSTÂNCIA: createInstancia — cria nova instância secundária
    // ────────────────────────────────────────────────────────────────────────
    if (action === "createInstancia") {
      const { nome: instNome } = body;
      if (!instNome?.trim()) return json({ error: "nome da instância é obrigatório" }, 400);

      const myToken    = crypto.randomUUID();
      const safeName   = `c4HUB-${sanitizeName(emp.nome || empresa_id.slice(0, 8))}-${sanitizeName(instNome)}-${myToken.slice(0, 6)}`;
      const webhookUrl = `${SUPA_URL}/functions/v1/evolution-webhook?token=${myToken}`;

      // Insere registro no banco antes de criar na API (para webhook encontrar empresa_id)
      const { data: newInst, error: dbErr } = await supabase
        .from("empresa_instancias")
        .insert({
          empresa_id,
          nome:                     instNome.trim(),
          evolution_instance_id:    safeName,
          evolution_instance_token: myToken,
          eh_principal:             false,
          ativo:                    true,
          evolution_connected:      false,
        })
        .select("id")
        .single();
      if (dbErr || !newInst) return json({ error: dbErr?.message || "Erro ao criar instância no banco" }, 500);

      try {
        const cr = await gFetch("/instance/create", {
          method: "POST",
          body: JSON.stringify({
            instanceName:    safeName,
            name:            safeName,
            token:           myToken,
            qrcode:          true,
            integration:     "WHATSAPP-BAILEYS",
            syncFullHistory: true,
            webhookByEvents: false,
            webhook_by_events: false,
            webhook: {
              url:             webhookUrl,
              events:          WEBHOOK_EVENTS,
              webhookByEvents: false,
              base64:          true,
            },
            webhookUrl,
          }),
        });
        const cd = await cr.json();
        console.log("[createInstancia] status:", cr.status, JSON.stringify(cd).slice(0, 400));

        if (!cr.ok) {
          // Reverte o banco se a API falhou
          await supabase.from("empresa_instancias").delete().eq("id", newInst.id);
          return json({ error: cd.message || cd.error || JSON.stringify(cd) }, 400);
        }

        const tok  = cd?.hash?.apikey || cd?.data?.token || cd?.token || myToken;
        const nm   = cd?.instance?.instanceName || cd?.data?.name || cd?.name || safeName;
        const qr   = cd?.qrcode?.base64 || cd?.data?.Qrcode || cd?.Qrcode || cd?.instance?.qrcode?.base64 || "";

        // Atualiza com token/nome retornados pela API
        await supabase.from("empresa_instancias").update({
          evolution_instance_id:    nm,
          evolution_instance_token: tok,
          evolution_qr_temp:        qr || null,
        }).eq("id", newInst.id);

        // Configura webhook explicitamente
        const _wUrl3 = `${SUPA_URL}/functions/v1/evolution-webhook?token=${tok}`;
        const _wBody3 = JSON.stringify({ webhook: { url: _wUrl3, events: WEBHOOK_EVENTS_V2, enabled: true, webhookByEvents: false, base64: true } });
        fetch(`${evoUrl}/webhook/set/${nm}`, { method: "PUT",  headers: { "Content-Type": "application/json", "apikey": tok }, body: _wBody3 })
          .then(r => r.ok ? r : fetch(`${evoUrl}/webhook/set/${nm}`, { method: "POST", headers: { "Content-Type": "application/json", "apikey": tok }, body: _wBody3 }))
          .catch(() => {});

        return json({ success: true, instancia_id: newInst.id, instanceName: nm, token: tok, qrBase64: qr });
      } catch (e) {
        await supabase.from("empresa_instancias").delete().eq("id", newInst.id);
        return json({ error: (e as Error).message }, 500);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // MULTI-INSTÂNCIA: connectInstancia — gera QR para instância secundária
    // ────────────────────────────────────────────────────────────────────────
    if (action === "connectInstancia") {
      const { instancia_id } = body;
      if (!instancia_id) return json({ error: "instancia_id obrigatório" }, 400);

      const { data: inst, error: instErr } = await supabase
        .from("empresa_instancias")
        .select("*")
        .eq("id", instancia_id)
        .eq("empresa_id", empresa_id)
        .single();
      if (instErr || !inst) return json({ error: "Instância não encontrada" }, 404);

      const iToken = inst.evolution_instance_token;
      const iName  = inst.evolution_instance_id;

      const iFetchInst = (path: string, opts: RequestInit = {}) =>
        fetch(`${evoUrl}${path}`, {
          ...opts,
          headers: { "Content-Type": "application/json", "apikey": iToken || apiKey, ...(opts.headers || {}) },
        });

      const extractQr = (d: Record<string, unknown>): string =>
        (d?.base64 || d?.qrcode?.base64 || d?.Qrcode || d?.data?.Qrcode || d?.data?.qrcode || d?.instance?.qrcode?.base64 || "") as string;

      // Tenta conectar; se estiver travada em "connecting", faz logout e tenta de novo
      let qrBase64 = "";
      try {
        const r = await iFetchInst(`/instance/connect/${iName}`);
        const d = await r.json();
        qrBase64 = extractQr(d);
        const state = d?.instance?.state || d?.state || d?.data?.state || "";
        if (!qrBase64 && state === "open") {
          await supabase.from("empresa_instancias").update({ evolution_connected: true, evolution_qr_temp: null }).eq("id", instancia_id);
          return json({ success: true, alreadyConnected: true });
        }
        // Instância travada em "connecting" — faz logout para limpar o estado e tenta QR fresh
        if (!qrBase64 && state === "connecting") {
          await iFetchInst(`/instance/logout/${iName}`, { method: "DELETE" }).catch(() => {});
          await new Promise(r => setTimeout(r, 1500));
          const r2 = await iFetchInst(`/instance/connect/${iName}`);
          const d2 = await r2.json();
          qrBase64 = extractQr(d2);
        }
      } catch (_) {}

      if (qrBase64) {
        await supabase.from("empresa_instancias").update({ evolution_qr_temp: qrBase64 }).eq("id", instancia_id);
        return json({ success: true, qrBase64 });
      }

      return json({ success: false, qrBase64: "", needsRetry: true });
    }

    // ────────────────────────────────────────────────────────────────────────
    // MULTI-INSTÂNCIA: qrInstancia — polling de QR para instância secundária
    // ────────────────────────────────────────────────────────────────────────
    if (action === "qrInstancia") {
      const { instancia_id } = body;
      if (!instancia_id) return json({ error: "instancia_id obrigatório" }, 400);

      const { data: inst } = await supabase
        .from("empresa_instancias")
        .select("evolution_qr_temp, evolution_connected")
        .eq("id", instancia_id)
        .eq("empresa_id", empresa_id)
        .single();
      if (!inst) return json({ error: "Instância não encontrada" }, 404);

      if (inst.evolution_connected) return json({ data: { Connected: true } });
      if (inst.evolution_qr_temp)   return json({ data: { Qrcode: inst.evolution_qr_temp } });

      return json({ data: { Qrcode: null, Connected: false } });
    }

    // ────────────────────────────────────────────────────────────────────────
    // MULTI-INSTÂNCIA: deleteInstancia — remove instância secundária
    // ────────────────────────────────────────────────────────────────────────
    if (action === "deleteInstancia") {
      const { instancia_id } = body;
      if (!instancia_id) return json({ error: "instancia_id obrigatório" }, 400);

      const { data: inst } = await supabase
        .from("empresa_instancias")
        .select("*")
        .eq("id", instancia_id)
        .eq("empresa_id", empresa_id)
        .single();
      if (!inst) return json({ error: "Instância não encontrada" }, 404);

      // Best-effort: deleta na API
      const iToken = inst.evolution_instance_token;
      const iName  = inst.evolution_instance_id;
      try {
        await fetch(`${evoUrl}/instance/delete/${iName}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json", "apikey": iToken || apiKey },
        });
      } catch (_) {}

      // Remove do banco
      await supabase.from("empresa_instancias").delete().eq("id", instancia_id);
      return json({ success: true });
    }

    // ────────────────────────────────────────────────────────────────────────
    // FORCE SYNC HISTORY — paginação global de TODAS as mensagens da instância.
    // Suporta loop do frontend: cada chamada processa um batch e retorna nextPage.
    // ────────────────────────────────────────────────────────────────────────
    if (action === "forceSyncHistory") {
      const startPage    = Number(body.page) || 1;
      const PAGE_SIZE    = 200;  // msgs por página da API
      const PAGES_PER_CALL = 5; // páginas por chamada = 1.000 msgs max por chamada
      const syncInstName = emp.evolution_instance_id;
      const instKey      = emp.evolution_instance_token || apiKey;
      if (!syncInstName || !evoUrl) return json({ error: "Instância não configurada" }, 400);

      const now     = new Date().toISOString();
      const startMs = Date.now();
      let totalInserted = 0;
      let totalSkipped  = 0;
      let totalPages    = 0;
      const errors: string[] = [];

      // Cache remoteJid → conversa_id para evitar queries repetidas
      const convCache = new Map<string, string | null>();

      const safeTs = (rawTs: unknown, fallback: string): string => {
        if (!rawTs) return fallback;
        if (typeof rawTs === "number") {
          const ms = rawTs < 1e12 ? rawTs * 1000 : rawTs;
          const d = new Date(ms); return isNaN(d.getTime()) ? fallback : d.toISOString();
        }
        if (typeof rawTs === "string") {
          if (/^\d+$/.test(rawTs)) return safeTs(parseInt(rawTs, 10), fallback);
          const d = new Date(rawTs); return isNaN(d.getTime()) ? fallback : d.toISOString();
        }
        return fallback;
      };

      const extractText = (mc: Record<string, unknown>): string => {
        const ec = (mc.extendedTextMessage || {}) as Record<string, unknown>;
        const ig = (mc.imageMessage || {}) as Record<string, unknown>;
        const vg = (mc.videoMessage || {}) as Record<string, unknown>;
        const dc = (mc.documentMessage || {}) as Record<string, unknown>;
        return (mc.conversation as string) || (ec.text as string) ||
          (ig.caption as string) || (vg.caption as string) ||
          (mc.audioMessage || mc.pttMessage ? "[🎤 Áudio]" : "") ||
          (mc.stickerMessage ? "[Sticker]" : "") ||
          (mc.locationMessage ? "[📍 Localização]" : "") ||
          (dc.title ? `[📄 ${dc.title}]` : "") || "[Mensagem]";
      };

      const extractTipo = (mc: Record<string, unknown>): { tipo: string; mediaUrl: string | null } => {
        const ig = (mc.imageMessage || {}) as Record<string, unknown>;
        const vg = (mc.videoMessage || {}) as Record<string, unknown>;
        const dc = (mc.documentMessage || {}) as Record<string, unknown>;
        const au = (mc.audioMessage || mc.pttMessage || {}) as Record<string, unknown>;
        if (mc.audioMessage || mc.pttMessage) return { tipo: "audio",     mediaUrl: (au.url as string) || null };
        if (mc.imageMessage)    return { tipo: "imagem",    mediaUrl: (ig.url as string) || null };
        if (mc.videoMessage)    return { tipo: "video",     mediaUrl: (vg.url as string) || null };
        if (mc.documentMessage) return { tipo: "documento", mediaUrl: (dc.url as string) || null };
        if (mc.stickerMessage)  return { tipo: "sticker",   mediaUrl: null };
        return { tipo: "texto", mediaUrl: null };
      };

      // Resolve ou cria conversa para um remoteJid
      const resolveConv = async (remoteJid: string, pushName: string): Promise<string | null> => {
        if (convCache.has(remoteJid)) return convCache.get(remoteJid)!;

        const isGroup = remoteJid.endsWith("@g.us");
        const phone   = isGroup ? remoteJid : remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/@.*$/, "");

        const { data: ex } = await supabase.from("conversas")
          .select("id").eq("empresa_id", empresa_id).eq("contato_telefone", phone).maybeSingle();
        if (ex?.id) { convCache.set(remoteJid, ex.id); return ex.id; }

        const { data: novo, error: ie } = await supabase.from("conversas").insert({
          empresa_id,
          contato_nome:     pushName || (isGroup ? "Grupo" : phone),
          contato_telefone: phone,
          ultima_mensagem:  "",
          ultima_hora:      null,
          nao_lidas:        0,
          status:           "aberta",
          bot_ativo:        null,
          whatsapp_numero:  phone,
        }).select("id").single();

        if (ie?.code === "23505") {
          const { data: race } = await supabase.from("conversas")
            .select("id").eq("empresa_id", empresa_id).eq("contato_telefone", phone).maybeSingle();
          convCache.set(remoteJid, race?.id || null);
          return race?.id || null;
        }
        convCache.set(remoteJid, novo?.id || null);
        return novo?.id || null;
      };

      // Rastreia ultima_mensagem por conversa para atualizar no final
      const convLastMsg = new Map<string, { hora: string; texto: string }>();

      let lastPageFetched = startPage - 1;
      let hasMore = true;

      for (let page = startPage; page < startPage + PAGES_PER_CALL && hasMore; page++) {
        if (Date.now() - startMs > 50_000) break;

        try {
          // POST com body (formato suportado pela Evolution API v2/GO)
          const r = await fetch(
            `${evoUrl}/chat/findMessages/${syncInstName}`,
            {
              method: "POST",
              headers: { "apikey": instKey, "Content-Type": "application/json" },
              body: JSON.stringify({ limit: PAGE_SIZE, page }),
              signal: AbortSignal.timeout(20000),
            }
          );

          if (!r.ok) { errors.push(`p${page}: HTTP ${r.status}`); break; }

          const result = await r.json();
          // Parseia total de páginas — tenta todas as variações da API
          const msgTotal = result?.messages?.total || result?.total || 0;
          totalPages = result?.messages?.pages || result?.pages ||
            (msgTotal > 0 ? Math.ceil(msgTotal / PAGE_SIZE) : totalPages);

          // Evolution API v2: { messages: { records: [], pages: N } }
          const msgs: unknown[] = Array.isArray(result?.messages?.records) ? result.messages.records
            : (Array.isArray(result) ? result
            : Array.isArray(result?.messages) ? result.messages
            : Array.isArray(result?.records) ? result.records : []);

          if (!msgs.length) { hasMore = false; break; }
          if (totalPages > 0 && page >= totalPages) hasMore = false;
          lastPageFetched = page;

          for (const msg of msgs) {
            if (!msg || typeof msg !== "object") continue;
            const m      = msg as Record<string, unknown>;
            const key_   = (m.key || {}) as Record<string, unknown>;
            const remoteJid = (key_.remoteJid || "") as string;

            // Ignora mensagens sem JID ou de feeds especiais
            if (!remoteJid || remoteJid.endsWith("@broadcast") ||
                remoteJid.endsWith("@newsletter") ||
                (!remoteJid.endsWith("@g.us") && !remoteJid.endsWith("@s.whatsapp.net"))) continue;

            const fromMe  = Boolean(key_.fromMe);
            const wamid   = (key_.id || m.id || "") as string;
            if (!wamid) continue;

            const pushName   = (m.pushName || "") as string;
            const msgContent = (m.message || {}) as Record<string, unknown>;
            const texto      = extractText(msgContent);
            const { tipo, mediaUrl } = extractTipo(msgContent);
            const hora       = safeTs(m.messageTimestamp || m.messageTimestampMs, now);

            const convId = await resolveConv(remoteJid, pushName);
            if (!convId) continue;

            // Rastreia última msg por conversa
            const cur = convLastMsg.get(convId);
            if (!cur || hora > cur.hora) convLastMsg.set(convId, { hora, texto });

            const { error: insErr } = await supabase.from("mensagens").insert({
              conversa_id: convId, empresa_id,
              de: fromMe ? "me" : "contato", remetente: fromMe ? "me" : "contato",
              texto, tipo, media_url: mediaUrl, wamid, hora,
              status: fromMe ? "enviado" : "recebido",
            });
            if (insErr) {
              if (insErr.code === "23505") totalSkipped++;
              else errors.push(`${wamid}: ${insErr.message}`);
            } else {
              totalInserted++;
            }
          }
        } catch (e) { errors.push(`p${page}: ${(e as Error).message}`); /* continua para próxima página */ }
      }

      // ── Quando a instância principal termina, processa secundárias ─────────
      if (!hasMore) {
        const { data: secInsts } = await supabase.from("empresa_instancias")
          .select("id, evolution_instance_id, evolution_instance_token")
          .eq("empresa_id", empresa_id)
          .eq("ativo", true)
          .not("evolution_instance_id", "is", null);

        for (const secInst of secInsts ?? []) {
          if (Date.now() - startMs > 50_000) break;
          const secName  = (secInst.evolution_instance_id || "") as string;
          const secToken = (secInst.evolution_instance_token || apiKey) as string;
          let secP = 1;
          let secMore = true;

          while (secMore && Date.now() - startMs < 50_000) {
            try {
              const r = await fetch(`${evoUrl}/chat/findMessages/${secName}`, {
                method: "POST",
                headers: { "apikey": secToken, "Content-Type": "application/json" },
                body: JSON.stringify({ limit: PAGE_SIZE, page: secP }),
                signal: AbortSignal.timeout(20000),
              });
              if (!r.ok) { secMore = false; break; }
              const result = await r.json();
              const secMsgs: unknown[] = Array.isArray(result?.messages?.records) ? result.messages.records
                : (Array.isArray(result) ? result : Array.isArray(result?.messages) ? result.messages
                : Array.isArray(result?.records) ? result.records : []);
              if (!secMsgs.length) { secMore = false; break; }
              const secTotalPg = result?.messages?.pages || result?.pages || 1;
              if (secP >= secTotalPg) secMore = false;

              for (const msg of secMsgs) {
                if (!msg || typeof msg !== "object") continue;
                const m  = msg as Record<string, unknown>;
                const k  = (m.key || {}) as Record<string, unknown>;
                const rj = (k.remoteJid || "") as string;
                if (!rj || rj.endsWith("@broadcast") || rj.endsWith("@newsletter") ||
                    (!rj.endsWith("@g.us") && !rj.endsWith("@s.whatsapp.net"))) continue;
                const fromMe = Boolean(k.fromMe);
                const wamid  = (k.id || m.id || "") as string;
                if (!wamid) continue;
                const mc    = (m.message || {}) as Record<string, unknown>;
                const texto = extractText(mc);
                const { tipo, mediaUrl } = extractTipo(mc);
                const hora  = safeTs(m.messageTimestamp || m.messageTimestampMs, now);
                const convId = await resolveConv(rj, (m.pushName || "") as string);
                if (!convId) continue;
                const cur = convLastMsg.get(convId);
                if (!cur || hora > cur.hora) convLastMsg.set(convId, { hora, texto });
                const { error: insErr } = await supabase.from("mensagens").insert({
                  conversa_id: convId, empresa_id,
                  de: fromMe ? "me" : "contato", remetente: fromMe ? "me" : "contato",
                  texto, tipo, media_url: mediaUrl, wamid, hora,
                  status: fromMe ? "enviado" : "recebido", instancia_id: secInst.id,
                });
                if (insErr) { if (insErr.code === "23505") totalSkipped++; else errors.push(`sec:${wamid}: ${insErr.message}`); }
                else totalInserted++;
              }
              secP++;
            } catch (_) { secMore = false; }
          }
        }
      }

      // Atualiza ultima_mensagem/ultima_hora de cada conversa:
      // 1) conversas com ultima_hora null (novas da sincronização)
      // 2) conversas onde a msg do batch é mais recente que a registrada
      for (const [convId, { hora, texto }] of convLastMsg) {
        await supabase.from("conversas")
          .update({ ultima_mensagem: texto, ultima_hora: hora })
          .eq("id", convId)
          .is("ultima_hora", null);
        await supabase.from("conversas")
          .update({ ultima_mensagem: texto, ultima_hora: hora })
          .eq("id", convId)
          .lt("ultima_hora", hora);
      }

      const nextPage = hasMore ? lastPageFetched + 1 : null;

      return json({
        success:      true,
        page:         startPage,
        next_page:    nextPage,
        total_pages:  totalPages,
        synced:       totalInserted,
        skipped:      totalSkipped,
        elapsed_ms:   Date.now() - startMs,
        errors:       errors.slice(0, 10),
      });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error("evolution-action error:", e);
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});
