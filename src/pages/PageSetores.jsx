import { useState, useEffect } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Row } from "../components/ui";

const CORES = ["#6b7280","#2563eb","#16a34a","#dc2626","#ca8a04","#7c3aed","#db2777","#0891b2","#ea580c","#65a30d"];
const ICONES = ["◈","🏢","👥","💼","🛠️","📞","💬","⭐","🔧","📋"];

const btn = (bg = L.surface, color = L.t2, extra = {}) => ({
  background: bg, color, border: `1px solid ${L.line}`, borderRadius: 8,
  padding: "7px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  fontWeight: 500, transition: "all .12s", ...extra,
});

const inp = (extra = {}) => ({
  width: "100%", border: `1px solid ${L.line}`, borderRadius: 8,
  padding: "8px 12px", fontSize: 12, color: L.t1, background: L.white,
  outline: "none", fontFamily: "inherit", boxSizing: "border-box", ...extra,
});

const VAZIO = { nome: "", descricao: "", cor: CORES[0], icone: ICONES[0], ativo: true };

export default function PageSetores({ user }) {
  const [setores,   setSetores]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState(VAZIO);
  const [editId,    setEditId]    = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");
  const [usuarios,  setUsuarios]  = useState([]);
  const [membros,   setMembros]   = useState({}); // setor_id → [usuario_id]
  const [expandido, setExpandido] = useState(null);

  const load = async () => {
    if (!user?.empresa_id) return;
    setLoading(true);
    const { data: sts } = await supabase.from("setores").select("*")
      .eq("empresa_id", user.empresa_id).order("ordem");
    setSetores(sts || []);

    const { data: usrs } = await supabase.from("usuarios").select("id, nome, foto_url, cargo")
      .eq("empresa_id", user.empresa_id).eq("ativo", true);
    setUsuarios(usrs || []);

    if (sts?.length) {
      const ids = sts.map(s => s.id);
      const { data: su } = await supabase.from("setor_usuarios").select("setor_id, usuario_id").in("setor_id", ids);
      const map = {};
      ids.forEach(id => { map[id] = []; });
      (su || []).forEach(r => { if (map[r.setor_id]) map[r.setor_id].push(r.usuario_id); });
      setMembros(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.empresa_id]);

  const openNew = () => { setForm(VAZIO); setEditId(null); setErr(""); setModal(true); };
  const openEdit = (s) => {
    setForm({ nome: s.nome, descricao: s.descricao || "", cor: s.cor || CORES[0], icone: s.icone || ICONES[0], ativo: s.ativo });
    setEditId(s.id); setErr(""); setModal(true);
  };

  const save = async () => {
    if (!form.nome.trim()) { setErr("Nome obrigatório."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, nome: form.nome.trim(), empresa_id: user.empresa_id };
    if (editId) {
      const { error } = await supabase.from("setores").update(payload).eq("id", editId);
      if (error) { setErr(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("setores").insert({ ...payload, ordem: setores.length });
      if (error) { setErr(error.message); setSaving(false); return; }
    }
    setSaving(false); setModal(false); load();
  };

  const toggleAtivo = async (s) => {
    await supabase.from("setores").update({ ativo: !s.ativo }).eq("id", s.id);
    setSetores(p => p.map(x => x.id === s.id ? { ...x, ativo: !x.ativo } : x));
  };

  const deletar = async (id) => {
    if (!window.confirm("Remover setor? As conversas neste setor não serão excluídas.")) return;
    await supabase.from("setores").delete().eq("id", id);
    setSetores(p => p.filter(x => x.id !== id));
  };

  const toggleMembro = async (setorId, usuarioId) => {
    const atual = membros[setorId] || [];
    const tem = atual.includes(usuarioId);
    if (tem) {
      await supabase.from("setor_usuarios").delete().eq("setor_id", setorId).eq("usuario_id", usuarioId);
      setMembros(p => ({ ...p, [setorId]: p[setorId].filter(x => x !== usuarioId) }));
    } else {
      await supabase.from("setor_usuarios").insert({ setor_id: setorId, usuario_id: usuarioId });
      setMembros(p => ({ ...p, [setorId]: [...(p[setorId] || []), usuarioId] }));
    }
  };

  const totalConvs = {}; // would need a count query — simplified for now

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* Header */}
      <Row between mb={20}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: L.t1 }}>Setores de Atendimento</div>
          <div style={{ fontSize: 12, color: L.t3, marginTop: 2 }}>
            Organize seu time em setores e roteie conversas automaticamente
          </div>
        </div>
        <button onClick={openNew} style={btn(L.t1, "white")}>+ Novo Setor</button>
      </Row>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: L.t4 }}>Carregando...</div>
      ) : setores.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: L.t4 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Nenhum setor criado</div>
          <div style={{ fontSize: 12, marginBottom: 20 }}>
            Crie setores como "Vendas", "Suporte", "Financeiro" e atribua atendentes a cada um.
          </div>
          <button onClick={openNew} style={btn(L.t1, "white")}>+ Criar primeiro setor</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {setores.map(s => {
            const mems = (membros[s.id] || []).map(uid => usuarios.find(u => u.id === uid)).filter(Boolean);
            const isExp = expandido === s.id;
            return (
              <div key={s.id} style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`,
                overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                {/* Row principal */}
                <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Ícone colorido */}
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: s.cor + "22",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, flexShrink: 0, border: `1px solid ${s.cor}33` }}>
                    {s.icone || "◈"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Row gap={8}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: L.t1 }}>{s.nome}</span>
                      <span style={{ fontSize: 10, background: s.ativo ? L.greenBg : L.surface,
                        color: s.ativo ? L.green : L.t3, padding: "1px 7px", borderRadius: 10,
                        fontWeight: 600, border: `1px solid ${s.ativo ? L.green + "33" : L.line}` }}>
                        {s.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </Row>
                    {s.descricao && (
                      <div style={{ fontSize: 11, color: L.t3, marginTop: 2 }}>{s.descricao}</div>
                    )}
                    <div style={{ fontSize: 11, color: L.t4, marginTop: 4 }}>
                      {mems.length} {mems.length === 1 ? "atendente" : "atendentes"}
                      {mems.length > 0 && ` · ${mems.slice(0, 3).map(m => m.nome.split(" ")[0]).join(", ")}${mems.length > 3 ? ` +${mems.length - 3}` : ""}`}
                    </div>
                  </div>

                  <Row gap={6} style={{ flexShrink: 0 }}>
                    <button onClick={() => setExpandido(isExp ? null : s.id)}
                      style={btn(isExp ? L.tealBg : L.surface, isExp ? L.t1 : L.t3, { padding: "5px 10px", fontSize: 11 })}>
                      {isExp ? "▲ Fechar" : "▼ Atendentes"}
                    </button>
                    <button onClick={() => openEdit(s)} style={btn(L.surface, L.t2, { padding: "5px 10px" })}>✎</button>
                    <button onClick={() => toggleAtivo(s)}
                      style={btn(s.ativo ? L.yellowBg : L.greenBg, s.ativo ? L.yellow : L.green, { padding: "5px 10px", fontSize: 11 })}>
                      {s.ativo ? "Pausar" : "Ativar"}
                    </button>
                    <button onClick={() => deletar(s.id)} style={btn(L.redBg, L.red, { padding: "5px 10px" })}>✕</button>
                  </Row>
                </div>

                {/* Painel de atendentes */}
                {isExp && (
                  <div style={{ padding: "12px 18px", borderTop: `1px solid ${L.lineSoft}`, background: L.bgWarm }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: L.t2, marginBottom: 10 }}>
                      Atendentes do setor — clique para adicionar/remover:
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {usuarios.map(u => {
                        const ativo = (membros[s.id] || []).includes(u.id);
                        return (
                          <button key={u.id} onClick={() => toggleMembro(s.id, u.id)}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px",
                              borderRadius: 20, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                              background: ativo ? L.t1 : L.white, color: ativo ? "white" : L.t2,
                              border: `1px solid ${ativo ? L.t1 : L.line}`, transition: "all .12s" }}>
                            <div style={{ width: 20, height: 20, borderRadius: "50%", background: ativo ? "rgba(255,255,255,.2)" : L.surface,
                              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                              {u.nome.charAt(0).toUpperCase()}
                            </div>
                            {u.nome.split(" ")[0]}
                            {ativo && " ✓"}
                          </button>
                        );
                      })}
                      {usuarios.length === 0 && (
                        <div style={{ fontSize: 11, color: L.t4 }}>Nenhum usuário cadastrado.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}
            style={{ background: L.white, borderRadius: 12, padding: 24, width: 440, boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: L.t1, marginBottom: 16 }}>
              {editId ? "Editar setor" : "Novo setor"}
            </div>

            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>Nome *</label>
            <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Vendas, Suporte, Financeiro..."
              style={{ ...inp(), marginBottom: 12 }} />

            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>Descrição</label>
            <input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
              placeholder="Descrição opcional..."
              style={{ ...inp(), marginBottom: 12 }} />

            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 6 }}>Cor</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {CORES.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, cor: c }))}
                  style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: "none",
                    cursor: "pointer", outline: form.cor === c ? `3px solid ${c}` : "none",
                    outlineOffset: 2, transition: "outline .1s" }} />
              ))}
            </div>

            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 6 }}>Ícone</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {ICONES.map(ico => (
                <button key={ico} onClick={() => setForm(p => ({ ...p, icone: ico }))}
                  style={{ width: 34, height: 34, borderRadius: 8, fontSize: 16, background: form.icone === ico ? L.tealBg : L.surface,
                    border: `1px solid ${form.icone === ico ? L.t1 : L.line}`, cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center" }}>
                  {ico}
                </button>
              ))}
            </div>

            {err && <div style={{ color: L.red, fontSize: 11, marginBottom: 10 }}>{err}</div>}

            <Row gap={8} style={{ justifyContent: "flex-end" }}>
              <button onClick={() => setModal(false)} style={btn()}>Cancelar</button>
              <button onClick={save} disabled={saving} style={btn(L.t1, "white")}>
                {saving ? "Salvando..." : editId ? "Salvar" : "Criar setor"}
              </button>
            </Row>
          </div>
        </div>
      )}
    </div>
  );
}
