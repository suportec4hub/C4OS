import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  bg:       "#0b1120",
  sidebar:  "#111827",
  card:     "#1e293b",
  cardHov:  "#243044",
  border:   "#1f2d3f",
  borderLt: "#2d3f55",
  text:     "#f1f5f9",
  muted:    "#7a8fa6",
  green:    "#10b981",
  greenBg:  "#052e1a",
  greenBd:  "#065f46",
  teal:     "#06b6d4",
  blue:     "#3b82f6",
  purple:   "#8b5cf6",
  yellow:   "#f59e0b",
  pink:     "#ec4899",
  red:      "#f87171",
  slate:    "#64748b",
  wa:       "#25d366",
  white:    "#fff",
};

// ─── Conteúdo dos módulos ─────────────────────────────────────────────────────
const buildModules = (hasMultiInstancia) => [
  {
    id: "primeiros-passos",
    title: "Primeiros Passos",
    icon: "🚀",
    color: C.green,
    desc: "Configure sua conta e conheça a plataforma",
    lessons: [
      {
        id: "visao-geral",
        title: "Visão Geral do C4OS",
        duration: "5 min",
        type: "leitura",
        sections: [
          { kind: "text", title: "O que é o C4OS?", body: "C4OS é um sistema integrado que une gestão de leads, atendimento via WhatsApp, automação com chatbot, disparos em massa e relatórios em uma única plataforma. Desenvolvido para empresas que usam WhatsApp como principal canal de comunicação." },
          { kind: "list", title: "Principais módulos", items: ["📊 Dashboard — visão geral de métricas e desempenho da equipe","👥 Leads — gestão completa do funil de vendas e prospecção","💬 WhatsApp — inbox centralizado de atendimento","🤖 Chatbot — automação de respostas com fluxos inteligentes","📣 Disparos — campanhas de mensagem em massa segmentadas","📅 Follow-ups — acompanhamento automático de clientes","📈 Relatórios — análise de resultados e desempenho"] },
          { kind: "text", title: "Navegação básica", body: "No menu lateral você encontra todos os módulos. Clique em qualquer item para acessar. A barra superior exibe notificações e acesso às configurações da conta." },
        ],
        tip: "Reserve os primeiros 15 minutos para navegar por todos os módulos sem fazer nada — só para se familiarizar com a plataforma.",
      },
      {
        id: "configurar-empresa",
        title: "Configurando sua Empresa",
        duration: "8 min",
        type: "prática",
        sections: [
          { kind: "steps", title: "Acessando as Configurações", steps: ["Clique em Empresa no menu lateral","Você verá quatro abas: Informações, Chatbot, Relatórios e Integrações","Comece sempre pela aba Informações"] },
          { kind: "steps", title: "Informações essenciais", steps: ["Preencha o nome da empresa como deve aparecer para os clientes","Configure o horário de atendimento — usado pelo chatbot para mensagens fora do horário","Adicione logo e dados de contato","Clique em Salvar"] },
          { kind: "steps", title: "Criando setores", steps: ["Acesse Configurações → Setores","Clique em + Novo Setor","Defina nome e atendentes responsáveis (ex: Vendas, Suporte, Financeiro)","Cada conversa pode ser direcionada ao setor correto pelo chatbot"] },
        ],
        tip: "Configurar o horário de atendimento corretamente faz o chatbot responder 'estamos fora do horário' automaticamente, sem intervenção manual.",
      },
      {
        id: "conectar-whatsapp",
        title: "Conectando o WhatsApp",
        duration: "10 min",
        type: "prática",
        sections: [
          { kind: "list", title: "⚠️ Antes de começar", items: ["Use um número de WhatsApp Business dedicado para a empresa","Não use um número pessoal","O número não pode estar conectado em outro sistema ou aparelho"] },
          { kind: "steps", title: "Conectando via QR Code", steps: ["Acesse Empresa → Integrações → WhatsApp via Evolution GO","Clique em Conectar — aparecerá um QR Code","No celular do número que deseja conectar: Configurações → Aparelhos Conectados → Conectar aparelho","Escaneie o QR Code com o celular","Aguarde o status mudar para 🟢 Conectado"] },
          { kind: "steps", title: "Verificando a conexão", steps: ["Envie uma mensagem de teste para o número conectado","A mensagem deve aparecer automaticamente na aba WhatsApp do C4OS","Se não aparecer em 30 segundos, clique em Verificar Status"] },
        ],
        tip: "Mantenha o celular com internet estável e não desconecte do WhatsApp. A conexão precisa do celular ativo para funcionar.",
      },
      {
        id: "convidar-equipe",
        title: "Convidando sua Equipe",
        duration: "6 min",
        type: "prática",
        sections: [
          { kind: "list", title: "Perfis de acesso", items: ["👑 Administrador — acesso total, incluindo configurações e relatórios","💼 Atendente/Vendedor — inbox, leads e follow-ups","📊 Gerente — relatórios e visão completa da equipe","💰 Financeiro — contratos, propostas e relatórios financeiros"] },
          { kind: "steps", title: "Convidando um membro", steps: ["Vá em Configurações → Equipe","Clique em + Convidar Membro","Preencha nome, e-mail e selecione o cargo","O sistema envia o convite por e-mail","O novo membro define a senha no primeiro acesso"] },
          { kind: "steps", title: "Configurando visibilidade", steps: ["Edite o membro desejado","Configure: só o próprio inbox / meu setor / toda a empresa","Ajuste quais setores o atendente pode atender","Salve"] },
        ],
        tip: "Recomendamos no máximo 2 administradores por empresa para manter a segurança das configurações.",
      },
    ],
  },

  {
    id: "gestao-leads",
    title: "Gestão de Leads",
    icon: "👥",
    color: C.blue,
    desc: "Capture, organize e acompanhe seus contatos",
    lessons: [
      {
        id: "criando-leads",
        title: "Criando e Importando Leads",
        duration: "8 min",
        type: "prática",
        sections: [
          { kind: "steps", title: "Criando um lead manualmente", steps: ["Acesse Leads no menu lateral","Clique em + Novo Lead","Preencha nome, telefone com DDD, e-mail e outras informações","Selecione a etapa do funil (Novo, Qualificado, Proposta...)","Atribua a um vendedor se necessário","Salve"] },
          { kind: "steps", title: "Importando lista de contatos", steps: ["Na tela de Leads, clique em Importar","Baixe o modelo de planilha CSV","Preencha com seus contatos (nome e telefone obrigatórios)","Faça upload do arquivo preenchido","Revise na prévia e confirme a importação"] },
          { kind: "list", title: "Campos importantes", items: ["📱 Telefone: sempre com DDD (ex: 11999999999)","🏷️ Tags: para segmentar e filtrar leads","📍 Origem: de onde veio (Instagram, Site, Indicação)","💰 Valor: estimativa do negócio"] },
        ],
        tip: "Telefones duplicados são identificados automaticamente. O sistema avisa antes de criar um lead já existente.",
      },
      {
        id: "pipeline",
        title: "Usando o Kanban de Pipeline",
        duration: "10 min",
        type: "prática",
        sections: [
          { kind: "steps", title: "Navegando no Pipeline", steps: ["Acesse Pipeline no menu lateral","Você verá colunas representando cada etapa do funil","Cada cartão é um lead com nome, telefone e valor","Clique em um cartão para ver detalhes completos"] },
          { kind: "steps", title: "Movendo leads entre etapas", steps: ["Arraste o cartão para a coluna da nova etapa","Ou abra o lead e altere o campo Etapa","O sistema registra automaticamente a data da mudança"] },
          { kind: "steps", title: "Personalizando as etapas", steps: ["Vá em Configurações → Pipeline","Clique em + Nova Etapa","Arraste para reordenar","Configure cor e nome de cada etapa"] },
        ],
        tip: "Use os filtros no topo do Pipeline para ver leads de um vendedor específico, período ou valor mínimo.",
      },
      {
        id: "tags-segmentacao",
        title: "Tags e Segmentação",
        duration: "7 min",
        type: "leitura",
        sections: [
          { kind: "text", title: "O que são tags?", body: "Tags são etiquetas para categorizar leads. Exemplos: 'cliente-vip', 'interesse-produto-x', 'follow-up-agosto'. Permitem filtros precisos e campanhas segmentadas." },
          { kind: "steps", title: "Adicionando tags a um lead", steps: ["Abra o lead desejado","Clique no campo Tags","Digite o nome e pressione Enter","Tags existentes aparecem como sugestão automaticamente"] },
          { kind: "steps", title: "Usando tags para campanhas", steps: ["Ao criar um disparo, selecione destinatários por Tag","Filtre leads com múltiplas tags simultaneamente","Combine tags com etapa do funil para segmentação precisa"] },
        ],
        tip: "Padronize os nomes das tags com sua equipe. Use sempre 'produto-a' e não 'Produto A' ou 'prod-a' — tags diferenciam maiúsculas.",
      },
      {
        id: "followup",
        title: "Follow-ups Automáticos",
        duration: "9 min",
        type: "prática",
        sections: [
          { kind: "text", title: "O que é um follow-up?", body: "Uma mensagem automática enviada quando o lead não responde por um período definido. Exemplo: se ficar 2 dias sem resposta, o sistema envia automaticamente 'Oi! Posso te ajudar com alguma dúvida?'" },
          { kind: "steps", title: "Criando um follow-up", steps: ["Acesse Follow-ups no menu lateral","Clique em + Novo Follow-up","Defina o gatilho: quantas horas/dias sem resposta","Escreva a mensagem de acompanhamento","Selecione quais leads recebem (por tag, etapa ou todos)","Ative e salve"] },
          { kind: "list", title: "Sequência recomendada", items: ["⏱️ 1º: 24h após sem resposta — check-in gentil","⏱️ 2º: 3 dias após — oferta ou conteúdo de valor","⏱️ 3º: 7 dias após — mensagem de encerramento","✋ Para automaticamente quando o lead responde"] },
        ],
        tip: "Use {{nome}} nas mensagens para personalizar: 'Oi {{nome}}, tudo bem?' vira 'Oi João, tudo bem?' automaticamente.",
      },
      {
        id: "historico",
        title: "Histórico e Anotações",
        duration: "5 min",
        type: "leitura",
        sections: [
          { kind: "steps", title: "Visualizando o histórico", steps: ["Abra qualquer lead","Aba Histórico: todas as mensagens WhatsApp trocadas","Aba Atividades: ligações, reuniões e tarefas registradas","Aba Anotações: notas da equipe sobre o lead"] },
          { kind: "steps", title: "Adicionando anotações", steps: ["Abra o lead → aba Anotações","Clique em + Nova Anotação","Escreva o conteúdo — visível para toda a equipe","Marque como privada se quiser que só você veja"] },
        ],
        tip: "Use anotações para contexto importante: 'prefere contato depois das 14h' ou 'aguardando aprovação do diretor financeiro'.",
      },
    ],
  },

  {
    id: "whatsapp-atendimento",
    title: "WhatsApp & Atendimento",
    icon: "💬",
    color: C.wa,
    desc: "Domine o inbox centralizado de atendimento",
    lessons: [
      {
        id: "inbox",
        title: "Usando o Inbox de Atendimento",
        duration: "10 min",
        type: "prática",
        sections: [
          { kind: "list", title: "Layout do Inbox", items: ["📋 Esquerda: lista de conversas com filtros de status","💬 Centro: mensagens da conversa selecionada","👤 Direita: informações do lead e histórico completo"] },
          { kind: "list", title: "Status das conversas", items: ["🟡 Aguardando — nova mensagem, sem atendente","🟢 Em atendimento — alguém assumiu a conversa","✅ Resolvida — conversa finalizada","🔵 Bot — chatbot está respondendo automaticamente"] },
          { kind: "steps", title: "Assumindo uma conversa", steps: ["Clique na conversa na lista à esquerda","Clique em Assumir Atendimento","O status muda para Em Atendimento","Agora você pode responder o cliente"] },
          { kind: "steps", title: "Transferindo uma conversa", steps: ["Na conversa aberta, clique em Transferir","Selecione o atendente ou setor de destino","Adicione uma nota explicando o motivo (opcional)","O destinatário recebe uma notificação em tempo real"] },
        ],
        tip: "Ative as notificações do navegador para ser alertado quando uma nova mensagem chegar — não perca nenhum cliente esperando.",
      },
      {
        id: "respostas-rapidas",
        title: "Respostas Rápidas",
        duration: "7 min",
        type: "prática",
        sections: [
          { kind: "steps", title: "Criando respostas rápidas", steps: ["Acesse Configurações → Respostas Rápidas","Clique em + Nova Resposta Rápida","Defina um atalho (ex: /ola) e o texto completo","Salve — disponível para toda a equipe"] },
          { kind: "steps", title: "Usando no atendimento", steps: ["Na caixa de mensagem, digite / (barra)","Uma lista de atalhos aparece automaticamente","Selecione ou continue digitando para filtrar","Enter para inserir o texto completo"] },
          { kind: "list", title: "Exemplos úteis", items: ["/ola — 'Olá! Como posso te ajudar hoje? 😊'","/aguarda — 'Um momento, já te atendo!'","/horario — 'Atendemos de segunda a sexta, 8h às 18h.'","/obrigado — 'Obrigado pelo contato! Qualquer dúvida, é só chamar 🙏'"] },
        ],
        tip: "Use {{nome}} nas respostas rápidas para personalizar automaticamente com o nome do cliente.",
      },
      {
        id: "round-robin",
        title: "Distribuição Automática",
        duration: "8 min",
        type: "leitura",
        sections: [
          { kind: "text", title: "Como funciona o Round-Robin", body: "O sistema distribui conversas novas de forma rotativa entre os atendentes ativos. Com 3 atendentes (A, B, C), a sequência é A → B → C → A → B → C... garantindo distribuição equilibrada." },
          { kind: "steps", title: "Configurando", steps: ["Vá em Empresa → Chatbot","Ative a Distribuição Automática (Round-Robin)","Selecione quais atendentes participam da fila","Configure se é por setor ou geral"] },
          { kind: "text", title: "Distribuição por setor", body: "O chatbot pode identificar o assunto (Vendas ou Suporte) e distribuir apenas para atendentes do setor correto, sem misturar equipes." },
        ],
        tip: "Atendentes offline são pulados na distribuição. Lembre a equipe de atualizar o status ao sair para não deixar conversas sem atendimento.",
      },
      {
        id: "csat",
        title: "Avaliação de Atendimento (CSAT)",
        duration: "6 min",
        type: "leitura",
        sections: [
          { kind: "text", title: "O que é CSAT?", body: "Customer Satisfaction Score: pesquisa curta enviada ao cliente após encerrar o atendimento. O cliente avalia de 1 a 5 estrelas e pode deixar um comentário sobre a experiência." },
          { kind: "steps", title: "Ativando o CSAT", steps: ["Vá em Empresa → Chatbot","Role até a seção CSAT","Ative a pesquisa de satisfação","Personalize a mensagem de avaliação","Defina quantos minutos após encerrar para enviar"] },
          { kind: "steps", title: "Visualizando resultados", steps: ["Acesse Relatórios → aba CSAT","Veja a média geral e por atendente","Filtre por período para comparar desempenho","Exporte os dados em CSV"] },
        ],
        tip: "Configure alertas para que supervisores sejam notificados quando um cliente der nota 1 ou 2 — permita resolver rapidamente.",
      },
      {
        id: "encerramento",
        title: "Encerrando Conversas",
        duration: "5 min",
        type: "prática",
        sections: [
          { kind: "steps", title: "Encerrando corretamente", steps: ["Na conversa aberta, clique em Encerrar Atendimento","Selecione o motivo (Resolvido, Sem resposta, Não qualificado...)","Adicione nota de encerramento se necessário","Confirme — o CSAT é enviado automaticamente se configurado"] },
          { kind: "text", title: "Conversas se reabrem automaticamente", body: "Se o cliente enviar uma nova mensagem após o encerramento, a conversa reabre e volta para a fila de atendimento automaticamente." },
          { kind: "steps", title: "Encontrando conversas encerradas", steps: ["No Inbox, use o filtro Status: Resolvida","Pesquise por nome ou telefone","Clique para ver o histórico completo"] },
        ],
        tip: "Um inbox limpo ajuda a equipe a focar. Encerre conversas resolvidas assim que terminar — evite acúmulo.",
      },
      ...(hasMultiInstancia ? [{
        id: "multi-instancia",
        title: "Multi-Instância WhatsApp",
        duration: "10 min",
        type: "prática",
        badge: "Recurso ativo",
        badgeColor: C.teal,
        sections: [
          { kind: "text", title: "O que é Multi-Instância?", body: "Com o Multi-Instância ativado na sua conta, você pode conectar múltiplos números de WhatsApp no mesmo inbox. Todas as conversas — de qualquer número — chegam unificadas em um único painel." },
          { kind: "list", title: "Como funciona", items: ["📲 Número principal: recebe mensagens, aciona chatbot, distribui para atendentes e faz disparos","👤 Números secundários (vendedores): recebem mensagens e sincronizam o histórico — sem bot e sem automação","💡 Mesmo cliente em dois números = mesmo chat, nenhuma mensagem se perde"] },
          { kind: "steps", title: "Conectando um número secundário", steps: ["Vá em Empresa → Integrações → Números Secundários","Clique em + Adicionar","Digite o nome do vendedor (ex: João Silva)","Clique em Conectar e escaneie o QR Code com o celular do vendedor","O status muda para 🟢 Conectado automaticamente","Repita para cada vendedor"] },
          { kind: "list", title: "Pontos importantes", items: ["Respostas pelo C4OS sempre saem pelo número principal","Mensagens que o vendedor envia pelo celular aparecem no histórico","Reconexão: se o WhatsApp do vendedor desconectar, gere novo QR no painel"] },
          { kind: "text", title: "⟳ Sincronização de histórico", body: "Ao conectar um número pela primeira vez, o WhatsApp envia automaticamente as mensagens recentes em segundo plano. No painel você verá o badge '⟳ Sincronizando histórico...' enquanto isso ocorre — o processo dura entre 2 e 10 minutos dependendo do volume." },
          { kind: "list", title: "Limitações da sincronização", items: ["📅 Período: apenas os últimos ~90 dias são sincronizados — limitação do próprio WhatsApp","⏳ Retroativo: mensagens de antes da conexão chegam somente durante a sincronização inicial; após isso, novas mensagens chegam em tempo real","🔄 Reconexão: se o número for desconectado e reconectado, o histórico do intervalo desconectado pode não ser recuperado","📵 Mensagens enviadas pelo celular do vendedor antes da conexão: aparecem no histórico via sincronização inicial, mas depende do WhatsApp ter esse histórico disponível no aparelho"] },
        ],
        tip: "Para maximizar o histórico sincronizado: conecte o número e deixe o WhatsApp do vendedor com internet estável por 10 minutos. Não desligue o celular durante esse período.",
      }] : []),
    ],
  },

  {
    id: "chatbot",
    title: "Chatbot & Automações",
    icon: "🤖",
    color: C.purple,
    desc: "Automatize o atendimento com fluxos inteligentes",
    lessons: [
      {
        id: "chatbot-basico",
        title: "Criando seu Primeiro Chatbot",
        duration: "12 min",
        type: "prática",
        sections: [
          { kind: "list", title: "O que o chatbot pode fazer", items: ["🎯 Apresentar sua empresa e capturar o nome do cliente","📋 Exibir menu de opções (Vendas, Suporte, Financeiro...)","📨 Direcionar para o setor ou atendente correto","📅 Verificar horário e responder fora do horário automaticamente","🤖 Responder perguntas frequentes sem intervenção humana"] },
          { kind: "steps", title: "Ativando o chatbot", steps: ["Vá em Empresa → Chatbot","Ative o Chatbot na seção principal","Configure a mensagem de boas-vindas","Adicione as opções do menu principal","Salve e teste enviando uma mensagem para o número da empresa"] },
          { kind: "steps", title: "Configurando o menu principal", steps: ["Cada opção pode encaminhar para setor, atendente específico ou submenu","Configure a mensagem de cada opção","Ordene as opções por prioridade","Adicione a opção 'Outras dúvidas' para capturar assuntos não listados"] },
        ],
        tip: "Teste o chatbot você mesmo! Envie mensagem do celular para o número da empresa e simule o fluxo antes de ativar para clientes.",
      },
      {
        id: "fluxo-visual",
        title: "Construtor Visual de Fluxos",
        duration: "15 min",
        type: "prática",
        sections: [
          { kind: "steps", title: "Acessando o Fluxo Visual", steps: ["No menu lateral, acesse Fluxo Visual","Clique em + Novo Fluxo","Dê um nome para identificar o fluxo","O editor visual abrirá em tela cheia"] },
          { kind: "list", title: "Elementos disponíveis", items: ["💬 Mensagem: envia texto, imagem ou arquivo","❓ Pergunta: aguarda resposta do cliente","📋 Menu: apresenta opções numeradas","🔀 Condição: ramifica baseado na resposta","👤 Atribuir: encaminha para atendente/setor","🏷️ Tag: adiciona tag ao lead automaticamente","⏰ Aguardar: pausa por período definido"] },
          { kind: "steps", title: "Criando um fluxo básico", steps: ["Arraste o elemento Mensagem para o canvas","Clique para editar o texto de boas-vindas","Arraste um Menu e conecte ao primeiro elemento","Configure as opções do menu","Para cada opção, conecte ao próximo passo","Salve e ative o fluxo"] },
        ],
        tip: "Sempre crie um caminho 'Outros / Não entendi' no fluxo para capturar respostas inesperadas e não deixar o cliente sem retorno.",
      },
      {
        id: "horario-fluxo",
        title: "Fluxos por Horário",
        duration: "8 min",
        type: "leitura",
        sections: [
          { kind: "text", title: "Dentro do horário", body: "O chatbot captura o nome do cliente e direciona para o atendente certo via round-robin ou setor específico." },
          { kind: "steps", title: "Configurando fora do horário", steps: ["Vá em Empresa → Chatbot","Ative a mensagem de fora do horário","Configure o texto (ex: 'Nosso atendimento é de 8h às 18h. Deixe sua mensagem!'","O chatbot envia e agenda o retorno para o próximo horário"] },
          { kind: "list", title: "Boas práticas", items: ["✅ Informe o próximo horário de retorno","✅ Colete o nome e motivo mesmo fora do horário","✅ Ofereça alternativa (site, e-mail para urgências)","❌ Nunca deixe o cliente completamente sem resposta"] },
        ],
        tip: "Configure feriados manualmente com antecedência para não deixar clientes sem resposta em datas especiais.",
      },
      {
        id: "chatbot-ia",
        title: "Chatbot com Inteligência Artificial",
        duration: "10 min",
        type: "leitura",
        sections: [
          { kind: "text", title: "O que a IA pode fazer", body: "A IA é treinada com informações sobre sua empresa que você cadastra — produtos, preços, políticas e processos. Ela responde perguntas de forma natural sem precisar mapear todas as respostas." },
          { kind: "steps", title: "Configurando a IA", steps: ["Acesse Empresa → Chatbot → Inteligência Artificial","Adicione informações sobre sua empresa (texto livre ou FAQ)","Configure o tom de voz (formal, informal, técnico)","Defina quando escalar para atendente humano","Ative e teste"] },
          { kind: "list", title: "IA vs. Fluxo fixo", items: ["🤖 IA: perguntas variadas, dúvidas sobre produto e preço","🌿 Fluxo fixo: processos específicos (agendamento, segunda via, contrato)","💡 Ideal: fluxo captura a intenção, IA responde as dúvidas"] },
        ],
        tip: "Revise semanalmente conversas que a IA não soube responder para melhorar continuamente a base de conhecimento.",
      },
    ],
  },

  {
    id: "disparos",
    title: "Disparos em Massa",
    icon: "📣",
    color: C.yellow,
    desc: "Crie e envie campanhas para sua base",
    lessons: [
      {
        id: "criando-campanha",
        title: "Criando uma Campanha",
        duration: "12 min",
        type: "prática",
        sections: [
          { kind: "list", title: "⚠️ Boas práticas antes de começar", items: ["Envie apenas para contatos que já interagiram com você","Personalize as mensagens com {{nome}}","Evite horários inadequados (madrugada, muito cedo)","Mantenha intervalos adequados entre mensagens"] },
          { kind: "steps", title: "Criando a campanha", steps: ["Acesse Disparos no menu lateral","Clique em + Nova Campanha","Defina o nome da campanha (interno)","Escreva a mensagem — use {{nome}} para personalizar","Adicione imagem ou arquivo se necessário"] },
          { kind: "steps", title: "Selecionando destinatários", steps: ["Escolha o método: Lista de leads, Tags ou CSV","Filtre por status, etapa do funil, data de cadastro","Revise a quantidade antes de confirmar","Configure o intervalo entre mensagens (mínimo: 3 segundos)"] },
        ],
        tip: "Sempre teste a campanha enviando para 5-10 contatos antes do disparo completo para verificar o texto e formatação.",
      },
      {
        id: "agendamento",
        title: "Agendando Disparos",
        duration: "6 min",
        type: "prática",
        sections: [
          { kind: "steps", title: "Agendando para o futuro", steps: ["Na criação da campanha, selecione Agendar em vez de Enviar Agora","Escolha data e hora do disparo","Confirme — campanha fica em status Agendada","Você pode cancelar ou editar até o momento do envio"] },
          { kind: "list", title: "Melhores horários", items: ["✅ Terça a quinta, 9h-11h — melhor abertura","✅ Terça a quinta, 14h-16h — boa abertura","⚠️ Segunda manhã — pessoas ocupadas ao chegar no trabalho","❌ Fins de semana — taxa de resposta baixa para B2B"] },
        ],
        tip: "Para B2C (varejo, serviços ao consumidor), finais de semana e noturno podem funcionar bem. Teste e analise sua audiência.",
      },
      {
        id: "monitorando",
        title: "Monitorando Resultados",
        duration: "8 min",
        type: "leitura",
        sections: [
          { kind: "list", title: "Métricas disponíveis", items: ["📨 Enviados: total de mensagens enviadas","✓✓ Entregues: chegaram ao celular do destinatário","👁️ Lidos: visualizados (check azul)","💬 Responderam: destinatários que responderam","❌ Erros: números inválidos ou bloqueios"] },
          { kind: "steps", title: "Visualizando no painel", steps: ["Na lista de campanhas, clique em Ver Resultado","Acompanhe o progresso em tempo real durante o envio","Após concluído, veja o relatório completo","Exporte os dados em CSV se necessário"] },
          { kind: "list", title: "Interpretando os resultados", items: ["Alta taxa de erro (>10%): limpe a base — números inválidos afetam a conta","Baixa taxa de resposta: revise o texto, horário ou segmentação","Muitos bloqueios: reduza frequência e melhore relevância"] },
        ],
        tip: "Campanhas com taxa de resposta acima de 15% são excelentes. A média do mercado é 8-12%.",
      },
      {
        id: "seguranca-disparos",
        title: "Segurança e Limites",
        duration: "7 min",
        type: "leitura",
        sections: [
          { kind: "text", title: "Por que existem limites?", body: "O WhatsApp monitora o comportamento das contas. Muitas mensagens em pouco tempo, alto número de bloqueios ou denúncias podem resultar em banimento temporário ou permanente do número." },
          { kind: "list", title: "Limites recomendados", items: ["🐢 Conta nova: máximo 100 mensagens/dia","📈 Crescimento gradual: aumente 20-30% por semana","✅ Conta estabelecida: até 1.000 mensagens/dia com segurança","⏱️ Intervalo: mínimo 3-5 segundos entre cada mensagem"] },
          { kind: "list", title: "Sinais de alerta", items: ["🚨 QR Code pedindo reconexão frequente","🚨 Mensagens não entregando (sem ✓)","🚨 Muitos contatos bloqueando a conta","⚡ Ação: pare por 48h e retome com volume menor"] },
        ],
        tip: "Qualidade vale mais que quantidade. 200 mensagens para a audiência certa valem mais que 1.000 para pessoas sem interesse.",
      },
    ],
  },

  {
    id: "relatorios",
    title: "Relatórios & Análises",
    icon: "📊",
    color: C.pink,
    desc: "Tome decisões baseadas em dados reais",
    lessons: [
      {
        id: "dashboard",
        title: "Lendo o Dashboard",
        duration: "8 min",
        type: "leitura",
        sections: [
          { kind: "list", title: "Cards de resumo", items: ["📥 Conversas hoje: total de conversas novas no dia","⏱️ Tempo médio de resposta: quanto tempo para a 1ª resposta","✅ Resolvidos hoje: conversas encerradas","⭐ CSAT médio: nota de satisfação dos clientes","👥 Leads novos: leads criados no período"] },
          { kind: "list", title: "Gráficos disponíveis", items: ["📈 Conversas por dia: tendência dos últimos 30 dias","🏆 Ranking de atendentes: quem mais atendeu e com melhor nota","🔄 Por setor: qual setor recebe mais demanda","📍 Origem dos leads: de onde vêm seus clientes"] },
          { kind: "steps", title: "Filtrando o Dashboard", steps: ["Use o seletor de período no canto superior direito","Escolha: Hoje, Esta semana, Este mês, Personalizado","Os dados atualizam automaticamente"] },
        ],
        tip: "Reserve 5 minutos toda manhã para verificar o Dashboard e identificar pontos de atenção antes de começar o dia.",
      },
      {
        id: "relatorio-atendimento",
        title: "Relatório de Atendimentos",
        duration: "10 min",
        type: "prática",
        sections: [
          { kind: "steps", title: "Acessando relatórios", steps: ["Clique em Relatórios no menu lateral","Selecione o tipo: Atendimentos, Leads, Campanhas ou CSAT","Defina o período e clique em Gerar"] },
          { kind: "list", title: "Métricas de atendimento", items: ["⏱️ TMR: Tempo Médio de Resposta — deve ser < 5 min no horário comercial","⏱️ TMA: Tempo Médio de Atendimento por conversa","📊 Taxa de resolução: % de conversas encerradas como Resolvida","🔄 Taxa de rejeição: % abandonadas sem resposta"] },
          { kind: "steps", title: "Exportando dados", steps: ["Após gerar, clique em Exportar","Escolha CSV (para Excel) ou PDF (para apresentações)","Use CSV para análises mais profundas no Google Sheets"] },
        ],
        tip: "Compare semana a semana. Uma queda no TMR pode indicar necessidade de reforço na equipe.",
      },
      {
        id: "funil-vendas",
        title: "Analisando o Funil de Vendas",
        duration: "7 min",
        type: "leitura",
        sections: [
          { kind: "text", title: "Entendendo o funil", body: "O relatório mostra quantos leads estão em cada etapa e qual a taxa de conversão entre elas. Ajuda a identificar onde os leads travam e onde o processo precisa de ajuste." },
          { kind: "list", title: "Métricas do funil", items: ["📥 Leads por etapa: quantos em cada fase","➡️ Taxa de avanço: % que passou para a próxima etapa","💰 Valor em cada etapa: potencial de receita","⏱️ Tempo médio por etapa: onde os leads ficam mais tempo"] },
          { kind: "text", title: "Identificando gargalos", body: "Se muitos leads travam em 'Proposta Enviada' por muitos dias, as propostas podem precisar de revisão ou falta follow-up no momento certo. Use esses dados para ajustar o processo comercial." },
        ],
        tip: "Um funil saudável tem perda gradual a cada etapa. Queda brusca em um ponto específico = maior oportunidade de melhoria.",
      },
    ],
  },

  {
    id: "configuracoes",
    title: "Configurações Avançadas",
    icon: "⚙️",
    color: C.slate,
    desc: "Personalize e otimize o sistema",
    lessons: [
      {
        id: "permissoes",
        title: "Permissões e Perfis de Acesso",
        duration: "8 min",
        type: "leitura",
        sections: [
          { kind: "list", title: "Perfis disponíveis", items: ["👑 Admin: acesso total — máximo 2 por empresa","💼 Vendedor: leads, pipeline, WhatsApp, follow-up","📊 Marketing: leads, campanhas, relatórios","💰 Financeiro: contratos, propostas, relatórios","👥 RH: gestão de equipe e agenda","🛠️ Suporte: WhatsApp, leads e agenda"] },
          { kind: "steps", title: "Configurando visibilidade de conversas", steps: ["Acesse Configurações → Equipe","Clique em Editar no membro","Configure: só meu inbox / meu setor / toda a empresa","Salve"] },
        ],
        tip: "Menos acesso = mais segurança. Conceda somente o que cada função realmente precisa.",
      },
      {
        id: "integracoes",
        title: "Integrações com Meta e Google",
        duration: "10 min",
        type: "leitura",
        sections: [
          { kind: "steps", title: "Meta Pixel & Conversions API", steps: ["Vá em Empresa → Integrações → Meta Ads","Insira seu Pixel ID e Access Token","Configure os eventos a rastrear (lead, purchase, contact)","Salve — os eventos fluem para o Meta em tempo real"] },
          { kind: "steps", title: "Google Analytics 4 (GA4)", steps: ["Em Empresa → Integrações → Google Analytics 4","Cole o Measurement ID (G-XXXXXXXX)","Adicione o API Secret do GA4","Salve e verifique no DebugView do GA4"] },
        ],
        tip: "Integrar Meta Pixel ao C4OS permite criar audiências personalizadas de quem interagiu pelo WhatsApp.",
      },
      {
        id: "seguranca",
        title: "Segurança e Boas Práticas",
        duration: "7 min",
        type: "leitura",
        sections: [
          { kind: "list", title: "Segurança de acesso", items: ["🔒 Senhas fortes e únicas para cada membro","🚪 Remova imediatamente o acesso de ex-funcionários","👁️ Revise periodicamente quem tem acesso admin","📱 Nunca compartilhe credenciais de login"] },
          { kind: "list", title: "Proteção do WhatsApp", items: ["📵 Não conecte o mesmo número em múltiplos sistemas","🔄 Verifique regularmente se a conexão está ativa","⚠️ Reconecte imediatamente se o status mudar para Desconectado","📋 Mantenha número de backup caso o principal seja suspenso"] },
          { kind: "steps", title: "Backup de dados", steps: ["Exporte seus leads mensalmente em CSV","Salve relatórios importantes em PDF","Documente os fluxos de chatbot externamente"] },
        ],
        tip: "Configure autenticação de dois fatores (2FA) no e-mail do administrador para proteção extra.",
      },
      {
        id: "faq",
        title: "Perguntas Frequentes",
        duration: "10 min",
        type: "leitura",
        sections: [
          { kind: "list", title: "WhatsApp", items: ["❓ QR Code expirou → clique em Reconectar para gerar novo","❓ Mensagens não chegando → verifique internet do celular","❓ Chatbot parou de responder → verifique se está ativo em Empresa → Chatbot"] },
          { kind: "list", title: "Leads e Conversas", items: ["❓ Conversa sumiu do inbox → use filtro Status: Todas ou Resolvida","❓ Lead duplicado → o sistema avisa; você pode mesclar manualmente","❓ Não vejo conversas de outros → verifique sua permissão em Configurações → Equipe"] },
          { kind: "list", title: "Disparos", items: ["❓ Campanha pausou → WhatsApp limitou temporariamente. Aguarde 1-2h","❓ Muitos erros → limpe números inválidos da lista","❓ Taxa de entrega caiu → reduza o volume e aumente o intervalo"] },
        ],
        tip: "Não encontrou sua dúvida? Entre em contato com nosso suporte pelo WhatsApp — atendemos em até 2h no horário comercial.",
      },
    ],
  },

  {
    id: "financeiro",
    title: "Financeiro",
    icon: "💰",
    color: "#f59e0b",
    desc: "Gerencie contratos, propostas e estoque",
    lessons: [
      {
        id: "visao-financeiro",
        title: "Visão Geral do Módulo Financeiro",
        duration: "6 min",
        type: "leitura",
        sections: [
          { kind: "text", title: "O que o módulo Financeiro oferece", body: "O módulo Financeiro do C4OS centraliza a gestão de contratos, propostas comerciais e estoque. Integrado ao CRM, cada proposta está vinculada a um lead, facilitando o acompanhamento do ciclo de venda do primeiro contato até o fechamento." },
          { kind: "list", title: "Funcionalidades disponíveis", items: ["📄 Contratos: criação, envio e controle de assinaturas","💼 Propostas: geração de propostas comerciais profissionais","📦 Estoque: controle de produtos e serviços com preços","📊 Relatórios financeiros: receita, pendências e previsão"] },
          { kind: "list", title: "Quem deve usar este módulo", items: ["👤 Gestores comerciais: acompanhamento de propostas enviadas","💰 Setor financeiro: contratos assinados e recebíveis","📦 Estoque: equipe responsável por produtos e serviços"] },
        ],
        tip: "O módulo Financeiro funciona melhor integrado ao pipeline de leads — cada proposta gerada fica vinculada ao lead correspondente.",
      },
      {
        id: "propostas",
        title: "Criando Propostas Comerciais",
        duration: "12 min",
        type: "prática",
        sections: [
          { kind: "steps", title: "Criando uma nova proposta", steps: ["Acesse Propostas no menu lateral","Clique em + Nova Proposta","Selecione o lead ou cliente para quem é a proposta","Adicione os produtos/serviços do estoque ou insira manualmente","Configure descontos, impostos e condições de pagamento","Revise o total e salve como rascunho"] },
          { kind: "steps", title: "Enviando a proposta", steps: ["Com a proposta salva, clique em Enviar","Escolha o método: e-mail ou link direto","O cliente recebe a proposta formatada e profissional","Você é notificado quando o cliente visualiza"] },
          { kind: "list", title: "Status das propostas", items: ["📝 Rascunho: em edição, não enviada","📤 Enviada: entregue ao cliente, aguardando resposta","✅ Aceita: cliente aprovou — pode gerar contrato","❌ Recusada: cliente rejeitou","⏳ Expirada: prazo de validade vencido"] },
          { kind: "steps", title: "Convertendo proposta em contrato", steps: ["Com proposta no status Aceita, clique em Gerar Contrato","As informações são copiadas automaticamente","Adicione cláusulas específicas se necessário","Envie para assinatura"] },
        ],
        tip: "Configure um prazo de validade nas propostas (ex: 7 dias) para criar urgência e evitar negociações prolongadas.",
      },
      {
        id: "contratos",
        title: "Gerenciando Contratos",
        duration: "10 min",
        type: "prática",
        sections: [
          { kind: "steps", title: "Criando um contrato", steps: ["Acesse Contratos no menu lateral","Clique em + Novo Contrato","Selecione o cliente e preencha as partes","Adicione as cláusulas do contrato","Configure valor, vigência e forma de pagamento","Salve e prepare para envio"] },
          { kind: "steps", title: "Enviando para assinatura", steps: ["Na tela do contrato, clique em Solicitar Assinatura","O cliente recebe o link por WhatsApp ou e-mail","Ele assina eletronicamente pelo próprio celular","Você e o cliente recebem o PDF assinado automaticamente"] },
          { kind: "list", title: "Status dos contratos", items: ["✏️ Rascunho: sendo preparado","📤 Aguardando assinatura: enviado, cliente ainda não assinou","✅ Assinado: ambas as partes assinaram — contrato ativo","❌ Cancelado: contrato encerrado antecipadamente","⏳ Vencido: período de vigência expirado"] },
          { kind: "steps", title: "Renovando contratos", steps: ["Acesse o contrato vencido ou próximo do vencimento","Clique em Renovar Contrato","Atualize os termos se necessário","Envie para nova assinatura"] },
        ],
        tip: "Configure alertas de vencimento de contratos (ex: 30, 15 e 7 dias antes) para nunca perder uma renovação.",
      },
      {
        id: "estoque",
        title: "Controle de Estoque e Produtos",
        duration: "9 min",
        type: "prática",
        sections: [
          { kind: "steps", title: "Cadastrando produtos e serviços", steps: ["Acesse Estoque no menu lateral","Clique em + Novo Item","Defina: nome, descrição, categoria (produto/serviço), unidade e preço","Adicione código interno se necessário","Salve — o item fica disponível para propostas automaticamente"] },
          { kind: "steps", title: "Controlando o estoque", steps: ["Na lista de itens, clique em um produto para editar","Atualize a quantidade disponível","Configure quantidade mínima para alertas de reposição","O sistema avisa quando o estoque estiver baixo"] },
          { kind: "list", title: "Usando no módulo de Propostas", items: ["Ao criar uma proposta, pesquise o produto pelo nome","O preço é preenchido automaticamente do cadastro","Você pode ajustar o preço individualmente na proposta","Desconto e impostos são aplicados sobre o preço base"] },
        ],
        tip: "Mantenha a tabela de preços sempre atualizada no estoque para agilizar a criação de propostas sem erro de valor.",
      },
      {
        id: "relatorios-financeiros",
        title: "Relatórios Financeiros",
        duration: "8 min",
        type: "leitura",
        sections: [
          { kind: "steps", title: "Acessando relatórios financeiros", steps: ["Acesse Relatórios no menu lateral","Selecione a aba Financeiro","Defina o período desejado","Clique em Gerar"] },
          { kind: "list", title: "Relatórios disponíveis", items: ["💰 Receita por período: total faturado por mês/trimestre","📄 Propostas enviadas vs. aceitas: taxa de conversão comercial","📋 Contratos ativos: lista de contratos vigentes com valores","⏳ Vencimentos próximos: contratos e propostas expirando em breve","📦 Movimentação de estoque: entradas e saídas por período"] },
          { kind: "steps", title: "Exportando para Excel", steps: ["Com o relatório gerado, clique em Exportar CSV","Abra no Excel ou Google Sheets","Use filtros e tabelas dinâmicas para análises personalizadas"] },
        ],
        tip: "Exporte os relatórios mensalmente e compartilhe com a liderança. Dados de conversão de proposta e contratos são excelentes indicadores de saúde comercial.",
      },
    ],
  },

  {
    id: "rh",
    title: "RH & Pessoas",
    icon: "👤",
    color: "#ec4899",
    desc: "Gerencie sua equipe, departamentos e agenda",
    lessons: [
      {
        id: "visao-rh",
        title: "Visão Geral do Módulo de RH",
        duration: "5 min",
        type: "leitura",
        sections: [
          { kind: "text", title: "O que o módulo de RH oferece", body: "O módulo de RH do C4OS centraliza a gestão de pessoas: cadastro de colaboradores, organização por departamentos, controle de agenda e acompanhamento de atividades da equipe. Perfeito para gestores que precisam ter visão completa da operação." },
          { kind: "list", title: "Funcionalidades do módulo", items: ["👥 Equipe: cadastro e gestão de todos os colaboradores","🏢 Departamentos: organização hierárquica da empresa","📅 Agenda: reuniões, compromissos e tarefas por pessoa","📊 Visão gerencial: desempenho e atividade da equipe"] },
          { kind: "list", title: "Quem usa este módulo", items: ["👤 Gestores de RH: cadastro, organização e acompanhamento","🏢 Diretores: visão consolidada da estrutura da empresa","📋 Supervisores: agenda e atividades da equipe"] },
        ],
        tip: "Manter o cadastro de equipe atualizado no C4OS garante que as automações (round-robin, notificações, CSAT) funcionem corretamente.",
      },
      {
        id: "gestao-equipe",
        title: "Gestão de Colaboradores",
        duration: "10 min",
        type: "prática",
        sections: [
          { kind: "steps", title: "Cadastrando um novo colaborador", steps: ["Acesse Configurações → Equipe","Clique em + Convidar Membro","Preencha nome, e-mail e cargo","Selecione o perfil de acesso (Admin, Vendedor, Suporte etc.)","Defina o departamento ao qual pertence","O sistema envia o convite por e-mail — o colaborador cria a própria senha"] },
          { kind: "steps", title: "Editando um colaborador existente", steps: ["Na lista da equipe, clique em Editar","Atualize cargo, departamento ou perfil de acesso","Configure a visibilidade de conversas","Ative ou desative o colaborador conforme necessário","Salve"] },
          { kind: "list", title: "Desligando um colaborador", items: ["Desative o acesso imediatamente em Editar → Desativar","Reatribua as conversas e leads do colaborador","Remova do round-robin de distribuição","Faça backup das anotações importantes antes de remover"] },
          { kind: "steps", title: "Redefinindo senha de um colaborador", steps: ["Na lista da equipe, clique em Editar","Clique em Redefinir Senha","O colaborador recebe um e-mail com o link para criar nova senha","Útil quando o colaborador esquece a senha"] },
        ],
        tip: "Ao desligar um colaborador, desative o acesso antes de qualquer outra etapa — isso impede acesso imediato ao sistema.",
      },
      {
        id: "departamentos",
        title: "Organizando Departamentos",
        duration: "8 min",
        type: "prática",
        sections: [
          { kind: "text", title: "Por que usar departamentos?", body: "Departamentos organizam a estrutura hierárquica da empresa e determinam como as conversas do WhatsApp são distribuídas. Um cliente que seleciona 'Financeiro' no chatbot é encaminhado automaticamente para atendentes deste departamento." },
          { kind: "steps", title: "Criando um departamento", steps: ["Acesse Configurações → Departamentos (ou Setores)","Clique em + Novo Departamento","Defina o nome (ex: Vendas, Suporte, Financeiro, TI)","Selecione os colaboradores que fazem parte","Configure a mensagem de saudação do setor (opcional)","Salve"] },
          { kind: "steps", title: "Configurando no chatbot", steps: ["Com os departamentos criados, vá em Empresa → Chatbot","No menu do chatbot, adicione uma opção para cada departamento","Configure para encaminhar para o departamento selecionado","Teste o fluxo completo antes de ativar"] },
          { kind: "list", title: "Boas práticas de organização", items: ["📌 Crie departamentos que reflitam a estrutura real da empresa","👥 Cada departamento deve ter ao menos 2 atendentes (redundância)","🔄 Revise a distribuição trimestralmente","📊 Use relatórios por setor para identificar gargalos"] },
        ],
        tip: "Departamentos menores e específicos são mais eficientes. Prefira 'Suporte Técnico' e 'Suporte Comercial' a um único 'Suporte'.",
      },
      {
        id: "agenda",
        title: "Usando a Agenda",
        duration: "9 min",
        type: "prática",
        sections: [
          { kind: "steps", title: "Criando um compromisso", steps: ["Acesse Agenda no menu lateral","Clique em + Novo Compromisso ou clique diretamente no horário desejado","Defina título, data e hora de início e fim","Adicione o lead/cliente relacionado (opcional)","Selecione o atendente responsável","Adicione descrição ou pauta se necessário","Salve"] },
          { kind: "list", title: "Tipos de compromisso", items: ["📞 Ligação: ligação agendada com o cliente","🤝 Reunião: presencial ou online","📋 Tarefa: atividade interna a ser realizada","📅 Follow-up: acompanhamento agendado","🏖️ Folga / Feriado: bloqueio de agenda da equipe"] },
          { kind: "steps", title: "Visualizando agenda da equipe", steps: ["Na Agenda, use o seletor de visão: Dia / Semana / Mês","Filtre por atendente para ver a agenda individual","Clique em qualquer evento para ver detalhes","Use a visão Semana para planejar a distribuição de reuniões"] },
          { kind: "steps", title: "Notificações de compromissos", steps: ["O sistema envia lembretes automáticos antes dos compromissos","Configure com quanto tempo de antecedência (ex: 30 min)","O cliente também pode receber lembretes via WhatsApp","Vá em Configurações → Agenda para ajustar as notificações"] },
        ],
        tip: "Vincule os compromissos da agenda ao lead correspondente — assim o histórico fica completo no perfil do cliente.",
      },
      {
        id: "performance-equipe",
        title: "Acompanhando a Performance da Equipe",
        duration: "7 min",
        type: "leitura",
        sections: [
          { kind: "steps", title: "Acessando relatórios de equipe", steps: ["Acesse Relatórios no menu lateral","Selecione a aba Equipe ou Atendimentos","Defina o período","Clique em Gerar"] },
          { kind: "list", title: "Métricas por colaborador", items: ["💬 Total de atendimentos: volume de conversas no período","⏱️ TMR (Tempo Médio de Resposta): agilidade de cada atendente","⭐ Nota CSAT: satisfação dos clientes atendidos","✅ Taxa de resolução: % de conversas encerradas como resolvidas","📈 Leads convertidos: vendas fechadas pelo atendente"] },
          { kind: "list", title: "Como usar os dados", items: ["🏆 Reconheça os melhores atendentes com base em dados reais","📉 Identifique quem precisa de treinamento adicional","⚖️ Balanceie a distribuição de leads se houver desigualdade","📅 Use como base para avaliações periódicas de desempenho"] },
        ],
        tip: "Compartilhe o relatório de performance com a equipe mensalmente — transparência nos dados cria uma cultura de melhoria contínua.",
      },
    ],
  },

  {
    id: "ti",
    title: "Administração & TI",
    icon: "🛠️",
    color: "#06b6d4",
    desc: "Configurações técnicas, integrações e segurança",
    lessons: [
      {
        id: "visao-ti",
        title: "Visão Geral para Administradores",
        duration: "6 min",
        type: "leitura",
        sections: [
          { kind: "text", title: "Responsabilidades do administrador técnico", body: "O administrador técnico do C4OS é responsável por manter as integrações ativas, monitorar o status da conexão WhatsApp, gerenciar acessos e garantir o funcionamento correto das automações." },
          { kind: "list", title: "Áreas de responsabilidade", items: ["🔌 Conexão WhatsApp: manter a instância ativa e reconectar quando necessário","🔑 Gestão de acessos: criar, editar e revogar acessos de usuários","🔗 Integrações: configurar Meta, Google Analytics e webhooks","🔒 Segurança: monitorar acessos e aplicar boas práticas","📊 Logs: verificar erros e anomalias no sistema"] },
          { kind: "list", title: "Ferramentas disponíveis para admins", items: ["⚙️ Configurações → Empresa: todas as configurações centralizadas","📋 Logs de WhatsApp: histórico de eventos da instância","🔐 Painel de usuários: gestão completa de acessos","📡 Status da instância: monitoramento em tempo real"] },
        ],
        tip: "Crie um checklist semanal de saúde do sistema: conexão WhatsApp ativa, integrações funcionando, usuários inativos removidos.",
      },
      {
        id: "conexao-whatsapp-ti",
        title: "Gerenciando a Conexão WhatsApp",
        duration: "10 min",
        type: "prática",
        sections: [
          { kind: "steps", title: "Verificando o status da conexão", steps: ["Acesse Empresa → Integrações → WhatsApp via Evolution GO","O status exibe: Conectado 🟢 / Desconectado 🔴 / Aguardando ⏳","Verifique o número conectado e a instância ativa","Em caso de dúvida, clique em Verificar Status para forçar a consulta"] },
          { kind: "steps", title: "Reconectando após desconexão", steps: ["Clique em Reconectar","Um novo QR Code será gerado","No celular do número: Configurações → Aparelhos Conectados → Conectar aparelho","Escaneie o QR Code","Aguarde o status voltar para 🟢 Conectado","Teste enviando uma mensagem de verificação"] },
          { kind: "list", title: "Causas comuns de desconexão", items: ["📵 Aparelho ficou sem bateria ou internet por longo período","🔄 Troca de chip ou reinicialização de fábrica do celular","🚫 WhatsApp atualizado e sessão expirada automaticamente","⚡ Mais de uma sessão aberta simultaneamente em outros sistemas"] },
          { kind: "steps", title: "Configurando alertas de desconexão", steps: ["Em Empresa → Integrações, ative Notificações de Status","Configure o e-mail ou WhatsApp para receber alertas","Você será notificado em minutos se a instância cair","Reconecte antes que os clientes sejam impactados"] },
        ],
        tip: "Mantenha o celular conectado ao carregador em local fixo — evita desconexão por bateria e facilita o acesso para reconectar quando necessário.",
      },
      {
        id: "gestao-acessos",
        title: "Gestão de Acessos e Segurança",
        duration: "10 min",
        type: "prática",
        sections: [
          { kind: "steps", title: "Auditando os acessos periodicamente", steps: ["Acesse Configurações → Equipe","Liste todos os usuários ativos","Verifique se há usuários inativos (ex-funcionários) que devem ser removidos","Confirme que os perfis de acesso estão corretos para cada função","Remova ou desative o que for necessário"] },
          { kind: "steps", title: "Configurando perfis de acesso", steps: ["Na edição de cada usuário, defina o perfil: Admin, Vendedor, Suporte, Financeiro, RH ou Marketing","Configure a visibilidade de conversas: apenas o próprio inbox / setor / toda a empresa","Defina quais setores o usuário pode atender","Salve e comunique as mudanças ao usuário se necessário"] },
          { kind: "list", title: "Boas práticas de segurança", items: ["🔒 Máximo 2 administradores por empresa","🚪 Revogue acessos imediatamente ao desligar colaboradores","👁️ Auditoria de acessos mensalmente","📧 Cada pessoa com e-mail próprio — nunca compartilhe logins","🔑 Oriente a equipe a usar senhas fortes (mínimo 10 caracteres)"] },
          { kind: "list", title: "O que fazer em caso de comprometimento", items: ["⚡ Mude imediatamente a senha do usuário comprometido","🚫 Desative o acesso temporariamente","📋 Revise o histórico de atividades do usuário","🔄 Reconecte o WhatsApp se a instância foi acessada indevidamente","📞 Contate nosso suporte se suspeitar de acesso não autorizado"] },
        ],
        tip: "Configure senhas com expiração trimestral e notifique os usuários para renovar — reduz risco de senhas antigas comprometidas.",
      },
      {
        id: "integracoes-tecnicas",
        title: "Integrações Técnicas Avançadas",
        duration: "12 min",
        type: "leitura",
        sections: [
          { kind: "steps", title: "Meta Pixel & Conversions API", steps: ["Acesse Meta Business Suite → Events Manager","Crie ou selecione seu Pixel","Em Configurações do Pixel → API de Conversões → gere um Access Token","Em C4OS: Empresa → Integrações → Meta Ads → cole o Pixel ID e Access Token","Configure os eventos a rastrear (Lead, Contact, Purchase)","Valide no Meta Events Manager — os eventos devem aparecer em até 24h"] },
          { kind: "steps", title: "Google Analytics 4", steps: ["No GA4: Admin → Fluxos de dados → selecione o fluxo web","Copie o Measurement ID (G-XXXXXXXX)","Em Segredos da API do protocolo de medição: crie um segredo e copie o valor","Em C4OS: Empresa → Integrações → GA4 → cole o Measurement ID e API Secret","Valide no GA4 DebugView — os eventos devem aparecer em tempo real"] },
          { kind: "list", title: "Verificando se as integrações estão funcionando", items: ["Meta: acesse o DebugView no Meta Events Manager e faça um teste","GA4: abra o DebugView no painel do GA4 e crie um lead de teste no C4OS","Ambos devem mostrar o evento em até 60 segundos","Se não aparecer, verifique se os tokens estão corretos e não expiraram"] },
        ],
        tip: "Anote os tokens e IDs de integração em local seguro (gerenciador de senhas da empresa). Tokens expirados causam falha silenciosa no rastreamento.",
      },
      {
        id: "logs-monitoramento",
        title: "Logs e Monitoramento do Sistema",
        duration: "8 min",
        type: "leitura",
        sections: [
          { kind: "steps", title: "Acessando logs do WhatsApp", steps: ["Acesse Relatórios → aba Logs (ou Empresa → Logs)","Selecione o tipo de log: Webhook, Mensagens, Erros, Conexão","Defina o período","Clique em Filtrar para ver os eventos"] },
          { kind: "list", title: "Tipos de log disponíveis", items: ["📥 Webhook recebido: confirmação de que as mensagens chegaram ao sistema","💬 Mensagem enviada/recebida: histórico de comunicações","❌ Erros de API: falhas no envio ou na conexão","🔌 Eventos de conexão: reconexões e desconexões da instância","🤖 Fluxo do chatbot: quais etapas foram acionadas por cada cliente"] },
          { kind: "list", title: "O que fazer com os logs", items: ["Alta frequência de erros de API: verifique a conexão do WhatsApp","Webhook não recebendo: contate o suporte — pode ser config. da instância","Chatbot pulando etapas: revise o fluxo visual para inconsistências","Mensagens não entregues: verifique se o número destino é válido"] },
          { kind: "steps", title: "Exportando logs para análise", steps: ["Com o filtro aplicado, clique em Exportar CSV","Abra no Excel para análise detalhada","Útil para diagnóstico de problemas recorrentes","Compartilhe com o suporte em caso de investigação técnica"] },
        ],
        tip: "Verifique os logs de erro semanalmente — problemas pequenos identificados cedo evitam crises maiores mais tarde.",
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getAllLessons(modules) {
  return modules.flatMap(m => m.lessons.map(l => ({ ...l, moduleId: m.id, moduleTitle: m.title, moduleColor: m.color, moduleIcon: m.icon })));
}

function calcModuleProgress(mod, progress) {
  const done = mod.lessons.filter(l => progress[`${mod.id}:${l.id}`]).length;
  return { done, total: mod.lessons.length, pct: mod.lessons.length ? Math.round((done / mod.lessons.length) * 100) : 0 };
}

function calcOverallProgress(modules, progress) {
  const total = modules.reduce((a, m) => a + m.lessons.length, 0);
  const done  = modules.reduce((a, m) => a + m.lessons.filter(l => progress[`${m.id}:${l.id}`]).length, 0);
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// ─── Tela de Login ────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) { setErr("E-mail ou senha incorretos."); return; }
    onLogin(data.user);
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#10b981,#06b6d4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:800, color:"#fff" }}>C</div>
            <span style={{ fontSize:22, fontWeight:800, color:C.text, letterSpacing:-0.5 }}>C4OS Treinamentos</span>
          </div>
          <p style={{ color:C.muted, fontSize:14, margin:0 }}>Entre com suas credenciais para acessar</p>
        </div>

        {/* Form */}
        <form onSubmit={submit} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:32, display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:C.muted, textTransform:"uppercase", letterSpacing:.5, display:"block", marginBottom:6 }}>E-mail</label>
            <input
              type="email" value={email} onChange={e=>setEmail(e.target.value)} required
              placeholder="seu@email.com.br"
              style={{ width:"100%", background:"#0f1929", border:`1px solid ${C.borderLt}`, borderRadius:10, padding:"11px 14px", fontSize:14, color:C.text, outline:"none", boxSizing:"border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:C.muted, textTransform:"uppercase", letterSpacing:.5, display:"block", marginBottom:6 }}>Senha</label>
            <input
              type="password" value={password} onChange={e=>setPassword(e.target.value)} required
              placeholder="••••••••"
              style={{ width:"100%", background:"#0f1929", border:`1px solid ${C.borderLt}`, borderRadius:10, padding:"11px 14px", fontSize:14, color:C.text, outline:"none", boxSizing:"border-box" }}
            />
          </div>
          {err && <div style={{ background:"#2d1117", border:"1px solid #5c2026", borderRadius:8, padding:"10px 14px", fontSize:13, color:C.red }}>{err}</div>}
          <button type="submit" disabled={loading} style={{ background:"linear-gradient(135deg,#10b981,#06b6d4)", border:"none", borderRadius:10, padding:"13px 0", fontSize:14, fontWeight:700, color:"#fff", cursor:loading?"not-allowed":"pointer", opacity:loading?.7:1, marginTop:4 }}>
            {loading ? "Entrando..." : "Acessar Treinamentos"}
          </button>
        </form>

        <p style={{ textAlign:"center", fontSize:12, color:C.muted, marginTop:20 }}>
          Use as mesmas credenciais que você usa no C4OS
        </p>
      </div>
    </div>
  );
}

// ─── Renderizador de seção do conteúdo ────────────────────────────────────────
function Section({ sec }) {
  if (sec.kind === "text") return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:8 }}>{sec.title}</div>
      <p style={{ fontSize:14, color:C.muted, lineHeight:1.7, margin:0 }}>{sec.body}</p>
    </div>
  );

  if (sec.kind === "steps") return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:10 }}>{sec.title}</div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {sec.steps.map((s, i) => (
          <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
            <div style={{ flexShrink:0, width:24, height:24, borderRadius:"50%", background:C.green, color:"#fff", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{i+1}</div>
            <span style={{ fontSize:14, color:C.muted, lineHeight:1.6, paddingTop:2 }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );

  if (sec.kind === "list") return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:10 }}>{sec.title}</div>
      <ul style={{ margin:0, padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:8 }}>
        {sec.items.map((item, i) => (
          <li key={i} style={{ fontSize:14, color:C.muted, lineHeight:1.6, paddingLeft:6 }}>{item}</li>
        ))}
      </ul>
    </div>
  );

  return null;
}

// ─── Conteúdo da aula ─────────────────────────────────────────────────────────
function LessonView({ lesson, mod, isCompleted, onComplete, onPrev, onNext, hasPrev, hasNext }) {
  const typeLabel = { leitura: "📖 Leitura", prática: "⚡ Prática" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0, height:"100%" }}>
      {/* Header da aula */}
      <div style={{ padding:"28px 32px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <span style={{ fontSize:12, fontWeight:600, color:mod.color, background:`${mod.color}18`, border:`1px solid ${mod.color}33`, borderRadius:6, padding:"3px 10px" }}>{mod.icon} {mod.title}</span>
          <span style={{ fontSize:12, color:C.muted }}>{typeLabel[lesson.type] ?? lesson.type}</span>
          <span style={{ fontSize:12, color:C.muted }}>· {lesson.duration}</span>
          {lesson.badge && <span style={{ fontSize:11, fontWeight:700, color:lesson.badgeColor ?? C.teal, background:`${(lesson.badgeColor ?? C.teal)}18`, border:`1px solid ${(lesson.badgeColor ?? C.teal)}33`, borderRadius:6, padding:"3px 10px" }}>✦ {lesson.badge}</span>}
        </div>
        <h1 style={{ fontSize:22, fontWeight:800, color:C.text, margin:"0 0 4px", lineHeight:1.3 }}>{lesson.title}</h1>
      </div>

      {/* Conteúdo com scroll */}
      <div style={{ flex:1, overflowY:"auto", padding:"24px 32px" }}>
        {lesson.sections.map((sec, i) => <Section key={i} sec={sec} />)}

        {/* Dica */}
        {lesson.tip && (
          <div style={{ background:"#0c2a1c", border:`1px solid ${C.greenBd}`, borderRadius:12, padding:"14px 18px", marginTop:8 }}>
            <span style={{ fontSize:13, color:C.green, fontWeight:700 }}>💡 Dica: </span>
            <span style={{ fontSize:13, color:"#86efac" }}>{lesson.tip}</span>
          </div>
        )}

        {/* Concluído */}
        {isCompleted && (
          <div style={{ background:"#0c2a1c", border:`1px solid ${C.greenBd}`, borderRadius:12, padding:"14px 18px", marginTop:16, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:20 }}>✅</span>
            <span style={{ fontSize:14, color:C.green, fontWeight:600 }}>Aula concluída! Continue para a próxima.</span>
          </div>
        )}
      </div>

      {/* Footer de navegação */}
      <div style={{ padding:"16px 32px", borderTop:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
        <button onClick={onPrev} disabled={!hasPrev}
          style={{ background:C.card, border:`1px solid ${C.borderLt}`, borderRadius:10, padding:"10px 20px", fontSize:13, fontWeight:600, color:hasPrev?C.text:C.muted, cursor:hasPrev?"pointer":"default", opacity:hasPrev?1:.4 }}>
          ← Anterior
        </button>

        {!isCompleted ? (
          <button onClick={onComplete}
            style={{ background:`linear-gradient(135deg,${C.green},${C.teal})`, border:"none", borderRadius:10, padding:"10px 28px", fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer", flex:1, maxWidth:240 }}>
            ✓ Marcar como concluída
          </button>
        ) : (
          <button onClick={onNext} disabled={!hasNext}
            style={{ background:`linear-gradient(135deg,${C.green},${C.teal})`, border:"none", borderRadius:10, padding:"10px 28px", fontSize:13, fontWeight:700, color:"#fff", cursor:hasNext?"pointer":"default", opacity:hasNext?1:.6, flex:1, maxWidth:240 }}>
            Próxima aula →
          </button>
        )}

        <button onClick={onNext} disabled={!hasNext}
          style={{ background:C.card, border:`1px solid ${C.borderLt}`, borderRadius:10, padding:"10px 20px", fontSize:13, fontWeight:600, color:hasNext?C.text:C.muted, cursor:hasNext?"pointer":"default", opacity:hasNext?1:.4 }}>
          Próxima →
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ modules, progress, activeMod, activeLesson, onSelect, overall, user, onLogout }) {
  const [expanded, setExpanded] = useState(activeMod);

  const toggle = (id) => setExpanded(e => e === id ? null : id);

  return (
    <div style={{ width:280, minWidth:280, background:C.sidebar, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"20px 20px 16px", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:"linear-gradient(135deg,#10b981,#06b6d4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color:"#fff" }}>C</div>
          <span style={{ fontSize:15, fontWeight:800, color:C.text }}>C4OS Treinamentos</span>
        </div>

        {/* Progresso geral */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <span style={{ fontSize:11, fontWeight:600, color:C.muted, textTransform:"uppercase", letterSpacing:.5 }}>Seu progresso</span>
            <span style={{ fontSize:13, fontWeight:700, color:C.green }}>{overall.pct}%</span>
          </div>
          <div style={{ height:6, background:C.border, borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${overall.pct}%`, background:`linear-gradient(90deg,${C.green},${C.teal})`, borderRadius:3, transition:"width .5s ease" }}/>
          </div>
          <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{overall.done} de {overall.total} aulas concluídas</div>
        </div>
      </div>

      {/* Lista de módulos */}
      <div style={{ flex:1, overflowY:"auto", padding:"8px 0" }}>
        {modules.map(mod => {
          const mp = calcModuleProgress(mod, progress);
          const isExp = expanded === mod.id;
          return (
            <div key={mod.id}>
              {/* Módulo */}
              <button onClick={() => toggle(mod.id)}
                style={{ width:"100%", background:"none", border:"none", padding:"10px 20px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", textAlign:"left" }}>
                <span style={{ fontSize:16 }}>{mod.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{mod.title}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{mp.done}/{mp.total} aulas</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
                  {mp.pct === 100 && <span style={{ fontSize:12 }}>✅</span>}
                  <span style={{ fontSize:11, color:mod.color, fontWeight:700 }}>{mp.pct}%</span>
                  <span style={{ fontSize:10, color:C.muted }}>{isExp ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* Mini progress bar */}
              <div style={{ margin:"0 20px 2px", height:2, background:C.border, borderRadius:1, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${mp.pct}%`, background:mod.color, borderRadius:1, transition:"width .4s" }}/>
              </div>

              {/* Aulas */}
              {isExp && (
                <div style={{ padding:"4px 0 8px" }}>
                  {mod.lessons.map((lesson, idx) => {
                    const key = `${mod.id}:${lesson.id}`;
                    const done = !!progress[key];
                    const active = activeMod === mod.id && activeLesson === lesson.id;
                    return (
                      <button key={lesson.id} onClick={() => { onSelect(mod.id, lesson.id); setExpanded(mod.id); }}
                        style={{ width:"100%", background:active ? `${mod.color}14` : "none", border:"none", borderLeft:active ? `2px solid ${mod.color}` : "2px solid transparent", padding:"8px 20px 8px 24px", display:"flex", alignItems:"center", gap:8, cursor:"pointer", textAlign:"left" }}>
                        <div style={{ width:20, height:20, borderRadius:"50%", background:done ? C.green : C.border, border:`1.5px solid ${done ? C.green : C.borderLt}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          {done ? <span style={{ fontSize:10, color:"#fff" }}>✓</span> : <span style={{ fontSize:10, color:C.muted }}>{idx+1}</span>}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:active?700:500, color:active?C.text:done?C.muted:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{lesson.title}</div>
                          <div style={{ fontSize:10, color:C.muted }}>{lesson.duration}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer do usuário */}
      <div style={{ padding:"14px 20px", borderTop:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:"50%", background:`${C.green}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:C.green }}>
          {(user?.email ?? "?")[0].toUpperCase()}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:600, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{user?.email ?? ""}</div>
        </div>
        <button onClick={onLogout} title="Sair" style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:16 }}>⏻</button>
      </div>
    </div>
  );
}

// ─── Conclusão ────────────────────────────────────────────────────────────────
function CompletionScreen() {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:40, textAlign:"center" }}>
      <div style={{ fontSize:64, marginBottom:20 }}>🎉</div>
      <h1 style={{ fontSize:28, fontWeight:800, color:C.text, marginBottom:12 }}>Parabéns! Treinamento concluído.</h1>
      <p style={{ fontSize:16, color:C.muted, maxWidth:480, lineHeight:1.7, marginBottom:24 }}>
        Você concluiu 100% do treinamento do C4OS. Agora você tem todo o conhecimento para usar o sistema com excelência.
      </p>
      <p style={{ fontSize:13, color:C.muted }}>Dúvidas? Entre em contato com nosso suporte. Estamos sempre aqui! 💚</p>
    </div>
  );
}

// ─── Aplicativo de Treinamento ────────────────────────────────────────────────
function TrainingApp({ authUser, onLogout }) {
  const [modules,  setModules]  = useState([]);
  const [progress, setProgress] = useState({});
  const [activeMod,    setActiveMod]    = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carrega empresa e monta módulos
  useEffect(() => {
    (async () => {
      let hasMulti = false;
      try {
        const { data: usuario } = await supabase
          .from("usuarios").select("empresa_id").eq("id", authUser.id).maybeSingle();
        if (usuario?.empresa_id) {
          const { data: emp } = await supabase
            .from("empresas").select("multi_instancia_ativo").eq("id", usuario.empresa_id).maybeSingle();
          hasMulti = emp?.multi_instancia_ativo ?? false;
        }
      } catch (_) {}

      const mods = buildModules(hasMulti);
      setModules(mods);

      // Carrega progresso do localStorage
      const saved = localStorage.getItem(`c4os_treinamento_${authUser.id}`);
      const prog  = saved ? JSON.parse(saved) : {};
      setProgress(prog);

      // Posiciona na primeira aula não concluída
      let foundMod = mods[0].id, foundLesson = mods[0].lessons[0].id;
      outer: for (const m of mods) {
        for (const l of m.lessons) {
          if (!prog[`${m.id}:${l.id}`]) {
            foundMod = m.id; foundLesson = l.id;
            break outer;
          }
        }
      }
      setActiveMod(foundMod);
      setActiveLesson(foundLesson);
      setLoading(false);
    })();
  }, [authUser.id]);

  const saveProgress = useCallback((newProg) => {
    setProgress(newProg);
    localStorage.setItem(`c4os_treinamento_${authUser.id}`, JSON.stringify(newProg));
  }, [authUser.id]);

  const markComplete = useCallback(() => {
    const key = `${activeMod}:${activeLesson}`;
    const newProg = { ...progress, [key]: true };
    saveProgress(newProg);
    // Avança automaticamente
    const all = getAllLessons(modules);
    const idx = all.findIndex(l => l.moduleId === activeMod && l.id === activeLesson);
    if (idx < all.length - 1) {
      setActiveMod(all[idx+1].moduleId);
      setActiveLesson(all[idx+1].id);
    }
  }, [activeMod, activeLesson, progress, saveProgress, modules]);

  const navigate = useCallback((dir) => {
    const all = getAllLessons(modules);
    const idx = all.findIndex(l => l.moduleId === activeMod && l.id === activeLesson);
    const next = all[idx + dir];
    if (next) { setActiveMod(next.moduleId); setActiveLesson(next.id); }
  }, [activeMod, activeLesson, modules]);

  if (loading || !modules.length) {
    return (
      <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:20, height:20, borderRadius:"50%", border:`2px solid ${C.border}`, borderTopColor:C.green, animation:"spin .7s linear infinite" }}/>
      </div>
    );
  }

  const overall = calcOverallProgress(modules, progress);
  const allLessons = getAllLessons(modules);
  const curIdx = allLessons.findIndex(l => l.moduleId === activeMod && l.id === activeLesson);
  const curLesson  = allLessons[curIdx];
  const curMod     = modules.find(m => m.id === activeMod);
  const isCompleted = !!progress[`${activeMod}:${activeLesson}`];
  const isAllDone  = overall.pct === 100;

  return (
    <div style={{ display:"flex", height:"100vh", background:C.bg, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", overflow:"hidden" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} * { box-sizing: border-box; } ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:${C.bg}} ::-webkit-scrollbar-thumb{background:${C.borderLt};border-radius:3px}`}</style>

      {/* Sidebar */}
      <Sidebar
        modules={modules} progress={progress}
        activeMod={activeMod} activeLesson={activeLesson}
        onSelect={(m, l) => { setActiveMod(m); setActiveLesson(l); }}
        overall={overall}
        user={authUser} onLogout={onLogout}
      />

      {/* Content */}
      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        {/* Top progress bar */}
        <div style={{ height:3, background:C.border, flexShrink:0 }}>
          <div style={{ height:"100%", width:`${overall.pct}%`, background:`linear-gradient(90deg,${C.green},${C.teal})`, transition:"width .5s ease" }}/>
        </div>

        {/* Conteúdo */}
        <div style={{ flex:1, overflow:"hidden" }}>
          {isAllDone && !curLesson ? (
            <CompletionScreen />
          ) : curLesson && curMod ? (
            <LessonView
              lesson={curLesson} mod={curMod}
              isCompleted={isCompleted}
              onComplete={markComplete}
              onPrev={() => navigate(-1)} onNext={() => navigate(1)}
              hasPrev={curIdx > 0} hasNext={curIdx < allLessons.length - 1}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PageTreinamento() {
  const [authUser, setAuthUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
  };

  if (checking) {
    return (
      <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:20, height:20, borderRadius:"50%", border:`2px solid #1f2d3f`, borderTopColor:C.green, animation:"spin .7s linear infinite" }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!authUser) return <LoginScreen onLogin={setAuthUser} />;
  return <TrainingApp authUser={authUser} onLogout={handleLogout} />;
}
