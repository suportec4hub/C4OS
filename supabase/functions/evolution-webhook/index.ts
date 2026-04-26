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
    const rawToken     = reqUrl.searchParams.get("token") || "";
    const tokenFromUrl = rawToken.split("/")[0].trim();
    const body         = await req.json();

    const event = body.event || body.eventString || body.Event || "";
    const data  = body.data  || body.Data  || body;

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
      console.error("[webhook] empresa nao encontrada | token:", instanceToken.slice(0, 8), "| instanceName:", instanceName);
      return new Response("Instance not found", { status: 404 });
    }

    const now = new Date().toISOString();

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
      } else if (state === "close" || state === "connecting" || event === "Disconnected") {
        await supabase.from("empresas").update({ evolution_connected: false }).eq("id", empresa_id);
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
  tipo: "inicio" | "mensagem" | "opcoes" | "condicao" | "transferir" | "encerrar" | "aguardar";
  nome?: string;
  mensagem?: string;
  opcoes?: string[];
  gatilho_tipo?: "mensagem_recebida" | "palavra_chave" | "primeira_mensagem_dia" | "primeira_mensagem";
  gatilho_palavras?: string;
  condicao_tipo?: "contem_palavra" | "igual" | "numero_opcao" | "primeira_mensagem" | "primeira_mensagem_dia";
  gatilhos?: string;
  numero_opcao?: string;
  variavel?: string;
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
  sendBot: (msg: string) => Promise<void>,
): Promise<boolean> {
  // Carrega fluxo ativo
  const fluxoId = cfg.fluxo_ativo_id as string | null;
  if (!fluxoId) return false;

  const { data: fluxoData } = await supabase.from("chatbot_fluxos")
    .select("nos, conexoes, ativo").eq("id", fluxoId).single();
  if (!fluxoData?.ativo) return false;

  const nos: FluxoNo[]          = fluxoData.nos     || [];
  const conexoes: FluxoConexao[] = fluxoData.conexoes || [];
  const noInicioRaw = nos.find(n => n.tipo === "inicio");
  if (!noInicioRaw) return false;

  // Estado atual da conversa dentro do fluxo
  let estado: FluxoEstado | null = (conv.fluxo_estado as FluxoEstado) || null;
  const convId = conv.id as string;

  // ── Se conversa está no meio do fluxo (aguardando resposta) ─────────────
  if (estado && estado.fluxo_id === fluxoId) {
    const noAtual = nos.find(n => n.id === estado!.no_atual_id);
    if (noAtual) {
      // Processando resposta a aguardar (salvar variável)
      if (noAtual.tipo === "aguardar" && noAtual.variavel) {
        estado.variaveis[noAtual.variavel] = texto;
      }
      // Processando resposta a opcoes (o usuário digitou um número)
      if (noAtual.tipo === "opcoes") {
        const num = parseInt(texto.trim(), 10);
        if (!isNaN(num) && num > 0) {
          estado.variaveis["_opcao"] = String(num);
        }
      }
      // Avança para o próximo nó
      await executarNosSequencialmente(noAtual.id, nos, conexoes, estado, convId, empresa_id, senderPhone, senderName, isNew, supabase, sendBot);
      return true;
    }
  }

  // ── Verifica gatilho do nó início ───────────────────────────────────────
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
    // Verifica se a última mensagem do contato foi em outro dia
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

  // ── Inicia fluxo do zero ──────────────────────────────────────────────────
  const novoEstado: FluxoEstado = {
    fluxo_id: fluxoId,
    no_atual_id: noInicioRaw.id,
    variaveis: { nome: senderName, telefone: senderPhone },
  };

  // Mensagem de abertura do nó início (se configurada)
  if (noInicioRaw.mensagem?.trim()) {
    await sendBot(interpolarVariaveis(noInicioRaw.mensagem, novoEstado.variaveis));
  }

  // Avança a partir do início
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
  sendBot: (msg: string) => Promise<void>,
  profundidade = 0,
): Promise<void> {
  if (profundidade > 20) return; // proteção anti-loop

  // Pega conexões saindo de deId
  const proxConexoes = conexoes.filter(c => c.de === deId);
  if (proxConexoes.length === 0) {
    // Fim do fluxo — limpa estado
    await supabase.from("conversas").update({ fluxo_estado: null }).eq("id", convId);
    return;
  }

  // Para nós com múltiplas saídas (condicao), pega a correta
  // Caso contrário pega a primeira conexão disponível
  const conexaoPadrao = proxConexoes[0];
  const proximoNoId = conexaoPadrao.para;
  const proximoNo = nos.find(n => n.id === proximoNoId);
  if (!proximoNo) return;

  estado.no_atual_id = proximoNo.id;

  switch (proximoNo.tipo) {
    // ── Mensagem simples ────────────────────────────────────────────────────
    case "mensagem": {
      if (proximoNo.mensagem?.trim()) {
        await sendBot(interpolarVariaveis(proximoNo.mensagem, estado.variaveis));
      }
      await executarNosSequencialmente(proximoNo.id, nos, conexoes, estado, convId, empresa_id, senderPhone, senderName, isNew, supabase, sendBot, profundidade + 1);
      break;
    }

    // ── Menu de opções (aguarda resposta do usuário) ─────────────────────────
    case "opcoes": {
      const opcoesFiltradas = (proximoNo.opcoes || []).filter(Boolean);
      if (opcoesFiltradas.length > 0) {
        const intro = proximoNo.mensagem?.trim() || "Escolha uma opção:";
        const listaOpcoes = opcoesFiltradas.map((op, i) => `${i + 1}. ${op}`).join("\n");
        await sendBot(interpolarVariaveis(`${intro}\n\n${listaOpcoes}`, estado.variaveis));
      }
      // Salva estado: aguardando resposta do usuário
      await supabase.from("conversas").update({ fluxo_estado: estado }).eq("id", convId);
      break;
    }

    // ── Condição (bifurcação) ────────────────────────────────────────────────
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

      // Escolhe a conexão correta: "Sim" ou "Não"
      const labelAlvo = condicaoVerdadeira ? "Sim" : "Não";
      const conexaoEscolhida = conexoes.find(c => c.de === proximoNo.id && c.label === labelAlvo)
        || conexoes.find(c => c.de === proximoNo.id); // fallback: primeira disponível

      if (conexaoEscolhida) {
        await executarNosSequencialmente(proximoNo.id, nos, conexoes, estado, convId, empresa_id, senderPhone, senderName, isNew, supabase, sendBot, profundidade + 1);
      } else {
        await supabase.from("conversas").update({ fluxo_estado: null }).eq("id", convId);
      }
      break;
    }

    // ── Aguardar input do usuário ────────────────────────────────────────────
    case "aguardar": {
      if (proximoNo.mensagem?.trim()) {
        await sendBot(interpolarVariaveis(proximoNo.mensagem, estado.variaveis));
      }
      // Salva estado aguardando
      await supabase.from("conversas").update({ fluxo_estado: estado }).eq("id", convId);
      break;
    }

    // ── Transferir para humano ───────────────────────────────────────────────
    case "transferir": {
      if (proximoNo.mensagem?.trim()) {
        await sendBot(interpolarVariaveis(proximoNo.mensagem, estado.variaveis));
      } else {
        await sendBot("Aguarde um momento, vou transferir para um de nossos atendentes. 👋");
      }
      await supabase.from("conversas").update({
        bot_ativo: false,
        status: "aguardando",
        fluxo_estado: null,
      }).eq("id", convId);
      break;
    }

    // ── Encerrar fluxo ───────────────────────────────────────────────────────
    case "encerrar": {
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
// Substitui {variavel} no texto pelas variáveis do estado
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
    const senderPhone = isGroup
      ? remoteJid
      : remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/:.*$/, "");
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
      .select("id, nao_lidas, contato_nome, status, bot_ativo, ultima_hora, fluxo_estado")
      .eq("empresa_id", empresa_id).eq("contato_telefone", senderPhone).maybeSingle();

    if (!conv) {
      isNew = true;
      const { data: nova } = await supabase.from("conversas").insert({
        empresa_id, contato_nome: senderName, contato_telefone: senderPhone,
        ultima_mensagem: texto, ultima_hora: hora,
        nao_lidas: fromMe ? 0 : 1, status: "aberta", bot_ativo: false,
        whatsapp_numero: senderPhone, fluxo_estado: null,
      }).select("id, nao_lidas, contato_nome, status, bot_ativo, ultima_hora, fluxo_estado").single();
      conv = nova;

      const { data: leadExist } = await supabase.from("leads")
        .select("id").eq("empresa_id", empresa_id).eq("whatsapp", senderPhone).maybeSingle();
      if (!leadExist) {
        await supabase.from("leads").insert({
          empresa_id, nome: senderName, whatsapp: senderPhone,
          origem: "WhatsApp", status: "novo", score: 20, ultima_atividade: hora,
        });
      }
    } else if (!fromMe && !isHistory) {
      await supabase.from("conversas").update({
        ultima_mensagem: texto, ultima_hora: hora,
        nao_lidas: (conv.nao_lidas || 0) + 1,
        contato_nome: senderName || conv.contato_nome,
      }).eq("id", conv.id);
    }

    if (!conv?.id) continue;

    // ── Dedup ────────────────────────────────────────────────────────────────
    const { data: existing } = await supabase.from("mensagens")
      .select("id").eq("conversa_id", conv.id).eq("hora", hora).eq("texto", texto).maybeSingle();
    if (existing) { console.log("[webhook] dedup: msg já existe"); continue; }

    await supabase.from("mensagens").insert({
      conversa_id: conv.id, empresa_id, de: fromMe ? "me" : "contato",
      texto, tipo: tipoMsg, media_url: mediaUrl, nome_arquivo: nomeArquivo,
      wamid: wamid || null, hora, status: fromMe ? "enviado" : "recebido",
      remetente: fromMe ? "me" : "contato",
    });

    // ── Chatbot ──────────────────────────────────────────────────────────────
    if (!fromMe && !isHistory && conv.status !== "em_atendimento") {
      try {
        const { data: cfg } = await supabase.from("chatbot_config").select("*").eq("empresa_id", empresa_id).maybeSingle();
        if (!cfg?.ativo) continue;

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
            body: JSON.stringify({ instanceName: instId, id: instId, number: senderPhone, text: msgText }),
          });
          if (conv?.id) {
            await supabase.from("mensagens").insert({
              conversa_id: conv.id, empresa_id, de: "me", texto: msgText,
              hora: new Date().toISOString(), status: "enviado", remetente: "bot",
            });
            await supabase.from("conversas").update({
              ultima_mensagem: msgText, ultima_hora: new Date().toISOString(),
            }).eq("id", conv!.id);
          }
        };

        // Palavra de transferência manual (sempre tem prioridade)
        const transferWord = (cfg.transferir_palavra || "atendente").toLowerCase().trim();
        if (texto.toLowerCase().includes(transferWord)) {
          await supabase.from("conversas").update({ bot_ativo: false, status: "aguardando", fluxo_estado: null }).eq("id", conv!.id);
          await sendBot("Aguarde, vou transferir para um atendente. 👋");
          continue;
        }

        // Verifica horário
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

        // ── Tenta executar fluxo visual (prioridade máxima) ─────────────────
        // Enriquece conv com a última mensagem para uso no estado de fluxo
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

        // ── Fallback: regras de palavra-chave (quando não há fluxo ativo) ────
        if (!fluxoExecutado) {
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
