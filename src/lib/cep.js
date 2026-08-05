// Busca de endereço por CEP.
//
// Duas fontes: ViaCEP primeiro, BrasilAPI como reserva. Ambas são públicas e
// não pedem chave — nada aqui vai para o código do servidor nem exige secret.
// A reserva existe porque o ViaCEP sai do ar de vez em quando, e um cadastro
// travado por indisponibilidade de terceiro é pior que digitar à mão.

export const soDigitos = (v) => String(v || "").replace(/\D/g, "");

// 74460520 → 74460-520. Formata durante a digitação sem atrapalhar quem apaga.
export function formatarCEP(v) {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export const cepCompleto = (v) => soDigitos(v).length === 8;

async function viaCEP(cep, signal) {
  const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal });
  if (!r.ok) throw new Error("viacep indisponível");
  const j = await r.json();
  if (j.erro) return null;                       // CEP inexistente, não é falha
  return {
    endereco: j.logradouro || "", bairro: j.bairro || "",
    cidade: j.localidade || "", uf: j.uf || "",
  };
}

async function brasilAPI(cep, signal) {
  const r = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`, { signal });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("brasilapi indisponível");
  const j = await r.json();
  return {
    endereco: j.street || "", bairro: j.neighborhood || "",
    cidade: j.city || "", uf: j.state || "",
  };
}

/**
 * Retorna { endereco, bairro, cidade, uf } ou null se o CEP não existir.
 * Lança apenas quando as duas fontes falham — aí o cadastro segue manual.
 */
export async function buscarCEP(cepBruto, { signal } = {}) {
  const cep = soDigitos(cepBruto);
  if (cep.length !== 8) return null;

  try {
    return await viaCEP(cep, signal);
  } catch (e) {
    if (e.name === "AbortError") throw e;
    return await brasilAPI(cep, signal);
  }
}
