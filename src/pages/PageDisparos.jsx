import { useState, useEffect, useRef } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Row } from "../components/ui";

const btn = (bg = L.surface, color = L.t2, extra = {}) => ({
  background: bg, color, border: `1px solid ${L.line}`, borderRadius: 8,
  padding: "7px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  fontWeight: 500, transition: "all .12s", ...extra,
});

const ST = {
  rascunho:  { c: L.t3,    bg: L.surface,  label: "Rascunho"  },
  agendado:  { c: L.blue,  bg: L.blueBg,   label: "Agendado"  },
  enviando:  { c: L.yellow,bg: L.yellowBg, label: "Enviando"  },
  concluido: { c: L.green, bg: L.greenBg,  label: "Concluído" },
  cancelado: { c: L.red,   bg: L.redBg,    label: "Cancelado" },
};

const VARIAVEIS = ["{nome}", "{empresa}", "{telefone}"];

const VAZIO = { titulo: "", mensagem: "", intervalo_min: 5, intervalo_max: 15, agendado_para: "" };

export default function PageDisparos({ user }) {
  const [tab,       setTab]       = useState("nova");
  const [campanhas, setCampanhas] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [form,      setForm]      = useState(VAZIO);
  const [contatos,  setContatos]  = useState([]); // [{nome, telefone}]
  const [csvErr,    setCsvErr]    = useState("");
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");
  const [succ,      setSucc]      = useState("");
  const [progress,  setProgress]  = useState(null); // {enviados, total}
  const [enviandoId,setEnviandoId]= useState(null);
  const [wppContatos, setWppContatos] = useState([]);
  const [wppModal,    setWppModal]    = useState(false);
  const [wppLoading,  setWppLoading]  = useState(false);
  const [wppSelecionados, setWppSelecionados] = useState([]);
  const fileRef   = useRef(null);
  const pollRef   = useRef(null);

  const load = async () => {
    if (!user?.empresa_id) return;
    setLoading(true);
    const { data } = await supabase.from("campanhas").select("*")
      .eq("empresa_id", user.empresa_id).order("created_at", { ascending: false });
    setCampanhas(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.empresa_id]);

  // Poll progresso de envio
  useEffect(() => {
    if (!enviandoId) { clearInterval(pollRef.current); return; }
    pollRef.current = setInterval(async () => {
      const { data } = await supabase.from("campanhas").select("enviados, total_contatos, status").eq("id", enviandoId).single();
      if (data) {
        setProgress({ enviados: data.enviados, total: data.total_contatos });
        load();
        if (data.status !== "enviando") {
          clearInterval(pollRef.current);
          setEnviandoId(null);
          setSucc("Disparo concluído! ✓");
          setProgress(null);
          setTimeout(() => setSucc(""), 4000);
        }
      }
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [enviandoId]);

  // Parse CSV
  const handleCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvErr("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.split("\n").map(l => l.trim()).filter(Boolean);
      const parsed = [];
      const errors = [];
      lines.forEach((line, i) => {
        if (i === 0 && (line.toLowerCase().includes("nome") || line.toLowerCase().includes("telefone"))) return; // skip header
        const parts = line.split(/[,;|\t]/);
        const telefone = (parts[0] || "").replace(/\D/g, "");
        const nome     = (parts[1] || "").trim() || "Contato";
        const empresa  = (parts[2] || "").trim() || "";
        if (telefone.length < 8) { errors.push(`Linha ${i + 1}: telefone inválido`); return; }
        parsed.push({ telefone, nome, empresa });
      });
      setContatos(parsed);
      if (errors.length > 0) setCsvErr(`${errors.length} linha(s) ignoradas: ${errors.slice(0, 3).join(", ")}`);
    };
    reader.readAsText(file, "UTF-8");
  };

  // Add manual contact
  const [novoContato, setNovoContato] = useState({ nome: "", telefone: "" });
  const addContato = () => {
    if (!novoContato.telefone.replace(/\D/g,"")) return;
    setContatos(p => [...p, { nome: novoContato.nome || "Contato", telefone: novoContato.telefone.replace(/\D/g,""), empresa: "" }]);
    setNovoContato({ nome: "", telefone: "" });
  };

  const fetchWppContatos = async () => {
    setWppLoading(true);
    setWppModal(true);
    setWppContatos([]);
    setWppSelecionados([]);
    const { data, error } = await supabase.functions.invoke("evolution-action", {
      body: { action: "fetchContacts", empresa_id: user.empresa_id }
    });
    setWppLoading(false);
    if (error) { alert("Erro ao buscar contatos: " + error.message); setWppModal(false); return; }
    if (data?.success && Array.isArray(data.contacts)) {
      setWppContatos(data.contacts);
    } else {
      setWppContatos([]);
    }
  };

  const adicionarWppSelecionados = () => {
    const novos = wppSelecionados.map(c => ({
      nome: c.pushName || c.name || c.number || c.id?.replace("@s.whatsapp.net","") || "Contato",
      telefone: c.number || c.id?.replace("@s.whatsapp.net","") || c.id || "",
      empresa: "",
    })).filter(c => c.telefone);
    setContatos(p => [...p, ...novos]);
    setWppModal(false);
    setWppSelecionados([]);
    setWppContatos([]);
  };

  const sincronizarGrupos = async () => {
    if (!window.confirm("Sincronizar grupos do WhatsApp com o sistema?")) return;
    setWppLoading(true);
    const { data, error } = await supabase.functions.invoke("evolution-action", {
      body: { action: "fetchGroups", empresa_id: user.empresa_id }
    });
    setWppLoading(false);
    if (error) { alert("Erro ao sincronizar grupos: " + error.message); return; }
    const total   = data?.total   ?? 0;
    const created = data?.created ?? 0;
    const updated = data?.updated ?? 0;
    alert(`Grupos sincronizados!\nTotal: ${total} | Novos: ${created} | Atualizados: ${updated}`);
  };

  const importarGruposParaContatos = async () => {
    setWppLoading(true);
    setWppModal(true);
    setWppContatos([]);
    setWppSelecionados([]);
    const { data, error } = await supabase.functions.invoke("evolution-action", {
      body: { action: "fetchGroups", empresa_id: user.empresa_id }
    });
    setWppLoading(false);
    if (error) { alert("Erro ao buscar grupos: " + error.message); setWppModal(false); return; }
    if (data?.success && Array.isArray(data.groups)) {
      // Converte grupos para formato de contato para seleção
      setWppContatos(data.groups.map(g => ({ ...g, _isGroup: true })));
    } else if (Array.isArray(data?.groups)) {
      setWppContatos(data.groups.map(g => ({ ...g, _isGroup: true })));
    } else {
      setWppContatos([]);
    }
  };

  const adicionarGruposSelecionados = () => {
    const novos = wppSelecionados.map(g => ({
      nome: g.subject || g.name || g.id || "Grupo",
      telefone: g.id || "",
      empresa: "",
    })).filter(c => c.telefone);
    setContatos(p => [...p, ...novos]);
    setWppModal(false);
    setWppSelecionados([]);
    setWppContatos([]);
  };

  const salvar = async (status = "rascunho") => {
    if (!form.titulo.trim()) { setErr("Nome obrigatório."); return; }
    if (!form.mensagem.trim()) { setErr("Mensagem obrigatória."); return; }
    if (contatos.length === 0) { setErr("Adicione pelo menos um contato."); return; }
    setSaving(true); setErr(""); setSucc("");
    const { data: camp, error } = await supabase.from("campanhas").insert({
      empresa_id: user.empresa_id,
      titulo: form.titulo.trim(),
      mensagem: form.mensagem.trim(),
      segmentacao: [],
      status,
      total_contatos: contatos.length,
      enviados: 0, entregues: 0, lidos: 0, respostas: 0,
      agendado_para: form.agendado_para || null,
      intervalo_min: form.intervalo_min,
      intervalo_max: form.intervalo_max,
    }).select().single();
    if (error) { setErr(error.message); setSaving(false); return; }

    // Insert contacts
    const rows = contatos.map(c => ({
      campanha_id: camp.id, empresa_id: user.empresa_id,
      nome: c.nome, telefone: c.telefone, status: "pendente",
    }));
    if (rows.length > 0) {
      await supabase.from("transmissao_contatos").insert(rows);
    }

    setSaving(false);
    setSucc(status === "rascunho" ? "Salvo como rascunho." : "Agendado com sucesso!");
    setForm(VAZIO);
    setContatos([]);
    load();
    setTimeout(() => { setSucc(""); setTab("historico"); }, 1500);
  };

  const disparar = async (campId) => {
    if (!window.confirm("Iniciar disparo agora? Os contatos serão contactados com o intervalo configurado.")) return;
    await supabase.from("campanhas").update({ status: "enviando" }).eq("id", campId);
    // Trigger via edge function
    const { error } = await supabase.functions.invoke("evolution-action", {
      body: { action: "broadcast", empresa_id: user.empresa_id, campanha_id: campId }
    });
    if (error) {
      alert("Erro ao iniciar disparo: " + error.message);
      return;
    }
    setEnviandoId(campId);
    load();
  };

  const cancelar = async (campId) => {
    if (!window.confirm("Cancelar disparo?")) return;
    await supabase.from("campanhas").update({ status: "cancelado" }).eq("id", campId);
    load();
  };

  const previewMensagem = (template, contato) => {
    return template
      .replace(/\{nome\}/gi, contato?.nome || "Lucas")
      .replace(/\{empresa\}/gi, contato?.empresa || "Empresa")
      .replace(/\{telefone\}/gi, contato?.telefone || "11999999999");
  };

  return (
    <div>
      {/* Tabs */}
      <Row gap={4} mb={20}>
        {[
          { id: "nova",      label: "Nova campanha" },
          { id: "historico", label: `Histórico (${campanhas.length})`  },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={btn(tab === t.id ? L.t1 : L.surface, tab === t.id ? "white" : L.t2)}>
            {t.label}
          </button>
        ))}
      </Row>

      {tab === "nova" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Form */}
          <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: L.t1, marginBottom: 16 }}>Configurar campanha</div>

            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>Nome da campanha *</label>
            <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
              placeholder="Ex: Promo Junho, Follow-up Leads..."
              style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 12px",
                fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14 }} />

            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>
              Mensagem * — variáveis: {VARIAVEIS.map(v => (
                <button key={v} onClick={() => setForm(p => ({ ...p, mensagem: p.mensagem + v }))}
                  style={{ background: L.tealBg, color: L.t1, border: `1px solid ${L.line}`, borderRadius: 4,
                    padding: "1px 6px", fontSize: 10, cursor: "pointer", fontFamily: "inherit", marginLeft: 4 }}>
                  {v}
                </button>
              ))}
            </label>
            <textarea value={form.mensagem} onChange={e => setForm(p => ({ ...p, mensagem: e.target.value }))}
              rows={5} placeholder="Olá {nome}! Temos uma oferta exclusiva..."
              style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 12px",
                fontSize: 12, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: 14 }} />

            {/* Intervalo */}
            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 6 }}>
              Intervalo entre mensagens (segundos) — evita bloqueios
            </label>
            <Row gap={10} mb={14}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: L.t4, marginBottom: 4 }}>Mínimo</div>
                <input type="number" min={3} max={300} value={form.intervalo_min}
                  onChange={e => setForm(p => ({ ...p, intervalo_min: parseInt(e.target.value) || 5 }))}
                  style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "7px 10px",
                    fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: L.t4, marginBottom: 4 }}>Máximo</div>
                <input type="number" min={3} max={300} value={form.intervalo_max}
                  onChange={e => setForm(p => ({ ...p, intervalo_max: parseInt(e.target.value) || 15 }))}
                  style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "7px 10px",
                    fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
            </Row>

            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>Agendar para (opcional)</label>
            <input type="datetime-local" value={form.agendado_para} onChange={e => setForm(p => ({ ...p, agendado_para: e.target.value }))}
              style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 12px",
                fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14 }} />

            {err  && <div style={{ padding: "8px 12px", background: L.redBg, borderRadius: 8, color: L.red, fontSize: 11, marginBottom: 10 }}>{err}</div>}
            {succ && <div style={{ padding: "8px 12px", background: L.greenBg, borderRadius: 8, color: L.green, fontSize: 11, marginBottom: 10 }}>{succ}</div>}

            <Row gap={8}>
              <button onClick={() => salvar("rascunho")} disabled={saving} style={btn(L.surface, L.t2, { flex: 1 })}>
                Salvar rascunho
              </button>
              <button onClick={() => salvar("agendado")} disabled={saving} style={btn(L.t1, "white", { flex: 1 })}>
                {saving ? "Salvando..." : "✓ Criar campanha"}
              </button>
            </Row>
          </div>

          {/* Contacts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Upload CSV */}
            <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: L.t1, marginBottom: 10 }}>📋 Importar contatos</div>
              <div style={{ fontSize: 11, color: L.t3, marginBottom: 10 }}>
                Formato CSV: <b>telefone</b>, nome, empresa (uma por linha)<br/>
                Ex: <code>11999998888, João Silva, Empresa Ltda</code>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleCSV} />
              <button onClick={() => fileRef.current?.click()} style={btn(L.blueBg, L.blue, { width: "100%", marginBottom: 8 })}>
                ⬆ Selecionar arquivo CSV
              </button>
              {csvErr && <div style={{ fontSize: 10, color: L.yellow, background: L.yellowBg, padding: "5px 8px", borderRadius: 6, marginBottom: 8 }}>{csvErr}</div>}
              <button onClick={fetchWppContatos} disabled={wppLoading}
                style={btn(L.greenBg, L.green, { width: "100%", marginBottom: 6, opacity: wppLoading ? 0.6 : 1 })}>
                {wppLoading ? "Buscando..." : "📲 Importar do WhatsApp"}
              </button>
              <Row gap={6}>
                <button onClick={importarGruposParaContatos} disabled={wppLoading}
                  style={btn(L.surface, L.t2, { flex: 1, opacity: wppLoading ? 0.6 : 1 })}>
                  👥 Grupos do WhatsApp
                </button>
                <button onClick={sincronizarGrupos} disabled={wppLoading}
                  style={btn(L.surface, L.t3, { flex: 1, fontSize: 10, opacity: wppLoading ? 0.6 : 1 })}>
                  🔄 Sincronizar grupos
                </button>
              </Row>
            </div>

            {/* Adicionar manual */}
            <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: L.t1, marginBottom: 10 }}>Adicionar manualmente</div>
              <Row gap={8} mb={8}>
                <input value={novoContato.nome} onChange={e => setNovoContato(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Nome"
                  style={{ flex: 1, border: `1px solid ${L.line}`, borderRadius: 7, padding: "6px 10px",
                    fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                <input value={novoContato.telefone} onChange={e => setNovoContato(p => ({ ...p, telefone: e.target.value }))}
                  placeholder="Telefone" type="tel"
                  style={{ flex: 1, border: `1px solid ${L.line}`, borderRadius: 7, padding: "6px 10px",
                    fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                <button onClick={addContato} style={btn(L.t1, "white", { padding: "6px 12px" })}>+</button>
              </Row>
            </div>

            {/* Lista de contatos */}
            <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: 16, flex: 1 }}>
              <Row between mb={8}>
                <div style={{ fontSize: 12, fontWeight: 600, color: L.t1 }}>
                  Contatos ({contatos.length})
                </div>
                {contatos.length > 0 && (
                  <button onClick={() => setContatos([])} style={btn(L.redBg, L.red, { padding: "3px 8px", fontSize: 10 })}>
                    Limpar
                  </button>
                )}
              </Row>
              {contatos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: L.t4, fontSize: 11 }}>
                  Importe um CSV ou adicione contatos manualmente
                </div>
              ) : (
                <div style={{ maxHeight: 240, overflowY: "auto" }}>
                  {contatos.slice(0, 100).map((c, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0",
                      borderBottom: `1px solid ${L.lineSoft}`, fontSize: 11 }}>
                      <span style={{ color: L.t1, fontWeight: 500, minWidth: 80, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</span>
                      <span style={{ color: L.t3, flex: 1 }}>{c.telefone}</span>
                      <button onClick={() => setContatos(p => p.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: L.t4, fontSize: 12 }}>×</button>
                    </div>
                  ))}
                  {contatos.length > 100 && (
                    <div style={{ padding: "6px 0", color: L.t4, fontSize: 11, textAlign: "center" }}>
                      +{contatos.length - 100} contatos adicionais
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preview */}
            {form.mensagem && contatos.length > 0 && (
              <div style={{ background: L.bgWarm, borderRadius: 10, border: `1px solid ${L.line}`, padding: 14 }}>
                <div style={{ fontSize: 10, color: L.t4, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>PRÉVIA COM PRIMEIRO CONTATO</div>
                <div style={{ background: L.t1, color: "white", borderRadius: "12px 12px 4px 12px",
                  padding: "8px 12px", fontSize: 12, display: "inline-block", maxWidth: "90%", wordBreak: "break-word" }}>
                  {previewMensagem(form.mensagem, contatos[0])}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal WhatsApp Contatos / Grupos */}
      {wppModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setWppModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "white", borderRadius: 12, padding: 24, width: 440, maxHeight: "80vh",
              display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>
            <Row between mb={12}>
              <div style={{ fontSize: 14, fontWeight: 700, color: L.t1 }}>
                {wppContatos.some(c => c._isGroup) ? "👥 Grupos do WhatsApp" : "📲 Contatos do WhatsApp"}
              </div>
              <button onClick={() => setWppModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: L.t3 }}>×</button>
            </Row>

            {wppLoading ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: L.t4, fontSize: 12 }}>
                Buscando contatos...
              </div>
            ) : wppContatos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: L.t4, fontSize: 12 }}>
                Nenhum contato encontrado.
              </div>
            ) : (
              <>
                <Row between mb={8}>
                  <div style={{ fontSize: 11, color: L.t3 }}>{wppContatos.length} disponíveis · {wppSelecionados.length} selecionados</div>
                  <button
                    onClick={() => setWppSelecionados(
                      wppSelecionados.length === wppContatos.length ? [] : [...wppContatos]
                    )}
                    style={btn(L.surface, L.t2, { padding: "3px 10px", fontSize: 10 })}>
                    {wppSelecionados.length === wppContatos.length ? "Desmarcar todos" : "Selecionar todos"}
                  </button>
                </Row>
                <div style={{ flex: 1, overflowY: "auto", border: `1px solid ${L.line}`, borderRadius: 8 }}>
                  {wppContatos.map((c, i) => {
                    const isSel = wppSelecionados.some(s => (s.id || s.number) === (c.id || c.number));
                    const nome = c._isGroup
                      ? (c.subject || c.name || c.id || "Grupo")
                      : (c.pushName || c.name || c.number || c.id?.replace("@s.whatsapp.net","") || "Contato");
                    const sub = c._isGroup
                      ? (c.id || "")
                      : (c.number || c.id?.replace("@s.whatsapp.net","") || "");
                    return (
                      <div key={i} onClick={() => {
                        setWppSelecionados(p =>
                          isSel ? p.filter(s => (s.id || s.number) !== (c.id || c.number)) : [...p, c]
                        );
                      }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                          borderBottom: `1px solid ${L.lineSoft}`, cursor: "pointer",
                          background: isSel ? L.tealBg : "transparent", transition: "background .1s" }}>
                        <input type="checkbox" readOnly checked={isSel} style={{ accentColor: L.teal }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: L.t1,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</div>
                          <div style={{ fontSize: 10, color: L.t3,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Row gap={8} style={{ marginTop: 14, justifyContent: "flex-end" }}>
                  <button onClick={() => setWppModal(false)} style={btn(L.surface, L.t2)}>Cancelar</button>
                  <button
                    onClick={wppContatos.some(c => c._isGroup) ? adicionarGruposSelecionados : adicionarWppSelecionados}
                    disabled={wppSelecionados.length === 0}
                    style={btn(L.t1, "white", { opacity: wppSelecionados.length === 0 ? 0.5 : 1 })}>
                    Adicionar {wppSelecionados.length > 0 ? `(${wppSelecionados.length})` : "selecionados"}
                  </button>
                </Row>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "historico" && (
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: L.t4 }}>Carregando...</div>
          ) : campanhas.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: L.t4 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>◉</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Nenhuma campanha</div>
              <button onClick={() => setTab("nova")} style={btn(L.t1, "white", { marginTop: 12 })}>Criar campanha</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {campanhas.map(c => {
                const st = ST[c.status] || ST.rascunho;
                const pct = c.total_contatos > 0 ? Math.round((c.enviados / c.total_contatos) * 100) : 0;
                const isEnviando = c.status === "enviando";
                return (
                  <div key={c.id} style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`,
                    padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                    <Row between mb={6}>
                      <div>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: L.t1 }}>{c.titulo}</span>
                        <span style={{ marginLeft: 8, fontSize: 10, background: st.bg, color: st.c,
                          padding: "2px 8px", borderRadius: 10, fontWeight: 600, border: `1px solid ${st.c}33` }}>
                          {st.label}
                        </span>
                      </div>
                      <span style={{ fontSize: 10, color: L.t4 }}>
                        {new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </Row>

                    <div style={{ fontSize: 11, color: L.t3, marginBottom: 10, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.mensagem}
                    </div>

                    {/* Stats */}
                    <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                      {[
                        { label: "Total",     val: c.total_contatos || 0 },
                        { label: "Enviados",  val: c.enviados       || 0 },
                        { label: "Entregues", val: c.entregues      || 0 },
                        { label: "Lidos",     val: c.lidos          || 0 },
                        { label: "Respostas", val: c.respostas      || 0 },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: L.t1 }}>{s.val}</div>
                          <div style={{ fontSize: 10, color: L.t4 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Progress bar */}
                    {(isEnviando || pct > 0) && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ height: 5, background: L.lineSoft, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${isEnviando && enviandoId === c.id ? (progress?.enviados / progress?.total * 100) || pct : pct}%`,
                            background: isEnviando ? L.yellow : L.green, transition: "width .5s", borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: 10, color: L.t3, marginTop: 3 }}>
                          {isEnviando && enviandoId === c.id && progress
                            ? `Enviando ${progress.enviados}/${progress.total}...`
                            : `${pct}% concluído`}
                        </div>
                      </div>
                    )}

                    <Row gap={6}>
                      {c.status === "rascunho" && (
                        <button onClick={() => disparar(c.id)} style={btn(L.green, "white", { fontSize: 11 })}>
                          ▶ Disparar agora
                        </button>
                      )}
                      {c.status === "agendado" && (
                        <>
                          <button onClick={() => disparar(c.id)} style={btn(L.green, "white", { fontSize: 11 })}>
                            ▶ Disparar agora
                          </button>
                          <button onClick={() => cancelar(c.id)} style={btn(L.redBg, L.red, { fontSize: 11 })}>
                            Cancelar
                          </button>
                        </>
                      )}
                      {c.status === "enviando" && (
                        <button onClick={() => cancelar(c.id)} style={btn(L.redBg, L.red, { fontSize: 11 })}>
                          ⏹ Parar envio
                        </button>
                      )}
                    </Row>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
