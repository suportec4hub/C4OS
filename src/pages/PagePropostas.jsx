import { useState, useCallback } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { useTable } from "../hooks/useData";
import { Fade, Row, Grid, TabPills, PBtn, DataTable, Tag, IBtn, TD } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const STATUS_C  = { rascunho: L.t4, enviado: L.blue, aprovado: L.green, recusado: L.red, expirado: L.yellow };
const STATUS_BG = { rascunho: L.surface, enviado: L.blueBg, aprovado: L.greenBg, recusado: L.redBg, expirado: L.yellowBg };

const VAZIO      = { titulo: "", cliente_nome: "", cliente_email: "", status: "rascunho", validade: "", desconto: 0, observacoes: "" };
const ITEM_VAZIO = { descricao: "", qtd: 1, valor_unit: "" };

const fmtD   = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";
const fmtVal = (v) => v != null ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

export default function PagePropostas({ user }) {
  const { data: propostas, loading, insert, update, remove, refetch } = useTable("propostas", { empresa_id: user?.empresa_id });

  const [aba,    setAba]    = useState("Todas");
  const [modal,  setModal]  = useState(false);
  const [editId, setEditId] = useState(null);
  const [form,   setForm]   = useState(VAZIO);
  const [itens,  setItens]  = useState([{ ...ITEM_VAZIO }]);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");
  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  // KPIs
  const aprovadas     = propostas.filter(p => p.status === "aprovado").length;
  const enviadas      = propostas.filter(p => p.status === "enviado");
  const pipeline      = enviadas.reduce((s, p) => s + (Number(p.total) || 0), 0);
  const naoRascunho   = propostas.filter(p => p.status !== "rascunho").length;
  const taxa          = naoRascunho > 0 ? Math.round((aprovadas / naoRascunho) * 100) : 0;

  const TABS = ["Todas", "Aprovadas", "Enviadas", "Rascunho", "Recusadas"];
  const filtered = propostas.filter(p => {
    if (aba === "Aprovadas") return p.status === "aprovado";
    if (aba === "Enviadas")  return p.status === "enviado";
    if (aba === "Rascunho")  return p.status === "rascunho";
    if (aba === "Recusadas") return p.status === "recusado";
    return true;
  });

  // Cálculo do total em tempo real no modal
  const subtotal  = itens.reduce((s, i) => s + ((Number(i.qtd) || 0) * (Number(i.valor_unit) || 0)), 0);
  const descAmnt  = (subtotal * (Number(form.desconto) || 0)) / 100;
  const total     = subtotal - descAmnt;

  const openNew = () => {
    setForm(VAZIO); setItens([{ ...ITEM_VAZIO }]);
    setEditId(null); setErr(""); setModal(true);
  };

  const openEdit = useCallback(async (p) => {
    setForm({ ...p, desconto: p.desconto ?? 0 });
    setEditId(p.id); setErr("");
    const { data } = await supabase.from("proposta_itens")
      .select("*").eq("proposta_id", p.id).order("id");
    setItens(data?.length > 0 ? data : [{ ...ITEM_VAZIO }]);
    setModal(true);
  }, []);

  const addItem = () => setItens(p => [...p, { ...ITEM_VAZIO }]);
  const updItem = (i, k, v) => setItens(p => p.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
  const remItem = (i) => setItens(p => p.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!form.titulo.trim()) { setErr("Título obrigatório."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, empresa_id: user?.empresa_id, total, desconto: Number(form.desconto) || 0 };
    let propId = editId;

    if (editId) {
      const { error } = await update(editId, payload);
      if (error) { setErr(error.message); setSaving(false); return; }
    } else {
      const { data, error } = await insert(payload);
      if (error) { setErr(error.message); setSaving(false); return; }
      // useTable insert pode retornar array ou objeto
      propId = Array.isArray(data) ? data[0]?.id : data?.id;
    }

    if (propId) {
      await supabase.from("proposta_itens").delete().eq("proposta_id", propId);
      const validos = itens.filter(i => i.descricao && i.valor_unit !== "");
      if (validos.length > 0) {
        await supabase.from("proposta_itens").insert(validos.map(i => ({
          proposta_id: propId,
          descricao:   i.descricao,
          qtd:         Number(i.qtd) || 1,
          valor_unit:  Number(i.valor_unit) || 0,
        })));
      }
    }

    setModal(false); refetch(); setSaving(false);
  };

  const mudarStatus = async (id, status) => { await update(id, { status }); };

  const inputStyle = {
    padding: "7px 10px", border: `1px solid ${L.line}`, borderRadius: 8,
    fontSize: 12, color: L.t1, outline: "none", background: L.surface,
    fontFamily: "inherit", width: "100%",
  };

  return (
    <Fade>
      {/* KPIs */}
      <Grid cols={4} gap={12} mb={16} responsive>
        {[
          { l: "Propostas Aprovadas", v: aprovadas,        c: L.green },
          { l: "Pipeline (enviadas)", v: fmtVal(pipeline), c: L.teal,   small: true },
          { l: "Taxa de Conversão",   v: `${taxa}%`,       c: L.copper },
          { l: "Total de Propostas",  v: propostas.length, c: L.t2 },
        ].map((k, i) => (
          <div key={i} style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: "15px 18px" }}>
            <div style={{ fontSize: 9.5, color: L.t4, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 5, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{k.l}</div>
            <div style={{ fontSize: k.small ? 19 : 28, fontWeight: 700, color: k.c, fontFamily: "'Outfit',sans-serif" }}>{k.v}</div>
          </div>
        ))}
      </Grid>

      <Row between mb={12}>
        <TabPills tabs={TABS} active={aba} onChange={setAba} />
        <PBtn onClick={openNew}>+ Nova Proposta</PBtn>
      </Row>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: L.t4 }}>Carregando...</div>
      ) : (
        <DataTable heads={["Proposta", "Cliente", "Total", "Validade", "Status", "Ações"]}>
          {filtered.map(p => (
            <tr key={p.id}
              style={{ borderBottom: `1px solid ${L.lineSoft}` }}
              onMouseEnter={e => e.currentTarget.style.background = L.surface}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <td style={{ ...TD, fontWeight: 600, color: L.t1 }}>{p.titulo}</td>
              <td style={TD}>
                <div style={{ fontSize: 12.5, color: L.t1 }}>{p.cliente_nome || "—"}</div>
                {p.cliente_email && <div style={{ fontSize: 10, color: L.t4 }}>{p.cliente_email}</div>}
              </td>
              <td style={{ ...TD, fontWeight: 700, color: L.t1, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
                {fmtVal(p.total)}
              </td>
              <td style={{ ...TD, fontSize: 11, color: L.t4, fontFamily: "'JetBrains Mono',monospace" }}>
                {fmtD(p.validade)}
              </td>
              <td style={TD}>
                <Tag color={STATUS_C[p.status] || L.t4} bg={STATUS_BG[p.status] || L.surface}>
                  {p.status}
                </Tag>
              </td>
              <td style={TD}>
                <Row gap={4}>
                  {p.status === "rascunho" && <IBtn c={L.blue}  onClick={() => mudarStatus(p.id, "enviado")}   title="Marcar enviado">↗</IBtn>}
                  {p.status === "enviado"  && <IBtn c={L.green} onClick={() => mudarStatus(p.id, "aprovado")}  title="Marcar aprovado">✓</IBtn>}
                  {p.status === "enviado"  && <IBtn c={L.red}   onClick={() => mudarStatus(p.id, "recusado")}  title="Marcar recusado">✕</IBtn>}
                  <IBtn c={L.teal} onClick={() => openEdit(p)}>✎</IBtn>
                  <IBtn c={L.red}  onClick={() => { if (confirm("Excluir proposta?")) remove(p.id); }}>⊗</IBtn>
                </Row>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={6} style={{ ...TD, textAlign: "center", color: L.t4, padding: 40, fontSize: 12 }}>
              Nenhuma proposta encontrada.
            </td></tr>
          )}
        </DataTable>
      )}

      {/* Modal proposta */}
      {modal && (
        <Modal title={editId ? "Editar Proposta" : "Nova Proposta"} onClose={() => setModal(false)} width={600}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            <Field label="Título *" style={{ gridColumn: "1/-1" }}>
              <Input value={form.titulo} onChange={F("titulo")} placeholder="Proposta comercial..." autoFocus />
            </Field>
            <Field label="Nome do cliente">
              <Input value={form.cliente_nome || ""} onChange={F("cliente_nome")} placeholder="Nome ou razão social..." />
            </Field>
            <Field label="E-mail do cliente">
              <Input type="email" value={form.cliente_email || ""} onChange={F("cliente_email")} placeholder="email@cliente.com" />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={F("status")}>
                {Object.keys(STATUS_C).map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Validade">
              <Input type="date" value={form.validade || ""} onChange={F("validade")} />
            </Field>
          </div>

          {/* Itens */}
          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: L.t2, marginBottom: 8, textTransform: "uppercase", letterSpacing: "1px", fontFamily: "'JetBrains Mono',monospace" }}>
              Itens da Proposta
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 110px 32px", gap: 6, marginBottom: 4 }}>
              {["Descrição", "Qtd", "Valor unit.", ""].map((h, i) => (
                <div key={i} style={{ fontSize: 9, color: L.t4, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{h}</div>
              ))}
            </div>
            {itens.map((item, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 110px 32px", gap: 6, marginBottom: 6 }}>
                <input value={item.descricao} onChange={e => updItem(i, "descricao", e.target.value)}
                  placeholder="Nome do produto / serviço..." style={inputStyle} />
                <input type="number" min={0} value={item.qtd} onChange={e => updItem(i, "qtd", e.target.value)}
                  style={{ ...inputStyle, textAlign: "center" }} />
                <input type="number" min={0} value={item.valor_unit} onChange={e => updItem(i, "valor_unit", e.target.value)}
                  placeholder="0,00" style={inputStyle} />
                <button onClick={() => remItem(i)}
                  style={{ background: L.redBg, border: "none", borderRadius: 8, color: L.red, cursor: "pointer", fontSize: 13 }}>⊗</button>
              </div>
            ))}
            <button onClick={addItem}
              style={{ background: "none", border: `1px dashed ${L.line}`, borderRadius: 8, padding: "7px 14px", fontSize: 11.5, color: L.t3, cursor: "pointer", width: "100%", fontFamily: "inherit", transition: "border-color .12s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = L.teal}
              onMouseLeave={e => e.currentTarget.style.borderColor = L.line}>
              + Adicionar item
            </button>
          </div>

          {/* Totais */}
          <div style={{ padding: "12px 14px", background: L.surface, borderRadius: 10, border: `1px solid ${L.lineSoft}`, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: L.t3 }}>Subtotal</span>
              <span style={{ fontSize: 12, color: L.t1, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{fmtVal(subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: L.t3 }}>Desconto (%)</span>
              <input type="number" min={0} max={100} value={form.desconto || 0} onChange={F("desconto")}
                style={{ width: 64, padding: "3px 8px", border: `1px solid ${L.line}`, borderRadius: 6, fontSize: 12, textAlign: "right", outline: "none", background: L.white, fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${L.line}`, paddingTop: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: L.t1 }}>Total</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: L.teal, fontFamily: "'JetBrains Mono',monospace" }}>{fmtVal(total)}</span>
            </div>
          </div>

          <Field label="Observações / Condições">
            <Input value={form.observacoes || ""} onChange={F("observacoes")} placeholder="Prazo de entrega, condições de pagamento..." />
          </Field>

          {err && <div style={{ padding: "8px 12px", background: L.redBg, borderRadius: 8, fontSize: 12, color: L.red, marginTop: 4 }}>{err}</div>}
          <ModalFooter onClose={() => setModal(false)} onSave={save} loading={saving} label={editId ? "Salvar Alterações" : "Criar Proposta"} />
        </Modal>
      )}
    </Fade>
  );
}
