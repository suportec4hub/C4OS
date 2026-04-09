import { useState } from "react";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { Fade, Row, Grid, TabPills, PBtn, DataTable, Tag, IBtn, TD } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const UNIDADES   = ["un", "kg", "g", "l", "ml", "m", "cm", "cx", "pç", "hr", "par"];
const VAZIO_PROD = { nome: "", sku: "", categoria: "", descricao: "", preco_custo: "", preco_venda: "", estoque_atual: 0, estoque_minimo: 0, unidade: "un" };
const VAZIO_MOV  = { produto_id: "", tipo: "entrada", qtd: "", motivo: "" };

const fmtD   = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
const fmtVal = (v)   => v != null ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

export default function PageEstoque({ user }) {
  const { data: produtos, loading: loadProd, insert: insProd, update: updProd, refetch: refProd } = useTable("produtos",            { empresa_id: user?.empresa_id });
  const { data: movs,     loading: loadMov,  insert: insMov,                  refetch: refMov  } = useTable("estoque_movimentos",   { empresa_id: user?.empresa_id });

  const [aba,      setAba]      = useState("Produtos");
  const [modProd,  setModProd]  = useState(false);
  const [modMov,   setModMov]   = useState(false);
  const [edit,     setEdit]     = useState(null);
  const [form,     setForm]     = useState(VAZIO_PROD);
  const [formMov,  setFormMov]  = useState(VAZIO_MOV);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");
  const F  = k => v => setForm(p => ({ ...p, [k]: v }));
  const FM = k => v => setFormMov(p => ({ ...p, [k]: v }));

  // KPIs
  const ativos      = produtos.filter(p => p.ativo !== false);
  const totalProd   = ativos.length;
  const valorEst    = ativos.reduce((s, p) => s + ((Number(p.preco_custo) || 0) * (Number(p.estoque_atual) || 0)), 0);
  const abaixoMin   = ativos.filter(p => (Number(p.estoque_atual) || 0) <= (Number(p.estoque_minimo) || 0)).length;
  const semEstoque  = ativos.filter(p => (Number(p.estoque_atual) || 0) <= 0).length;

  const openNewProd  = () => { setForm(VAZIO_PROD); setEdit(null); setErr(""); setModProd(true); };
  const openEditProd = (p) => { setForm({ ...p }); setEdit(p.id); setErr(""); setModProd(true); };
  const openMov      = (prodId) => { setFormMov({ ...VAZIO_MOV, produto_id: prodId || "" }); setErr(""); setModMov(true); };

  const saveProd = async () => {
    if (!form.nome.trim()) { setErr("Nome obrigatório."); return; }
    setSaving(true); setErr("");
    const payload = {
      ...form, empresa_id: user?.empresa_id, ativo: true,
      preco_custo:    Number(form.preco_custo)    || 0,
      preco_venda:    Number(form.preco_venda)    || 0,
      estoque_atual:  Number(form.estoque_atual)  || 0,
      estoque_minimo: Number(form.estoque_minimo) || 0,
    };
    const { error } = edit ? await updProd(edit, payload) : await insProd(payload);
    if (error) setErr(error.message || "Erro ao salvar.");
    else { setModProd(false); refProd(); }
    setSaving(false);
  };

  const saveMov = async () => {
    if (!formMov.produto_id || !formMov.qtd) { setErr("Produto e quantidade são obrigatórios."); return; }
    setSaving(true); setErr("");
    const qtd  = Number(formMov.qtd);
    const prod = produtos.find(p => p.id === formMov.produto_id);
    if (!prod) { setErr("Produto não encontrado."); setSaving(false); return; }

    let novo = Number(prod.estoque_atual) || 0;
    if (formMov.tipo === "entrada") novo += qtd;
    else if (formMov.tipo === "saida") novo = Math.max(0, novo - qtd);
    else novo = qtd; // ajuste direto

    const { error } = await insMov({
      ...formMov, qtd, empresa_id: user?.empresa_id, usuario_id: user?.id,
    });
    if (!error) await supabase.from("produtos").update({ estoque_atual: novo }).eq("id", formMov.produto_id);
    if (error) setErr(error.message || "Erro.");
    else { setModMov(false); refProd(); refMov(); }
    setSaving(false);
  };

  const excluirProd = async (id) => {
    if (!confirm("Inativar produto?")) return;
    await updProd(id, { ativo: false });
    refProd();
  };

  return (
    <Fade>
      {/* KPIs */}
      <Grid cols={4} gap={12} mb={16} responsive>
        {[
          { l: "Produtos Ativos",    v: totalProd,        c: L.teal },
          { l: "Valor em Estoque",   v: fmtVal(valorEst), c: L.green, small: true },
          { l: "Abaixo do Mínimo",   v: abaixoMin,        c: abaixoMin > 0 ? L.yellow : L.t4 },
          { l: "Sem Estoque",        v: semEstoque,       c: semEstoque > 0 ? L.red : L.t4 },
        ].map((k, i) => (
          <div key={i} style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: "15px 18px" }}>
            <div style={{ fontSize: 9.5, color: L.t4, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 5, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{k.l}</div>
            <div style={{ fontSize: k.small ? 19 : 28, fontWeight: 700, color: k.c, fontFamily: "'Outfit',sans-serif" }}>{k.v}</div>
          </div>
        ))}
      </Grid>

      <Row between mb={12}>
        <TabPills tabs={["Produtos", "Movimentações"]} active={aba} onChange={setAba} />
        <Row gap={8}>
          <button onClick={() => openMov(null)}
            style={{ padding: "7px 14px", background: L.surface, border: `1px solid ${L.line}`, borderRadius: 8, fontSize: 12, color: L.t2, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
            ⟳ Movimentação
          </button>
          {aba === "Produtos" && <PBtn onClick={openNewProd}>+ Produto</PBtn>}
        </Row>
      </Row>

      {/* ── Tab: Produtos ── */}
      {aba === "Produtos" && (
        loadProd ? <div style={{ textAlign: "center", padding: 40, color: L.t4 }}>Carregando...</div> : (
          <DataTable heads={["Produto", "SKU", "Categoria", "Custo", "Venda", "Estoque", "Ações"]}>
            {ativos.map(p => {
              const est  = Number(p.estoque_atual) || 0;
              const min  = Number(p.estoque_minimo) || 0;
              const zerado = est <= 0;
              const baixo  = !zerado && est <= min;
              return (
                <tr key={p.id}
                  style={{ borderBottom: `1px solid ${L.lineSoft}` }}
                  onMouseEnter={e => e.currentTarget.style.background = L.surface}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={TD}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: L.t1 }}>{p.nome}</div>
                    {p.descricao && <div style={{ fontSize: 10, color: L.t4 }}>{p.descricao.slice(0, 55)}{p.descricao.length > 55 ? "…" : ""}</div>}
                  </td>
                  <td style={{ ...TD, fontSize: 11, color: L.t4, fontFamily: "'JetBrains Mono',monospace" }}>
                    {p.sku || "—"}
                  </td>
                  <td style={TD}>
                    {p.categoria ? <Tag color={L.teal} bg={L.tealBg}>{p.categoria}</Tag> : <span style={{ color: L.t5, fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ ...TD, fontSize: 12, color: L.t3, fontFamily: "'JetBrains Mono',monospace" }}>
                    {fmtVal(p.preco_custo)}
                  </td>
                  <td style={{ ...TD, fontSize: 12, fontWeight: 600, color: L.green, fontFamily: "'JetBrains Mono',monospace" }}>
                    {fmtVal(p.preco_venda)}
                  </td>
                  <td style={TD}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: zerado ? L.red : baixo ? L.yellow : L.teal }}>
                        {est}
                      </span>
                      <span style={{ fontSize: 11, color: L.t4 }}>{p.unidade || "un"}</span>
                      {zerado && <Tag color={L.red}    bg={L.redBg}>Zerado</Tag>}
                      {baixo  && <Tag color={L.yellow} bg={L.yellowBg}>Baixo</Tag>}
                    </div>
                    <div style={{ fontSize: 9.5, color: L.t5, marginTop: 1 }}>Mín: {min} {p.unidade}</div>
                  </td>
                  <td style={TD}>
                    <Row gap={4}>
                      <IBtn c={L.green} onClick={() => openMov(p.id)} title="Registrar entrada/saída">⟳</IBtn>
                      <IBtn c={L.teal}  onClick={() => openEditProd(p)}>✎</IBtn>
                      <IBtn c={L.red}   onClick={() => excluirProd(p.id)}>⊗</IBtn>
                    </Row>
                  </td>
                </tr>
              );
            })}
            {ativos.length === 0 && (
              <tr><td colSpan={7} style={{ ...TD, textAlign: "center", color: L.t4, padding: 40, fontSize: 12 }}>
                Nenhum produto cadastrado.
              </td></tr>
            )}
          </DataTable>
        )
      )}

      {/* ── Tab: Movimentações ── */}
      {aba === "Movimentações" && (
        loadMov ? <div style={{ textAlign: "center", padding: 40, color: L.t4 }}>Carregando...</div> : (
          <DataTable heads={["Data", "Produto", "Tipo", "Quantidade", "Motivo"]}>
            {movs.slice().reverse().map(m => {
              const prod = produtos.find(p => p.id === m.produto_id);
              const cores = { entrada: L.green, saida: L.red, ajuste: L.yellow };
              const bgs   = { entrada: L.greenBg, saida: L.redBg, ajuste: L.yellowBg };
              const labels = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste" };
              return (
                <tr key={m.id} style={{ borderBottom: `1px solid ${L.lineSoft}` }}>
                  <td style={{ ...TD, fontSize: 11, color: L.t4, fontFamily: "'JetBrains Mono',monospace" }}>
                    {fmtD(m.created_at)}
                  </td>
                  <td style={{ ...TD, fontWeight: 500 }}>{prod?.nome || <span style={{ color: L.t5 }}>—</span>}</td>
                  <td style={TD}>
                    <Tag color={cores[m.tipo] || L.t4} bg={bgs[m.tipo] || L.surface}>
                      {labels[m.tipo] || m.tipo}
                    </Tag>
                  </td>
                  <td style={{ ...TD, fontWeight: 600, color: cores[m.tipo] || L.t1, fontFamily: "'JetBrains Mono',monospace" }}>
                    {m.tipo === "saida" ? "-" : m.tipo === "entrada" ? "+" : "="}{m.qtd} {prod?.unidade || "un"}
                  </td>
                  <td style={{ ...TD, color: L.t3, fontSize: 12 }}>{m.motivo || "—"}</td>
                </tr>
              );
            })}
            {movs.length === 0 && (
              <tr><td colSpan={5} style={{ ...TD, textAlign: "center", color: L.t4, padding: 40, fontSize: 12 }}>
                Nenhuma movimentação registrada.
              </td></tr>
            )}
          </DataTable>
        )
      )}

      {/* Modal: produto */}
      {modProd && (
        <Modal title={edit ? "Editar Produto" : "Cadastrar Produto"} onClose={() => setModProd(false)} width={520}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            <Field label="Nome *" style={{ gridColumn: "1/-1" }}>
              <Input value={form.nome} onChange={F("nome")} placeholder="Nome do produto..." autoFocus />
            </Field>
            <Field label="SKU / Código">
              <Input value={form.sku || ""} onChange={F("sku")} placeholder="SKU-001" />
            </Field>
            <Field label="Categoria">
              <Input value={form.categoria || ""} onChange={F("categoria")} placeholder="Ex: Eletrônicos..." />
            </Field>
            <Field label="Unidade de medida">
              <Select value={form.unidade || "un"} onChange={F("unidade")}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
            <div />
            <Field label="Preço de custo (R$)">
              <Input type="number" min={0} value={form.preco_custo || ""} onChange={F("preco_custo")} placeholder="0,00" />
            </Field>
            <Field label="Preço de venda (R$)">
              <Input type="number" min={0} value={form.preco_venda || ""} onChange={F("preco_venda")} placeholder="0,00" />
            </Field>
            <Field label="Estoque atual">
              <Input type="number" min={0} value={form.estoque_atual ?? 0} onChange={F("estoque_atual")} />
            </Field>
            <Field label="Estoque mínimo (alerta)">
              <Input type="number" min={0} value={form.estoque_minimo ?? 0} onChange={F("estoque_minimo")} />
            </Field>
            <Field label="Descrição" style={{ gridColumn: "1/-1" }}>
              <Input value={form.descricao || ""} onChange={F("descricao")} placeholder="Descrição opcional..." />
            </Field>
          </div>
          {err && <div style={{ padding: "8px 12px", background: L.redBg, borderRadius: 8, fontSize: 12, color: L.red, marginTop: 4 }}>{err}</div>}
          <ModalFooter onClose={() => setModProd(false)} onSave={saveProd} loading={saving} label={edit ? "Salvar" : "Cadastrar"} />
        </Modal>
      )}

      {/* Modal: movimentação */}
      {modMov && (
        <Modal title="Registrar Movimentação" onClose={() => setModMov(false)} width={420}>
          <Field label="Produto *">
            <Select value={formMov.produto_id} onChange={FM("produto_id")}>
              <option value="">Selecionar produto...</option>
              {ativos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome} — estoque: {Number(p.estoque_atual) || 0} {p.unidade}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo de movimentação">
            <Select value={formMov.tipo} onChange={FM("tipo")}>
              <option value="entrada">Entrada (+ adicionar ao estoque)</option>
              <option value="saida">Saída (− remover do estoque)</option>
              <option value="ajuste">Ajuste (= definir novo saldo)</option>
            </Select>
          </Field>
          <Field label="Quantidade *">
            <Input type="number" min={0} value={formMov.qtd} onChange={FM("qtd")} placeholder="0" />
          </Field>
          <Field label="Motivo / Observação">
            <Input value={formMov.motivo} onChange={FM("motivo")} placeholder="Compra, venda, inventário, avaria..." />
          </Field>
          {err && <div style={{ padding: "8px 12px", background: L.redBg, borderRadius: 8, fontSize: 12, color: L.red, marginTop: 4 }}>{err}</div>}
          <ModalFooter onClose={() => setModMov(false)} onSave={saveMov} loading={saving} label="Registrar" />
        </Modal>
      )}
    </Fade>
  );
}
