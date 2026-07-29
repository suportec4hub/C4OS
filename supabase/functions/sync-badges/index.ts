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

  const { data: conversas } = await supabase
    .from("conversas")
    .select("id, empresa_id, contato_telefone, contato_lid, nao_lidas")
    .gt("nao_lidas", 0);

  if (!conversas || conversas.length === 0) return new Response("OK");

  const byEmpresa: Record<string, { id: string; contato_telefone: string; contato_lid: string | null }[]> = {};
  for (const g of conversas) {
    if (!byEmpresa[g.empresa_id]) byEmpresa[g.empresa_id] = [];
    byEmpresa[g.empresa_id].push({ id: g.id, contato_telefone: g.contato_telefone, contato_lid: g.contato_lid ?? null });
  }

  let totalZerado = 0;

  for (const [empresaId, convs] of Object.entries(byEmpresa)) {
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

      if (!instName) continue;

      const r = await fetch(`${EVOLUTION_URL}/chat/findChats/${instName}`, {
        method: "GET",
        headers: { "apikey": instKey },
      });

      if (!r.ok) continue;

      const allChats = await r.json();
      if (!Array.isArray(allChats)) continue;

      // Mapas de unreadCount por tipo de JID
      const chatMapGroup: Record<string, number> = {};
      const chatMapLid:   Record<string, number> = {};
      const chatMapPhone: Record<string, number> = {};
      // Mapeamento @lid → telefone real extraído de campos alternativos do chat
      const lidToPhone:   Record<string, string> = {};

      for (const chat of allChats) {
        const jid    = String(chat.id || chat.remoteJid || "");
        const unread = Number(chat.unreadCount ?? 0);
        if (!jid) continue;

        if (jid.endsWith("@g.us")) {
          chatMapGroup[jid] = unread;

        } else if (jid.endsWith("@lid")) {
          chatMapLid[jid] = unread;

          // Tenta extrair telefone real de outros campos do objeto de chat
          // Baileys pode incluir remoteJid (phone format), phone, number, etc.
          const altRaw = String(
            chat.remoteJid || chat.phone || chat.number || chat.jid || ""
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

      // Retroativamente popula contato_lid onde temos o mapeamento lid → telefone
      // Isso corrige conversas antigas que nunca receberam o mapeamento
      for (const [lid, phone] of Object.entries(lidToPhone)) {
        for (const v of phoneVariants(phone)) {
          supabase.from("conversas")
            .update({ contato_lid: lid })
            .eq("empresa_id", empresaId)
            .eq("contato_telefone", v)
            .is("contato_lid", null)
            .then(() => {}).catch(() => {});
        }
      }

      // Resolução adicional: para @lid com unreadCount=0 sem mapeamento de telefone,
      // consulta a API da Evolution para resolver @lid → telefone real.
      // Cobre o cenário de mensagens lidas no celular durante período offline.
      const unresolvedLids = Object.entries(chatMapLid)
        .filter(([lid, unread]) => unread === 0 && !(lid in lidToPhone));

      for (const [lid] of unresolvedLids) {
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
              // Popula contato_lid retroativamente
              for (const v of phoneVariants(resolved)) {
                supabase.from("conversas")
                  .update({ contato_lid: lid })
                  .eq("empresa_id", empresaId)
                  .eq("contato_telefone", v)
                  .is("contato_lid", null)
                  .then(() => {}).catch(() => {});
              }
              break;
            }
          }
        } catch (_) {}
      }

      // Zera badges onde Evolution API confirma unreadCount = 0
      for (const conv of convs) {
        const jid = conv.contato_telefone;
        let shouldZero = false;

        if (jid.endsWith("@g.us")) {
          // Grupo: match direto por JID
          const inMap = jid in chatMapGroup;
          const ucVal = inMap ? chatMapGroup[jid] : null;
          if (!inMap || ucVal !== 0) {
            // Log diagnóstico: por que o grupo não foi zerado
            supabase.from("logs_whatsapp").insert({
              empresa_id: empresaId, conversa_id: conv.id,
              tipo: "fluxo", nivel: "warn", origem: "sync-badges",
              evento: "badge-grupo-nao-zerado",
              resumo: `Grupo ${jid}: ${!inMap ? "não encontrado no findChats" : `unreadCount=${ucVal} (>0)`}`,
              payload: { jid, instName, inMap, ucVal },
            }).catch(() => {});
            continue;
          }
          shouldZero = true;

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
          // 3. Contato_lid é null mas @lid foi cruzado com este telefone via lidToPhone
          if (!shouldZero && conv.contato_lid === null) {
            for (const [lid, lphone] of Object.entries(lidToPhone)) {
              if (phoneVariants(lphone).some(v => variants.includes(v)) && chatMapLid[lid] === 0) {
                shouldZero = true;
                // Aproveita e popula contato_lid agora que sabemos o mapeamento
                supabase.from("conversas")
                  .update({ contato_lid: lid })
                  .eq("id", conv.id)
                  .is("contato_lid", null)
                  .then(() => {}).catch(() => {});
                break;
              }
            }
          }

          if (!shouldZero) continue;
        }

        const { data: upd } = await supabase
          .from("conversas")
          .update({ nao_lidas: 0 })
          .eq("id", conv.id)
          .gt("nao_lidas", 0)
          .select("id");

        if (upd && upd.length > 0) {
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
          }).catch(() => {});
        }
      }
    } catch (_) {}
  }

  return new Response(`OK zerou:${totalZerado}`);
});
