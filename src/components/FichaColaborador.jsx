// Ficha do colaborador: tudo de uma pessoa em um lugar.
//
// RH trabalha por pessoa, não por assunto. Quando alguém pergunta "o ASO do
// Fulano está válido?", a resposta não pode exigir passar por cinco abas
// diferentes do sistema. Por isso documentos, saúde ocupacional, benefícios,
// treinamentos, avaliações, ocorrências e checklist vivem aqui dentro, e as
// abas de fora ficam só para o que é transversal (ponto, férias, alertas).
import { useEffect, useState } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Row, Tag, Av, IBtn, PBtn, TabPills } from "./ui";
import Modal, { Field, Input, Select, ModalFooter } from "./Modal";

const Textarea = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea
    value={value || ""} rows={rows} placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    style={{
      width: "100%", padding: "9px 11px", borderRadius: 8,
      border: `1px solid ${L.line}`, background: L.white, color: L.t1,
      fontSize: 12.5, fontFamily: "inherit", resize: "vertical", outline: "none",
    }}
  />
);

export const fmtData = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—");
export const hojeISO = () => new Date().toISOString().slice(0, 10);

export const fmtMoeda = (v) =>
  v == null || v === "" ? "—"
    : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Dias até a data. Negativo = já venceu. É o número que decide a cor do alerta.
export const diasAte = (d) => {
  if (!d) return null;
  return Math.round((new Date(d + "T12:00:00") - new Date(hojeISO() + "T12:00:00")) / 86400000);
};

export function TagValidade({ data, semData = "sem validade" }) {
  const dias = diasAte(data);
  if (dias === null) return <span style={{ fontSize: 11, color: L.t4 }}>{semData}</span>;
  const [cor, bg, txt] =
    dias < 0    ? [L.red, L.redBg, `vencido há ${Math.abs(dias)}d`]
    : dias <= 30 ? [L.yellow, L.yellowBg, `vence em ${dias}d`]
    : [L.green, L.greenBg, fmtData(data)];
  return <Tag color={cor} bg={bg}>{txt}</Tag>;
}

const TIPO_DOC = ["RG", "CPF", "CTPS", "Comprovante de residência", "Diploma",
  "Contrato de trabalho", "Carteira de vacinação", "Foto 3x4", "Outro"];
const TIPO_EXAME = { admissional:"Admissional", periodico:"Periódico", retorno:"Retorno ao trabalho",
  mudanca_funcao:"Mudança de função", demissional:"Demissional" };
const RESULTADO = { apto:"Apto", apto_restricoes:"Apto com restrições", inapto:"Inapto" };
const TIPO_BENEF = ["Vale-transporte", "Vale-refeição", "Vale-alimentação", "Plano de saúde",
  "Plano odontológico", "Seguro de vida", "Auxílio-creche", "Gympass", "Outro"];
const TIPO_OCOR = { advertencia:"Advertência", suspensao:"Suspensão", elogio:"Elogio", observacao:"Observação" };
const COR_OCOR  = { advertencia:L.yellow, suspensao:L.red, elogio:L.green, observacao:L.t3 };

// Itens sugeridos ao abrir um checklist. São o roteiro que o DP repete a cada
// entrada e a cada saída — deixá-los prontos evita que alguém esqueça o exame
// demissional, que é justamente o que gera passivo.
const ITENS_ADMISSAO = [
  "Exame admissional (ASO)", "Assinatura do contrato de trabalho", "Registro em carteira / eSocial",
  "Documentos pessoais recebidos", "Dados bancários cadastrados", "Vale-transporte definido",
  "Entrega de uniforme / EPI", "Criação de e-mail e acessos", "Apresentação à equipe",
  "Treinamento inicial",
];
const ITENS_DESLIGAMENTO = [
  "Comunicação do desligamento", "Exame demissional (ASO)", "Cálculo da rescisão",
  "Devolução de uniforme / EPI", "Devolução de equipamentos", "Revogação de acessos",
  "Baixa na carteira / eSocial", "Entrega das guias", "Homologação", "Entrevista de desligamento",
];

const ABAS = ["Dados", "Documentos", "Saúde ocupacional", "Benefícios",
  "Treinamentos", "Avaliações", "Ocorrências", "Admissão / Desligamento"];

export default function FichaColaborador({ user, colaborador, onClose, onSalvou }) {
  const [aba, setAba]   = useState("Dados");
  const [ficha, setFicha]   = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const empresaId = user?.empresa_id;
  const uid = colaborador?.id;

  const [docs, setDocs]       = useState([]);
  const [saude, setSaude]     = useState([]);
  const [benef, setBenef]     = useState([]);
  const [treins, setTreins]   = useState([]);
  const [avals, setAvals]     = useState([]);
  const [ocors, setOcors]     = useState([]);
  const [checks, setChecks]   = useState([]);

  const recarregar = async () => {
    const t = (tabela, setter, ordem = "created_at") =>
      supabase.from(tabela).select("*").eq("empresa_id", empresaId).eq("usuario_id", uid)
        .order(ordem, { ascending: false })
        .then(({ data }) => setter(data || []));
    await Promise.all([
      t("rh_documentos", setDocs), t("rh_saude", setSaude), t("rh_beneficios", setBenef),
      t("rh_treinamentos", setTreins), t("rh_avaliacoes", setAvals),
      t("rh_ocorrencias", setOcors),
      supabase.from("rh_checklist").select("*").eq("empresa_id", empresaId).eq("usuario_id", uid)
        .order("ordem").then(({ data }) => setChecks(data || [])),
    ]);
  };

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true);
      const { data } = await supabase.from("rh_colaboradores")
        .select("*").eq("usuario_id", uid).maybeSingle();
      if (!vivo) return;
      setFicha(data || { usuario_id: uid, empresa_id: empresaId, tipo_contrato: "clt", jornada_semanal: 44 });
      await recarregar();
      if (vivo) setCarregando(false);
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const D = (k) => (v) => setFicha((p) => ({ ...p, [k]: v }));

  const salvarFicha = async () => {
    setErro("");
    const payload = { ...ficha, empresa_id: empresaId, usuario_id: uid, updated_at: new Date().toISOString() };
    delete payload.id;
    const { error } = ficha?.id
      ? await supabase.from("rh_colaboradores").update(payload).eq("id", ficha.id)
      : await supabase.from("rh_colaboradores").upsert(payload, { onConflict: "usuario_id" });
    if (error) { setErro(error.message); return; }
    const { data } = await supabase.from("rh_colaboradores").select("*").eq("usuario_id", uid).maybeSingle();
    setFicha(data);
    onSalvou?.();
  };

  // Upload sempre na pasta da empresa: é o que a policy do bucket exige.
  const enviarArquivo = async (file) => {
    const caminho = `${empresaId}/${uid}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage.from("rh").upload(caminho, file);
    if (error) throw new Error(error.message);
    return { url: caminho, nome: file.name };
  };

  const abrirArquivo = async (caminho) => {
    if (!caminho) return;
    const { data, error } = await supabase.storage.from("rh").createSignedUrl(caminho, 300);
    if (error) { alert("Não foi possível abrir o arquivo."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  if (carregando) {
    return (
      <Modal title="Ficha do colaborador" onClose={onClose} width={900}>
        <div style={{ padding: 60, textAlign: "center", color: L.t4 }}>Carregando ficha...</div>
      </Modal>
    );
  }

  return (
    <Modal title={`Ficha — ${colaborador?.nome || ""}`} onClose={onClose} width={900}>
      <Row gap={10} mb={12}>
        <Av name={colaborador?.nome} size={40} color={colaborador?.ativo ? L.teal : L.t4} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: L.t1 }}>{colaborador?.nome}</div>
          <div style={{ fontSize: 11, color: L.t4 }}>
            {colaborador?.cargo || "Sem cargo"} · admitido em {fmtData(ficha?.data_admissao)}
          </div>
        </div>
      </Row>

      <div style={{ marginBottom: 12, overflowX: "auto" }}>
        <TabPills tabs={ABAS} active={aba} onChange={setAba} />
      </div>

      <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: 4 }}>
        {aba === "Dados" && (
          <AbaDados ficha={ficha} D={D} erro={erro} onSalvar={salvarFicha} />
        )}
        {aba === "Documentos" && (
          <AbaDocumentos itens={docs} empresaId={empresaId} uid={uid}
            enviarArquivo={enviarArquivo} abrirArquivo={abrirArquivo} recarregar={recarregar} />
        )}
        {aba === "Saúde ocupacional" && (
          <AbaSaude itens={saude} empresaId={empresaId} uid={uid}
            enviarArquivo={enviarArquivo} abrirArquivo={abrirArquivo} recarregar={recarregar} />
        )}
        {aba === "Benefícios" && (
          <AbaBeneficios itens={benef} empresaId={empresaId} uid={uid} recarregar={recarregar} />
        )}
        {aba === "Treinamentos" && (
          <AbaTreinamentos itens={treins} empresaId={empresaId} uid={uid}
            enviarArquivo={enviarArquivo} abrirArquivo={abrirArquivo} recarregar={recarregar} />
        )}
        {aba === "Avaliações" && (
          <AbaAvaliacoes itens={avals} empresaId={empresaId} uid={uid}
            avaliadorId={user?.id} recarregar={recarregar} />
        )}
        {aba === "Ocorrências" && (
          <AbaOcorrencias itens={ocors} empresaId={empresaId} uid={uid} registradoPor={user?.id}
            enviarArquivo={enviarArquivo} abrirArquivo={abrirArquivo} recarregar={recarregar} />
        )}
        {aba === "Admissão / Desligamento" && (
          <AbaChecklist itens={checks} empresaId={empresaId} uid={uid} recarregar={recarregar} />
        )}
      </div>
    </Modal>
  );
}

/* ─────────────────────────── Dados cadastrais ─────────────────────────── */

function AbaDados({ ficha, D, erro, onSalvar }) {
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => { setSalvando(true); await onSalvar(); setSalvando(false); };

  const G = ({ children, cols = 3 }) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: "0 14px" }}>{children}</div>
  );
  const Titulo = ({ children }) => (
    <div style={{ fontSize: 10, letterSpacing: "1.2px", textTransform: "uppercase",
      color: L.t4, fontWeight: 600, margin: "14px 0 8px" }}>{children}</div>
  );

  return (
    <>
      <Titulo>Dados pessoais</Titulo>
      <G>
        <Field label="CPF"><Input value={ficha.cpf} onChange={D("cpf")} placeholder="000.000.000-00" /></Field>
        <Field label="RG"><Input value={ficha.rg} onChange={D("rg")} /></Field>
        <Field label="Nascimento"><Input type="date" value={ficha.data_nascimento || ""} onChange={D("data_nascimento")} /></Field>
        <Field label="Estado civil">
          <Select value={ficha.estado_civil || ""} onChange={D("estado_civil")}>
            <option value="">—</option>
            {["Solteiro(a)","Casado(a)","União estável","Divorciado(a)","Viúvo(a)"].map(o=><option key={o}>{o}</option>)}
          </Select>
        </Field>
        <Field label="Escolaridade">
          <Select value={ficha.escolaridade || ""} onChange={D("escolaridade")}>
            <option value="">—</option>
            {["Fundamental","Médio","Técnico","Superior incompleto","Superior","Pós-graduação"].map(o=><option key={o}>{o}</option>)}
          </Select>
        </Field>
        <Field label="Gênero"><Input value={ficha.genero} onChange={D("genero")} /></Field>
      </G>

      <Titulo>Contrato</Titulo>
      <G>
        <Field label="Admissão"><Input type="date" value={ficha.data_admissao || ""} onChange={D("data_admissao")} /></Field>
        <Field label="Tipo de contrato">
          <Select value={ficha.tipo_contrato || "clt"} onChange={D("tipo_contrato")}>
            {[["clt","CLT"],["pj","PJ"],["estagio","Estágio"],["temporario","Temporário"],
              ["aprendiz","Jovem aprendiz"],["socio","Sócio"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Jornada semanal (h)"><Input type="number" value={ficha.jornada_semanal ?? 44} onChange={D("jornada_semanal")} /></Field>
        <Field label="Salário (R$)"><Input type="number" step="0.01" value={ficha.salario ?? ""} onChange={D("salario")} /></Field>
        <Field label="PIS"><Input value={ficha.pis} onChange={D("pis")} /></Field>
        <Field label="CTPS"><Input value={ficha.ctps} onChange={D("ctps")} /></Field>
      </G>

      <Titulo>Endereço</Titulo>
      <G>
        <Field label="CEP"><Input value={ficha.cep} onChange={D("cep")} /></Field>
        <Field label="Cidade"><Input value={ficha.cidade} onChange={D("cidade")} /></Field>
        <Field label="UF"><Input value={ficha.uf} onChange={D("uf")} /></Field>
        <Field label="Endereço"><Input value={ficha.endereco} onChange={D("endereco")} /></Field>
        <Field label="Número"><Input value={ficha.numero} onChange={D("numero")} /></Field>
        <Field label="Bairro"><Input value={ficha.bairro} onChange={D("bairro")} /></Field>
      </G>

      <Titulo>Contato de emergência e pagamento</Titulo>
      <G>
        <Field label="Contato de emergência"><Input value={ficha.contato_emergencia_nome} onChange={D("contato_emergencia_nome")} /></Field>
        <Field label="Telefone"><Input value={ficha.contato_emergencia_fone} onChange={D("contato_emergencia_fone")} /></Field>
        <Field label="Chave PIX"><Input value={ficha.pix} onChange={D("pix")} /></Field>
        <Field label="Banco"><Input value={ficha.banco} onChange={D("banco")} /></Field>
        <Field label="Agência"><Input value={ficha.agencia} onChange={D("agencia")} /></Field>
        <Field label="Conta"><Input value={ficha.conta} onChange={D("conta")} /></Field>
      </G>

      <Titulo>Desligamento</Titulo>
      <G cols={2}>
        <Field label="Data de desligamento"><Input type="date" value={ficha.data_desligamento || ""} onChange={D("data_desligamento")} /></Field>
        <Field label="Motivo"><Input value={ficha.motivo_desligamento} onChange={D("motivo_desligamento")} placeholder="Pedido de demissão, sem justa causa..." /></Field>
      </G>

      <Field label="Observações"><Textarea value={ficha.observacoes} onChange={D("observacoes")} /></Field>

      {erro && <div style={{ padding: "8px 12px", background: L.redBg, borderRadius: 8, fontSize: 12, color: L.red }}>{erro}</div>}
      <Row justify="flex-end" mt={12}><PBtn onClick={salvar}>{salvando ? "Salvando..." : "Salvar ficha"}</PBtn></Row>
    </>
  );
}

/* ───────────────────────── Lista genérica reutilizável ───────────────────────── */

function Vazio({ children }) {
  return <div style={{ textAlign: "center", padding: 30, color: L.t4, fontSize: 12 }}>{children}</div>;
}

function Linha({ children, acoes }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 10, padding: "10px 12px", borderBottom: `1px solid ${L.lineSoft}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <Row gap={4}>{acoes}</Row>
    </div>
  );
}

function BarraNovo({ children, onNovo, rotulo = "+ Adicionar" }) {
  return (
    <Row between mb={10}>
      <div style={{ fontSize: 11, color: L.t4 }}>{children}</div>
      <PBtn onClick={onNovo}>{rotulo}</PBtn>
    </Row>
  );
}

// Formulário em modal, compartilhado por todas as sub-abas: elas só diferem
// nos campos. Sem isso seriam sete modais quase idênticos.
function ModalItem({ titulo, campos, valor, setValor, onSalvar, onFechar, arquivo, setArquivo }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const V = (k) => (v) => setValor((p) => ({ ...p, [k]: v }));

  const salvar = async () => {
    setSalvando(true); setErro("");
    try { await onSalvar(); onFechar(); }
    catch (e) { setErro(e.message || "Erro ao salvar."); }
    setSalvando(false);
  };

  return (
    <Modal title={titulo} onClose={onFechar} width={520}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        {/* O Field compartilhado não repassa style, então a largura total vem
            deste wrapper — mexer no componente mudaria 26 telas de uma vez. */}
        {campos.map((c) => (
          <div key={c.k} style={{ gridColumn: c.full ? "1/-1" : "auto" }}>
          <Field label={c.label}>
            {c.tipo === "select" ? (
              <Select value={valor[c.k] ?? ""} onChange={V(c.k)}>
                {c.vazio !== false && <option value="">—</option>}
                {c.opcoes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            ) : c.tipo === "textarea" ? (
              <Textarea value={valor[c.k]} onChange={V(c.k)} placeholder={c.placeholder} />
            ) : (
              <Input type={c.tipo || "text"} step={c.step} value={valor[c.k] ?? ""}
                onChange={V(c.k)} placeholder={c.placeholder} />
            )}
          </Field>
          </div>
        ))}
        {setArquivo && (
          <div style={{ gridColumn: "1/-1" }}>
            <Field label="Anexo">
              <input type="file" onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                style={{ fontSize: 12, color: L.t3 }} />
              {arquivo && <div style={{ fontSize: 11, color: L.teal, marginTop: 4 }}>{arquivo.name}</div>}
            </Field>
          </div>
        )}
      </div>
      {erro && <div style={{ padding: "8px 12px", background: L.redBg, borderRadius: 8, fontSize: 12, color: L.red, marginTop: 6 }}>{erro}</div>}
      <ModalFooter onClose={onFechar} onSave={salvar} loading={salvando} />
    </Modal>
  );
}

function useCrud(tabela, empresaId, uid, recarregar) {
  const [modal, setModal] = useState(false);
  const [valor, setValor] = useState({});
  const [arquivo, setArquivo] = useState(null);
  const [editando, setEditando] = useState(null);

  const abrir = (item = {}) => { setValor({ ...item }); setEditando(item.id || null); setArquivo(null); setModal(true); };
  const fechar = () => setModal(false);

  const salvar = async (extra = {}) => {
    const payload = { ...valor, ...extra, empresa_id: empresaId, usuario_id: uid };
    delete payload.id; delete payload.created_at;
    // O <select> devolve string; coluna boolean recusa "true". Campo vazio vira
    // null para não gravar "" onde a coluna espera data ou número.
    Object.keys(payload).forEach((k) => {
      if (payload[k] === "") payload[k] = null;
      else if (payload[k] === "true")  payload[k] = true;
      else if (payload[k] === "false") payload[k] = false;
    });
    const { error } = editando
      ? await supabase.from(tabela).update(payload).eq("id", editando)
      : await supabase.from(tabela).insert(payload);
    if (error) throw new Error(error.message);
    await recarregar();
  };

  const excluir = async (item, arquivoUrl) => {
    if (!confirm("Excluir este registro?")) return;
    if (arquivoUrl) await supabase.storage.from("rh").remove([arquivoUrl]);
    await supabase.from(tabela).delete().eq("id", item.id);
    await recarregar();
  };

  return { modal, valor, setValor, arquivo, setArquivo, editando, abrir, fechar, salvar, excluir };
}

/* ───────────────────────────── Documentos ───────────────────────────── */

function AbaDocumentos({ itens, empresaId, uid, enviarArquivo, abrirArquivo, recarregar }) {
  const c = useCrud("rh_documentos", empresaId, uid, recarregar);
  const salvar = async () => {
    let extra = {};
    if (c.arquivo) { const a = await enviarArquivo(c.arquivo); extra = { arquivo_url: a.url, arquivo_nome: a.nome }; }
    await c.salvar(extra);
  };
  return (
    <>
      <BarraNovo onNovo={() => c.abrir({ tipo: "RG" })}>
        Documento com validade entra nos alertas da Visão geral.
      </BarraNovo>
      {itens.length === 0 && <Vazio>Nenhum documento anexado.</Vazio>}
      {itens.map((d) => (
        <Linha key={d.id} acoes={<>
          {d.arquivo_url && <IBtn c={L.teal} onClick={() => abrirArquivo(d.arquivo_url)}>↗</IBtn>}
          <IBtn c={L.teal} onClick={() => c.abrir(d)}>✎</IBtn>
          <IBtn c={L.red} onClick={() => c.excluir(d, d.arquivo_url)}>⊗</IBtn>
        </>}>
          <div style={{ fontSize: 12.5, color: L.t1, fontWeight: 500 }}>{d.tipo} {d.nome ? `— ${d.nome}` : ""}</div>
          <Row gap={8} mt={3}>
            <span style={{ fontSize: 11, color: L.t4 }}>emissão {fmtData(d.data_emissao)}</span>
            <TagValidade data={d.data_validade} />
            {d.arquivo_nome && <span style={{ fontSize: 10.5, color: L.t4 }}>{d.arquivo_nome}</span>}
          </Row>
        </Linha>
      ))}
      {c.modal && (
        <ModalItem titulo={c.editando ? "Editar documento" : "Novo documento"}
          valor={c.valor} setValor={c.setValor} onSalvar={salvar} onFechar={c.fechar}
          arquivo={c.arquivo} setArquivo={c.setArquivo}
          campos={[
            { k: "tipo", label: "Tipo *", tipo: "select", vazio: false, opcoes: TIPO_DOC.map((t) => [t, t]) },
            { k: "nome", label: "Descrição" },
            { k: "data_emissao", label: "Emissão", tipo: "date" },
            { k: "data_validade", label: "Validade", tipo: "date" },
            { k: "observacao", label: "Observação", tipo: "textarea", full: true },
          ]} />
      )}
    </>
  );
}

/* ─────────────────────── Saúde ocupacional (ASO) ─────────────────────── */

function AbaSaude({ itens, empresaId, uid, enviarArquivo, abrirArquivo, recarregar }) {
  const c = useCrud("rh_saude", empresaId, uid, recarregar);
  const salvar = async () => {
    let extra = {};
    if (c.arquivo) { const a = await enviarArquivo(c.arquivo); extra = { arquivo_url: a.url, arquivo_nome: a.nome }; }
    await c.salvar(extra);
  };
  return (
    <>
      <BarraNovo onNovo={() => c.abrir({ tipo: "periodico", resultado: "apto", data_exame: hojeISO() })}>
        O ASO precisa ser arquivado e mantido válido — exame vencido é o que gera autuação.
      </BarraNovo>
      {itens.length === 0 && <Vazio>Nenhum exame registrado.</Vazio>}
      {itens.map((s) => (
        <Linha key={s.id} acoes={<>
          {s.arquivo_url && <IBtn c={L.teal} onClick={() => abrirArquivo(s.arquivo_url)}>↗</IBtn>}
          <IBtn c={L.teal} onClick={() => c.abrir(s)}>✎</IBtn>
          <IBtn c={L.red} onClick={() => c.excluir(s, s.arquivo_url)}>⊗</IBtn>
        </>}>
          <Row gap={8}>
            <span style={{ fontSize: 12.5, color: L.t1, fontWeight: 500 }}>{TIPO_EXAME[s.tipo] || s.tipo}</span>
            <Tag color={s.resultado === "inapto" ? L.red : s.resultado === "apto_restricoes" ? L.yellow : L.green}
              bg={s.resultado === "inapto" ? L.redBg : s.resultado === "apto_restricoes" ? L.yellowBg : L.greenBg}>
              {RESULTADO[s.resultado] || s.resultado}
            </Tag>
          </Row>
          <Row gap={8} mt={3}>
            <span style={{ fontSize: 11, color: L.t4 }}>exame {fmtData(s.data_exame)}</span>
            <TagValidade data={s.data_validade} />
            {s.medico && <span style={{ fontSize: 10.5, color: L.t4 }}>{s.medico}</span>}
          </Row>
        </Linha>
      ))}
      {c.modal && (
        <ModalItem titulo={c.editando ? "Editar exame" : "Novo exame ocupacional"}
          valor={c.valor} setValor={c.setValor} onSalvar={salvar} onFechar={c.fechar}
          arquivo={c.arquivo} setArquivo={c.setArquivo}
          campos={[
            { k: "tipo", label: "Tipo *", tipo: "select", vazio: false, opcoes: Object.entries(TIPO_EXAME) },
            { k: "resultado", label: "Resultado", tipo: "select", vazio: false, opcoes: Object.entries(RESULTADO) },
            { k: "data_exame", label: "Data do exame", tipo: "date" },
            { k: "data_validade", label: "Válido até", tipo: "date" },
            { k: "medico", label: "Médico" },
            { k: "clinica", label: "Clínica" },
            { k: "observacao", label: "Restrições / observações", tipo: "textarea", full: true },
          ]} />
      )}
    </>
  );
}

/* ───────────────────────────── Benefícios ───────────────────────────── */

function AbaBeneficios({ itens, empresaId, uid, recarregar }) {
  const c = useCrud("rh_beneficios", empresaId, uid, recarregar);
  const total = itens.filter((b) => b.ativo).reduce((s, b) => s + Number(b.valor || 0), 0);
  const totalDesc = itens.filter((b) => b.ativo).reduce((s, b) => s + Number(b.desconto || 0), 0);
  return (
    <>
      <BarraNovo onNovo={() => c.abrir({ ativo: true, data_inicio: hojeISO() })}>
        Custo mensal ativo: {fmtMoeda(total)} · desconto em folha: {fmtMoeda(totalDesc)}
      </BarraNovo>
      {itens.length === 0 && <Vazio>Nenhum benefício cadastrado.</Vazio>}
      {itens.map((b) => (
        <Linha key={b.id} acoes={<>
          <IBtn c={L.teal} onClick={() => c.abrir(b)}>✎</IBtn>
          <IBtn c={L.red} onClick={() => c.excluir(b)}>⊗</IBtn>
        </>}>
          <Row gap={8}>
            <span style={{ fontSize: 12.5, color: L.t1, fontWeight: 500 }}>{b.tipo}</span>
            <Tag color={b.ativo ? L.green : L.t4} bg={b.ativo ? L.greenBg : L.surface}>{b.ativo ? "ativo" : "encerrado"}</Tag>
          </Row>
          <div style={{ fontSize: 11, color: L.t4, marginTop: 3 }}>
            empresa {fmtMoeda(b.valor)} · desconto {fmtMoeda(b.desconto)} · desde {fmtData(b.data_inicio)}
          </div>
        </Linha>
      ))}
      {c.modal && (
        <ModalItem titulo={c.editando ? "Editar benefício" : "Novo benefício"}
          valor={c.valor} setValor={c.setValor} onSalvar={() => c.salvar()} onFechar={c.fechar}
          campos={[
            { k: "tipo", label: "Tipo *", tipo: "select", vazio: false, opcoes: TIPO_BENEF.map((t) => [t, t]) },
            { k: "ativo", label: "Situação", tipo: "select", vazio: false, opcoes: [["true", "Ativo"], ["false", "Encerrado"]] },
            { k: "valor", label: "Custo da empresa (R$)", tipo: "number", step: "0.01" },
            { k: "desconto", label: "Desconto do colaborador (R$)", tipo: "number", step: "0.01" },
            { k: "data_inicio", label: "Início", tipo: "date" },
            { k: "data_fim", label: "Fim", tipo: "date" },
            { k: "descricao", label: "Observação", tipo: "textarea", full: true },
          ]} />
      )}
    </>
  );
}

/* ──────────────────────────── Treinamentos ──────────────────────────── */

function AbaTreinamentos({ itens, empresaId, uid, enviarArquivo, abrirArquivo, recarregar }) {
  const c = useCrud("rh_treinamentos", empresaId, uid, recarregar);
  const salvar = async () => {
    let extra = {};
    if (c.arquivo) { const a = await enviarArquivo(c.arquivo); extra = { certificado_url: a.url, certificado_nome: a.nome }; }
    await c.salvar(extra);
  };
  const horas = itens.filter((t) => t.status === "concluido").reduce((s, t) => s + Number(t.carga_horaria || 0), 0);
  return (
    <>
      <BarraNovo onNovo={() => c.abrir({ status: "planejado", obrigatorio: false })}>
        {horas}h concluídas no total.
      </BarraNovo>
      {itens.length === 0 && <Vazio>Nenhum treinamento registrado.</Vazio>}
      {itens.map((t) => (
        <Linha key={t.id} acoes={<>
          {t.certificado_url && <IBtn c={L.teal} onClick={() => abrirArquivo(t.certificado_url)}>↗</IBtn>}
          <IBtn c={L.teal} onClick={() => c.abrir(t)}>✎</IBtn>
          <IBtn c={L.red} onClick={() => c.excluir(t, t.certificado_url)}>⊗</IBtn>
        </>}>
          <Row gap={8}>
            <span style={{ fontSize: 12.5, color: L.t1, fontWeight: 500 }}>{t.titulo}</span>
            {t.obrigatorio && <Tag color={L.copper} bg={L.copperBg}>obrigatório</Tag>}
            <Tag color={t.status === "concluido" ? L.green : t.status === "em_andamento" ? L.teal : L.t4}
              bg={t.status === "concluido" ? L.greenBg : t.status === "em_andamento" ? L.tealBg : L.surface}>
              {String(t.status || "").replace("_", " ")}
            </Tag>
          </Row>
          <Row gap={8} mt={3}>
            <span style={{ fontSize: 11, color: L.t4 }}>{t.carga_horaria ? `${t.carga_horaria}h` : "—"} · {t.instituicao || "interno"}</span>
            {t.data_validade && <TagValidade data={t.data_validade} />}
          </Row>
        </Linha>
      ))}
      {c.modal && (
        <ModalItem titulo={c.editando ? "Editar treinamento" : "Novo treinamento"}
          valor={c.valor} setValor={c.setValor} onSalvar={salvar} onFechar={c.fechar}
          arquivo={c.arquivo} setArquivo={c.setArquivo}
          campos={[
            { k: "titulo", label: "Título *", full: true },
            { k: "instituicao", label: "Instituição" },
            { k: "carga_horaria", label: "Carga horária (h)", tipo: "number", step: "0.5" },
            { k: "status", label: "Status", tipo: "select", vazio: false,
              opcoes: [["planejado", "Planejado"], ["em_andamento", "Em andamento"], ["concluido", "Concluído"], ["cancelado", "Cancelado"]] },
            { k: "obrigatorio", label: "Obrigatório", tipo: "select", vazio: false, opcoes: [["false", "Não"], ["true", "Sim"]] },
            { k: "data_inicio", label: "Início", tipo: "date" },
            { k: "data_conclusao", label: "Conclusão", tipo: "date" },
            { k: "data_validade", label: "Validade do certificado", tipo: "date" },
            { k: "descricao", label: "Descrição", tipo: "textarea", full: true },
          ]} />
      )}
    </>
  );
}

/* ───────────────────────────── Avaliações ───────────────────────────── */

const COMPETENCIAS = ["Entrega e produtividade", "Qualidade do trabalho", "Trabalho em equipe",
  "Comunicação", "Iniciativa", "Comprometimento"];

function AbaAvaliacoes({ itens, empresaId, uid, avaliadorId, recarregar }) {
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const abrir = (a = null) => {
    setEditando(a?.id || null);
    setForm(a ? { ...a, competencias: a.competencias?.length ? a.competencias : COMPETENCIAS.map((c) => ({ nome: c, nota: 3 })) }
              : { periodo: `${new Date().getFullYear()}`, data_avaliacao: hojeISO(), status: "rascunho",
                  competencias: COMPETENCIAS.map((c) => ({ nome: c, nota: 3 })) });
    setModal(true);
  };

  const media = (comps) => comps?.length
    ? (comps.reduce((s, c) => s + Number(c.nota || 0), 0) / comps.length).toFixed(2) : null;

  const salvar = async () => {
    setSalvando(true);
    const payload = { ...form, empresa_id: empresaId, usuario_id: uid,
      avaliador_id: avaliadorId, nota_final: media(form.competencias) };
    delete payload.id; delete payload.created_at;
    const { error } = editando
      ? await supabase.from("rh_avaliacoes").update(payload).eq("id", editando)
      : await supabase.from("rh_avaliacoes").insert(payload);
    setSalvando(false);
    if (error) { alert(error.message); return; }
    setModal(false); await recarregar();
  };

  const excluir = async (a) => {
    if (!confirm("Excluir avaliação?")) return;
    await supabase.from("rh_avaliacoes").delete().eq("id", a.id);
    await recarregar();
  };

  return (
    <>
      <BarraNovo onNovo={() => abrir()} rotulo="+ Nova avaliação">
        Notas de 1 a 5 por competência; a nota final é a média.
      </BarraNovo>
      {itens.length === 0 && <Vazio>Nenhuma avaliação registrada.</Vazio>}
      {itens.map((a) => (
        <Linha key={a.id} acoes={<>
          <IBtn c={L.teal} onClick={() => abrir(a)}>✎</IBtn>
          <IBtn c={L.red} onClick={() => excluir(a)}>⊗</IBtn>
        </>}>
          <Row gap={8}>
            <span style={{ fontSize: 12.5, color: L.t1, fontWeight: 500 }}>Período {a.periodo}</span>
            <Tag color={Number(a.nota_final) >= 4 ? L.green : Number(a.nota_final) >= 3 ? L.teal : L.yellow}
              bg={Number(a.nota_final) >= 4 ? L.greenBg : Number(a.nota_final) >= 3 ? L.tealBg : L.yellowBg}>
              nota {a.nota_final ?? "—"}
            </Tag>
            <Tag color={a.status === "finalizada" ? L.green : L.t4} bg={a.status === "finalizada" ? L.greenBg : L.surface}>{a.status}</Tag>
          </Row>
          <div style={{ fontSize: 11, color: L.t4, marginTop: 3 }}>avaliado em {fmtData(a.data_avaliacao)}</div>
        </Linha>
      ))}

      {modal && form && (
        <Modal title={editando ? "Editar avaliação" : "Nova avaliação de desempenho"} onClose={() => setModal(false)} width={560}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            <Field label="Período"><Input value={form.periodo || ""} onChange={(v) => setForm((p) => ({ ...p, periodo: v }))} placeholder="2026 / 1º semestre" /></Field>
            <Field label="Data"><Input type="date" value={form.data_avaliacao || ""} onChange={(v) => setForm((p) => ({ ...p, data_avaliacao: v }))} /></Field>
          </div>
          <div style={{ fontSize: 10, letterSpacing: "1.2px", textTransform: "uppercase", color: L.t4, fontWeight: 600, margin: "12px 0 8px" }}>Competências</div>
          {form.competencias.map((comp, i) => (
            <Row between key={comp.nome} mb={8}>
              <span style={{ fontSize: 12, color: L.t2 }}>{comp.nome}</span>
              <Row gap={4}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setForm((p) => {
                    const c = [...p.competencias]; c[i] = { ...c[i], nota: n }; return { ...p, competencias: c };
                  })} style={{
                    width: 28, height: 28, borderRadius: 7, cursor: "pointer",
                    border: `1px solid ${comp.nota === n ? L.teal : L.line}`,
                    background: comp.nota === n ? L.tealBg : L.white,
                    color: comp.nota === n ? L.teal : L.t3, fontSize: 12, fontWeight: 600,
                  }}>{n}</button>
                ))}
              </Row>
            </Row>
          ))}
          <div style={{ padding: "8px 12px", background: L.tealBg, borderRadius: 8, fontSize: 12, color: L.teal, margin: "6px 0 10px" }}>
            Nota final: {media(form.competencias)}
          </div>
          <Field label="Pontos fortes"><Textarea value={form.pontos_fortes} onChange={(v) => setForm((p) => ({ ...p, pontos_fortes: v }))} /></Field>
          <Field label="Pontos a melhorar"><Textarea value={form.pontos_melhoria} onChange={(v) => setForm((p) => ({ ...p, pontos_melhoria: v }))} /></Field>
          <Field label="Plano de ação"><Textarea value={form.plano_acao} onChange={(v) => setForm((p) => ({ ...p, plano_acao: v }))} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={(v) => setForm((p) => ({ ...p, status: v }))}>
              <option value="rascunho">Rascunho</option>
              <option value="finalizada">Finalizada</option>
            </Select>
          </Field>
          <ModalFooter onClose={() => setModal(false)} onSave={salvar} loading={salvando} />
        </Modal>
      )}
    </>
  );
}

/* ──────────────────────────── Ocorrências ──────────────────────────── */

function AbaOcorrencias({ itens, empresaId, uid, registradoPor, enviarArquivo, abrirArquivo, recarregar }) {
  const c = useCrud("rh_ocorrencias", empresaId, uid, recarregar);
  const salvar = async () => {
    let extra = { registrado_por: registradoPor };
    if (c.arquivo) { const a = await enviarArquivo(c.arquivo); extra = { ...extra, arquivo_url: a.url, arquivo_nome: a.nome }; }
    await c.salvar(extra);
  };
  return (
    <>
      <BarraNovo onNovo={() => c.abrir({ tipo: "observacao", data: hojeISO() })}>
        Registro do histórico disciplinar e de reconhecimento.
      </BarraNovo>
      {itens.length === 0 && <Vazio>Nenhuma ocorrência registrada.</Vazio>}
      {itens.map((o) => (
        <Linha key={o.id} acoes={<>
          {o.arquivo_url && <IBtn c={L.teal} onClick={() => abrirArquivo(o.arquivo_url)}>↗</IBtn>}
          <IBtn c={L.teal} onClick={() => c.abrir(o)}>✎</IBtn>
          <IBtn c={L.red} onClick={() => c.excluir(o, o.arquivo_url)}>⊗</IBtn>
        </>}>
          <Row gap={8}>
            <Tag color={COR_OCOR[o.tipo] || L.t3} bg={L.surface}>{TIPO_OCOR[o.tipo] || o.tipo}</Tag>
            <span style={{ fontSize: 12.5, color: L.t1, fontWeight: 500 }}>{o.titulo || "—"}</span>
          </Row>
          <div style={{ fontSize: 11, color: L.t4, marginTop: 3 }}>{fmtData(o.data)} · {o.descricao || ""}</div>
        </Linha>
      ))}
      {c.modal && (
        <ModalItem titulo={c.editando ? "Editar ocorrência" : "Nova ocorrência"}
          valor={c.valor} setValor={c.setValor} onSalvar={salvar} onFechar={c.fechar}
          arquivo={c.arquivo} setArquivo={c.setArquivo}
          campos={[
            { k: "tipo", label: "Tipo *", tipo: "select", vazio: false, opcoes: Object.entries(TIPO_OCOR) },
            { k: "data", label: "Data", tipo: "date" },
            { k: "titulo", label: "Título", full: true },
            { k: "descricao", label: "Descrição", tipo: "textarea", full: true },
          ]} />
      )}
    </>
  );
}

/* ─────────────────── Checklist de admissão / desligamento ─────────────────── */

function AbaChecklist({ itens, empresaId, uid, recarregar }) {
  const [criando, setCriando] = useState(false);

  const criarFluxo = async (fluxo) => {
    const base = fluxo === "admissao" ? ITENS_ADMISSAO : ITENS_DESLIGAMENTO;
    setCriando(true);
    await supabase.from("rh_checklist").insert(
      base.map((item, i) => ({ empresa_id: empresaId, usuario_id: uid, fluxo, item, ordem: i })),
    );
    setCriando(false);
    await recarregar();
  };

  const alternar = async (it) => {
    await supabase.from("rh_checklist")
      .update({ concluido: !it.concluido, concluido_em: !it.concluido ? new Date().toISOString() : null })
      .eq("id", it.id);
    await recarregar();
  };

  const excluirFluxo = async (fluxo) => {
    if (!confirm(`Remover o checklist de ${fluxo}?`)) return;
    await supabase.from("rh_checklist").delete().eq("usuario_id", uid).eq("fluxo", fluxo);
    await recarregar();
  };

  const porFluxo = (f) => itens.filter((i) => i.fluxo === f);

  const Bloco = ({ fluxo, titulo }) => {
    const lista = porFluxo(fluxo);
    const feitos = lista.filter((i) => i.concluido).length;
    if (lista.length === 0) {
      return (
        <div style={{ padding: 14, border: `1px dashed ${L.line}`, borderRadius: 10, marginBottom: 12 }}>
          <Row between>
            <span style={{ fontSize: 12, color: L.t3 }}>{titulo} — nenhum checklist iniciado</span>
            <PBtn onClick={() => criarFluxo(fluxo)}>{criando ? "..." : "Iniciar"}</PBtn>
          </Row>
        </div>
      );
    }
    return (
      <div style={{ marginBottom: 16 }}>
        <Row between mb={8}>
          <span style={{ fontSize: 12, fontWeight: 600, color: L.t1 }}>
            {titulo} — {feitos}/{lista.length}
          </span>
          <IBtn c={L.red} onClick={() => excluirFluxo(fluxo)}>⊗</IBtn>
        </Row>
        <div style={{ height: 4, background: L.surface, borderRadius: 4, marginBottom: 10 }}>
          <div style={{ height: "100%", width: `${(feitos / lista.length) * 100}%`,
            background: feitos === lista.length ? L.green : L.teal, borderRadius: 4 }} />
        </div>
        {lista.map((it) => (
          <div key={it.id} onClick={() => alternar(it)}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 4px", cursor: "pointer" }}>
            <div style={{ width: 16, height: 16, borderRadius: 5, flexShrink: 0,
              border: `1px solid ${it.concluido ? L.green : L.line}`,
              background: it.concluido ? L.green : "transparent",
              color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {it.concluido ? "✓" : ""}
            </div>
            <span style={{ fontSize: 12.5, color: it.concluido ? L.t4 : L.t1,
              textDecoration: it.concluido ? "line-through" : "none" }}>{it.item}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div style={{ fontSize: 11, color: L.t4, marginBottom: 12 }}>
        Roteiro do que precisa ser feito na entrada e na saída. O exame demissional costuma ser
        o item esquecido, e é o que gera passivo.
      </div>
      <Bloco fluxo="admissao" titulo="Admissão" />
      <Bloco fluxo="desligamento" titulo="Desligamento" />
    </>
  );
}
