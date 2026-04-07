import { useState, useEffect } from "react";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { Fade, Row, PBtn, Tag, Av } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const PRIORIDADES = ["Alta","Media","Baixa"];
const CANAIS = ["WhatsApp","Email","Ligação","Reunião","Outro"];
const VAZIO = { titulo:"", descricao:"", canal:"WhatsApp", prioridade:"Media", agendado_para:"", responsavel_id:"", lead_id:"", mensagem_whatsapp:"" };
const PC = { Alta:{c:L.red,bg:L.redBg}, Media:{c:L.yellow,bg:L.yellowBg}, Baixa:{c:L.green,bg:L.greenBg} };

function fmtDt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function isOverdue(iso) {
  return iso && new Date(iso) < new Date();
}

export default function PageFollowUp({ user }) {
  const { data: followups, loading, insert, update, remove, refetch } = useTable("follow_ups", { empresa_id: user?.empresa_id });
  const { data: usuarios } = useTable("usuarios", { empresa_id: user?.empresa_id, ativo: true });
  const [leads, setLeads] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [filtro, setFiltro] = useState("pendente");
  const [vendedorFiltro, setVendedorFiltro] = useState("todos");

  useEffect(() => {
    if (!user?.empresa_id) return;
    supabase.from("leads").select("id, nome, whatsapp, status, atribuido_a").eq("empresa_id", user.empresa_id).then(({ data }) => setLeads(data || []));
  }, [user?.empresa_id]);

  const filtered = followups.filter(f => {
    const statusOk = filtro === "todos" || f.status === filtro;
    const vendOk = vendedorFiltro === "todos" || f.responsavel_id === vendedorFiltro;
    return statusOk && vendOk;
  });

  // Agrupar por responsável
  const grouped = {};
  filtered.forEach(f => {
    const key = f.responsavel_id || "__sem_responsavel__";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(f);
  });

  const urgentes = followups.filter(f => f.prioridade === "Alta" && f.status === "pendente").length;
  const vencidos = followups.filter(f => f.status === "pendente" && isOverdue(f.agendado_para)).length;

  const openNew = () => { setForm({ ...VAZIO, agendado_para: new Date(Date.now() + 3600000).toISOString().slice(0,16) }); setEditId(null); setErr(""); setModal(true); };
  const openEdit = (f) => { setForm({ ...VAZIO, ...f, agendado_para: f.agendado_para?.slice(0,16) || "" }); setEditId(f.id); setErr(""); setModal(true); };

  const save = async () => {
    if (!form.titulo.trim()) { setErr("Título obrigatório."); return; }
    if (!form.agendado_para) { setErr("Data/hora obrigatória."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, empresa_id: user?.empresa_id, status: editId ? form.status : "pendente", criado_por: user?.id };
    const { error } = editId ? await update(editId, payload) : await insert(payload);
    if (error) setErr(error.message || "Erro ao salvar.");
    else setModal(false);
    setSaving(false);
  };

  const concluir = async (id) => { await update(id, { status: "concluido", concluido_em: new Date().toISOString() }); };
  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  const getUser = (id) => usuarios.find(u => u.id === id);
  const getLead = (id) => leads.find(l => l.id === id);

  const openWhatsApp = (followup) => {
    const lead = getLead(followup.lead_id);
    const phone = lead?.whatsapp?.replace(/\D/g, "");
    if (!phone) return;
    const msg = followup.mensagem_whatsapp || `Olá ${lead?.nome || ""}! Tudo bem? Passando para dar continuidade no nosso contato. 😊`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const renderCard = (item) => {
    const done = item.status === "concluido";
    const overdue = !done && isOverdue(item.agendado_para);
    const lead = getLead(item.lead_id);
    return (
      <div key={item.id} style={{ background: L.white, borderRadius: 11, border: `1.5px solid ${done ? L.green + "44" : overdue ? L.red + "44" : L.line}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, opacity: done ? .6 : 1, transition: "all .18s", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        {/* Check */}
        <button onClick={() => !done && concluir(item.id)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: done ? L.green : "transparent", border: `2px solid ${done ? L.green : overdue ? L.red : L.line}`, cursor: done ? "default" : "pointer", color: "white", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .18s" }}>
          {done ? "✓" : ""}
        </button>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: done ? L.t4 : L.t1, textDecoration: done ? "line-through" : "none", marginBottom: 3 }}>{item.titulo}</div>
          <Row gap={8} style={{ flexWrap: "wrap" }}>
            {lead && (
              <span style={{ fontSize: 11, color: L.teal, fontWeight: 500 }}>◎ {lead.nome}</span>
            )}
            {item.descricao && <span style={{ fontSize: 11, color: L.t4 }}>{item.descricao}</span>}
            {overdue && <Tag color={L.red} bg={L.redBg} small>Vencido</Tag>}
          </Row>
        </div>

        {/* Meta */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: overdue ? L.red : L.teal, marginBottom: 5, fontFamily: "'JetBrains Mono',monospace" }}>{fmtDt(item.agendado_para)}</div>
          <Row gap={5} style={{ justifyContent: "flex-end" }}>
            <Tag color={PC[item.prioridade]?.c || L.t3} bg={PC[item.prioridade]?.bg || L.surface} small>{item.prioridade}</Tag>
            <Tag color={L.t3} bg={L.surface} small>{item.canal}</Tag>
          </Row>
        </div>

        {/* Ações */}
        <Row gap={4}>
          {!done && lead?.whatsapp && item.canal === "WhatsApp" && (
            <button onClick={() => openWhatsApp(item)} title="Abrir WhatsApp" style={{ background: L.greenBg, border: `1px solid ${L.green}22`, cursor: "pointer", color: L.green, fontSize: 13, padding: "4px 8px", borderRadius: 6, transition: "all .1s", fontWeight: 700 }}>💬</button>
          )}
          {!done && (
            <>
              <button onClick={() => openEdit(item)} style={{ background: "none", border: "none", cursor: "pointer", color: L.t4, fontSize: 13, padding: "3px 6px", borderRadius: 5, transition: "color .1s" }} onMouseEnter={e => e.currentTarget.style.color = L.teal} onMouseLeave={e => e.currentTarget.style.color = L.t4}>✎</button>
              <button onClick={() => { if (confirm("Excluir?")) remove(item.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: L.t4, fontSize: 13, padding: "3px 6px", borderRadius: 5, transition: "color .1s" }} onMouseEnter={e => e.currentTarget.style.color = L.red} onMouseLeave={e => e.currentTarget.style.color = L.t4}>⊗</button>
            </>
          )}
        </Row>
      </div>
    );
  };

  return (
    <Fade>
      {/* Alertas */}
      {(urgentes > 0 || vencidos > 0) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          {urgentes > 0 && <div style={{ padding: "8px 14px", background: L.redBg, border: `1px solid ${L.red}33`, borderRadius: 8, fontSize: 12, color: L.red, fontWeight: 600 }}>⚡ {urgentes} urgentes</div>}
          {vencidos > 0 && <div style={{ padding: "8px 14px", background: L.yellowBg, border: `1px solid ${L.yellow}33`, borderRadius: 8, fontSize: 12, color: L.yellow, fontWeight: 600 }}>⏰ {vencidos} vencidos</div>}
        </div>
      )}

      {/* Filtros */}
      <Row between mb={14} style={{ flexWrap: "wrap", gap: 8 }}>
        <Row gap={6} style={{ flexWrap: "wrap" }}>
          {["pendente", "concluido", "todos"].map(s => (
            <button key={s} onClick={() => setFiltro(s)} style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: filtro === s ? 600 : 400, cursor: "pointer", fontFamily: "inherit", background: filtro === s ? L.white : L.surface, color: filtro === s ? L.teal : L.t3, border: `1.5px solid ${filtro === s ? L.teal + "44" : L.line}`, transition: "all .12s" }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <select value={vendedorFiltro} onChange={e => setVendedorFiltro(e.target.value)} style={{ padding: "6px 10px", borderRadius: 7, fontSize: 12, border: `1.5px solid ${L.line}`, background: L.white, color: L.t2, fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
            <option value="todos">Todos vendedores</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </Row>
        <PBtn onClick={openNew}>+ Novo Follow-up</PBtn>
      </Row>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: L.t4 }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: L.t3 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◷</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Nenhum follow-up {filtro !== "todos" ? filtro : ""}</div>
          <div style={{ fontSize: 12, color: L.t4, marginBottom: 20 }}>Crie um follow-up e vincule a um lead para acompanhar contatos</div>
          <PBtn onClick={openNew}>+ Criar Follow-up</PBtn>
        </div>
      ) : vendedorFiltro !== "todos" ? (
        // Visão flat quando filtrando por vendedor
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(renderCard)}
        </div>
      ) : (
        // Visão agrupada por vendedor
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {Object.entries(grouped).map(([vendId, items]) => {
            const vend = getUser(vendId);
            return (
              <div key={vendId}>
                <Row gap={8} mb={8}>
                  {vend ? <Av name={vend.nome} color={L.teal} size={24} /> : <div style={{ width: 24, height: 24, borderRadius: 6, background: L.surface, border: `1px solid ${L.line}` }} />}
                  <span style={{ fontSize: 12, fontWeight: 700, color: L.t2 }}>{vend ? vend.nome : "Sem responsável"}</span>
                  <Tag color={L.t4} bg={L.surface} small>{items.length}</Tag>
                </Row>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 32 }}>
                  {items.map(renderCard)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal title={editId ? "Editar Follow-up" : "Novo Follow-up"} onClose={() => setModal(false)} width={520}>
          <Field label="Título *"><Input value={form.titulo} onChange={F("titulo")} placeholder="Ex: Enviar proposta revisada" /></Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            <Field label="Lead vinculado">
              <Select value={form.lead_id} onChange={F("lead_id")}>
                <option value="">— nenhum —</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </Select>
            </Field>
            <Field label="Responsável">
              <Select value={form.responsavel_id} onChange={F("responsavel_id")}>
                <option value="">— atribuir —</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </Select>
            </Field>
            <Field label="Data e Hora *">
              <input type="datetime-local" value={form.agendado_para} onChange={e => F("agendado_para")(e.target.value)} style={{ width: "100%", background: L.surface, border: `1.5px solid ${L.line}`, borderRadius: 9, padding: "9px 12px", color: L.t1, fontSize: 12.5, fontFamily: "inherit", outline: "none" }} onFocus={e => e.target.style.borderColor = L.teal} onBlur={e => e.target.style.borderColor = L.line} />
            </Field>
            <Field label="Canal">
              <Select value={form.canal} onChange={F("canal")}>
                {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Prioridade">
              <Select value={form.prioridade} onChange={F("prioridade")}>
                {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Descrição"><Input value={form.descricao} onChange={F("descricao")} placeholder="Detalhes opcionais" /></Field>

          {form.canal === "WhatsApp" && (
            <Field label="Mensagem WhatsApp (pré-preenchida)">
              <textarea value={form.mensagem_whatsapp} onChange={e => F("mensagem_whatsapp")(e.target.value)} rows={2} placeholder={`Olá! Passando para dar continuidade...`} style={{ width: "100%", background: L.surface, border: `1.5px solid ${L.line}`, borderRadius: 9, padding: "9px 12px", color: L.t1, fontSize: 12.5, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
            </Field>
          )}

          {err && <div style={{ padding: "8px 12px", background: L.redBg, border: `1px solid ${L.red}22`, borderRadius: 8, fontSize: 12, color: L.red, marginBottom: 4 }}>{err}</div>}
          <ModalFooter onClose={() => setModal(false)} onSave={save} loading={saving} label={editId ? "Salvar" : "Criar Follow-up"} />
        </Modal>
      )}
    </Fade>
  );
}
