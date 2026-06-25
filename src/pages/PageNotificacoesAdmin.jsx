import { useState, useEffect, useCallback } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import Modal, { Field, Input } from "../components/Modal";
import { Fade } from "../components/ui";

const TIPOS = [
  { id: "info",    label: "Info",    bg: L.tealBg,   cor: L.teal,   ico: "ℹ" },
  { id: "sucesso", label: "Sucesso", bg: L.greenBg,  cor: L.green,  ico: "✓" },
  { id: "aviso",   label: "Aviso",   bg: L.yellowBg, cor: L.yellow, ico: "⚠" },
  { id: "alerta",  label: "Alerta",  bg: L.redBg,    cor: L.red,    ico: "✕" },
];

function tipoCfg(tipo) {
  return TIPOS.find(t => t.id === tipo) || TIPOS[0];
}

const EMPTY = { titulo: "", conteudo: "", tipo: "info", empresa_id: "", expires_at: "", ativo: true };

export default function PageNotificacoesAdmin({ user }) {
  const isAdmin = user?.role === "c4hub_admin";
  const [notifs, setNotifs]     = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // null | "create" | "edit"
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");
  const [filtro, setFiltro]     = useState("todos"); // todos | ativo | inativo

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notificacoes_sistema")
      .select("*, empresas(nome), usuarios!criado_por(nome)")
      .order("created_at", { ascending: false });
    setNotifs(data || []);
    setLoading(false);
  }, []);

  const fetchEmpresas = useCallback(async () => {
    const { data } = await supabase
      .from("empresas")
      .select("id, nome")
      .order("nome");
    setEmpresas(data || []);
  }, []);

  useEffect(() => {
    fetchNotifs();
    fetchEmpresas();
  }, [fetchNotifs, fetchEmpresas]);

  const openCreate = () => {
    setForm({ ...EMPTY, criado_por: user.id });
    setErr("");
    setModal("create");
  };

  const openEdit = (n) => {
    setForm({
      titulo:     n.titulo,
      conteudo:   n.conteudo || "",
      tipo:       n.tipo,
      empresa_id: n.empresa_id || "",
      expires_at: n.expires_at ? n.expires_at.slice(0, 16) : "",
      ativo:      n.ativo,
      _id:        n.id,
    });
    setErr("");
    setModal("edit");
  };

  const save = async () => {
    if (!form.titulo.trim()) { setErr("Título obrigatório."); return; }
    setSaving(true); setErr("");
    const payload = {
      titulo:     form.titulo.trim(),
      conteudo:   form.conteudo.trim() || null,
      tipo:       form.tipo,
      empresa_id: form.empresa_id || null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      ativo:      form.ativo,
    };
    let error;
    if (modal === "create") {
      ({ error } = await supabase.from("notificacoes_sistema").insert({ ...payload, criado_por: user.id }));
    } else {
      ({ error } = await supabase.from("notificacoes_sistema").update(payload).eq("id", form._id));
    }
    if (error) { setErr(error.message || "Erro ao salvar."); setSaving(false); return; }
    setModal(null);
    fetchNotifs();
    setSaving(false);
  };

  const toggleAtivo = async (n) => {
    await supabase.from("notificacoes_sistema").update({ ativo: !n.ativo }).eq("id", n.id);
    fetchNotifs();
  };

  const excluir = async (id) => {
    if (!confirm("Excluir esta notificação?")) return;
    await supabase.from("notificacoes_sistema").delete().eq("id", id);
    fetchNotifs();
  };

  const lista = notifs.filter(n =>
    filtro === "todos"  ? true :
    filtro === "ativo"  ? n.ativo :
    !n.ativo
  );

  const resumo = {
    total:  notifs.length,
    ativo:  notifs.filter(n => n.ativo).length,
    inativo: notifs.filter(n => !n.ativo).length,
  };

  return (
    <Fade>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 3, height: 20, borderRadius: 2, background: L.accent }} />
          <h1 style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Outfit',sans-serif", color: L.t1, letterSpacing: "-.3px" }}>
            Notificações do Sistema
          </h1>
        </div>
        <p style={{ fontSize: 12, color: L.t3, marginLeft: 13 }}>
          Crie avisos e comunicados visíveis para todos os usuários da plataforma.
        </p>
      </div>

      {/* Stats + actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "Total",    val: resumo.total,   cor: L.teal,   bg: L.tealBg },
            { label: "Ativas",   val: resumo.ativo,   cor: L.green,  bg: L.greenBg },
            { label: "Inativas", val: resumo.inativo, cor: L.t4,     bg: L.surface },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.cor}22`, borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.cor, fontFamily: "'Outfit',sans-serif" }}>{s.val}</div>
              <div style={{ fontSize: 10, color: L.t4, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>
        {isAdmin && (
          <button onClick={openCreate}
            style={{ background: L.accent, color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit", boxShadow: `0 4px 12px ${L.tealA2}` }}>
            <span style={{ fontSize: 16 }}>+</span> Nova Notificação
          </button>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {[["todos","Todos"],["ativo","Ativas"],["inativo","Inativas"]].map(([id, label]) => (
          <button key={id} onClick={() => setFiltro(id)}
            style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: filtro === id ? 700 : 400, cursor: "pointer", border: `1px solid ${filtro === id ? L.teal : L.line}`, background: filtro === id ? L.tealBg : L.white, color: filtro === id ? L.teal : L.t3, fontFamily: "inherit", transition: "all .12s" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: L.t4, fontSize: 13 }}>Carregando...</div>
      ) : lista.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔔</div>
          <div style={{ fontSize: 14, color: L.t3, fontWeight: 500 }}>Nenhuma notificação encontrada</div>
          {isAdmin && <div style={{ fontSize: 12, color: L.t4, marginTop: 6 }}>Clique em "Nova Notificação" para criar</div>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lista.map(n => {
            const tc = tipoCfg(n.tipo);
            const expirado = n.expires_at && new Date(n.expires_at) < new Date();
            return (
              <div key={n.id}
                style={{ background: L.white, border: `1px solid ${L.line}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 14, opacity: n.ativo && !expirado ? 1 : 0.6, transition: "box-shadow .12s" }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.07)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                {/* Tipo badge */}
                <div style={{ width: 36, height: 36, borderRadius: 9, background: tc.bg, border: `1px solid ${tc.cor}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: tc.cor, flexShrink: 0 }}>
                  {tc.ico}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: L.t1 }}>{n.titulo}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: tc.cor, background: tc.bg, border: `1px solid ${tc.cor}33`, borderRadius: 6, padding: "1px 7px", letterSpacing: "1px", textTransform: "uppercase" }}>{tc.label}</span>
                    {n.empresa_id ? (
                      <span style={{ fontSize: 10, color: L.copper, background: L.copperBg, border: `1px solid ${L.copperA}`, borderRadius: 6, padding: "1px 7px" }}>
                        {n.empresas?.nome || "Empresa específica"}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: L.teal, background: L.tealBg, border: `1px solid ${L.tealA2}`, borderRadius: 6, padding: "1px 7px" }}>Todos</span>
                    )}
                    {!n.ativo && <span style={{ fontSize: 10, color: L.t4, background: L.surface, border: `1px solid ${L.line}`, borderRadius: 6, padding: "1px 7px" }}>Inativa</span>}
                    {expirado && <span style={{ fontSize: 10, color: L.red, background: L.redBg, border: `1px solid ${L.redA}`, borderRadius: 6, padding: "1px 7px" }}>Expirada</span>}
                  </div>
                  {n.conteudo && <p style={{ fontSize: 12, color: L.t3, lineHeight: 1.5, marginBottom: 4 }}>{n.conteudo}</p>}
                  <div style={{ fontSize: 10, color: L.t4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span>Criado por {n.usuarios?.nome || "—"}</span>
                    <span>{new Date(n.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    {n.expires_at && <span>Expira {new Date(n.expires_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                  </div>
                </div>

                {/* Actions */}
                {isAdmin && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => toggleAtivo(n)} title={n.ativo ? "Desativar" : "Ativar"}
                      style={{ background: n.ativo ? L.greenBg : L.surface, border: `1px solid ${n.ativo ? L.greenA : L.line}`, borderRadius: 7, padding: "5px 9px", cursor: "pointer", fontSize: 13, color: n.ativo ? L.green : L.t4, transition: "all .12s" }}>
                      {n.ativo ? "✓" : "○"}
                    </button>
                    <button onClick={() => openEdit(n)} title="Editar"
                      style={{ background: L.tealBg, border: `1px solid ${L.tealA2}`, borderRadius: 7, padding: "5px 9px", cursor: "pointer", fontSize: 12, color: L.teal, transition: "all .12s" }}>
                      ✎
                    </button>
                    <button onClick={() => excluir(n.id)} title="Excluir"
                      style={{ background: L.redBg, border: `1px solid ${L.redA}`, borderRadius: 7, padding: "5px 9px", cursor: "pointer", fontSize: 13, color: L.red, transition: "all .12s" }}>
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal criar/editar */}
      {modal && (
        <Modal title={modal === "create" ? "Nova Notificação" : "Editar Notificação"} onClose={() => setModal(null)} width={520}>
          <Field label="Título" required>
            <Input value={form.titulo} onChange={v => setForm(f => ({ ...f, titulo: v }))} placeholder="Ex: Manutenção programada às 22h" />
          </Field>

          <Field label="Mensagem">
            <textarea
              value={form.conteudo}
              onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))}
              placeholder="Detalhes adicionais sobre a notificação..."
              rows={3}
              style={{ width: "100%", background: L.surface, border: `1.5px solid ${L.line}`, borderRadius: 9, padding: "9px 12px", color: L.t1, fontSize: 12.5, fontFamily: "inherit", outline: "none", resize: "vertical", lineHeight: 1.5 }}
            />
          </Field>

          <Field label="Tipo">
            <div style={{ display: "flex", gap: 8 }}>
              {TIPOS.map(t => (
                <button key={t.id} onClick={() => setForm(f => ({ ...f, tipo: t.id }))}
                  style={{ flex: 1, padding: "8px 6px", borderRadius: 9, border: `1.5px solid ${form.tipo === t.id ? t.cor : L.line}`, background: form.tipo === t.id ? t.bg : L.white, color: form.tipo === t.id ? t.cor : L.t3, cursor: "pointer", fontSize: 12, fontWeight: form.tipo === t.id ? 700 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, transition: "all .12s", fontFamily: "inherit" }}>
                  <span style={{ fontSize: 14 }}>{t.ico}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Destinatário">
            <select
              value={form.empresa_id}
              onChange={e => setForm(f => ({ ...f, empresa_id: e.target.value }))}
              style={{ width: "100%", background: L.surface, border: `1.5px solid ${L.line}`, borderRadius: 9, padding: "9px 12px", color: L.t1, fontSize: 12.5, fontFamily: "inherit", outline: "none" }}>
              <option value="">🌐 Todos os usuários</option>
              {empresas.map(e => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </Field>

          <Field label="Expiração (opcional)">
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
              style={{ width: "100%", background: L.surface, border: `1.5px solid ${L.line}`, borderRadius: 9, padding: "9px 12px", color: L.t1, fontSize: 12.5, fontFamily: "inherit", outline: "none" }}
            />
          </Field>

          <Field label="Status">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: L.t2 }}>
              <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} style={{ width: 15, height: 15 }} />
              Notificação ativa (visível para usuários)
            </label>
          </Field>

          {err && <div style={{ fontSize: 12, color: L.red, background: L.redBg, border: `1px solid ${L.redA}`, borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={() => setModal(null)}
              style={{ padding: "9px 18px", borderRadius: 9, border: `1px solid ${L.line}`, background: L.white, color: L.t2, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
              Cancelar
            </button>
            <button onClick={save} disabled={saving}
              style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: L.accent, color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Salvando..." : modal === "create" ? "Publicar" : "Salvar"}
            </button>
          </div>
        </Modal>
      )}
    </Fade>
  );
}
