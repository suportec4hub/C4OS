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
      {
        id: "lab-setup",
        title: "Laboratório: Configuração Inicial",
        duration: "10 min",
        type: "lab",
        lab: { type: "setup" },
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
      {
        id: "lab-leads",
        title: "Laboratório: Criar e Mover Lead",
        duration: "10 min",
        type: "lab",
        lab: { type: "leads" },
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
      {
        id: "lab-inbox",
        title: "Laboratório: Simulação de Inbox",
        duration: "10 min",
        type: "lab",
        lab: { type: "inbox" },
      },
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
      {
        id: "lab-chatbot",
        title: "Laboratório: Configurar Chatbot",
        duration: "12 min",
        type: "lab",
        lab: { type: "chatbot" },
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
      {
        id: "lab-campanha",
        title: "Laboratório: Criar Campanha",
        duration: "12 min",
        type: "lab",
        lab: { type: "campanha" },
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
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");
  const [focused, setFocused]   = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) { setErr("E-mail ou senha incorretos."); return; }
    onLogin(data.user);
  };

  const features = [
    { icon: "🚀", label: "10 módulos completos", sub: "Do básico ao avançado" },
    { icon: "🧪", label: "Laboratórios interativos", sub: "Pratique no simulador" },
    { icon: "📊", label: "Progresso em tempo real", sub: "Acompanhe sua evolução" },
    { icon: "🏆", label: "Certificado de conclusão", sub: "Comprove seu conhecimento" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", position:"relative", overflow:"hidden", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes floatUp{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes fadeSlide{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes orb{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
        .login-input:focus{border-color:#06b6d4 !important;box-shadow:0 0 0 3px #06b6d420}
        .login-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 28px #10b98150 !important}
        .feature-item{animation:fadeSlide .5s ease both}
      `}</style>

      {/* Orbs de fundo */}
      <div style={{ position:"absolute", width:800, height:800, borderRadius:"50%", background:"radial-gradient(circle,#10b98112 0%,transparent 65%)", top:-300, left:-250, animation:"orb 8s ease-in-out infinite", pointerEvents:"none" }}/>
      <div style={{ position:"absolute", width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle,#06b6d410 0%,transparent 65%)", bottom:-200, right:50, animation:"orb 10s ease-in-out infinite reverse", pointerEvents:"none" }}/>
      <div style={{ position:"absolute", width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle,#8b5cf610 0%,transparent 65%)", top:"35%", right:"38%", pointerEvents:"none" }}/>

      {/* Painel esquerdo — hero */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", padding:"64px 72px", position:"relative", minWidth:0 }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:52 }}>
          <div style={{ width:52, height:52, borderRadius:16, background:"linear-gradient(135deg,#10b981,#06b6d4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, fontWeight:900, color:"#fff", boxShadow:"0 8px 32px #10b98150", animation:"floatUp 4s ease-in-out infinite" }}>C</div>
          <div>
            <div style={{ fontSize:20, fontWeight:800, color:C.text, letterSpacing:-0.5, lineHeight:1 }}>C4OS</div>
            <div style={{ fontSize:12, color:C.muted, fontWeight:500, marginTop:2 }}>Plataforma de Treinamento</div>
          </div>
        </div>

        {/* Headline */}
        <h1 style={{ fontSize:40, fontWeight:900, color:C.text, margin:"0 0 16px", lineHeight:1.15, letterSpacing:-1.5 }}>
          Domine o C4OS<br/>
          <span style={{ background:"linear-gradient(135deg,#10b981 30%,#06b6d4)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
            do zero ao avançado
          </span>
        </h1>
        <p style={{ fontSize:16, color:C.muted, margin:"0 0 44px", lineHeight:1.75, maxWidth:440 }}>
          Treinamento oficial e completo da plataforma. Aprenda no seu ritmo, pratique em simuladores reais e conquiste o certificado.
        </p>

        {/* Features */}
        <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:52 }}>
          {features.map((f, i) => (
            <div key={i} className="feature-item" style={{ animationDelay:`${i*80}ms`, display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:C.card, border:`1px solid ${C.borderLt}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{f.icon}</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:C.text, lineHeight:1 }}>{f.label}</div>
                <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>{f.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Mini stats */}
        <div style={{ display:"flex", gap:24 }}>
          {[{n:"10",l:"Módulos"},{n:"45+",l:"Aulas"},{n:"5",l:"Laboratórios"},{n:"1",l:"Certificado"}].map((s,i) => (
            <div key={i} style={{ textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:900, color:C.text, lineHeight:1 }}>{s.n}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Divisor */}
      <div style={{ width:1, background:`linear-gradient(to bottom,transparent,${C.border} 20%,${C.border} 80%,transparent)`, flexShrink:0, alignSelf:"stretch" }}/>

      {/* Painel direito — form */}
      <div style={{ width:480, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", padding:"48px 56px" }}>
        <div style={{ width:"100%", maxWidth:360 }}>
          <div style={{ marginBottom:32 }}>
            <h2 style={{ fontSize:22, fontWeight:800, color:C.text, margin:"0 0 6px", letterSpacing:-0.5 }}>Bem-vindo de volta 👋</h2>
            <p style={{ fontSize:13, color:C.muted, margin:0 }}>Entre com suas credenciais do C4OS para continuar</p>
          </div>

          <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:18 }}>
            {/* Email */}
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:.8, display:"block", marginBottom:7 }}>E-mail</label>
              <input className="login-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                onFocus={()=>setFocused("email")} onBlur={()=>setFocused(null)}
                placeholder="seu@email.com.br"
                style={{ width:"100%", background:"#0c1829", border:`1.5px solid ${focused==="email"?C.teal:C.borderLt}`, borderRadius:10, padding:"12px 14px", fontSize:14, color:C.text, outline:"none", boxSizing:"border-box", transition:"border-color .2s, box-shadow .2s", fontFamily:"inherit" }} />
            </div>

            {/* Senha */}
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:.8, display:"block", marginBottom:7 }}>Senha</label>
              <input className="login-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required
                onFocus={()=>setFocused("password")} onBlur={()=>setFocused(null)}
                placeholder="••••••••"
                style={{ width:"100%", background:"#0c1829", border:`1.5px solid ${focused==="password"?C.teal:C.borderLt}`, borderRadius:10, padding:"12px 14px", fontSize:14, color:C.text, outline:"none", boxSizing:"border-box", transition:"border-color .2s, box-shadow .2s", fontFamily:"inherit" }} />
            </div>

            {err && (
              <div style={{ background:"#2d1117", border:"1px solid #5c2026", borderRadius:8, padding:"10px 14px", fontSize:13, color:C.red, display:"flex", alignItems:"center", gap:8 }}>
                ⚠️ {err}
              </div>
            )}

            <button type="submit" className="login-btn" disabled={loading}
              style={{ background:loading?"#1e2d40":`linear-gradient(135deg,${C.green} 0%,${C.teal} 100%)`, border:"none", borderRadius:10, padding:"13px 0", fontSize:14, fontWeight:700, color:loading?C.muted:"#fff", cursor:loading?"not-allowed":"pointer", transition:"all .2s", boxShadow:loading?"none":`0 4px 20px ${C.green}30`, marginTop:2 }}>
              {loading ? "⟳  Entrando..." : "Acessar Treinamentos →"}
            </button>
          </form>

          <div style={{ marginTop:28, padding:"18px 20px", background:C.card, border:`1px solid ${C.border}`, borderRadius:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:6 }}>🔑 Credenciais</div>
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>Use o mesmo e-mail e senha que você já usa para acessar o sistema C4OS da sua empresa.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Renderizador de seção do conteúdo ────────────────────────────────────────
function Section({ sec, accent }) {
  const ac = accent || C.green;

  if (sec.kind === "text") return (
    <div style={{ marginBottom:24, paddingLeft:16, borderLeft:`3px solid ${ac}40`, animation:"fadeSlide .3s ease" }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:8, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%", background:ac, flexShrink:0 }}/>
        {sec.title}
      </div>
      <p style={{ fontSize:14, color:C.muted, lineHeight:1.8, margin:0 }}>{sec.body}</p>
    </div>
  );

  if (sec.kind === "steps") return (
    <div style={{ marginBottom:24 }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:12, background:`${ac}22`, color:ac, borderRadius:6, padding:"2px 8px", fontWeight:700 }}>Passo a passo</span>
        {sec.title}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
        {sec.steps.map((s, i) => (
          <div key={i} style={{ display:"flex", gap:0, alignItems:"stretch" }}>
            {/* Step number + line */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:36, flexShrink:0 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:`linear-gradient(135deg,${ac},${ac}bb)`, color:"#fff", fontSize:11, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:`0 2px 8px ${ac}40` }}>{i+1}</div>
              {i < sec.steps.length - 1 && <div style={{ width:2, flex:1, background:`${ac}25`, margin:"2px 0" }}/>}
            </div>
            {/* Content */}
            <div style={{ flex:1, paddingLeft:12, paddingBottom: i < sec.steps.length - 1 ? 16 : 0, paddingTop:4 }}>
              <span style={{ fontSize:14, color:C.muted, lineHeight:1.65 }}>{s}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (sec.kind === "list") return (
    <div style={{ marginBottom:24 }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:12 }}>{sec.title}</div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {sec.items.map((item, i) => (
          <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"9px 13px", background:C.card, borderRadius:8, border:`1px solid ${C.border}` }}>
            <span style={{ fontSize:14, color:C.text, lineHeight:1.6, flex:1 }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return null;
}

// ─── Componentes dos laboratórios ────────────────────────────────────────────
const Lbtn = ({ onClick, disabled, children, style = {} }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ border:"none", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:disabled?"not-allowed":"pointer", opacity:disabled?.5:1, fontFamily:"inherit", ...style }}>
    {children}
  </button>
);

const TaskItem = ({ done, label }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
    <div style={{ width:22, height:22, borderRadius:"50%", background:done?C.green:C.border, border:`2px solid ${done?C.green:C.borderLt}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .3s" }}>
      {done && <span style={{ fontSize:11, color:"#fff" }}>✓</span>}
    </div>
    <span style={{ fontSize:13, color:done?C.green:C.muted, textDecoration:done?"line-through":"none", transition:"all .3s" }}>{label}</span>
  </div>
);

// ── Lab 1: Checklist de Setup Inicial ────────────────────────────────────────
function LabSetup({ onComplete }) {
  const items = [
    { id:"empresa", label:"Preenchi as informações da empresa (nome, horário de atendimento)" },
    { id:"whatsapp", label:"Conectei o WhatsApp escaneando o QR Code em Empresa → Integrações" },
    { id:"setor", label:"Criei pelo menos um setor (ex: Vendas) em Configurações → Setores" },
    { id:"membro", label:"Convidei um membro da equipe em Configurações → Equipe" },
    { id:"chatbot", label:"Configurei a mensagem de boas-vindas do chatbot em Empresa → Chatbot" },
    { id:"lead", label:"Criei o primeiro lead de teste em Leads → + Novo Lead" },
  ];
  const [done, setDone] = useState({});
  const toggle = (id) => setDone(d => { const n={...d, [id]:!d[id]}; return n; });
  const allDone = items.every(i => done[i.id]);
  useEffect(() => { if (allDone) onComplete(); }, [allDone]);

  return (
    <div>
      <div style={{ background:`${C.blue}18`, border:`1px solid ${C.blue}44`, borderRadius:10, padding:"12px 16px", marginBottom:20, fontSize:13, color:C.muted, lineHeight:1.6 }}>
        📋 <strong style={{ color:C.text }}>Missão:</strong> complete as etapas abaixo para finalizar a configuração inicial. Conforme for fazendo cada item <em>no sistema real</em>, marque aqui como concluído.
      </div>
      <div style={{ display:"flex", flexDirection:"column" }}>
        {items.map(item => (
          <div key={item.id} onClick={() => toggle(item.id)}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:8, cursor:"pointer", marginBottom:4, background:done[item.id]?`${C.green}10`:"transparent", border:`1px solid ${done[item.id]?C.greenBd:C.border}` }}>
            <div style={{ width:24, height:24, borderRadius:6, background:done[item.id]?C.green:C.border, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .25s" }}>
              {done[item.id] && <span style={{ fontSize:13, color:"#fff" }}>✓</span>}
            </div>
            <span style={{ fontSize:13, color:done[item.id]?C.green:C.text }}>{item.label}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop:16, fontSize:12, color:C.muted, textAlign:"center" }}>
        {Object.values(done).filter(Boolean).length}/{items.length} etapas concluídas
        {allDone && <span style={{ color:C.green, fontWeight:700 }}> — Configuração inicial completa! 🎉</span>}
      </div>
    </div>
  );
}

// ── Lab 2: Criar Lead + Pipeline ──────────────────────────────────────────────
function LabLeads({ onComplete }) {
  const [fase, setFase] = useState("form"); // form | kanban | done
  const [form, setForm] = useState({ nome:"", telefone:"", email:"", etapa:"novo", tag:"" });
  const [lead, setLead] = useState(null);
  const [etapaAtual, setEtapaAtual] = useState("novo");
  const [saved, setSaved] = useState(false);
  const erros = !form.nome.trim() || !form.telefone.trim();

  const salvar = () => {
    if (erros) return;
    setLead({ ...form, id: Date.now() });
    setSaved(true);
    setTimeout(() => { setFase("kanban"); setSaved(false); }, 800);
  };

  useEffect(() => { if (etapaAtual === "proposta") { setTimeout(onComplete, 600); } }, [etapaAtual]);

  const etapas = [
    { id:"novo", label:"Novo", color:"#64748b" },
    { id:"qualificado", label:"Qualificado", color:C.blue },
    { id:"proposta", label:"Proposta", color:C.green },
  ];

  if (fase === "form") return (
    <div>
      <div style={{ background:`${C.blue}18`, border:`1px solid ${C.blue}44`, borderRadius:10, padding:"12px 16px", marginBottom:20, fontSize:13, color:C.muted, lineHeight:1.6 }}>
        📋 <strong style={{ color:C.text }}>Missão:</strong> crie um lead de teste preenchendo o formulário abaixo, depois mova-o no pipeline até a etapa "Proposta".
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {[
          { field:"nome", label:"Nome completo *", placeholder:"Ex: Maria Oliveira" },
          { field:"telefone", label:"Telefone (com DDD) *", placeholder:"Ex: 11999990000" },
          { field:"email", label:"E-mail", placeholder:"Ex: maria@empresa.com.br" },
          { field:"tag", label:"Tag", placeholder:"Ex: cliente-vip" },
        ].map(({ field, label, placeholder }) => (
          <div key={field}>
            <div style={{ fontSize:11, fontWeight:600, color:C.muted, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>{label}</div>
            <input value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} placeholder={placeholder}
              style={{ width:"100%", background:"#0f1929", border:`1px solid ${C.borderLt}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:C.text, outline:"none", fontFamily:"inherit" }} />
          </div>
        ))}
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:C.muted, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>Etapa inicial</div>
          <select value={form.etapa} onChange={e => setForm(f => ({ ...f, etapa: e.target.value }))}
            style={{ width:"100%", background:"#0f1929", border:`1px solid ${C.borderLt}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:C.text, outline:"none", fontFamily:"inherit" }}>
            {etapas.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop:16, display:"flex", justifyContent:"flex-end" }}>
        <Lbtn onClick={salvar} disabled={erros || saved}
          style={{ background:erros?C.border:`linear-gradient(135deg,${C.green},${C.teal})`, color:erros?C.muted:"#fff", padding:"10px 24px" }}>
          {saved ? "✓ Salvando..." : "Salvar Lead"}
        </Lbtn>
      </div>
    </div>
  );

  if (fase === "kanban") return (
    <div>
      <div style={{ background:`${C.green}18`, border:`1px solid ${C.greenBd}`, borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:13, color:C.green }}>
        ✓ Lead <strong>{lead?.nome}</strong> criado! Agora clique nos botões abaixo para mover o lead pelas etapas do pipeline.
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        {etapas.map(etapa => (
          <div key={etapa.id} style={{ background:etapaAtual===etapa.id?`${etapa.color}18`:C.card, border:`1.5px solid ${etapaAtual===etapa.id?etapa.color:C.border}`, borderRadius:10, padding:12, minHeight:120 }}>
            <div style={{ fontSize:11, fontWeight:700, color:etapa.color, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>{etapa.label}</div>
            {etapaAtual === etapa.id && lead && (
              <div style={{ background:C.card, border:`1px solid ${C.borderLt}`, borderRadius:8, padding:10 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{lead.nome}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{lead.telefone}</div>
                {etapa.id !== "proposta" && (
                  <Lbtn onClick={() => setEtapaAtual(etapas[etapas.findIndex(e=>e.id===etapa.id)+1]?.id || etapa.id)}
                    style={{ marginTop:8, background:etapa.color, color:"#fff", fontSize:11, padding:"5px 10px" }}>
                    Mover para {etapas[etapas.findIndex(e=>e.id===etapa.id)+1]?.label} →
                  </Lbtn>
                )}
                {etapa.id === "proposta" && <div style={{ fontSize:11, color:C.green, marginTop:6, fontWeight:700 }}>🎉 Lead na etapa final!</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return null;
}

// ── Lab 3: Simulação de Inbox WhatsApp ───────────────────────────────────────
function LabInbox({ onComplete }) {
  const CONVS_INIT = [
    { id:1, nome:"Maria Silva", tel:"11 98765-4321", status:"waiting", time:"14:23",
      msgs:[ { de:"cliente", txt:"Olá! Queria saber sobre os planos disponíveis.", t:"14:23" }, { de:"cliente", txt:"Podem me enviar uma proposta?", t:"14:24" } ] },
    { id:2, nome:"João Oliveira", tel:"21 99876-5432", status:"bot", time:"13:45",
      msgs:[ { de:"cliente", txt:"Bom dia! Tenho uma dúvida sobre o suporte.", t:"13:45" }, { de:"bot", txt:"Olá João! Selecione uma opção:\n1. Suporte técnico\n2. Financeiro\n3. Vendas", t:"13:45" } ] },
    { id:3, nome:"Ana Paula", tel:"31 91234-5678", status:"attending", time:"12:30",
      msgs:[ { de:"cliente", txt:"Preciso de ajuda com a configuração.", t:"12:30" }, { de:"agente", txt:"Olá Ana! Como posso te ajudar?", t:"12:31" }, { de:"cliente", txt:"Não estou conseguindo conectar o WhatsApp.", t:"12:32" } ] },
  ];
  const [convs, setConvs]   = useState(CONVS_INIT);
  const [ativa, setAtiva]   = useState(null);
  const [input, setInput]   = useState("");
  const [tasks, setTasks]   = useState({ assumiu:false, respondeu:false, encerrou:false });
  const [closeModal, setCloseModal] = useState(false);
  const [motivo, setMotivo] = useState("resolvido");

  const conv = convs.find(c => c.id === ativa);
  const allDone = Object.values(tasks).every(Boolean);
  useEffect(() => { if (allDone) setTimeout(onComplete, 800); }, [allDone]);

  const assumir = () => {
    setConvs(cs => cs.map(c => c.id===ativa ? {...c, status:"attending"} : c));
    setTasks(t => ({...t, assumiu:true}));
  };

  const enviar = () => {
    if (!input.trim()) return;
    setConvs(cs => cs.map(c => c.id===ativa ? {...c, msgs:[...c.msgs, {de:"agente", txt:input.trim(), t:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}]} : c));
    setInput("");
    setTasks(t => ({...t, respondeu:true}));
  };

  const encerrar = () => {
    setConvs(cs => cs.map(c => c.id===ativa ? {...c, status:"closed"} : c));
    setAtiva(null); setCloseModal(false);
    setTasks(t => ({...t, encerrou:true}));
  };

  const statusInfo = { waiting:{label:"Aguardando",bg:"#78350f22",color:"#fbbf24"}, bot:{label:"Bot",bg:`${C.blue}22`,color:C.blue}, attending:{label:"Em atendimento",bg:`${C.green}22`,color:C.green}, closed:{label:"Encerrada",bg:`${C.slate}22`,color:C.slate} };

  return (
    <div>
      <div style={{ background:`${C.blue}18`, border:`1px solid ${C.blue}44`, borderRadius:10, padding:"12px 16px", marginBottom:14, fontSize:13, color:C.muted, lineHeight:1.6 }}>
        📋 <strong style={{ color:C.text }}>Missão:</strong> (1) assuma a conversa da Maria, (2) responda uma mensagem, (3) encerre a conversa da Ana Paula.
      </div>
      {/* Tarefas */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        {[{k:"assumiu",l:"Assumir conversa"},{k:"respondeu",l:"Responder mensagem"},{k:"encerrou",l:"Encerrar conversa"}].map(({k,l}) => (
          <div key={k} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, padding:"4px 10px", borderRadius:6, background:tasks[k]?`${C.green}22`:C.card, color:tasks[k]?C.green:C.muted, border:`1px solid ${tasks[k]?C.greenBd:C.border}` }}>
            {tasks[k]?"✓":""} {l}
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:0, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", height:360 }}>
        {/* Lista de conversas */}
        <div style={{ width:200, minWidth:200, borderRight:`1px solid ${C.border}`, overflowY:"auto", background:C.sidebar }}>
          {convs.map(c => {
            const si = statusInfo[c.status] || statusInfo.waiting;
            return (
              <div key={c.id} onClick={() => setAtiva(c.id)}
                style={{ padding:"10px 12px", cursor:"pointer", borderBottom:`1px solid ${C.border}`, background:ativa===c.id?`${C.green}14`:C.sidebar, borderLeft:ativa===c.id?`2px solid ${C.green}`:"2px solid transparent" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{c.nome}</span>
                  <span style={{ fontSize:9, color:C.muted }}>{c.time}</span>
                </div>
                <span style={{ fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:4, background:si.bg, color:si.color }}>{si.label}</span>
              </div>
            );
          })}
        </div>

        {/* Chat */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", background:C.bg }}>
          {!conv ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.muted, fontSize:13 }}>Selecione uma conversa</div>
          ) : (
            <>
              {/* Header do chat */}
              <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", background:C.sidebar }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{conv.nome}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{conv.tel}</div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {conv.status === "waiting" && (
                    <Lbtn onClick={assumir} style={{ background:C.teal, color:"#fff", fontSize:11 }}>Assumir</Lbtn>
                  )}
                  {conv.status === "attending" && (
                    <Lbtn onClick={() => setCloseModal(true)} style={{ background:`${C.red}22`, color:C.red, fontSize:11, border:`1px solid ${C.red}44` }}>Encerrar</Lbtn>
                  )}
                  {conv.status === "closed" && (
                    <span style={{ fontSize:11, color:C.slate }}>Encerrada</span>
                  )}
                </div>
              </div>

              {/* Mensagens */}
              <div style={{ flex:1, overflowY:"auto", padding:12, display:"flex", flexDirection:"column", gap:8 }}>
                {conv.msgs.map((m, i) => (
                  <div key={i} style={{ display:"flex", justifyContent:m.de==="cliente"?"flex-start":"flex-end" }}>
                    <div style={{ maxWidth:"75%", background:m.de==="cliente"?C.card:m.de==="bot"?`${C.blue}22`:C.green+"33", borderRadius:10, padding:"8px 12px" }}>
                      {m.de==="bot" && <div style={{ fontSize:10, color:C.blue, fontWeight:700, marginBottom:4 }}>🤖 Bot</div>}
                      <div style={{ fontSize:12, color:C.text, whiteSpace:"pre-wrap" }}>{m.txt}</div>
                      <div style={{ fontSize:10, color:C.muted, textAlign:"right", marginTop:2 }}>{m.t}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              {conv.status === "attending" && (
                <div style={{ padding:"8px 12px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8 }}>
                  <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter" && enviar()}
                    placeholder="Digite uma resposta..."
                    style={{ flex:1, background:C.card, border:`1px solid ${C.borderLt}`, borderRadius:8, padding:"7px 10px", fontSize:12, color:C.text, outline:"none", fontFamily:"inherit" }} />
                  <Lbtn onClick={enviar} style={{ background:C.green, color:"#fff" }}>Enviar</Lbtn>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de encerramento */}
      {closeModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24, width:320 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:12 }}>Encerrar conversa</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>Selecione o motivo do encerramento:</div>
            {["resolvido","sem-resposta","nao-qualificado","transferido"].map(m => (
              <label key={m} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", cursor:"pointer" }}>
                <input type="radio" name="motivo" value={m} checked={motivo===m} onChange={() => setMotivo(m)} />
                <span style={{ fontSize:13, color:C.text, textTransform:"capitalize" }}>{m.replace("-"," ")}</span>
              </label>
            ))}
            <div style={{ display:"flex", gap:8, marginTop:16 }}>
              <Lbtn onClick={() => setCloseModal(false)} style={{ flex:1, background:C.border, color:C.muted }}>Cancelar</Lbtn>
              <Lbtn onClick={encerrar} style={{ flex:1, background:C.green, color:"#fff" }}>Confirmar</Lbtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Lab 4: Montar Menu do Chatbot ────────────────────────────────────────────
function LabChatbot({ onComplete }) {
  const [step, setStep] = useState(1); // 1=boas-vindas, 2=menu, 3=preview
  const [boasVindas, setBoasVindas] = useState("");
  const [opcoes, setOpcoes] = useState([{ label:"", destino:"vendas" }, { label:"", destino:"suporte" }, { label:"", destino:"financeiro" }]);
  const [saved, setSaved] = useState(false);

  const setOpcao = (i, field, val) => setOpcoes(os => os.map((o, idx) => idx===i ? {...o, [field]:val} : o));
  const canNext1 = boasVindas.trim().length >= 10;
  const canNext2 = opcoes.filter(o => o.label.trim()).length >= 2;

  const salvar = () => {
    setSaved(true);
    setTimeout(() => { setStep(3); setSaved(false); }, 700);
  };

  useEffect(() => { if (step===3) setTimeout(onComplete, 3000); }, [step]);

  return (
    <div>
      {/* Steps */}
      <div style={{ display:"flex", gap:0, marginBottom:20 }}>
        {[{n:1,l:"Boas-vindas"},{n:2,l:"Menu"},{n:3,l:"Preview"}].map(({n,l}) => (
          <div key={n} style={{ flex:1, display:"flex", alignItems:"center", gap:6, padding:"8px 12px", background:step===n?`${C.purple}22`:step>n?`${C.green}12`:C.card, borderBottom:`2px solid ${step===n?C.purple:step>n?C.green:C.border}` }}>
            <div style={{ width:20, height:20, borderRadius:"50%", background:step>n?C.green:step===n?C.purple:C.border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:step>=n?"#fff":C.muted }}>
              {step>n?"✓":n}
            </div>
            <span style={{ fontSize:11, fontWeight:700, color:step===n?C.purple:step>n?C.green:C.muted }}>{l}</span>
          </div>
        ))}
      </div>

      {step===1 && (
        <div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:10 }}>Esta é a primeira mensagem que o cliente recebe ao entrar em contato. Deve ser amigável e clara (mínimo 10 caracteres):</div>
          <textarea value={boasVindas} onChange={e => setBoasVindas(e.target.value)} placeholder="Ex: Olá! Seja bem-vindo(a) à [Empresa]. Como posso te ajudar hoje? 😊"
            rows={4} style={{ width:"100%", background:"#0f1929", border:`1px solid ${C.borderLt}`, borderRadius:8, padding:"10px 12px", fontSize:13, color:C.text, outline:"none", fontFamily:"inherit", resize:"vertical" }} />
          <div style={{ marginTop:8, fontSize:11, color:boasVindas.length>=10?C.green:C.muted }}>{boasVindas.length} caracteres {boasVindas.length>=10?"✓":""}</div>
          <div style={{ marginTop:12, display:"flex", justifyContent:"flex-end" }}>
            <Lbtn onClick={() => setStep(2)} disabled={!canNext1} style={{ background:canNext1?C.purple:C.border, color:canNext1?"#fff":C.muted, padding:"9px 20px" }}>Próximo →</Lbtn>
          </div>
        </div>
      )}

      {step===2 && (
        <div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>Configure as opções do menu. O cliente receberá as opções numeradas. Preencha ao menos 2:</div>
          {opcoes.map((op, i) => (
            <div key={i} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"center" }}>
              <div style={{ width:24, height:24, borderRadius:"50%", background:op.label.trim()?C.purple:C.border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff", flexShrink:0 }}>{i+1}</div>
              <input value={op.label} onChange={e => setOpcao(i,"label",e.target.value)} placeholder={`Opção ${i+1} (ex: Vendas, Suporte...)`}
                style={{ flex:1, background:"#0f1929", border:`1px solid ${C.borderLt}`, borderRadius:8, padding:"8px 10px", fontSize:12, color:C.text, outline:"none", fontFamily:"inherit" }} />
              <select value={op.destino} onChange={e => setOpcao(i,"destino",e.target.value)}
                style={{ background:"#0f1929", border:`1px solid ${C.borderLt}`, borderRadius:8, padding:"8px 10px", fontSize:12, color:C.text, outline:"none", fontFamily:"inherit" }}>
                {["vendas","suporte","financeiro","rh","ti"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          ))}
          <div style={{ marginTop:12, display:"flex", justifyContent:"space-between" }}>
            <Lbtn onClick={() => setStep(1)} style={{ background:C.card, color:C.muted, border:`1px solid ${C.border}` }}>← Voltar</Lbtn>
            <Lbtn onClick={salvar} disabled={!canNext2||saved} style={{ background:canNext2?C.purple:C.border, color:canNext2?"#fff":C.muted, padding:"9px 20px" }}>
              {saved?"✓ Salvando...":"Salvar e ver preview →"}
            </Lbtn>
          </div>
        </div>
      )}

      {step===3 && (
        <div>
          <div style={{ background:`${C.green}18`, border:`1px solid ${C.greenBd}`, borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:13, color:C.green }}>
            ✓ Chatbot configurado! Veja como o cliente vai receber as mensagens:
          </div>
          {/* Preview estilo WhatsApp */}
          <div style={{ background:"#0a1929", borderRadius:12, padding:16, maxWidth:320 }}>
            <div style={{ fontSize:10, color:"#64748b", textAlign:"center", marginBottom:8 }}>Hoje · Preview do chatbot</div>
            <div style={{ background:"#1e293b", borderRadius:"0 10px 10px 10px", padding:"8px 12px", marginBottom:8, display:"inline-block", maxWidth:"90%" }}>
              <div style={{ fontSize:12, color:"#f1f5f9", whiteSpace:"pre-wrap" }}>{boasVindas}</div>
            </div>
            <div style={{ background:"#1e293b", borderRadius:"0 10px 10px 10px", padding:"8px 12px", display:"inline-block", maxWidth:"90%" }}>
              <div style={{ fontSize:12, color:"#f1f5f9" }}>
                {opcoes.filter(o => o.label.trim()).map((o, i) => <div key={i}>{i+1}. {o.label} → {o.destino}</div>)}
              </div>
            </div>
          </div>
          <div style={{ marginTop:14, fontSize:12, color:C.green, fontWeight:700 }}>🎉 Lab concluído! Seu chatbot está pronto.</div>
        </div>
      )}
    </div>
  );
}

// ── Lab 5: Criar Campanha de Disparo ─────────────────────────────────────────
function LabCampanha({ onComplete }) {
  const [step, setStep] = useState(1);
  const [camp, setCamp] = useState({ nome:"", msg:"", audiencia:"todos", data:"", hora:"09:00" });
  const [previewed, setPreviewed] = useState(false);
  const set = (k, v) => setCamp(c => ({...c, [k]:v}));

  const canStep1 = camp.nome.trim() && camp.msg.trim().length >= 10;
  const canStep2 = !!camp.audiencia;
  const previewMsg = camp.msg.replace(/\{\{nome\}\}/g, "Maria Silva");

  useEffect(() => { if (previewed) setTimeout(onComplete, 2000); }, [previewed]);

  return (
    <div>
      {/* Steps */}
      <div style={{ display:"flex", gap:0, marginBottom:20 }}>
        {[{n:1,l:"Mensagem"},{n:2,l:"Audiência"},{n:3,l:"Agendamento"},{n:4,l:"Preview"}].map(({n,l}) => (
          <div key={n} style={{ flex:1, padding:"7px 6px", background:step===n?`${C.yellow}22`:step>n?`${C.green}12`:C.card, borderBottom:`2px solid ${step===n?C.yellow:step>n?C.green:C.border}`, textAlign:"center" }}>
            <div style={{ fontSize:10, fontWeight:700, color:step===n?C.yellow:step>n?C.green:C.muted }}>{step>n?"✓ ":""}{l}</div>
          </div>
        ))}
      </div>

      {step===1 && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:C.muted, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>Nome da campanha (interno)</div>
            <input value={camp.nome} onChange={e => set("nome",e.target.value)} placeholder="Ex: Promoção Julho 2025"
              style={{ width:"100%", background:"#0f1929", border:`1px solid ${C.borderLt}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:C.text, outline:"none", fontFamily:"inherit" }} />
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:C.muted, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>Mensagem</div>
            <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>Use {"{{nome}}"} para personalizar com o nome do destinatário.</div>
            <textarea value={camp.msg} onChange={e => set("msg",e.target.value)} placeholder="Ex: Olá {{nome}}! Temos uma oferta especial para você. Quer saber mais?"
              rows={4} style={{ width:"100%", background:"#0f1929", border:`1px solid ${C.borderLt}`, borderRadius:8, padding:"10px 12px", fontSize:13, color:C.text, outline:"none", fontFamily:"inherit", resize:"vertical" }} />
            <div style={{ marginTop:4, fontSize:11, color:C.muted }}>{camp.msg.length} caracteres</div>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <Lbtn onClick={() => setStep(2)} disabled={!canStep1} style={{ background:canStep1?C.yellow:C.border, color:canStep1?"#111":"white", padding:"9px 20px" }}>Próximo →</Lbtn>
          </div>
        </div>
      )}

      {step===2 && (
        <div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>Selecione quem vai receber esta campanha:</div>
          {[{v:"todos",l:"Todos os leads ativos",n:"1.247 contatos"},{v:"qualificados",l:"Leads qualificados",n:"342 contatos"},{v:"tag-vip",l:"Tag: cliente-vip",n:"89 contatos"},{v:"proposta",l:"Etapa: Proposta enviada",n:"56 contatos"}].map(op => (
            <label key={op.v} onClick={() => set("audiencia",op.v)}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:8, cursor:"pointer", marginBottom:6, background:camp.audiencia===op.v?`${C.yellow}22`:C.card, border:`1px solid ${camp.audiencia===op.v?C.yellow:C.border}` }}>
              <div style={{ width:18, height:18, borderRadius:"50%", background:camp.audiencia===op.v?C.yellow:C.border, flexShrink:0 }}/>
              <div>
                <div style={{ fontSize:13, color:C.text, fontWeight:600 }}>{op.l}</div>
                <div style={{ fontSize:11, color:C.muted }}>{op.n}</div>
              </div>
            </label>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:12 }}>
            <Lbtn onClick={() => setStep(1)} style={{ background:C.card, color:C.muted, border:`1px solid ${C.border}` }}>← Voltar</Lbtn>
            <Lbtn onClick={() => setStep(3)} disabled={!canStep2} style={{ background:C.yellow, color:"#111", padding:"9px 20px" }}>Próximo →</Lbtn>
          </div>
        </div>
      )}

      {step===3 && (
        <div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>Configure quando a campanha será enviada:</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:C.muted, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>Data</div>
              <input type="date" value={camp.data} onChange={e => set("data",e.target.value)}
                style={{ width:"100%", background:"#0f1929", border:`1px solid ${C.borderLt}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:C.text, outline:"none", fontFamily:"inherit" }} />
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:C.muted, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>Horário</div>
              <select value={camp.hora} onChange={e => set("hora",e.target.value)}
                style={{ width:"100%", background:"#0f1929", border:`1px solid ${C.borderLt}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:C.text, outline:"none", fontFamily:"inherit" }}>
                {["08:00","09:00","10:00","11:00","14:00","15:00","16:00"].map(h => <option key={h}>{h}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <Lbtn onClick={() => setStep(2)} style={{ background:C.card, color:C.muted, border:`1px solid ${C.border}` }}>← Voltar</Lbtn>
            <Lbtn onClick={() => setStep(4)} style={{ background:C.yellow, color:"#111", padding:"9px 20px" }}>Ver Preview →</Lbtn>
          </div>
        </div>
      )}

      {step===4 && (
        <div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:14 }}>Confira como sua mensagem vai aparecer no WhatsApp do destinatário:</div>
          <div style={{ background:"#0a1929", borderRadius:12, padding:16, maxWidth:320, marginBottom:16 }}>
            <div style={{ fontSize:10, color:"#64748b", textAlign:"center", marginBottom:8 }}>Preview — {camp.hora} · {camp.data || "hoje"}</div>
            <div style={{ background:"#25d36622", border:"1px solid #25d36644", borderRadius:"0 10px 10px 10px", padding:"10px 14px", display:"inline-block", maxWidth:"90%" }}>
              <div style={{ fontSize:12, color:"#f1f5f9", whiteSpace:"pre-wrap", lineHeight:1.6 }}>{previewMsg}</div>
              <div style={{ fontSize:10, color:"#64748b", textAlign:"right", marginTop:4 }}>{camp.hora} ✓✓</div>
            </div>
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:12 }}>
            <div style={{ color:C.muted }}>📣 <strong style={{ color:C.text }}>{camp.nome}</strong></div>
            <div style={{ color:C.muted, marginTop:4 }}>👥 Audiência: <strong style={{ color:C.text }}>{camp.audiencia}</strong></div>
            <div style={{ color:C.muted, marginTop:4 }}>⏱️ Envio: <strong style={{ color:C.text }}>{camp.data || "hoje"} às {camp.hora}</strong></div>
          </div>
          <Lbtn onClick={() => setPreviewed(true)} disabled={previewed}
            style={{ background:previewed?C.green:C.yellow, color:previewed?"#fff":"#111", padding:"10px 24px", fontSize:13, opacity:previewed?.8:1 }}>
            {previewed ? "✓ Campanha aprovada! Lab concluído." : "✅ Aprovar e agendar campanha"}
          </Lbtn>
        </div>
      )}
    </div>
  );
}

// ── Dispatcher de laboratórios ────────────────────────────────────────────────
function LabView({ lesson, onComplete }) {
  const labs = { setup: LabSetup, leads: LabLeads, inbox: LabInbox, chatbot: LabChatbot, campanha: LabCampanha };
  const Lab = labs[lesson.lab?.type];
  if (!Lab) return <div style={{ color:C.muted, fontSize:13 }}>Lab não encontrado.</div>;
  return <Lab onComplete={onComplete} config={lesson.lab} />;
}

// ─── Conteúdo da aula ─────────────────────────────────────────────────────────
function LessonView({ lesson, mod, isCompleted, onComplete, onPrev, onNext, hasPrev, hasNext, onBack }) {
  const typeLabel = { leitura: "📖 Leitura", prática: "⚡ Prática", lab: "🧪 Laboratório" };
  const typeBg    = { leitura: C.blue, prática: C.yellow, lab: C.purple };
  const tc = typeBg[lesson.type] || C.slate;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Gradient banner */}
      <div style={{ background:`linear-gradient(135deg,${mod.color}22 0%,${mod.color}08 60%,transparent 100%)`, borderBottom:`1px solid ${mod.color}30`, padding:"28px 36px 24px", flexShrink:0 }}>
        {/* Breadcrumb */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, flexWrap:"wrap" }}>
          <button onClick={onBack}
            style={{ background:"transparent", border:`1px solid ${C.borderLt}`, borderRadius:8, padding:"4px 12px", fontSize:12, fontWeight:600, color:C.muted, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:5, transition:"all .15s" }}>
            ← Módulos
          </button>
          <span style={{ color:C.border }}>›</span>
          <span style={{ fontSize:13, fontWeight:700, color:mod.color, background:`${mod.color}18`, border:`1px solid ${mod.color}30`, borderRadius:8, padding:"4px 12px", display:"inline-flex", alignItems:"center", gap:5 }}>
            <span>{mod.icon}</span> {mod.title}
          </span>
          <span style={{ color:C.border }}>›</span>
          <span style={{ fontSize:12, color:C.muted }}>{typeLabel[lesson.type] ?? lesson.type}</span>
          {lesson.duration && (
            <>
              <span style={{ color:C.border }}>·</span>
              <span style={{ fontSize:12, color:C.muted }}>⏱ {lesson.duration}</span>
            </>
          )}
          {lesson.badge && (
            <span style={{ fontSize:11, fontWeight:700, color:lesson.badgeColor ?? C.teal, background:`${(lesson.badgeColor ?? C.teal)}18`, border:`1px solid ${(lesson.badgeColor ?? C.teal)}30`, borderRadius:6, padding:"3px 10px" }}>
              ✦ {lesson.badge}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 style={{ fontSize:24, fontWeight:900, color:C.text, margin:0, lineHeight:1.25, letterSpacing:-0.5 }}>{lesson.title}</h1>

        {/* Type pill */}
        <div style={{ marginTop:10, display:"inline-flex", alignItems:"center", gap:5, background:`${tc}18`, border:`1px solid ${tc}30`, borderRadius:20, padding:"4px 12px" }}>
          <span style={{ fontSize:13 }}>{typeLabel[lesson.type]?.split(" ")[0]}</span>
          <span style={{ fontSize:11, fontWeight:700, color:tc }}>{typeLabel[lesson.type]?.split(" ").slice(1).join(" ")}</span>
        </div>
      </div>

      {/* Conteúdo com scroll */}
      <div className="lesson-content" style={{ flex:1, overflowY:"auto", padding:"28px 36px" }}>
        {lesson.type === "lab" ? (
          <LabView lesson={lesson} onComplete={onComplete} />
        ) : (
          <>
            {lesson.sections.map((sec, i) => <Section key={i} sec={sec} accent={mod.color} />)}

            {/* Dica */}
            {lesson.tip && (
              <div style={{ background:`linear-gradient(135deg,${C.greenBg},#041f14)`, border:`1px solid ${C.greenBd}`, borderRadius:12, padding:"16px 20px", marginTop:8, display:"flex", gap:14, alignItems:"flex-start" }}>
                <div style={{ width:32, height:32, borderRadius:10, background:`${C.green}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>💡</div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:C.green, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>Dica profissional</div>
                  <span style={{ fontSize:13, color:"#86efac", lineHeight:1.7 }}>{lesson.tip}</span>
                </div>
              </div>
            )}

            {/* Concluído */}
            {isCompleted && (
              <div style={{ marginTop:16, background:`linear-gradient(135deg,${C.greenBg},#041f14)`, border:`1px solid ${C.greenBd}`, borderRadius:12, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:C.green, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>✅</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.green }}>Aula concluída!</div>
                  <div style={{ fontSize:12, color:"#86efac" }}>Continue para a próxima aula.</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer de navegação */}
      <div style={{ padding:"16px 36px", borderTop:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexShrink:0, background:`${C.sidebar}80`, backdropFilter:"blur(8px)" }}>
        <button onClick={onPrev} disabled={!hasPrev}
          style={{ background:hasPrev?C.card:"transparent", border:`1px solid ${hasPrev?C.borderLt:C.border}`, borderRadius:10, padding:"10px 20px", fontSize:13, fontWeight:600, color:hasPrev?C.text:C.border, cursor:hasPrev?"pointer":"default", transition:"all .2s" }}>
          ← Anterior
        </button>

        {lesson.type !== "lab" && (!isCompleted ? (
          <button onClick={onComplete}
            style={{ background:`linear-gradient(135deg,${C.green},${C.teal})`, border:"none", borderRadius:10, padding:"10px 28px", fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer", flex:1, maxWidth:240, boxShadow:`0 4px 16px ${C.green}35`, transition:"all .2s" }}>
            ✓ Marcar como concluída
          </button>
        ) : (
          <button onClick={onNext} disabled={!hasNext}
            style={{ background:hasNext?`linear-gradient(135deg,${C.green},${C.teal})`:"transparent", border:`1px solid ${hasNext?C.green:C.border}`, borderRadius:10, padding:"10px 28px", fontSize:13, fontWeight:700, color:hasNext?C.text:C.border, cursor:hasNext?"pointer":"default", flex:1, maxWidth:240, transition:"all .2s" }}>
            Próxima aula →
          </button>
        ))}

        <button onClick={onNext} disabled={!hasNext}
          style={{ background:hasNext?C.card:"transparent", border:`1px solid ${hasNext?C.borderLt:C.border}`, borderRadius:10, padding:"10px 20px", fontSize:13, fontWeight:600, color:hasNext?C.text:C.border, cursor:hasNext?"pointer":"default", transition:"all .2s" }}>
          Próxima →
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ modules, progress, activeMod, activeLesson, onSelect, overall, user, onLogout, onHome }) {
  const [expanded, setExpanded] = useState(activeMod);
  const toggle = (id) => setExpanded(e => e === id ? null : id);

  const typeIcon = { leitura:"📖", prática:"⚡", lab:"🧪" };

  return (
    <div style={{ width:288, minWidth:288, background:C.sidebar, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"20px 20px 16px", borderBottom:`1px solid ${C.border}`, background:`linear-gradient(180deg,${C.card},${C.sidebar})` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
          <button onClick={onHome}
            style={{ width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,#10b981,#06b6d4)", border:"none", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, fontWeight:900, color:"#fff", boxShadow:"0 4px 12px #10b98140", cursor:"pointer", flexShrink:0, padding:0 }}
            title="Voltar ao início">C</button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.text, lineHeight:1 }}>C4OS Treinamentos</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Portal Oficial</div>
          </div>
          <button onClick={onHome} title="Início"
            style={{ background:"transparent", border:`1px solid ${C.borderLt}`, borderRadius:8, padding:"4px 8px", fontSize:11, color:C.muted, cursor:"pointer", flexShrink:0 }}>🏠</button>
        </div>

        {/* Progresso geral */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:.5 }}>Seu progresso</span>
            <span style={{ fontSize:15, fontWeight:900, color:C.green }}>{overall.pct}%</span>
          </div>
          <div style={{ height:8, background:C.border, borderRadius:4, overflow:"hidden", marginBottom:6 }}>
            <div style={{ height:"100%", width:`${overall.pct}%`, background:`linear-gradient(90deg,${C.green},${C.teal})`, borderRadius:4, transition:"width .6s cubic-bezier(.4,0,.2,1)", boxShadow:`0 0 8px ${C.green}60` }}/>
          </div>
          <div style={{ fontSize:11, color:C.muted }}>{overall.done} de {overall.total} aulas concluídas</div>
        </div>
      </div>

      {/* Módulos */}
      <div style={{ flex:1, overflowY:"auto", padding:"8px 0" }}>
        {modules.map(mod => {
          const mp = calcModuleProgress(mod, progress);
          const isExp = expanded === mod.id;
          return (
            <div key={mod.id}>
              {/* Module header */}
              <div onClick={() => toggle(mod.id)}
                style={{ padding:"11px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:10, transition:"background .15s", background: isExp ? `${mod.color}10` : "transparent", borderLeft: isExp ? `3px solid ${mod.color}` : "3px solid transparent" }}>
                <div style={{ width:32, height:32, borderRadius:9, background:`${mod.color}20`, border:`1px solid ${mod.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{mod.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color: isExp ? mod.color : C.text, lineHeight:1.1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{mod.title}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>
                    <span style={{ color: mp.pct === 100 ? C.green : mp.done > 0 ? mod.color : C.muted }}>
                      {mp.pct === 100 ? "✓ Completo" : `${mp.done}/${mp.total} aulas`}
                    </span>
                  </div>
                </div>
                {/* Mini progress */}
                <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                  {mp.pct === 100 ? (
                    <div style={{ width:20, height:20, borderRadius:"50%", background:C.green, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:700 }}>✓</div>
                  ) : (
                    <div style={{ width:28, height:4, background:C.border, borderRadius:2, overflow:"hidden" }}>
                      <div style={{ width:`${mp.pct}%`, height:"100%", background:mod.color, borderRadius:2 }}/>
                    </div>
                  )}
                  <span style={{ fontSize:10, color:C.muted, transform: isExp ? "rotate(90deg)" : "rotate(0deg)", transition:"transform .2s", display:"inline-block" }}>›</span>
                </div>
              </div>

              {/* Lições */}
              {isExp && (
                <div style={{ background:`${mod.color}06`, borderBottom:`1px solid ${mod.color}15` }}>
                  {mod.lessons.map(lesson => {
                    const key = `${mod.id}:${lesson.id}`;
                    const done = !!progress[key];
                    const isActive = activeMod === mod.id && activeLesson === lesson.id;
                    return (
                      <div key={lesson.id} onClick={() => onSelect(mod.id, lesson.id)}
                        style={{ padding:"8px 16px 8px 58px", cursor:"pointer", display:"flex", alignItems:"center", gap:8, background: isActive ? `${mod.color}18` : "transparent", borderLeft: isActive ? `3px solid ${mod.color}` : "3px solid transparent", transition:"background .15s" }}>
                        {/* Status dot */}
                        <div style={{ width:16, height:16, borderRadius:"50%", background: done ? C.green : isActive ? mod.color : C.border, border: `1.5px solid ${done ? C.green : isActive ? mod.color : C.borderLt}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .2s" }}>
                          {done && <span style={{ fontSize:8, color:"#fff", fontWeight:900 }}>✓</span>}
                        </div>
                        <span style={{ fontSize:12, color: isActive ? mod.color : done ? C.muted : C.text, fontWeight: isActive ? 700 : 400, lineHeight:1.4, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{lesson.title}</span>
                        <span style={{ fontSize:10, flexShrink:0 }}>{typeIcon[lesson.type] || ""}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer do usuário */}
      <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}`, background:`linear-gradient(0deg,${C.card},${C.sidebar})` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:"linear-gradient(135deg,#3b82f6,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:"#fff", flexShrink:0 }}>
            {(user?.email?.[0] || "U").toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.email}</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>Aluno certificado</div>
          </div>
          <button onClick={onLogout}
            style={{ background:"transparent", border:"none", color:C.muted, cursor:"pointer", fontSize:13, padding:4, borderRadius:6, transition:"color .2s" }}
            title="Sair">
            ⎋
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Certificado ─────────────────────────────────────────────────────────────
function imprimirCertificado({ nomeUsuario, nomeEmpresa, dataConc, modulos }) {
  const modsHtml = modulos.map(m =>
    `<li style="margin:0 0 4px;font-size:13px;color:#374151;">${m.icon} ${m.title} <span style="color:#6b7280;">(${m.lessons.length} aulas)</span></li>`
  ).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Certificado C4OS — ${nomeUsuario}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, -apple-system, sans-serif; background: #f0fdf4; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 40px 20px; }
    .cert { background: #fff; width: 794px; min-height: 560px; border-radius: 20px; box-shadow: 0 8px 48px rgba(0,0,0,.12); overflow: hidden; display: flex; flex-direction: column; }
    .header { background: linear-gradient(135deg, #059669, #0891b2); padding: 36px 48px 32px; display: flex; align-items: center; justify-content: space-between; }
    .logo-row { display: flex; align-items: center; gap: 12px; }
    .logo-box { width: 48px; height: 48px; background: rgba(255,255,255,.2); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; color: #fff; }
    .logo-text { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
    .header-right { text-align: right; }
    .cert-label { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,.7); }
    .cert-title { font-size: 26px; font-weight: 800; color: #fff; margin-top: 4px; }
    .body { padding: 36px 48px 32px; flex: 1; }
    .declares { font-size: 13px; color: #6b7280; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 10px; }
    .name { font-size: 36px; font-weight: 800; color: #111827; line-height: 1.1; margin-bottom: 6px; border-bottom: 3px solid #10b981; padding-bottom: 12px; display: inline-block; }
    .company { font-size: 15px; color: #6b7280; margin: 10px 0 20px; }
    .company strong { color: #374151; }
    .desc { font-size: 14px; color: #6b7280; line-height: 1.7; max-width: 560px; margin-bottom: 24px; }
    .modules-title { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #9ca3af; margin-bottom: 10px; }
    .modules-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; margin-bottom: 28px; }
    .footer { border-top: 1px solid #f3f4f6; padding: 20px 48px; display: flex; align-items: center; justify-content: space-between; background: #f9fafb; }
    .footer-left { font-size: 12px; color: #9ca3af; }
    .footer-left strong { color: #374151; }
    .seal { width: 72px; height: 72px; border-radius: 50%; border: 3px solid #10b981; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f0fdf4; }
    .seal-inner { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #059669; letter-spacing: .5px; text-align: center; line-height: 1.3; }
    .sig-line { width: 160px; border-top: 1.5px solid #d1d5db; padding-top: 6px; font-size: 11px; color: #9ca3af; text-align: center; }
    @media print {
      body { background: #fff; padding: 0; }
      .cert { box-shadow: none; border-radius: 0; width: 100%; }
    }
  </style>
</head>
<body>
<div class="cert">
  <div class="header">
    <div class="logo-row">
      <div class="logo-box">C</div>
      <div class="logo-text">C4OS</div>
    </div>
    <div class="header-right">
      <div class="cert-label">Documento oficial</div>
      <div class="cert-title">Certificado de Conclusão</div>
    </div>
  </div>
  <div class="body">
    <div class="declares">Certificamos que</div>
    <div class="name">${nomeUsuario}</div>
    <div class="company">da empresa <strong>${nomeEmpresa}</strong></div>
    <div class="desc">concluiu com êxito o <strong>Treinamento Completo da Plataforma C4OS</strong>, cumprindo todos os módulos e aulas do programa de capacitação oficial.</div>
    <div class="modules-title">Módulos concluídos</div>
    <ul class="modules-grid" style="padding-left:16px;">${modsHtml}</ul>
  </div>
  <div class="footer">
    <div class="footer-left">
      <div><strong>Data de conclusão:</strong> ${dataConc}</div>
      <div style="margin-top:4px;"><strong>Plataforma:</strong> C4OS · c4os.com.br</div>
    </div>
    <div style="display:flex;align-items:flex-end;gap:32px;">
      <div class="sig-line">Equipe C4HUB</div>
      <div class="seal"><div class="seal-inner">✓<br/>100%<br/>Concluído</div></div>
    </div>
  </div>
</div>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

// ─── Conclusão ────────────────────────────────────────────────────────────────
function CompletionScreen({ nomeUsuario, nomeEmpresa, dataConc, modules, onBack }) {
  const [emitindo, setEmitindo] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const emitir = () => {
    setEmitindo(true);
    imprimirCertificado({ nomeUsuario, nomeEmpresa, dataConc, modulos: modules });
    setTimeout(() => setEmitindo(false), 2000);
  };

  const confettiItems = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    color: [C.green, C.teal, C.blue, C.purple, C.yellow, C.pink][i % 6],
    left: `${5 + (i * 5) % 90}%`,
    delay: `${(i * 0.15) % 2}s`,
    size: 6 + (i % 4) * 2,
  }));

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:"40px 48px", textAlign:"center", position:"relative", overflow:"hidden" }}>
      <style>{`
        @keyframes confetti { 0%{transform:translateY(120vh) rotate(0deg);opacity:1} 100%{transform:translateY(-10vh) rotate(720deg);opacity:0} }
        @keyframes popIn { 0%{transform:scale(0) rotate(-10deg);opacity:0} 60%{transform:scale(1.15) rotate(3deg)} 100%{transform:scale(1) rotate(0deg);opacity:1} }
        @keyframes glow { 0%,100%{box-shadow:0 0 30px #10b98130} 50%{box-shadow:0 0 60px #10b98160} }
      `}</style>

      {/* Confetti */}
      {showConfetti && confettiItems.map(c => (
        <div key={c.id} style={{
          position:"absolute", bottom:0, left:c.left,
          width:c.size, height:c.size * 1.5,
          background:c.color, borderRadius:2,
          animation:`confetti ${2 + (c.id % 3) * 0.5}s ${c.delay} ease-in forwards`,
          pointerEvents:"none", opacity:.8,
        }}/>
      ))}

      {/* Trophy */}
      <div style={{ fontSize:72, marginBottom:16, animation:"popIn .6s cubic-bezier(.4,0,.2,1) both", filter:"drop-shadow(0 8px 24px #f59e0b60)" }}>🏆</div>

      {/* Headline */}
      <h1 style={{ fontSize:32, fontWeight:900, color:C.text, margin:"0 0 12px", letterSpacing:-1 }}>
        Parabéns, <span style={{ background:"linear-gradient(135deg,#10b981,#06b6d4)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>{nomeUsuario || "aluno"}</span>!
      </h1>
      <p style={{ fontSize:16, color:C.muted, maxWidth:480, lineHeight:1.7, margin:"0 0 6px" }}>
        Você concluiu <strong style={{ color:C.green }}>100%</strong> do treinamento oficial do C4OS.<br/>Agora você tem todo o conhecimento para usar a plataforma com excelência.
      </p>
      <p style={{ fontSize:13, color:C.slate, marginBottom:36 }}>Concluído em {dataConc}</p>

      {/* Módulos concluídos */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center", marginBottom:36, maxWidth:560 }}>
        {modules.map(m => (
          <div key={m.id} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", background:`${m.color}15`, border:`1px solid ${m.color}30`, borderRadius:20, fontSize:12, color:m.color, fontWeight:600 }}>
            <span>{m.icon}</span> {m.title}
          </div>
        ))}
      </div>

      {/* Certificate preview */}
      <div style={{ background:C.card, border:`1px solid ${C.borderLt}`, borderRadius:20, padding:"28px 32px", maxWidth:480, width:"100%", marginBottom:28, textAlign:"left", boxShadow:"0 8px 32px rgba(0,0,0,.3)", animation:"glow 3s ease-in-out infinite" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#10b981,#06b6d4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:900, color:"#fff", boxShadow:"0 4px 16px #10b98140" }}>C</div>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:1.5, textTransform:"uppercase" }}>Certificado Oficial de Conclusão</div>
            <div style={{ fontSize:15, fontWeight:800, color:C.text }}>C4OS Treinamentos</div>
          </div>
          <div style={{ marginLeft:"auto", width:36, height:36, borderRadius:"50%", background:`${C.green}22`, border:`2px solid ${C.green}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:C.green }}>✓</div>
        </div>
        <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:1.5, marginBottom:6 }}>Certificamos que</div>
        <div style={{ fontSize:26, fontWeight:900, color:C.text, borderBottom:`2px solid ${C.green}`, paddingBottom:8, marginBottom:10, letterSpacing:-0.5 }}>{nomeUsuario || "—"}</div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>da empresa <strong style={{ color:C.text }}>{nomeEmpresa || "—"}</strong> concluiu com êxito o programa de treinamento oficial da plataforma C4OS.</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 16px", marginBottom:14 }}>
          {modules.map(m => (
            <div key={m.id} style={{ fontSize:11, color:C.muted, display:"flex", alignItems:"center", gap:5 }}><span style={{ color:C.green }}>✓</span>{m.icon} {m.title}</div>
          ))}
        </div>
        <div style={{ paddingTop:12, borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:11, color:C.muted }}>Concluído em {dataConc}</div>
          <div style={{ fontSize:11, color:C.muted }}>c4os.com.br</div>
        </div>
      </div>

      {/* CTA */}
      <button onClick={emitir} disabled={emitindo}
        style={{ background:emitindo?C.card:`linear-gradient(135deg,${C.green},${C.teal})`, border:"none", borderRadius:14, padding:"16px 40px", fontSize:16, fontWeight:800, color:emitindo?C.muted:"#fff", cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"all .2s", boxShadow:emitindo?"none":`0 8px 32px ${C.green}40`, marginBottom:14, letterSpacing:-0.3 }}>
        {emitindo ? "⟳ Abrindo certificado..." : "🏅 Emitir Certificado em PDF"}
      </button>
      <p style={{ fontSize:12, color:C.muted }}>O certificado abre em uma nova aba — salve como PDF ou imprima.</p>
      {onBack && (
        <button onClick={onBack}
          style={{ marginTop:16, background:"transparent", border:`1px solid ${C.border}`, borderRadius:10, padding:"9px 20px", fontSize:12, fontWeight:600, color:C.muted, cursor:"pointer" }}>
          ← Voltar aos módulos
        </button>
      )}
    </div>
  );
}

// ─── Progress Ring SVG ────────────────────────────────────────────────────────
function ProgressRing({ pct, color, size = 56, stroke = 5 }) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${color}28`} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition:"stroke-dasharray .7s cubic-bezier(.4,0,.2,1)" }}/>
      <text x={size/2} y={size/2 + (pct===100?4:5)} textAnchor="middle"
        fontSize={pct===100?13:12} fontWeight="900"
        fill={pct===100?C.green:color}>{pct===100?"✓":`${pct}%`}</text>
    </svg>
  );
}

// ─── Module Card (home screen) ────────────────────────────────────────────────
function ModuleCard({ mod, progress, onStart }) {
  const [hover, setHover] = useState(false);
  const mp        = calcModuleProgress(mod, progress);
  const nextLesson = mod.lessons.find(l => !progress[`${mod.id}:${l.id}`]) || mod.lessons[0];
  const statusColor = mp.pct === 100 ? C.green : mp.done > 0 ? mod.color : C.slate;
  const statusLabel = mp.pct === 100 ? "✅ Concluído" : mp.done > 0 ? "▶ Em andamento" : "○ Não iniciado";
  const ctaLabel    = mp.pct === 100 ? "Revisar" : mp.done > 0 ? "Continuar" : "Começar";

  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={() => onStart(mod.id, nextLesson.id)}
      style={{
        background: hover ? C.cardHov : C.card,
        border: `1px solid ${hover ? `${mod.color}55` : C.border}`,
        borderTop: `3px solid ${mp.pct === 100 ? C.green : mp.done > 0 ? mod.color : C.borderLt}`,
        borderRadius: 16,
        padding: "22px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        transition: "all .2s cubic-bezier(.4,0,.2,1)",
        transform: hover ? "translateY(-4px)" : "none",
        boxShadow: hover ? `0 16px 40px ${mod.color}25, 0 4px 12px rgba(0,0,0,.25)` : "0 2px 8px rgba(0,0,0,.18)",
      }}>
      {/* Icon + ring */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <div style={{ width:52, height:52, borderRadius:14, background:`${mod.color}20`, border:`2px solid ${mod.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>{mod.icon}</div>
        <ProgressRing pct={mp.pct} color={mod.color} size={52} stroke={5}/>
      </div>

      {/* Title + desc */}
      <div>
        <div style={{ fontSize:15, fontWeight:800, color:C.text, marginBottom:5, letterSpacing:-.3 }}>{mod.title}</div>
        <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>{mod.desc}</div>
      </div>

      {/* Status + lesson count */}
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:11, fontWeight:700, color:statusColor }}>{statusLabel}</span>
        <span style={{ color:C.border, fontSize:12 }}>·</span>
        <span style={{ fontSize:11, color:C.muted }}>{mod.lessons.length} aulas</span>
      </div>

      {/* Progress bar */}
      <div style={{ height:4, background:C.border, borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${mp.pct}%`, background:`linear-gradient(90deg,${mod.color},${mod.color}bb)`, borderRadius:2, transition:"width .7s ease" }}/>
      </div>

      {/* CTA row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:12, color:C.muted, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", paddingRight:8 }}>
          {mp.pct === 100 ? mod.lessons[0]?.title : (nextLesson?.title || "")}
        </span>
        <div style={{ width:30, height:30, borderRadius:"50%", background:`${mod.color}20`, border:`1px solid ${mod.color}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:mod.color, flexShrink:0, transition:"transform .2s", transform: hover ? "translateX(3px)" : "none" }}>
          {mp.pct === 100 ? "↩" : "→"}
        </div>
      </div>
    </div>
  );
}

// ─── Home Dashboard ───────────────────────────────────────────────────────────
function HomeScreen({ modules, progress, nomeUsuario, overall, onStart }) {
  const allLessons = getAllLessons(modules);
  const nextUp     = allLessons.find(l => !progress[`${l.moduleId}:${l.id}`]);
  const labCount   = modules.reduce((a, m) => a + m.lessons.filter(l => l.type === "lab").length, 0);
  const firstName  = nomeUsuario ? nomeUsuario.split(" ")[0] : "";

  const greeting = overall.pct === 100
    ? `Parabéns${firstName ? `, ${firstName}` : ""}! 🏆`
    : overall.pct > 0
      ? `Bem-vindo de volta${firstName ? `, ${firstName}` : ""}! 👋`
      : `Pronto para aprender${firstName ? `, ${firstName}` : ""}? 🚀`;

  const subtitle = overall.pct === 100
    ? "Você concluiu 100% do treinamento. Emita seu certificado!"
    : overall.pct > 0
      ? `Você está a ${100 - overall.pct}% de concluir. Continue de onde parou!`
      : "Comece pelo primeiro módulo e avance no seu ritmo — cada aula leva entre 5 e 15 minutos.";

  return (
    <div style={{ height:"100%", overflowY:"auto", background:C.bg }}>
      {/* Hero section */}
      <div style={{ position:"relative", padding:"44px 52px 36px", borderBottom:`1px solid ${C.border}`, overflow:"hidden" }}>
        <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle,#10b98114 0%,transparent 65%)", top:-200, right:60, pointerEvents:"none" }}/>
        <div style={{ position:"absolute", width:350, height:350, borderRadius:"50%", background:"radial-gradient(circle,#06b6d410 0%,transparent 65%)", bottom:-150, left:300, pointerEvents:"none" }}/>

        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:32, flexWrap:"wrap" }}>
          <div style={{ flex:1, minWidth:280 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.teal, textTransform:"uppercase", letterSpacing:1.5, marginBottom:10 }}>C4OS · Portal de Treinamento</div>
            <h1 style={{ fontSize:30, fontWeight:900, color:C.text, margin:"0 0 10px", letterSpacing:-1, lineHeight:1.2 }}>{greeting}</h1>
            <p style={{ fontSize:14, color:C.muted, margin:"0 0 24px", lineHeight:1.75, maxWidth:520 }}>{subtitle}</p>

            {nextUp && overall.pct > 0 && overall.pct < 100 && (
              <button onClick={() => onStart(nextUp.moduleId, nextUp.id)}
                style={{ background:`linear-gradient(135deg,${C.green},${C.teal})`, border:"none", borderRadius:10, padding:"11px 24px", fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8, boxShadow:`0 4px 20px ${C.green}35`, transition:"all .2s" }}>
                ▶ Continuar: {nextUp.title}
              </button>
            )}
            {overall.pct === 0 && modules[0] && (
              <button onClick={() => onStart(modules[0].id, modules[0].lessons[0].id)}
                style={{ background:`linear-gradient(135deg,${C.green},${C.teal})`, border:"none", borderRadius:10, padding:"11px 24px", fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8, boxShadow:`0 4px 20px ${C.green}35` }}>
                🚀 Começar treinamento
              </button>
            )}
          </div>

          {/* Big progress ring */}
          <div style={{ textAlign:"center", flexShrink:0 }}>
            <ProgressRing pct={overall.pct} color={overall.pct === 100 ? C.green : C.teal} size={110} stroke={9}/>
            <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>{overall.done} de {overall.total} aulas</div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ padding:"18px 52px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:32, flexWrap:"wrap" }}>
        {[
          { icon:"📚", n:overall.total, label:"Total de aulas" },
          { icon:"✅", n:overall.done, label:"Concluídas" },
          { icon:"🧪", n:labCount, label:"Laboratórios" },
          { icon:"🏅", n:overall.pct === 100 ? "Sim!" : "Ao concluir", label:"Certificado" },
        ].map((s, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:C.card, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:16, fontWeight:900, color:C.text, lineHeight:1 }}>{s.n}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Module cards grid */}
      <div style={{ padding:"32px 52px 56px" }}>
        <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:1, marginBottom:20 }}>Módulos do Treinamento</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))", gap:16 }}>
          {modules.map((mod, i) => (
            <div key={mod.id} style={{ animation:`fadeSlide .4s ease ${i * 55}ms both` }}>
              <ModuleCard mod={mod} progress={progress} onStart={onStart}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Aplicativo de Treinamento ────────────────────────────────────────────────
function TrainingApp({ authUser, onLogout }) {
  const [modules,      setModules]      = useState([]);
  const [progress,     setProgress]     = useState({});
  const [activeMod,    setActiveMod]    = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [view,         setView]         = useState("home"); // "home" | "lesson"
  const [nomeUsuario,  setNomeUsuario]  = useState("");
  const [nomeEmpresa,  setNomeEmpresa]  = useState("");
  const [dataConc,     setDataConc]     = useState("");

  // Carrega empresa e monta módulos
  useEffect(() => {
    (async () => {
      let hasMulti = false;
      try {
        const { data: usuario } = await supabase
          .from("usuarios").select("nome, empresa_id, empresas(nome, multi_instancia_ativo)")
          .eq("id", authUser.id).maybeSingle();
        if (usuario) {
          setNomeUsuario(usuario.nome || authUser.email?.split("@")[0] || "");
          setNomeEmpresa(usuario.empresas?.nome || "");
          hasMulti = usuario.empresas?.multi_instancia_ativo ?? false;
        }
      } catch (_) {}

      const mods = buildModules(hasMulti);
      setModules(mods);

      // Carrega progresso e data de conclusão do localStorage
      const saved = localStorage.getItem(`c4os_treinamento_${authUser.id}`);
      const prog  = saved ? JSON.parse(saved) : {};
      setProgress(prog);
      const savedDate = localStorage.getItem(`c4os_treinamento_concluido_${authUser.id}`);
      if (savedDate) setDataConc(savedDate);

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

  const saveProgress = useCallback((newProg, mods) => {
    setProgress(newProg);
    localStorage.setItem(`c4os_treinamento_${authUser.id}`, JSON.stringify(newProg));
    // Registra data de conclusão quando atinge 100%
    const total = (mods ?? modules).reduce((a, m) => a + m.lessons.length, 0);
    const done  = Object.keys(newProg).filter(k => newProg[k]).length;
    if (done >= total && total > 0) {
      const key = `c4os_treinamento_concluido_${authUser.id}`;
      if (!localStorage.getItem(key)) {
        const d = new Date();
        const formatted = d.toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric" });
        localStorage.setItem(key, formatted);
        setDataConc(formatted);
      }
    }
  }, [authUser.id, modules]);

  const markComplete = useCallback(() => {
    const key = `${activeMod}:${activeLesson}`;
    const newProg = { ...progress, [key]: true };
    saveProgress(newProg, modules);
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

  const startLesson = useCallback((modId, lessonId) => {
    setActiveMod(modId);
    setActiveLesson(lessonId);
    setView("lesson");
  }, []);

  const goHome = useCallback(() => setView("home"), []);

  if (loading || !modules.length) {
    return (
      <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:20, height:20, borderRadius:"50%", border:`2px solid ${C.border}`, borderTopColor:C.green, animation:"spin .7s linear infinite" }}/>
      </div>
    );
  }

  const overall    = calcOverallProgress(modules, progress);
  const allLessons = getAllLessons(modules);
  const curIdx     = allLessons.findIndex(l => l.moduleId === activeMod && l.id === activeLesson);
  const curLesson  = allLessons[curIdx];
  const curMod     = modules.find(m => m.id === activeMod);
  const isCompleted = !!progress[`${activeMod}:${activeLesson}`];
  const isAllDone  = overall.pct === 100;

  const GLOBAL_STYLE = `
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeSlide{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes floatUp{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes popIn{0%{transform:scale(0) rotate(-10deg);opacity:0}60%{transform:scale(1.12) rotate(2deg)}100%{transform:scale(1) rotate(0);opacity:1}}
    @keyframes confetti{0%{transform:translateY(120vh) rotate(0deg);opacity:1}100%{transform:translateY(-10vh) rotate(720deg);opacity:0}}
    @keyframes glow{0%,100%{box-shadow:0 0 30px #10b98130}50%{box-shadow:0 0 60px #10b98155}}
    *{box-sizing:border-box}
    ::-webkit-scrollbar{width:5px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:${C.borderLt};border-radius:3px}
    ::-webkit-scrollbar-thumb:hover{background:${C.slate}}
    .lesson-content{animation:fadeSlide .35s ease}
    .home-content{animation:fadeSlide .3s ease}
  `;

  const fontFamily = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";

  // ── Completion screen (full page, no sidebar) ──
  if (isAllDone && view !== "lesson") {
    return (
      <div style={{ height:"100vh", background:C.bg, fontFamily, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <style>{GLOBAL_STYLE}</style>
        <div style={{ height:3, background:C.border, flexShrink:0 }}>
          <div style={{ height:"100%", width:"100%", background:`linear-gradient(90deg,${C.green},${C.teal})` }}/>
        </div>
        <div style={{ flex:1, overflow:"hidden" }}>
          <CompletionScreen
            nomeUsuario={nomeUsuario} nomeEmpresa={nomeEmpresa}
            dataConc={dataConc || new Date().toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric" })}
            modules={modules}
            onBack={goHome}
          />
        </div>
      </div>
    );
  }

  // ── Home view (full width dashboard) ──
  if (view === "home") {
    return (
      <div style={{ height:"100vh", background:C.bg, fontFamily, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <style>{GLOBAL_STYLE}</style>
        {/* Top bar */}
        <div style={{ height:3, background:C.border, flexShrink:0 }}>
          <div style={{ height:"100%", width:`${overall.pct}%`, background:`linear-gradient(90deg,${C.green},${C.teal})`, transition:"width .6s ease" }}/>
        </div>
        {/* Nav header */}
        <div style={{ padding:"0 52px", height:52, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, background:`${C.sidebar}cc`, backdropFilter:"blur(10px)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#10b981,#06b6d4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:900, color:"#fff" }}>C</div>
            <span style={{ fontSize:14, fontWeight:800, color:C.text }}>C4OS Treinamentos</span>
          </div>
          <button onClick={onLogout}
            style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 14px", fontSize:12, fontWeight:600, color:C.muted, cursor:"pointer" }}>
            Sair
          </button>
        </div>
        <div className="home-content" style={{ flex:1, overflow:"hidden" }}>
          <HomeScreen
            modules={modules} progress={progress}
            nomeUsuario={nomeUsuario} overall={overall}
            onStart={startLesson}
          />
        </div>
      </div>
    );
  }

  // ── Lesson view (sidebar + content) ──
  return (
    <div style={{ display:"flex", height:"100vh", background:C.bg, fontFamily, overflow:"hidden" }}>
      <style>{GLOBAL_STYLE}</style>

      <Sidebar
        modules={modules} progress={progress}
        activeMod={activeMod} activeLesson={activeLesson}
        onSelect={startLesson} overall={overall}
        user={authUser} onLogout={onLogout} onHome={goHome}
      />

      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <div style={{ height:3, background:C.border, flexShrink:0 }}>
          <div style={{ height:"100%", width:`${overall.pct}%`, background:`linear-gradient(90deg,${C.green},${C.teal})`, transition:"width .5s ease" }}/>
        </div>
        <div style={{ flex:1, overflow:"hidden" }}>
          {curLesson && curMod ? (
            <LessonView
              lesson={curLesson} mod={curMod}
              isCompleted={isCompleted}
              onComplete={markComplete}
              onPrev={() => navigate(-1)} onNext={() => navigate(1)}
              hasPrev={curIdx > 0} hasNext={curIdx < allLessons.length - 1}
              onBack={goHome}
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
