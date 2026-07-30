import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_URL = (Deno.env.get("EVOLUTION_GLOBAL_URL") || "").replace(/\/$/, "");
const EVOLUTION_KEY = Deno.env.get("EVOLUTION_GLOBAL_KEY") || "";

function extractPhone(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, "").replace(/@c\.us$/, "").replace(/:.*$/, "");
}

function phoneVariants(phone: string): string[] {
  const s = new Set([phone]);
  if (/^\d{10,11}$/.test(phone))  s.add("55" + phone);
  if (/^55\d{10,11}$/.test(phone)) s.add(phone.slice(2));
  if (/^\d{11}$/.test(phone) && phone[2] === "9")    s.add(phone.slice(0,2) + phone.slice(3));
  if (/^55\d{11}$/.test(phone) && phone[4] === "9")  s.add("55" + phone.slice(2,4) + phone.slice(5));
  return [...s];
}

Deno.serve(async (_req) => {
  if (!EVOLUTION_URL) return new Response("OK");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Conversa com mensagem recente fica de fora: o findChats pode ainda não ter
  // contabilizado o não lido e responder 0, o que marcaria como lida uma
  // mensagem que ninguém abriu. Passados os 45s, o dado da Evolution é confiável.
  const limiteRecencia = new Date(Date.now() - 45_000).toISOString();

  const { data: conversas } = await supabase
    .from("conversas")
    .select("id, empresa_id, contato_telefone, contato_lid, nao_lidas")
    .gt("nao_lidas", 0)
    .lt("ultima_hora", limiteRecencia);

  if (!conversas || conversas.length === 0) return new Response("OK");

  const byEmpresa: Record<string, { id: string; contato_telefone: string; contato_lid: string | null }[]> = {};
  for (const g of conversas) {
    if (!byEmpresa[g.empresa_id]) byEmpresa[g.empresa_id] = [];
    byEmpresa[g.empresa_id].push({ id: g.id, contato_telefone: g.contato_telefone, contato_lid: g.contato_lid ?? null });
  }

  let totalZerado = 0;
  const diagReport: Record<string, unknown>[] = [];

  // Deadline global para trabalho opcional (resolução de @lid). A função tem
  // ~150s de execução; passado esse limite paramos as buscas extras para
  // garantir que TODAS as empresas concluam o processamento principal.
  const softDeadline = Date.now() + 45_000;

  // Empresas são processadas em paralelo: cada uma faz várias chamadas HTTP à
  // Evolution e, em série, uma única empresa grande consumia todo o tempo de
  // execução — as demais nunca eram processadas.
  await Promise.all(Object.entries(byEmpresa).map(async ([empresaId, convs]) => {
    const empresaDiag: Record<string, unknown> = { empresaId: empresaId.slice(0, 8), convs: convs.length };
    try {
      let instName = "";
      let instKey = EVOLUTION_KEY;

      const { data: inst } = await supabase
        .from("empresa_instancias")
        .select("evolution_instance_id, evolution_instance_token")
        .eq("empresa_id", empresaId)
        .not("evolution_instance_id", "is", null)
        .maybeSingle();

      if (inst?.evolution_instance_id) {
        instName = inst.evolution_instance_id;
        instKey = inst.evolution_instance_token || EVOLUTION_KEY;
      } else {
        const { data: emp } = await supabase
          .from("empresas")
          .select("evolution_instance_id, evolution_instance_token")
          .eq("id", empresaId)
          .maybeSingle();
        if (emp?.evolution_instance_id) {
          instName = emp.evolution_instance_id;
          instKey = emp.evolution_instance_token || EVOLUTION_KEY;
        }
      }

      empresaDiag.instName = instName || null;
      if (!instName) { diagReport.push(empresaDiag); return; }

      // Evolution API v2 uses POST with {"where":{}} for findChats
      let r = await fetch(`${EVOLUTION_URL}/chat/findChats/${instName}`, {
        method: "POST",
        headers: { "apikey": instKey, "Content-Type": "application/json" },
        body: JSON.stringify({ where: {} }),
      });
      // Fallback to GET for older Evolution API versions
      if (r.status === 404 || r.status === 405) {
        r = await fetch(`${EVOLUTION_URL}/chat/findChats/${instName}`, {
          method: "GET",
          headers: { "apikey": instKey },
        });
      }

      empresaDiag.findChatsStatus = r.status;
      // Se findChats falhar (instância desconectada, etc.), não abandona a empresa —
      // continua com chatMapGroup vazio para que a regra dos 30 min limpe badges órfãos.
      // deno-lint-ignore no-explicit-any
      const rawChats: any = r.ok ? await r.json().catch(() => []) : [];
      // deno-lint-ignore no-explicit-any
      const allChats: any[] = Array.isArray(rawChats) ? rawChats : [];
      empresaDiag.findChatsTotal = allChats.length;

      // As gravações de contato_lid são acumuladas e aguardadas no fim do
      // bloco: disparadas sem await, o Deno encerrava a função antes de
      // concluí-las e o mapeamento nunca era persistido.
      const lidWrites: PromiseLike<unknown>[] = [];

      // Mapas de unreadCount por tipo de JID
      const chatMapGroup: Record<string, number> = {};
      const chatMapLid:   Record<string, number> = {};
      const chatMapPhone: Record<string, number> = {};
      // Mapeamento @lid → telefone real extraído de campos alternativos do chat
      const lidToPhone:   Record<string, string> = {};

      for (const chat of allChats) {
        // remoteJid primeiro: na Evolution v2 o campo id é um CUID do banco,
        // não o JID do WhatsApp.
        const jid    = String(chat.remoteJid || chat.id || "");
        const unread = Number(chat.unreadCount ?? 0);
        if (!jid) continue;

        if (jid.endsWith("@g.us")) {
          chatMapGroup[jid] = unread;

        } else if (jid.endsWith("@lid")) {
          chatMapLid[jid] = unread;

          // Quando o chat é endereçado por @lid, a Evolution entrega o telefone
          // real em lastMessage.key.remoteJidAlt — evita ter que resolver o
          // @lid por chamadas extras à API.
          const altRaw = String(
            chat.lastMessage?.key?.remoteJidAlt ||
            chat.phone || chat.number || chat.jid || chat.pnJid || ""
          );
          if (altRaw && altRaw !== jid) {
            let phone = "";
            if (altRaw.endsWith("@s.whatsapp.net") || altRaw.endsWith("@c.us")) {
              phone = extractPhone(altRaw);
            } else if (/^\d{8,15}$/.test(altRaw)) {
              phone = altRaw;
            }
            if (phone && !phone.includes("@")) {
              lidToPhone[jid] = phone;
              for (const v of phoneVariants(phone)) chatMapPhone[v] = unread;
            }
          }

        } else if (jid.endsWith("@s.whatsapp.net") || jid.endsWith("@c.us")) {
          const phone = extractPhone(jid);
          if (phone && !phone.includes("@")) {
            for (const v of phoneVariants(phone)) chatMapPhone[v] = unread;
          }
        }
      }

      // Índice telefone → @lid para consulta direta ao processar as conversas.
      // A gravação retroativa de contato_lid acontece só para as conversas com
      // badge pendente: varrer todos os lidToPhone gerava um UPDATE por
      // variante de telefone de cada chat, milhares de queries por minuto.
      const phoneToLid: Record<string, string> = {};
      for (const [lid, phone] of Object.entries(lidToPhone)) {
        for (const v of phoneVariants(phone)) phoneToLid[v] = lid;
      }

      // Resolução adicional: para @lid com unreadCount=0 sem mapeamento de telefone,
      // consulta a API da Evolution para resolver @lid → telefone real.
      // Cobre o cenário de mensagens lidas no celular durante período offline.
      // Limitado a LID_BUDGET por execução e interrompido no softDeadline: com
      // centenas de chats, o sweep sequencial estourava o tempo da função.
      // As resoluções são persistidas em contato_lid, então execuções
      // sucessivas do cron cobrem o restante de forma incremental.
      const LID_BUDGET = 20;
      const unresolvedLids = Object.entries(chatMapLid)
        .filter(([lid, unread]) => unread === 0 && !(lid in lidToPhone))
        .slice(0, LID_BUDGET);
      empresaDiag.lidsToResolve = unresolvedLids.length;

      await Promise.all(unresolvedLids.map(async ([lid]) => {
        if (Date.now() > softDeadline) return;
        try {
          for (const [method, url, bodyStr] of [
            ["POST", `${EVOLUTION_URL}/contact/findContacts/${instName}`, JSON.stringify({ where: { id: lid } })],
            ["POST", `${EVOLUTION_URL}/contact/findContacts/${instName}`, JSON.stringify({ where: { remoteJid: lid } })],
            ["GET",  `${EVOLUTION_URL}/contact/fetchContacts/${instName}?jid=${encodeURIComponent(lid)}`, ""],
          ] as [string, string, string][]) {
            const opts: RequestInit = { method, headers: { "apikey": instKey, "Content-Type": "application/json" } };
            if (bodyStr) opts.body = bodyStr;
            const resp = await fetch(url, opts);
            if (!resp.ok) continue;
            const ct = await resp.json();
            const contacts = Array.isArray(ct) ? ct : (ct?.contacts || [ct]);
            let resolved = "";
            for (const c of contacts) {
              const altJid = String(c?.remoteJid || c?.phone || c?.number || c?.jid || "");
              if (altJid.endsWith("@s.whatsapp.net") || altJid.endsWith("@c.us")) {
                const p = extractPhone(altJid);
                if (p && !p.includes("@")) { resolved = p; break; }
              } else if (/^\d{8,15}$/.test(altJid)) {
                resolved = altJid; break;
              }
            }
            if (resolved) {
              lidToPhone[lid] = resolved;
              for (const v of phoneVariants(resolved)) chatMapPhone[v] = 0;
              // O índice abaixo cobre a gravação, feita por conversa adiante.
              for (const v of phoneVariants(resolved)) phoneToLid[v] = lid;
              break;
            }
          }
        } catch (_) {}
      }));

      empresaDiag.groupsInMap = Object.keys(chatMapGroup).length;
      empresaDiag.groupsUnreadZero = Object.values(chatMapGroup).filter(v => v === 0).length;

      // Zera badges onde Evolution API confirma unreadCount = 0
      // Para grupos travados (findChats discorda), tenta force-read via readMessage API
      const diagGroups: { convId: string; jid: string; reason: string; ucVal: number | null; forceRead?: boolean }[] = [];
      let shouldZeroCount = 0, updateRan = 0, updateSuccess = 0;

      for (const conv of convs) {
        const jid = conv.contato_telefone;
        let shouldZero = false;

        if (jid.endsWith("@g.us")) {
          // Grupo: match direto por JID
          const inMap = jid in chatMapGroup;
          const ucVal = inMap ? chatMapGroup[jid] : null;

          if (!inMap || ucVal !== 0) {
            // findChats não confirmou leitura — tenta force-read se a mensagem tiver
            // mais de 3 minutos (dá tempo para a webhook processar naturalmente antes)
            let forceRead = false;
            let rkStatus: number | null = null;
            try {
              const { data: lastMsg } = await supabase.from("mensagens")
                .select("hora, wamid")
                .eq("conversa_id", conv.id)
                .eq("de", "contato")
                .not("wamid", "is", null)
                .order("hora", { ascending: false })
                .limit(20);

              if (lastMsg && lastMsg.length > 0) {
                const lastHora = lastMsg[0].hora;
                const ageMs = lastHora ? Date.now() - new Date(lastHora).getTime() : 0;

                // Só force-read se a mensagem mais recente tiver pelo menos 3 minutos
                if (ageMs > 3 * 60 * 1000) {
                  const readMsgs = lastMsg
                    .filter((m: Record<string, string>) => m.wamid)
                    .map((m: Record<string, string>) => ({
                      key: { remoteJid: jid, fromMe: false, id: m.wamid },
                    }));

                  if (readMsgs.length > 0) {
                    // Tenta marcar como lido na Evolution para sincronizar o estado
                    const rkResp = await fetch(`${EVOLUTION_URL}/chat/readMessage/${instName}`, {
                      method: "POST",
                      headers: { "apikey": instKey, "Content-Type": "application/json" },
                      body: JSON.stringify({ readMessages: readMsgs }),
                    }).catch(() => null);
                    forceRead = rkResp?.ok ?? false;
                    rkStatus = rkResp?.status ?? null;
                    if (forceRead) shouldZero = true;
                  }
                }

                // Grupo ausente do findChats com mensagem antiga: Evolution não
                // rastreia mais este chat (instância reconectada, grupo saído, etc.)
                // → zera o badge pois não há forma de marcar como lido.
                if (!inMap && !shouldZero && ageMs > 30 * 60 * 1000) {
                  shouldZero = true;
                }
              } else if (!inMap) {
                // Sem mensagens do contato mas badge >0 → badge órfão, zera.
                shouldZero = true;
              }
            } catch (_) {}

            diagGroups.push({ convId: conv.id, jid, reason: !inMap ? "not_in_findChats" : `unreadCount=${ucVal}`, ucVal, forceRead, rkStatus });
            if (!shouldZero) continue;
          } else {
            shouldZero = true;
          }

        } else if (jid.endsWith("@lid")) {
          // Conversa onde contato_telefone é o @lid diretamente
          if (chatMapLid[jid] === 0) {
            shouldZero = true;
          } else if (jid in lidToPhone) {
            // Temos o telefone real para este @lid
            if (phoneVariants(lidToPhone[jid]).some(v => chatMapPhone[v] === 0)) shouldZero = true;
          }
          if (!shouldZero) continue;

        } else {
          // Contato individual com telefone real
          const phone = extractPhone(jid);
          if (!phone || phone.includes("@")) continue;

          const variants = phoneVariants(phone);

          // 1. Match por telefone direto
          if (variants.some(v => chatMapPhone[v] === 0)) {
            shouldZero = true;
          }
          // 2. Match por contato_lid já populado
          if (!shouldZero && conv.contato_lid && conv.contato_lid in chatMapLid) {
            if (chatMapLid[conv.contato_lid] === 0) shouldZero = true;
          }
          // 3. Contato_lid é null mas o telefone foi cruzado com um @lid
          if (!shouldZero && conv.contato_lid === null) {
            const lid = variants.map(v => phoneToLid[v]).find(Boolean);
            if (lid) {
              // Grava o mapeamento mesmo que o chat ainda esteja não lido:
              // as próximas execuções e o webhook casam direto por contato_lid.
              lidWrites.push(supabase.from("conversas")
                .update({ contato_lid: lid })
                .eq("id", conv.id)
                .is("contato_lid", null));
              if (chatMapLid[lid] === 0) shouldZero = true;
            }
          }

          if (!shouldZero) continue;
        }

        if (shouldZero) shouldZeroCount++;
        updateRan++;
        const { data: upd, error: updErr } = await supabase
          .from("conversas")
          .update({ nao_lidas: 0 })
          .eq("id", conv.id)
          .gt("nao_lidas", 0)
          // Mensagem que chegou durante a varredura não é zerada.
          .lt("ultima_hora", limiteRecencia)
          .select("id");

        if (upd && upd.length > 0) {
          updateSuccess++;
          totalZerado++;
          await supabase.from("logs_whatsapp").insert({
            empresa_id: empresaId,
            conversa_id: conv.id,
            tipo: "fluxo",
            nivel: "info",
            origem: "sync-badges",
            evento: "badge-zerado-cron",
            resumo: `Badge zerado via sync periódico para ${jid}`,
            payload: { jid, instName, contato_lid: conv.contato_lid },
          }).then(() => {}).catch(() => {});
        } else if (updErr) {
          empresaDiag.firstUpdErr = String(updErr.message).slice(0, 100);
        }
      }

      // Garante que o mapeamento @lid -> telefone foi persistido.
      if (lidWrites.length > 0) await Promise.all(lidWrites.map(p => Promise.resolve(p).catch(() => {})));

      empresaDiag.shouldZeroCount = shouldZeroCount;
      empresaDiag.updateRan = updateRan;
      empresaDiag.updateSuccess = updateSuccess;
      empresaDiag.diagGroupsCount = diagGroups.length;
      diagReport.push(empresaDiag);

      // Registrado apenas quando houve limpeza: um log por empresa a cada
      // minuto inundava logs_whatsapp com ~14 mil linhas por dia.
      if (updateSuccess > 0) await supabase.from("logs_whatsapp").insert({
        empresa_id: empresaId, tipo: "fluxo", nivel: "info", origem: "sync-badges",
        evento: "badge-empresa-summary",
        resumo: `Empresa processada: findChats=${empresaDiag.findChatsStatus ?? "skip"}, chats=${empresaDiag.findChatsTotal ?? 0}, zerado=${updateSuccess}/${convs.length}`,
        payload: empresaDiag,
      }).then(() => {}).catch(() => {});

      // Só interessa registrar quando houve tentativa de force-read: um grupo
      // apenas não confirmado como lido é o estado normal de quem tem mensagem
      // pendente, e logar isso a cada minuto inundava logs_whatsapp.
      const forceReadGroups = diagGroups.filter(g => g.forceRead);
      if (forceReadGroups.length > 0) {
        await supabase.from("logs_whatsapp").insert({
          empresa_id: empresaId, tipo: "fluxo", nivel: "info", origem: "sync-badges",
          evento: "badge-grupos-diagnostico",
          resumo: `${forceReadGroups.length} grupo(s) marcados como lidos via force-read`,
          payload: { instName, groups: forceReadGroups.slice(0, 20) },
        }).then(() => {}).catch(() => {});
      }
    } catch (e) { diagReport.push({ ...empresaDiag, caught: String(e).slice(0, 150) }); }
  }));

  return new Response(JSON.stringify({ zerado: totalZerado, report: diagReport }));
});
