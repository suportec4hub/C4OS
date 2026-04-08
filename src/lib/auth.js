// Cargos que recebem acesso total
const FULL_ACCESS_CARGOS = [
  "ceo","cto","coo","cfo","cmo","cso","cpo","diretor","co-founder","founder",
  "sócio","socio","presidente","vp","t.i","ti ","tecnologia","suporte ti","it",
  "admin","administrador",
];

// Mapeamento cargo → grupo de acesso
const CARGO_GROUP_MAP = [
  { group:"full",       keywords: FULL_ACCESS_CARGOS },
  { group:"vendas",     keywords: ["vendas","sdr","bdr","closer","hunter","farmer","executivo de vendas","representante de vendas","gerente de vendas","coordenador de vendas"] },
  { group:"marketing",  keywords: ["marketing","social media","conteúdo","content","redator","copywriter","branding","comunicação"] },
  { group:"trafego",    keywords: ["tráfego","trafego","mídia paga","media paga","gestor de tráfego","analista de mídia"] },
  { group:"digital",    keywords: ["digital","desenvolvedor","designer","web","produto","ux","ui"] },
  { group:"financeiro", keywords: ["financeiro","financeiro","controladoria","contabilidade","fiscal","tesouraria"] },
  { group:"rh",         keywords: ["rh","recursos humanos","people","talent","recrutamento","dp","departamento pessoal"] },
  { group:"suporte",    keywords: ["suporte","atendimento","cs","customer success","helpdesk","sac","pos-venda","pós-venda"] },
];

// Páginas acessíveis por grupo
const PAGE_ACCESS_MAP = {
  full:       null, // null = tudo liberado
  vendas:     new Set(["dashboard","leads","pipeline","whatsapp","broadcast","followup","reports","ai","empresa"]),
  marketing:  new Set(["dashboard","leads","broadcast","followup","reports","ai","empresa"]),
  trafego:    new Set(["dashboard","leads","reports","ai"]),
  digital:    new Set(["dashboard","leads","broadcast","reports","ai","empresa"]),
  financeiro: new Set(["dashboard","reports","empresa"]),
  rh:         new Set(["dashboard","equipe","departs","empresa"]),
  suporte:    new Set(["dashboard","whatsapp","leads","followup","ai","empresa"]),
};

export function getCargoGroup(user) {
  if (!user) return "vendas";
  if (user.role === "c4hub_admin") return "full";
  const cargo = (user.cargo || "").toLowerCase();
  for (const { group, keywords } of CARGO_GROUP_MAP) {
    if (keywords.some(k => cargo.includes(k))) return group;
  }
  return "vendas"; // padrão: acesso comercial
}

export function hasPageAccess(user, pageId) {
  const group = getCargoGroup(user);
  if (group === "full") return true;
  const access = PAGE_ACCESS_MAP[group];
  if (!access) return true;
  return access.has(pageId);
}

export function hasFullAccess(user) {
  return getCargoGroup(user) === "full";
}

// Label legível do grupo
const GROUP_LABELS = {
  full: "Acesso Total", vendas: "Vendas", marketing: "Marketing",
  trafego: "Tráfego", digital: "Digital", financeiro: "Financeiro",
  rh: "RH", suporte: "Suporte",
};
export function getAccessLabel(user) {
  return GROUP_LABELS[getCargoGroup(user)] || "Vendas";
}
