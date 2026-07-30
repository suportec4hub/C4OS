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

// Move a conversa para outra empresa do mesmo grupo e avisa o WhatsApp dela.
// A conversa é recriada no destino para que as respostas saiam pelo número da
// empresa de destino, e não pelo da origem.
// deno-lint-ignore no-explicit-any
async function transferirParaEmpresa(
  conversaId: string, origemId: string, destinoId: string, conversa: any, phone: string,
): Promise<boolean> {
  // O destino precisa ser do mesmo grupo. A validação é feita aqui porque o
  // motor roda com service role: aceitar o id vindo do fluxo sem conferir
  // permitiria transferir conversa para qualquer empresa da base.
  const { data: par } = await supabase.rpc('empresas_sao_do_mesmo_grupo', {
    a: origemId, b: destinoId,
  });
  if (par !== true) {
    console.error(`[transferir] ${destinoId} não é do mesmo grupo de ${origemId}`);
    return false;
  }

  const { data: dest } = await supabase.from('empresas')
    .select('id, nome, telefone, evolution_instance_id')
    .eq('id', destinoId).maybeSingle();
  if (!dest?.evolution_instance_id) {
    console.error(`[transferir] empresa ${destinoId} sem WhatsApp conectado`);
    return false;
  }

  const { data: origem } = await supabase.from('empresas')
    .select('nome').eq('id', origemId).maybeSingle();

  // Reaproveita a conversa que o destino já tenha com este contato.
  const { data: existente } = await supabase.from('conversas')
    .select('id').eq('empresa_id', destinoId).eq('contato_telefone', phone).maybeSingle();

  let destinoConversaId = existente?.id as string | undefined;
  if (!destinoConversaId) {
    const { data: nova, error } = await supabase.from('conversas').insert({
      empresa_id: destinoId,
      contato_telefone: phone,
      contato_nome: conversa.contato_nome || phone,
      contato_lid: conversa.contato_lid ?? null,
      status: 'aberta',
      canal: conversa.canal || 'whatsapp',
      bot_ativo: false,
      nao_lidas: 1,
      ultima_mensagem: conversa.ultima_mensagem || '',
      ultima_hora: new Date().toISOString(),
      transferida_de_empresa_id: origemId,
    }).select('id').single();
    if (error || !nova) {
      console.error('[transferir] falha ao criar conversa no destino:', error);
      return false;
    }
    destinoConversaId = nova.id;
  } else {
    await supabase.from('conversas').update({
      status: 'aberta', bot_ativo: false,
      transferida_de_empresa_id: origemId,
      ultima_hora: new Date().toISOString(),
    }).eq('id', destinoConversaId);
  }

  // Copia o histórico recente para o destino entender o contexto.
  const { data: hist } = await supabase.from('mensagens')
    .select('texto, tipo, de, remetente, hora')
    .eq('conversa_id', conversaId)
    .order('hora', { ascending: false })
    .limit(20);

  if (hist?.length) {
    await supabase.from('mensagens').insert(
      // deno-lint-ignore no-explicit-any
      hist.slice().reverse().map((m: any) => ({
        conversa_id: destinoConversaId,
        empresa_id: destinoId,
        texto: m.texto,
        tipo: m.tipo || 'texto',
        de: m.de,
        remetente: m.remetente,
        hora: m.hora,
      })),
    );
  }

  // Avisa o WhatsApp do destino, pelo número da origem.
  if (dest.telefone) {
    const aviso =
      `🔄 *Conversa transferida${origem?.nome ? ` de ${origem.nome}` : ''}*\n\n` +
      `Cliente: ${conversa.contato_nome || 'sem nome'}\n` +
      `Telefone: ${phone}\n` +
      (conversa.ultima_mensagem ? `Última mensagem: ${String(conversa.ultima_mensagem).slice(0, 200)}` : '');
    await enviarWhatsApp(origemId, String(dest.telefone), aviso);
  }

  // Encerra na origem, registrando para onde foi.
  await supabase.from('conversas').update({
    bot_ativo: false,
    bot_ultimo_no: null,
    status: 'resolvida',
    transferido_em: new Date().toISOString(),
    nota_interna: `Transferida para ${dest.nome} (WhatsApp ${dest.telefone || 'sem número'})`,
  }).eq('id', conversaId);

  return true;
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

    const destino = String(no.transferir_tipo || 'fila');

    // Transferência para o WhatsApp de outra empresa do mesmo grupo.
    if (destino === 'empresa' && no.transferir_empresa_id) {
      const ok = await transferirParaEmpresa(
        conversaId, empresaId, String(no.transferir_empresa_id), conversa, phone,
      );
      if (ok) return { proximoNoId: null, aguardando: false };
      // Falhou (destino inválido ou sem WhatsApp): cai no encerramento normal
      // abaixo, deixando a conversa aberta para atendimento local.
    }

    // Atribuição interna. Antes esses campos eram gravados pelo builder mas
    // ignorados aqui: escolher setor ou atendente não tinha efeito nenhum.
    const atribuicao: Record<string, unknown> = {
      bot_ativo: false,
      bot_ultimo_no: null,
      status: 'aberta',
    };
    if (destino === 'setor' && no.transferir_setor_id) {
      atribuicao.setor_id = no.transferir_setor_id;
    } else if (destino === 'usuario' && no.transferir_usuario_id) {
      atribuicao.atendente_id = no.transferir_usuario_id;
    }

    await supabase.from('conversas').update(atribuicao).eq('id', conversaId);
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
