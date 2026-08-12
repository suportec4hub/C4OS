// Regras de exibição de lead, em um lugar só.
//
// Existem porque a tela de Leads e a coluna do Pipeline precisam concordar
// sobre o que é "lead novo". Quando cada tela tinha a sua cópia da regra, o
// Pipeline mostrava como novo um lead que a tela de Leads já não mostrava —
// e o usuário via dois números diferentes para a mesma pergunta.

/** Janela em que um lead ainda conta como novo. */
export const HORAS_LEAD_NOVO = 24;

/**
 * Lead novo = status "novo" E chegada dentro da janela.
 *
 * Só o status não basta: um lead de dois meses que ninguém qualificou
 * continuaria "novo" para sempre, e o selo perderia o sentido de urgência.
 */
export function ehLeadNovo(lead) {
  if (!lead || lead.status !== "novo") return false;
  const ref = lead.created_at || lead.ultima_atividade;
  if (!ref) return true;
  return (Date.now() - new Date(ref).getTime()) < HORAS_LEAD_NOVO * 3600 * 1000;
}

/**
 * "agora", "há 5 min", "ontem". Saber que o lead chegou agora muda a ação;
 * uma data absoluta obriga a pessoa a fazer essa conta de cabeça.
 */
export function tempoRelativo(iso) {
  if (!iso) return null;
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1)  return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1)  return "ontem";
  if (d < 30)   return `há ${d} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

// Enquanto o WhatsApp não informa o número, o identificador interno (@lid)
// aparecia cru como nome e telefone. Não é informação para o usuário.
export const semNumero   = (v) => !v || String(v).includes("@");
export const exibirWhats = (v) => (semNumero(v) ? "aguardando número" : v);
export const exibirNome  = (l) =>
  l?.nome && !String(l.nome).includes("@") ? l.nome : "Contato sem nome";

/** Mais recente primeiro, pela atividade e depois pela criação. */
export const maisRecentePrimeiro = (a, b) =>
  new Date(b.ultima_atividade || b.created_at || 0) -
  new Date(a.ultima_atividade || a.created_at || 0);
