import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: grava log em logs_whatsapp sem nunca lançar exceção
// ─────────────────────────────────────────────────────────────────────────────
async function logWA(
  db: ReturnType<typeof createClient>,
  opts: {
    empresa_id?:  string | null;
    conversa_id?: string | null;
    tipo:   string;   // webhook_recebido | mensagem_bot | mensagem_agendada | erro_api | conexao | fluxo | conversa_criada
    nivel?: string;   // info | warn | error
    origem?: string;
    evento?: string;
    telefone?: string;
    resumo?: string;
    payload?: unknown;
  },
) {
  try {
    await db.from("logs_whatsapp").insert({
      empresa_id:  opts.empresa_id  ?? null,
      conversa_id: opts.conversa_id ?? null,
      tipo:        opts.tipo,
      nivel:       opts.nivel   ?? "info",
      origem:      opts.origem  ?? null,
      evento:      opts.evento  ?? null,
      telefone:    opts.telefone ?? null,
      resumo:      opts.resumo  ?? null,
      payload:     opts.payload  ?? null,
    });
  } catch (_) { /* nunca propaga */ }
}

Deno.serve(async (req) => {
  if (req.method === "GET") return new Response("OK", { status: 200 });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const GLOBAL_URL = "https://evolution-evolution-api.ng5obv.easypanel.host";

  try {
    const reqUrl       = new URL(req.url);
    const rawToken     = reqUrl.searchParams.get("token") || "";
    const tokenFromUrl = rawToken.split("/")[0].trim();
    const body         = await req.json();

    const event = body.event || body.eventString || body.Event || "";
    const data  = body.data  || body.Data  || body;

    // Saída rápida para eventos de alta frequência que não precisam consultar o banco
    const SKIP_EVENTS = [
      "chats.update", "CHATS_UPDATE", "CHATS_UPSERT", "CHATS_SET", "CHATS_DELETE",
      "contacts.update", "CONTACTS_UPDATE", "CONTACTS_SET",
      "message.ack", "READ_RECEIPT",
      "labels.edit", "LABELS_EDIT", "labels.association", "LABELS_ASSOCIATION",
    ];
    if (SKIP_EVENTS.includes(event)) return new Response("OK");

    // Presença / "digitando..." — 1 query leve para empresa_id, depois Realtime broadcast
    if (["presence.update", "PRESENCE", "CHAT_PRESENCE"].includes(event)) {
      try {
        const token = body.apikey || body.instance?.apikey || body.instance?.token || tokenFromUrl || "";
        if (token) {
          const { data: emp } = await supabase.from("empresas").select("id").eq("evolution_instance_token", token).maybeSingle();
          if (emp?.id) {
            const presences = Array.isArray(data) ? data : [data];
            for (const p of presences) {
              const phone = (p?.id || p?.remoteJid || "").split("@")[0];
              const presence = p?.presence || p?.lastKnownPresence || "";
              if (!phone || !["composing", "recording"].includes(presence)) continue;
              supabase.channel(`typing:${emp.id}`)
                .send({ type: "broadcast", event: "typing", payload: { phone } })
                .catch(() => {});
            }
          }
        }
      } catch (_) {}
      return new Response("OK");
    }

    console.log("[webhook] event:", event, "| keys:", Object.keys(body).join(","));

    const instanceToken = tokenFromUrl || body.apikey || body.instance?.apikey || body.instance?.token || "";
    const instanceName  = body.instance?.instanceName || body.instance?.name || body.instanceName || "";
    const instanceId    = body.instance?.id || body.instanceId || "";

    let empresa_id: string | null = null;
    if (instanceToken) {
      const { data: emp } = await supabase.from("empresas").select("id").eq("evolution_instance_token", instanceToken).maybeSingle();
      if (emp) empresa_id = emp.id;
    }
    if (!empresa_id && instanceName) {
      const { data: emp } = await supabase.from("empresas").select("id").eq("evolution_instance_id", instanceName).maybeSingle();
      if (emp) empresa_id = emp.id;
    }
    if (!empresa_id && instanceId) {
      const { data: emp } = await supabase.from("empresas").select("id").eq("evolution_instance_id", instanceId).maybeSingle();
      if (emp) empresa_id = emp.id;
    }
    if (!empresa_id) {
      // Retorna 200 para não disparar retry loop na Evolution API
      return new Response("OK", { status: 200 });
    }

    const now = new Date().toISOString();

    // CONTACTS_UPSERT — mapeia LID → telefone real para corrigir conversas @lid
    // (movido para após resolução de empresa_id para evitar ReferenceError)
    if (["contacts.upsert", "CONTACTS_UPSERT"].includes(event)) {
      const contacts = Array.isArray(data) ? data : (data?.contacts ? data.contacts : [data]);
      for (const contact of contacts) {
        try {
          const lidJid   = (contact?.id || contact?.jid || "") as string;
          const phoneJid = (contact?.remoteJid || contact?.phone || contact?.number || "") as string;
          if (!lidJid.includes("@lid")) continue;
          const phoneNum = phoneJid.replace(/@s\.whatsapp\.net$/, "").replace(/:.*$/, "");
          if (!phoneNum || phoneNum.length < 8 || phoneNum.includes("@")) continue;

          const { data: existPhone } = await supabase.from("conversas")
            .select("id").eq("empresa_id", empresa_id).eq("contato_telefone", phoneNum).maybeSingle();

          if (!existPhone) {
            await supabase.from("conversas")
              .update({ contato_telefone: phoneNum })
              .eq("empresa_id", empresa_id)
              .eq("contato_telefone", lidJid);
          } else {
            const { data: lidConv } = await supabase.from("conversas")
              .select("id").eq("empresa_id", empresa_id).eq("contato_telefone", lidJid).maybeSingle();
            if (lidConv?.id && lidConv.id !== existPhone.id) {
              await supabase.from("mensagens").update({ conversa_id: existPhone.id }).eq("conversa_id", lidConv.id);
              await supabase.from("conversas").delete().eq("id", lidConv.id);
            }
          }
        } catch (_) { /* nunca propaga */ }
      }
      return new Response("OK");
    }

    // ── QR CODE ─────────────────────────────────────────────────────────────
    if (["QRCODE","QRCODE_UPDATED","qrcode.updated"].includes(event)) {
      const qr = data?.qrcode?.base64 || data?.base64 || data?.Qrcode || (typeof data?.qrcode === "string" ? data.qrcode : "");
      if (qr) await supabase.from("empresas").update({ evolution_qr_temp: qr }).eq("id", empresa_id);
      return new Response("OK");
    }

    // ── CONEXÃO ─────────────────────────────────────────────────────────────
    if (["CONNECTION","CONNECTION_UPDATE","Connected","Disconnected","connection.update"].includes(event)) {
      const state = data?.state || data?.instance?.state ||
        (event === "Connected" ? "open" : event === "Disconnected" ? "close" : "");
      if (state === "open" || event === "Connected") {
        const jid   = data?.jid || data?.instance?.jid || "";
        const phone = jid.replace(/@s\.whatsapp\.net$/, "").replace(/:.*$/, "");
        await supabase.from("empresas").update({ evolution_connected: true, evolution_phone: phone || "", evolution_qr_temp: null }).eq("id", empresa_id);
        await logWA(supabase, {
          empresa_id, tipo: "conexao", nivel: "info", origem: "evolution-webhook", evento: event,
          resumo: `WhatsApp conectado${phone ? ` — ${phone}` : ""}`,
          payload: { state, phone },
        });
      } else if (state === "close" || state === "connecting" || event === "Disconnected") {
        await supabase.from("empresas").update({ evolution_connected: false }).eq("id", empresa_id);
        await logWA(supabase, {
          empresa_id, tipo: "conexao", nivel: "warn", origem: "evolution-webhook", evento: event,
          resumo: `WhatsApp desconectado (${state || event})`,
          payload: { state },
        });
      }
      return new Response("OK");
    }

    // ── GRUPOS ───────────────────────────────────────────────────────────────
    if (["GROUPS_UPSERT","GROUP_UPDATE","groups.upsert","groups.update"].includes(event)) {
      const groups = Array.isArray(data) ? data : (data?.groups ? data.groups : [data]);
      for (const g of groups) {
        if (!g?.id || !g?.subject) continue;
        const gJid = g.id.includes("@g.us") ? g.id : `${g.id}@g.us`;
        const { data: existing } = await supabase.from("conversas").select("id")
          .eq("empresa_id", empresa_id).eq("contato_telefone", gJid).maybeSingle();
        if (existing) {
          await supabase.from("conversas").update({ contato_nome: g.subject }).eq("id", existing.id);
        } else {
          await supabase.from("conversas").insert({ empresa_id, contato_nome: g.subject,
            contato_telefone: gJid, ultima_mensagem: "", ultima_hora: now, nao_lidas: 0, status: "aberta", bot_ativo: false });
        }
      }
      return new Response("OK");
    }

    // ── HISTORY SYNC ─────────────────────────────────────────────────────────
    if (["HISTORY_SYNC","messaging-history.set"].includes(event)) {
      const allMsgs: unknown[] = [];
      if (Array.isArray(data?.messages)) allMsgs.push(...data.messages);
      if (Array.isArray(data?.conversations)) {
        for (const conv of data.conversations) {
          if (Array.isArray(conv?.messages)) allMsgs.push(...conv.messages);
        }
      }
      if (allMsgs.length > 0) await processMessages(allMsgs, empresa_id, supabase, GLOBAL_URL, now, true);
      return new Response("OK");
    }

    // ── MENSAGEM ─────────────────────────────────────────────────────────────
    if (["MESSAGE","MESSAGES_UPSERT","Message","messages.upsert"].includes(event)) {
      await logWA(supabase, {
        empresa_id, tipo: "webhook_recebido", nivel: "info", origem: "evolution-webhook", evento: event,
        resumo: `Webhook de mensagem recebido (${event})`,
      });
      const msgs = Array.isArray(data) ? data : [data];
      await processMessages(msgs, empresa_id, supabase, GLOBAL_URL, now, false);

      // ── CSAT: verifica se alguma mensagem recebida é resposta de satisfação ──
      for (const msg of msgs) {
        try {
          const fromMe = msg?.key?.fromMe || msg?.fromMe;
          if (fromMe) continue;
          const text = (msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
          const nota = parseInt(text, 10);
          if (nota < 1 || nota > 5) continue;
          const phone = (msg?.key?.remoteJid || "").split("@")[0];
          if (!phone) continue;
          const { data: conv } = await supabase.from("conversas")
            .select("id, csat_enviado, status")
            .eq("empresa_id", empresa_id)
            .eq("contato_telefone", `${phone}@s.whatsapp.net`)
            .eq("status", "resolvida")
            .eq("csat_enviado", true)
            .is("csat_nota", null)
            .maybeSingle();
          if (conv?.id) {
            await supabase.from("conversas").update({
              csat_nota: nota,
              csat_respondido_em: now,
            }).eq("id", conv.id);
          }
        } catch (_) {}
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

// ─────────────────────────────────────────────────────────────────────────────
function safeTimestamp(rawTs: unknown, fallback: string): string {
  if (!rawTs) return fallback;
  if (typeof rawTs === "number") {
    const ms = rawTs < 1e12 ? rawTs * 1000 : rawTs;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? fallback : d.toISOString();
  }
  if (typeof rawTs === "string") {
    if (/^\d+$/.test(rawTs)) return safeTimestamp(parseInt(rawTs, 10), fallback);
    const d = new Date(rawTs);
    return isNaN(d.getTime()) ? fallback : d.toISOString();
  }
  return fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de nó do fluxo visual
// ─────────────────────────────────────────────────────────────────────────────
interface FluxoNo {
  id: string;
  tipo: "inicio" | "mensagem" | "opcoes" | "condicao" | "transferir" | "encerrar" | "aguardar"
      | "imagem" | "video" | "audio" | "documento" | "respostas" | "lista" | "controle_fluxo";
  nome?: string;
  mensagem?: string;
  opcoes?: string[];
  gatilho_tipo?: "mensagem_recebida" | "palavra_chave" | "primeira_mensagem_dia" | "primeira_mensagem";
  gatilho_palavras?: string;
  condicao_tipo?: "contem_palavra" | "igual" | "numero_opcao" | "primeira_mensagem" | "primeira_mensagem_dia";
  gatilhos?: string;
  numero_opcao?: string;
  variavel?: string;
  media_url?: string;
  botao_1?: string; botao_2?: string; botao_3?: string;
  lista_titulo_botao?: string; lista_itens?: string;
  controle_tipo?: "reiniciar" | "encerrar";
  transferir_tipo?: "setor" | "usuario" | "fila";
  transferir_setor_id?: string;
  transferir_usuario_id?: string;
  setor_padrao_id?: string;
  intervalo_reativacao?: number;
  x?: number; y?: number;
}

interface FluxoConexao {
  id: string;
  de: string;
  para: string;
  label?: string;
}

interface FluxoEstado {
  fluxo_id: string;
  no_atual_id: string;
  variaveis: Record<string, string>;
  aguardando_opcao?: boolean;
  aguardando_variavel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Executa o fluxo visual para uma mensagem recebida
// ─────────────────────────────────────────────────────────────────────────────
async function executarFluxo(
  cfg: Record<string, unknown>,
  texto: string,
  senderPhone: string,
  senderName: string,
  conv: Record<string, unknown>,
  empresa_id: string,
  isNew: boolean,
  supabase: ReturnType<typeof createClient>,
  sendBot: (msg: string, tipo?: string, extra?: Record<string, unknown>) => Promise<void>,
): Promise<boolean> {
  const fluxoId = cfg.fluxo_ativo_id as string | null;
  if (!fluxoId) return false;

  const { data: fluxoData } = await supabase.from("chatbot_fluxos")
    .select("nos, conexoes, ativo").eq("id", fluxoId).single();
  if (!fluxoData?.ativo) return false;

  const nos: FluxoNo[]          = fluxoData.nos     || [];
  const conexoes: FluxoConexao[] = fluxoData.conexoes || [];
  const noInicioRaw = nos.find(n => n.tipo === "inicio");
  if (!noInicioRaw) return false;

  let estado: FluxoEstado | null = (conv.fluxo_estado as FluxoEstado) || null;
  const convId = conv.id as string;

  // Clear orphaned flow state when the active flow changed
  if (estado && estado.fluxo_id !== fluxoId) {
    await supabase.from("conversas").update({ fluxo_estado: null }).eq("id", convId);
    estado = null;
  }

  if (estado && estado.fluxo_id === fluxoId) {
    const noAtual = nos.find(n => n.id === estado!.no_atual_id);
    if (noAtual) {
      // Only interactive nodes legitimately pause waiting for user input
      const isInteractive = ["opcoes", "aguardar", "respostas", "lista"].includes(noAtual.tipo);
      if (!isInteractive) {
        // Stuck estado at non-interactive node — clear and restart flow fresh
        await supabase.from("conversas").update({ fluxo_estado: null }).eq("id", convId);
        estado = null;
        // Fall through to trigger restart below
      } else {
        // Process user's response based on node type
        estado.variaveis["_ultima_msg"] = texto;
        if (noAtual.tipo === "aguardar" && noAtual.variavel) {
          estado.variaveis[noAtual.variavel] = texto;
        }
        if (["opcoes", "respostas", "lista"].includes(noAtual.tipo)) {
          const num = parseInt(texto.trim(), 10);
          if (!isNaN(num) && num > 0) {
            estado.variaveis["_opcao"] = String(num);
          }
        }
        await executarNosSequencialmente(noAtual.id, nos, conexoes, estado, convId, empresa_id, senderPhone, senderName, isNew, supabase, sendBot);
        return true;
      }
    }
  }

  const gatilhoTipo = noInicioRaw.gatilho_tipo || "mensagem_recebida";
  const tl = texto.toLowerCase().trim();
  let deveDisparar = false;

  if (gatilhoTipo === "mensagem_recebida") {
    deveDisparar = true;
  } else if (gatilhoTipo === "palavra_chave") {
    const palavras = (noInicioRaw.gatilho_palavras || "").split(",").map(p => p.trim().toLowerCase()).filter(Boolean);
    deveDisparar = palavras.some(p => tl.includes(p));
  } else if (gatilhoTipo === "primeira_mensagem") {
    deveDisparar = isNew;
  } else if (gatilhoTipo === "primeira_mensagem_dia") {
    const ultimaHora = conv.ultima_hora as string | null;
    if (ultimaHora) {
      const ultimaData = new Date(ultimaHora).toDateString();
      const hojeData   = new Date().toDateString();
      deveDisparar = (ultimaData !== hojeData) || isNew;
    } else {
      deveDisparar = true;
    }
  }

  if (!deveDisparar) return false;

  // intervalo_reativacao only applies to non-mensagem_recebida triggers
  // "mensagem_recebida" must always fire on every message
  if (gatilhoTipo !== "mensagem_recebida" && noInicioRaw.intervalo_reativacao && noInicioRaw.intervalo_reativacao > 0) {
    const ultimaHora = conv.ultima_hora as string | null;
    if (ultimaHora && !estado) {
      const diffMinutes = (Date.now() - new Date(ultimaHora).getTime()) / 60000;
      if (diffMinutes < noInicioRaw.intervalo_reativacao) {
        return false;
      }
    }
  }

  const primeiraDia = gatilhoTipo === "primeira_mensagem_dia" && deveDisparar;
  const novoEstado: FluxoEstado = {
    fluxo_id: fluxoId,
    no_atual_id: noInicioRaw.id,
    variaveis: {
      nome: senderName,
      telefone: senderPhone,
      _ultima_msg: texto,
      ...(primeiraDia ? { _primeira_do_dia: "true" } : {}),
    },
  };

  if (noInicioRaw.setor_padrao_id) {
    await supabase.from("conversas").update({ setor_id: noInicioRaw.setor_padrao_id }).eq("id", convId);
  }

  if (noInicioRaw.mensagem?.trim()) {
    await sendBot(interpolarVariaveis(noInicioRaw.mensagem, novoEstado.variaveis));
  }

  await executarNosSequencialmente(noInicioRaw.id, nos, conexoes, novoEstado, convId, empresa_id, senderPhone, senderName, isNew, supabase, sendBot);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Percorre e executa nós em sequência a partir de 'deId'
// ─────────────────────────────────────────────────────────────────────────────
async function executarNosSequencialmente(
  deId: string,
  nos: FluxoNo[],
  conexoes: FluxoConexao[],
  estado: FluxoEstado,
  convId: string,
  empresa_id: string,
  senderPhone: string,
  senderName: string,
  isNew: boolean,
  supabase: ReturnType<typeof createClient>,
  sendBot: (msg: string, tipo?: string, extra?: Record<string, unknown>) => Promise<void>,
  profundidade = 0,
): Promise<void> {
  if (profundidade > 20) return;

  const proxConexoes = conexoes.filter(c => c.de === deId);
  if (proxConexoes.length === 0) {
    await supabase.from("conversas").update({ fluxo_estado: null }).eq("id", convId);
    return;
  }

  const conexaoPadrao = proxConexoes[0];
  const proximoNoId = conexaoPadrao.para;
  const proximoNo = nos.find(n => n.id === proximoNoId);
  if (!proximoNo) return;

  estado.no_atual_id = proximoNo.id;

  switch (proximoNo.tipo) {
    case "mensagem": {
      if (proximoNo.mensagem?.trim()) {
        await sendBot(interpolarVariaveis(proximoNo.mensagem, estado.variaveis));
      }
      await executarNosSequencialmente(proximoNo.id, nos, conexoes, estado, convId, empresa_id, senderPhone, senderName, isNew, supabase, sendBot, profundidade + 1);
      break;
    }

    case "opcoes": {
      const opcoesFiltradas = (proximoNo.opcoes || []).filter(Boolean);
      if (opcoesFiltradas.length > 0) {
        const intro = proximoNo.mensagem?.trim() || "Escolha uma opção:";
        const listaOpcoes = opcoesFiltradas.map((op, i) => `${i + 1}. ${op}`).join("\n");
        await sendBot(interpolarVariaveis(`${intro}\n\n${listaOpcoes}`, estado.variaveis));
      }
      await supabase.from("conversas").update({ fluxo_estado: estado }).eq("id", convId);
      break;
    }

    case "condicao": {
      const condicaoTipo = proximoNo.condicao_tipo || "contem_palavra";
      const tl = (estado.variaveis["_ultima_msg"] || "").toLowerCase().trim();
      let condicaoVerdadeira = false;

      if (condicaoTipo === "contem_palavra") {
        const palavras = (proximoNo.gatilhos || "").split(",").map(p => p.trim().toLowerCase()).filter(Boolean);
        condicaoVerdadeira = palavras.some(p => tl.includes(p));
      } else if (condicaoTipo === "igual") {
        condicaoVerdadeira = tl === (proximoNo.gatilhos || "").toLowerCase().trim();
      } else if (condicaoTipo === "numero_opcao") {
        condicaoVerdadeira = estado.variaveis["_opcao"] === String(proximoNo.numero_opcao || "").trim();
      } else if (condicaoTipo === "primeira_mensagem") {
        condicaoVerdadeira = isNew;
      } else if (condicaoTipo === "primeira_mensagem_dia") {
        condicaoVerdadeira = !!estado.variaveis["_primeira_do_dia"];
      }

      const labelAlvo = condicaoVerdadeira ? "Sim" : "Não";
      const conexaoEscolhida = conexoes.find(c => c.de === proximoNo.id && c.label === labelAlvo)
        || conexoes.find(c => c.de === proximoNo.id);

      await logWA(supabase, {
        empresa_id, conversa_id: convId, tipo: "fluxo", nivel: "info",
        origem: "evolution-webhook", evento: `condicao:${condicaoTipo}`,
        telefone: senderPhone,
        resumo: `Condição "${condicaoTipo}" → ${condicaoVerdadeira ? "Sim" : "Não"}`,
        payload: { no: proximoNo.id, resultado: condicaoVerdadeira, label: labelAlvo },
      });

      if (conexaoEscolhida) {
        // Filter conexoes so the recursion follows only the chosen branch (Sim or Não).
        // Without this filter, executarNosSequencialmente would take the first connection
        // from the condition node regardless of which branch was evaluated, and the
        // destination node itself would be skipped.
        const conexoesFiltradas = [
          ...conexoes.filter(c => c.de !== proximoNo.id),
          conexaoEscolhida,
        ];
        await executarNosSequencialmente(proximoNo.id, nos, conexoesFiltradas, estado, convId, empresa_id, senderPhone, senderName, isNew, supabase, sendBot, profundidade + 1);
      } else {
        await supabase.from("conversas").update({ fluxo_estado: null }).eq("id", convId);
      }
      break;
    }

    case "aguardar": {
      if (proximoNo.mensagem?.trim()) {
        await sendBot(interpolarVariaveis(proximoNo.mensagem, estado.variaveis));
      }
      await supabase.from("conversas").update({ fluxo_estado: estado }).eq("id", convId);
      break;
    }

    case "transferir": {
      const transferFields: Record<string, unknown> = {
        bot_ativo: false,
        status: "aguardando",
        fluxo_estado: null,
      };

      const transferTipo = proximoNo.transferir_tipo || "fila";

      if (transferTipo === "setor" && proximoNo.transferir_setor_id) {
        transferFields.setor_id = proximoNo.transferir_setor_id;
      } else if (transferTipo === "usuario" && proximoNo.transferir_usuario_id) {
        transferFields.atendente_id = proximoNo.transferir_usuario_id;
      }

      // Update DB FIRST so any immediate webhook from the bot message below
      // sees bot_ativo=false and skips the chatbot (prevents menu loop race condition)
      await supabase.from("conversas").update(transferFields).eq("id", convId);

      if (proximoNo.mensagem?.trim()) {
        await sendBot(interpolarVariaveis(proximoNo.mensagem, estado.variaveis));
      } else {
        await sendBot("Aguarde um momento, vou transferir para um de nossos atendentes. 👋");
      }

      await logWA(supabase, {
        empresa_id, conversa_id: convId, tipo: "fluxo", nivel: "info",
        origem: "evolution-webhook", evento: "transferir",
        telefone: senderPhone,
        resumo: `Conversa transferida → ${transferTipo === "setor" ? `setor:${proximoNo.transferir_setor_id}` : transferTipo === "usuario" ? `atendente:${proximoNo.transferir_usuario_id}` : "fila"}`,
        payload: {
          transferir_tipo: proximoNo.transferir_tipo,
          transferir_setor_id: proximoNo.transferir_setor_id,
          transferir_usuario_id: proximoNo.transferir_usuario_id,
          fields_applied: Object.keys(transferFields),
        },
      });

      // Continue to the next node (e.g., Encerrar) so closing messages are sent
      await executarNosSequencialmente(proximoNo.id, nos, conexoes, estado, convId, empresa_id, senderPhone, senderName, isNew, supabase, sendBot, profundidade + 1);
      break;
    }

    case "encerrar": {
      if (proximoNo.mensagem?.trim()) {
        await sendBot(interpolarVariaveis(proximoNo.mensagem, estado.variaveis));
      }
      await supabase.from("conversas").update({ fluxo_estado: null }).eq("id", convId);
      break;
    }

    case "imagem":
    case "video":
    case "audio":
    case "documento": {
      if (proximoNo.media_url?.trim()) {
        await sendBot(
          interpolarVariaveis(proximoNo.mensagem || "", estado.variaveis),
          proximoNo.tipo,
          { url: proximoNo.media_url },
        );
      }
      await executarNosSequencialmente(proximoNo.id, nos, conexoes, estado, convId, empresa_id, senderPhone, senderName, isNew, supabase, sendBot, profundidade + 1);
      break;
    }

    case "respostas": {
      const botoes = [proximoNo.botao_1, proximoNo.botao_2, proximoNo.botao_3].filter(Boolean);
      const partes: string[] = [];
      if (proximoNo.mensagem?.trim()) partes.push(proximoNo.mensagem.trim());
      if (botoes.length > 0) partes.push(botoes.map((b, i) => `${i + 1}. ${b}`).join("\n"));
      const textoFinal = partes.join("\n\n");
      if (textoFinal) {
        await sendBot(interpolarVariaveis(textoFinal, estado.variaveis));
      }
      await supabase.from("conversas").update({ fluxo_estado: estado }).eq("id", convId);
      break;
    }

    case "lista": {
      const itens = (proximoNo.lista_itens || "").split("\n").filter(Boolean);
      const textoLista = (proximoNo.mensagem || "") +
        (itens.length > 0 ? "\n\n" + itens.map((item, i) => `${i + 1}. ${item}`).join("\n") : "") +
        (proximoNo.lista_titulo_botao ? `\n\n[${proximoNo.lista_titulo_botao}]` : "");
      if (textoLista.trim()) {
        await sendBot(interpolarVariaveis(textoLista, estado.variaveis));
      }
      await supabase.from("conversas").update({ fluxo_estado: estado }).eq("id", convId);
      break;
    }

    case "controle_fluxo": {
      if (proximoNo.mensagem?.trim()) {
        await sendBot(interpolarVariaveis(proximoNo.mensagem, estado.variaveis));
      }
      await supabase.from("conversas").update({ fluxo_estado: null }).eq("id", convId);
      break;
    }

    default:
      await supabase.from("conversas").update({ fluxo_estado: null }).eq("id", convId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
function interpolarVariaveis(texto: string, variaveis: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (_, k) => variaveis[k] ?? `{${k}}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Processa array de mensagens
// ─────────────────────────────────────────────────────────────────────────────
async function processMessages(
  msgs: unknown[], empresa_id: string, supabase: ReturnType<typeof createClient>,
  GLOBAL_URL: string, now: string, isHistory: boolean
) {
  // Load chatbot_config once per batch to get setor_padrao_id for auto-assignment
  let cfgEarly: Record<string, unknown> | null = null;
  if (!isHistory) {
    const { data: cfgData } = await supabase.from("chatbot_config").select("setor_padrao_id, fluxo_ativo_id").eq("empresa_id", empresa_id).maybeSingle();
    cfgEarly = cfgData ?? null;
  }

  for (const msg of msgs) {
    if (!msg || typeof msg !== "object") continue;
    const m = msg as Record<string, unknown>;

    const info = (m.Info || m.info || {}) as Record<string, unknown>;
    const key  = (m.key  || m.Key  || {}) as Record<string, unknown>;
    const fromMe = Boolean(info.IsFromMe ?? key.fromMe ?? false);
    if (!isHistory && fromMe) continue;

    const remoteJid = ((info.Chat || key.remoteJid || "") as string);
    if (!remoteJid) continue;
    if (remoteJid.endsWith("@broadcast")) continue;

    const isGroup   = remoteJid.endsWith("@g.us");
    // Para @lid: tentar pegar o número real de campos alternativos do payload
    const participantJid = (key.participant || info.Sender || m.participant || "") as string;
    const resolvedPhone = participantJid
      ? participantJid.replace(/@s\.whatsapp\.net$/, "").replace(/:.*$/, "")
      : "";
    const rawPhone = isGroup
      ? remoteJid
      : remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/:.*$/, "");
    const senderPhone = (rawPhone.endsWith("@lid") && resolvedPhone && !resolvedPhone.includes("@"))
      ? resolvedPhone
      : rawPhone;
    if (!senderPhone) continue;

    const senderName = ((info.PushName || m.pushName || m.PushName || (isGroup ? "Grupo" : senderPhone)) as string);
    const msgContent = (m.Message || m.message || {}) as Record<string, unknown>;

    const ec   = (msgContent.extendedTextMessage || msgContent.ExtendedTextMessage || {}) as Record<string,unknown>;
    const imgC = (msgContent.imageMessage   || msgContent.ImageMessage   || {}) as Record<string,unknown>;
    const vidC = (msgContent.videoMessage   || msgContent.VideoMessage   || {}) as Record<string,unknown>;
    const docC = (msgContent.documentMessage|| msgContent.DocumentMessage|| {}) as Record<string,unknown>;
    const textoRaw: string =
      (msgContent.conversation as string) || (msgContent.Conversation as string) ||
      (ec.text as string) || (imgC.caption as string) || (vidC.caption as string) ||
      (msgContent.audioMessage  || msgContent.AudioMessage  ? "[🎤 Áudio recebido]" : "") ||
      (msgContent.stickerMessage|| msgContent.StickerMessage? "[Sticker]"           : "") ||
      (msgContent.locationMessage||msgContent.LocationMessage?"[📍 Localização]"   : "") ||
      (docC.title || docC.Title ? `[📄 ${docC.title || docC.Title}]`               : "") ||
      "[Mensagem recebida]";

    const texto: string = (isGroup && !fromMe && senderName && senderName !== senderPhone)
      ? `[${senderName}]: ${textoRaw}`
      : textoRaw;

    const rawTs = info.Timestamp || m.messageTimestamp || m.MessageTimestamp;
    const hora  = safeTimestamp(rawTs, now);
    const wamid = ((info.ID || info.Id || key.id || key.ID || "") as string);

    const audioC = (msgContent.audioMessage || msgContent.AudioMessage ||
                    msgContent.pttMessage   || msgContent.PttMessage   || {}) as Record<string,unknown>;
    let tipoMsg = "texto";
    let mediaUrl: string | null = null;
    let nomeArquivo: string | null = null;

    if (msgContent.audioMessage || msgContent.AudioMessage || msgContent.pttMessage || msgContent.PttMessage) {
      tipoMsg = "audio"; mediaUrl = (audioC.url as string) || null;
    } else if (msgContent.imageMessage || msgContent.ImageMessage) {
      tipoMsg = "imagem"; mediaUrl = (imgC.url as string) || null;
    } else if (msgContent.videoMessage || msgContent.VideoMessage) {
      tipoMsg = "video"; mediaUrl = (vidC.url as string) || null;
    } else if (msgContent.documentMessage || msgContent.DocumentMessage) {
      tipoMsg = "documento"; mediaUrl = ((docC.url || docC.Url) as string) || null;
      nomeArquivo = ((docC.title || docC.Title) as string) || null;
    } else if (msgContent.stickerMessage || msgContent.StickerMessage) {
      tipoMsg = "sticker";
    }

    console.log(`[webhook] ${isHistory?"HIST":"MSG"} from:${senderPhone} fromMe:${fromMe} ts:${hora} tipo:${tipoMsg} text:${texto.slice(0,60)}`);

    // ── Busca ou cria conversa ────────────────────────────────────────────────
    let isNew = false;
    let { data: conv } = await supabase.from("conversas")
      .select("id, nao_lidas, contato_nome, status, bot_ativo, ultima_hora, fluxo_estado, atendente_id")
      .eq("empresa_id", empresa_id).eq("contato_telefone", senderPhone).maybeSingle();

    if (!conv) {
      isNew = true;

      const { data: nova } = await supabase.from("conversas").insert({
        empresa_id, contato_nome: senderName, contato_telefone: senderPhone,
        ultima_mensagem: texto, ultima_hora: hora,
        nao_lidas: fromMe ? 0 : 1, status: "aberta", bot_ativo: null,
        whatsapp_numero: senderPhone, fluxo_estado: null,
        // setor_padrao só se houver fluxo visual ativo (ele roteará o setor); senão, round-robin assume
        ...(cfgEarly?.setor_padrao_id && cfgEarly?.fluxo_ativo_id ? { setor_id: cfgEarly.setor_padrao_id } : {}),
      }).select("id, nao_lidas, contato_nome, status, bot_ativo, ultima_hora, fluxo_estado").single();
      conv = nova;

      await logWA(supabase, {
        empresa_id, conversa_id: nova?.id, tipo: "conversa_criada", nivel: "info",
        origem: "evolution-webhook", telefone: senderPhone,
        resumo: `Nova conversa criada: ${senderName} (${senderPhone})`,
        payload: { nome: senderName, isGroup },
      });

      const { data: leadExist } = await supabase.from("leads")
        .select("id").eq("empresa_id", empresa_id).eq("whatsapp", senderPhone).maybeSingle();
      if (!leadExist) {
        await supabase.from("leads").insert({
          empresa_id, nome: senderName, whatsapp: senderPhone,
          origem: "WhatsApp", status: "novo", score: 20, ultima_atividade: hora,
        });
      }

      // ── Round-robin: distribui novo cliente para o próximo vendedor ──────────
      // Só corre quando não há fluxo visual ativo (o fluxo visual é quem roteia setores/atendente)
      if (!fromMe && conv?.id && !cfgEarly?.fluxo_ativo_id) {
        try {
          const [{ data: dist }, { data: setorVendas }] = await Promise.all([
            supabase.from("distribuicao_atendimento")
              .select("id, ativo, vendedores_ids, proximo_indice")
              .eq("empresa_id", empresa_id)
              .maybeSingle(),
            supabase.from("setores")
              .select("id")
              .eq("empresa_id", empresa_id)
              .ilike("nome", "%vendas%")
              .maybeSingle(),
          ]);

          const roundRobinAtivo = !dist || dist.ativo !== false;

          if (roundRobinAtivo) {
            let sellersQuery = supabase
              .from("usuarios")
              .select("id, nome")
              .eq("empresa_id", empresa_id)
              .eq("ativo", true)
              .ilike("cargo", "%SDR%");

            if (dist?.vendedores_ids?.length) {
              sellersQuery = sellersQuery.in("id", dist.vendedores_ids);
            }

            const { data: sellers } = await sellersQuery.order("created_at");

            if (sellers?.length) {
              const idx = (dist?.proximo_indice ?? 0) % sellers.length;
              const assignedSeller = sellers[idx];

              await supabase.from("conversas")
                .update({
                  atendente_id: assignedSeller.id,
                  ...(setorVendas?.id ? { setor_id: setorVendas.id } : {}),
                })
                .eq("id", conv.id);

              if (dist?.id) {
                await supabase.from("distribuicao_atendimento")
                  .update({ proximo_indice: (dist.proximo_indice ?? 0) + 1, updated_at: new Date().toISOString() })
                  .eq("id", dist.id);
              } else {
                // Cria o registro de controle automaticamente na primeira vez
                await supabase.from("distribuicao_atendimento")
                  .insert({ empresa_id, ativo: true, vendedores_ids: [], proximo_indice: 1 });
              }

              console.log(`[round-robin] Conversa ${conv.id} → ${assignedSeller.nome} (idx ${idx}) setor:${setorVendas?.id ?? "nenhum"}`);
            }
          }
        } catch (rrErr) {
          console.error("[round-robin] erro:", (rrErr as Error).message);
        }
      }

    } else if (!fromMe && !isHistory) {
      const reopenFields: Record<string, unknown> = {
        ultima_mensagem: texto, ultima_hora: hora,
        nao_lidas: (conv.nao_lidas || 0) + 1,
        contato_nome: senderName || conv.contato_nome,
      };
      // Reabre conversa resolvida automaticamente quando cliente envia nova mensagem
      if (conv.status === "resolvida") {
        reopenFields.status = "aberta";
        reopenFields.atendente_id = null;
        reopenFields.fluxo_estado = null;
        reopenFields.bot_ativo = null;
        // Sync in-memory conv so the chatbot block below sees the cleared state
        conv = { ...conv, fluxo_estado: null, bot_ativo: null, status: "aberta" };
        // setor_padrao só se houver fluxo visual ativo; senão round-robin assume o roteamento
        if (cfgEarly?.setor_padrao_id && cfgEarly?.fluxo_ativo_id) reopenFields.setor_id = cfgEarly.setor_padrao_id;
      }
      await supabase.from("conversas").update(reopenFields).eq("id", conv.id);

      // Round-robin para conversas sem atendente — só se não houver fluxo visual ativo
      const precisaAtribuir = !cfgEarly?.fluxo_ativo_id &&
        (conv.status === "resolvida" || !(conv as Record<string, unknown>).atendente_id);
      if (precisaAtribuir) {
        try {
          const [{ data: dist }, { data: setorVendas }] = await Promise.all([
            supabase.from("distribuicao_atendimento")
              .select("id, ativo, vendedores_ids, proximo_indice")
              .eq("empresa_id", empresa_id)
              .maybeSingle(),
            supabase.from("setores")
              .select("id")
              .eq("empresa_id", empresa_id)
              .ilike("nome", "%vendas%")
              .maybeSingle(),
          ]);

          const roundRobinAtivo = !dist || dist.ativo !== false;
          if (roundRobinAtivo) {
            let rrQuery = supabase
              .from("usuarios")
              .select("id, nome")
              .eq("empresa_id", empresa_id)
              .eq("ativo", true)
              .ilike("cargo", "%SDR%");
            if (dist?.vendedores_ids?.length) {
              rrQuery = rrQuery.in("id", dist.vendedores_ids);
            }
            const { data: sellers } = await rrQuery.order("created_at");
            if (sellers?.length) {
              const idx = (dist?.proximo_indice ?? 0) % sellers.length;
              const assignedSeller = sellers[idx];
              await supabase.from("conversas")
                .update({
                  atendente_id: assignedSeller.id,
                  ...(setorVendas?.id ? { setor_id: setorVendas.id } : {}),
                })
                .eq("id", conv.id);
              if (dist?.id) {
                await supabase.from("distribuicao_atendimento")
                  .update({ proximo_indice: (dist.proximo_indice ?? 0) + 1, updated_at: new Date().toISOString() })
                  .eq("id", dist.id);
              }
              console.log(`[round-robin] Re-open: conversa ${conv.id} → ${assignedSeller.nome} setor:${setorVendas?.id ?? "nenhum"}`);
            }
          }
        } catch (rrErr) {
          console.error("[round-robin] re-open erro:", (rrErr as Error).message);
        }
      }
    }

    if (!conv?.id) continue;

    // ── Re-hospedar mídia recebida no Supabase Storage ───────────────────────
    let storedMediaUrl = mediaUrl;
    if (mediaUrl && ["imagem","video","audio","documento"].includes(tipoMsg)) {
      try {
        const mediaRes = await fetch(mediaUrl, { signal: AbortSignal.timeout(8000) });
        if (mediaRes.ok) {
          const bytes = await mediaRes.arrayBuffer();
          const ct = mediaRes.headers.get("content-type") || "image/jpeg";
          const extMap: Record<string,string> = { "image/jpeg":"jpg","image/png":"png","image/webp":"webp","video/mp4":"mp4","audio/ogg":"ogg","audio/mpeg":"mp3","audio/webm":"webm" };
          const ext = extMap[ct] ?? ct.split("/")[1] ?? "bin";
          const storagePath = `whatsapp/${empresa_id}/${conv.id}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("midia").upload(storagePath, bytes, { contentType: ct, upsert: true });
          if (!upErr) {
            const { data: pub } = supabase.storage.from("midia").getPublicUrl(storagePath);
            storedMediaUrl = pub.publicUrl;
          }
        }
      } catch (e) { console.log("[webhook] media re-host err:", (e as Error).message); }
    }

    // ── Insert message — for wamid messages the unique index (mensagens_wamid_unique)
    //    acts as a dedup mutex: when Evolution API delivers the same webhook multiple
    //    times simultaneously, only the first insert succeeds; the rest get error 23505
    //    and skip all further processing (including chatbot) — preventing duplicate menus.
    if (wamid) {
      const { error: insertErr } = await supabase.from("mensagens").insert({
        conversa_id: conv.id, empresa_id, de: fromMe ? "me" : "contato",
        texto, tipo: tipoMsg, media_url: storedMediaUrl, nome_arquivo: nomeArquivo,
        wamid, hora, status: fromMe ? "enviado" : "recebido",
        remetente: fromMe ? "me" : "contato",
      });
      if (insertErr) {
        if (insertErr.code === "23505") {
          console.log("[webhook] dedup: wamid concurrent duplicate, skipping");
          continue;
        }
        console.error("[webhook] insert error:", insertErr.message);
      }
    } else {
      // No wamid: select-based dedup then insert
      const { data: existing } = await supabase.from("mensagens")
        .select("id").eq("conversa_id", conv.id).eq("hora", hora).eq("texto", texto).maybeSingle();
      if (existing) { console.log("[webhook] dedup: msg já existe"); continue; }
      await supabase.from("mensagens").insert({
        conversa_id: conv.id, empresa_id, de: fromMe ? "me" : "contato",
        texto, tipo: tipoMsg, media_url: storedMediaUrl, nome_arquivo: nomeArquivo,
        wamid: null, hora, status: fromMe ? "enviado" : "recebido",
        remetente: fromMe ? "me" : "contato",
      });
    }

    // ── Log mensagem recebida do contato ─────────────────────────────────────
    if (!fromMe && !isHistory) {
      await logWA(supabase, {
        empresa_id, conversa_id: conv.id, tipo: "webhook_recebido", nivel: "info",
        origem: "evolution-webhook", evento: tipoMsg,
        telefone: senderPhone,
        resumo: `${senderName}: ${texto.slice(0, 100)}${texto.length > 100 ? "…" : ""}`,
        payload: { tipoMsg, wamid: wamid || null },
      });
    }

    // ── Chatbot ──────────────────────────────────────────────────────────────
    if (!fromMe && !isHistory && conv.status !== "em_atendimento" && conv.bot_ativo !== false) {
      try {
        const { data: cfg } = await supabase.from("chatbot_config").select("*").eq("empresa_id", empresa_id).maybeSingle();
        if (!cfg?.ativo) continue;

        if (isGroup && !cfg.responder_grupos) continue;
        // nao_responder_aberta only silences the bot for conversations with no active flow —
        // an ongoing flow must always continue even if status is "aberta"
        const hasActiveFlow = !!(conv.fluxo_estado as { fluxo_id?: string } | null)?.fluxo_id;
        if (cfg.nao_responder_aberta && conv.status === "aberta" && !hasActiveFlow) continue;

        const { data: empData } = await supabase.from("empresas")
          .select("evolution_instance_id, evolution_instance_token, evolution_api_url")
          .eq("id", empresa_id).single();
        const instId    = empData?.evolution_instance_id;
        const instToken = empData?.evolution_instance_token;
        const evoUrl    = ((empData?.evolution_api_url || GLOBAL_URL) as string).replace(/\/$/, "");

        const sendBot = async (msgText: string, tipo = "texto", extra?: Record<string, unknown>) => {
          if (!instId || !instToken || !evoUrl) return;

          let apiOk = false;
          let apiErr = "";

          if (["imagem","video","audio","documento"].includes(tipo)) {
            // Evolution API v2 — /message/sendMedia/{instance}
            const mediaType = tipo === "imagem" ? "image" : tipo === "video" ? "video" : tipo === "audio" ? "audio" : "document";
            const r = await fetch(`${evoUrl}/message/sendMedia/${instId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": instToken },
              body: JSON.stringify({
                number: senderPhone,
                mediatype: mediaType,
                media: extra?.url as string || "",
                caption: msgText || "",
                ...(extra?.fileName ? { fileName: extra.fileName } : {}),
              }),
            });
            apiOk = r.ok;
            if (!r.ok) apiErr = await r.text().catch(() => String(r.status));
          } else {
            // Evolution API v2 — /message/sendText/{instance} (formato simples)
            const r = await fetch(`${evoUrl}/message/sendText/${instId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": instToken },
              body: JSON.stringify({ number: senderPhone, text: msgText }),
            });
            apiOk = r.ok;
            if (!r.ok) apiErr = await r.text().catch(() => String(r.status));

            // Fallback: formato v2 alternativo com options/textMessage
            if (!apiOk) {
              try {
                const r2 = await fetch(`${evoUrl}/message/sendText/${instId}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "apikey": instToken },
                  body: JSON.stringify({
                    number: senderPhone,
                    options: { delay: 1200, presence: "composing", linkPreview: false },
                    textMessage: { text: msgText },
                  }),
                });
                if (r2.ok) { apiOk = true; apiErr = ""; }
                else apiErr = await r2.text().catch(() => String(r2.status));
              } catch (_) {}
            }
          }

          if (!apiOk) {
            await logWA(supabase, {
              empresa_id, conversa_id: conv?.id, tipo: "erro_api", nivel: "error",
              origem: "evolution-webhook", evento: `send/${tipo}`,
              telefone: senderPhone,
              resumo: `Falha ao enviar mensagem bot: ${apiErr.slice(0, 150)}`,
              payload: { tipo, instId, evoUrl: evoUrl.slice(0, 60) },
            });
          } else {
            await logWA(supabase, {
              empresa_id, conversa_id: conv?.id, tipo: "mensagem_bot", nivel: "info",
              origem: "evolution-webhook", evento: `send/${tipo}`,
              telefone: senderPhone,
              resumo: msgText.slice(0, 120) || `[${tipo}]`,
              payload: { tipo },
            });
          }

          if (conv?.id) {
            await supabase.from("mensagens").insert({
              conversa_id: conv.id, empresa_id, de: "me", texto: msgText,
              tipo: tipo, media_url: (extra?.url as string) || null, nome_arquivo: (extra?.fileName as string) || null,
              hora: new Date().toISOString(), status: "enviado", remetente: "bot",
            });
            await supabase.from("conversas").update({
              ultima_mensagem: msgText, ultima_hora: new Date().toISOString(),
            }).eq("id", conv!.id);
          }
        };

        const transferWord = (cfg.transferir_palavra || "atendente").toLowerCase().trim();
        if (texto.toLowerCase().includes(transferWord)) {
          await supabase.from("conversas").update({ bot_ativo: false, status: "aguardando", fluxo_estado: null }).eq("id", conv!.id);
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

        // Skip chatbot_regras when a visual flow is active (fluxo_estado set) —
        // the flow owns the conversation state and rules could match numeric inputs
        const temFluxoAtivo = !!(conv.fluxo_estado as { fluxo_id?: string } | null)?.fluxo_id;
        let gatilhoAtivado = false;
        if (!temFluxoAtivo) {
          const { data: regras } = await supabase.from("chatbot_regras")
            .select("*").eq("empresa_id", empresa_id).eq("ativo", true).order("ordem");
          if (regras?.length) {
            const tl2 = texto.toLowerCase();
            for (const r of regras) {
              if (tl2.includes(r.gatilho.toLowerCase())) {
                await sendBot(r.resposta);
                gatilhoAtivado = true;
                break;
              }
            }
          }
        }

        if (!gatilhoAtivado) {
          const convComMsg = {
            ...conv,
            fluxo_estado: conv.fluxo_estado
              ? {
                  ...(conv.fluxo_estado as Record<string, unknown>),
                  variaveis: {
                    ...((conv.fluxo_estado as Record<string, unknown>).variaveis as Record<string, unknown> || {}),
                    _ultima_msg: texto,
                  },
                }
              : null,
          };

          const fluxoExecutado = await executarFluxo(
            cfg as Record<string, unknown>,
            texto, senderPhone, senderName,
            convComMsg as Record<string, unknown>,
            empresa_id, isNew, supabase, sendBot,
          );

          if (!fluxoExecutado) {
            if (isNew && cfg.mensagem_boas_vindas) await sendBot(cfg.mensagem_boas_vindas);
          }
        }

      } catch (botErr) {
        console.error("[webhook] chatbot error:", botErr);
        await logWA(supabase, {
          empresa_id, conversa_id: conv?.id, tipo: "erro_api", nivel: "error",
          origem: "evolution-webhook", evento: "chatbot",
          telefone: senderPhone,
          resumo: `Erro no chatbot: ${((botErr as Error).message || String(botErr)).slice(0, 200)}`,
        });
      }
    }
  }
}
