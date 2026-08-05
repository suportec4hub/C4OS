// RH / Pessoas.
//
// A organização é por pessoa: a ficha do colaborador concentra documentos,
// saúde ocupacional, benefícios, treinamentos, avaliações, ocorrências e o
// checklist de admissão/desligamento. As abas daqui ficam só para o que é
// transversal — os alertas, o ponto e as ausências —, porque são as perguntas
// que o RH faz olhando a empresa inteira, não uma pessoa.
import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { Fade, Row, Grid, TabPills, PBtn, DataTable, Tag, Av, IBtn, TD, Card } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";
import FichaColaborador, { fmtData, hojeISO, diasAte, fmtMoeda } from "../components/FichaColaborador";
import PontoEletronico, { ConfigPonto } from "../components/PontoEletronico";

const TIPO_LABEL = { ferias:"Férias", afastamento:"Afastamento", licenca:"Licença",
  folga:"Day Off", homeoffice:"Home Office", atestado:"Atestado médico" };
const STATUS_C   = { solicitado:L.yellow, aprovado:L.green, rejeitado:L.red, em_andamento:L.teal, concluido:L.t4 };
const STATUS_BG  = { solicitado:L.yellowBg, aprovado:L.greenBg, rejeitado:L.redBg, em_andamento:L.tealBg, concluido:L.surface };

const VAZIO_FERIAS = { usuario_id:"", tipo:"ferias", data_inicio:"", data_fim:"", status:"solicitado", observacao:"" };

const diasEntre = (ini, fim) => {
  if (!ini || !fim) return 0;
  return Math.round((new Date(fim) - new Date(ini)) / 86400000) + 1;
};

const ABAS = ["Visão geral", "Colaboradores", "Aniversários", "Ponto", "Férias & Afastamentos"];

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Idade (ou tempo de casa) que a pessoa completa na data deste ano — não a
// idade atual. É o número que se diz no parabéns.
const completaAnos = (dataISO, ano = new Date().getFullYear()) =>
  dataISO ? ano - Number(dataISO.slice(0, 4)) : null;

const diaDe = (dataISO) => Number(dataISO.slice(8, 10));
const mesDe = (dataISO) => Number(dataISO.slice(5, 7));

export default function PageRH({ user }) {
  const empresaId = user?.empresa_id;
  const { data: colaboradores, loading: loadCo, refetch: refCo } = useTable("usuarios", { empresa_id: empresaId });
  const { data: ferias, loading: loadFer, insert: insFerias, update: updFerias,
          remove: remFerias, refetch: refFer } = useTable("rh_ferias", { empresa_id: empresaId });

  const [fichas, setFichas]   = useState([]);
  const [docs, setDocs]       = useState([]);
  const [saude, setSaude]     = useState([]);
  const [treins, setTreins]   = useState([]);

  const [aba, setAba]     = useState("Visão geral");
  const [modal, setModal] = useState(false);
  const [edit, setEdit]   = useState(null);
  const [form, setForm]   = useState(VAZIO_FERIAS);
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");
  const [fichaAberta, setFichaAberta] = useState(null);

  const F = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const hoje = hojeISO();

  const carregarRH = async () => {
    if (!empresaId) return;
    const q = (t, s) => supabase.from(t).select("*").eq("empresa_id", empresaId).then(({ data }) => s(data || []));
    await Promise.all([
      q("rh_colaboradores", setFichas), q("rh_documentos", setDocs),
      q("rh_saude", setSaude), q("rh_treinamentos", setTreins),
    ]);
  };
  useEffect(() => { carregarRH(); /* eslint-disable-next-line */ }, [empresaId]);

  const nomeUser  = (uid) => colaboradores.find((c) => c.id === uid)?.nome || "—";
  const fichaDe   = (uid) => fichas.find((f) => f.usuario_id === uid);
  const ativos    = colaboradores.filter((c) => c.ativo);

  /* ── Alertas: é a tela que o RH abre de manhã ───────────────────────────
     Tudo aqui é "o que vence, venceu, ou exige ação agora". Sem isso, cada
     verificação depende de alguém lembrar de olhar. */
  const alertas = useMemo(() => {
    const out = [];
    const push = (nivel, cat, quem, texto, extra) => out.push({ nivel, cat, quem, texto, extra });

    docs.forEach((d) => {
      const n = diasAte(d.data_validade);
      if (n === null) return;
      if (n < 0)       push("critico", "Documento", nomeUser(d.usuario_id), `${d.tipo} vencido há ${Math.abs(n)} dias`);
      else if (n <= 30) push("aviso",  "Documento", nomeUser(d.usuario_id), `${d.tipo} vence em ${n} dias`);
    });

    saude.forEach((s) => {
      const n = diasAte(s.data_validade);
      if (s.resultado === "inapto") push("critico", "Saúde", nomeUser(s.usuario_id), "Exame com resultado inapto");
      if (n === null) return;
      if (n < 0)        push("critico", "Saúde", nomeUser(s.usuario_id), `ASO vencido há ${Math.abs(n)} dias`);
      else if (n <= 30) push("aviso",   "Saúde", nomeUser(s.usuario_id), `ASO vence em ${n} dias`);
    });

    treins.forEach((t) => {
      const n = diasAte(t.data_validade);
      if (n !== null && n < 0 && t.obrigatorio)
        push("critico", "Treinamento", nomeUser(t.usuario_id), `${t.titulo} — certificado vencido`);
    });

    ativos.forEach((c) => {
      const f = fichaDe(c.id);
      if (!f?.data_admissao) {
        push("aviso", "Cadastro", c.nome, "Ficha sem data de admissão");
        return;
      }
      // Contrato de experiência: 45 + 45 dias. Passar do prazo sem decidir
      // transforma o contrato em prazo indeterminado sem ninguém perceber.
      const dias = Math.round((new Date(hoje) - new Date(f.data_admissao)) / 86400000);
      if (dias >= 0 && dias <= 90) {
        const marco = dias <= 45 ? 45 : 90;
        const faltam = marco - dias;
        if (faltam <= 10)
          push("aviso", "Experiência", c.nome, `Fim do período de ${marco} dias em ${faltam} dia(s)`);
      }
      // Férias: vencem 12 meses após o fim do período aquisitivo.
      if (dias > 365) {
        const teveFerias = ferias.some((x) => x.usuario_id === c.id && x.tipo === "ferias" &&
          x.status !== "rejeitado" && new Date(x.data_inicio) > new Date(Date.now() - 365 * 86400000));
        if (!teveFerias)
          push("critico", "Férias", c.nome, "Sem férias registradas nos últimos 12 meses");
      }
      if (!f.cpf) push("aviso", "Cadastro", c.nome, "Ficha sem CPF");
    });

    ferias.filter((f) => f.status === "solicitado")
      .forEach((f) => push("aviso", "Aprovação", nomeUser(f.usuario_id),
        `${TIPO_LABEL[f.tipo] || f.tipo} aguardando aprovação`));

    const ordem = { critico: 0, aviso: 1 };
    return out.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
  }, [docs, saude, treins, fichas, colaboradores, ferias]);

  const aniversariantes = useMemo(() => {
    const mes = new Date().getMonth() + 1;
    return ativos.map((c) => ({ c, f: fichaDe(c.id) }))
      .filter(({ f }) => f?.data_nascimento && Number(f.data_nascimento.slice(5, 7)) === mes)
      .sort((a, b) => a.f.data_nascimento.slice(8) - b.f.data_nascimento.slice(8));
  }, [fichas, colaboradores]);

  const aniversariosEmpresa = useMemo(() => {
    const mes = new Date().getMonth() + 1;
    return ativos.map((c) => ({ c, f: fichaDe(c.id) }))
      .filter(({ f }) => f?.data_admissao && Number(f.data_admissao.slice(5, 7)) === mes
        && new Date(f.data_admissao).getFullYear() < new Date().getFullYear())
      .map(({ c, f }) => ({ c, f, anos: new Date().getFullYear() - new Date(f.data_admissao).getFullYear() }));
  }, [fichas, colaboradores]);

  const emFerias = ferias.filter((f) => f.status === "em_andamento" ||
    (f.status === "aprovado" && f.data_inicio <= hoje && f.data_fim >= hoje)).length;
  const pendentes = ferias.filter((f) => f.status === "solicitado").length;

  const folha = ativos.reduce((s, c) => s + Number(fichaDe(c.id)?.salario || 0), 0);

  const cargos = {};
  ativos.forEach((c) => { const g = c.cargo || "Sem cargo"; cargos[g] = (cargos[g] || 0) + 1; });
  // Top 6 cargos e o resto agrupado em "Outros": fatiar em 6 e descartar o
  // restante fazia o gráfico somar menos que o total de pessoas, sem avisar.
  const ordenados = Object.entries(cargos).sort((a, b) => b[1] - a[1]);
  const pieData = ordenados.slice(0, 6).map(([name, value]) => ({ name, value }));
  const resto = ordenados.slice(6).reduce((s, [, v]) => s + v, 0);
  if (resto > 0) pieData.push({ name: `Outros (${ordenados.length - 6} cargos)`, value: resto });
  const PIE_COLORS = [L.teal, L.copper, L.green, L.yellow, L.red, L.blue, L.t4];

  const openNew  = () => { setForm(VAZIO_FERIAS); setEdit(null); setErr(""); setModal(true); };
  const openEdit = (f) => { setForm({ ...f }); setEdit(f.id); setErr(""); setModal(true); };

  const save = async () => {
    if (!form.usuario_id) { setErr("Selecione o colaborador."); return; }
    if (!form.data_inicio || !form.data_fim) { setErr("Datas obrigatórias."); return; }
    if (form.data_fim < form.data_inicio) { setErr("Data fim deve ser após data início."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, empresa_id: empresaId };
    const { error } = edit ? await updFerias(edit, payload) : await insFerias(payload);
    if (error) setErr(error.message || "Erro ao salvar.");
    else { setModal(false); refFer(); }
    setSaving(false);
  };

  const aprovar  = async (f) => { await updFerias(f.id, { status: "aprovado" }); };
  const rejeitar = async (f) => { await updFerias(f.id, { status: "rejeitado" }); };

  return (
    <Fade>
      <Grid cols={4} gap={12} mb={16} responsive>
        <KPI l="Colaboradores Ativos" v={ativos.length} c={L.green} />
        <KPI l="Pendências Críticas" v={alertas.filter((a) => a.nivel === "critico").length} c={L.red}
             sub={`${alertas.filter((a) => a.nivel === "aviso").length} avisos`} />
        <KPI l="Em Férias / Afastamento" v={emFerias} c={L.teal} sub={`${pendentes} a aprovar`} />
        <KPI l="Folha (salários)" v={fmtMoeda(folha)} c={L.copper} sub="colaboradores ativos" />
      </Grid>

      <Row between mb={12}>
        <div style={{ overflowX: "auto" }}><TabPills tabs={ABAS} active={aba} onChange={setAba} /></div>
        {aba === "Férias & Afastamentos" && <PBtn onClick={openNew}>+ Registrar</PBtn>}
      </Row>

      {aba === "Visão geral" && (
        <VisaoGeral alertas={alertas} aniversariantes={aniversariantes}
          aniversariosEmpresa={aniversariosEmpresa} pieData={pieData} cores={PIE_COLORS} />
      )}

      {aba === "Colaboradores" && (
        loadCo ? <Carregando /> : (
          <DataTable heads={["Colaborador", "Cargo", "Contrato", "Admissão", "Salário", "Status", "Ficha"]}>
            {colaboradores.map((c) => {
              const f = fichaDe(c.id);
              const completa = f && f.cpf && f.data_admissao;
              return (
                <tr key={c.id} style={{ borderBottom: `1px solid ${L.lineSoft}` }}
                  onMouseEnter={(e) => e.currentTarget.style.background = L.surface}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <td style={TD}>
                    <Row gap={9}>
                      <Av name={c.nome} size={28} color={c.ativo ? L.teal : L.t4} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: L.t1 }}>{c.nome}</div>
                        <div style={{ fontSize: 10, color: L.t4 }}>{c.email || c.whatsapp || "—"}</div>
                      </div>
                    </Row>
                  </td>
                  <td style={{ ...TD, color: L.t2, fontSize: 12 }}>{c.cargo || "—"}</td>
                  <td style={{ ...TD, fontSize: 11, color: L.t3 }}>{(f?.tipo_contrato || "—").toUpperCase()}</td>
                  <td style={{ ...TD, fontSize: 11, color: L.t3, fontFamily: "'JetBrains Mono',monospace" }}>{fmtData(f?.data_admissao)}</td>
                  <td style={{ ...TD, fontSize: 11.5, color: L.t2 }}>{fmtMoeda(f?.salario)}</td>
                  <td style={TD}>
                    <Tag color={c.ativo ? L.green : L.red} bg={c.ativo ? L.greenBg : L.redBg}>
                      {c.ativo ? "Ativo" : "Inativo"}
                    </Tag>
                  </td>
                  <td style={TD}>
                    <Row gap={5}>
                      {!completa && <Tag color={L.yellow} bg={L.yellowBg}>incompleta</Tag>}
                      <IBtn c={L.teal} onClick={() => setFichaAberta(c)}>☰</IBtn>
                    </Row>
                  </td>
                </tr>
              );
            })}
            {colaboradores.length === 0 && (
              <tr><td colSpan={7} style={{ ...TD, textAlign: "center", color: L.t4, padding: 40 }}>
                Nenhum colaborador cadastrado.</td></tr>
            )}
          </DataTable>
        )
      )}

      {aba === "Aniversários" && <AbaAniversarios colaboradores={ativos} fichas={fichas} />}

      {aba === "Ponto" && <AbaPonto user={user} colaboradores={ativos} fichas={fichas} />}

      {aba === "Férias & Afastamentos" && (
        loadFer ? <Carregando /> : (
          <DataTable heads={["Colaborador", "Tipo", "Início", "Fim", "Dias", "Status", "Ações"]}>
            {ferias.map((f) => (
              <tr key={f.id} style={{ borderBottom: `1px solid ${L.lineSoft}` }}
                onMouseEnter={(e) => e.currentTarget.style.background = L.surface}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <td style={{ ...TD, fontWeight: 500, color: L.t1 }}>{nomeUser(f.usuario_id)}</td>
                <td style={TD}><Tag color={L.teal} bg={L.tealBg}>{TIPO_LABEL[f.tipo] || f.tipo}</Tag></td>
                <td style={{ ...TD, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>{fmtData(f.data_inicio)}</td>
                <td style={{ ...TD, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>{fmtData(f.data_fim)}</td>
                <td style={{ ...TD, textAlign: "center", fontWeight: 600, color: L.t1 }}>{diasEntre(f.data_inicio, f.data_fim)}</td>
                <td style={TD}><Tag color={STATUS_C[f.status] || L.t4} bg={STATUS_BG[f.status] || L.surface}>
                  {String(f.status).replace("_", " ")}</Tag></td>
                <td style={TD}>
                  <Row gap={4}>
                    {f.status === "solicitado" && <IBtn c={L.green} onClick={() => aprovar(f)} title="Aprovar">✓</IBtn>}
                    {f.status === "solicitado" && <IBtn c={L.red} onClick={() => rejeitar(f)} title="Rejeitar">✕</IBtn>}
                    <IBtn c={L.teal} onClick={() => openEdit(f)}>✎</IBtn>
                    <IBtn c={L.red} onClick={() => { if (confirm("Excluir registro?")) remFerias(f.id); }}>⊗</IBtn>
                  </Row>
                </td>
              </tr>
            ))}
            {ferias.length === 0 && (
              <tr><td colSpan={7} style={{ ...TD, textAlign: "center", color: L.t4, padding: 40 }}>
                Nenhum registro. Clique em '+ Registrar' para adicionar.</td></tr>
            )}
          </DataTable>
        )
      )}

      {modal && (
        <Modal title={edit ? "Editar Registro" : "Novo Registro de Férias / Afastamento"}
          onClose={() => setModal(false)} width={480}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            <div style={{ gridColumn: "1/-1" }}><Field label="Colaborador *">
              <Select value={form.usuario_id} onChange={F("usuario_id")}>
                <option value="">Selecionar colaborador...</option>
                {ativos.map((c) => <option key={c.id} value={c.id}>{c.nome} — {c.cargo || "Sem cargo"}</option>)}
              </Select>
            </Field></div>
            <Field label="Tipo">
              <Select value={form.tipo} onChange={F("tipo")}>
                {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={F("status")}>
                {["solicitado", "aprovado", "rejeitado", "em_andamento", "concluido"]
                  .map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </Select>
            </Field>
            <Field label="Data Início *"><Input value={form.data_inicio || ""} onChange={F("data_inicio")} type="date" /></Field>
            <Field label="Data Fim *"><Input value={form.data_fim || ""} onChange={F("data_fim")} type="date" /></Field>
            {form.data_inicio && form.data_fim && form.data_fim >= form.data_inicio && (
              <div style={{ gridColumn: "1/-1", padding: "8px 12px", background: L.tealBg,
                borderRadius: 8, fontSize: 12, color: L.teal, marginBottom: 4 }}>
                Duração: {diasEntre(form.data_inicio, form.data_fim)} dia(s) corridos
              </div>
            )}
            <div style={{ gridColumn: "1/-1" }}><Field label="Observação">
              <Input value={form.observacao || ""} onChange={F("observacao")} placeholder="Motivo ou observações..." />
            </Field></div>
          </div>
          {err && <div style={{ padding: "8px 12px", background: L.redBg, borderRadius: 8,
            fontSize: 12, color: L.red, marginTop: 4 }}>{err}</div>}
          <ModalFooter onClose={() => setModal(false)} onSave={save} loading={saving}
            label={edit ? "Salvar Alterações" : "Registrar"} />
        </Modal>
      )}

      {fichaAberta && (
        <FichaColaborador user={user} colaborador={fichaAberta}
          onClose={() => { setFichaAberta(null); carregarRH(); }}
          onSalvou={() => { carregarRH(); refCo(); }} />
      )}
    </Fade>
  );
}

// Fora do componente: declarado dentro, seria recriado a cada render e
// remontaria a árvore — o mesmo defeito que fazia o input perder o foco.
function KPI({ l, v, c, sub }) {
  return (
    <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`,
      padding: "15px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 9.5, color: L.t4, textTransform: "uppercase", letterSpacing: "1.5px",
        marginBottom: 5, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{l}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: c, fontFamily: "'Outfit',sans-serif" }}>{v}</div>
      {sub && <div style={{ fontSize: 10, color: L.t4, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ───────────────────────────── Aniversários ─────────────────────────────
   Alimentado pela data de nascimento e pela data de admissão da ficha. Quem
   não tiver a data preenchida simplesmente não aparece — e a Visão geral já
   avisa que a ficha está incompleta, então a ausência não fica invisível. */

function AbaAniversarios({ colaboradores, fichas }) {
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const hojeDia = agora.getDate();
  const hojeMes = agora.getMonth() + 1;

  const fichaDe = (uid) => fichas.find((f) => f.usuario_id === uid);

  // Uma lista só para os dois tipos: o cartão é o mesmo, muda a origem da
  // data e o texto. Assim "do dia" e "do mês" saem do mesmo lugar.
  const eventos = useMemo(() => {
    const out = [];
    colaboradores.forEach((c) => {
      const f = fichaDe(c.id);
      if (f?.data_nascimento && mesDe(f.data_nascimento) === mes) {
        out.push({ tipo: "nascimento", c, data: f.data_nascimento,
          dia: diaDe(f.data_nascimento), anos: completaAnos(f.data_nascimento) });
      }
      // Tempo de casa só conta a partir do primeiro ano completo: quem foi
      // admitido neste ano ainda não tem aniversário de empresa.
      if (f?.data_admissao && mesDe(f.data_admissao) === mes) {
        const anos = completaAnos(f.data_admissao);
        if (anos >= 1) {
          out.push({ tipo: "empresa", c, data: f.data_admissao,
            dia: diaDe(f.data_admissao), anos });
        }
      }
    });
    return out.sort((a, b) => a.dia - b.dia);
  }, [colaboradores, fichas, mes]);

  const doDia = eventos.filter((e) => e.dia === hojeDia && mes === hojeMes);
  const semData = colaboradores.filter((c) => !fichaDe(c.id)?.data_nascimento).length;

  return (
    <>
      <Row between mb={12}>
        <Row gap={8}>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))}
            style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${L.line}`,
              background: L.white, color: L.t1, fontSize: 12 }}>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <Tag color={L.copper} bg={L.copperBg}>
            {eventos.filter((e) => e.tipo === "nascimento").length} aniversário(s)
          </Tag>
          <Tag color={L.teal} bg={L.tealBg}>
            {eventos.filter((e) => e.tipo === "empresa").length} de casa
          </Tag>
        </Row>
        {mes !== hojeMes && (
          <button onClick={() => setMes(hojeMes)} style={{
            padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11,
            border: `1px solid ${L.line}`, background: "transparent", color: L.t3 }}>
            Voltar para {MESES[hojeMes - 1]}
          </button>
        )}
      </Row>

      {/* Hoje em destaque: é a informação com prazo de validade de um dia. */}
      <div style={{ background: doDia.length ? L.copperBg : L.surface, borderRadius: 12,
        border: `1px solid ${doDia.length ? L.copper : L.line}`, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: "1.4px", textTransform: "uppercase",
          color: doDia.length ? L.copper : L.t4, fontWeight: 700, marginBottom: doDia.length ? 10 : 0,
          fontFamily: "'JetBrains Mono',monospace" }}>
          Hoje — {hojeDia} de {MESES[hojeMes - 1]}
        </div>
        {doDia.length === 0 ? (
          <div style={{ fontSize: 12, color: L.t4 }}>Ninguém faz aniversário hoje.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {doDia.map((e, i) => <CartaoAniversario key={i} ev={e} destaque />)}
          </div>
        )}
      </div>

      <div style={{ fontSize: 10, letterSpacing: "1.4px", textTransform: "uppercase",
        color: L.t4, fontWeight: 600, marginBottom: 10, fontFamily: "'JetBrains Mono',monospace" }}>
        {MESES[mes - 1]} — mês inteiro
      </div>

      {eventos.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: L.t4, fontSize: 12 }}>
          Nenhum aniversário em {MESES[mes - 1]}.
          {semData > 0 && ` ${semData} colaborador(es) sem data de nascimento na ficha.`}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
          {eventos.map((e, i) => (
            <CartaoAniversario key={i} ev={e} passou={mes === hojeMes && e.dia < hojeDia}
              hoje={mes === hojeMes && e.dia === hojeDia} />
          ))}
        </div>
      )}

      {semData > 0 && eventos.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 11, color: L.t4 }}>
          {semData} colaborador(es) sem data de nascimento na ficha — não aparecem aqui.
        </div>
      )}
    </>
  );
}

function CartaoAniversario({ ev, destaque, passou, hoje }) {
  const { c, tipo, dia, anos } = ev;
  const cor = tipo === "nascimento" ? L.copper : L.teal;

  // Mensagem pronta abre o WhatsApp com o texto já escrito: o parabéns é a
  // ação que segue o aviso, e o número já está no cadastro.
  const numero = String(c.whatsapp || "").replace(/\D/g, "");
  const texto = tipo === "nascimento"
    ? `Parabéns, ${(c.nome || "").split(" ")[0]}! Toda a equipe deseja um feliz aniversário. 🎉`
    : `Parabéns pelos ${anos} ano${anos > 1 ? "s" : ""} de casa, ${(c.nome || "").split(" ")[0]}! Obrigado por fazer parte do time. 🎉`;
  const link = numero ? `https://wa.me/${numero.length <= 11 ? "55" + numero : numero}?text=${encodeURIComponent(texto)}` : null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 11, padding: "11px 13px",
      background: destaque ? L.white : L.white, borderRadius: 10,
      border: `1px solid ${hoje || destaque ? cor : L.line}`,
      opacity: passou ? 0.55 : 1,
    }}>
      <Av name={c.nome} size={destaque ? 40 : 34} color={cor} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: L.t1, whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
        <div style={{ fontSize: 11, color: L.t4 }}>
          {tipo === "nascimento"
            ? `dia ${dia} · faz ${anos} anos`
            : `dia ${dia} · ${anos} ano${anos > 1 ? "s" : ""} de casa`}
        </div>
        <div style={{ fontSize: 10.5, color: L.t4, marginTop: 1 }}>{c.cargo || "—"}</div>
      </div>
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" title="Parabenizar no WhatsApp"
          style={{ textDecoration: "none", fontSize: 15, color: cor, padding: "4px 6px" }}>🎉</a>
      )}
    </div>
  );
}

const totalPie = (d) => d.reduce((s, x) => s + x.value, 0);

// Tooltip do gráfico de cargos. É próprio, e não o do recharts, porque o
// padrão pinta o texto com a cor da série e ignora o tema: no escuro saía
// preto sobre preto. Além de legível, diz o cargo e o percentual — antes
// mostrava só "1 pessoa", sem dizer de quem.
function TooltipCargo({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  const cor = payload[0].color;
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ background: L.white, border: `1px solid ${L.line}`, borderRadius: 9,
      padding: "8px 11px", boxShadow: "0 4px 16px rgba(0,0,0,0.25)", pointerEvents: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: L.t1 }}>{name}</span>
      </div>
      <div style={{ fontSize: 11.5, color: L.t3 }}>
        {value} pessoa{value !== 1 ? "s" : ""} · {pct}% do time
      </div>
    </div>
  );
}

function Carregando() {
  return <div style={{ textAlign: "center", padding: 40, color: L.t4 }}>Carregando...</div>;
}

/* ───────────────────────────── Visão geral ───────────────────────────── */

function VisaoGeral({ alertas, aniversariantes, aniversariosEmpresa, pieData, cores }) {
  const [filtro, setFiltro] = useState("todos");
  const lista = filtro === "todos" ? alertas : alertas.filter((a) => a.nivel === filtro);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }} className="rg-auto">
        <Card title="Pendências e vencimentos" sub="o que exige ação">
          <Row gap={6} mb={10}>
            {[["todos", "Todos"], ["critico", "Críticos"], ["aviso", "Avisos"]].map(([v, l]) => (
              <button key={v} onClick={() => setFiltro(v)} style={{
                padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontSize: 11,
                border: `1px solid ${filtro === v ? L.teal : L.line}`,
                background: filtro === v ? L.tealBg : "transparent",
                color: filtro === v ? L.teal : L.t3,
              }}>{l}</button>
            ))}
          </Row>
          {lista.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30, color: L.t4, fontSize: 12 }}>
              Nada pendente. Documentos, exames e prazos estão em dia.
            </div>
          ) : (
            <div style={{ maxHeight: 340, overflowY: "auto" }}>
              {lista.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center",
                  padding: "9px 4px", borderBottom: `1px solid ${L.lineSoft}` }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                    background: a.nivel === "critico" ? L.red : L.yellow }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: L.t1 }}>{a.quem}</div>
                    <div style={{ fontSize: 11, color: L.t3 }}>{a.texto}</div>
                  </div>
                  <Tag color={L.t3} bg={L.surface}>{a.cat}</Tag>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Card title="Aniversariantes do mês" sub="datas de nascimento">
            {aniversariantes.length === 0
              ? <div style={{ fontSize: 11.5, color: L.t4, padding: 8 }}>Nenhum neste mês.</div>
              : aniversariantes.map(({ c, f }) => (
                <Row between key={c.id} mb={6}>
                  <Row gap={7}>
                    <Av name={c.nome} size={22} color={L.copper} />
                    <span style={{ fontSize: 12, color: L.t2 }}>{c.nome}</span>
                  </Row>
                  <span style={{ fontSize: 11, color: L.t4, fontFamily: "'JetBrains Mono',monospace" }}>
                    {f.data_nascimento.slice(8)}/{f.data_nascimento.slice(5, 7)}
                  </span>
                </Row>
              ))}
          </Card>

          <Card title="Aniversários de empresa" sub="tempo de casa">
            {aniversariosEmpresa.length === 0
              ? <div style={{ fontSize: 11.5, color: L.t4, padding: 8 }}>Nenhum neste mês.</div>
              : aniversariosEmpresa.map(({ c, anos }) => (
                <Row between key={c.id} mb={6}>
                  <Row gap={7}>
                    <Av name={c.nome} size={22} color={L.teal} />
                    <span style={{ fontSize: 12, color: L.t2 }}>{c.nome}</span>
                  </Row>
                  <Tag color={L.teal} bg={L.tealBg}>{anos} ano{anos > 1 ? "s" : ""}</Tag>
                </Row>
              ))}
          </Card>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Card title="Distribuição por cargo" sub="colaboradores ativos">
          {pieData.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 18, alignItems: "center" }}
              className="rg-auto">
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={78}
                    dataKey="value" paddingAngle={2} stroke="none">
                    {pieData.map((_, i) => <Cell key={i} fill={cores[i % cores.length]} />)}
                  </Pie>
                  {/* Tooltip próprio: o padrão do recharts herda cor de texto que
                      não enxerga o tema escuro, e saía preto sobre fundo escuro. */}
                  <Tooltip content={<TooltipCargo total={totalPie(pieData)} />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Legenda própria em vez da do recharts: além de legível, mostra
                  quantidade e percentual, que era o que o tooltip escondia. */}
              <div>
                {pieData.map((d, i) => {
                  const total = totalPie(pieData);
                  const pct = total ? Math.round((d.value / total) * 100) : 0;
                  return (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 9,
                      padding: "5px 0", borderBottom: `1px solid ${L.lineSoft}` }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
                        background: cores[i % cores.length] }} />
                      <span style={{ flex: 1, fontSize: 12, color: L.t2, whiteSpace: "nowrap",
                        overflow: "hidden", textOverflow: "ellipsis" }} title={d.name}>{d.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: L.t1 }}>{d.value}</span>
                      <span style={{ fontSize: 11, color: L.t4, width: 34, textAlign: "right",
                        fontFamily: "'JetBrains Mono',monospace" }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: L.t4, fontSize: 11 }}>
              Nenhum colaborador cadastrado
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

/* ─────────────────────────── Ponto e banco de horas ─────────────────────────── */

const minutos = (t) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// Trabalhado = (saída − entrada) − intervalo de almoço. Registro incompleto
// devolve null em vez de zero: zero seria lido como falta, e falta e registro
// pela metade são coisas diferentes.
export const horasTrabalhadas = (r) => {
  const ent = minutos(r.entrada), sai = minutos(r.saida);
  if (ent == null || sai == null) return null;
  let total = sai - ent;
  const sa = minutos(r.saida_almoco), va = minutos(r.volta_almoco);
  if (sa != null && va != null && va > sa) total -= (va - sa);
  return total / 60;
};

const hhmm = (h) => {
  if (h == null) return "—";
  const sinal = h < 0 ? "-" : "";
  const abs = Math.abs(h);
  return `${sinal}${String(Math.floor(abs)).padStart(2, "0")}:${String(Math.round((abs % 1) * 60)).padStart(2, "0")}`;
};

/* ─────────────────────── Marcação de ponto com localização ───────────────────────
   A ordem das batidas é fixa; a próxima é sempre o primeiro campo vazio. Isso
   evita pedir ao colaborador que escolha o tipo — ele só confirma. */

const SEQUENCIA = [
  { campo: "entrada",      rotulo: "Entrada" },
  { campo: "saida_almoco", rotulo: "Saída para almoço" },
  { campo: "volta_almoco", rotulo: "Volta do almoço" },
  { campo: "saida",        rotulo: "Saída" },
];

const proximaBatida = (reg) => SEQUENCIA.find((s) => !reg?.[s.campo]) || null;

const horaAgora = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

// Promessa em cima da geolocalização do navegador. Recusa e indisponibilidade
// resolvem para null em vez de rejeitar: sem localização o ponto ainda é
// registrado, apenas sem a coordenada — bloquear a batida por causa de uma
// permissão negada deixaria o colaborador sem poder marcar.
function pegarLocalizacao() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: Number(pos.coords.latitude.toFixed(7)),
        longitude: Number(pos.coords.longitude.toFixed(7)),
        precisao_m: Math.round(pos.coords.accuracy),
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

function BaterPonto({ user, empresaId, onRegistrou }) {
  const [regHoje, setRegHoje] = useState(null);
  const [marcs, setMarcs]     = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg]         = useState("");
  const hoje = hojeISO();

  const carregarHoje = async () => {
    if (!user?.id) return;
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from("rh_ponto").select("*").eq("usuario_id", user.id).eq("data", hoje).maybeSingle(),
      supabase.from("rh_ponto_marcacoes").select("*").eq("usuario_id", user.id).eq("data", hoje).order("hora"),
    ]);
    setRegHoje(p || null);
    setMarcs(m || []);
  };
  useEffect(() => { carregarHoje(); /* eslint-disable-next-line */ }, [user?.id]);

  const proxima = proximaBatida(regHoje);

  const bater = async () => {
    if (!proxima) return;
    setOcupado(true); setMsg("");
    const hora = horaAgora();
    const loc = await pegarLocalizacao();

    const { error: e1 } = await supabase.from("rh_ponto")
      .upsert({ empresa_id: empresaId, usuario_id: user.id, data: hoje,
                [proxima.campo]: hora, horas_previstas: regHoje?.horas_previstas ?? 8 },
              { onConflict: "usuario_id,data" });

    if (e1) { setMsg(e1.message); setOcupado(false); return; }

    const { error: e2 } = await supabase.from("rh_ponto_marcacoes").insert({
      empresa_id: empresaId, usuario_id: user.id, data: hoje,
      tipo: proxima.campo, hora, ...(loc || {}),
    });
    if (e2) setMsg(e2.message);
    else setMsg(loc
      ? `${proxima.rotulo} registrada às ${hora.slice(0, 5)} — localização capturada (±${loc.precisao_m} m).`
      : `${proxima.rotulo} registrada às ${hora.slice(0, 5)} — sem localização (permissão negada ou GPS indisponível).`);

    await carregarHoje();
    onRegistrou?.();
    setOcupado(false);
  };

  return (
    <div style={{ background: L.white, border: `1px solid ${L.line}`, borderRadius: 12,
      padding: "14px 16px", marginBottom: 14 }}>
      <Row between>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: "1.4px", textTransform: "uppercase",
            color: L.t4, fontWeight: 700, marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>
            Meu ponto de hoje
          </div>
          <Row gap={8}>
            {SEQUENCIA.map((s) => {
              const h = regHoje?.[s.campo];
              const m = marcs.find((x) => x.tipo === s.campo);
              return (
                <div key={s.campo} style={{ padding: "6px 10px", borderRadius: 8,
                  border: `1px solid ${h ? L.green : L.line}`,
                  background: h ? L.greenBg : "transparent", minWidth: 96 }}>
                  <div style={{ fontSize: 9.5, color: L.t4, textTransform: "uppercase",
                    letterSpacing: ".6px" }}>{s.rotulo}</div>
                  <Row gap={5}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: h ? L.green : L.t4,
                      fontFamily: "'JetBrains Mono',monospace" }}>{h ? h.slice(0, 5) : "--:--"}</span>
                    {m?.latitude != null && (
                      <a href={`https://www.google.com/maps?q=${m.latitude},${m.longitude}`}
                        target="_blank" rel="noopener noreferrer" title={`±${m.precisao_m} m`}
                        style={{ fontSize: 11, textDecoration: "none" }}>📍</a>
                    )}
                  </Row>
                </div>
              );
            })}
          </Row>
        </div>
        <div style={{ textAlign: "right" }}>
          {proxima ? (
            <PBtn onClick={ocupado ? undefined : bater}>
              {ocupado ? "Registrando..." : `Bater ${proxima.rotulo.toLowerCase()}`}
            </PBtn>
          ) : (
            <Tag color={L.green} bg={L.greenBg}>jornada completa</Tag>
          )}
        </div>
      </Row>
      {msg && (
        <div style={{ marginTop: 10, padding: "7px 11px", borderRadius: 8, fontSize: 11.5,
          background: L.tealBg, color: L.teal }}>{msg}</div>
      )}
    </div>
  );
}

function ModalMarcacoes({ registro, nome, onClose }) {
  const [marcs, setMarcs] = useState(null);
  useEffect(() => {
    supabase.from("rh_ponto_marcacoes").select("*")
      .eq("usuario_id", registro.usuario_id).eq("data", registro.data).order("hora")
      .then(({ data }) => setMarcs(data || []));
  }, [registro]);

  const rotulo = (t) => SEQUENCIA.find((s) => s.campo === t)?.rotulo || t;

  return (
    <Modal title={`Marcações — ${nome}, ${fmtData(registro.data)}`} onClose={onClose} width={520}>
      {marcs === null && <div style={{ padding: 30, textAlign: "center", color: L.t4 }}>Carregando...</div>}
      {marcs?.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: L.t4, fontSize: 12 }}>
          Nenhuma marcação com localização neste dia — o registro foi lançado manualmente pelo RH.
        </div>
      )}
      {marcs?.map((m) => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10,
          padding: "10px 4px", borderBottom: `1px solid ${L.lineSoft}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, color: L.t1, fontWeight: 500 }}>{rotulo(m.tipo)}</div>
            <div style={{ fontSize: 11, color: L.t4 }}>
              {m.hora?.slice(0, 5)}
              {m.latitude != null
                ? ` · ${m.latitude}, ${m.longitude} (±${m.precisao_m} m)`
                : " · sem localização"}
            </div>
          </div>
          {m.latitude != null && (
            <a href={`https://www.google.com/maps?q=${m.latitude},${m.longitude}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11.5, color: L.teal, textDecoration: "none" }}>ver no mapa ↗</a>
          )}
        </div>
      ))}
      <div style={{ marginTop: 12, fontSize: 10.5, color: L.t4 }}>
        A marcação guarda o que foi batido na hora. Ajustes feitos pelo RH alteram o resumo do dia,
        não este registro.
      </div>
    </Modal>
  );
}

function AbaPonto({ user, colaboradores, fichas = [] }) {
  const empresaId = user?.empresa_id;
  // O modo vale por empresa: uma pode usar o registro eletrônico e outra o
  // lançamento de gestão, sem que uma escolha atropele a outra.
  const [config, setConfig] = useState(null);
  const [configAberta, setConfigAberta] = useState(false);

  const fichaDe = (uid) => fichas.find((f) => f.usuario_id === uid);
  const registraPonto = (uid) => fichaDe(uid)?.registra_ponto !== false;
  // Só quem bate ponto entra nas listas: sócio e diretoria isentos não devem
  // aparecer como quem esqueceu de marcar.
  const batemPonto = colaboradores.filter((c) => registraPonto(c.id));

  const carregarConfig = async () => {
    if (!empresaId) return;
    const { data } = await supabase.from("rh_config").select("*").eq("empresa_id", empresaId).maybeSingle();
    setConfig(data || { empresa_id: empresaId, modo_ponto: "gestao" });
  };
  useEffect(() => { carregarConfig(); /* eslint-disable-next-line */ }, [empresaId]);
  // hojeISO() em vez de toISOString(): à noite, no fuso do Brasil, o mês
  // padrão podia pular para o seguinte no último dia do mês.
  const [mes, setMes]   = useState(hojeISO().slice(0, 7));
  const [quem, setQuem] = useState("");
  const [regs, setRegs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [verMarcacoes, setVerMarcacoes] = useState(null);

  const carregar = async () => {
    if (!empresaId) return;
    setCarregando(true);
    // Último dia do mês via Date.UTC. Com new Date("2026-08-01") a data é lida
    // como UTC mas getMonth() responde no fuso local: em UTC-3 o fim do mês
    // caía em 31/07, antes do início, e a consulta não retornava nada.
    const [ano, m] = mes.split("-").map(Number);
    const ini = `${mes}-01`;
    const fim = new Date(Date.UTC(ano, m, 0)).toISOString().slice(0, 10);
    let q = supabase.from("rh_ponto").select("*").eq("empresa_id", empresaId)
      .gte("data", ini).lte("data", fim).order("data", { ascending: false });
    if (quem) q = q.eq("usuario_id", quem);
    const { data } = await q;
    setRegs(data || []);
    setCarregando(false);
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [mes, quem, empresaId]);

  const nome = (uid) => colaboradores.find((c) => c.id === uid)?.nome || "—";

  // Saldo do banco de horas: soma das diferenças entre trabalhado e previsto.
  const saldo = regs.reduce((s, r) => {
    const t = horasTrabalhadas(r);
    if (t == null) return s;
    return s + (t - Number(r.horas_previstas ?? 8));
  }, 0);

  const abrir = (r = null) => {
    setEditando(r?.id || null);
    setForm(r ? { ...r } : { data: hojeISO(), usuario_id: quem || "", horas_previstas: 8 });
    setErro(""); setModal(true);
  };

  const salvar = async () => {
    if (!form.usuario_id) { setErro("Selecione o colaborador."); return; }
    if (!form.data) { setErro("Informe a data."); return; }
    setSalvando(true); setErro("");
    const payload = { ...form, empresa_id: empresaId };
    delete payload.id; delete payload.created_at;
    Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
    // upsert pela chave (usuario_id, data): lançar duas vezes o mesmo dia
    // corrigiria o registro em vez de duplicá-lo.
    const { error } = editando
      ? await supabase.from("rh_ponto").update(payload).eq("id", editando)
      : await supabase.from("rh_ponto").upsert(payload, { onConflict: "usuario_id,data" });
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    setModal(false); carregar();
  };

  const excluir = async (r) => {
    if (!confirm("Excluir este registro de ponto?")) return;
    await supabase.from("rh_ponto").delete().eq("id", r.id);
    carregar();
  };

  const P = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const eletronico = config?.modo_ponto === "eletronico";

  const barraModo = (
    <Row between mb={12}>
      <Row gap={8}>
        <Tag color={eletronico ? L.teal : L.t3} bg={eletronico ? L.tealBg : L.surface}>
          {eletronico ? "registro definitivo — não pode ser alterado" : "registro corrigível — o RH pode ajustar"}
        </Tag>
      </Row>
      <button onClick={() => setConfigAberta(true)} style={{ padding: "6px 12px", borderRadius: 8,
        cursor: "pointer", fontSize: 11.5, border: `1px solid ${L.line}`,
        background: "transparent", color: L.t2 }}>
        Configurar modo
      </button>
    </Row>
  );

  if (config === null) return <Carregando />;

  if (eletronico) {
    return (
      <>
        {barraModo}
        <PontoEletronico user={user} empresaId={empresaId} config={config}
          colaboradores={colaboradores} fichas={fichas} />
        {configAberta && (
          <ConfigPonto empresaId={empresaId} config={config}
            onSalvou={carregarConfig} onClose={() => setConfigAberta(false)} />
        )}
      </>
    );
  }

  return (
    <>
      {barraModo}
      {configAberta && (
        <ConfigPonto empresaId={empresaId} config={config}
          onSalvou={carregarConfig} onClose={() => setConfigAberta(false)} />
      )}
      {registraPonto(user?.id)
        ? <BaterPonto user={user} empresaId={empresaId} onRegistrou={carregar} />
        : (
          <div style={{ background: L.surface, border: `1px solid ${L.line}`, borderRadius: 12,
            padding: "12px 16px", marginBottom: 14, fontSize: 11.5, color: L.t3 }}>
            Você está isento de marcação de ponto
            {fichaDe(user?.id)?.motivo_isencao ? ` — ${fichaDe(user.id).motivo_isencao}` : ""}.
            Continua podendo lançar e conferir o ponto da equipe.
          </div>
        )}

      <Row between mb={12}>
        <Row gap={8}>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${L.line}`,
              background: L.white, color: L.t1, fontSize: 12 }} />
          <select value={quem} onChange={(e) => setQuem(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${L.line}`,
              background: L.white, color: L.t1, fontSize: 12 }}>
            <option value="">Todos os colaboradores</option>
            {batemPonto.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <Tag color={saldo >= 0 ? L.green : L.red} bg={saldo >= 0 ? L.greenBg : L.redBg}>
            banco de horas {saldo >= 0 ? "+" : ""}{hhmm(saldo)}
          </Tag>
        </Row>
        <PBtn onClick={() => abrir()}>+ Lançar ponto</PBtn>
      </Row>

      {carregando ? <Carregando /> : (
        <DataTable heads={["Data", "Colaborador", "Entrada", "Almoço", "Saída", "Trabalhado", "Saldo", "Ações"]}>
          {regs.map((r) => {
            const t = horasTrabalhadas(r);
            const dif = t == null ? null : t - Number(r.horas_previstas ?? 8);
            return (
              <tr key={r.id} style={{ borderBottom: `1px solid ${L.lineSoft}` }}
                onMouseEnter={(e) => e.currentTarget.style.background = L.surface}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <td style={{ ...TD, fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace" }}>{fmtData(r.data)}</td>
                <td style={{ ...TD, fontSize: 12, color: L.t1 }}>{nome(r.usuario_id)}</td>
                <td style={{ ...TD, fontSize: 11.5 }}>{r.entrada?.slice(0, 5) || "—"}</td>
                <td style={{ ...TD, fontSize: 11.5, color: L.t3 }}>
                  {r.saida_almoco ? `${r.saida_almoco.slice(0, 5)}–${r.volta_almoco?.slice(0, 5) || "?"}` : "—"}
                </td>
                <td style={{ ...TD, fontSize: 11.5 }}>{r.saida?.slice(0, 5) || "—"}</td>
                <td style={{ ...TD, fontSize: 11.5, fontWeight: 600, color: L.t1 }}>{hhmm(t)}</td>
                <td style={TD}>
                  {dif == null ? <span style={{ fontSize: 11, color: L.t4 }}>incompleto</span> : (
                    <Tag color={dif >= 0 ? L.green : L.red} bg={dif >= 0 ? L.greenBg : L.redBg}>
                      {dif >= 0 ? "+" : ""}{hhmm(dif)}
                    </Tag>
                  )}
                </td>
                <td style={TD}>
                  <Row gap={4}>
                    <IBtn c={L.t3} onClick={() => setVerMarcacoes(r)} title="Marcações e localização">📍</IBtn>
                    <IBtn c={L.teal} onClick={() => abrir(r)}>✎</IBtn>
                    <IBtn c={L.red} onClick={() => excluir(r)}>⊗</IBtn>
                  </Row>
                </td>
              </tr>
            );
          })}
          {regs.length === 0 && (
            <tr><td colSpan={8} style={{ ...TD, textAlign: "center", color: L.t4, padding: 40 }}>
              Nenhum ponto lançado neste mês.</td></tr>
          )}
        </DataTable>
      )}

      {modal && (
        <Modal title={editando ? "Editar ponto" : "Lançar ponto"} onClose={() => setModal(false)} width={470}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            <div style={{ gridColumn: "1/-1" }}><Field label="Colaborador *">
              <Select value={form.usuario_id || ""} onChange={P("usuario_id")}>
                <option value="">Selecionar...</option>
                {batemPonto.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Field></div>
            <Field label="Data *"><Input type="date" value={form.data || ""} onChange={P("data")} /></Field>
            <Field label="Horas previstas"><Input type="number" step="0.5" value={form.horas_previstas ?? 8} onChange={P("horas_previstas")} /></Field>
            <Field label="Entrada"><Input type="time" value={form.entrada || ""} onChange={P("entrada")} /></Field>
            <Field label="Saída p/ almoço"><Input type="time" value={form.saida_almoco || ""} onChange={P("saida_almoco")} /></Field>
            <Field label="Volta do almoço"><Input type="time" value={form.volta_almoco || ""} onChange={P("volta_almoco")} /></Field>
            <Field label="Saída"><Input type="time" value={form.saida || ""} onChange={P("saida")} /></Field>
            <div style={{ gridColumn: "1/-1" }}><Field label="Abono">
              <Select value={form.abono || ""} onChange={P("abono")}>
                <option value="">Sem abono</option>
                {["Atestado", "Falta justificada", "Falta injustificada", "Feriado", "Folga", "Férias"]
                  .map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
            </Field></div>
            <div style={{ gridColumn: "1/-1" }}><Field label="Observação">
              <Input value={form.observacao || ""} onChange={P("observacao")} />
            </Field></div>
          </div>
          {form.entrada && form.saida && (
            <div style={{ padding: "8px 12px", background: L.tealBg, borderRadius: 8,
              fontSize: 12, color: L.teal, marginTop: 6 }}>
              Trabalhado: {hhmm(horasTrabalhadas(form))} · previsto {hhmm(Number(form.horas_previstas ?? 8))}
            </div>
          )}
          {erro && <div style={{ padding: "8px 12px", background: L.redBg, borderRadius: 8,
            fontSize: 12, color: L.red, marginTop: 6 }}>{erro}</div>}
          <ModalFooter onClose={() => setModal(false)} onSave={salvar} loading={salvando} />
        </Modal>
      )}

      {verMarcacoes && (
        <ModalMarcacoes registro={verMarcacoes} nome={nome(verMarcacoes.usuario_id)}
          onClose={() => setVerMarcacoes(null)} />
      )}
    </>
  );
}
