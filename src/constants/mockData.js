import { L } from "./theme";

// Contas de acesso (substituir por Supabase Auth após integração)
export const ACCOUNTS = [
  {email:"lucas.g.n.machado@gmail.com", pass:btoa("LucasGN2209!"), nome:"Lucas Machado",  cargo:"CTO",              avatar:"LM", role:"c4hub_admin", empresa:"C4HUB",         cor:L.teal},
  {email:"rafael.duarte@c4hub.com",     pass:btoa("admin123"),     nome:"Rafael Duarte",  cargo:"Admin C4HUB",      avatar:"RD", role:"c4hub_admin", empresa:"C4HUB",         cor:L.teal},
  {email:"larissa@alfacommerce.com",    pass:btoa("client123"),    nome:"Larissa Costa",  cargo:"Gestora Comercial", avatar:"LC", role:"client_admin", empresa:"Alfa Commerce", cor:L.copper},
];

export const revData = [
  {m:"Jan",r:48000,meta:45000,leads:120},
  {m:"Fev",r:52000,meta:48000,leads:145},
  {m:"Mar",r:61000,meta:55000,leads:189},
  {m:"Abr",r:58000,meta:60000,leads:167},
  {m:"Mai",r:74000,meta:65000,leads:210},
  {m:"Jun",r:89000,meta:75000,leads:256},
  {m:"Jul",r:95000,meta:80000,leads:289},
];

export const kanbanInit = [
  {id:"novo",    label:"Novos Leads", cor:L.teal,   cards:[
    {id:1,nome:"Empresa Alfa Ltda",valor:"R$ 12.000",contato:"Carlos Silva",canal:"WhatsApp",tempo:"2h",score:82},
    {id:2,nome:"TechBrasil S.A.",valor:"R$ 8.500",contato:"Ana Lima",canal:"Email",tempo:"1d",score:74},
    {id:3,nome:"Grupo X",valor:"R$ 31.000",contato:"Pedro Matos",canal:"WhatsApp",tempo:"3h",score:91},
  ]},
  {id:"qualif",  label:"Qualificação",cor:L.copper, cards:[
    {id:4,nome:"DistribNorte",valor:"R$ 17.000",contato:"Juliana K",canal:"Ligação",tempo:"2d",score:68},
    {id:5,nome:"Varejo Fast",valor:"R$ 9.200",contato:"Marcos B",canal:"WhatsApp",tempo:"5h",score:79},
  ]},
  {id:"proposta",label:"Proposta",    cor:L.yellow, cards:[
    {id:6,nome:"MegaCorp Brasil",valor:"R$ 45.000",contato:"Sandra R",canal:"Reunião",tempo:"1d",score:88},
    {id:7,nome:"Soluções Omega",valor:"R$ 22.000",contato:"Fábio T",canal:"Email",tempo:"3d",score:63},
  ]},
  {id:"negoc",   label:"Negociação",  cor:L.blue,   cards:[
    {id:8,nome:"Indústria Delta",valor:"R$ 78.000",contato:"Roberto C",canal:"Reunião",tempo:"4d",score:93},
  ]},
  {id:"fechado", label:"Fechado",     cor:L.green,  cards:[
    {id:9,nome:"Grupo Premium",valor:"R$ 36.000",contato:"Alice F",canal:"WhatsApp",tempo:"1sem",score:97},
  ]},
];

export const leadsInit = [
  {id:1,nome:"Carlos Silva",empresa:"Empresa Alfa Ltda",email:"carlos@alfa.com",whatsapp:"(11)99999-1234",status:"Quente",score:82,origem:"WhatsApp",valor:"R$12.000",ultima:"hoje"},
  {id:2,nome:"Ana Lima",empresa:"TechBrasil S.A.",email:"ana@techbr.com",whatsapp:"(21)98888-5678",status:"Morno",score:74,origem:"Site",valor:"R$8.500",ultima:"ontem"},
  {id:3,nome:"Pedro Matos",empresa:"Grupo X",email:"pedro@gcx.com",whatsapp:"(31)97777-9012",status:"Quente",score:91,origem:"WhatsApp",valor:"R$31.000",ultima:"hoje"},
  {id:4,nome:"Juliana Kramer",empresa:"DistribNorte",email:"ju@dn.com",whatsapp:"(41)96666-3456",status:"Frio",score:68,origem:"Email",valor:"R$17.000",ultima:"3d"},
  {id:5,nome:"Marcos Barbosa",empresa:"Varejo Fast",email:"marcos@vfast.com",whatsapp:"(51)95555-7890",status:"Morno",score:79,origem:"WhatsApp",valor:"R$9.200",ultima:"5h"},
  {id:6,nome:"Sandra Rocha",empresa:"MegaCorp Brasil",email:"sandra@mcb.com",whatsapp:"(11)94444-1122",status:"Quente",score:88,origem:"Indicação",valor:"R$45.000",ultima:"1d"},
];

export const convInit = [
  {id:1,nome:"Carlos Silva",emp:"Alfa Ltda",avatar:"CS",cor:L.teal,ultima:"Posso ver a proposta?",hora:"14:32",msgs:3,status:"online"},
  {id:2,nome:"Ana Lima",emp:"TechBrasil",avatar:"AL",cor:L.copper,ultima:"Obrigada pelo retorno",hora:"13:15",msgs:0,status:"away"},
  {id:3,nome:"Pedro Matos",emp:"Grupo X",avatar:"PM",cor:L.green,ultima:"Quando marcamos a reunião?",hora:"12:08",msgs:7,status:"online"},
  {id:4,nome:"Marcos Barbosa",emp:"Varejo Fast",avatar:"MB",cor:L.yellow,ultima:"Mais detalhes por favor",hora:"11:45",msgs:1,status:"offline"},
];

export const msgsInit = [
  {id:1,de:"lead",texto:"Olá! Gostaria de mais informações sobre o plano Enterprise.",hora:"14:20"},
  {id:2,de:"me",texto:"Olá Carlos! Com prazer. Qual o tamanho da sua equipe comercial?",hora:"14:22"},
  {id:3,de:"lead",texto:"Temos 15 vendedores e precisamos de automação de WhatsApp em massa.",hora:"14:25"},
  {id:4,de:"me",texto:"Perfeito! O Enterprise cobre: disparos ilimitados, CRM completo e IA embarcada.",hora:"14:28"},
  {id:5,de:"lead",texto:"Posso ver a proposta?",hora:"14:32"},
];

export const followInit = [
  {id:1,titulo:"Enviar proposta revisada",lead:"Sandra Rocha / MegaCorp",data:"Hoje 18:00",prioridade:"Alta",canal:"Email"},
  {id:2,titulo:"Ligação de acompanhamento",lead:"Roberto C / Indústria Delta",data:"Hoje 15:30",prioridade:"Alta",canal:"Ligação"},
  {id:3,titulo:"Follow-up pós reunião",lead:"Carlos Silva / Alfa Ltda",data:"Amanhã 10:00",prioridade:"Média",canal:"WhatsApp"},
  {id:4,titulo:"Reenvio de material",lead:"Juliana Kramer / DistribNorte",data:"Amanhã 14:00",prioridade:"Baixa",canal:"Email"},
  {id:5,titulo:"Demonstração do produto",lead:"Fábio T / Soluções Omega",data:"25/03 09:00",prioridade:"Alta",canal:"Reunião"},
];

export const broadcastHist = [
  {id:1,titulo:"Black Friday — Oferta Especial",enviados:1842,entregues:1791,lidos:1203,respostas:287,taxa:15.6,status:"Concluído",data:"15/11"},
  {id:2,titulo:"Lançamento Plano Growth",enviados:945,entregues:921,lidos:718,respostas:156,taxa:16.5,status:"Concluído",data:"02/12"},
  {id:3,titulo:"Campanha Início de Ano",enviados:2100,entregues:0,lidos:0,respostas:0,taxa:0,status:"Agendado",data:"28/03"},
];

export const clientesInit = [
  {id:1,empresa:"TechBrasil S.A.",plano:"Enterprise",usuarios:8,contatos:3421,status:"Ativo",mrr:"R$1.497",venc:"2024-04-15",saude:98},
  {id:2,empresa:"Alfa Commerce",plano:"Growth",usuarios:6,contatos:1832,status:"Ativo",mrr:"R$697",venc:"2024-04-22",saude:87},
  {id:3,empresa:"Varejo Express",plano:"Starter",usuarios:2,contatos:389,status:"Ativo",mrr:"R$297",venc:"2024-04-10",saude:72},
  {id:4,empresa:"Grupo Industrial",plano:"Enterprise",usuarios:23,contatos:8901,status:"Ativo",mrr:"R$1.497",venc:"2024-04-30",saude:95},
  {id:5,empresa:"StartupX",plano:"Growth",usuarios:4,contatos:921,status:"Trial",mrr:"R$0",venc:"2024-04-05",saude:61},
];

export const logsInit = [
  {id:1,tipo:"AUTH",msg:"Login realizado",user:"lucas.g.n.machado@gmail.com",empresa:"C4HUB",ip:"189.23.4.1",hora:"14:32:01",nivel:"info"},
  {id:2,tipo:"DATA",msg:"Export de leads",user:"larissa@alfacommerce.com",empresa:"Alfa Commerce",ip:"187.55.2.9",hora:"14:28:44",nivel:"warn"},
  {id:3,tipo:"BILLING",msg:"Pagamento confirmado",user:"sistema",empresa:"TechBrasil S.A.",ip:"internal",hora:"14:20:00",nivel:"info"},
  {id:4,tipo:"AUTH",msg:"Tentativa de login falhou",user:"unknown@test.com",empresa:"—",ip:"103.21.5.87",hora:"13:55:12",nivel:"error"},
  {id:5,tipo:"API",msg:"Webhook disparado",user:"sistema",empresa:"Grupo Industrial",ip:"internal",hora:"13:44:30",nivel:"info"},
  {id:6,tipo:"DATA",msg:"Lead deletado",user:"marcos@vfast.com",empresa:"Varejo Express",ip:"191.4.8.102",hora:"13:22:10",nivel:"warn"},
];

export const equipeInit = [
  {id:1,nome:"Larissa Costa",cargo:"Gestora Comercial",email:"larissa@alfa.com",whatsapp:"(11)99001-0001",role:"Admin",status:"Ativo",leads:34,fechados:8,conv:"23,5%"},
  {id:2,nome:"Bruno Lima",cargo:"SDR Sênior",email:"bruno@alfa.com",whatsapp:"(11)99001-0002",role:"Vendedor",status:"Ativo",leads:51,fechados:7,conv:"13,7%"},
  {id:3,nome:"Fernanda Cruz",cargo:"SDR Júnior",email:"fernanda@alfa.com",whatsapp:"(11)99001-0003",role:"Vendedor",status:"Ativo",leads:28,fechados:3,conv:"10,7%"},
  {id:4,nome:"Ricardo Alves",cargo:"Closer",email:"ricardo@alfa.com",whatsapp:"(11)99001-0004",role:"Vendedor",status:"Ativo",leads:19,fechados:11,conv:"57,9%"},
  {id:5,nome:"Joana Meireles",cargo:"Suporte",email:"joana@alfa.com",whatsapp:"(11)99001-0005",role:"Suporte",status:"Inativo",leads:0,fechados:0,conv:"—"},
];

export const depsInit = [
  {id:1,nome:"Comercial",cor:L.teal,bg:L.tealBg,membros:3,meta:"R$80.000",atual:"R$61.000",pct:76},
  {id:2,nome:"Pré-vendas",cor:L.copper,bg:L.copperBg,membros:2,meta:"R$20.000",atual:"R$18.400",pct:92},
  {id:3,nome:"Pós-vendas",cor:L.green,bg:L.greenBg,membros:1,meta:"NPS 75",atual:"NPS 71",pct:95},
  {id:4,nome:"Marketing",cor:L.blue,bg:L.blueBg,membros:1,meta:"200 leads",atual:"189 leads",pct:94},
];

export const aiResp = [
  "Com base nos dados do funil, **Roberto C / Indústria Delta** tem score 93 e está há 4 dias em negociação. Recomendo marcar reunião de fechamento esta semana.",
  "Análise 30 dias: taxa de conversão **18,4%**, acima da média do setor (12%). WhatsApp converte 2,3x mais que e-mail. Sugiro realocar 60% dos esforços para WhatsApp.",
  "**Resumo semanal:** 47 novos leads · R$312.000 em pipeline · 3 deals fechados = R$121.000. Ações: follow-up Carlos e Sandra hoje; proposta Omega pendente.",
  "Padrão identificado: leads por **indicação** têm ticket médio 3,4x maior. Recomendo criar programa de indicações com incentivo para clientes atuais.",
];

export const planosData = [
  {id:"starter",   nome:"Starter",     preco:"R$ 297",  periodo:"/mês", cor:L.t3,    features:["500 contatos","3 usuários","Funil básico","Relatórios simples","WhatsApp manual","Suporte por e-mail"]},
  {id:"growth",    nome:"Growth",      preco:"R$ 697",  periodo:"/mês", cor:L.copper, features:["5.000 contatos","10 usuários","Funil avançado","Disparos 2k/mês","Relatórios avançados","IA básica","Multi-agente","Suporte prioritário"]},
  {id:"enterprise",nome:"Enterprise",  preco:"R$ 1.497",periodo:"/mês", cor:L.teal,  destaque:true, features:["Contatos ilimitados","Usuários ilimitados","Funil personalizado","Disparos ilimitados","IA completa","API access","Multi-agente","Relatórios custom","Onboarding dedicado","SLA 99,9%"]},
  {id:"c4hub",     nome:"C4HUB Admin", preco:"Interno", periodo:"",     cor:L.green,  features:["Acesso total ao sistema","Gestão de clientes","Config de planos","Suporte e manutenção","Dashboard master","Logs e Auditoria","Relatórios globais","SLA por cliente"]},
];
