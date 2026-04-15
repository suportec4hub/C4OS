import { useState, useEffect, useRef, useCallback } from "react";
import { L } from "../constants/theme";
import { Av, Row, IBtn } from "../components/ui";
import { supabase } from "../lib/supabase";
import { useBreakpoint } from "../hooks/useBreakpoint";

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtHora = (iso) => {
  if (!iso) return "";
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 1) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const STATUS_LABELS = {
  aberta:         { label: "Aberta",         c: L.green,  bg: L.greenBg  },
  em_atendimento: { label: "Atendendo",      c: L.blue,   bg: L.blueBg   },
  aguardando:     { label: "Aguardando",     c: L.yellow, bg: L.yellowBg },
  resolvida:      { label: "Resolvida",      c: L.t3,     bg: L.surface  },
};

const STATUS_TABS = [
  { id: "todas",           label: "Todas"      },
  { id: "aberta",          label: "Abertas"    },
  { id: "aguardando",      label: "Fila"       },
  { id: "em_atendimento",  label: "Atendendo"  },
  { id: "resolvida",       label: "Resolvidas" },
];

const msgTexto = (m) => m?.texto || m?.conteudo || m?.mensagem || m?.corpo || "";
const msgHora  = (m) => m?.hora  || m?.created_at || null;
const isOutgoing = (m) => m?.de === "me" || m?.remetente === "me" || m?.remetente === "atendente" || m?.remetente === "campanha" || m?.remetente === "bot";

const btnStyle = (bg = L.surface, color = L.t2, extra = {}) => ({
  background: bg, color, border: `1px solid ${L.line}`, borderRadius: 7,
  padding: "5px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
  fontWeight: 500, transition: "all .12s", ...extra,
});

// ─── Log de atendimento ──────────────────────────────────────────────────────
async function logAtendimento(empresa_id, conversa_id, usuario_id, acao, detalhe = "") {
  try {
    await supabase.from("logs_atendimento").insert({ empresa_id, conversa_id, usuario_id, acao, detalhe });
  } catch (_) { /* silently ignore */ }
}

// ─── Componente de Etiqueta ──────────────────────────────────────────────────
function EtiquetaChip({ etiqueta, onRemove }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: etiqueta.cor + "22",
      color: etiqueta.cor, border: `1px solid ${etiqueta.cor}44`, borderRadius: 10, padding: "1px 7px",
      fontSize: 10, fontWeight: 600 }}>
      {etiqueta.nome}
      {onRemove && (
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer",
          color: etiqueta.cor, fontSize: 10, lineHeight: 1, padding: 0 }}>×</button>
      )}
    </span>
  );
}

// ─── Modal de Transferência ──────────────────────────────────────────────────
function TransferModal({ conversa, atendentes, setores, onTransfer, onClose }) {
  const [destTipo, setDestTipo] = useState("atendente");
  const [destId,   setDestId]   = useState("");
  const [obs,      setObs]      = useState("");

  const handleTransfer = () => {
    if (!destId) return;
    onTransfer({ destTipo, destId, obs });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}
        style={{ background: L.white, borderRadius: 12, padding: 24, width: 420, boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: L.t1, marginBottom: 4 }}>Transferir conversa</div>
        <div style={{ fontSize: 12, color: L.t3, marginBottom: 16 }}>
          {conversa?.contato_nome} · {conversa?.contato_telefone}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {["atendente","setor"].map(t => (
            <button key={t} onClick={() => { setDestTipo(t); setDestId(""); }}
              style={{ ...btnStyle(destTipo === t ? L.t1 : L.surface, destTipo === t ? "white" : L.t2), flex: 1, textTransform: "capitalize" }}>
              {t === "atendente" ? "👤 Atendente" : "🏢 Setor"}
            </button>
          ))}
        </div>

        <select value={destId} onChange={e => setDestId(e.target.value)}
          style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 12px",
            fontSize: 12, color: L.t1, background: L.white, outline: "none", fontFamily: "inherit", marginBottom: 12 }}>
          <option value="">Selecionar {destTipo === "atendente" ? "atendente" : "setor"}...</option>
          {destTipo === "atendente"
            ? atendentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)
            : setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)
          }
        </select>

        <textarea value={obs} onChange={e => setObs(e.target.value)}
          placeholder="Observação para o próximo atendente (opcional)..."
          style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 12px",
            fontSize: 12, color: L.t1, background: L.white, outline: "none", fontFamily: "inherit",
            resize: "vertical", minHeight: 60, marginBottom: 14, boxSizing: "border-box" }} />

        <Row gap={8} style={{ justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnStyle()}>Cancelar</button>
          <button onClick={handleTransfer} disabled={!destId}
            style={{ ...btnStyle(destId ? L.t1 : L.t5, "white"), opacity: destId ? 1 : .5 }}>
            Transferir →
          </button>
        </Row>
      </div>
    </div>
  );
}

// ─── Modal de Mensagem Agendada ──────────────────────────────────────────────
function AgendarModal({ conversa, empresaId, userId, onClose }) {
  const [mensagem,  setMensagem]  = useState("");
  const [dataHora,  setDataHora]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");

  const handleSave = async () => {
    if (!mensagem.trim() || !dataHora) { setErr("Preencha mensagem e data/hora."); return; }
    setSaving(true);
    const { error } = await supabase.from("mensagens_agendadas").insert({
      empresa_id: empresaId,
      conversa_id: conversa.id,
      destinatario: conversa.contato_telefone,
      mensagem: mensagem.trim(),
      agendado_para: new Date(dataHora).toISOString(),
      status: "pendente",
      criado_por: userId,
    });
    if (error) { setErr(error.message); setSaving(false); return; }
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}
        style={{ background: L.white, borderRadius: 12, padding: 24, width: 400, boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: L.t1, marginBottom: 16 }}>⏰ Agendar mensagem</div>

        <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>Data e hora</label>
        <input type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)}
          style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 12px",
            fontSize: 12, color: L.t1, background: L.white, outline: "none", fontFamily: "inherit", marginBottom: 12, boxSizing: "border-box" }} />

        <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>Mensagem</label>
        <textarea value={mensagem} onChange={e => setMensagem(e.target.value)}
          placeholder="Digite a mensagem a ser enviada..."
          style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 12px",
            fontSize: 12, color: L.t1, background: L.white, outline: "none", fontFamily: "inherit",
            resize: "vertical", minHeight: 80, marginBottom: 12, boxSizing: "border-box" }} />

        {err && <div style={{ color: L.red, fontSize: 11, marginBottom: 10 }}>{err}</div>}

        <Row gap={8} style={{ justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnStyle()}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            style={btnStyle(L.t1, "white")}>
            {saving ? "Salvando..." : "Agendar"}
          </button>
        </Row>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function PageChat({ user }) {
  // ── core state ────────────────────────────────────────────────────────────
  const [conversas,    setConversas]    = useState([]);
  const [mensagens,    setMensagens]    = useState([]);
  const [activeConv,   setActiveConv]   = useState(null);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(true);
  const [sending,      setSending]      = useState(false);
  const [sendErr,      setSendErr]      = useState("");

  // ── filters ───────────────────────────────────────────────────────────────
  const [busca,        setBusca]        = useState("");
  const [statusTab,    setStatusTab]    = useState("todas");
  const [setorFiltro,  setSetorFiltro]  = useState("");

  // ── sidebar data ──────────────────────────────────────────────────────────
  const [evoConnected, setEvoConnected] = useState(null);
  const [atendentes,   setAtendentes]   = useState([]);
  const [setores,      setSetores]      = useState([]);
  const [etiquetas,    setEtiquetas]    = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);

  // ── tipo filter (todos / contatos / grupos) ──────────────────────────────
  const [tipoFiltro,   setTipoFiltro]   = useState("todos");

  // ── import history ───────────────────────────────────────────────────────
  const [importing,    setImporting]    = useState(false);
  const [importInfo,   setImportInfo]   = useState(null); // { imported, total, nextPage }

  // ── sidebar tabs (conversas | contatos) ──────────────────────────────────
  const [sidebarTab,   setSidebarTab]   = useState("conversas");
  const [wppContatos,  setWppContatos]  = useState([]);
  const [contatosLoading, setContatosLoading] = useState(false);

  // ── force sync ───────────────────────────────────────────────────────────
  const [syncing,      setSyncing]      = useState(false);
  const [syncMsg,      setSyncMsg]      = useState("");

  // ── right panel ───────────────────────────────────────────────────────────
  const [rightTab,     setRightTab]     = useState("info"); // info | etiquetas | agendadas | log
  const [convEtiquetas,setConvEtiquetas]= useState([]);
  const [logsAtend,    setLogsAtend]    = useState([]);
  const [agendadas,    setAgendadas]    = useState([]);
  const [showRight,    setShowRight]    = useState(true);

  // ── modals / panels ───────────────────────────────────────────────────────
  const [novaModal,    setNovaModal]    = useState(false);
  const [novaForm,     setNovaForm]     = useState({ nome: "", telefone: "", empresa_contato: "" });
  const [transferModal,setTransferModal]= useState(false);
  const [agendarModal, setAgendarModal] = useState(false);
  const [showQuick,    setShowQuick]    = useState(false);
  const [quickFilter,  setQuickFilter]  = useState("");

  // ── refs ──────────────────────────────────────────────────────────────────
  const bottomRef      = useRef(null);
  const activeConvRef  = useRef(null);
  const statusTabRef   = useRef("todas");
  const inputRef       = useRef(null);
  const { isMobile }   = useBreakpoint();

  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);
  useEffect(() => { statusTabRef.current  = statusTab;  }, [statusTab]);

  // ── load initial data ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.empresa_id) return;
    // Verifica status real do WhatsApp — lê DB e confirma com Evolution GO se necessário
    supabase.from("empresas")
      .select("evolution_connected, evolution_instance_token")
      .eq("id", user.empresa_id).single()
      .then(({ data }) => {
        if (data?.evolution_connected) {
          setEvoConnected(true);
        } else if (data?.evolution_instance_token) {
          // Tem instância configurada — verifica status real na API
          supabase.functions.invoke("evolution-action", {
            body: { action: "status", empresa_id: user.empresa_id },
          }).then(({ data: res }) => {
            setEvoConnected(res?.data?.Connected ?? false);
          }).catch(() => setEvoConnected(false));
        } else {
          setEvoConnected(false);
        }
      });
    supabase.from("usuarios").select("id, nome, cor, foto_url").eq("empresa_id", user.empresa_id).eq("ativo", true)
      .then(({ data }) => setAtendentes(data || []));
    supabase.from("setores").select("*").eq("empresa_id", user.empresa_id).eq("ativo", true).order("ordem")
      .then(({ data }) => setSetores(data || []));
    supabase.from("etiquetas").select("*").eq("empresa_id", user.empresa_id).eq("ativo", true)
      .then(({ data }) => setEtiquetas(data || []));
    supabase.from("respostas_rapidas").select("*").eq("empresa_id", user.empresa_id).eq("ativo", true)
      .then(({ data }) => setQuickReplies(data || []));
  }, [user?.empresa_id]);

  // ── load conversations ────────────────────────────────────────────────────
  const loadConversas = useCallback(async (silent = false) => {
    if (!user?.empresa_id) return;
    if (!silent) setLoading(true);
    const tab = statusTabRef.current;
    let q = supabase.from("conversas").select("*")
      .eq("empresa_id", user.empresa_id)
      .order("ultima_hora", { ascending: false, nullsFirst: false });
    if (tab !== "todas") q = q.eq("status", tab);

    const { data, error } = await q;
    if (error) { if (!silent) setLoading(false); return; }
    const lista = data || [];

    // Enrich with atendente names
    const ids = [...new Set(lista.filter(c => c.atendente_id).map(c => c.atendente_id))];
    let atendenteMap = {};
    if (ids.length > 0) {
      const { data: ats } = await supabase.from("usuarios").select("id, nome").in("id", ids);
      if (ats) ats.forEach(a => { atendenteMap[a.id] = a.nome; });
    }

    // Enrich with setor names
    const sids = [...new Set(lista.filter(c => c.setor_id).map(c => c.setor_id))];
    let setorMap = {};
    if (sids.length > 0) {
      const { data: sts } = await supabase.from("setores").select("id, nome, cor").in("id", sids);
      if (sts) sts.forEach(s => { setorMap[s.id] = s; });
    }

    const enriched = lista.map(c => ({
      ...c,
      _atendente_nome: atendenteMap[c.atendente_id] || null,
      _setor:          setorMap[c.setor_id] || null,
    }));

    setConversas(enriched);
    if (enriched.length > 0 && !activeConvRef.current) setActiveConv(enriched[0]);
    if (activeConvRef.current) {
      const updated = enriched.find(c => c.id === activeConvRef.current.id);
      if (updated) setActiveConv(p => ({ ...p, ...updated }));
    }
    if (!silent) setLoading(false);
  }, [user?.empresa_id]);

  useEffect(() => { loadConversas(); }, [loadConversas, statusTab]);

  // ── realtime conversas ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.empresa_id) return;
    const ch = supabase.channel(`conv:${user.empresa_id}:${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversas",
        filter: `empresa_id=eq.${user.empresa_id}` }, () => loadConversas(true))
      .subscribe();
    const timer = setInterval(() => loadConversas(true), 8000);
    return () => { supabase.removeChannel(ch); clearInterval(timer); };
  }, [user?.empresa_id, loadConversas]);

  // ── load messages ─────────────────────────────────────────────────────────
  const loadMensagens = useCallback(async (convId) => {
    if (!convId) return;
    const { data } = await supabase.from("mensagens").select("*")
      .eq("conversa_id", convId)
      .order("hora", { ascending: true, nullsFirst: false });
    const msgs = (data || []).sort((a, b) =>
      new Date(msgHora(a) || 0) - new Date(msgHora(b) || 0)
    );
    setMensagens(msgs);
    await supabase.from("conversas").update({ nao_lidas: 0 }).eq("id", convId);
    setConversas(p => p.map(c => c.id === convId ? { ...c, nao_lidas: 0 } : c));
  }, []);

  // ── realtime messages ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeConv?.id) return;
    loadMensagens(activeConv.id);
    const convId = activeConv.id;
    const ch = supabase.channel(`msgs:${convId}:${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens",
        filter: `conversa_id=eq.${convId}` }, (payload) => {
        setMensagens(p => {
          if (p.find(m => m.id === payload.new.id)) return p;
          const now = Date.now();
          const filtered = p.filter(m => !m.id?.toString().startsWith("tmp-") || (now - parseInt(m.id.replace("tmp-","")) < 5000));
          return [...filtered, payload.new];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }).subscribe();
    const timer = setInterval(() => loadMensagens(convId), 5000);
    return () => { supabase.removeChannel(ch); clearInterval(timer); };
  }, [activeConv?.id, loadMensagens]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens.length]);

  // ── load conv etiquetas & logs when conv changes ──────────────────────────
  useEffect(() => {
    if (!activeConv?.id) return;
    // etiquetas da conversa
    supabase.from("conversa_etiquetas").select("etiqueta_id, etiquetas(id,nome,cor)")
      .eq("conversa_id", activeConv.id)
      .then(({ data }) => setConvEtiquetas(data?.map(x => x.etiquetas).filter(Boolean) || []));
    // logs
    supabase.from("logs_atendimento").select("*, usuarios(nome)")
      .eq("conversa_id", activeConv.id)
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setLogsAtend(data || []));
    // agendadas
    supabase.from("mensagens_agendadas").select("*")
      .eq("conversa_id", activeConv.id).eq("status", "pendente")
      .order("agendado_para")
      .then(({ data }) => setAgendadas(data || []));
  }, [activeConv?.id]);

  // ── actions ───────────────────────────────────────────────────────────────
  const selectConv = (c) => {
    setActiveConv(c);
    setMensagens([]);
    setShowQuick(false);
    setQuickFilter("");
    setSendErr("");
    setInput("");
  };

  const updateConvStatus = async (status) => {
    if (!activeConv) return;
    await supabase.from("conversas").update({ status }).eq("id", activeConv.id);
    setActiveConv(p => ({ ...p, status }));
    setConversas(p => p.map(c => c.id === activeConv.id ? { ...c, status } : c));
    logAtendimento(user.empresa_id, activeConv.id, user.id,
      status === "resolvida" ? "resolveu" : status === "em_atendimento" ? "reabriu" : "status_alterado",
      `Status: ${status}`);
  };

  const assignAtendente = async (atendente_id) => {
    if (!activeConv) return;
    await supabase.from("conversas").update({
      atendente_id: atendente_id || null, status: "em_atendimento"
    }).eq("id", activeConv.id);
    const at = atendentes.find(a => a.id === atendente_id);
    setActiveConv(p => ({ ...p, atendente_id, status: "em_atendimento", _atendente_nome: at?.nome || null }));
    setConversas(p => p.map(c => c.id === activeConv.id ? { ...c, atendente_id, status: "em_atendimento", _atendente_nome: at?.nome || null } : c));
    logAtendimento(user.empresa_id, activeConv.id, user.id, "atribuiu", `Atribuído a: ${at?.nome || atendente_id}`);
  };

  const assignSetor = async (setor_id) => {
    if (!activeConv) return;
    await supabase.from("conversas").update({ setor_id: setor_id || null }).eq("id", activeConv.id);
    const s = setores.find(x => x.id === setor_id);
    setActiveConv(p => ({ ...p, setor_id, _setor: s || null }));
    setConversas(p => p.map(c => c.id === activeConv.id ? { ...c, setor_id, _setor: s || null } : c));
    logAtendimento(user.empresa_id, activeConv.id, user.id, "setorizou", `Setor: ${s?.nome || setor_id}`);
  };

  const toggleBot = async () => {
    if (!activeConv) return;
    const novo = !activeConv.bot_ativo;
    await supabase.from("conversas").update({ bot_ativo: novo }).eq("id", activeConv.id);
    setActiveConv(p => ({ ...p, bot_ativo: novo }));
    logAtendimento(user.empresa_id, activeConv.id, user.id, novo ? "bot_ativou" : "bot_desativou");
  };

  const handleTransfer = async ({ destTipo, destId, obs }) => {
    if (!activeConv) return;
    const updateData = {
      status: "aguardando",
      transferido_de: activeConv.atendente_id || user.id,
      transferido_para: destTipo === "atendente" ? destId : null,
      transferido_em: new Date().toISOString(),
    };
    if (destTipo === "atendente") {
      updateData.atendente_id = destId;
      updateData.status = "em_atendimento";
    } else {
      updateData.setor_id = destId;
    }
    await supabase.from("conversas").update(updateData).eq("id", activeConv.id);
    const dest = destTipo === "atendente"
      ? atendentes.find(a => a.id === destId)?.nome
      : setores.find(s => s.id === destId)?.nome;
    if (obs) {
      await supabase.from("mensagens").insert({
        conversa_id: activeConv.id, empresa_id: user.empresa_id,
        de: "me", remetente: "me", texto: `📋 Obs de transferência: ${obs}`,
        hora: new Date().toISOString(), status: "enviado", is_nota: true,
      });
    }
    logAtendimento(user.empresa_id, activeConv.id, user.id, "transferiu", `Para: ${dest}${obs ? ` | Obs: ${obs}` : ""}`);
    setTransferModal(false);
    loadConversas(true);
  };

  const addEtiqueta = async (etiqueta) => {
    if (!activeConv) return;
    if (convEtiquetas.find(e => e.id === etiqueta.id)) return;
    await supabase.from("conversa_etiquetas").insert({ conversa_id: activeConv.id, etiqueta_id: etiqueta.id });
    setConvEtiquetas(p => [...p, etiqueta]);
    logAtendimento(user.empresa_id, activeConv.id, user.id, "etiquetou", etiqueta.nome);
  };

  const removeEtiqueta = async (etiquetaId) => {
    if (!activeConv) return;
    await supabase.from("conversa_etiquetas").delete()
      .eq("conversa_id", activeConv.id).eq("etiqueta_id", etiquetaId);
    setConvEtiquetas(p => p.filter(e => e.id !== etiquetaId));
  };

  const sendNote = async (texto) => {
    if (!activeConv || !texto.trim()) return;
    await supabase.from("mensagens").insert({
      conversa_id: activeConv.id, empresa_id: user.empresa_id,
      de: "me", remetente: "me", texto: texto.trim(),
      hora: new Date().toISOString(), status: "enviado", is_nota: true,
    });
    logAtendimento(user.empresa_id, activeConv.id, user.id, "nota_interna", texto.slice(0, 80));
  };

  const send = async (textoOverride = null, isNota = false) => {
    const texto = textoOverride || input.trim();
    if (!texto || !activeConv || sending) return;
    if (!textoOverride) setInput("");
    setSending(true);
    setSendErr("");
    const tmpId = `tmp-${Date.now()}`;
    const tmpMsg = { id: tmpId, conversa_id: activeConv.id, de: "me", remetente: "me",
      texto, hora: new Date().toISOString(), status: "enviando", is_nota: isNota };
    setMensagens(p => [...p, tmpMsg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    const { data: msg, error: dbErr } = await supabase.from("mensagens")
      .insert({ conversa_id: activeConv.id, empresa_id: activeConv.empresa_id || user.empresa_id,
        de: "me", remetente: "me", texto, hora: new Date().toISOString(),
        status: "enviado", is_nota: isNota })
      .select().single();

    if (dbErr) {
      const { data: msg2, error: dbErr2 } = await supabase.from("mensagens")
        .insert({ conversa_id: activeConv.id, empresa_id: activeConv.empresa_id || user.empresa_id,
          remetente: "atendente", texto, status: "enviado" })
        .select().single();
      if (dbErr2) {
        setSendErr("Erro ao salvar: " + (dbErr2.message || dbErr.message));
        setMensagens(p => p.filter(m => m.id !== tmpId));
        setSending(false);
        return;
      }
      setMensagens(p => p.map(m => m.id === tmpId ? (msg2 || m) : m));
    } else {
      setMensagens(p => p.map(m => m.id === tmpId ? (msg || m) : m));
    }

    const now = new Date().toISOString();
    if (!isNota) {
      await supabase.from("conversas").update({
        ultima_mensagem: texto, ultima_hora: now, status: "em_atendimento"
      }).eq("id", activeConv.id);
      setConversas(p => p.map(c => c.id === activeConv.id ? { ...c, ultima_mensagem: texto, ultima_hora: now, status: "em_atendimento" } : c));

      if (activeConv.contato_telefone?.trim()) {
        supabase.functions.invoke("evolution-action", {
          body: { action: "send", empresa_id: user.empresa_id, phone: activeConv.contato_telefone, message: texto }
        }).then(({ data: fnData, error: fnErr }) => {
          if (fnErr) {
            // Tenta extrair detalhe real do erro (o body da edge function vem em fnErr.message como JSON string)
            let detail = fnErr.message || "verifique conexão.";
            try { const p = JSON.parse(detail); detail = p.error || p.message || detail; } catch (_) {}
            setSendErr("⚠️ Salvo mas não enviado ao WhatsApp: " + detail);
          } else if (fnData?.error) {
            setSendErr("⚠️ Salvo mas não enviado ao WhatsApp: " + fnData.error);
          }
        }).catch((e) => setSendErr("⚠️ Salvo mas não enviado ao WhatsApp: " + (e?.message || "erro de rede.")));
      }
    }
    setSending(false);
  };

  const criarConversa = async () => {
    if (!novaForm.nome.trim()) return;
    const { data } = await supabase.from("conversas").insert({
      empresa_id: user.empresa_id,
      contato_nome: novaForm.nome.trim(),
      contato_telefone: novaForm.telefone.replace(/\D/g, ""),
      contato_empresa: novaForm.empresa_contato.trim(),
      ultima_mensagem: "", ultima_hora: new Date().toISOString(),
      nao_lidas: 0, status: "aberta",
    }).select().single();
    if (data) { setConversas(p => [data, ...p]); setActiveConv(data); setMensagens([]); }
    setNovaModal(false);
    setNovaForm({ nome: "", telefone: "", empresa_contato: "" });
  };

  const cancelAgendada = async (id) => {
    await supabase.from("mensagens_agendadas").update({ status: "cancelado" }).eq("id", id);
    setAgendadas(p => p.filter(a => a.id !== id));
  };

  // ── sincronizar grupos ────────────────────────────────────────────────────
  const syncGroups = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-action", {
        body: { action: "fetchGroups", empresa_id: user.empresa_id },
      });
      if (error) throw error;
      setImportInfo({ imported: (data?.updated || 0) + (data?.created || 0), total: data?.total || 0, isGroups: true });
      loadConversas(true);
    } catch (e) {
      console.error("[syncGroups]", e);
      setImportInfo({ error: "Não foi possível buscar grupos. Verifique a conexão.", isGroups: true });
    }
    setImporting(false);
  };

  // ── importar histórico ────────────────────────────────────────────────────
  const importHistory = async (page = 1) => {
    if (importing) return;
    setImporting(true);
    try {
      const { data } = await supabase.functions.invoke("evolution-action", {
        body: { action: "importHistory", empresa_id: user.empresa_id, page },
      });
      setImportInfo(data);
      if (data?.nextPage) {
        // Continua automaticamente nas próximas páginas
        setTimeout(() => importHistory(data.nextPage), 500);
      } else {
        setImporting(false);
        loadConversas(true); // atualiza lista após import completo
      }
    } catch (e) {
      setImporting(false);
    }
  };

  // ── carregar contatos do WhatsApp (aba Contatos) ─────────────────────────
  const loadWppContatos = useCallback(async () => {
    if (!user?.empresa_id) return;
    setContatosLoading(true);
    const { data } = await supabase.from("conversas")
      .select("id, contato_nome, contato_telefone")
      .eq("empresa_id", user.empresa_id)
      .order("contato_nome");
    setWppContatos(data || []);
    setContatosLoading(false);
  }, [user?.empresa_id]);

  useEffect(() => {
    if (sidebarTab === "contatos") loadWppContatos();
  }, [sidebarTab, loadWppContatos]);

  // ── forçar sincronização ──────────────────────────────────────────────────
  const forceSincronizar = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncMsg("");
    try {
      await supabase.functions.invoke("evolution-action", {
        body: { action: "fetchGroups", empresa_id: user.empresa_id },
      });
      await supabase.functions.invoke("evolution-action", {
        body: { action: "importHistory", empresa_id: user.empresa_id, page: 1 },
      });
      await loadConversas(true);
      setSyncMsg("✓ Sincronizado");
      setTimeout(() => setSyncMsg(""), 3000);
    } catch (e) {
      setSyncMsg("Erro: " + (e?.message || "falha na sincronização"));
      setTimeout(() => setSyncMsg(""), 4000);
    }
    setSyncing(false);
  };

  // ── keyboard shortcuts ────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.startsWith("/nota ")) {
        sendNote(input.slice(6));
        setInput("");
      } else {
        send();
      }
    }
    if (e.key === "/" && input === "") {
      setShowQuick(true);
      setQuickFilter("");
    }
    if (e.key === "Escape") setShowQuick(false);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    if (val.startsWith("/")) {
      setShowQuick(true);
      setQuickFilter(val.slice(1).toLowerCase());
    } else {
      setShowQuick(false);
    }
  };

  // ── filters ───────────────────────────────────────────────────────────────
  const filtradas = conversas.filter(c => {
    const matchSearch = !busca ||
      c.contato_nome?.toLowerCase().includes(busca.toLowerCase()) ||
      c.contato_empresa?.toLowerCase().includes(busca.toLowerCase()) ||
      c.contato_telefone?.includes(busca);
    const matchSetor = !setorFiltro || c.setor_id === setorFiltro;
    const isGrpC = c.contato_telefone?.endsWith("@g.us");
    const matchTipo  = tipoFiltro === "todos"    ? true
                     : tipoFiltro === "grupos"   ? !!isGrpC
                     : /* contatos */              !isGrpC;
    return matchSearch && matchSetor && matchTipo;
  });

  const filteredQuick = quickReplies.filter(r =>
    r.titulo?.toLowerCase().includes(quickFilter) ||
    r.mensagem?.toLowerCase().includes(quickFilter)
  );

  const totalNaoLidas = conversas.reduce((s, c) => s + (c.nao_lidas || 0), 0);
  const showRightPanel = showRight && !isMobile && activeConv;

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Banner status WhatsApp */}
      {evoConnected === false && (
        <div style={{ padding: "8px 16px", background: "#fffbf0", border: `1px solid ${L.yellow}44`,
          borderRadius: 10, marginBottom: 10, fontSize: 12 }}>
          ⚠️ <b>WhatsApp desconectado.</b> Conecte em <b>Minha Empresa → Integrações</b>.
        </div>
      )}
      {evoConnected === true && (
        <div style={{ padding: "6px 16px", background: L.greenBg, border: `1px solid ${L.green}33`,
          borderRadius: 10, marginBottom: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 11, flexWrap: "wrap" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: L.green, display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: L.green, fontWeight: 600 }}>WhatsApp conectado</span>
          <span style={{ color: L.t3 }}>· Evolution GO</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
            {importInfo && (
              <span style={{ color: importInfo.error ? L.red : L.t3, fontSize: 10 }}>
                {importing
                  ? `⏳ Sincronizando… ${importInfo.imported || 0}`
                  : importInfo.error
                    ? importInfo.error
                    : importInfo.isGroups
                      ? `✅ ${importInfo.total || 0} grupos sincronizados`
                      : `✅ ${importInfo.imported || 0} msgs importadas`}
              </span>
            )}
            <button onClick={() => syncGroups()} disabled={importing}
              style={{ ...btnStyle(importing ? L.surface : L.blue, importing ? L.t4 : "white"),
                fontSize: 10, padding: "3px 9px", opacity: importing ? 0.6 : 1 }}>
              {importing ? "Sincronizando…" : "👥 Grupos"}
            </button>
            <button onClick={() => importHistory(1)} disabled={importing}
              style={{ ...btnStyle(importing ? L.surface : L.t1, importing ? L.t4 : "white"),
                fontSize: 10, padding: "3px 9px", opacity: importing ? 0.6 : 1 }}>
              {importing ? "Importando…" : "⬇ Histórico"}
            </button>
          </span>
        </div>
      )}

      <div style={{ display: "flex", height: isMobile ? "calc(100dvh - 130px)" : "calc(100vh - 162px)",
        background: L.white, borderRadius: 12, border: `1px solid ${L.line}`,
        overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>

        {/* ══════════════════ SIDEBAR ESQUERDA ══════════════════ */}
        {(!isMobile || !activeConv) && (
          <div style={{ width: isMobile ? "100%" : 280, minWidth: isMobile ? 0 : 280,
            borderRight: isMobile ? "none" : `1px solid ${L.line}`, display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${L.lineSoft}` }}>
              <Row between mb={8}>
                <Row gap={8}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: L.t1 }}>Chat</span>
                  {totalNaoLidas > 0 && (
                    <span style={{ background: L.green, color: "white", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                      {totalNaoLidas}
                    </span>
                  )}
                </Row>
                <Row gap={5}>
                  {syncMsg && (
                    <span style={{ fontSize: 10, color: syncMsg.startsWith("Erro") ? L.red : L.green,
                      fontWeight: 600, whiteSpace: "nowrap" }}>{syncMsg}</span>
                  )}
                  <button onClick={forceSincronizar} disabled={syncing} title="Forçar sincronização"
                    style={{ ...btnStyle(syncing ? L.surface : L.blueBg, syncing ? L.t4 : L.blue),
                      opacity: syncing ? 0.6 : 1, padding: "5px 8px" }}>
                    {syncing ? "⟳" : "🔄"}
                  </button>
                  <button onClick={() => loadConversas()} title="Atualizar" style={btnStyle()}>⟳</button>
                  <button onClick={() => setNovaModal(true)} style={btnStyle(L.t1, "white")}>+ Nova</button>
                </Row>
              </Row>

              {/* Toggle Conversas / Contatos */}
              <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
                {[
                  { id: "conversas", label: "💬 Conversas" },
                  { id: "contatos",  label: "👥 Contatos"  },
                ].map(t => (
                  <button key={t.id} onClick={() => setSidebarTab(t.id)}
                    style={{ flex: 1, padding: "5px 8px", borderRadius: 7, fontSize: 11, cursor: "pointer",
                      fontFamily: "inherit", border: `1px solid ${sidebarTab === t.id ? L.teal : L.line}`,
                      fontWeight: sidebarTab === t.id ? 700 : 400,
                      background: sidebarTab === t.id ? L.tealBg : L.surface,
                      color: sidebarTab === t.id ? L.teal : L.t3, transition: "all .1s" }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Busca (unificada) */}
              <div style={{ display: "flex", alignItems: "center", gap: 7, background: L.surface,
                border: `1px solid ${L.line}`, borderRadius: 8, padding: "5px 10px", marginBottom: 8 }}>
                <span style={{ color: L.t4, fontSize: 13 }}>⌕</span>
                <input value={busca} onChange={e => setBusca(e.target.value)}
                  placeholder={sidebarTab === "contatos" ? "Buscar contato..." : "Buscar conversa..."}
                  style={{ background: "none", border: "none", outline: "none", color: L.t1, fontSize: 12, width: "100%", fontFamily: "inherit" }} />
              </div>

              {/* Filtros só na aba Conversas */}
              {sidebarTab === "conversas" && (
                <>
                  {/* Filtro por setor */}
                  {setores.length > 0 && (
                    <select value={setorFiltro} onChange={e => setSetorFiltro(e.target.value)}
                      style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 7, padding: "4px 8px",
                        fontSize: 11, color: L.t2, background: L.white, outline: "none", fontFamily: "inherit", marginBottom: 8 }}>
                      <option value="">🏢 Todos os setores</option>
                      {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                  )}

                  {/* Filtro Tipo: Todos / Contatos / Grupos */}
                  <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
                    {[
                      { id: "todos",    label: "Todos",     emoji: "" },
                      { id: "contatos", label: "Contatos",  emoji: "👤" },
                      { id: "grupos",   label: "Grupos",    emoji: "👥" },
                    ].map(t => (
                      <button key={t.id} onClick={() => setTipoFiltro(t.id)}
                        style={{ flex: 1, padding: "4px 6px", borderRadius: 6, fontSize: 10, cursor: "pointer",
                          fontFamily: "inherit", border: `1px solid ${tipoFiltro === t.id ? L.teal : L.line}`,
                          fontWeight: tipoFiltro === t.id ? 700 : 400,
                          background: tipoFiltro === t.id ? L.tealBg : L.surface,
                          color: tipoFiltro === t.id ? L.teal : L.t3, transition: "all .1s" }}>
                        {t.emoji && <span style={{ marginRight: 3 }}>{t.emoji}</span>}
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Abas de status */}
                  <div style={{ display: "flex", gap: 2, overflowX: "auto", scrollbarWidth: "none" }}>
                    {STATUS_TABS.map(t => {
                      const count = t.id === "todas" ? totalNaoLidas : conversas.filter(c => c.status === t.id && c.nao_lidas > 0).reduce((s, c) => s + (c.nao_lidas || 0), 0);
                      return (
                        <button key={t.id} onClick={() => setStatusTab(t.id)}
                          style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 6, fontSize: 10, cursor: "pointer",
                            fontFamily: "inherit", border: "none", fontWeight: statusTab === t.id ? 700 : 400,
                            background: statusTab === t.id ? L.t1 : "transparent",
                            color: statusTab === t.id ? "white" : L.t3, transition: "all .1s", position: "relative" }}>
                          {t.label}
                          {count > 0 && (
                            <span style={{ position: "absolute", top: -3, right: -3, background: L.green,
                              color: "white", borderRadius: "50%", width: 12, height: 12,
                              fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {count > 9 ? "9+" : count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Lista Conversas */}
            {sidebarTab === "conversas" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: 24, textAlign: "center", color: L.t4, fontSize: 12 }}>
                  <div style={{ animation: "spin 1s linear infinite", fontSize: 20, marginBottom: 6, display: "inline-block" }}>⟳</div>
                  <div>Carregando...</div>
                </div>
              ) : filtradas.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: L.t4 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>◈</div>
                  <div style={{ fontSize: 12 }}>Nenhuma conversa</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Aguardando mensagens via WhatsApp</div>
                </div>
              ) : filtradas.map(c => {
                const st = STATUS_LABELS[c.status] || STATUS_LABELS.aberta;
                const isActive = activeConv?.id === c.id;
                const isGrp = c.contato_telefone?.endsWith("@g.us");
                const nomeExibido = c.contato_nome ||
                  (isGrp ? `Grupo ${c.contato_telefone?.slice(-8,-4)}` : c.contato_telefone) ||
                  "Desconhecido";
                return (
                  <div key={c.id} onClick={() => selectConv(c)}
                    style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${L.lineSoft}`,
                      background: isActive ? "#f0f0f044" : "transparent",
                      borderLeft: `3px solid ${isActive ? L.t1 : "transparent"}`, transition: "all .1s" }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = L.surface; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                    <Row gap={9}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <Av name={nomeExibido} color={isGrp ? L.blue : L.t1} size={36} />
                        {isGrp && (
                          <div style={{ position: "absolute", bottom: -1, right: -1, width: 14, height: 14,
                            borderRadius: "50%", background: L.blue, border: `2px solid ${L.white}`,
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7 }}>👥</div>
                        )}
                        {!isGrp && c.nao_lidas > 0 && (
                          <div style={{ position: "absolute", bottom: -1, right: -1, width: 10, height: 10,
                            borderRadius: "50%", background: L.green, border: `2px solid ${L.white}` }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Row between>
                          <span style={{ fontSize: 12.5, fontWeight: c.nao_lidas > 0 ? 700 : 500, color: L.t1,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>
                            {nomeExibido}
                          </span>
                          <span style={{ fontSize: 10, color: L.t4, flexShrink: 0 }}>{fmtHora(c.ultima_hora)}</span>
                        </Row>
                        <div style={{ fontSize: 11, color: L.t3, overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap", marginTop: 1 }}>
                          {c.ultima_mensagem || "Sem mensagens"}
                        </div>
                        <Row gap={4} style={{ marginTop: 3, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 9, background: st.bg, color: st.c, padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>
                            {st.label}
                          </span>
                          {c._setor && (
                            <span style={{ fontSize: 9, background: c._setor.cor + "22", color: c._setor.cor,
                              padding: "1px 5px", borderRadius: 4, fontWeight: 600, border: `1px solid ${c._setor.cor}33` }}>
                              {c._setor.nome}
                            </span>
                          )}
                          {c._atendente_nome && (
                            <span style={{ fontSize: 9, color: L.t3 }}>👤 {c._atendente_nome.split(" ")[0]}</span>
                          )}
                          {c.bot_ativo && <span style={{ fontSize: 9, color: L.t3 }}>🤖</span>}
                          {c.nao_lidas > 0 && (
                            <span style={{ background: L.green, borderRadius: "50%", width: 16, height: 16,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 9, fontWeight: 700, color: "white", marginLeft: "auto" }}>
                              {c.nao_lidas}
                            </span>
                          )}
                        </Row>
                      </div>
                    </Row>
                  </div>
                );
              })}
            </div>
            )}

            {/* Lista Contatos */}
            {sidebarTab === "contatos" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              {contatosLoading ? (
                <div style={{ padding: 24, textAlign: "center", color: L.t4, fontSize: 12 }}>
                  <div style={{ animation: "spin 1s linear infinite", fontSize: 20, marginBottom: 6, display: "inline-block" }}>⟳</div>
                  <div>Carregando contatos...</div>
                </div>
              ) : wppContatos.filter(c =>
                  !busca ||
                  c.contato_nome?.toLowerCase().includes(busca.toLowerCase()) ||
                  c.contato_telefone?.includes(busca)
                ).length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: L.t4 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>◈</div>
                  <div style={{ fontSize: 12 }}>Nenhum contato</div>
                </div>
              ) : wppContatos.filter(c =>
                  !busca ||
                  c.contato_nome?.toLowerCase().includes(busca.toLowerCase()) ||
                  c.contato_telefone?.includes(busca)
                ).map(c => {
                const isActive = activeConv?.id === c.id;
                const isGrp = c.contato_telefone?.endsWith("@g.us");
                const nomeExibido = c.contato_nome || c.contato_telefone || "Desconhecido";
                return (
                  <div key={c.id} onClick={() => {
                    const conv = conversas.find(cv => cv.id === c.id);
                    if (conv) selectConv(conv);
                    setSidebarTab("conversas");
                  }}
                    style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${L.lineSoft}`,
                      background: isActive ? "#f0f0f044" : "transparent",
                      borderLeft: `3px solid ${isActive ? L.t1 : "transparent"}`, transition: "all .1s" }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = L.surface; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                    <Row gap={9}>
                      <Av name={nomeExibido} color={isGrp ? L.blue : L.t1} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: L.t1,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {nomeExibido}
                        </div>
                        <div style={{ fontSize: 11, color: L.t3,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.contato_telefone || ""}
                        </div>
                      </div>
                    </Row>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* ══════════════════ ÁREA CENTRAL ══════════════════════ */}
        {(!isMobile || activeConv) && (activeConv ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

            {/* Header da conversa */}
            <div style={{ padding: "9px 14px", borderBottom: `1px solid ${L.line}`, display: "flex",
              justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: L.white, gap: 8 }}>
              <Row gap={9} style={{ minWidth: 0, flex: 1 }}>
                {isMobile && (
                  <button onClick={() => setActiveConv(null)} style={btnStyle()}>←</button>
                )}
                <div style={{ position: "relative" }}>
                  <Av name={activeConv.contato_nome || "?"} color={L.t1} size={34} />
                  {evoConnected && (
                    <div style={{ position: "absolute", bottom: 0, right: 0, width: 8, height: 8,
                      borderRadius: "50%", background: L.green, border: `2px solid white` }} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: L.t1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeConv.contato_nome || activeConv.contato_telefone || "Desconhecido"}
                  </div>
                  <Row gap={8} style={{ flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, color: L.t3 }}>
                      {activeConv.contato_telefone || "Sem telefone"}
                    </span>
                    {activeConv._setor && (
                      <span style={{ fontSize: 9, background: activeConv._setor.cor + "22",
                        color: activeConv._setor.cor, padding: "1px 6px", borderRadius: 4,
                        fontWeight: 600, border: `1px solid ${activeConv._setor.cor}33` }}>
                        {activeConv._setor.nome}
                      </span>
                    )}
                    {activeConv._atendente_nome && (
                      <span style={{ fontSize: 10, color: L.t3 }}>👤 {activeConv._atendente_nome}</span>
                    )}
                  </Row>
                </div>
              </Row>

              <Row gap={4} style={{ flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {/* Status select */}
                <select value={activeConv.status || "aberta"} onChange={e => updateConvStatus(e.target.value)}
                  style={{ fontSize: 10, border: `1px solid ${L.line}`, borderRadius: 6, padding: "4px 7px",
                    background: STATUS_LABELS[activeConv.status]?.bg || L.greenBg,
                    color: STATUS_LABELS[activeConv.status]?.c || L.green,
                    cursor: "pointer", fontFamily: "inherit", fontWeight: 600, outline: "none" }}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>

                {/* Atribuir setor */}
                {setores.length > 0 && (
                  <select value={activeConv.setor_id || ""} onChange={e => assignSetor(e.target.value)}
                    style={{ fontSize: 10, border: `1px solid ${L.line}`, borderRadius: 6, padding: "4px 7px",
                      background: L.white, color: L.t2, cursor: "pointer", fontFamily: "inherit", outline: "none", maxWidth: 100 }}>
                    <option value="">🏢 Setor</option>
                    {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                )}

                {/* Atribuir atendente */}
                <select value={activeConv.atendente_id || ""} onChange={e => assignAtendente(e.target.value)}
                  style={{ fontSize: 10, border: `1px solid ${L.line}`, borderRadius: 6, padding: "4px 7px",
                    background: L.white, color: L.t2, cursor: "pointer", fontFamily: "inherit", outline: "none", maxWidth: 110 }}>
                  <option value="">👤 Atribuir</option>
                  {atendentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>

                {/* Transferir */}
                <button onClick={() => setTransferModal(true)} title="Transferir"
                  style={btnStyle()}>⇄</button>

                {/* Bot toggle */}
                <button onClick={toggleBot} title={activeConv.bot_ativo ? "Desativar bot" : "Ativar bot"}
                  style={btnStyle(activeConv.bot_ativo ? L.yellow + "33" : L.surface, activeConv.bot_ativo ? L.yellow : L.t3)}>
                  🤖
                </button>

                {/* Agendar */}
                <button onClick={() => setAgendarModal(true)} title="Agendar mensagem"
                  style={btnStyle()}>⏰</button>

                {/* Right panel toggle */}
                {!isMobile && (
                  <button onClick={() => setShowRight(p => !p)} title="Painel de info"
                    style={btnStyle(showRight ? L.tealBg : L.surface, showRight ? L.t1 : L.t3)}>
                    ⊞
                  </button>
                )}
              </Row>
            </div>

            {/* Etiquetas da conversa */}
            {convEtiquetas.length > 0 && (
              <div style={{ padding: "6px 14px", borderBottom: `1px solid ${L.lineSoft}`,
                display: "flex", gap: 5, flexWrap: "wrap", background: L.bgWarm }}>
                {convEtiquetas.map(e => (
                  <EtiquetaChip key={e.id} etiqueta={e} onRemove={() => removeEtiqueta(e.id)} />
                ))}
              </div>
            )}

            {/* Mensagens */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px",
              background: "#fafafa", display: "flex", flexDirection: "column", gap: 2 }}>
              {mensagens.length === 0 && (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  color: L.t4, fontSize: 12, textAlign: "center" }}>
                  <div>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>◈</div>
                    Nenhuma mensagem ainda
                  </div>
                </div>
              )}
              {mensagens.map((m, i) => {
                const out = isOutgoing(m);
                const nota = m.is_nota;
                const t = msgTexto(m);
                const h = msgHora(m);
                const prevM = mensagens[i - 1];
                const showDate = !prevM || new Date(msgHora(prevM) || 0).toDateString() !== new Date(h || 0).toDateString();

                return (
                  <div key={m.id}>
                    {showDate && h && (
                      <div style={{ textAlign: "center", margin: "10px 0 6px" }}>
                        <span style={{ fontSize: 10, color: L.t4, background: L.surface,
                          padding: "2px 10px", borderRadius: 10, border: `1px solid ${L.line}` }}>
                          {new Date(h).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                        </span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: out ? "flex-end" : "flex-start", marginBottom: 3 }}>
                      {!out && (
                        <Av name={activeConv.contato_nome || "?"} color={L.t3} size={22}
                          style={{ marginRight: 6, marginTop: 2, flexShrink: 0 }} />
                      )}
                      <div style={{
                        maxWidth: "72%", padding: nota ? "6px 10px" : "8px 12px",
                        borderRadius: out ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                        background: nota ? "#fffbeb" : out ? L.t1 : L.white,
                        color: nota ? "#92400e" : out ? "white" : L.t1,
                        border: nota ? "1px dashed #f59e0b" : `1px solid ${out ? "transparent" : L.line}`,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                        fontSize: 12.5, lineHeight: 1.5, wordBreak: "break-word",
                        opacity: m.status === "enviando" ? 0.6 : 1,
                        transition: "opacity .2s",
                      }}>
                        {nota && <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3, opacity: .7 }}>📝 NOTA INTERNA</div>}
                        {m.remetente === "bot" && !nota && (
                          <div style={{ fontSize: 9, marginBottom: 2, opacity: .7 }}>🤖 Bot</div>
                        )}
                        {t}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3,
                          justifyContent: "flex-end" }}>
                          <span style={{ fontSize: 9, opacity: .5 }}>{fmtHora(h)}</span>
                          {out && !nota && (
                            <span style={{ fontSize: 9, opacity: .6 }}>
                              {m.status === "enviando" ? "⟳" : m.lido ? "✓✓" : m.entregue ? "✓✓" : "✓"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "10px 14px", borderTop: `1px solid ${L.line}`,
              background: L.white, flexShrink: 0 }}>

              {/* Quick replies popup */}
              {showQuick && filteredQuick.length > 0 && (
                <div style={{ background: L.white, border: `1px solid ${L.line}`, borderRadius: 10,
                  boxShadow: "0 4px 20px rgba(0,0,0,.12)", marginBottom: 8, maxHeight: 200, overflowY: "auto" }}>
                  <div style={{ padding: "6px 10px", borderBottom: `1px solid ${L.lineSoft}`,
                    fontSize: 10, color: L.t4, fontWeight: 600 }}>
                    RESPOSTAS RÁPIDAS — /atalho para filtrar
                  </div>
                  {filteredQuick.map(r => (
                    <div key={r.id} onClick={() => { send(r.mensagem); setShowQuick(false); setInput(""); }}
                      style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${L.lineSoft}`, transition: "background .1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = L.surface}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: L.t1 }}>{r.titulo}</div>
                      <div style={{ fontSize: 11, color: L.t3, marginTop: 2, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.mensagem}</div>
                    </div>
                  ))}
                </div>
              )}

              {sendErr && (
                <div style={{ padding: "5px 10px", background: L.redBg, borderRadius: 7, marginBottom: 8,
                  fontSize: 11, color: L.red, border: `1px solid ${L.red}22` }}>
                  {sendErr}
                </div>
              )}

              <Row gap={8}>
                {/* Note toggle */}
                <button onClick={() => {
                  if (input.startsWith("/nota ")) setInput(input.slice(6));
                  else setInput("/nota " + input);
                }}
                  title="Nota interna (/nota texto)"
                  style={{ ...btnStyle(input.startsWith("/nota") ? "#fffbeb" : L.surface, input.startsWith("/nota") ? "#92400e" : L.t3), flexShrink: 0, padding: "7px 10px" }}>
                  📝
                </button>

                <div style={{ flex: 1, position: "relative" }}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={input.startsWith("/nota") ? "Nota interna (não enviada ao contato)..." : "Digite / para respostas rápidas · Enter para enviar · Shift+Enter nova linha"}
                    rows={1}
                    style={{ width: "100%", border: `1px solid ${input.startsWith("/nota") ? "#f59e0b" : L.line}`,
                      borderRadius: 9, padding: "8px 12px", fontSize: 12.5, color: L.t1,
                      background: input.startsWith("/nota") ? "#fffbeb" : L.white,
                      outline: "none", fontFamily: "inherit", resize: "none",
                      maxHeight: 100, overflowY: "auto", boxSizing: "border-box", lineHeight: 1.5 }}
                  />
                </div>

                <button onClick={() => {
                  if (input.startsWith("/nota ")) {
                    sendNote(input.slice(6));
                    setInput("");
                  } else {
                    send();
                  }
                }} disabled={!input.trim() || sending}
                  style={{ ...btnStyle(L.t1, "white"), flexShrink: 0, padding: "8px 14px",
                    opacity: (!input.trim() || sending) ? .4 : 1 }}>
                  {sending ? "⟳" : "↑"}
                </button>
              </Row>
              <div style={{ fontSize: 10, color: L.t4, marginTop: 4, paddingLeft: 2 }}>
                Digite <b>/</b> para respostas rápidas · <b>/nota texto</b> para nota interna
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            color: L.t4, flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 40 }}>◈</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Selecione uma conversa</div>
            <div style={{ fontSize: 11 }}>ou aguarde novas mensagens via WhatsApp</div>
          </div>
        ))}

        {/* ══════════════════ PAINEL DIREITO ════════════════════ */}
        {showRightPanel && (
          <div style={{ width: 260, minWidth: 260, borderLeft: `1px solid ${L.line}`,
            display: "flex", flexDirection: "column", background: L.white }}>

            {/* Abas do painel */}
            <div style={{ display: "flex", borderBottom: `1px solid ${L.line}` }}>
              {[
                { id: "info",      label: "Info"      },
                { id: "etiquetas", label: "Tags"      },
                { id: "agendadas", label: "Agendadas" },
                { id: "log",       label: "Log"       },
              ].map(t => (
                <button key={t.id} onClick={() => setRightTab(t.id)}
                  style={{ flex: 1, padding: "9px 4px", fontSize: 10, fontWeight: rightTab === t.id ? 700 : 400,
                    background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                    color: rightTab === t.id ? L.t1 : L.t3,
                    borderBottom: rightTab === t.id ? `2px solid ${L.t1}` : "2px solid transparent",
                    transition: "all .12s" }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>

              {/* INFO TAB */}
              {rightTab === "info" && activeConv && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Av name={activeConv.contato_nome || "?"} color={L.t1} size={48}
                    style={{ alignSelf: "center" }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: L.t1 }}>
                      {activeConv.contato_nome || "Desconhecido"}
                    </div>
                    {activeConv.contato_empresa && (
                      <div style={{ fontSize: 11, color: L.t3 }}>{activeConv.contato_empresa}</div>
                    )}
                  </div>

                  {[
                    { label: "Telefone", value: activeConv.contato_telefone },
                    { label: "Status", value: STATUS_LABELS[activeConv.status]?.label },
                    { label: "Setor", value: activeConv._setor?.nome },
                    { label: "Atendente", value: activeConv._atendente_nome },
                    { label: "Canal", value: activeConv.canal || "whatsapp" },
                    { label: "Criado em", value: activeConv.created_at ? new Date(activeConv.created_at).toLocaleDateString("pt-BR") : "" },
                  ].filter(x => x.value).map(x => (
                    <div key={x.label} style={{ borderBottom: `1px solid ${L.lineSoft}`, paddingBottom: 8 }}>
                      <div style={{ fontSize: 9, color: L.t4, textTransform: "uppercase", fontWeight: 700, letterSpacing: "1px", marginBottom: 2 }}>{x.label}</div>
                      <div style={{ fontSize: 11.5, color: L.t1 }}>{x.value}</div>
                    </div>
                  ))}

                  {/* Bot ativo */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 10px", background: activeConv.bot_ativo ? L.yellowBg : L.surface,
                    borderRadius: 8, border: `1px solid ${activeConv.bot_ativo ? L.yellow + "44" : L.line}` }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: L.t1 }}>🤖 Chatbot</div>
                      <div style={{ fontSize: 10, color: L.t3 }}>{activeConv.bot_ativo ? "Ativo" : "Inativo"}</div>
                    </div>
                    <button onClick={toggleBot}
                      style={{ ...btnStyle(activeConv.bot_ativo ? L.yellow : L.surface, activeConv.bot_ativo ? "white" : L.t2), fontSize: 10 }}>
                      {activeConv.bot_ativo ? "Desligar" : "Ligar"}
                    </button>
                  </div>

                  {/* Ações rápidas */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <button onClick={() => setTransferModal(true)}
                      style={{ ...btnStyle(L.surface, L.t2), width: "100%", textAlign: "left" }}>
                      ⇄ Transferir conversa
                    </button>
                    <button onClick={() => setAgendarModal(true)}
                      style={{ ...btnStyle(L.surface, L.t2), width: "100%", textAlign: "left" }}>
                      ⏰ Agendar mensagem
                    </button>
                    <button onClick={() => updateConvStatus("resolvida")}
                      style={{ ...btnStyle(L.greenBg, L.green), width: "100%", textAlign: "left" }}>
                      ✓ Marcar resolvida
                    </button>
                  </div>
                </div>
              )}

              {/* ETIQUETAS TAB */}
              {rightTab === "etiquetas" && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: L.t1, marginBottom: 10 }}>
                    Etiquetas desta conversa
                  </div>
                  {convEtiquetas.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                      {convEtiquetas.map(e => (
                        <EtiquetaChip key={e.id} etiqueta={e} onRemove={() => removeEtiqueta(e.id)} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: L.t4, marginBottom: 12 }}>Nenhuma etiqueta aplicada.</div>
                  )}

                  <div style={{ fontSize: 10, color: L.t4, textTransform: "uppercase", fontWeight: 700, letterSpacing: "1px", marginBottom: 6 }}>
                    Adicionar etiqueta
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {etiquetas.filter(e => !convEtiquetas.find(c => c.id === e.id)).map(e => (
                      <button key={e.id} onClick={() => addEtiqueta(e)}
                        style={{ background: e.cor + "11", color: e.cor, border: `1px solid ${e.cor}33`,
                          borderRadius: 10, padding: "2px 8px", fontSize: 10, fontWeight: 600,
                          cursor: "pointer", fontFamily: "inherit" }}>
                        + {e.nome}
                      </button>
                    ))}
                    {etiquetas.length === 0 && (
                      <div style={{ fontSize: 11, color: L.t4 }}>
                        Crie etiquetas em Configurações → Etiquetas.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AGENDADAS TAB */}
              {rightTab === "agendadas" && (
                <div>
                  <Row between mb={10}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: L.t1 }}>Mensagens agendadas</div>
                    <button onClick={() => setAgendarModal(true)} style={btnStyle(L.t1, "white", { fontSize: 10, padding: "3px 8px" })}>
                      + Nova
                    </button>
                  </Row>
                  {agendadas.length === 0 ? (
                    <div style={{ fontSize: 11, color: L.t4, textAlign: "center", padding: "20px 0" }}>
                      Nenhuma mensagem agendada
                    </div>
                  ) : agendadas.map(a => (
                    <div key={a.id} style={{ padding: "8px 10px", background: L.surface, borderRadius: 8,
                      border: `1px solid ${L.line}`, marginBottom: 6 }}>
                      <div style={{ fontSize: 11, color: L.t1, marginBottom: 4 }}>{a.mensagem}</div>
                      <Row between>
                        <span style={{ fontSize: 10, color: L.blue }}>
                          ⏰ {new Date(a.agendado_para).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <button onClick={() => cancelAgendada(a.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: L.red, fontSize: 11 }}>
                          ×
                        </button>
                      </Row>
                    </div>
                  ))}
                </div>
              )}

              {/* LOG TAB */}
              {rightTab === "log" && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: L.t1, marginBottom: 10 }}>
                    Histórico de ações
                  </div>
                  {logsAtend.length === 0 ? (
                    <div style={{ fontSize: 11, color: L.t4, textAlign: "center", padding: "20px 0" }}>
                      Nenhum registro ainda
                    </div>
                  ) : logsAtend.map(l => (
                    <div key={l.id} style={{ borderBottom: `1px solid ${L.lineSoft}`, paddingBottom: 7, marginBottom: 7 }}>
                      <Row between>
                        <span style={{ fontSize: 11, fontWeight: 600, color: L.t1 }}>{l.acao}</span>
                        <span style={{ fontSize: 10, color: L.t4 }}>
                          {fmtHora(l.created_at)}
                        </span>
                      </Row>
                      {l.detalhe && <div style={{ fontSize: 10, color: L.t3, marginTop: 2 }}>{l.detalhe}</div>}
                      {l.usuarios?.nome && <div style={{ fontSize: 10, color: L.t4, marginTop: 1 }}>por {l.usuarios.nome}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══════════ MODALS ══════════ */}
      {novaModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setNovaModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}
            style={{ background: L.white, borderRadius: 12, padding: 24, width: 380, boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: L.t1, marginBottom: 16 }}>Nova conversa</div>
            {[
              { label: "Nome do contato *", key: "nome", placeholder: "João Silva" },
              { label: "Telefone (com DDD)", key: "telefone", placeholder: "11999998888" },
              { label: "Empresa do contato", key: "empresa_contato", placeholder: "Empresa Ltda" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>{f.label}</label>
                <input value={novaForm[f.key]} onChange={e => setNovaForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 12px",
                    fontSize: 12, color: L.t1, background: L.white, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
            ))}
            <Row gap={8} style={{ justifyContent: "flex-end", marginTop: 4 }}>
              <button onClick={() => setNovaModal(false)} style={btnStyle()}>Cancelar</button>
              <button onClick={criarConversa} style={btnStyle(L.t1, "white")}>Criar conversa</button>
            </Row>
          </div>
        </div>
      )}

      {transferModal && activeConv && (
        <TransferModal
          conversa={activeConv}
          atendentes={atendentes}
          setores={setores}
          onTransfer={handleTransfer}
          onClose={() => setTransferModal(false)}
        />
      )}

      {agendarModal && activeConv && (
        <AgendarModal
          conversa={activeConv}
          empresaId={user.empresa_id}
          userId={user.id}
          onClose={() => { setAgendarModal(false); supabase.from("mensagens_agendadas").select("*").eq("conversa_id", activeConv.id).eq("status", "pendente").order("agendado_para").then(({ data }) => setAgendadas(data || [])); }}
        />
      )}
    </div>
  );
}
