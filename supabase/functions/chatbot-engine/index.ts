import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// ── Helpers ─────────────────────────────────────────────────────────────────
function dentroDaHora(cfg: any): boolean {
  const now = new Date();
  const dia = now.getDay(); // 0=Dom
  if (!cfg.dias_semana?.includes(dia)) return false;
  const hhmm = (d: Date) => d.getHours() * 60 + d.getMinutes();
  const ini = cfg.horario_inicio?.split(':').map(Number);
  const fim = cfg.horario_fim?.split(':').map(Number);
  if (!ini || !fim) return true;
  const cur = hhmm(now);
  const iniMin = ini[0] * 60 + ini[1];
  const fimMin = fim[0] * 60 + fim[1];
  return cur >= iniMin && cur <= fimMin;
}

function substituir(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (_, k) => vars[k] || '');
}

async function enviarWhatsApp(empresaId: string, phone: string, message: string) {
  await supabase.functions.invoke('evolution-action', {
    body: { action: 'send', empresa_id: empresaId, phone, message },
  });
}

async function salvarMensagemBot(conversaId: string, empresaId: string, texto: string) {
  await supabase.from('mensagens').insert({
    conversa_id: conversaId,
    empresa_id: empresaId,
    remetente: 'bot',
    texto,
    tipo: 'texto',
    de: 'bot',
    hora: new Date().toISOString(),
  });
  // Atualiza última mensagem da conversa
  await supabase.from('conversas').update({
    ultima_mensagem: texto,
    ultima_hora: new Date().toISOString(),
  }).eq('id', conversaId);
}

// ── Executor de nó ──────────────────────────────────────────────────────────
async function executarNo(
  no: any,
  nos: any[],
  conexoes: any[],
  conversa: any,
  mensagemUsuario: string,
  vars: Record<string, string>
): Promise<{ proximoNoId: string | null; aguardando: boolean }> {
  const tipo = no.tipo;
  const phone = conversa.contato_telefone;
  const empresaId = conversa.empresa_id;
  const conversaId = conversa.id;

  // ── mensagem simples ──
  if (tipo === 'mensagem' || tipo === 'inicio') {
    if (no.mensagem) {
      const texto = substituir(no.mensagem, {
        nome: conversa.contato_nome || 'visitante',
        ...vars,
      });
      await enviarWhatsApp(empresaId, phone, texto);
      await salvarMensagemBot(conversaId, empresaId, texto);
    }
    // Avança para o próximo nó conectado automaticamente
    const prox = conexoes.find((c: any) => c.de === no.id);
    return { proximoNoId: prox?.para || null, aguardando: false };
  }

  // ── menu de opções ──
  if (tipo === 'opcoes') {
    const opcoes: string[] = (no.opcoes || []).filter(Boolean);
    const intro = substituir(no.mensagem || 'Escolha uma opção:', { nome: conversa.contato_nome || 'visitante', ...vars });
    const lista = opcoes.map((o: string, i: number) => `${i + 1}. ${o}`).join('\n');
    const texto = `${intro}\n\n${lista}`;
    await enviarWhatsApp(empresaId, phone, texto);
    await salvarMensagemBot(conversaId, empresaId, texto);
    return { proximoNoId: no.id, aguardando: true }; // aguarda a escolha
  }

  // ── resposta a opção (já aguardava) ──
  if (tipo === 'opcoes_resposta') {
    const opcoes: string[] = (no.opcoes || []).filter(Boolean);
    const idx = parseInt(mensagemUsuario.trim()) - 1;
    // Busca conexão rotulada com o índice ou fallback
    const conxLabel = conexoes.find((c: any) => c.de === no.id && c.label === String(idx + 1))
      || conexoes.find((c: any) => c.de === no.id && c.label === (opcoes[idx] || '').toLowerCase())
      || conexoes.find((c: any) => c.de === no.id); // fallback: primeira conexão
    return { proximoNoId: conxLabel?.para || null, aguardando: false };
  }

  // ── condição ──
  if (tipo === 'condicao') {
    const gatilhos = (no.gatilhos || '').toLowerCase().split(',').map((g: string) => g.trim()).filter(Boolean);
    const matchou = gatilhos.some((g: string) => mensagemUsuario.toLowerCase().includes(g));
    // Conexões: rotule a 'sim' e 'nao' no editor; fallback para primeira
    const cSim = conexoes.find((c: any) => c.de === no.id && c.label?.toLowerCase().includes('sim'))
      || (matchou ? conexoes.find((c: any) => c.de === no.id) : null);
    const cNao = conexoes.find((c: any) => c.de === no.id && c.label?.toLowerCase().includes('nao'))
      || (!matchou ? conexoes.find((c: any) => c.de === no.id) : null);
    const prox = matchou ? cSim : cNao;
    return { proximoNoId: prox?.para || null, aguardando: false };
  }

  // ── aguardar input ──
  if (tipo === 'aguardar') {
    // Na primeira vez: envia mensagem e fica esperando
    // Se já está aguardando (chamado com mensagem do usuário): salva variável e avança
    const jaAguardava = conversa.bot_ultimo_no === no.id;
    if (!jaAguardava) {
      if (no.mensagem) {
        const texto = substituir(no.mensagem, { nome: conversa.contato_nome || '', ...vars });
        await enviarWhatsApp(empresaId, phone, texto);
        await salvarMensagemBot(conversaId, empresaId, texto);
      }
      return { proximoNoId: no.id, aguardando: true };
    } else {
      // Salva resposta como variável
      if (no.variavel) {
        vars[no.variavel] = mensagemUsuario;
        await supabase.from('conversas').update({ bot_variaveis: vars }).eq('id', conversaId);
      }
      const prox = conexoes.find((c: any) => c.de === no.id);
      return { proximoNoId: prox?.para || null, aguardando: false };
    }
  }

  // ── transferir para humano ──
  if (tipo === 'transferir') {
    if (no.mensagem) {
      const texto = substituir(no.mensagem, { nome: conversa.contato_nome || '', ...vars });
      await enviarWhatsApp(empresaId, phone, texto);
      await salvarMensagemBot(conversaId, empresaId, texto);
    }
    await supabase.from('conversas').update({
      bot_ativo: false,
      bot_ultimo_no: null,
      status: 'aberta',
    }).eq('id', conversaId);
    return { proximoNoId: null, aguardando: false };
  }

  // ── encerrar ──
  if (tipo === 'encerrar') {
    if (no.mensagem) {
      const texto = substituir(no.mensagem, { nome: conversa.contato_nome || '', ...vars });
      await enviarWhatsApp(empresaId, phone, texto);
      await salvarMensagemBot(conversaId, empresaId, texto);
    }
    await supabase.from('conversas').update({
      bot_ativo: false,
      bot_ultimo_no: null,
      status: 'resolvida',
    }).eq('id', conversaId);
    return { proximoNoId: null, aguardando: false };
  }

  return { proximoNoId: null, aguardando: false };
}

// ── Handler principal ────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  }

  try {
    const body = await req.json();
    const { empresa_id, phone, message, conversa_id } = body;

    if (!empresa_id || !phone || !message) {
      return new Response(JSON.stringify({ error: 'empresa_id, phone e message são obrigatórios' }), { status: 400 });
    }

    // 1. Busca config do chatbot
    const { data: cfg } = await supabase
      .from('chatbot_config')
      .select('*')
      .eq('empresa_id', empresa_id)
      .maybeSingle();

    if (!cfg?.ativo) {
      return new Response(JSON.stringify({ skip: true, reason: 'bot_inativo' }), { status: 200 });
    }

    // 2. Verifica palavra de transferência manual
    const palavraTransf = (cfg.transferir_palavra || 'atendente').toLowerCase();
    if (message.toLowerCase().includes(palavraTransf)) {
      if (conversa_id) {
        await supabase.from('conversas').update({ bot_ativo: false, bot_ultimo_no: null }).eq('id', conversa_id);
      }
      return new Response(JSON.stringify({ skip: false, action: 'transferido_para_humano' }), { status: 200 });
    }

    // 3. Verifica horário comercial
    const dentroHorario = dentroDaHora(cfg);

    // 4. Busca ou cria conversa
    let conversa: any;
    if (conversa_id) {
      const { data } = await supabase.from('conversas').select('*').eq('id', conversa_id).single();
      conversa = data;
    } else {
      const { data } = await supabase.from('conversas')
        .select('*')
        .eq('empresa_id', empresa_id)
        .eq('contato_telefone', phone)
        .eq('status', 'aberta')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      conversa = data;
    }

    // 5. Fora do horário
    if (!dentroHorario) {
      if (cfg.mensagem_fora_horario && conversa) {
        await enviarWhatsApp(empresa_id, phone, cfg.mensagem_fora_horario);
        await salvarMensagemBot(conversa.id, empresa_id, cfg.mensagem_fora_horario);
      }
      return new Response(JSON.stringify({ skip: false, action: 'fora_horario' }), { status: 200 });
    }

    // 6. Verifica se fluxo visual está configurado
    const fluxoId = cfg.fluxo_ativo_id;
    if (!fluxoId) {
      // Sem fluxo visual: usa apenas gatilhos (processados pelo frontend)
      return new Response(JSON.stringify({ skip: true, reason: 'sem_fluxo_visual' }), { status: 200 });
    }

    // 7. Carrega o fluxo
    const { data: fluxo } = await supabase
      .from('chatbot_fluxos')
      .select('nos, conexoes, ativo, usuario_id')
      .eq('id', fluxoId)
      .single();

    if (!fluxo?.ativo) {
      return new Response(JSON.stringify({ skip: true, reason: 'fluxo_inativo' }), { status: 200 });
    }

    // Fluxos com usuario_id são fluxos de vendedor específico:
    // só executam quando a conversa está atribuída exatamente àquele vendedor.
    const fluxoVendedorId = (fluxo.usuario_id ?? null) as string | null;
    if (fluxoVendedorId) {
      const convAtendenteId = (conversa?.atendente_id ?? null) as string | null;
      if (convAtendenteId !== fluxoVendedorId) {
        return new Response(JSON.stringify({ skip: true, reason: 'fluxo_nao_pertence_ao_vendedor' }), { status: 200 });
      }
    }

    const nos: any[] = fluxo.nos || [];
    const conexoes: any[] = fluxo.conexoes || [];

    // 8. Nova conversa — envia boas-vindas e inicia fluxo
    if (!conversa || !conversa.bot_ativo) {
      // Se não há conversa ativa, cria/reativa com bot
      if (!conversa) {
        const { data: novaConv } = await supabase.from('conversas').insert({
          empresa_id,
          contato_telefone: phone,
          contato_nome: phone,
          status: 'aberta',
          bot_ativo: true,
          bot_ultimo_no: 'inicio',
          ultima_mensagem: message,
          ultima_hora: new Date().toISOString(),
        }).select().single();
        conversa = novaConv;
      } else {
        await supabase.from('conversas').update({ bot_ativo: true, bot_ultimo_no: 'inicio' }).eq('id', conversa.id);
        conversa = { ...conversa, bot_ativo: true, bot_ultimo_no: 'inicio' };
      }

      // Envia boas-vindas se configurado
      if (cfg.mensagem_boas_vindas) {
        await enviarWhatsApp(empresa_id, phone, cfg.mensagem_boas_vindas);
        await salvarMensagemBot(conversa.id, empresa_id, cfg.mensagem_boas_vindas);
      }
    }

    if (!conversa) {
      return new Response(JSON.stringify({ error: 'conversa_nao_encontrada' }), { status: 200 });
    }

    // 9. Descobre o nó atual
    const noAtualId = conversa.bot_ultimo_no || 'inicio';
    let noAtual = nos.find((n: any) => n.id === noAtualId);
    if (!noAtual) {
      noAtual = nos.find((n: any) => n.tipo === 'inicio');
    }
    if (!noAtual) {
      return new Response(JSON.stringify({ error: 'no_inicio_nao_encontrado' }), { status: 200 });
    }

    const vars: Record<string, string> = conversa.bot_variaveis || {};

    // 10. Executa o nó atual (pode ser uma cadeia até chegar em aguardar/encerrar/transferir)
    let noCorrente = noAtual;
    let iteracoes = 0;
    const MAX_ITER = 20;

    while (noCorrente && iteracoes < MAX_ITER) {
      iteracoes++;
      const { proximoNoId, aguardando } = await executarNo(
        noCorrente, nos, conexoes, conversa, message, vars
      );

      // Atualiza bot_ultimo_no
      if (aguardando) {
        await supabase.from('conversas').update({ bot_ultimo_no: noCorrente.id }).eq('id', conversa.id);
        break;
      }

      if (!proximoNoId) {
        // Fim do fluxo
        await supabase.from('conversas').update({ bot_ultimo_no: null }).eq('id', conversa.id);
        break;
      }

      const proximoNo = nos.find((n: any) => n.id === proximoNoId);
      if (!proximoNo) break;

      await supabase.from('conversas').update({ bot_ultimo_no: proximoNoId }).eq('id', conversa.id);
      noCorrente = proximoNo;

      // Se o próximo é aguardar/opcoes/transferir/encerrar, para aqui
      // (será processado na próxima mensagem do usuário)
      if (['opcoes', 'aguardar', 'transferir', 'encerrar'].includes(noCorrente.tipo)) {
        const r = await executarNo(noCorrente, nos, conexoes, conversa, message, vars);
        if (r.aguardando) {
          await supabase.from('conversas').update({ bot_ultimo_no: noCorrente.id }).eq('id', conversa.id);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ ok: true, iteracoes }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err: any) {
    console.error('[chatbot-engine]', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
