import { useState, useEffect, useCallback } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Row } from "../components/ui";

const CORES = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#6b7280"];

const inp = (extra = {}) => ({
  background: L.surface, border: `1px solid ${L.line}`, borderRadius: 8,
  padding: "8px 11px", fontSize: 12.5, color: L.t1, fontFamily: "inherit",
  outline: "none", width: "100%", boxSizing: "border-box", ...extra,
});

const btn = (bg = L.accent, color = "white", extra = {}) => ({
  background: bg, color, border: `1px solid ${bg === L.surface ? L.line : bg}`,
  borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit", transition: "all .12s", ...extra,
});

function Passo({ passo, idx, total, onChange, onDelete, onMove }) {
  const [open, setOpen] = useState(idx === 0);

  return (
    <div style={{ background: L.white, border: `1px solid ${L.line}`, borderRadius: 10,
      marginBottom: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      {/* Header do passo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8,
        padding: "10px 12px", cursor: "pointer", userSelect: "none" }}
        onClick={() => setOpen(p => !p)}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: L.tealBg,
          border: `1px solid ${L.tealA2}`, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 10, fontWeight: 700, color: L.teal, flexShrink: 0 }}>
          {idx + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: L.t1,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {passo.titulo || `Passo ${idx + 1}`}
          </div>
          {!open && passo.mensagem && (
            <div style={{ fontSize: 10.5, color: L.t3,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {passo.mensagem.slice(0, 80)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); onMove(idx, -1); }}
            disabled={idx === 0}
            style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer",
              color: L.t4, fontSize: 13, padding: "2px 4px", opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
          <button onClick={e => { e.stopPropagation(); onMove(idx, 1); }}
            disabled={idx === total - 1}
            style={{ background: "none", border: "none", cursor: idx === total - 1 ? "default" : "pointer",
              color: L.t4, fontSize: 13, padding: "2px 4px", opacity: idx === total - 1 ? 0.3 : 1 }}>↓</button>
          <button onClick={e => { e.stopPropagation(); onDelete(idx); }}
            style={{ background: "none", border: "none", cursor: "pointer",
              color: L.red, fontSize: 14, padding: "2px 4px", lineHeight: 1 }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>×</button>
          <span style={{ color: L.t4, fontSize: 12, padding: "2px 4px" }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Corpo expandido */}
      {open && (
        <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${L.lineSoft}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: L.t4, fontWeight: 700, letterSpacing: "1px",
                textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", display: "block", marginBottom: 4 }}>
                Título do passo
              </label>
              <input value={passo.titulo} onChange={e => onChange(idx, "titulo", e.target.value)}
                placeholder={`Passo ${idx + 1}`} style={inp()} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: L.t4, fontWeight: 700, letterSpacing: "1px",
                textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", display: "block", marginBottom: 4 }}>
                Mensagem a enviar
              </label>
              <textarea value={passo.mensagem} onChange={e => onChange(idx, "mensagem", e.target.value)}
                placeholder="Digite a mensagem que será enviada ao cliente..."
                rows={4}
                style={{ ...inp(), resize: "vertical", lineHeight: 1.5, minHeight: 90 }} />
              <div style={{ fontSize: 10, color: L.t4, marginTop: 3 }}>
                Variáveis: {"{nome}"}, {"{telefone}"}, {"{empresa}"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalFluxo({ user, fluxo, vendedores, onClose, onSaved }) {
  const isNew = !fluxo;
  const [form, setForm] = useState({
    nome: fluxo?.nome || "",
    descricao: fluxo?.descricao || "",
    usuario_id: fluxo?.usuario_id || null,
    ativo: fluxo?.ativo ?? true,
    cor: fluxo?.cor || "#6366f1",
  });
  const [passos, setPassos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!fluxo?.id) return;
    supabase.from("fluxos_passos")
      .select("*").eq("fluxo_id", fluxo.id).order("ordem")
      .then(({ data }) => setPassos(data || []));
  }, [fluxo?.id]);

  const addPasso = () => setPassos(p => [...p, {
    id: `new-${Date.now()}`, fluxo_id: fluxo?.id || null,
    ordem: p.length, titulo: "", mensagem: "", tipo: "texto",
  }]);

  const changePasso = (idx, field, val) =>
    setPassos(p => p.map((ps, i) => i === idx ? { ...ps, [field]: val } : ps));

  const deletePasso = (idx) => setPassos(p => p.filter((_, i) => i !== idx));

  const movePasso = (idx, dir) => {
    const next = idx + dir;
    if (next < 0 || next >= passos.length) return;
    setPassos(p => {
      const arr = [...p];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const save = async () => {
    if (!form.nome.trim()) { setErr("Informe o nome do fluxo."); return; }
    setSaving(true); setErr("");
    try {
      let fluxoId = fluxo?.id;
      const payload = {
        empresa_id: user.empresa_id,
        nome: form.nome.trim(),
        descricao: form.descricao.trim(),
        usuario_id: form.usuario_id || null,
        ativo: form.ativo,
        cor: form.cor,
      };

      if (isNew) {
        const { data, error } = await supabase.from("fluxos_vendedor").insert(payload).select().single();
        if (error) throw error;
        fluxoId = data.id;
      } else {
        const { error } = await supabase.from("fluxos_vendedor").update(payload).eq("id", fluxoId);
        if (error) throw error;
        await supabase.from("fluxos_passos").delete().eq("fluxo_id", fluxoId);
      }

      if (passos.length > 0) {
        const rows = passos.map((ps, i) => ({
          fluxo_id: fluxoId,
          ordem: i,
          titulo: ps.titulo || `Passo ${i + 1}`,
          mensagem: ps.mensagem,
          tipo: ps.tipo || "texto",
        }));
        const { error } = await supabase.from("fluxos_passos").insert(rows);
        if (error) throw error;
      }

      onSaved();
    } catch (e) {
      setErr(e.message || "Erro ao salvar.");
    }
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={() => { if (!saving) onClose(); }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: L.white, borderRadius: 16, width: "100%", maxWidth: 620,
          maxHeight: "90vh", display: "flex", flexDirection: "column",
          boxShadow: "0 12px 48px rgba(0,0,0,.22)" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${L.line}`,
          display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: form.cor + "22",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
            📋
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: L.t1 }}>
              {isNew ? "Novo fluxo de vendas" : "Editar fluxo"}
            </div>
            <div style={{ fontSize: 11, color: L.t3 }}>Configure a sequência de mensagens</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none",
            cursor: "pointer", color: L.t4, fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {/* Nome e tipo */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 10, color: L.t4, fontWeight: 700, letterSpacing: "1px",
                textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", display: "block", marginBottom: 4 }}>
                Nome do fluxo *
              </label>
              <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Apresentação inicial" style={inp()} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: L.t4, fontWeight: 700, letterSpacing: "1px",
                textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", display: "block", marginBottom: 4 }}>
                Atribuir a
              </label>
              <select value={form.usuario_id || ""} onChange={e => setForm(p => ({ ...p, usuario_id: e.target.value || null }))}
                style={{ ...inp(), cursor: "pointer" }}>
                <option value="">Empresa (todos os vendedores)</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 10, color: L.t4, fontWeight: 700, letterSpacing: "1px",
              textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", display: "block", marginBottom: 4 }}>
              Descrição (opcional)
            </label>
            <input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
              placeholder="Ex: Fluxo para primeiro contato com leads" style={inp()} />
          </div>

          {/* Cor */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 10, color: L.t4, fontWeight: 700, letterSpacing: "1px",
              textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", display: "block", marginBottom: 6 }}>
              Cor do fluxo
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CORES.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, cor: c }))}
                  style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: "none",
                    cursor: "pointer", outline: form.cor === c ? `3px solid ${c}` : "none",
                    outlineOffset: 2, transition: "outline .1s" }} />
              ))}
            </div>
          </div>

          {/* Ativo */}
          <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setForm(p => ({ ...p, ativo: !p.ativo }))}
              style={{ ...btn(form.ativo ? L.greenBg : L.surface, form.ativo ? L.green : L.t3), fontSize: 11 }}>
              {form.ativo ? "✓ Ativo" : "○ Inativo"}
            </button>
            <span style={{ fontSize: 11, color: L.t4 }}>
              {form.ativo ? "Vendedores verão este fluxo no chat" : "Fluxo desativado — não aparece no chat"}
            </span>
          </div>

          {/* Passos */}
          <div style={{ borderTop: `1px solid ${L.line}`, paddingTop: 16, marginTop: 4 }}>
            <Row between style={{ marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: L.t1 }}>
                  Passos da conversa ({passos.length})
                </div>
                <div style={{ fontSize: 11, color: L.t3 }}>
                  Cada passo é uma mensagem que o vendedor pode enviar com um clique
                </div>
              </div>
              <button onClick={addPasso} style={btn(L.accent, "white", { fontSize: 11 })}>
                + Adicionar passo
              </button>
            </Row>

            {passos.length === 0 && (
              <div style={{ textAlign: "center", padding: "28px 0", background: L.surface,
                borderRadius: 10, border: `1px dashed ${L.line}` }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📝</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: L.t2, marginBottom: 4 }}>Nenhum passo ainda</div>
                <div style={{ fontSize: 11, color: L.t4 }}>Clique em "Adicionar passo" para criar a primeira mensagem</div>
              </div>
            )}

            {passos.map((ps, i) => (
              <Passo key={ps.id} passo={ps} idx={i} total={passos.length}
                onChange={changePasso} onDelete={deletePasso} onMove={movePasso} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${L.line}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          {err && <div style={{ fontSize: 11, color: L.red }}>{err}</div>}
          {!err && <div />}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={btn(L.surface, L.t2)} disabled={saving}>Cancelar</button>
            <button onClick={save} style={btn(L.accent, "white")} disabled={saving}>
              {saving ? "Salvando..." : isNew ? "Criar fluxo" : "Salvar alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FluxoCard({ fluxo, onEdit, onDelete, onToggle }) {
  const [passosCount, setPassosCount] = useState(0);

  useEffect(() => {
    supabase.from("fluxos_passos").select("id", { count: "exact", head: true })
      .eq("fluxo_id", fluxo.id)
      .then(({ count }) => setPassosCount(count || 0));
  }, [fluxo.id]);

  return (
    <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`,
      padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      transition: "box-shadow .15s, border-color .15s", cursor: "default" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = fluxo.cor + "66"; e.currentTarget.style.boxShadow = `0 4px 16px ${fluxo.cor}22`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = L.line; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)"; }}>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: fluxo.cor + "18",
          border: `1.5px solid ${fluxo.cor}33`, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          📋
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: L.t1,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {fluxo.nome}
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5,
              background: fluxo.ativo ? L.greenBg : L.surface,
              color: fluxo.ativo ? L.green : L.t4,
              border: `1px solid ${fluxo.ativo ? L.greenA : L.line}`,
              flexShrink: 0 }}>
              {fluxo.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
          {fluxo.descricao && (
            <div style={{ fontSize: 11, color: L.t3, marginBottom: 6, lineHeight: 1.4 }}>
              {fluxo.descricao}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: L.t4, background: L.surface,
              border: `1px solid ${L.line}`, borderRadius: 5, padding: "2px 7px" }}>
              {passosCount} {passosCount === 1 ? "passo" : "passos"}
            </span>
            <span style={{ fontSize: 10, borderRadius: 5, padding: "2px 8px",
              background: fluxo.usuario_id ? L.tealBg : L.yellowBg,
              color: fluxo.usuario_id ? L.teal : L.yellow,
              border: `1px solid ${fluxo.usuario_id ? L.tealA2 : L.yellowA}` }}>
              {fluxo.usuario_id ? `👤 ${fluxo._usuario_nome || "Vendedor específico"}` : "🏢 Toda a empresa"}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 12, paddingTop: 10,
        borderTop: `1px solid ${L.lineSoft}` }}>
        <button onClick={() => onEdit(fluxo)} style={btn(L.surface, L.t2, { fontSize: 11, flex: 1 })}>
          ✎ Editar
        </button>
        <button onClick={() => onToggle(fluxo)}
          style={btn(fluxo.ativo ? L.yellowBg : L.greenBg, fluxo.ativo ? L.yellow : L.green, { fontSize: 11, flex: 1 })}>
          {fluxo.ativo ? "⏸ Pausar" : "▶ Ativar"}
        </button>
        <button onClick={() => onDelete(fluxo.id)}
          style={btn(L.redBg, L.red, { fontSize: 11, padding: "6px 10px" })}>
          🗑
        </button>
      </div>
    </div>
  );
}

export default function PageFluxosVendedor({ user }) {
  const [fluxos, setFluxos]         = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null); // null | "new" | fluxo
  const [filtro, setFiltro]         = useState("todos"); // "todos" | "empresa" | "vendedor"

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: fxs }, { data: vends }] = await Promise.all([
      supabase.from("fluxos_vendedor").select("*").eq("empresa_id", user.empresa_id).order("created_at", { ascending: false }),
      supabase.from("usuarios").select("id, nome").eq("empresa_id", user.empresa_id).order("nome"),
    ]);
    const vendMap = Object.fromEntries((vends || []).map(v => [v.id, v.nome]));
    const enriched = (fxs || []).map(f => ({ ...f, _usuario_nome: vendMap[f.usuario_id] || null }));
    setFluxos(enriched);
    setVendedores(vends || []);
    setLoading(false);
  }, [user.empresa_id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!confirm("Excluir este fluxo e todos os seus passos?")) return;
    await supabase.from("fluxos_vendedor").delete().eq("id", id);
    setFluxos(p => p.filter(f => f.id !== id));
  };

  const handleToggle = async (fluxo) => {
    const novoAtivo = !fluxo.ativo;
    await supabase.from("fluxos_vendedor").update({ ativo: novoAtivo }).eq("id", fluxo.id);
    setFluxos(p => p.map(f => f.id === fluxo.id ? { ...f, ativo: novoAtivo } : f));
  };

  const filtrados = fluxos.filter(f => {
    if (filtro === "empresa")  return !f.usuario_id;
    if (filtro === "vendedor") return !!f.usuario_id;
    return true;
  });

  const empresaFluxos  = filtrados.filter(f => !f.usuario_id);
  const vendedorFluxos = filtrados.filter(f => !!f.usuario_id);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: L.t1, fontFamily: "'Outfit',sans-serif",
            letterSpacing: "-.3px", marginBottom: 4 }}>
            📋 Scripts de Venda
          </div>
          <div style={{ fontSize: 13, color: L.t3 }}>
            Crie sequências de mensagens para vendedores enviarem durante atendimentos no WhatsApp
          </div>
        </div>
        <button onClick={() => setModal("new")} style={btn(L.accent, "white", { fontSize: 13, padding: "9px 20px" })}>
          + Novo fluxo
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[["todos","Todos"], ["empresa","Da empresa"], ["vendedor","Por vendedor"]].map(([id, label]) => (
          <button key={id} onClick={() => setFiltro(id)}
            style={{ ...btn(filtro === id ? L.tealBg : L.surface, filtro === id ? L.teal : L.t3), fontSize: 11,
              border: `1px solid ${filtro === id ? L.tealA2 : L.line}` }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: L.t4 }}>Carregando fluxos...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", background: L.white,
          borderRadius: 16, border: `1px dashed ${L.line}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: L.t2, marginBottom: 6 }}>Nenhum fluxo criado</div>
          <div style={{ fontSize: 12, color: L.t4, marginBottom: 20 }}>
            Crie scripts de venda para seus vendedores enviarem no WhatsApp
          </div>
          <button onClick={() => setModal("new")} style={btn(L.accent, "white")}>
            + Criar primeiro fluxo
          </button>
        </div>
      ) : (
        <div>
          {(filtro === "todos" || filtro === "empresa") && empresaFluxos.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: L.t4, textTransform: "uppercase",
                letterSpacing: "1.5px", fontFamily: "'JetBrains Mono',monospace",
                marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: L.yellow, display: "inline-block" }} />
                Fluxos da empresa — visível para todos os vendedores
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {empresaFluxos.map(f => (
                  <FluxoCard key={f.id} fluxo={f} onEdit={setModal} onDelete={handleDelete} onToggle={handleToggle} />
                ))}
              </div>
            </div>
          )}
          {(filtro === "todos" || filtro === "vendedor") && vendedorFluxos.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: L.t4, textTransform: "uppercase",
                letterSpacing: "1.5px", fontFamily: "'JetBrains Mono',monospace",
                marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: L.teal, display: "inline-block" }} />
                Fluxos por vendedor — apenas para o vendedor atribuído
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {vendedorFluxos.map(f => (
                  <FluxoCard key={f.id} fluxo={f} onEdit={setModal} onDelete={handleDelete} onToggle={handleToggle} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info card */}
      <div style={{ marginTop: 28, padding: "14px 18px", background: L.tealBg,
        borderRadius: 10, border: `1px solid ${L.tealA2}`, display: "flex", gap: 12 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
        <div style={{ fontSize: 11.5, color: L.teal, lineHeight: 1.6 }}>
          <strong>Como funciona:</strong> No atendimento WhatsApp, o vendedor abre a aba <strong>"Script"</strong> no painel direito.
          O sistema exibe o fluxo pessoal do vendedor (se tiver) ou o fluxo geral da empresa.
          Cada passo aparece como um botão — o vendedor clica em <strong>"Enviar"</strong> e a mensagem vai direto para o cliente.
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <ModalFluxo
          user={user}
          fluxo={modal === "new" ? null : modal}
          vendedores={vendedores}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
