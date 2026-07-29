import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Extrai texto e tipo da estrutura de mensagem do Baileys/Evolution API ────
function extractMsg(msg: Record<string, unknown>): { texto: string; tipo: string; nomeArquivo: string | null } {
  const c = (msg.message || msg.Message || {}) as Record<string, unknown>;
  if (c.conversation)          return { texto: c.conversation as string, tipo: "texto", nomeArquivo: null };
  if (c.extendedTextMessage) {
    const e = c.extendedTextMessage as Record<string, unknown>;
    return { texto: (e.text as string) || "", tipo: "texto", nomeArquivo: null };
  }
  if (c.imageMessage) {
    const im = c.imageMessage as Record<string, unknown>;
    return { texto: (im.caption as string) || "[Imagem]", tipo: "imagem", nomeArquivo: null };
  }
  if (c.videoMessage) {
    const v = c.videoMessage as Record<string, unknown>;
    return { texto: (v.caption as string) || "[Vídeo]", tipo: "video", nomeArquivo: null };
  }
  if (c.audioMessage || c.pttMessage) return { texto: "[🎤 Áudio]", tipo: "audio", nomeArquivo: null };
  if (c.documentMessage) {
    const d = c.documentMessage as Record<string, unknown>;
    const nome = ((d.title || d.fileName) as string) || null;
    return { texto: nome ? `[📄 ${nome}]` : "[Documento]", tipo: "documento", nomeArquivo: nome };
  }
  if (c.stickerMessage)  return { texto: "[Sticker]", tipo: "sticker", nomeArquivo: null };
  if (c.locationMessage) return { texto: "[📍 Localização]", tipo: "texto", nomeArquivo: null };
  if (c.contactMessage)  return { texto: "[Contato]", tipo: "texto", nomeArquivo: null };
  if (c.reactionMessage) return { texto: "", tipo: "texto", nomeArquivo: null };  // skip
  return { texto: "", tipo: "texto", nomeArquivo: null };
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, info: "sync-whatsapp-history: POST to start sync" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const GLOBAL_URL = (Deno.env.get("EVOLUTION_GLOBAL_URL") ?? "").replace(/\/$/, "");
  const GLOBAL_KEY = Deno.env.get("EVOLUTION_GLOBAL_KEY") ?? "";

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const filterEmpresaId = body.empresa_id as string | undefined;
  const months          = Number(body.months    ?? 3);
  const maxChats        = Number(body.max_chats ?? 40);  // chats por instância por execução
  const cutoffTs        = Math.floor(Date.now() / 1000) - months * 30 * 24 * 60 * 60;

  const stats = {
    instancias: 0,
    conversas_criadas: 0,
    mensagens_importadas: 0,
    erros: [] as string[],
  };

  // ── Monta lista de instâncias a sincronizar ───────────────────────────────
  type Instancia = {
    empresa_id: string;
    evo_instance: string;
    token: string;
    instancia_id: string | null;
  };
  const instancias: Instancia[] = [];

  // Instâncias principais (tabela empresas)
  {
    let q = supabase.from("empresas")
      .select("id, evolution_instance_id, evolution_instance_token")
      .not("evolution_instance_id", "is", null)
      .not("evolution_instance_token", "is", null);
    if (filterEmpresaId) q = q.eq("id", filterEmpresaId);
    const { data } = await q;
    for (const e of data ?? []) {
      if (e.evolution_instance_id && e.evolution_instance_token)
        instancias.push({ empresa_id: e.id, evo_instance: e.evolution_instance_id, token: e.evolution_instance_token, instancia_id: null });
    }
  }

  // Instâncias secundárias (tabela empresa_instancias)
  {
    let q = supabase.from("empresa_instancias")
      .select("id, empresa_id, evolution_instance_id, evolution_instance_token")
      .eq("ativo", true)
      .not("evolution_instance_id", "is", null)
      .not("evolution_instance_token", "is", null);
    if (filterEmpresaId) q = q.eq("empresa_id", filterEmpresaId);
    const { data } = await q;
    for (const i of data ?? []) {
      if (i.evolution_instance_id && i.evolution_instance_token)
        instancias.push({ empresa_id: i.empresa_id, evo_instance: i.evolution_instance_id, token: i.evolution_instance_token, instancia_id: i.id });
    }
  }

  // ── Processa cada instância ───────────────────────────────────────────────
  for (const inst of instancias) {
    stats.instancias++;
    const hdrs = { "apikey": inst.token, "Content-Type": "application/json" };

    try {
      // 1. Busca lista de chats da instância
      const chatsRes = await fetch(`${GLOBAL_URL}/chat/findChats/${inst.evo_instance}`, { headers: hdrs });
      if (!chatsRes.ok) {
        stats.erros.push(`findChats[${inst.evo_instance}]: HTTP ${chatsRes.status}`);
        continue;
      }
      const chatsRaw = await chatsRes.json();
      const chats: Record<string, unknown>[] = Array.isArray(chatsRaw)
        ? chatsRaw
        : (chatsRaw.chats ?? chatsRaw.data ?? []);

      let chatsCount = 0;

      for (const chat of chats) {
        if (chatsCount >= maxChats) break;

        // remoteJid primeiro: o campo id da Evolution v2 é um CUID do banco.
        const jid = (chat.remoteJid || chat.id || "") as string;
        if (!jid || jid.endsWith("@broadcast") || jid.endsWith("@newsletter") || jid.includes("@lid")) continue;

        const isGroup  = jid.endsWith("@g.us");
        const phone    = isGroup
          ? jid
          : jid.replace(/@s\.whatsapp\.net$/, "").replace(/@c\.us$/, "").replace(/:.*$/, "");
        const nomeCont = (chat.name || chat.pushName || chat.subject || phone) as string;

        // 2. Garante que a conversa existe
        let { data: conv } = await supabase.from("conversas")
          .select("id, ultima_hora")
          .eq("empresa_id", inst.empresa_id)
          .eq("contato_telefone", phone)
          .maybeSingle();

        if (!conv) {
          const { data: nova } = await supabase.from("conversas").insert({
            empresa_id:       inst.empresa_id,
            contato_nome:     nomeCont,
            contato_telefone: phone,
            ultima_mensagem:  "",
            ultima_hora:      new Date().toISOString(),
            nao_lidas:        0,
            status:           "aberta",
            bot_ativo:        false,
            canal:            "whatsapp",
            instancia_id:     inst.instancia_id,
          }).select("id, ultima_hora").single();
          conv = nova;
          if (nova) stats.conversas_criadas++;
        }

        if (!conv?.id) continue;

        // 3. Busca mensagens paginadas
        let page = 1;
        let latestTs: string | null = null;
        let latestTexto = "";

        while (true) {
          const msgsRes = await fetch(`${GLOBAL_URL}/chat/findMessages/${inst.evo_instance}`, {
            method: "POST",
            headers: hdrs,
            body: JSON.stringify({ where: { key: { remoteJid: jid } }, page, offset: 50 }),
          });
          if (!msgsRes.ok) break;

          const msgsRaw = await msgsRes.json() as Record<string, unknown>;

          // Suporta múltiplos formatos de resposta do Evolution API
          const records: Record<string, unknown>[] = Array.isArray(msgsRaw)
            ? msgsRaw
            : Array.isArray(msgsRaw.messages)
              ? msgsRaw.messages as Record<string, unknown>[]
              : Array.isArray((msgsRaw.messages as Record<string, unknown>)?.records)
                ? (msgsRaw.messages as Record<string, unknown>).records as Record<string, unknown>[]
                : [];

          if (records.length === 0) break;

          const toInsert: Record<string, unknown>[] = [];
          let reachedCutoff = false;

          for (const msg of records) {
            const ts = Number(msg.messageTimestamp || msg.MessageTimestamp || 0);
            // Mensagens fora da janela de tempo → para de paginar
            if (ts > 0 && ts < cutoffTs) { reachedCutoff = true; break; }

            const key     = (msg.key || msg.Key || {}) as Record<string, unknown>;
            const wamid   = (key.id || "") as string;
            if (!wamid) continue;  // sem ID não conseguimos deduplicar

            const fromMe  = Boolean(key.fromMe ?? false);
            const { texto, tipo, nomeArquivo } = extractMsg(msg);
            if (!texto && tipo === "texto") continue;  // pula reações e vazios

            const hora = ts > 0 ? new Date(ts * 1000).toISOString() : new Date().toISOString();

            if (!latestTs || hora > latestTs) { latestTs = hora; latestTexto = texto; }

            toInsert.push({
              conversa_id:  conv.id,
              empresa_id:   inst.empresa_id,
              de:           fromMe ? "me" : "contato",
              texto,
              tipo,
              media_url:    null,  // não re-baixa mídia no sync histórico
              nome_arquivo: nomeArquivo,
              wamid,
              hora,
              status:       fromMe ? "enviado" : "recebido",
              remetente:    "usuario",
              instancia_id: inst.instancia_id,
            });
          }

          if (toInsert.length > 0) {
            const { count } = await supabase.from("mensagens")
              .upsert(toInsert, { onConflict: "wamid", ignoreDuplicates: true, count: "exact" });
            stats.mensagens_importadas += count ?? toInsert.length;
          }

          if (reachedCutoff) break;

          // Verifica se há mais páginas
          const msgs = msgsRaw.messages as Record<string, unknown> | undefined;
          const totalPages = Number(msgs?.pages ?? msgsRaw.pages ?? 1);
          if (page >= totalPages) break;
          page++;
        }

        // 4. Atualiza conversa com a mensagem mais recente
        if (latestTs) {
          const convTs = conv.ultima_hora ? new Date(conv.ultima_hora as string).getTime() : 0;
          if (new Date(latestTs).getTime() > convTs) {
            await supabase.from("conversas").update({
              ultima_mensagem: latestTexto,
              ultima_hora:     latestTs,
            }).eq("id", conv.id);
          }
        }

        chatsCount++;
      }
    } catch (err) {
      stats.erros.push(`${inst.evo_instance}: ${(err as Error).message}`);
    }
  }

  return new Response(JSON.stringify({ ok: true, stats }), {
    headers: { "Content-Type": "application/json" },
  });
});
