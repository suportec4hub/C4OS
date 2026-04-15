import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "GET") return new Response("OK", { status: 200 });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const GLOBAL_URL = "https://evolution-api-xrrw.srv1583408.hstgr.cloud";

  try {
    const reqUrl       = new URL(req.url);
    // Evolution API com "Webhook by Events" ativo appenda "/nome-do-evento" ao token
    // Ex: ?token=04e3768f-9942.../messages-upsert  →  precisamos só do UUID
    const rawToken     = reqUrl.searchParams.get("token") || "";
    const tokenFromUrl = rawToken.split("/")[0].trim();   // strip suffix de evento
    const body         = await req.json();

    // Evolution GO (Go version) usa 'eventString'; Evolution API (Node) usa 'event'
    const event = body.event || body.eventString || body.Event || "";
    const data  = body.data  || body.Data  || body;

    console.log("[webhook] event:", event, "| keys:", Object.keys(body).join(","));

    // Localiza empresa pelo token (URL param tem prioridade)
    const instanceToken = tokenFromUrl || body.apikey || body.instance?.apikey || body.instance?.token || "";
    // Evolution GO pode enviar instanceName (nome) em vez de UUID
    const instanceName  = body.instance?.instanceName || body.instance?.name || body.instanceName || "";
    const instanceId    = body.instance?.id || body.instanceId || "";

    let empresa_id: string | null = null;
    if (instanceToken) {
      const { data: emp } = await supabase.from("empresas").select("id").eq("evolution_instance_token", instanceToken).maybeSingle();
      if (emp) empresa_id = emp.id;
    }
    // Busca por instanceName (guardado em evolution_instance_id como string de nome)
    if (!empresa_id && instanceName) {
      const { data: emp } = await supabase.from("empresas").select("id").eq("evolution_instance_id", instanceName).maybeSingle();
      if (emp) empresa_id = emp.id;
    }
    if (!empresa_id && instanceId) {
      const { data: emp } = await supabase.from("empresas").select("id").eq("evolution_instance_id", instanceId).maybeSingle();
      if (emp) empresa_id = emp.id;
    }
    if (!empresa_id) {
      console.error("[webhook] empresa nao encontrada | token:", instanceToken.slice(0, 8), "| instanceName:", instanceName);
      return new Response("Instance not found", { status: 404 });
    }

    const now = new Date().toISOString();

    // ── QR CODE
    if (["QRCODE","QRCODE_UPDATED","qrcode.updated"].includes(event)) {
      const qr = data?.qrcode?.base64 || data?.base64 || data?.Qrcode || (typeof data?.qrcode === "string" ? data.qrcode : "");
      if (qr) await supabase.from("empresas").update({ evolution_qr_temp: qr }).eq("id", empresa_id);
      return new Response("OK");
    }

    // ── CONEXÃO
    if (["CONNECTION","CONNECTION_UPDATE","Connected","Disconnected","connection.update"].includes(event)) {
      // Evolution GO pode enviar state em data.state ou data.instance.state
      const state =
        data?.state || data?.instance?.state ||
        (event === "Connected" ? "open" : event === "Disconnected" ? "close" : "");
      if (state === "open" || event === "Connected") {
        const jid   = data?.jid || data?.instance?.jid || "";
        const phone = jid.replace(/@s\.whatsapp\.net$/, "").replace(/:.*$/, "");
        await supabase.from("empresas").update({
          evolution_connected: true,
          evolution_phone:     phone || "",
          evolution_qr_temp:   null,
        }).eq("id", empresa_id);
      } else if (state === "close" || state === "connecting" || event === "Disconnected") {
        await supabase.from("empresas").update({ evolution_connected: false }).eq("id", empresa_id);
      }
      return new Response("OK");
    }

    // ── GRUPOS (nome do grupo via GROUPS_UPSERT / GROUP_UPDATE)
    if (["GROUPS_UPSERT","GROUP_UPDATE","groups.upsert","groups.update"].includes(event)) {
      const groups = Array.isArray(data) ? data : (data?.groups ? data.groups : [data]);
      for (const g of groups) {
        if (!g?.id || !g?.subject) continue;
        const gJid = g.id.includes("@g.us") ? g.id : `${g.id}@g.us`;

        const { data: existing } = await supabase.from("conversas")
          .select("id")
          .eq("empresa_id", empresa_id)
          .eq("contato_telefone", gJid)
          .maybeSingle();

        if (existing) {
          // Atualiza nome do grupo na conversa existente
          await supabase.from("conversas")
            .update({ contato_nome: g.subject })
            .eq("id", existing.id);
        } else {
          // Cria conversa para o grupo (pode não ter mensagens ainda)
          await supabase.from("conversas").insert({
            empresa_id,
            contato_nome:     g.subject,
            contato_telefone: gJid,
            ultima_mensagem:  "",
            ultima_hora:      now,
            nao_lidas:        0,
            status:           "aberta",
            bot_ativo:        false,
          });
        }
      }
      return new Response("OK");
    }

    // ── HISTORY SYNC
    if (["HISTORY_SYNC","messaging-history.set"].includes(event)) {
      console.log("[webhook] HISTORY_SYNC recebido");
      const allMsgs: unknown[] = [];
      if (Array.isArray(data?.messages)) allMsgs.push(...data.messages);
      if (Array.isArray(data?.conversations)) {
        for (const conv of data.conversations) {
          if (Array.isArray(conv?.messages)) allMsgs.push(...conv.messages);
        }
      }
      if (allMsgs.length > 0) {
        console.log("[webhook] HISTORY_SYNC msgs:", allMsgs.length);
        await processMessages(allMsgs, empresa_id, supabase, GLOBAL_URL, now, true);
      }
      return new Response("OK");
    }

    // ── MENSAGEM (Evolution GO usa "MESSAGE"; Evolution API usa "MESSAGES_UPSERT")
    if (["MESSAGE","MESSAGES_UPSERT","Message","messages.upsert"].includes(event)) {
      const msgs = Array.isArray(data) ? data : [data];
      await processMessages(msgs, empresa_id, supabase, GLOBAL_URL, now, false);
      return new Response("OK");
    }

    console.log("[webhook] evento nao tratado:", event);
    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("evolution-webhook error:", e);
    return new Response("Error", { status: 500 });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Extrai timestamp de forma segura (aceita Unix number ou ISO string)
// ─────────────────────────────────────────────────────────────────────────────
function safeTimestamp(rawTs: unknown, fallback: string): string {
  if (!rawTs) return fallback;
  if (typeof rawTs === "number") {
    const ms = rawTs < 1e12 ? rawTs * 1000 : rawTs;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? fallback : d.toISOString();
  }
  if (typeof rawTs === "string") {
    // ISO string (ex: "2026-04-14T07:19:08Z") ou "1776161768"
    if (/^\d+$/.test(rawTs)) {
      const n = parseInt(rawTs, 10);
      return safeTimestamp(n, fallback);
    }
    const d = new Date(rawTs);
    return isNaN(d.getTime()) ? fallback : d.toISOString();
  }
  return fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Processa array de mensagens — suporta o formato Go (Info.X) e o formato
// Baileys (key.x). O Evolution GO (versão Go) usa o formato Go.
// ─────────────────────────────────────────────────────────────────────────────
async function processMessages(
  msgs: unknown[], empresa_id: string, supabase: ReturnType<typeof createClient>,
  GLOBAL_URL: string, now: string, isHistory: boolean
) {
  for (const msg of msgs) {
    if (!msg || typeof msg !== "object") continue;
    const m = msg as Record<string, unknown>;

    // ── Detecta formato: Go (Info) vs Baileys (key) ──────────────────────────
    const info    = (m.Info || m.info || {}) as Record<string, unknown>;
    const key     = (m.key  || m.Key  || {}) as Record<string, unknown>;

    // fromMe: Go usa Info.IsFromMe | Baileys usa key.fromMe
    const fromMe  = Boolean(info.IsFromMe ?? key.fromMe ?? false);

    // Para tempo real: ignora mensagens enviadas (só processa recebidas)
    if (!isHistory && fromMe) continue;

    // remoteJid: Go usa Info.Chat | Baileys usa key.remoteJid
    // Info.Chat é SEMPRE o JID da conversa (destinatário/remetente externo)
    const remoteJid = ((info.Chat || key.remoteJid || "") as string);
    if (!remoteJid) continue;
    if (remoteJid.endsWith("@broadcast")) continue; // ignora broadcast, mas permite grupos

    const isGroup   = remoteJid.endsWith("@g.us");

    // Identificador da conversa: JID completo para grupos, só número para individuais
    const senderPhone = isGroup
      ? remoteJid
      : remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/:.*$/, "");
    if (!senderPhone) continue;

    // Nome do contato: Go usa Info.PushName | Baileys usa pushName
    // Para grupos: pushName é o nome de quem enviou a mensagem (não o nome do grupo)
    const senderName = ((info.PushName || m.pushName || m.PushName || (isGroup ? "Grupo" : senderPhone)) as string);

    // Conteúdo: Go usa Message (capital) | Baileys usa message
    const msgContent = (m.Message || m.message || {}) as Record<string, unknown>;

    // Extrai texto (suporta todos os tipos comuns)
    const ec    = (msgContent.extendedTextMessage || msgContent.ExtendedTextMessage || {}) as Record<string,unknown>;
    const imgC  = (msgContent.imageMessage   || msgContent.ImageMessage   || {}) as Record<string,unknown>;
    const vidC  = (msgContent.videoMessage   || msgContent.VideoMessage   || {}) as Record<string,unknown>;
    const docC  = (msgContent.documentMessage|| msgContent.DocumentMessage|| {}) as Record<string,unknown>;
    const textoRaw: string =
      (msgContent.conversation         as string) ||
      (msgContent.Conversation         as string) ||
      (ec.text                         as string) ||
      (imgC.caption                    as string) ||
      (vidC.caption                    as string) ||
      (msgContent.audioMessage   || msgContent.AudioMessage   ? "[🎤 Áudio recebido]"  : "") ||
      (msgContent.stickerMessage || msgContent.StickerMessage ? "[Sticker]"             : "") ||
      (msgContent.locationMessage|| msgContent.LocationMessage? "[📍 Localização]"     : "") ||
      (docC.title || docC.Title ? `[📄 ${docC.title || docC.Title}]`                   : "") ||
      "[Mensagem recebida]";

    // Para grupos, prefixar com nome de quem enviou (exceto mensagens próprias)
    const texto: string = (isGroup && !fromMe && senderName && senderName !== senderPhone)
      ? `[${senderName}]: ${textoRaw}`
      : textoRaw;

    // Timestamp: Go usa Info.Timestamp (ISO string) | Baileys usa messageTimestamp (Unix)
    const rawTs = info.Timestamp || m.messageTimestamp || m.MessageTimestamp;
    const hora  = safeTimestamp(rawTs, now);

    console.log(`[webhook] ${isHistory?"HIST":"MSG"} from:${senderPhone} fromMe:${fromMe} ts:${hora} text:${texto.slice(0,60)}`);

    // ── Busca ou cria conversa ────────────────────────────────────────────────
    let isNew = false;
    let { data: conv } = await supabase
      .from("conversas")
      .select("id, nao_lidas, contato_nome, status, bot_ativo")
      .eq("empresa_id", empresa_id)
      .eq("contato_telefone", senderPhone)
      .maybeSingle();

    if (!conv) {
      isNew = true;
      const { data: nova } = await supabase.from("conversas").insert({
        empresa_id,
        contato_nome:     senderName,
        contato_telefone: senderPhone,
        ultima_mensagem:  texto,
        ultima_hora:      hora,
        nao_lidas:        fromMe ? 0 : 1,
        status:           "aberta",
        bot_ativo:        false,
        whatsapp_numero:  senderPhone,
      }).select("id, nao_lidas, contato_nome, status, bot_ativo").single();
      conv = nova;

      // Auto-cria lead se não existe
      const { data: leadExist } = await supabase.from("leads")
        .select("id").eq("empresa_id", empresa_id).eq("whatsapp", senderPhone).maybeSingle();
      if (!leadExist) {
        await supabase.from("leads").insert({
          empresa_id, nome: senderName, whatsapp: senderPhone,
          origem: "WhatsApp", status: "novo", score: 20, ultima_atividade: hora,
        });
      }
    } else if (!fromMe && !isHistory) {
      // Atualiza última mensagem apenas para recebidas em tempo real
      await supabase.from("conversas").update({
        ultima_mensagem: texto,
        ultima_hora:     hora,
        nao_lidas:       (conv.nao_lidas || 0) + 1,
        contato_nome:    senderName || conv.contato_nome,
      }).eq("id", conv.id);
    }

    if (!conv?.id) continue;

    // ── Dedup: evita inserir mensagem já existente ────────────────────────────
    const { data: existing } = await supabase.from("mensagens")
      .select("id")
      .eq("conversa_id", conv.id)
      .eq("hora", hora)
      .eq("texto", texto)
      .maybeSingle();
    if (existing) { console.log("[webhook] dedup: msg já existe, ignorando"); continue; }

    await supabase.from("mensagens").insert({
      conversa_id: conv.id,
      empresa_id,
      de:        fromMe ? "me" : "contato",
      texto,
      hora,
      status:    fromMe ? "enviado" : "recebido",
      remetente: fromMe ? "me" : "contato",
    });

    // ── Chatbot (apenas mensagens recebidas em tempo real) ────────────────────
    if (!fromMe && !isHistory && conv.status !== "em_atendimento") {
      try {
        const { data: cfg } = await supabase.from("chatbot_config").select("*").eq("empresa_id", empresa_id).maybeSingle();
        if (cfg?.ativo) {
          const { data: empData } = await supabase.from("empresas")
            .select("evolution_instance_id, evolution_instance_token, evolution_api_url")
            .eq("id", empresa_id).single();
          const instId    = empData?.evolution_instance_id;
          const instToken = empData?.evolution_instance_token;
          const evoUrl    = ((empData?.evolution_api_url || GLOBAL_URL) as string).replace(/\/$/, "");

          const sendBot = async (msgText: string) => {
            if (!instId || !instToken || !evoUrl) return;
            await fetch(`${evoUrl}/send/text`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": instToken },
              // instId pode ser instanceName (string) ou UUID — ambos suportados no body
              body: JSON.stringify({ instanceName: instId, id: instId, number: senderPhone, text: msgText }),
            });
            if (conv?.id) {
              await supabase.from("mensagens").insert({
                conversa_id: conv.id, empresa_id, de: "me", texto: msgText,
                hora: new Date().toISOString(), status: "enviado", remetente: "bot",
              });
              await supabase.from("conversas").update({
                ultima_mensagem: msgText, ultima_hora: new Date().toISOString()
              }).eq("id", conv!.id);
            }
          };

          const transferWord = (cfg.transferir_palavra || "atendente").toLowerCase().trim();
          if (texto.toLowerCase().includes(transferWord)) {
            await supabase.from("conversas").update({ bot_ativo: false, status: "aguardando" }).eq("id", conv!.id);
            await sendBot("Aguarde, vou transferir para um atendente. 👋");
            continue;
          }

          const agora = new Date();
          const dia   = agora.getDay();
          const hAtu  = agora.getHours() * 60 + agora.getMinutes();
          const [hI, mI] = (cfg.horario_inicio || "08:00").split(":").map(Number);
          const [hF, mF] = (cfg.horario_fim   || "18:00").split(":").map(Number);
          const diasOk = (cfg.dias_semana || [1,2,3,4,5]).includes(dia);
          const dentroHorario = diasOk && hAtu >= (hI*60+mI) && hAtu < (hF*60+mF);

          if (!dentroHorario) {
            if (isNew && cfg.mensagem_fora_horario) await sendBot(cfg.mensagem_fora_horario);
            continue;
          }
          if (isNew && cfg.mensagem_boas_vindas) await sendBot(cfg.mensagem_boas_vindas);

          const { data: regras } = await supabase.from("chatbot_regras")
            .select("*").eq("empresa_id", empresa_id).eq("ativo", true).order("ordem");
          if (regras?.length) {
            const tl = texto.toLowerCase();
            for (const r of regras) {
              if (tl.includes(r.gatilho.toLowerCase())) { await sendBot(r.resposta); break; }
            }
          }
        }
      } catch (botErr) {
        console.error("[webhook] chatbot error:", botErr);
      }
    }
  }
}
