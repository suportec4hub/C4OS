import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_URL = (Deno.env.get("EVOLUTION_GLOBAL_URL") || "").replace(/\/$/, "");
const EVOLUTION_KEY = Deno.env.get("EVOLUTION_GLOBAL_KEY") || "";

Deno.serve(async (_req) => {
  if (!EVOLUTION_URL) return new Response("OK");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Busca todas as conversas com badge > 0 (grupos e individuais)
  const { data: conversas } = await supabase
    .from("conversas")
    .select("id, empresa_id, contato_telefone, contato_lid, nao_lidas")
    .gt("nao_lidas", 0);

  if (!conversas || conversas.length === 0) return new Response("OK");

  // Agrupa por empresa_id para minimizar chamadas à API
  const byEmpresa: Record<string, { id: string; contato_telefone: string; contato_lid: string | null }[]> = {};
  for (const g of conversas) {
    if (!byEmpresa[g.empresa_id]) byEmpresa[g.empresa_id] = [];
    byEmpresa[g.empresa_id].push({ id: g.id, contato_telefone: g.contato_telefone, contato_lid: g.contato_lid });
  }

  let totalZerado = 0;

  for (const [empresaId, convs] of Object.entries(byEmpresa)) {
    try {
      // Busca credenciais da instância Evolution para esta empresa
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

      // Consulta todos os chats da instância
      const r = await fetch(`${EVOLUTION_URL}/chat/findChats/${instName}`, {
        method: "GET",
        headers: { "apikey": instKey },
      });

      if (!r.ok) continue;

      const allChats = await r.json();
      if (!Array.isArray(allChats)) continue;

      // Mapas: jid → unreadCount
      // chatMapGroup: @g.us → unreadCount (match por contato_telefone)
      // chatMapLid:   @lid  → unreadCount (match por contato_lid)
      // chatMapPhone: phone → unreadCount (match por contato_telefone sem @)
      const chatMapGroup: Record<string, number> = {};
      const chatMapLid: Record<string, number> = {};
      const chatMapPhone: Record<string, number> = {};

      for (const chat of allChats) {
        const jid = String(chat.id || chat.remoteJid || "");
        const unread = Number(chat.unreadCount ?? 0);

        if (jid.endsWith("@g.us")) {
          chatMapGroup[jid] = unread;
        } else if (jid.endsWith("@lid")) {
          chatMapLid[jid] = unread;
        } else if (jid.endsWith("@s.whatsapp.net") || jid.endsWith("@c.us")) {
          // Extrai número puro
          const phone = jid.replace(/@s\.whatsapp\.net$/, "").replace(/@c\.us$/, "").replace(/:.*$/, "");
          if (phone && !phone.includes("@")) {
            chatMapPhone[phone] = unread;
            // Também indexa variantes (com/sem 55)
            if (/^\d{10,11}$/.test(phone)) chatMapPhone["55" + phone] = unread;
            if (/^55\d{10,11}$/.test(phone)) chatMapPhone[phone.slice(2)] = unread;
          }
        }
      }

      // Zera badge onde Evolution API confirma unreadCount = 0
      for (const conv of convs) {
        const jid = conv.contato_telefone;
        let shouldZero = false;

        if (jid.endsWith("@g.us")) {
          // Grupo: match direto por JID
          if (!(jid in chatMapGroup)) continue;
          if (chatMapGroup[jid] !== 0) continue;
          shouldZero = true;
        } else if (conv.contato_lid && conv.contato_lid.endsWith("@lid")) {
          // Contato individual com @lid mapeado
          if (!(conv.contato_lid in chatMapLid)) {
            // Sem match por lid, tenta por telefone
            const phone = jid.replace(/@s\.whatsapp\.net$/, "").replace(/@c\.us$/, "").replace(/:.*$/, "");
            if (phone && phone in chatMapPhone && chatMapPhone[phone] === 0) {
              shouldZero = true;
            } else {
              continue;
            }
          } else if (chatMapLid[conv.contato_lid] !== 0) {
            continue;
          } else {
            shouldZero = true;
          }
        } else {
          // Contato individual sem @lid: match por telefone
          const phone = jid.replace(/@s\.whatsapp\.net$/, "").replace(/@c\.us$/, "").replace(/:.*$/, "");
          if (!phone || phone.includes("@")) continue;
          if (!(phone in chatMapPhone)) continue;
          if (chatMapPhone[phone] !== 0) continue;
          shouldZero = true;
        }

        if (!shouldZero) continue;

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
