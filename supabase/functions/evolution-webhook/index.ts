import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "GET") return new Response("OK", { status: 200 });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const GLOBAL_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");

  try {
    const reqUrl       = new URL(req.url);
    const tokenFromUrl = reqUrl.searchParams.get("token") || "";
    const body         = await req.json();

    // Suporta tanto 'event' quanto 'eventString' (Evolution GO Go version)
    const event = body.event || body.eventString || body.Event || "";
    const data  = body.data  || body.Data  || body;

    // LOG COMPLETO para debug
    console.log("[webhook] event:", event, "| token:", tokenFromUrl.slice(0, 8), "| keys:", Object.keys(body).join(","));
    if (event === "MESSAGE" || event === "HISTORY_SYNC" || event === "MESSAGES_UPSERT") {
      const sample = JSON.stringify(data).slice(0, 400);
      console.log("[webhook] data sample:", sample);
    }

    const instanceToken = tokenFromUrl || body.apikey || body.instanceToken || body.instance?.apikey || body.instance?.token || "";
    const instanceId    = body.instance?.id || body.instanceId || "";

    let empresa_id: string | null = null;
    if (instanceToken) {
      const { data: emp } = await supabase.from("empresas").select("id").eq("evolution_instance_token", instanceToken).maybeSingle();
      if (emp) empresa_id = emp.id;
    }
    if (!empresa_id && instanceId) {
      const { data: emp } = await supabase.from("empresas").select("id").eq("evolution_instance_id", instanceId).maybeSingle();
      if (emp) empresa_id = emp.id;
    }
    if (!empresa_id) {
      console.error("[webhook] empresa nao encontrada | token:", instanceToken.slice(0, 8));
      return new Response("Instance not found", { status: 404 });
    }

    const now = new Date().toISOString();

    // ── QR CODE
    if (event === "QRCODE" || event === "QRCODE_UPDATED") {
      const qr = data?.qrcode?.base64 || data?.base64 || data?.Qrcode || (typeof data?.qrcode === "string" ? data.qrcode : "");
      if (qr) await supabase.from("empresas").update({ evolution_qr_temp: qr }).eq("id", empresa_id);
      return new Response("OK");
    }

    // ── CONEXAO
    if (["CONNECTION","CONNECTION_UPDATE","Connected","Disconnected","connection.update"].includes(event)) {
      const state = data?.state || (event === "Connected" ? "open" : event === "Disconnected" ? "close" : "");
      if (state === "open" || event === "Connected") {
        const jid   = data?.jid || "";
        const phone = jid.replace(/@s\.whatsapp\.net$/, "").replace(/:.*$/, "");
        await supabase.from("empresas").update({ evolution_connected: true, evolution_phone: phone || "", evolution_qr_temp: null }).eq("id", empresa_id);
      } else if (state === "close" || event === "Disconnected") {
        await supabase.from("empresas").update({ evolution_connected: false }).eq("id", empresa_id);
      }
      return new Response("OK");
    }

    // ── HISTORY SYNC (mensagens históricas na reconexão)
    if (event === "HISTORY_SYNC" || event === "messaging-history.set") {
      console.log("[webhook] HISTORY_SYNC recebido");
      // Estrutura pode ser: data.messages[] ou data.conversations[].messages[]
      const allMsgs: unknown[] = [];
      if (Array.isArray(data?.messages)) allMsgs.push(...data.messages);
      if (Array.isArray(data?.conversations)) {
        for (const conv of data.conversations) {
          if (Array.isArray(conv?.messages)) allMsgs.push(...conv.messages);
        }
      }
      // Processa como mensagens individuais
      if (allMsgs.length > 0) {
        console.log("[webhook] HISTORY_SYNC processando", allMsgs.length, "mensagens");
        await processMessages(allMsgs, empresa_id, supabase, GLOBAL_URL, now, true);
      } else {
        console.log("[webhook] HISTORY_SYNC sem mensagens no payload");
      }
      return new Response("OK");
    }

    // ── MENSAGEM RECEBIDA
    if (["MESSAGE","MESSAGES_UPSERT","Message","messages.upsert"].includes(event)) {
      const msgs = Array.isArray(data) ? data : [data];
      await processMessages(msgs, empresa_id, supabase, GLOBAL_URL, now, false);
      return new Response("OK");
    }

    // ── MENSAGEM ENVIADA (SEND_MESSAGE - evitar duplicata)
    if (event === "SEND_MESSAGE") {
      const remoteJid = data?.key?.remoteJid || "";
      if (!remoteJid || remoteJid.endsWith("@g.us")) return new Response("OK");
      const senderPhone = remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/:.*$/, "");
      const msgContent  = data?.message || {};
      const texto = msgContent.conversation || msgContent.extendedTextMessage?.text || "";
      if (!texto) return new Response("OK");
      const rawTs = data?.messageTimestamp;
      const hora  = rawTs ? new Date(typeof rawTs === "number" && rawTs < 1e12 ? rawTs * 1000 : Number(rawTs)).toISOString() : now;
      const { data: conv } = await supabase.from("conversas").select("id").eq("empresa_id", empresa_id).eq("contato_telefone", senderPhone).maybeSingle();
      if (conv?.id) {
        // Dedup: ignora se já existe mensagem similar nos últimos 15s
        const { data: existing } = await supabase.from("mensagens").select("id").eq("conversa_id", conv.id).eq("de", "me").eq("texto", texto).gte("hora", new Date(Date.now() - 15000).toISOString()).maybeSingle();
        if (!existing) {
          await supabase.from("mensagens").insert({ conversa_id: conv.id, empresa_id, de: "me", texto, hora, status: "enviado", remetente: "me" });
          await supabase.from("conversas").update({ ultima_mensagem: texto, ultima_hora: hora }).eq("id", conv.id);
        }
      }
      return new Response("OK");
    }

    console.log("[webhook] evento nao tratado:", event);
    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("evolution-webhook error:", e);
    return new Response("Error", { status: 500 });
  }
});

// ── Processa array de mensagens (reutilizável para MESSAGE e HISTORY_SYNC)
async function processMessages(
  msgs: unknown[], empresa_id: string, supabase: ReturnType<typeof createClient>,
  GLOBAL_URL: string, now: string, isHistory: boolean
) {
  for (const msg of msgs) {
    if (!msg || typeof msg !== "object") continue;
    const m = msg as Record<string, unknown>;

    const key = (m.key || m.Key || {}) as Record<string, unknown>;
    const fromMe = key.fromMe ?? (m.Info as Record<string,unknown>)?.IsFromMe ?? false;

    // Para histórico: importa ambos (enviados e recebidos). Para tempo real: só recebidos.
    if (!isHistory && fromMe) continue;

    const remoteJid = (key.remoteJid || (m.Info as Record<string,unknown>)?.Sender || "") as string;
    if (!remoteJid || remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast")) continue;

    const senderPhone = remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/:.*$/, "");
    const senderName  = ((m.pushName || m.PushName || (m.Info as Record<string,unknown>)?.PushName || senderPhone) as string);
    const msgContent  = (m.message || m.Message || {}) as Record<string, unknown>;
    const texto =
      (msgContent.conversation as string) ||
      ((msgContent.extendedTextMessage as Record<string,unknown>)?.text as string) ||
      ((msgContent.imageMessage as Record<string,unknown>)?.caption as string) ||
      ((msgContent.videoMessage as Record<string,unknown>)?.caption as string) ||
      (msgContent.audioMessage   ? "[Áudio recebido 🎤]" : null) ||
      (msgContent.stickerMessage ? "[Sticker recebido]" : null) ||
      (msgContent.locationMessage? "[📍 Localização]" : null) ||
      (msgContent.documentMessage? `[Documento: ${((msgContent.documentMessage as Record<string,unknown>)?.title || "arquivo")}]` : null) ||
      "[Mensagem recebida]";

    const rawTs = m.messageTimestamp || m.MessageTimestamp || (m.Info as Record<string,unknown>)?.Timestamp;
    const hora  = rawTs ? new Date(typeof rawTs === "number" && rawTs < 1e12 ? rawTs * 1000 : Number(rawTs)).toISOString() : now;

    console.log(`[webhook] ${isHistory?"HIST":"MSG"} phone:${senderPhone} fromMe:${fromMe} text:${texto.slice(0,40)}`);

    // Busca ou cria conversa
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
        .select("id")
        .eq("empresa_id", empresa_id)
        .eq("whatsapp", senderPhone)
        .maybeSingle();
      if (!leadExist) {
        await supabase.from("leads").insert({
          empresa_id, nome: senderName, whatsapp: senderPhone,
          origem: "WhatsApp", status: "novo", score: 20, ultima_atividade: hora,
        });
      }
    } else if (!fromMe) {
      // Só atualiza ultima_mensagem para recebidas (não sobrescreve com histórico)
      if (!isHistory) {
        await supabase.from("conversas").update({
          ultima_mensagem: texto,
          ultima_hora:     hora,
          nao_lidas:       (conv.nao_lidas || 0) + 1,
          contato_nome:    senderName || conv.contato_nome,
        }).eq("id", conv.id);
      }
    }

    if (!conv?.id) continue;

    // Dedup por hora + texto (evita duplicar mensagens)
    const { data: existing } = await supabase.from("mensagens")
      .select("id")
      .eq("conversa_id", conv.id)
      .eq("hora", hora)
      .eq("texto", texto)
      .maybeSingle();
    if (existing) continue;

    await supabase.from("mensagens").insert({
      conversa_id: conv.id,
      empresa_id,
      de:        fromMe ? "me" : "contato",
      texto,
      hora,
      status:    fromMe ? "enviado" : "recebido",
      remetente: fromMe ? "me" : "contato",
    });

    // Chatbot só para mensagens recebidas em tempo real
    if (!fromMe && !isHistory && conv.bot_ativo !== false && conv.status !== "em_atendimento") {
      try {
        const { data: cfg } = await supabase.from("chatbot_config").select("*").eq("empresa_id", empresa_id).maybeSingle();
        if (cfg?.ativo) {
          const empresa = await supabase.from("empresas").select("evolution_instance_id, evolution_instance_token, evolution_api_url").eq("id", empresa_id).single();
          const instId    = empresa.data?.evolution_instance_id;
          const instToken = empresa.data?.evolution_instance_token;
          const evoUrl    = ((empresa.data?.evolution_api_url || GLOBAL_URL) as string).replace(/\/$/, "");

          const sendBot = async (msgText: string) => {
            if (!instId || !instToken || !evoUrl) return;
            await fetch(`${evoUrl}/send/text`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": instToken },
              body: JSON.stringify({ id: instId, number: senderPhone, text: msgText }),
            });
            if (conv?.id) {
              await supabase.from("mensagens").insert({
                conversa_id: conv.id, empresa_id, de: "me", texto: msgText,
                hora: new Date().toISOString(), status: "enviado", remetente: "bot",
              });
              await supabase.from("conversas").update({ ultima_mensagem: msgText, ultima_hora: new Date().toISOString() }).eq("id", conv!.id);
            }
          };

          const transferWord = (cfg.transferir_palavra || "atendente").toLowerCase().trim();
          if (texto.toLowerCase().includes(transferWord)) {
            await supabase.from("conversas").update({ bot_ativo: false, status: "aguardando" }).eq("id", conv!.id);
            await sendBot("Aguarde, vou transferir para um atendente. 👋");
            continue;
          }

          const agora   = new Date();
          const dia     = agora.getDay();
          const hAtual  = agora.getHours() * 60 + agora.getMinutes();
          const [hIni, mIni] = (cfg.horario_inicio || "08:00").split(":").map(Number);
          const [hFim, mFim] = (cfg.horario_fim   || "18:00").split(":").map(Number);
          const hInicio = hIni * 60 + mIni;
          const hFimMin = hFim * 60 + mFim;
          const diasOk  = (cfg.dias_semana || [1,2,3,4,5]).includes(dia);
          const dentroHorario = diasOk && hAtual >= hInicio && hAtual < hFimMin;

          if (!dentroHorario) {
            if (isNew && cfg.mensagem_fora_horario) await sendBot(cfg.mensagem_fora_horario);
            continue;
          }
          if (isNew && cfg.mensagem_boas_vindas) await sendBot(cfg.mensagem_boas_vindas);

          const { data: regras } = await supabase.from("chatbot_regras").select("*").eq("empresa_id", empresa_id).eq("ativo", true).order("ordem");
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
