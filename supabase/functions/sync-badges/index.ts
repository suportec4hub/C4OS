import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_URL = (Deno.env.get("EVOLUTION_GLOBAL_URL") || "").replace(/\/$/, "");
const EVOLUTION_KEY = Deno.env.get("EVOLUTION_GLOBAL_KEY") || "";

Deno.serve(async (_req) => {
  if (!EVOLUTION_URL) return new Response("OK");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Busca todos os grupos com badge > 0 em qualquer empresa
  const { data: grupos } = await supabase
    .from("conversas")
    .select("id, empresa_id, contato_telefone, nao_lidas")
    .gt("nao_lidas", 0)
    .like("contato_telefone", "%@g.us");

  if (!grupos || grupos.length === 0) return new Response("OK");

  // Agrupa por empresa_id para minimizar chamadas à API
  const byEmpresa: Record<string, { id: string; contato_telefone: string }[]> = {};
  for (const g of grupos) {
    if (!byEmpresa[g.empresa_id]) byEmpresa[g.empresa_id] = [];
    byEmpresa[g.empresa_id].push({ id: g.id, contato_telefone: g.contato_telefone });
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

      // Consulta todos os chats da instância e filtra grupos lidos
      const r = await fetch(`${EVOLUTION_URL}/chat/findChats/${instName}`, {
        method: "GET",
        headers: { "apikey": instKey },
      });

      if (!r.ok) continue;

      const allChats = await r.json();
      if (!Array.isArray(allChats)) continue;

      // Mapa jid → unreadCount conforme Evolution API retorna
      const chatMap: Record<string, number> = {};
      for (const chat of allChats) {
        const jid = String(chat.id || chat.remoteJid || "");
        if (jid.endsWith("@g.us")) {
          chatMap[jid] = Number(chat.unreadCount ?? 0);
        }
      }

      // Zera badge onde Evolution API confirma unreadCount = 0
      for (const conv of convs) {
        const jid = conv.contato_telefone;
        if (!(jid in chatMap)) continue;        // grupo não encontrado → não toca
        if (chatMap[jid] !== 0) continue;       // ainda tem não lidas → não toca

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
            payload: { jid, instName },
          }).catch(() => {});
        }
      }
    } catch (_) {}
  }

  return new Response(`OK zerou:${totalZerado}`);
});
