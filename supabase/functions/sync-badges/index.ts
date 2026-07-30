// Mapeia @lid → telefone das conversas, a partir do findChats da Evolution.
//
// Esta função NÃO zera badge, de propósito. Ela já fez isso, apoiada no
// unreadCount do findChats, e o resultado era apagar notificação de mensagem
// que ninguém tinha lido: a Evolution é um dispositivo conectado e consome a
// mensagem ao recebê-la, então o unreadCount dela fica 0 mesmo sem ninguém
// abrir a conversa. Medido em produção, toda conversa zerada pelo cron não
// tinha nenhum recibo de leitura nos 30 minutos anteriores.
//
// Badge só é zerado por leitura de verdade: recibo do celular
// (messages.update/message.ack com status READ ou PLAYED, tratado no
// evolution-webhook) ou abertura da conversa no C4OS.
//
// O mapeamento @lid → telefone continua valendo a pena porque é justamente ele
// que permite ao recibo de leitura encontrar a conversa certa: a Evolution
// entrega os recibos endereçados por @lid, enquanto as conversas são gravadas
// por telefone.
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
  if (/^\d{10,11}$/.test(phone))   s.add("55" + phone);
  if (/^55\d{10,11}$/.test(phone)) s.add(phone.slice(2));
  if (/^\d{11}$/.test(phone) && phone[2] === "9")   s.add(phone.slice(0, 2) + phone.slice(3));
  if (/^55\d{11}$/.test(phone) && phone[4] === "9") s.add("55" + phone.slice(2, 4) + phone.slice(5));
  return [...s];
}

Deno.serve(async (_req) => {
  if (!EVOLUTION_URL) return new Response("OK");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Só conversas sem mapeamento: as demais não têm o que aprender.
  const { data: pendentes } = await supabase
    .from("conversas")
    .select("empresa_id, contato_telefone")
    .is("contato_lid", null)
    .not("contato_telefone", "is", null)
    .limit(2000);

  if (!pendentes || pendentes.length === 0) return new Response("OK");

  const porEmpresa: Record<string, Set<string>> = {};
  for (const c of pendentes) {
    const jid = String(c.contato_telefone || "");
    if (!jid || jid.endsWith("@g.us")) continue;  // grupo não tem @lid
    (porEmpresa[c.empresa_id] ||= new Set()).add(jid);
  }

  let mapeados = 0;

  await Promise.all(Object.entries(porEmpresa).map(async ([empresaId, telefones]) => {
    try {
      let instName = "";
      let instKey  = EVOLUTION_KEY;

      const { data: inst } = await supabase
        .from("empresa_instancias")
        .select("evolution_instance_id, evolution_instance_token")
        .eq("empresa_id", empresaId)
        .not("evolution_instance_id", "is", null)
        .maybeSingle();

      if (inst?.evolution_instance_id) {
        instName = inst.evolution_instance_id;
        instKey  = inst.evolution_instance_token || EVOLUTION_KEY;
      } else {
        const { data: emp } = await supabase
          .from("empresas")
          .select("evolution_instance_id, evolution_instance_token")
          .eq("id", empresaId)
          .maybeSingle();
        if (emp?.evolution_instance_id) {
          instName = emp.evolution_instance_id;
          instKey  = emp.evolution_instance_token || EVOLUTION_KEY;
        }
      }
      if (!instName) return;

      // Evolution v2 usa POST com {"where":{}}; GET responde 404.
      let r = await fetch(`${EVOLUTION_URL}/chat/findChats/${instName}`, {
        method: "POST",
        headers: { "apikey": instKey, "Content-Type": "application/json" },
        body: JSON.stringify({ where: {} }),
      });
      if (r.status === 404 || r.status === 405) {
        r = await fetch(`${EVOLUTION_URL}/chat/findChats/${instName}`, {
          method: "GET", headers: { "apikey": instKey },
        });
      }
      if (!r.ok) return;

      // deno-lint-ignore no-explicit-any
      const raw: any = await r.json().catch(() => []);
      // deno-lint-ignore no-explicit-any
      const chats: any[] = Array.isArray(raw) ? raw : [];

      // telefone → @lid. O telefone real vem em lastMessage.key.remoteJidAlt
      // quando o chat é endereçado por @lid.
      const porTelefone: Record<string, string> = {};
      for (const chat of chats) {
        // remoteJid primeiro: na Evolution v2 o campo id é um CUID do banco.
        const jid = String(chat.remoteJid || chat.id || "");
        if (!jid.endsWith("@lid")) continue;

        const alt = String(chat.lastMessage?.key?.remoteJidAlt || chat.phone || chat.number || "");
        let phone = "";
        if (alt.endsWith("@s.whatsapp.net") || alt.endsWith("@c.us")) phone = extractPhone(alt);
        else if (/^\d{8,15}$/.test(alt)) phone = alt;
        if (!phone || phone.includes("@")) continue;

        for (const v of phoneVariants(phone)) porTelefone[v] = jid;
      }

      // Grava apenas o que interessa: as conversas que ainda não têm o @lid.
      // Aguardado, porque disparar sem await fazia o Deno encerrar a função
      // antes de concluir e o mapeamento nunca era persistido.
      const escritas: PromiseLike<unknown>[] = [];
      for (const tel of telefones) {
        const lid = phoneVariants(extractPhone(tel)).map(v => porTelefone[v]).find(Boolean);
        if (!lid) continue;
        mapeados++;
        escritas.push(
          supabase.from("conversas")
            .update({ contato_lid: lid })
            .eq("empresa_id", empresaId)
            .eq("contato_telefone", tel)
            .is("contato_lid", null),
        );
      }
      if (escritas.length > 0) {
        await Promise.all(escritas.map(p => Promise.resolve(p).catch(() => {})));
      }
    } catch (_) { /* uma empresa com problema não derruba as demais */ }
  }));

  return new Response(JSON.stringify({ mapeados }), {
    headers: { "Content-Type": "application/json" },
  });
});
