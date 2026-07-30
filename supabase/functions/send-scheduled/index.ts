import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPA_URL       = Deno.env.get("SUPABASE_URL")!;
const SUPA_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GLOBAL_EVO_URL = Deno.env.get("EVOLUTION_GLOBAL_URL") ?? "";
const CRON_TOKEN     = Deno.env.get("CRON_TOKEN") ?? "";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  });

async function logWA(
  db: ReturnType<typeof createClient>,
  opts: {
    empresa_id?:  string | null;
    conversa_id?: string | null;
    tipo:   string;
    nivel?: string;
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
  // Aceita chamadas autenticadas (JWT) ou do pg_cron via token interno
  const cronToken = req.headers.get("x-cron-token");
  const authHeader = req.headers.get("authorization") || "";
  // CRON_TOKEN vazio = segredo ainda não configurado; mantém o comportamento
  // anterior para não derrubar o cron. Configurado, passa a ser exigido.
  const isAuthenticated = CRON_TOKEN === "" || cronToken === CRON_TOKEN || authHeader.startsWith("Bearer ");
  if (!isAuthenticated) return new Response("Unauthorized", { status: 401 });

  // O trabalho roda em segundo plano e a resposta sai na hora. O pg_net encerra
  // a conexão em 5 segundos e a função era terminada junto: cada ciclo do cron
  // conseguia enviar só uma mensagem antes de morrer, o que fazia campanhas
  // grandes arrastarem a 1 envio por minuto.
  const work = processar().catch((e) => {
    console.error("[send-scheduled] falha no processamento:", e);
  });
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(work); else await work;

  return json({ iniciado: true });
});

async function processar() {
  const db = createClient(SUPA_URL, SUPA_KEY);

  // 1. Busca mensagens pendentes com hora já vencida
  const { data: pending, error: fetchErr } = await db
    .from("mensagens_agendadas")
    .select("id, empresa_id, conversa_id, destinatario, mensagem")
    .eq("status", "pendente")
    .lte("agendado_para", new Date().toISOString())
    .limit(20);

  if (fetchErr) { console.error("[send-scheduled]", fetchErr.message); return; }

  let sent = 0, failed = 0;

  if (!pending?.length) {
    // Sem mensagens individuais — continua para verificar campanhas agendadas
  } else {

  for (const msg of pending) {
    // 2. Lock atômico: muda para 'enviando' ANTES de enviar.
    const { data: locked } = await db
      .from("mensagens_agendadas")
      .update({ status: "enviando" })
      .eq("id", msg.id)
      .eq("status", "pendente")
      .select("id");

    if (!locked?.length) continue;

    // 3. Busca credenciais da empresa
    const { data: emp } = await db
      .from("empresas")
      .select("evolution_instance_id, evolution_instance_token, evolution_api_url")
      .eq("id", msg.empresa_id)
      .single();

    if (!emp?.evolution_instance_id || !emp?.evolution_instance_token) {
      const errMsg = "Instância Evolution não configurada";
      await db.from("mensagens_agendadas").update({
        status: "falhou",
        erro:   errMsg,
      }).eq("id", msg.id);
      await logWA(db, {
        empresa_id:  msg.empresa_id,
        conversa_id: msg.conversa_id ?? null,
        tipo:   "erro_api", nivel: "error",
        origem: "send-scheduled", evento: "config",
        telefone: String(msg.destinatario),
        resumo:  errMsg,
      });
      failed++;
      continue;
    }

    const evoUrl    = (emp.evolution_api_url?.trim() || GLOBAL_EVO_URL).replace(/\/$/, "");
    const instName  = emp.evolution_instance_id as string;
    const instToken = emp.evolution_instance_token as string;
    // A Evolution exige formato internacional: números brasileiros salvos sem
    // o DDI (10-11 dígitos) eram rejeitados com Bad Request.
    const rawPhone  = String(msg.destinatario).replace(/\D/g, "");
    const phone     = /^\d{10,11}$/.test(rawPhone) ? "55" + rawPhone : rawPhone;

    let ok = false;
    let lastErr = "";

    // 4a. Tentativa formato v2 básico
    try {
      const r = await fetch(`${evoUrl}/message/sendText/${instName}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "apikey": instToken },
        body:    JSON.stringify({ number: phone, text: msg.mensagem }),
      });
      if (r.ok) ok = true;
      else lastErr = await r.text().catch(() => String(r.status));
    } catch (e) { lastErr = (e as Error).message; }

    // 4b. Tentativa formato v2 com options
    if (!ok) {
      try {
        const r2 = await fetch(`${evoUrl}/message/sendText/${instName}`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", "apikey": instToken },
          body:    JSON.stringify({
            number:      phone,
            options:     { delay: 1200, presence: "composing", linkPreview: false },
            textMessage: { text: msg.mensagem },
          }),
        });
        if (r2.ok) ok = true;
        else lastErr = await r2.text().catch(() => String(r2.status));
      } catch (e) { lastErr = (e as Error).message; }
    }

    // 5. Atualiza status final
    if (ok) {
      const sentAt = new Date().toISOString();

      if (msg.conversa_id) {
        await db.from("mensagens").insert({
          conversa_id: msg.conversa_id,
          empresa_id:  msg.empresa_id,
          de:          "me",
          remetente:   "agendado",
          texto:       msg.mensagem,
          tipo:        "texto",
          hora:        sentAt,
          status:      "enviado",
        });
        await db.from("conversas").update({
          ultima_mensagem: msg.mensagem,
          ultima_hora:     sentAt,
        }).eq("id", msg.conversa_id);
      }

      await db.from("mensagens_agendadas").update({
        status:     "enviado",
        enviado_em: sentAt,
      }).eq("id", msg.id);

      await logWA(db, {
        empresa_id:  msg.empresa_id,
        conversa_id: msg.conversa_id ?? null,
        tipo:   "mensagem_agendada", nivel: "info",
        origem: "send-scheduled", evento: "sendText",
        telefone: phone,
        resumo:  `Mensagem agendada enviada: ${(msg.mensagem as string).slice(0, 100)}`,
        payload: { agendada_id: msg.id },
      });

      sent++;
    } else {
      await db.from("mensagens_agendadas").update({
        status: "falhou",
        erro:   lastErr.slice(0, 500),
      }).eq("id", msg.id);

      await logWA(db, {
        empresa_id:  msg.empresa_id,
        conversa_id: msg.conversa_id ?? null,
        tipo:   "erro_api", nivel: "error",
        origem: "send-scheduled", evento: "sendText",
        telefone: phone,
        resumo:  `Falha ao enviar mensagem agendada: ${lastErr.slice(0, 150)}`,
        payload: { agendada_id: msg.id, erro: lastErr.slice(0, 300) },
      });

      failed++;
    }
  }

    console.log(`[send-scheduled] mensagens: sent=${sent} failed=${failed}`);
  } // end else (pending mensagens)

  // ── Campanhas agendadas: detecta e dispara automaticamente ──────────────
  let campaignsTriggered = 0;
  // A função tem ~150s. Reserva-se margem para gravar os status finais.
  const tickDeadline = Date.now() + 120_000;
  const FATIA_MS = 40_000;
  try {
    const now = new Date().toISOString();
    const { data: dueCampaigns } = await db
      .from("campanhas")
      .select("id, empresa_id")
      .eq("status", "agendado")
      .lte("agendado_para", now)
      .limit(5); // máx 5 por tick para evitar timeout

    // Campanhas já em 'enviando': ou o broadcast anterior processou só um lote,
    // ou a execução foi interrompida. Em ambos os casos o cron retoma de onde
    // parou — antes essas campanhas ficavam presas em 'enviando' para sempre.
    // Ordenado pela menos recentemente atendida: com uma vaga por ciclo, a
    // primeira da lista monopolizava o agendador e as demais nunca rodavam —
    // uma campanha grande e travada impedia qualquer repetição de sair.
    const { data: resumeCampaigns } = await db
      .from("campanhas")
      .select("id, empresa_id")
      .eq("status", "enviando")
      .order("updated_at", { ascending: true, nullsFirst: true })
      .limit(5);

    const toProcess = [...(dueCampaigns || []), ...(resumeCampaigns || [])];
    const seen = new Set<string>();

    for (const camp of toProcess) {
      if (seen.has(camp.id as string)) continue;
      seen.add(camp.id as string);

      // Lock atômico: aceita 'agendado' (primeira execução) ou 'enviando'
      // (retomada). O broadcast é idempotente — só pega contatos pendentes.
      const { data: locked } = await db
        .from("campanhas")
        .update({ status: "enviando" })
        .eq("id", camp.id)
        .in("status", ["agendado", "enviando"])
        .select("id");

      if (!locked?.length) continue;

      // Divide o tempo do ciclo entre as campanhas em vez de dar tudo para a
      // primeira: cada uma recebe uma fatia e o restante é atendido no mesmo
      // ciclo, se couber.
      if (Date.now() > tickDeadline) break;

      // Dispara o broadcast via evolution-action — AGUARDA para não ser cancelado pelo Deno
      try {
        const r = await fetch(`${SUPA_URL}/functions/v1/evolution-action`, {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${SUPA_KEY}`,
          },
          body: JSON.stringify({
            action:      "broadcast",
            empresa_id:  camp.empresa_id,
            campanha_id: camp.id,
            budget_ms:   FATIA_MS,
          }),
        });
        const result = await r.json().catch(() => ({}));
        // Campanha só esperando o intervalo de repetição não gastou tempo nem
        // enviou nada: não consome a vaga do tick, senão bloquearia as outras
        // durante todo o intervalo (que pode ser de horas).
        const apenasAguardando = !!(result?.aguardando_rodada || result?.aguardando_repeticao);
        if (!apenasAguardando) campaignsTriggered++;
        console.log(`[send-scheduled] campanha ${camp.id}:`, result);
      } catch (e) {
        console.error(`[send-scheduled] broadcast error campanha ${camp.id}:`, e);
        // Mantém 'enviando': o tick seguinte retoma pelos contatos pendentes.
        // Reverter para 'agendado' deixava campanhas com agendado_para nulo
        // fora da consulta de pendentes, presas para sempre.
      }
    }
  } catch (e) {
    console.error("[send-scheduled] erro ao verificar campanhas:", e);
  }

  console.log(`[send-scheduled] sent=${sent} failed=${failed} campanhas=${campaignsTriggered}`);
}
