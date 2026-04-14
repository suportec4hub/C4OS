import { useState, useEffect } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Row } from "../components/ui";

const CORES = ["#6b7280","#2563eb","#16a34a","#dc2626","#ca8a04","#7c3aed","#db2777","#0891b2","#ea580c","#65a30d","#f97316","#14b8a6"];
const btn = (bg = L.surface, color = L.t2, extra = {}) => ({
  background: bg, color, border: `1px solid ${L.line}`, borderRadius: 8,
  padding: "7px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  fontWeight: 500, transition: "all .12s", ...extra,
});

const VAZIO = { nome: "", cor: CORES[0] };

export default function PageEtiquetas({ user }) {
  const [etiquetas, setEtiquetas] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState(VAZIO);
  const [editId,    setEditId]    = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");

  const load = async () => {
    if (!user?.empresa_id) return;
    setLoading(true);
    const { data } = await supabase.from("etiquetas").select("*")
      .eq("empresa_id", user.empresa_id).order("created_at");
    setEtiquetas(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.empresa_id]);

  const openNew  = () => { setForm(VAZIO); setEditId(null); setErr(""); setModal(true); };
  const openEdit = (e) => { setForm({ nome: e.nome, cor: e.cor }); setEditId(e.id); setErr(""); setModal(true); };

  const save = async () => {
    if (!form.nome.trim()) { setErr("Nome obrigatório."); return; }
    setSaving(true); setErr("");
    const payload = { nome: form.nome.trim(), cor: form.cor, empresa_id: user.empresa_id };
    if (editId) {
      const { error } = await supabase.from("etiquetas").update(payload).eq("id", editId);
      if (error) { setErr(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("etiquetas").insert({ ...payload, ativo: true });
      if (error) { setErr(error.message); setSaving(false); return; }
    }
    setSaving(false); setModal(false); load();
  };

  const toggleAtivo = async (e) => {
    await supabase.from("etiquetas").update({ ativo: !e.ativo }).eq("id", e.id);
    setEtiquetas(p => p.map(x => x.id === e.id ? { ...x, ativo: !x.ativo } : x));
  };

  const deletar = async (id) => {
    if (!window.confirm("Remover etiqueta? Ela será removida de todas as conversas.")) return;
    await supabase.from("etiquetas").delete().eq("id", id);
    setEtiquetas(p => p.filter(x => x.id !== id));
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <Row between mb={20}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: L.t1 }}>Etiquetas</div>
          <div style={{ fontSize: 12, color: L.t3, marginTop: 2 }}>
            Categorize conversas com etiquetas coloridas para filtragem rápida
          </div>
        </div>
        <button onClick={openNew} style={btn(L.t1, "white")}>+ Nova etiqueta</button>
      </Row>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: L.t4 }}>Carregando...</div>
      ) : etiquetas.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: L.t4 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏷️</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Nenhuma etiqueta criada</div>
          <div style={{ fontSize: 12, marginBottom: 20 }}>
            Crie etiquetas como "VIP", "Urgente", "Follow-up" para organizar suas conversas.
          </div>
          <button onClick={openNew} style={btn(L.t1, "white")}>+ Criar primeira etiqueta</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {etiquetas.map(e => (
            <div key={e.id} style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`,
              padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
              <Row between mb={8}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: e.cor, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: L.t1 }}>{e.nome}</span>
                </div>
                <span style={{ fontSize: 9, background: e.ativo ? L.greenBg : L.surface,
                  color: e.ativo ? L.green : L.t3, padding: "1px 6px", borderRadius: 8, fontWeight: 600 }}>
                  {e.ativo ? "Ativa" : "Inativa"}
                </span>
              </Row>

              {/* Preview badge */}
              <div style={{ marginBottom: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", background: e.cor + "22",
                  color: e.cor, border: `1px solid ${e.cor}44`, borderRadius: 10,
                  padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                  {e.nome}
                </span>
              </div>

              <Row gap={5}>
                <button onClick={() => openEdit(e)} style={btn(L.surface, L.t2, { padding: "4px 10px", fontSize: 11, flex: 1 })}>
                  ✎ Editar
                </button>
                <button onClick={() => toggleAtivo(e)}
                  style={btn(e.ativo ? L.yellowBg : L.greenBg, e.ativo ? L.yellow : L.green, { padding: "4px 8px", fontSize: 11 })}>
                  {e.ativo ? "⏸" : "▶"}
                </button>
                <button onClick={() => deletar(e.id)} style={btn(L.redBg, L.red, { padding: "4px 8px", fontSize: 11 })}>
                  ✕
                </button>
              </Row>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}
            style={{ background: L.white, borderRadius: 12, padding: 24, width: 380, boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: L.t1, marginBottom: 16 }}>
              {editId ? "Editar etiqueta" : "Nova etiqueta"}
            </div>

            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>Nome *</label>
            <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: VIP, Urgente, Follow-up..."
              style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 12px",
                fontSize: 12, color: L.t1, background: L.white, outline: "none", fontFamily: "inherit",
                boxSizing: "border-box", marginBottom: 14 }} />

            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 6 }}>Cor</label>
            <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
              {CORES.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, cor: c }))}
                  style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: "none",
                    cursor: "pointer", outline: form.cor === c ? `3px solid ${c}` : "none",
                    outlineOffset: 2, transition: "outline .1s" }} />
              ))}
            </div>

            {/* Preview */}
            {form.nome && (
              <div style={{ marginBottom: 14, padding: "8px 12px", background: L.surface, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: L.t4, marginBottom: 6 }}>PRÉVIA</div>
                <span style={{ display: "inline-flex", alignItems: "center", background: form.cor + "22",
                  color: form.cor, border: `1px solid ${form.cor}44`, borderRadius: 10,
                  padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                  {form.nome}
                </span>
              </div>
            )}

            {err && <div style={{ color: L.red, fontSize: 11, marginBottom: 10 }}>{err}</div>}

            <Row gap={8} style={{ justifyContent: "flex-end" }}>
              <button onClick={() => setModal(false)} style={btn()}>Cancelar</button>
              <button onClick={save} disabled={saving} style={btn(L.t1, "white")}>
                {saving ? "Salvando..." : editId ? "Salvar" : "Criar etiqueta"}
              </button>
            </Row>
          </div>
        </div>
      )}
    </div>
  );
}
