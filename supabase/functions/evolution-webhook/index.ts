import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.19";

// ─── Cloudflare R2 upload helper — S3-compatible, região "auto" ───────────────
const _R2_ENDPOINT   = Deno.env.get("R2_ENDPOINT")   || "https://1f59288cdc89e59b8a1027c6bc33205f.r2.cloudflarestorage.com";
const _R2_BUCKET     = Deno.env.get("R2_BUCKET")     || "c4os";
const _R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL") || "https://pub-702abeb54c2b46a6888cc69b17b364a7.r2.dev";
let _awsClient: AwsClient | null = null;

// ─── Cache de instância (token → empresa) — evita 4 queries PostgREST por webhook ─
// Workers Deno reutilizam o módulo entre invocações: cache reduz 200+ req/s para ~1/s
const _instanceCache = new Map<string, {
  empresa_id: string; instanciaId: string | null; instanciaEhPrincipal: boolean; ts: number;
}>();
// Cache de credenciais da instância principal (empresa_id → instance_id/token)
const _empCredCache = new Map<string, {
  evolution_instance_id: string | null; evolution_instance_token: string | null; ts: number;
}>();
const _CACHE_TTL = 90_000; // 90 segundos

function getAwsClient(): AwsClient | null {
  const keyId  = Deno.env.get("R2_KEY_ID");
  const appKey = Deno.env.get("R2_APP_KEY");
  if (!keyId || !appKey) return null;
  if (!_awsClient) {
    _awsClient = new AwsClient({ accessKeyId: keyId, secretAccessKey: appKey, region: "auto", service: "s3" });
  }
  return _awsClient;
}

async function uploadToR2(key: string, body: Uint8Array, contentType: string): Promise<string> {
  const aws = getAwsClient();
  if (!aws) throw new Error("R2 não configurado (R2_KEY_ID / R2_APP_KEY ausentes)");
  const uploadUrl = `${_R2_ENDPOINT}/${_R2_BUCKET}/${key}`;
  const res = await aws.fetch(uploadUrl, { method: "PUT", body, headers: { "Content-Type": contentType } });
  if (!res.ok) throw new Error(`R2 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return `${_R2_PUBLIC_URL}/${key}`;
}

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
  const GLOBAL_URL = Deno.env.get("EVOLUTION_GLOBAL_URL") ?? "https://evolutionapi-evolution-api.kwjuno.easypanel.host";
  const GLOBAL_KEY = Deno.env.get("EVOLUTION_GLOBAL_KEY") ?? "";

  try {
    const reqUrl       = new URL(req.url);
    const rawToken     = reqUrl.searchParams.get("token") || "";
    const tokenFromUrl = rawToken.split("/")[0].trim();
    const body         = await req.json();

    const event = body.event || body.eventString || body.Event || "";
    const data  = body.data  || body.Data  || body;

    // Saída rápida para eventos de alta frequência que não precisam consultar o banco
    const SKIP_EVENTS = [
      "CHATS_UPSERT", "CHATS_SET", "CHATS_DELETE",
      "contacts.update", "CONTACTS_UPDATE", "CONTACTS_SET",
      "labels.edit", "LABELS_EDIT", "labels.association", "LABELS_ASSOCIATION",
    ];
    if (SKIP_EVENTS.includes(event)) return new Response("OK");

    // ── CHATS_UPDATE: usuário leu conversa no celular → unreadCount cai a 0 ───
    if (["chats.update", "CHATS_UPDATE"].includes(event)) {
      const chats = Array.isArray(data) ? data : [data];

      // Log de debug para confirmar que o evento está chegando (remover depois de verificado)
      await logWA(supabase, {
        tipo: "webhook_recebido", nivel: "info", origem: "evolution-webhook",
        evento: "chats.update-debug",
        resumo: `chats.update: ${chats.length} items`,
        payload: { count: chats.length, sample: chats.slice(0,2).map((c: Record<string,unknown>) => ({ keys: Object.keys(c||{}), id: c?.id || c?.remoteJid, uc: c?.unreadCount ?? c?.UnreadCount })) },
      });

      // Filtra chats que devem ter o badge zerado:
      // - Descarta se unreadCount for explicitamente > 0 (nova mensagem ainda não lida)
      // - Grupos: zera otimisticamente quando uc ≤ 0 OU quando o campo está ausente
      //   (Evolution API v2 frequentemente omite unreadCount:0 no evento de leitura de grupo)
      // - Individuais: zera somente quando uc é explicitamente ≤ 0
      const chatsToProcess = chats.filter((c: Record<string, unknown>) => {
        const jid = String(c?.id || c?.remoteJid || "");
        if (!jid || jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) return false;
        const uc = c?.unreadCount ?? c?.UnreadCount;
        const ucPresent = uc !== undefined && uc !== null;
        if (ucPresent && Number(uc) > 0) return false;          // positivo → nova msg → ignora
        const isGroup = jid.endsWith("@g.us");
        if (!isGroup && !ucPresent) return false;               // individual sem campo → ignora
        return true;
      });

      if (chatsToProcess.length === 0) return new Response("OK");

      // Resolve empresa_id (4 passos: empresa_instancias → empresas, por token e por nome)
      const _tok = tokenFromUrl || body.apikey || body.instance?.apikey || body.instance?.token || "";
      const _nm  = body.instance?.instanceName || body.instance?.name || body.instanceName || "";
      const _cacheKeyChats = _tok || _nm;
      const _cachedChats = _cacheKeyChats ? _instanceCache.get(_cacheKeyChats) : null;
      let _eid: string | null = null;

      if (_cachedChats && (Date.now() - _cachedChats.ts) < _CACHE_TTL) {
        _eid = _cachedChats.empresa_id;
      } else {
        if (_tok) {
          const { data: i1 } = await supabase.from("empresa_instancias").select("empresa_id").eq("evolution_instance_token", _tok).maybeSingle();
          if (i1) _eid = i1.empresa_id;
        }
        if (!_eid && _nm) {
          const { data: i2 } = await supabase.from("empresa_instancias").select("empresa_id").eq("evolution_instance_id", _nm).maybeSingle();
          if (i2) _eid = i2.empresa_id;
        }
        if (!_eid && _tok) {
          const { data: e1 } = await supabase.from("empresas").select("id").eq("evolution_instance_token", _tok).maybeSingle();
          if (e1) _eid = e1.id;
        }
        if (!_eid && _nm) {
          const { data: e2 } = await supabase.from("empresas").select("id").eq("evolution_instance_id", _nm).maybeSingle();
          if (e2) _eid = e2.id;
        }
        if (_eid && _cacheKeyChats) {
          _instanceCache.set(_cacheKeyChats, { empresa_id: _eid, instanciaId: null, instanciaEhPrincipal: true, ts: Date.now() });
        }
      }

      if (_eid) {
        for (const chat of chatsToProcess) {
          try {
            const jid = (chat?.id || chat?.remoteJid || "") as string;
            if (!jid) continue;
            const isGroup = jid.endsWith("@g.us");
            const phone   = isGroup
              ? jid
              : jid.replace(/@s\.whatsapp\.net$/, "").replace(/@c\.us$/, "").replace(/:.*$/, "");
            if (!phone) continue;

            const { data: updated1, error: upErr } = await supabase.from("conversas")
              .update({ nao_lidas: 0 })
              .eq("empresa_id", _eid)
              .eq("contato_telefone", phone)
              .gt("nao_lidas", 0)
              .select("id");
            const c1 = updated1?.length ?? 0;
            await logWA(supabase, {
              empresa_id: _eid, tipo: "webhook_recebido", nivel: c1 ? "info" : "warn",
              origem: "evolution-webhook", evento: "chats.update-zerou",
              resumo: c1 ? `Zerou ${c1} conversa(s) para ${phone}` : `Sem match para ${phone}`,
              payload: { phone, jid, isGroup, count: c1, err: upErr?.message },
            });

            // Fallback contato_lid (conversas migradas @lid → telefone real)
            if ((!c1 || c1 === 0) && jid.endsWith("@lid")) {
              await supabase.from("conversas")
                .update({ nao_lidas: 0 })
                .eq("empresa_id", _eid)
                .eq("contato_lid", jid)
                .gt("nao_lidas", 0);
            }

            // Variações de prefixo para contatos individuais (com/sem 55, com/sem 9º dígito)
            if (!isGroup && (!c1 || c1 === 0) && !jid.endsWith("@lid")) {
              const variants: string[] = [];
              if (/^55\d{10,11}$/.test(phone)) variants.push(phone.slice(2));
              else if (/^\d{10,11}$/.test(phone)) variants.push("55" + phone);
              if (/^\d{11}$/.test(phone) && phone[2] === "9") variants.push(phone.slice(0, 2) + phone.slice(3));
              if (/^55\d{11}$/.test(phone) && phone[4] === "9") variants.push("55" + phone.slice(2, 4) + phone.slice(5));
              for (const v of variants) {
                const { data: updV } = await supabase.from("conversas")
                  .update({ nao_lidas: 0 })
                  .eq("empresa_id", _eid)
                  .eq("contato_telefone", v)
                  .gt("nao_lidas", 0)
                  .select("id");
                if (updV && updV.length > 0) break;
              }
            }
          } catch (_) {}
        }
      }
      return new Response("OK");
    }

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

    // ── ACK / STATUS UPDATE (leitura no celular, tique azul) ─────────────────
    // message.ack / READ_RECEIPT = contato leu nossa mensagem (tique azul) OU nós lemos no celular
    // messages.update / MESSAGES_UPDATE = atualização de status de mensagem existente
    if (["messages.update", "MESSAGES_UPDATE", "message.ack", "READ_RECEIPT"].includes(event)) {
      // Resolve empresa via 4 passos (igual ao handler principal — inclui empresa_instancias)
      const _tok = tokenFromUrl || body.apikey || body.instance?.apikey || body.instance?.token || "";
      const _nm  = body.instance?.instanceName || body.instance?.name || body.instanceName || "";
      const _ackCacheKey = _tok || _nm;
      const _ackCached = _ackCacheKey ? _instanceCache.get(_ackCacheKey) : null;
      let _eid: string | null = null;
      if (_ackCached && (Date.now() - _ackCached.ts) < _CACHE_TTL) {
        _eid = _ackCached.empresa_id;
      } else {
        if (_tok) {
          const { data: _i1 } = await supabase.from("empresa_instancias").select("empresa_id").eq("evolution_instance_token", _tok).maybeSingle();
          if (_i1) _eid = _i1.empresa_id;
        }
        if (!_eid && _nm) {
          const { data: _i2 } = await supabase.from("empresa_instancias").select("empresa_id").eq("evolution_instance_id", _nm).maybeSingle();
          if (_i2) _eid = _i2.empresa_id;
        }
        if (!_eid && _tok) {
          const { data: _ec } = await supabase.from("empresas").select("id").eq("evolution_instance_token", _tok).maybeSingle();
          if (_ec) _eid = _ec.id;
        }
        if (!_eid && _nm) {
          const { data: _ec } = await supabase.from("empresas").select("id").eq("evolution_instance_id", _nm).maybeSingle();
          if (_ec) _eid = _ec.id;
        }
        if (_eid && _ackCacheKey) {
          _instanceCache.set(_ackCacheKey, { empresa_id: _eid, instanciaId: null, instanciaEhPrincipal: true, ts: Date.now() });
        }
      }
      if (_eid) {
        const updates = Array.isArray(data) ? data : [data];
        // Debug: log eventos messages.update para grupos (ajuda diagnóstico de badge)
        const groupUpdates = updates.filter((u: Record<string,unknown>) => {
          const jid = String((u?.key as Record<string,unknown>)?.remoteJid || u?.remoteJid || "");
          return jid.endsWith("@g.us");
        });
        if (groupUpdates.length > 0) {
          await logWA(supabase, {
            empresa_id: _eid, tipo: "webhook_recebido", nivel: "info",
            origem: "evolution-webhook", evento: "messages.update-group-debug",
            resumo: `messages.update para ${groupUpdates.length} mensagem(ns) de grupo`,
            payload: { count: groupUpdates.length, sample: groupUpdates.slice(0,3).map((u: Record<string,unknown>) => ({
              keys: Object.keys(u||{}), remoteJid: (u?.key as Record<string,unknown>)?.remoteJid || u?.remoteJid,
              fromMe: (u?.key as Record<string,unknown>)?.fromMe, ack: u?.ack, status: (u as Record<string,unknown>)?.update,
            })) },
          });
        }
        for (const upd of updates) {
          try {
            const key_     = (upd?.key || {}) as Record<string, unknown>;
            const remoteJid = (key_?.remoteJid || upd?.remoteJid || "") as string;
            if (!remoteJid || remoteJid.endsWith("@broadcast") || remoteJid.endsWith("@newsletter")) continue;
            const fromMe   = Boolean(key_?.fromMe ?? upd?.fromMe ?? false);
            // ack numérico (Baileys): 4=READ, 5=PLAYED
            const ackNum   = Number(upd?.ack ?? upd?.update?.ack ?? -1);
            const statusStr = String(upd?.update?.status || upd?.status || "").toUpperCase();
            const isRead   = statusStr === "READ" || statusStr === "PLAYED" || ackNum >= 4;
            if (!isRead) continue;

            const phone = remoteJid.endsWith("@g.us")
              ? remoteJid
              : remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/@c\.us$/, "").replace(/:.*$/, "");
            const wamid = (key_?.id || upd?.id || "") as string;

            if (fromMe) {
              // Contato leu nossa mensagem → marca como "lido" (tique azul) no banco
              if (wamid) {
                await supabase.from("mensagens")
                  .update({ status: "lido" })
                  .eq("empresa_id", _eid)
                  .eq("wamid", wamid);
              }
            } else {
              // Nós lemos a mensagem do contato no celular → zera badge no sistema
              const isGroup = remoteJid.endsWith("@g.us");
              const { data: ackUpd, error: ackErr } = await supabase.from("conversas")
                .update({ nao_lidas: 0 })
                .eq("empresa_id", _eid)
                .eq("contato_telefone", phone)
                .gt("nao_lidas", 0)
                .select("id");
              const ackC1 = ackUpd?.length ?? 0;
              await logWA(supabase, {
                empresa_id: _eid, tipo: "webhook_recebido",
                nivel: ackC1 ? "info" : "warn",
                origem: "evolution-webhook", evento: "messages.update-lido",
                resumo: ackC1 ? `Zerou badge via messages.update para ${phone}` : `messages.update sem match para ${phone}`,
                payload: { phone, isGroup, fromMe, ackNum, statusStr, wamid, count: ackC1, err: ackErr?.message },
              });
              // Fallback por contato_lid (conversas migradas LID → telefone)
              if ((!ackC1 || ackC1 === 0) && remoteJid.endsWith("@lid")) {
                await supabase.from("conversas")
                  .update({ nao_lidas: 0 })
                  .eq("empresa_id", _eid)
                  .eq("contato_lid", remoteJid)
                  .gt("nao_lidas", 0);
              }
            }
          } catch (_) {}
        }
      }
      return new Response("OK");
    }

    console.log("[webhook] event:", event, "| keys:", Object.keys(body).join(","));

    const instanceToken = tokenFromUrl || body.apikey || body.instance?.apikey || body.instance?.token || "";
    const instanceName  = body.instance?.instanceName || body.instance?.name || body.instanceName || "";
    const instanceId    = body.instance?.id || body.instanceId || "";

    let empresa_id: string | null = null;
    let instanciaId: string | null = null;       // id em empresa_instancias (null = instância principal via empresas)
    let instanciaEhPrincipal = true;             // false = número secundário (escuta apenas, sem bot/round-robin)

    // Cache lookup — evita 4-5 queries PostgREST por webhook para instâncias já conhecidas
    const _cacheKey = instanceToken || instanceName || instanceId;
    const _cached = _cacheKey ? _instanceCache.get(_cacheKey) : null;
    if (_cached && (Date.now() - _cached.ts) < _CACHE_TTL) {
      empresa_id = _cached.empresa_id;
      instanciaId = _cached.instanciaId;
      instanciaEhPrincipal = _cached.instanciaEhPrincipal;
    } else {
      // 1. Tenta empresa_instancias primeiro (números secundários dos vendedores)
      if (instanceToken) {
        const { data: inst } = await supabase.from("empresa_instancias")
          .select("id, empresa_id, eh_principal")
          .eq("evolution_instance_token", instanceToken).maybeSingle();
        if (inst) { empresa_id = inst.empresa_id; instanciaId = inst.id; instanciaEhPrincipal = inst.eh_principal; }
      }
      if (!empresa_id && instanceName) {
        const { data: inst } = await supabase.from("empresa_instancias")
          .select("id, empresa_id, eh_principal")
          .eq("evolution_instance_id", instanceName).maybeSingle();
        if (inst) { empresa_id = inst.empresa_id; instanciaId = inst.id; instanciaEhPrincipal = inst.eh_principal; }
      }

      // 2. Fallback: instância principal via tabela empresas
      if (!empresa_id && instanceToken) {
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

      // Armazena no cache para próximos webhooks desta instância
      if (empresa_id && _cacheKey) {
        _instanceCache.set(_cacheKey, { empresa_id, instanciaId, instanciaEhPrincipal, ts: Date.now() });
      }
    }

    if (!empresa_id) {
      // Retorna 200 para não disparar retry loop na Evolution API
      return new Response("OK", { status: 200 });
    }

    const now = new Date().toISOString();

    // CONTACTS_UPSERT — mapeia LID → telefone real e atualiza nomes da agenda
    if (["contacts.upsert", "CONTACTS_UPSERT"].includes(event)) {
      const contacts = Array.isArray(data) ? data : (data?.contacts ? data.contacts : [data]);
      for (const contact of contacts) {
        try {
          const rawJid   = (contact?.id || contact?.jid || "") as string;
          const phoneJid = (contact?.remoteJid || contact?.phone || contact?.number || "") as string;
          const savedName = (contact?.name || contact?.verifiedName || contact?.notify || contact?.pushName || "") as string;

          if (rawJid.includes("@lid")) {
            // ── LID → telefone: só processa se Evolution confirmar o JID real com @s.whatsapp.net
            if (!phoneJid.includes("@s.whatsapp.net") && !phoneJid.includes("@c.us")) continue;
            const phoneNum = phoneJid.replace(/@s\.whatsapp\.net$/, "").replace(/@c\.us$/, "").replace(/:.*$/, "");
            if (!phoneNum || phoneNum.length < 8 || phoneNum.includes("@")) continue;

            const { data: lidConv } = await supabase.from("conversas")
              .select("id, contato_nome").eq("empresa_id", empresa_id).eq("contato_telefone", rawJid).maybeSingle();
            if (!lidConv) continue;

            const { data: existPhone } = await supabase.from("conversas")
              .select("id, contato_nome").eq("empresa_id", empresa_id).eq("contato_telefone", phoneNum).maybeSingle();

            if (!existPhone) {
              // Renomeia JID LID → número real na conversa existente
              // e guarda o LID em contato_lid para futuras leituras via chats.update
              const updates: Record<string, string> = { contato_telefone: phoneNum, contato_lid: rawJid };
              if (savedName && !lidConv.contato_nome) updates.contato_nome = savedName;
              await supabase.from("conversas").update(updates).eq("id", lidConv.id);
            } else if (existPhone.id !== lidConv.id) {
              // Ambas existem: migra mensagens do LID para a conversa telefone
              await supabase.from("mensagens").update({ conversa_id: existPhone.id }).eq("conversa_id", lidConv.id);
              // Preserva nome do contato salvo e registra LID na conversa destino
              const nomeFinal = savedName || lidConv.contato_nome || existPhone.contato_nome;
              const phoneConvUpdates: Record<string, string> = { contato_lid: rawJid };
              if (nomeFinal) phoneConvUpdates.contato_nome = nomeFinal;
              await supabase.from("conversas").update(phoneConvUpdates).eq("id", existPhone.id);
              // Marca a conversa LID como mesclada (sem deletar — evita perda de dados)
              await supabase.from("conversas").update({ contato_telefone: phoneNum + "_lid_merged", status: "resolvida" }).eq("id", lidConv.id);
              await logWA(supabase, {
                empresa_id, tipo: "fluxo", nivel: "info", origem: "evolution-webhook", evento: event,
                resumo: `Conversa LID ${rawJid} mesclada em ${phoneNum}`,
                payload: { lidConvId: lidConv.id, phoneConvId: existPhone.id, phoneNum },
              });
            } else {
              // Mesma conversa: só atualiza o LID se ainda não estiver registrado
              await supabase.from("conversas").update({ contato_lid: rawJid }).eq("id", existPhone.id)
                .is("contato_lid", null);
            }

          } else {
            // ── Contato normal (não LID): atualiza nome da agenda se salvo
            if (!savedName) continue;
            const phone = rawJid.replace(/@s\.whatsapp\.net$/, "").replace(/@c\.us$/, "").replace(/:.*$/, "");
            if (!phone || phone.length < 8 || phone.includes("@")) continue;
            await supabase.from("conversas")
              .update({ contato_nome: savedName })
              .eq("empresa_id", empresa_id)
              .eq("contato_telefone", phone)
              .neq("contato_nome", savedName);
          }
        } catch (_) { /* nunca propaga */ }
      }
      return new Response("OK");
    }

    // ── QR CODE ─────────────────────────────────────────────────────────────
    if (["QRCODE","QRCODE_UPDATED","qrcode.updated"].includes(event)) {
      const qr = data?.qrcode?.base64 || data?.base64 || data?.Qrcode || (typeof data?.qrcode === "string" ? data.qrcode : "");
      if (qr) {
        if (instanciaId) {
          await supabase.from("empresa_instancias").update({ evolution_qr_temp: qr }).eq("id", instanciaId);
        } else {
          await supabase.from("empresas").update({ evolution_qr_temp: qr }).eq("id", empresa_id);
        }
      }
      return new Response("OK");
    }

    // ── CONEXÃO ─────────────────────────────────────────────────────────────
    if (["CONNECTION","CONNECTION_UPDATE","Connected","Disconnected","connection.update"].includes(event)) {
      const state = data?.state || data?.instance?.state ||
        (event === "Connected" ? "open" : event === "Disconnected" ? "close" : "");
      if (state === "open" || event === "Connected") {
        const jid   = data?.jid || data?.instance?.jid || "";
        const phone = jid.replace(/@s\.whatsapp\.net$/, "").replace(/:.*$/, "");
        if (instanciaId) {
          await supabase.from("empresa_instancias").update({ evolution_connected: true, evolution_phone: phone || "", evolution_qr_temp: null }).eq("id", instanciaId);
        } else {
          await supabase.from("empresas").update({ evolution_connected: true, evolution_phone: phone || "", evolution_qr_temp: null }).eq("id", empresa_id);
        }
        await logWA(supabase, {
          empresa_id, tipo: "conexao", nivel: "info", origem: "evolution-webhook", evento: event,
          resumo: `WhatsApp conectado${instanciaId ? " (número secundário)" : ""}${phone ? ` — ${phone}` : ""}`,
          payload: { state, phone, instanciaId },
        });
      } else if (state === "close" || state === "connecting" || event === "Disconnected") {
        if (instanciaId) {
          await supabase.from("empresa_instancias").update({ evolution_connected: false }).eq("id", instanciaId);
        } else {
          await supabase.from("empresas").update({ evolution_connected: false }).eq("id", empresa_id);
        }
        await logWA(supabase, {
          empresa_id, tipo: "conexao", nivel: "warn", origem: "evolution-webhook", evento: event,
          resumo: `WhatsApp desconectado${instanciaId ? " (número secundário)" : ""} (${state || event})`,
          payload: { state, instanciaId },
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
      // Números secundários não importam histórico — só a instância principal sincroniza
      if (!instanciaEhPrincipal) return new Response("OK");
      const allMsgs: unknown[] = [];
      if (Array.isArray(data?.messages)) allMsgs.push(...data.messages);
      if (Array.isArray(data?.conversations)) {
        for (const conv of data.conversations) {
          if (Array.isArray(conv?.messages)) allMsgs.push(...conv.messages);
        }
      }
      if (allMsgs.length > 0) await processMessages(allMsgs, empresa_id, supabase, GLOBAL_URL, GLOBAL_KEY, now, true, instanciaEhPrincipal, instanciaId);
      return new Response("OK");
    }

    // ── MENSAGEM ─────────────────────────────────────────────────────────────
    if (["MESSAGE","MESSAGES_UPSERT","Message","messages.upsert"].includes(event)) {
      await logWA(supabase, {
        empresa_id, tipo: "webhook_recebido", nivel: "info", origem: "evolution-webhook", evento: event,
        resumo: `Webhook de mensagem recebido (${event})`,
      });
      const msgs = Array.isArray(data) ? data : [data];
      await processMessages(msgs, empresa_id, supabase, GLOBAL_URL, GLOBAL_KEY, now, false, instanciaEhPrincipal, instanciaId);

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

// Returns true only when a visual flow has "opcoes" nodes whose connections lead to
// "transferir" nodes with transferir_tipo === "setor".
// Only in this case should round-robin be skipped — all other flow configurations
// (menus for data collection, branching, etc.) allow normal automatic lead distribution.
function fluxoTemMenuParaSetor(nos: FluxoNo[], conexoes: FluxoConexao[]): boolean {
  const opcoesIds = new Set(nos.filter(n => n.tipo === "opcoes").map(n => n.id));
  if (opcoesIds.size === 0) return false;
  const setorTransferIds = new Set(
    nos.filter(n => n.tipo === "transferir" && n.transferir_tipo === "setor").map(n => n.id)
  );
  if (setorTransferIds.size === 0) return false;
  // Direct path: opcoes → transferir(setor)
  if (conexoes.some(c => opcoesIds.has(c.de) && setorTransferIds.has(c.para))) return true;
  // One hop via condicao: opcoes → condicao → transferir(setor)
  const condicaoIds = new Set(nos.filter(n => n.tipo === "condicao").map(n => n.id));
  return conexoes.some(c => {
    if (!opcoesIds.has(c.de) || !condicaoIds.has(c.para)) return false;
    return conexoes.some(c2 => c2.de === c.para && setorTransferIds.has(c2.para));
  });
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
    .select("nos, conexoes, ativo, usuario_id").eq("id", fluxoId).single();
  if (!fluxoData?.ativo) return false;

  // Per-seller flows (usuario_id set) must only run for the exact seller they were created for.
  // If this flow belongs to a specific seller but the conversation is assigned to someone else
  // (or unassigned), skip it entirely — prevents seller A's flow from greeting seller B's leads.
  const fluxoVendedorId = fluxoData.usuario_id as string | null;
  if (fluxoVendedorId) {
    const convAtendenteId = conv.atendente_id as string | null;
    if (convAtendenteId !== fluxoVendedorId) return false;
  }

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
          console.log(`[fluxo] aguardar: variavel "${noAtual.variavel}" = "${texto.slice(0, 60)}"`);
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
  GLOBAL_URL: string, GLOBAL_KEY: string, now: string, isHistory: boolean,
  instanciaEhPrincipal = true, instanciaId: string | null = null
) {
  // Load chatbot_config once per batch to get setor_padrao_id for auto-assignment
  let cfgEarly: Record<string, unknown> | null = null;
  // true only when an active flow (company or seller) routes via menu → sector.
  // Only in this case is round-robin skipped; all other flow configurations allow
  // normal automatic lead distribution by seller.
  let roundRobinBloqueadoPorFluxo = false;
  if (!isHistory) {
    const [{ data: cfgData }, { data: fluxosAtivos }] = await Promise.all([
      supabase.from("chatbot_config").select("*").eq("empresa_id", empresa_id).maybeSingle(),
      supabase.from("chatbot_fluxos").select("nos, conexoes").eq("empresa_id", empresa_id).eq("ativo", true),
    ]);
    cfgEarly = cfgData ?? null;
    roundRobinBloqueadoPorFluxo = (fluxosAtivos || []).some(f =>
      fluxoTemMenuParaSetor((f.nos || []) as FluxoNo[], (f.conexoes || []) as FluxoConexao[])
    );
  }

  for (const msg of msgs) {
    if (!msg || typeof msg !== "object") continue;
    const m = msg as Record<string, unknown>;

    const info = (m.Info || m.info || {}) as Record<string, unknown>;
    const key  = (m.key  || m.Key  || {}) as Record<string, unknown>;
    const fromMe = Boolean(info.IsFromMe ?? key.fromMe ?? false);

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

    // Extrai mimetype e base64 do payload (Evolution API envia quando base64:true está configurado)
    const mediaObjMap: Record<string, Record<string,unknown>> = {
      audio: audioC, imagem: imgC, video: vidC, documento: docC,
    };
    const mediaObj = mediaObjMap[tipoMsg] ?? {};
    const mediaMimetype = (mediaObj.mimetype as string) || null;
    // Evolution API pode colocar base64 em diferentes campos dependendo da versão:
    // - m.base64 (nível do payload de dados)
    // - mediaObj.base64 (dentro de audioMessage/imageMessage/etc)
    // - msgContent.base64 (dentro de message)
    // - m.media?.base64 (campo media separado)
    const _mMedia = (m.media || {}) as Record<string,unknown>;
    const rawB64Payload = (m.base64 as string)
      || (mediaObj.base64 as string)
      || (msgContent.base64 as string)
      || (_mMedia.base64 as string)
      || null;
    const mediaBase64 = rawB64Payload?.startsWith("data:")
      ? (rawB64Payload.indexOf(",") >= 0 ? rawB64Payload.slice(rawB64Payload.indexOf(",") + 1) : null)
      : rawB64Payload;

    console.log(`[webhook] ${isHistory?"HIST":"MSG"} from:${senderPhone} fromMe:${fromMe} ts:${hora} tipo:${tipoMsg} text:${texto.slice(0,60)}`);
    if (["imagem","video","audio","documento"].includes(tipoMsg)) {
      console.log(`[webhook] media mKeys:${Object.keys(m).join(",")} | msgKeys:${Object.keys(msgContent).join(",")} | mediaObjKeys:${Object.keys(mediaObj).join(",")} | b64payload:${rawB64Payload ? rawB64Payload.slice(0,50) : "null"} | mime:${mediaMimetype}`);
    }

    // ── Busca ou cria conversa ────────────────────────────────────────────────
    let isNew = false;
    let { data: conv } = await supabase.from("conversas")
      .select("id, nao_lidas, contato_nome, status, bot_ativo, ultima_hora, fluxo_estado, atendente_id")
      .eq("empresa_id", empresa_id).eq("contato_telefone", senderPhone).maybeSingle();

    if (!conv) {
      isNew = true;

      const { data: nova, error: insertConvErr } = await supabase.from("conversas").insert({
        empresa_id, contato_nome: isGroup ? "Grupo" : senderName, contato_telefone: senderPhone,
        ultima_mensagem: texto, ultima_hora: hora,
        nao_lidas: fromMe ? 0 : 1, status: "aberta", bot_ativo: null,
        whatsapp_numero: senderPhone, fluxo_estado: null,
        // setor_padrao só se houver fluxo visual ativo (ele roteará o setor); senão, round-robin assume
        ...(cfgEarly?.setor_padrao_id && cfgEarly?.fluxo_ativo_id ? { setor_id: cfgEarly.setor_padrao_id } : {}),
      }).select("id, nao_lidas, contato_nome, status, bot_ativo, ultima_hora, fluxo_estado, atendente_id").single();

      if (insertConvErr?.code === "23505") {
        // Race condition: another concurrent webhook already created this conversation
        isNew = false;
        const { data: existing } = await supabase.from("conversas")
          .select("id, nao_lidas, contato_nome, status, bot_ativo, ultima_hora, fluxo_estado, atendente_id")
          .eq("empresa_id", empresa_id).eq("contato_telefone", senderPhone).maybeSingle();
        conv = existing;
      } else {
        conv = nova;

        await logWA(supabase, {
          empresa_id, conversa_id: nova?.id, tipo: "conversa_criada", nivel: "info",
          origem: "evolution-webhook", telefone: senderPhone,
          resumo: `Nova conversa criada: ${senderName} (${senderPhone})`,
          payload: { nome: senderName, isGroup },
        });
      }

      if (isNew) {
      const { data: leadExist } = await supabase.from("leads")
        .select("id").eq("empresa_id", empresa_id).eq("whatsapp", senderPhone).maybeSingle();
      if (!leadExist) {
        await supabase.from("leads").insert({
          empresa_id, nome: senderName, whatsapp: senderPhone,
          origem: "WhatsApp", status: "novo", score: 20, ultima_atividade: hora,
        });
      }

      // ── Round-robin: distribui novo cliente para o próximo vendedor ──────────
      // Só é bloqueado quando algum fluxo ativo tem menu de opções levando a setores;
      // qualquer outra configuração de fluxo visual permite distribuição normal por vendedor.
      // Números secundários (instanciaEhPrincipal=false) não acionam round-robin.
      if (!fromMe && conv?.id && !roundRobinBloqueadoPorFluxo && instanciaEhPrincipal) {
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

              // Reflect assigned seller in memory so per-seller flow lookup sees it below
              conv = { ...conv, atendente_id: assignedSeller.id };
              console.log(`[round-robin] Conversa ${conv.id} → ${assignedSeller.nome} (idx ${idx}) setor:${setorVendas?.id ?? "nenhum"}`);
            }
          }
        } catch (rrErr) {
          console.error("[round-robin] erro:", (rrErr as Error).message);
        }
      }
      } // end if (isNew)

      // Instância secundária: atribui conversa ao vendedor dono da instância
      if (!instanciaEhPrincipal && instanciaId && !fromMe && conv?.id &&
          !(conv as Record<string, unknown>).atendente_id) {
        try {
          const { data: instInfo } = await supabase.from("empresa_instancias")
            .select("nome").eq("id", instanciaId).maybeSingle();
          if (instInfo?.nome) {
            const { data: vendedor } = await supabase.from("usuarios")
              .select("id").eq("empresa_id", empresa_id)
              .ilike("nome", `%${instInfo.nome}%`).eq("ativo", true).maybeSingle();
            if (vendedor?.id) {
              await supabase.from("conversas").update({ atendente_id: vendedor.id }).eq("id", conv.id);
              conv = { ...conv, atendente_id: vendedor.id };
              console.log(`[inst-secundaria] conversa ${conv.id} atribuída ao vendedor ${vendedor.id} (${instInfo.nome})`);
            }
          }
        } catch (_) {}
      }

    } else if (!fromMe && !isHistory) {
      const reopenFields: Record<string, unknown> = {
        ultima_mensagem: texto, ultima_hora: hora,
        nao_lidas: (conv.nao_lidas || 0) + 1,
        contato_nome: isGroup ? conv.contato_nome : (senderName || conv.contato_nome),
      };
      // Reabre conversa resolvida automaticamente quando cliente envia nova mensagem
      const wasResolvida = conv.status === "resolvida";
      if (wasResolvida) {
        reopenFields.status = "aberta";
        reopenFields.atendente_id = null;
        reopenFields.fluxo_estado = null;
        reopenFields.bot_ativo = null;
        // Sync in-memory conv so the chatbot block below sees the cleared state
        conv = { ...conv, fluxo_estado: null, bot_ativo: null, status: "aberta", atendente_id: null };
        // setor_padrao só se houver fluxo visual ativo; senão round-robin assume o roteamento
        if (cfgEarly?.setor_padrao_id && cfgEarly?.fluxo_ativo_id) reopenFields.setor_id = cfgEarly.setor_padrao_id;
      }
      await supabase.from("conversas").update(reopenFields).eq("id", conv.id);

      // Instância secundária (celular de vendedor): atribui ao dono da instância se sem atendente
      if (!instanciaEhPrincipal && instanciaId && !(conv as Record<string, unknown>).atendente_id) {
        try {
          const { data: instInfo } = await supabase.from("empresa_instancias")
            .select("nome").eq("id", instanciaId).maybeSingle();
          if (instInfo?.nome) {
            const { data: vendedor } = await supabase.from("usuarios")
              .select("id").eq("empresa_id", empresa_id)
              .ilike("nome", `%${instInfo.nome}%`).eq("ativo", true).maybeSingle();
            if (vendedor?.id) {
              reopenFields.atendente_id = vendedor.id;
              conv = { ...conv, atendente_id: vendedor.id };
            }
          }
        } catch (_) {}
      }

      // Round-robin para conversas sem atendente — só bloqueado quando fluxo tem menu → setor
      // Números secundários (instanciaEhPrincipal=false) não acionam round-robin.
      let precisaAtribuir = instanciaEhPrincipal && !roundRobinBloqueadoPorFluxo &&
        (wasResolvida || !(conv as Record<string, unknown>).atendente_id);
      // Também atribui se o atendente atual foi excluído/desativado
      if (!precisaAtribuir && !roundRobinBloqueadoPorFluxo && conv.atendente_id) {
        const { data: atendenteOk } = await supabase.from("usuarios")
          .select("id").eq("id", String(conv.atendente_id)).eq("ativo", true).maybeSingle();
        if (!atendenteOk) {
          precisaAtribuir = true;
          console.log(`[round-robin] atendente ${conv.atendente_id} não encontrado/inativo → forçando atribuição`);
        }
      }
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
              // Reflect assigned seller in memory so per-seller flow lookup sees it below
              conv = { ...conv, atendente_id: assignedSeller.id };
              console.log(`[round-robin] Re-open: conversa ${conv.id} → ${assignedSeller.nome} setor:${setorVendas?.id ?? "nenhum"}`);
            }
          }
        } catch (rrErr) {
          console.error("[round-robin] re-open erro:", (rrErr as Error).message);
        }
      }
    } else if (fromMe && !isHistory && conv?.id) {
      // Mensagem enviada (celular ou sistema) em conversa existente → atualiza última mensagem
      await supabase.from("conversas").update({
        ultima_mensagem: texto,
        ultima_hora: hora,
      }).eq("id", conv.id);
    }

    if (!conv?.id) continue;

    // ── Re-hospedar mídia recebida no Cloudflare R2 ─────────────────────────
    let storedMediaUrl = mediaUrl;
    if (["imagem","video","audio","documento"].includes(tipoMsg)) {
      // Log de estrutura do payload para diagnóstico de onde o base64 está
      await logWA(supabase, {
        empresa_id, conversa_id: conv.id, tipo: "webhook_recebido", nivel: "info",
        origem: "evolution-webhook", evento: "media-struct-debug",
        resumo: `media payload struct tipo:${tipoMsg}`,
        payload: {
          mKeys: Object.keys(m).join(","),
          msgKeys: Object.keys(msgContent).join(","),
          mediaObjKeys: Object.keys(mediaObj).join(","),
          hasB64_m: !!m.base64,
          hasB64_mediaObj: !!mediaObj.base64,
          hasB64_msgContent: !!msgContent.base64,
          hasB64_media: !!_mMedia.base64,
          rawB64prefix: String(rawB64Payload || "").slice(0, 80),
          wamid,
        },
      });

      // Helper: strip data URL prefix e whitespace antes de atob
      const cleanB64 = (raw: string): string => {
        const stripped = raw.startsWith("data:")
          ? (raw.indexOf(",") >= 0 ? raw.slice(raw.indexOf(",") + 1) : raw)
          : raw;
        return stripped.replace(/\s/g, "");
      };

      let bytes: Uint8Array | null = null;
      let resolvedMime: string | null = mediaMimetype;
      let debugStep = "start";

      try {
        // 1ª opção: base64 do payload (Evolution API com base64:true)
        if (mediaBase64) {
          debugStep = "payload-b64";
          const b64clean = cleanB64(mediaBase64);
          try {
            bytes = Uint8Array.from(atob(b64clean), c => c.charCodeAt(0));
            debugStep = `payload-ok:${bytes.length}`;
            console.log(`[webhook] payload base64 ok: ${bytes.length} bytes mime:${mediaMimetype}`);
          } catch (ae) {
            debugStep = `payload-atob-err:${(ae as Error).message.slice(0,40)}`;
            console.log(`[webhook] payload atob err: ${(ae as Error).message} prefix:${b64clean.slice(0,30)}`);
          }
        }

        // 2ª opção: buscar mídia descriptografada direto na Evolution API server-side
        if (!bytes && wamid) {
          debugStep = "getBase64-start";
          try {
            let _mediaCred = _empCredCache.get(empresa_id);
            if (!_mediaCred || (Date.now() - _mediaCred.ts) > _CACHE_TTL) {
              const { data: empInfo } = await supabase.from("empresas")
                .select("evolution_instance_id, evolution_instance_token")
                .eq("id", empresa_id).maybeSingle();
              _mediaCred = { evolution_instance_id: empInfo?.evolution_instance_id ?? null, evolution_instance_token: empInfo?.evolution_instance_token ?? null, ts: Date.now() };
              _empCredCache.set(empresa_id, _mediaCred);
            }
            const evoInst  = _mediaCred.evolution_instance_id as string | null;
            const evoToken = (_mediaCred.evolution_instance_token as string | null) || GLOBAL_KEY;
            const evoBase  = GLOBAL_URL.replace(/\/$/, "");
            console.log(`[webhook] getBase64 inst:${evoInst} url:${evoBase} hasToken:${!!evoToken}`);
            if (evoInst && evoToken) {
              // Evolution API pode ter o endpoint em diferentes caminhos dependendo da versão.
              // Tenta /message/getBase64FromMediaMessage (v2 padrão), depois /chat/getBase64FromMediaMessage (v1/fork).
              const endpoints = [
                `${evoBase}/message/getBase64FromMediaMessage/${evoInst}`,
                `${evoBase}/chat/getBase64FromMediaMessage/${evoInst}`,
              ];
              // Tenta diferentes payloads — formato varia entre versões da Evolution API
              const payloads = [
                { id: wamid },
                { message: { key: { id: wamid } } },
              ];
              let fr: Response | null = null;
              outer:
              for (const ep of endpoints) {
                for (const payload of payloads) {
                  const r = await fetch(ep, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "apikey": evoToken },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(15000),
                  });
                  console.log(`[webhook] getBase64 ${ep} payload:${JSON.stringify(payload).slice(0,60)} → ${r.status}`);
                  if (r.ok) { fr = r; break outer; }
                  if (r.status !== 404 && r.status !== 400) { fr = r; break outer; }
                }
              }
              if (!fr) fr = new Response("{}", { status: 404 });
              debugStep = `getBase64-http:${fr.status}`;
              if (fr.ok) {
                const fd = await fr.json();
                const fdKeys = Object.keys(fd || {}).join(",");
                const rawB64 = (fd?.base64 ?? fd?.data?.base64 ?? fd?.media?.base64 ?? null) as string | null;
                const mt  = (fd?.mimetype ?? fd?.data?.mimetype ?? fd?.type ?? null) as string | null;
                console.log(`[webhook] getBase64 resp keys:${fdKeys} mime:${mt} b64len:${rawB64?.length ?? 0} b64prefix:${String(rawB64 ?? "").slice(0,50)}`);
                await logWA(supabase, {
                  empresa_id, conversa_id: conv.id, tipo: "webhook_recebido", nivel: "info",
                  origem: "evolution-webhook", evento: "getBase64-debug",
                  resumo: `getBase64 resp keys:${fdKeys} mime:${mt}`,
                  payload: { keys: fdKeys, mime: mt, b64len: rawB64?.length ?? 0, b64prefix: String(rawB64 ?? "").slice(0,80) },
                });
                if (rawB64) {
                  const b64clean = cleanB64(rawB64);
                  try {
                    bytes = Uint8Array.from(atob(b64clean), c => c.charCodeAt(0));
                    if (mt) resolvedMime = mt;
                    debugStep = `getBase64-ok:${bytes.length}`;
                    console.log(`[webhook] getBase64FromMediaMessage ok: ${mt} bytes:${bytes.length}`);
                  } catch (ae) {
                    debugStep = `getBase64-atob-err:${(ae as Error).message.slice(0,40)}`;
                    console.log(`[webhook] getBase64 atob err: ${(ae as Error).message} prefix:${b64clean.slice(0,30)}`);
                  }
                } else {
                  debugStep = `getBase64-no-b64:keys=${fdKeys}`;
                  console.log(`[webhook] getBase64 sem base64 no resp. keys=${fdKeys}`);
                }
              } else {
                const errTxt = await fr.text().catch(() => "");
                debugStep = `getBase64-http-err:${fr.status}`;
                console.log(`[webhook] getBase64FromMediaMessage failed: ${fr.status} ${errTxt.slice(0,150)}`);
                await logWA(supabase, {
                  empresa_id, conversa_id: conv.id, tipo: "erro_api", nivel: "error",
                  origem: "evolution-webhook", evento: "getBase64-failed",
                  resumo: `getBase64 HTTP ${fr.status}: ${errTxt.slice(0,100)}`,
                  payload: { status: fr.status, wamid, inst: evoInst },
                });
              }
            } else {
              debugStep = "getBase64-no-inst";
              console.log(`[webhook] sem inst/token para getBase64`);
            }
          } catch (fe) {
            debugStep = `getBase64-exc:${(fe as Error).message.slice(0,40)}`;
            console.log("[webhook] getBase64FromMediaMessage err:", (fe as Error).message);
          }
        }

        if (bytes) {
          const defaultMime: Record<string,string> = {
            imagem: "image/jpeg", audio: "audio/ogg", video: "video/mp4", documento: "application/pdf",
          };
          const ct = resolvedMime || defaultMime[tipoMsg] || "application/octet-stream";
          const extMap: Record<string,string> = {
            "image/jpeg":"jpg","image/jpg":"jpg","image/png":"png","image/gif":"gif","image/webp":"webp",
            "video/mp4":"mp4","video/quicktime":"mov","video/webm":"webm",
            "audio/ogg":"ogg","audio/mpeg":"mp3","audio/mp4":"m4a","audio/webm":"webm",
            "audio/opus":"ogg","audio/aac":"aac",
            "application/pdf":"pdf",
          };
          const ext = extMap[ct] ?? ct.split("/")[1]?.split(";")[0] ?? "bin";
          const key = `whatsapp/${empresa_id}/${conv.id}/${Date.now()}.${ext}`;
          storedMediaUrl = await uploadToR2(key, bytes, ct);
          console.log(`[webhook] R2 upload ok: ${key} (${ct})`);
        } else {
          console.log(`[webhook] sem bytes para R2, step:${debugStep} tipo:${tipoMsg} wamid:${wamid}`);
          await logWA(supabase, {
            empresa_id, conversa_id: conv.id, tipo: "webhook_recebido", nivel: "warn",
            origem: "evolution-webhook", evento: "r2-sem-bytes",
            resumo: `R2 upload sem bytes. step:${debugStep}`,
            payload: { debugStep, tipoMsg, wamid, mediaUrl: String(mediaUrl).slice(0,80) },
          });
        }
      } catch (e) {
        console.log("[webhook] media re-host R2 err:", (e as Error).message);
        await logWA(supabase, {
          empresa_id, conversa_id: conv.id, tipo: "erro_api", nivel: "error",
          origem: "evolution-webhook", evento: "r2-upload-err",
          resumo: `R2 upload err: ${(e as Error).message.slice(0,100)}`,
          payload: { debugStep, tipoMsg, wamid },
        });
      }
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
    // Números secundários (instanciaEhPrincipal=false) só recebem/armazenam mensagens;
    // bot e automações rodam apenas na instância principal.
    if (!instanciaEhPrincipal) continue;

    // Pre-check: look up a per-seller flow for conversations assigned to a seller.
    // This runs before the em_atendimento gate so seller flows can activate even
    // when a human agent is assigned (status = em_atendimento).
    // Always look up a per-seller flow regardless of bot_ativo — seller flows
    // bypass the global bot toggle because they are assigned to a specific agent.
    let vendedorFluxoId: string | null = null;
    // true when chatbot_config.fluxo_ativo_id points to a per-seller flow (has usuario_id set).
    // In that case the company-wide flow is suppressed; it runs only for the specific seller
    // it was created for — not for every incoming conversation.
    let suppressCompanyFlow = false;
    if (!fromMe && !isHistory) {
      const convAtendenteId = (conv as Record<string, unknown>).atendente_id as string | null;
      const cfgFluxoId = cfgEarly?.fluxo_ativo_id as string | null;

      const [sellerFlowRes, companyFlowMetaRes] = await Promise.all([
        convAtendenteId
          ? supabase.from("chatbot_fluxos").select("id").eq("empresa_id", empresa_id)
              .eq("usuario_id", convAtendenteId).eq("ativo", true).maybeSingle()
          : Promise.resolve({ data: null }),
        cfgFluxoId
          ? supabase.from("chatbot_fluxos").select("usuario_id").eq("id", cfgFluxoId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      vendedorFluxoId = (sellerFlowRes as { data: { id: string } | null }).data?.id ?? null;

      const companyFlowVendedorId = (companyFlowMetaRes as { data: { usuario_id: string | null } | null }).data?.usuario_id ?? null;
      if (companyFlowVendedorId) {
        // fluxo_ativo_id is a per-seller flow — suppress it as a company-wide flow
        suppressCompanyFlow = true;
        if (!vendedorFluxoId && convAtendenteId === companyFlowVendedorId) {
          // Conversation is assigned to exactly that seller — allow the flow
          vendedorFluxoId = cfgFluxoId;
        }
      }
    }

    const hasActiveFlowState = !!(conv.fluxo_estado as { fluxo_id?: string } | null)?.fluxo_id;
    // Allow chatbot block when bot is enabled OR when a per-seller flow is configured
    // (seller flows bypass bot_ativo=false since they are seller-managed automations).
    if (!fromMe && !isHistory && (conv.bot_ativo !== false || !!vendedorFluxoId) &&
        (conv.status !== "em_atendimento" || hasActiveFlowState || vendedorFluxoId)) {
      try {
        // Reutiliza cfgEarly (já carregado no início) — elimina 1 query por mensagem
        const cfg = cfgEarly;
        // Skip if chatbot is disabled AND there is no per-seller flow to run
        if (!cfg?.ativo && !vendedorFluxoId) continue;

        if (isGroup && !cfg?.responder_grupos) continue;
        // nao_responder_aberta only silences the bot for conversations with no active flow —
        // an ongoing flow must always continue even if status is "aberta"
        const hasActiveFlow = !!(conv.fluxo_estado as { fluxo_id?: string } | null)?.fluxo_id;
        // Per-seller flows must run even when nao_responder_aberta is set — the seller's
        // automation should not be silenced by a company-wide "don't reply to open chats" rule.
        if (cfg?.nao_responder_aberta && conv.status === "aberta" && !hasActiveFlow && !vendedorFluxoId) continue;

        let _empCred = _empCredCache.get(empresa_id);
        if (!_empCred || (Date.now() - _empCred.ts) > _CACHE_TTL) {
          const { data: empData } = await supabase.from("empresas")
            .select("evolution_instance_id, evolution_instance_token")
            .eq("id", empresa_id).single();
          _empCred = { evolution_instance_id: empData?.evolution_instance_id ?? null, evolution_instance_token: empData?.evolution_instance_token ?? null, ts: Date.now() };
          _empCredCache.set(empresa_id, _empCred);
        }
        const instId    = _empCred.evolution_instance_id;
        const instToken = _empCred.evolution_instance_token;
        const evoUrl    = GLOBAL_URL.replace(/\/$/, "");

        const sendBot = async (msgText: string, tipo = "texto", extra?: Record<string, unknown>) => {
          if (!instId || !instToken || !evoUrl) return;

          let apiOk = false;
          let apiErr = "";

          let apiRespWamid: string | null = null;

          if (["imagem","video","audio","documento"].includes(tipo)) {
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
            if (r.ok) {
              const rd = await r.json().catch(() => ({}));
              apiOk = true;
              apiRespWamid = rd?.key?.id || rd?.id || null;
            } else apiErr = await r.text().catch(() => String(r.status));
          } else {
            // Evolution API v2 — formato simples
            const r = await fetch(`${evoUrl}/message/sendText/${instId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": instToken },
              body: JSON.stringify({ number: senderPhone, text: msgText }),
            });
            if (r.ok) {
              const rd = await r.json().catch(() => ({}));
              apiOk = true;
              apiRespWamid = rd?.key?.id || rd?.id || null;
            } else {
              apiErr = await r.text().catch(() => String(r.status));
              // Fallback: formato com options/textMessage
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
                if (r2.ok) {
                  const rd2 = await r2.json().catch(() => ({}));
                  apiOk = true; apiErr = "";
                  apiRespWamid = rd2?.key?.id || rd2?.id || null;
                } else apiErr = await r2.text().catch(() => String(r2.status));
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

          // Salva a mensagem do bot com o wamid retornado pela API (quando disponível).
          // O wamid garante que o webhook de echo (fromMe=true) seja deduplicado pela
          // constraint mensagens_wamid_unique, evitando duplicatas na tela do chat.
          if (conv?.id && apiOk) {
            await supabase.from("mensagens").insert({
              conversa_id: conv.id, empresa_id, de: "me", texto: msgText,
              tipo: tipo, media_url: (extra?.url as string) || null, nome_arquivo: (extra?.fileName as string) || null,
              hora: new Date().toISOString(), status: "enviado", remetente: "bot",
              ...(apiRespWamid ? { wamid: apiRespWamid } : {}),
            });
            await supabase.from("conversas").update({
              ultima_mensagem: msgText, ultima_hora: new Date().toISOString(),
            }).eq("id", conv!.id);
          }
        };

        // Transfer word: only intercept when no visual flow is actively waiting for input.
        // If a flow is paused at an "aguardar" node, the user's message is their flow answer
        // and forcing a transfer here would permanently break the flow state.
        const transferWord = ((cfg?.transferir_palavra as string | null) || "atendente").toLowerCase().trim();
        const hasActiveFlowForTransfer = !!(conv.fluxo_estado as { fluxo_id?: string } | null)?.fluxo_id;
        if (texto.toLowerCase().includes(transferWord) && !hasActiveFlowForTransfer) {
          await supabase.from("conversas").update({ bot_ativo: false, status: "aguardando", fluxo_estado: null }).eq("id", conv!.id);
          await sendBot("Aguarde, vou transferir para um atendente. 👋");
          continue;
        }

        const agora = new Date();
        const dia   = agora.getDay();
        const hAtu  = agora.getHours() * 60 + agora.getMinutes();
        const [hI, mI] = ((cfg?.horario_inicio as string | null) || "08:00").split(":").map(Number);
        const [hF, mF] = ((cfg?.horario_fim   as string | null) || "18:00").split(":").map(Number);
        const diasOk = ((cfg?.dias_semana as number[] | null) || [1,2,3,4,5]).includes(dia);
        const dentroHorario = diasOk && hAtu >= (hI*60+mI) && hAtu < (hF*60+mF);

        // Active flows must continue regardless of business hours —
        // if the user responds to an "aguardar" question outside hours, the flow must resume.
        // Per-seller flows also bypass company hours (seller manages their own availability).
        // Only block new flow initiations and standalone chatbot rules outside business hours.
        const hasActiveFlowForHours = !!(conv.fluxo_estado as { fluxo_id?: string } | null)?.fluxo_id;
        if (!dentroHorario && !hasActiveFlowForHours && !vendedorFluxoId) {
          if (isNew && cfg?.mensagem_fora_horario) await sendBot(cfg.mensagem_fora_horario as string);
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

          // Per-seller flow overrides company flow; if company flow is actually a seller flow,
          // null it out so it doesn't run for unrelated sellers.
          const effectiveCfg = vendedorFluxoId
            ? { ...(cfg as Record<string, unknown>), fluxo_ativo_id: vendedorFluxoId }
            : suppressCompanyFlow
              ? { ...(cfg as Record<string, unknown>), fluxo_ativo_id: null }
              : cfg as Record<string, unknown>;

          const fluxoExecutado = await executarFluxo(
            effectiveCfg,
            texto, senderPhone, senderName,
            convComMsg as Record<string, unknown>,
            empresa_id, isNew, supabase, sendBot,
          );

          if (!fluxoExecutado) {
            if (isNew && cfg?.mensagem_boas_vindas) await sendBot(cfg.mensagem_boas_vindas);
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

