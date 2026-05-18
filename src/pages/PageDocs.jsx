import { useState } from "react";

const C = {
  green: "#16a34a",
  greenCta: "#22c55e",
  greenLight: "#f0fdf4",
  greenDark: "#052e16",
  body: "#374151",
  border: "#e5e7eb",
  white: "#ffffff",
};

const SECTIONS = [
  { id: "intro", label: "Introdução" },
  { id: "start", label: "Primeiros Passos" },
  { id: "whatsapp", label: "WhatsApp & Chatbot" },
  { id: "pipeline", label: "Pipeline & CRM" },
  { id: "leads", label: "Leads & Follow-up" },
  { id: "disparos", label: "Disparos & Broadcast" },
  { id: "relatorios", label: "Relatórios" },
  { id: "faq", label: "Perguntas Frequentes" },
  { id: "changelog", label: "📋 Changelog" },
];

const TipBox = ({ children }) => (
  <div style={{
    borderLeft: `4px solid ${C.green}`,
    background: C.greenLight,
    borderRadius: "0 8px 8px 0",
    padding: "14px 18px",
    margin: "20px 0",
    fontSize: 14,
    color: C.greenDark,
    lineHeight: 1.65,
  }}>
    {children}
  </div>
);

const CONTENT = {
  intro: (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: C.greenDark, marginBottom: 12, letterSpacing: "-0.5px" }}>Introdução</h2>
      <p style={{ fontSize: 16, lineHeight: 1.75, marginBottom: 16 }}>
        O <strong>C4 OS</strong> é uma plataforma all-in-one projetada para times comerciais que precisam de agilidade, organização e automação em um só lugar. Com o C4 OS, sua equipe gerencia relacionamentos com clientes, automatiza o WhatsApp e acompanha o desempenho em tempo real.
      </p>
      <p style={{ fontSize: 16, lineHeight: 1.75, marginBottom: 16 }}>
        A plataforma é indicada para times de vendas, CS (Customer Success), suporte e marketing que buscam integrar comunicação e gestão sem depender de múltiplas ferramentas.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "28px 0 10px" }}>Módulos disponíveis</h3>
      <ul style={{ paddingLeft: 20, lineHeight: 2, fontSize: 15 }}>
        <li><strong>CRM & Pipeline:</strong> gestão de deals em kanban, com etapas e valores personalizáveis.</li>
        <li><strong>Chat & WhatsApp:</strong> atendimento omnichannel com histórico unificado.</li>
        <li><strong>Chatbot Builder:</strong> criação visual de fluxos automatizados sem código.</li>
        <li><strong>Disparos & Broadcast:</strong> envio em massa com personalização por variáveis.</li>
        <li><strong>Leads & Follow-up:</strong> captura, qualificação e sequências automáticas.</li>
        <li><strong>Relatórios:</strong> dashboards com métricas de desempenho por equipe e período.</li>
      </ul>
      <TipBox>
        <strong>Dica:</strong> comece pela seção "Primeiros Passos" para criar sua conta, configurar a empresa e convidar os membros do time em menos de 10 minutos.
      </TipBox>
    </div>
  ),

  start: (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: C.greenDark, marginBottom: 12, letterSpacing: "-0.5px" }}>Primeiros Passos</h2>
      <p style={{ fontSize: 16, lineHeight: 1.75, marginBottom: 16 }}>
        Começar com o C4 OS é simples e rápido. Siga os passos abaixo para deixar sua conta pronta para o time em poucos minutos.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>1. Criar sua conta</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        Acesse a tela de login e clique em <strong>Criar conta</strong>. Preencha seu nome, e-mail corporativo e crie uma senha segura. Após o cadastro, você receberá um e-mail de confirmação.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>2. Configurar o perfil da empresa</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        No menu lateral, acesse <strong>Configurações → Empresa</strong>. Preencha o nome da empresa, segmento de atuação e dados de contato. Essas informações são usadas nos relatórios e nas mensagens automáticas.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>3. Convidar membros do time</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        Acesse <strong>Configurações → Equipe</strong> e clique em <strong>Convidar usuário</strong>. Informe o e-mail do colaborador e defina seu papel: Administrador, Vendedor ou Atendente. O convite chega por e-mail e o acesso é imediato após a confirmação.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>4. Configurar setores</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        Organize o atendimento criando setores (como "Vendas", "Suporte" e "CS"). Cada setor pode ter agentes dedicados e chatbots específicos, garantindo que os atendimentos cheguem à pessoa certa.
      </p>
      <TipBox>
        <strong>Onboarding express:</strong> o C4 OS inclui um checklist interativo de onboarding no Dashboard. Siga os itens pendentes para garantir que todas as integrações essenciais estejam ativas desde o início.
      </TipBox>
    </div>
  ),

  whatsapp: (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: C.greenDark, marginBottom: 12, letterSpacing: "-0.5px" }}>WhatsApp & Chatbot</h2>
      <p style={{ fontSize: 16, lineHeight: 1.75, marginBottom: 16 }}>
        O C4 OS se integra nativamente com o WhatsApp Business para centralizar o atendimento e automatizar interações, reduzindo o tempo de resposta e aumentando a satisfação dos clientes.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>Conectar o WhatsApp Business</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        Acesse <strong>Configurações → WhatsApp</strong> e siga o fluxo guiado para vincular seu número. A conexão é feita por QR Code para contas convencionais ou via integração oficial para contas com a API Business verificada.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>Respostas automáticas</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        Configure mensagens de boas-vindas, respostas fora do horário comercial e menus interativos diretamente em <strong>Chatbot → Configurações rápidas</strong>. Não é necessário criar um fluxo completo para começar.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>Chatbot Builder visual</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        O construtor visual permite criar fluxos de conversa completos com arrastar e soltar. Cada nó representa uma ação — enviar mensagem, fazer pergunta, transferir para agente humano ou acionar uma tag. Os fluxos são ativados por palavras-chave, horário ou etapa do pipeline.
      </p>
      <TipBox>
        <strong>Boas práticas:</strong> mantenha os fluxos de chatbot curtos e objetivos. Fluxos com mais de 8 etapas tendem a ter maior taxa de abandono. Use o nó de "Transferir para agente" sempre que a conversa exigir julgamento humano.
      </TipBox>
    </div>
  ),

  pipeline: (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: C.greenDark, marginBottom: 12, letterSpacing: "-0.5px" }}>Pipeline & CRM</h2>
      <p style={{ fontSize: 16, lineHeight: 1.75, marginBottom: 16 }}>
        O Pipeline do C4 OS usa um quadro Kanban para visualizar cada oportunidade de venda em tempo real. Cada card representa um deal e pode ser movido entre as etapas com um simples arrastar.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>Etapas personalizáveis</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        Crie e renomeie etapas de acordo com seu processo comercial. Exemplos comuns: <em>Novo Lead → Contato Feito → Proposta Enviada → Negociação → Fechado</em>. Cada etapa pode ter metas de tempo e alertas de estagnação.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>Gerenciar deals</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        Clique em qualquer card para abrir o painel lateral do deal. Ali você encontra o histórico de contatos, valor estimado, responsável, prazo e atividades agendadas. Você pode vincular o deal a um contato do CRM com um clique.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>Atribuição de responsáveis</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        Cada deal pode ter um ou mais responsáveis. Notificações são enviadas automaticamente quando um deal é atribuído, quando uma tarefa vence ou quando o cliente envia uma mensagem nova.
      </p>
      <TipBox>
        <strong>Dica de gestão:</strong> use os filtros por responsável, etapa e data para fazer a revisão semanal do pipeline em grupo. O relatório de pipeline mostra o volume total em cada etapa e a taxa de conversão histórica.
      </TipBox>
    </div>
  ),

  leads: (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: C.greenDark, marginBottom: 12, letterSpacing: "-0.5px" }}>Leads & Follow-up</h2>
      <p style={{ fontSize: 16, lineHeight: 1.75, marginBottom: 16 }}>
        Capturar e nutrir leads de forma sistemática é o que separa times de alta performance de todos os outros. O C4 OS oferece ferramentas para atrair, qualificar e acompanhar cada oportunidade.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>Captura de leads</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        Leads podem ser inseridos manualmente, importados via planilha CSV ou gerados automaticamente a partir de conversas no WhatsApp. Cada novo lead recebe uma ficha com nome, contato, origem e data de entrada.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>Sequências de follow-up</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        Configure sequências automáticas de mensagens para leads que ainda não responderam. Defina o intervalo entre cada mensagem, o canal (WhatsApp ou e-mail) e o número máximo de tentativas. A sequência para automaticamente quando o lead responde ou converte.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>Lead scoring</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        O C4 OS atribui pontos aos leads com base em comportamentos: resposta a mensagens, abertura de propostas e interações anteriores. Leads com pontuação alta são priorizados na fila e notificam o responsável automaticamente.
      </p>
      <TipBox>
        <strong>Estratégia comprovada:</strong> times que configuram pelo menos 3 tentativas de follow-up automatizado relatam aumento de 35% na taxa de resposta de leads frios. Configure a primeira mensagem para até 2 horas após o primeiro contato.
      </TipBox>
    </div>
  ),

  disparos: (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: C.greenDark, marginBottom: 12, letterSpacing: "-0.5px" }}>Disparos & Broadcast</h2>
      <p style={{ fontSize: 16, lineHeight: 1.75, marginBottom: 16 }}>
        O módulo de Disparos permite enviar mensagens personalizadas para listas de contatos, com controle total sobre horário, frequência e conteúdo.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>Criando um disparo</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        Acesse <strong>Disparos → Novo disparo</strong>. Selecione a lista de destinatários (gerada a partir de filtros de leads ou importada via CSV), escolha o template de mensagem e defina o horário de envio. O sistema respeita os limites do WhatsApp Business para evitar bloqueios.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>Personalização por variáveis</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        Use variáveis como <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, fontSize: 13 }}>{"{{nome}}"}</code>, <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, fontSize: 13 }}>{"{{empresa}}"}</code> e <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, fontSize: 13 }}>{"{{produto}}"}</code> nos templates para personalizar cada mensagem automaticamente com os dados do contato.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>Agendamento e relatório</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        Agende disparos por fuso horário para garantir que as mensagens chegam em horários comerciais. Após o envio, acompanhe o relatório de entrega em tempo real com status de enviado, entregue, lido e respondido.
      </p>
      <TipBox>
        <strong>Importante:</strong> sempre utilize o recurso de opt-out para respeitar a preferência dos contatos que não desejam receber mensagens. O C4 OS gerencia as exclusões automaticamente nas próximas campanhas.
      </TipBox>
    </div>
  ),

  relatorios: (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: C.greenDark, marginBottom: 12, letterSpacing: "-0.5px" }}>Relatórios</h2>
      <p style={{ fontSize: 16, lineHeight: 1.75, marginBottom: 16 }}>
        Os relatórios do C4 OS centralizam as métricas mais importantes do seu time comercial em dashboards visuais, atualizados em tempo real.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>Relatórios disponíveis</h3>
      <ul style={{ paddingLeft: 20, lineHeight: 2, fontSize: 15 }}>
        <li><strong>Desempenho de atendimento:</strong> volume de conversas, tempo médio de resposta e satisfação do cliente.</li>
        <li><strong>Pipeline comercial:</strong> valor total em cada etapa, taxa de conversão e tempo médio no funil.</li>
        <li><strong>Disparos:</strong> taxa de entrega, leitura e resposta por campanha.</li>
        <li><strong>Leads:</strong> origem dos leads, volume captado por período e eficácia do follow-up.</li>
        <li><strong>Metas da equipe:</strong> acompanhamento individual e por setor com indicadores de atingimento.</li>
      </ul>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.greenDark, margin: "24px 0 10px" }}>Como interpretar os dashboards</h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>
        Cada painel mostra o período atual comparado ao anterior. Indicadores em verde representam melhora; em vermelho, queda. Use os filtros de período, setor e responsável para aprofundar a análise e identificar gargalos.
      </p>
      <TipBox>
        <strong>Revisão semanal:</strong> configure alertas automáticos para receber um resumo dos principais indicadores toda segunda-feira. Acesse em <strong>Relatórios → Alertas e notificações</strong>.
      </TipBox>
    </div>
  ),

  changelog: (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: C.greenDark, marginBottom: 6, letterSpacing: "-0.5px" }}>Changelog</h2>
      <p style={{ fontSize: 15, color: "#6b7280", marginBottom: 32, lineHeight: 1.6 }}>
        Histórico de atualizações, melhorias e correções do C4 OS.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {CHANGELOG.map((release, i) => (
          <div key={release.version} style={{ display: "flex", gap: 28, paddingBottom: 36, position: "relative" }}>
            {/* Timeline line */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 16 }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: C.green, border: `3px solid ${C.greenLight}`, flexShrink: 0, marginTop: 4 }} />
              {i < CHANGELOG.length - 1 && <div style={{ width: 2, flex: 1, background: C.border, marginTop: 4 }} />}
            </div>
            {/* Content */}
            <div style={{ flex: 1, paddingBottom: i < CHANGELOG.length - 1 ? 0 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15, color: C.greenDark }}>{release.version}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: release.typeColor, background: release.typeBg, borderRadius: 6, padding: "2px 10px" }}>{release.type}</span>
                <span style={{ fontSize: 13, color: "#9ca3af" }}>{release.date}</span>
              </div>
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                {release.items.map((item, j) => (
                  <li key={j} style={{ fontSize: 14, color: C.body, lineHeight: 1.75, marginBottom: 2 }}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  ),

  faq: (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: C.greenDark, marginBottom: 12, letterSpacing: "-0.5px" }}>Perguntas Frequentes</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 8 }}>
        {[
          {
            q: "Quais são os planos disponíveis?",
            a: "O C4 OS oferece planos por número de usuários e volume de disparos. Consulte a página de Planos dentro da plataforma ou entre em contato com nosso time comercial para uma proposta personalizada.",
          },
          {
            q: "Meus dados estão seguros na plataforma?",
            a: "Sim. Todos os dados são armazenados com criptografia em repouso e em trânsito. A infraestrutura segue padrões de segurança da indústria, com backups diários e acesso controlado por autenticação de dois fatores.",
          },
          {
            q: "O C4 OS funciona com qualquer número de WhatsApp?",
            a: "O C4 OS suporta conexão via QR Code para contas convencionais do WhatsApp e integração via API oficial para contas WhatsApp Business verificadas. Para disparos em grande volume, recomendamos a API oficial.",
          },
          {
            q: "Como funciona o suporte ao cliente?",
            a: "Oferecemos suporte via chat dentro da própria plataforma, e-mail e, para planos avançados, atendimento dedicado com gerente de conta. O horário padrão de suporte é de segunda a sexta, das 8h às 18h (horário de Brasília).",
          },
          {
            q: "É possível importar minha base de leads existente?",
            a: "Sim. O C4 OS aceita importação de leads via arquivo CSV com mapeamento de colunas. O sistema valida os dados antes da importação e exibe um relatório com linhas aceitas e rejeitadas.",
          },
          {
            q: "Existe limite de usuários por conta?",
            a: "O limite de usuários depende do plano contratado. Cada plano define o número de agentes ativos simultâneos. Usuários administradores não contam no limite de agentes.",
          },
        ].map((item, i) => (
          <div key={i} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.greenDark, marginBottom: 8 }}>
              {item.q}
            </div>
            <div style={{ fontSize: 15, color: C.body, lineHeight: 1.7 }}>
              {item.a}
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
};

const CHANGELOG = [
  {
    version: "v2.4.0",
    date: "Mai 2025",
    type: "Novidade",
    typeColor: "#1d4ed8",
    typeBg: "#eff6ff",
    items: [
      "Landing Page pública com carrossel de telas do sistema",
      "Blog e Documentação acessíveis sem login",
      "Roteamento por URL: /C4OS, /C4BLOG, /C4DOCS",
      "Code splitting com React.lazy — bundle 71% menor no carregamento inicial",
    ],
  },
  {
    version: "v2.3.0",
    date: "Abr 2025",
    type: "Novidade",
    typeColor: "#1d4ed8",
    typeBg: "#eff6ff",
    items: [
      "Logs de WhatsApp e sistema na tela de Suporte (por empresa)",
      "Auditoria completa de eventos: webhook, bot, conexão e erros de API",
      "Novo helper logWA() em todos os Edge Functions",
    ],
  },
  {
    version: "v2.2.1",
    date: "Abr 2025",
    type: "Correção",
    typeColor: "#b45309",
    typeBg: "#fff7ed",
    items: [
      "Corrigido bug onde mini-card 'Últimas Atividades' ficava vazio na overview",
      "SID de sessão parou de recomputar a cada re-render",
      "Políticas RLS de INSERT com WITH CHECK adicionadas em conversas, mensagens e leads",
    ],
  },
  {
    version: "v2.2.0",
    date: "Mar 2025",
    type: "Melhoria",
    typeColor: "#15803d",
    typeBg: "#dcfce7",
    items: [
      "9 novos índices de performance no banco de dados (carregamento 40% mais rápido)",
      "Índices parciais para a fila de mensagens agendadas (WHERE status='pendente')",
      "RLS de logs_whatsapp restrito por empresa_id",
    ],
  },
  {
    version: "v2.1.0",
    date: "Fev 2025",
    type: "Novidade",
    typeColor: "#1d4ed8",
    typeBg: "#eff6ff",
    items: [
      "Módulo de Disparos em massa com personalização por variáveis",
      "Agendamento de mensagens com fuso horário configurável",
      "Relatório de entrega em tempo real (enviado / entregue / lido / respondido)",
    ],
  },
  {
    version: "v2.0.0",
    date: "Jan 2025",
    type: "Novidade",
    typeColor: "#1d4ed8",
    typeBg: "#eff6ff",
    items: [
      "Chatbot Builder visual com arrastar e soltar (fluxos ilimitados)",
      "Nós de condição, pergunta, transferência e tag",
      "Ativação de fluxos por palavra-chave ou horário",
      "Pipeline Kanban com etapas personalizáveis e valor por deal",
    ],
  },
  {
    version: "v1.5.0",
    date: "Dez 2024",
    type: "Melhoria",
    typeColor: "#15803d",
    typeBg: "#dcfce7",
    items: [
      "Follow-up automático com sequências configuráveis por canal",
      "Lead scoring baseado em comportamento de resposta",
      "Importação de leads via CSV com relatório de validação",
    ],
  },
  {
    version: "v1.0.0",
    date: "Out 2024",
    type: "Lançamento",
    typeColor: "#7e22ce",
    typeBg: "#faf5ff",
    items: [
      "Lançamento oficial do C4 OS",
      "Integração com WhatsApp Business (QR Code e API oficial)",
      "CRM básico com gestão de contatos e conversas",
      "Dashboard com métricas de atendimento em tempo real",
      "Módulo de equipe com perfis e setores",
    ],
  },
];

const SharedHeader = ({ onNavigate }) => {
  const [hovered, setHovered] = useState(null);

  return (
    <header style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      background: C.white,
      borderBottom: `1px solid ${C.border}`,
      boxShadow: "0 1px 8px rgba(0,0,0,.06)",
      height: 64,
      display: "flex",
      alignItems: "center",
      padding: "0 40px",
      justifyContent: "space-between",
    }}>
      <button
        onClick={() => onNavigate("landing")}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 10 }}
      >
        <img src="/logo.png" alt="C4 OS" width={36} height={36} style={{ objectFit: "contain", display: "block" }} />
        <div style={{ textAlign: "left", lineHeight: 1.2 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.greenDark, letterSpacing: "-0.3px" }}>C4 OS</div>
          <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 500, letterSpacing: "1px", textTransform: "uppercase" }}>by C4HUB</div>
        </div>
      </button>
      <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {[["Blog", "blog"], ["Documentação", "docs"]].map(([label, target]) => (
          <button
            key={target}
            onMouseEnter={() => setHovered(target)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onNavigate(target)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: hovered === target ? C.green : C.body,
              fontWeight: 500,
              fontSize: 15,
              padding: "6px 12px",
              borderRadius: 6,
              transition: "color .15s",
            }}
          >
            {label}
          </button>
        ))}
        <button
          onMouseEnter={() => setHovered("cta")}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onNavigate("login")}
          style={{
            marginLeft: 8,
            background: hovered === "cta" ? C.green : C.greenCta,
            color: C.white,
            border: "none",
            borderRadius: 999,
            padding: "9px 22px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            transition: "background .15s",
          }}
        >
          Acessar Plataforma →
        </button>
      </nav>
    </header>
  );
};

const PageDocs = ({ onNavigate }) => {
  const [activeSection, setActiveSection] = useState("intro");

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#f9fafb", color: C.body, minHeight: "100vh" }}>
      <SharedHeader onNavigate={onNavigate} />

      <div style={{ display: "flex", paddingTop: 64, minHeight: "calc(100vh - 64px)" }}>
        {/* Sidebar */}
        <aside style={{
          width: 240,
          flexShrink: 0,
          background: C.white,
          borderRight: `1px solid ${C.border}`,
          position: "sticky",
          top: 64,
          height: "calc(100vh - 64px)",
          overflowY: "auto",
          padding: "28px 0",
        }}>
          <div style={{ padding: "0 20px 16px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase" }}>
            Documentação
          </div>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                width: "100%",
                textAlign: "left",
                background: activeSection === s.id ? C.greenLight : "none",
                border: "none",
                borderRight: activeSection === s.id ? `3px solid ${C.green}` : "3px solid transparent",
                cursor: "pointer",
                color: activeSection === s.id ? C.green : C.body,
                fontWeight: activeSection === s.id ? 600 : 400,
                fontSize: 14,
                padding: "10px 20px",
                transition: "background .15s, color .15s",
              }}
            >
              {s.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main style={{ flex: 1, padding: "48px 64px", maxWidth: 780, minWidth: 0 }}>
          <div style={{ background: C.white, borderRadius: 14, padding: "40px 48px", border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}>
            {CONTENT[activeSection]}
          </div>

          {/* Bottom nav */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, gap: 12 }}>
            {(() => {
              const idx = SECTIONS.findIndex(s => s.id === activeSection);
              const prev = idx > 0 ? SECTIONS[idx - 1] : null;
              const next = idx < SECTIONS.length - 1 ? SECTIONS[idx + 1] : null;
              return (
                <>
                  <div>
                    {prev && (
                      <button
                        onClick={() => setActiveSection(prev.id)}
                        style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 20px", cursor: "pointer", color: C.body, fontWeight: 500, fontSize: 14 }}
                      >
                        ← {prev.label}
                      </button>
                    )}
                  </div>
                  <div>
                    {next && (
                      <button
                        onClick={() => setActiveSection(next.id)}
                        style={{ background: C.green, border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", color: C.white, fontWeight: 600, fontSize: 14 }}
                      >
                        {next.label} →
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </main>
      </div>

      <footer style={{
        background: C.white,
        borderTop: `1px solid ${C.border}`,
        padding: "28px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.greenDark }}>C4 OS by C4HUB</div>
          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>© 2025 C4HUB. Todos os direitos reservados.</div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {[["Blog", "blog"], ["Documentação", "docs"]].map(([label, target]) => (
            <button
              key={target}
              onClick={() => onNavigate(target)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: C.body,
                fontSize: 14,
                fontWeight: 500,
                padding: 0,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
};

export default PageDocs;
