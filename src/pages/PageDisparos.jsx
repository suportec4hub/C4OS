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
const TIPOS_MIDIA = [
  { id: "texto",  label: "Texto",  ico: "✉️" },
  { id: "imagem", label: "Imagem", ico: "🖼️" },
  { id: "video",  label: "Vídeo",  ico: "🎬" },
];

const VAZIO = { titulo: "", mensagem: "", intervalo_min: 5, intervalo_max: 15, intervalo_unidade: "segundos", limite_envios: "", agendado_para: "", tipo_midia: "texto", chave_pix: "", caption: "" };

const UNIDADES = [
  { id: "segundos", label: "seg", mult: 1 },
  { id: "minutos",  label: "min", mult: 60 },
  { id: "horas",    label: "h",   mult: 3600 },
];

function CampanhaCard({ c, enviandoId, progress, onDisparar, onCancelar, onExcluir }) {
  const [open,     setOpen]     = useState(false);
  const [contatos, setContatos] = useState([]);
  const [loadingC, setLoadingC] = useState(false);
  const pollRef = useRef(null);

  const isEnviando = c.status === "enviando";
  const st = ST[c.status] || ST.rascunho;

  const loadContatos = async () => {
    const { data } = await supabase
      .from("transmissao_contatos")
      .select("id, nome, telefone, status, erro, enviado_em")
      .eq("campanha_id", c.id)
      .order("nome");
    setContatos(data || []);
  };

  useEffect(() => {
    if (!open) { clearInterval(pollRef.current); return; }
    setLoadingC(true);
    loadContatos().finally(() => setLoadingC(false));
    if (isEnviando) {
      pollRef.current = setInterval(loadContatos, 3000);
    }
    return () => clearInterval(pollRef.current);
  }, [open, c.id, isEnviando]);

  // Also reload when status changes to/from enviando
  useEffect(() => {
    if (open && !isEnviando) { clearInterval(pollRef.current); loadContatos(); }
  }, [c.status]);

  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit" });
  };

  const statusColor = {
    pendente:  { color: L.t3,    bg: L.surface  },
    enviando:  { color: L.yellow,bg: L.yellowBg },
    enviado:   { color: L.green, bg: L.greenBg  },
    entregue:  { color: L.teal,  bg: L.tealBg   },
    falhou:    { color: L.red,   bg: L.redBg    },
    cancelado: { color: L.t3,    bg: L.surface  },
  };

  const total   = c.total_contatos || 0;
  const enviados = c.enviados       || 0;
  const pct = total > 0 ? Math.round((enviados / total) * 100) : 0;

  return (
    <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setOpen(o => !o)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: L.t3, padding: "2px 4px", flexShrink: 0 }}>
          {open ? "▼" : "▶"}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: L.t1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.titulo}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              color: st.c, background: st.bg, flexShrink: 0 }}>
              {st.label}
            </span>
            {isEnviando && enviandoId === c.id && progress && (
              <span style={{ fontSize: 10, color: L.yellow, flexShrink: 0 }}>
                {progress.enviados}/{progress.total}
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: L.t4, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span>Criado: {fmtDate(c.created_at)}</span>
            {c.agendado_para && (
              <span style={{ color: L.blue }}>Agendado: {fmtDate(c.agendado_para)}</span>
            )}
            <span>{total} contato{total !== 1 ? "s" : ""}</span>
            {c.limite_envios && <span>Limite: {c.limite_envios}</span>}
          </div>
        </div>

        {/* Stats quick */}
        <div style={{ display: "flex", gap: 10, flexShrink: 0, fontSize: 11, color: L.t3 }}>
          <span title="Enviados" style={{ color: L.green }}>✓ {c.enviados || 0}</span>
          <span title="Entregues" style={{ color: L.teal }}>✓✓ {c.entregues || 0}</span>
          <span title="Lidos" style={{ color: L.blue }}>👁 {c.lidos || 0}</span>
          {(c.respostas || 0) > 0 && <span title="Respostas" style={{ color: L.accent }}>💬 {c.respostas}</span>}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {(c.status === "rascunho" || c.status === "agendado") && (
            <button onClick={() => onDisparar(c.id)}
              style={btn(L.greenBg, L.green, { padding: "5px 10px", fontSize: 11 })}>
              ▶ Disparar
            </button>
          )}
          {c.status === "enviando" && (
            <button onClick={() => onCancelar(c.id)}
              style={btn(L.yellowBg, L.yellow, { padding: "5px 10px", fontSize: 11 })}>
              ⏹ Cancelar
            </button>
          )}
          <button onClick={() => onExcluir(c.id)}
            style={btn(L.redBg, L.red, { padding: "5px 8px", fontSize: 11 })}>
            🗑
          </button>
        </div>
      </div>

      {/* Progress bar (only when sending) */}
      {isEnviando && total > 0 && (
        <div style={{ height: 3, background: L.line, margin: "0 16px 0" }}>
          <div style={{ height: "100%", background: L.green, borderRadius: 2,
            width: `${pct}%`, transition: "width .5s" }} />
        </div>
      )}

      {/* Expanded panel */}
      {open && (
        <div style={{ borderTop: `1px solid ${L.line}`, padding: 16, background: L.surface }}>
          {/* Message preview */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: L.t4, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
              Mensagem
            </div>
            <div style={{ background: L.white, borderRadius: 8, border: `1px solid ${L.line}`,
              padding: "10px 14px", fontSize: 12, color: L.t1, whiteSpace: "pre-wrap", wordBreak: "break-word",
              maxHeight: 160, overflowY: "auto" }}>
              {c.mensagem}
            </div>
            {c.tipo_midia !== "texto" && c.tipo_midia && (
              <div style={{ fontSize: 10, color: L.t3, marginTop: 4 }}>
                Tipo de mídia: {c.tipo_midia}
                {c.url_midia && <> · <a href={c.url_midia} target="_blank" rel="noopener noreferrer"
                  style={{ color: L.blue }}>Ver arquivo</a></>}
              </div>
            )}
          </div>

          {/* Config info */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, fontSize: 11, color: L.t3 }}>
            <div style={{ background: L.white, borderRadius: 6, border: `1px solid ${L.line}`,
              padding: "4px 10px" }}>
              Intervalo: {c.intervalo_min}s – {c.intervalo_max}s
            </div>
            {c.agendado_para && (
              <div style={{ background: L.blueBg, borderRadius: 6, border: `1px solid ${L.line}`,
                padding: "4px 10px", color: L.blue }}>
                Agendado: {fmtDate(c.agendado_para)}
              </div>
            )}
            {c.limite_envios && (
              <div style={{ background: L.white, borderRadius: 6, border: `1px solid ${L.line}`,
                padding: "4px 10px" }}>
                Limite: {c.limite_envios} envios
              </div>
            )}
          </div>

          {/* Contacts list */}
          <div>
            <div style={{ fontSize: 10, color: L.t4, fontWeight: 700, textTransform: "uppercase", marginBottom: 8,
              display: "flex", alignItems: "center", gap: 8 }}>
              Contatos ({contatos.length})
              {isEnviando && (
                <span style={{ fontSize: 9, color: L.yellow, fontWeight: 500 }}>● atualizando em tempo real</span>
              )}
            </div>
            {loadingC ? (
              <div style={{ textAlign: "center", padding: "16px 0", color: L.t4, fontSize: 11 }}>
                Carregando contatos...
              </div>
            ) : contatos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "12px 0", color: L.t4, fontSize: 11 }}>
                Nenhum contato registrado
              </div>
            ) : (
              <div style={{ background: L.white, borderRadius: 8, border: `1px solid ${L.line}`,
                maxHeight: 280, overflowY: "auto" }}>
                {contatos.map((ct, i) => {
                  const cs = statusColor[ct.status] || statusColor.pendente;
                  const statusLabel = {
                    pendente:  "Pendente",
                    enviando:  "Enviando...",
                    enviado:   "Enviado",
                    entregue:  "Entregue",
                    falhou:    "Falhou",
                    cancelado: "Cancelado",
                  }[ct.status] || ct.status;
                  return (
                    <div key={ct.id || i}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                        borderBottom: i < contatos.length - 1 ? `1px solid ${L.lineSoft}` : "none" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: L.t1,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ct.nome || "Contato"}
                        </div>
                        <div style={{ fontSize: 10, color: L.t3 }}>{ct.telefone}</div>
                        {ct.erro && (
                          <div style={{ fontSize: 10, color: L.red, marginTop: 2,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            title={ct.erro}>
                            Erro: {ct.erro}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                          color: cs.color, background: cs.bg }}>
                          {statusLabel}
                        </span>
                        {ct.enviado_em && (
                          <span style={{ fontSize: 9, color: L.t4 }}>
                            {fmtDate(ct.enviado_em)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PageDisparos({ user }) {
  const [tab,       setTab]       = useState("nova");
  const [campanhas, setCampanhas] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [form,      setForm]      = useState(VAZIO);
  const [contatos,  setContatos]  = useState([]); // [{nome, telefone}]
  const [midiaFile, setMidiaFile] = useState(null); // File object
  const [midiaUrl,  setMidiaUrl]  = useState("");   // URL após upload
  const [midiaUpload, setMidiaUpload] = useState(false);
  const midiaRef = useRef(null);
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
  const [wppBusca,    setWppBusca]    = useState("");
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
    setWppBusca("");

    const all = new Map(); // phone → {id, pushName, name, number}

    // 1. Conversas do banco — sempre disponível, fonte principal
    const { data: convs } = await supabase
      .from("conversas")
      .select("contato_nome, contato_telefone")
      .eq("empresa_id", user.empresa_id)
      .not("contato_telefone", "is", null);

    (convs || []).forEach(c => {
      const phone = c.contato_telefone.split("@")[0];
      // Ignora grupos e JIDs especiais
      if (!phone || c.contato_telefone.endsWith("@g.us") || c.contato_telefone.endsWith("@lid")) return;
      if (!all.has(phone)) {
        all.set(phone, {
          id:       c.contato_telefone,
          pushName: c.contato_nome || phone,
          name:     c.contato_nome || phone,
          number:   phone,
        });
      }
    });

    // 2. Contatos da API Evolution — complementar (pode retornar vazio)
    try {
      const { data } = await supabase.functions.invoke("evolution-action", {
        body: { action: "fetchContacts", empresa_id: user.empresa_id },
      });
      if (data?.success && Array.isArray(data.contacts)) {
        data.contacts.forEach(c => {
          const phone = c.numero || c.number || c.id?.split("@")[0] || "";
          if (!phone || phone.endsWith("@g.us")) return;
          if (!all.has(phone)) {
            all.set(phone, {
              id:       c.id || `${phone}@s.whatsapp.net`,
              pushName: c.pushName || c.nome || phone,
              name:     c.nome     || c.pushName || phone,
              number:   phone,
            });
          } else {
            // Melhora o nome se a API trouxer algo melhor
            const ex = all.get(phone);
            const apiName = c.pushName || c.nome;
            if (apiName && (ex.pushName === phone || ex.pushName === ex.number)) {
              ex.pushName = apiName; ex.name = apiName;
            }
          }
        });
      }
    } catch (_) {}

    const sorted = [...all.values()].sort((a, b) =>
      (a.pushName || "").localeCompare(b.pushName || "", "pt-BR")
    );
    setWppContatos(sorted);
    setWppLoading(false);
  };

  const adicionarWppSelecionados = () => {
    const novos = wppSelecionados.map(c => ({
      nome:     c.pushName || c.name || c.number || "Contato",
      telefone: c.number   || c.id?.split("@")[0] || "",
      empresa:  "",
    })).filter(c => c.telefone && c.telefone.replace(/\D/g,"").length >= 8);
    setContatos(p => {
      const existentes = new Set(p.map(c => c.telefone));
      return [...p, ...novos.filter(c => !existentes.has(c.telefone))];
    });
    setWppModal(false);
    setWppSelecionados([]);
    setWppContatos([]);
    setWppBusca("");
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
    // Converte intervalo para segundos
    const mult = UNIDADES.find(u => u.id === form.intervalo_unidade)?.mult || 1;
    const intMin = Math.max(1, (parseInt(form.intervalo_min) || 5) * mult);
    const intMax = Math.max(intMin, (parseInt(form.intervalo_max) || 15) * mult);
    const limEnvios = form.limite_envios ? parseInt(form.limite_envios) : null;
    const contatosLimitados = limEnvios ? contatos.slice(0, limEnvios) : contatos;

    const { data: camp, error } = await supabase.from("campanhas").insert({
      empresa_id: user.empresa_id,
      titulo: form.titulo.trim(),
      mensagem: form.mensagem.trim(),
      segmentacao: [],
      status,
      total_contatos: contatosLimitados.length,
      enviados: 0, entregues: 0, lidos: 0, respostas: 0,
      agendado_para: form.agendado_para ? new Date(form.agendado_para).toISOString() : null,
      intervalo_min: intMin,
      intervalo_max: intMax,
      limite_envios: limEnvios,
      tipo_midia: form.tipo_midia || "texto",
      url_midia: midiaUrl || null,
      chave_pix: form.chave_pix?.trim() || null,
      caption: form.caption?.trim() || null,
    }).select().single();
    if (error) { setErr(error.message); setSaving(false); return; }

    // Insert contacts
    const rows = contatosLimitados.map(c => ({
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
            style={btn(tab === t.id ? L.accent : L.surface, tab === t.id ? "white" : L.t2)}>
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

            {/* Tipo de Mídia */}
            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 6 }}>Tipo de conteúdo</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {TIPOS_MIDIA.map(t => (
                <button key={t.id} onClick={() => setForm(p => ({ ...p, tipo_midia: t.id }))}
                  style={{ padding: "5px 10px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                    background: form.tipo_midia === t.id ? L.teal : L.surface,
                    color: form.tipo_midia === t.id ? "white" : L.t2,
                    border: `1.5px solid ${form.tipo_midia === t.id ? L.teal : L.line}`,
                    fontWeight: form.tipo_midia === t.id ? 600 : 400, transition: "all .1s" }}>
                  {t.ico} {t.label}
                </button>
              ))}
            </div>

            {/* Campos de mídia */}
            {["imagem","video","audio","documento"].includes(form.tipo_midia) && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>
                  {form.tipo_midia === "imagem" ? "Selecionar imagem" : form.tipo_midia === "video" ? "Selecionar vídeo" : form.tipo_midia === "audio" ? "Selecionar áudio" : "Selecionar documento"}
                </label>
                <input ref={midiaRef} type="file"
                  accept={form.tipo_midia === "imagem" ? "image/*" : form.tipo_midia === "video" ? "video/*" : form.tipo_midia === "audio" ? "audio/*" : "*"}
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    setMidiaFile(file); setMidiaUpload(true);
                    const ext  = file.name.split(".").pop();
                    const path = `disparos/${user.empresa_id}/${Date.now()}.${ext}`;
                    const { data, error } = await supabase.storage.from("midia").upload(path, file, { upsert: true });
                    if (!error) {
                      const { data: pub } = supabase.storage.from("midia").getPublicUrl(path);
                      setMidiaUrl(pub.publicUrl);
                    }
                    setMidiaUpload(false);
                  }}
                />
                <button onClick={() => midiaRef.current?.click()}
                  style={{ ...btn(L.blueBg, L.blue), width: "100%", marginBottom: 6 }}>
                  {midiaUpload ? "Enviando..." : midiaFile ? `✓ ${midiaFile.name}` : "⬆ Selecionar arquivo"}
                </button>
                {midiaUrl && <div style={{ fontSize: 10, color: L.green, marginBottom: 4 }}>✓ Upload concluído</div>}
                {/* Caption opcional */}
                <input value={form.caption} onChange={e => setForm(p => ({ ...p, caption: e.target.value }))}
                  placeholder="Legenda (opcional)..."
                  style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "7px 10px",
                    fontSize: 11, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
            )}

            {form.tipo_midia === "pix" && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>Chave PIX *</label>
                <input value={form.chave_pix} onChange={e => setForm(p => ({ ...p, chave_pix: e.target.value }))}
                  placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                  style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 12px",
                    fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }} />
                <div style={{ padding: "8px 12px", background: L.greenBg, borderRadius: 8, fontSize: 11, color: L.green }}>
                  💳 A chave PIX será enviada junto com a mensagem de texto.
                </div>
              </div>
            )}

            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>
              {form.tipo_midia === "pix" ? "Mensagem que acompanha o PIX" : "Mensagem"} * — variáveis: {VARIAVEIS.map(v => (
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
              Intervalo entre mensagens — evita bloqueios do WhatsApp
            </label>
            <Row gap={8} mb={14} style={{ alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: L.t4, marginBottom: 4 }}>Mínimo</div>
                <input type="number" min={1} max={9999} value={form.intervalo_min}
                  onChange={e => setForm(p => ({ ...p, intervalo_min: parseInt(e.target.value) || 5 }))}
                  style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "7px 10px",
                    fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: L.t4, marginBottom: 4 }}>Máximo</div>
                <input type="number" min={1} max={9999} value={form.intervalo_max}
                  onChange={e => setForm(p => ({ ...p, intervalo_max: parseInt(e.target.value) || 15 }))}
                  style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "7px 10px",
                    fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              {/* Unidade */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: L.t4, marginBottom: 4 }}>Unidade</div>
                <div style={{ display: "flex", border: `1px solid ${L.line}`, borderRadius: 8, overflow: "hidden" }}>
                  {UNIDADES.map(u => (
                    <button key={u.id} onClick={() => setForm(p => ({ ...p, intervalo_unidade: u.id }))}
                      style={{ padding: "7px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                        border: "none", outline: "none", transition: "all .1s",
                        background: form.intervalo_unidade === u.id ? L.accent : L.surface,
                        color:      form.intervalo_unidade === u.id ? "white"  : L.t2,
                        fontWeight: form.intervalo_unidade === u.id ? 600 : 400 }}>
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>
            </Row>

            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>
              Limite de envios (opcional) — máx. de mensagens por disparo
            </label>
            <Row gap={8} mb={14}>
              <input type="number" min={1} value={form.limite_envios}
                onChange={e => setForm(p => ({ ...p, limite_envios: e.target.value }))}
                placeholder="Sem limite (enviar para todos)"
                style={{ flex: 1, border: `1px solid ${L.line}`, borderRadius: 8, padding: "7px 10px",
                  fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              {form.limite_envios && (
                <div style={{ fontSize: 11, color: L.t3, alignSelf: "center", whiteSpace: "nowrap" }}>
                  de {contatos.length} contatos
                </div>
              )}
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
              <button onClick={() => salvar("agendado")} disabled={saving} style={btn(L.accent, "white", { flex: 1 })}>
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
              {/* Importar de Leads do CRM */}
              <button
                onClick={async () => {
                  const { data } = await supabase.from("leads").select("nome, whatsapp, empresa_nome").eq("empresa_id", user.empresa_id).not("whatsapp", "is", null);
                  if (!data?.length) { alert("Nenhum lead com WhatsApp cadastrado."); return; }
                  const novos = data.map(l => ({ nome: l.nome, telefone: l.whatsapp.replace(/\D/g,""), empresa: l.empresa_nome||"" })).filter(c=>c.telefone.length>=8);
                  setContatos(p => { const existentes = new Set(p.map(c=>c.telefone)); return [...p, ...novos.filter(c=>!existentes.has(c.telefone))]; });
                  setSucc(`${novos.length} leads importados!`); setTimeout(()=>setSucc(""), 2000);
                }}
                style={btn(L.tealBg, L.teal, { width: "100%", marginBottom: 6 })}>
                ◎ Importar de Leads do CRM
              </button>
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
                <button onClick={addContato} style={btn(L.accent, "white", { padding: "6px 12px" })}>+</button>
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
                <div style={{ background: L.accent, color: "white", borderRadius: "12px 12px 4px 12px",
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
            style={{ background: L.white, borderRadius: 12, padding: 24, width: 440, maxHeight: "80vh",
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
                <div style={{ width: 20, height: 20, border: `2px solid ${L.line}`, borderTopColor: L.teal,
                  borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto 12px" }} />
                Buscando contatos e conversas...
              </div>
            ) : wppContatos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: L.t4, fontSize: 12 }}>
                Nenhum contato encontrado. Verifique se o WhatsApp está conectado.
              </div>
            ) : (() => {
              const isGroup = wppContatos.some(c => c._isGroup);
              const filtered = wppBusca.trim()
                ? wppContatos.filter(c => {
                    const n = (c.pushName || c.name || c.subject || "").toLowerCase();
                    const p = (c.number || c.id || "").toLowerCase();
                    return n.includes(wppBusca.toLowerCase()) || p.includes(wppBusca);
                  })
                : wppContatos;
              return (
                <>
                  {/* Busca */}
                  <input value={wppBusca} onChange={e => setWppBusca(e.target.value)}
                    placeholder="Buscar por nome ou número..."
                    style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "7px 12px",
                      fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10,
                      background: L.surface, color: L.t1 }} />

                  <Row between mb={8}>
                    <div style={{ fontSize: 11, color: L.t3 }}>
                      {filtered.length} contato{filtered.length !== 1 ? "s" : ""}
                      {wppBusca ? ` encontrados` : ` disponíveis`}
                      {wppSelecionados.length > 0 && ` · ${wppSelecionados.length} selecionados`}
                    </div>
                    <button
                      onClick={() => setWppSelecionados(
                        wppSelecionados.length === filtered.length ? [] : [...filtered]
                      )}
                      style={btn(L.surface, L.t2, { padding: "3px 10px", fontSize: 10 })}>
                      {wppSelecionados.length === filtered.length && filtered.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
                    </button>
                  </Row>

                  <div style={{ flex: 1, overflowY: "auto", border: `1px solid ${L.line}`, borderRadius: 8, maxHeight: 340 }}>
                    {filtered.map((c, i) => {
                      const key = c.number || c.id || i;
                      const isSel = wppSelecionados.some(s => (s.number || s.id) === (c.number || c.id));
                      const nome = isGroup
                        ? (c.subject || c.name || c.id || "Grupo")
                        : (c.pushName || c.name || c.number || "Contato");
                      const sub = isGroup ? (c.id || "") : (c.number || "");
                      return (
                        <div key={key} onClick={() => setWppSelecionados(p =>
                          isSel ? p.filter(s => (s.number || s.id) !== (c.number || c.id)) : [...p, c]
                        )}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                            borderBottom: `1px solid ${L.lineSoft}`, cursor: "pointer",
                            background: isSel ? L.tealBg : "transparent", transition: "background .1s" }}>
                          <input type="checkbox" readOnly checked={isSel} style={{ accentColor: L.teal, flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: L.t1,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</div>
                            {sub && <div style={{ fontSize: 10, color: L.t3,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
                          </div>
                        </div>
                      );
                    })}
                    {filtered.length === 0 && (
                      <div style={{ padding: "20px", textAlign: "center", color: L.t4, fontSize: 12 }}>
                        Nenhum resultado para "{wppBusca}"
                      </div>
                    )}
                  </div>

                  <Row gap={8} style={{ marginTop: 14, justifyContent: "flex-end" }}>
                    <button onClick={() => setWppModal(false)} style={btn(L.surface, L.t2)}>Cancelar</button>
                    <button
                      onClick={isGroup ? adicionarGruposSelecionados : adicionarWppSelecionados}
                      disabled={wppSelecionados.length === 0}
                      style={btn(L.accent, "white", { opacity: wppSelecionados.length === 0 ? 0.5 : 1 })}>
                      Adicionar {wppSelecionados.length > 0 ? `(${wppSelecionados.length})` : "selecionados"}
                    </button>
                  </Row>
                </>
              );
            })()}
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
              <button onClick={() => setTab("nova")} style={btn(L.accent, "white", { marginTop: 12 })}>Criar campanha</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {campanhas.map(c => (
                <CampanhaCard
                  key={c.id}
                  c={c}
                  enviandoId={enviandoId}
                  progress={progress}
                  onDisparar={disparar}
                  onCancelar={cancelar}
                  onExcluir={async (id) => {
                    if (!window.confirm("Excluir campanha e todo o histórico de envios?")) return;
                    await supabase.from("transmissao_contatos").delete().eq("campanha_id", id);
                    await supabase.from("campanhas").delete().eq("id", id);
                    load();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
