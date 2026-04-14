import { useState, useEffect, useRef, useCallback } from "react";
import { L } from "../constants/theme";
import { Av, Row, IBtn } from "../components/ui";
import { supabase } from "../lib/supabase";
import { useBreakpoint } from "../hooks/useBreakpoint";

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
  em_atendimento: { label: "Em atendimento", c: L.teal,   bg: L.tealBg   },
  aguardando:     { label: "Aguardando",     c: L.yellow, bg: L.yellowBg },
  resolvida:      { label: "Resolvida",      c: L.t3,     bg: L.surface  },
};
const STATUS_TABS       = ["todas","aberta","em_atendimento","aguardando","resolvida"];
const STATUS_TAB_LABELS = { todas:"Todas", aberta:"Abertas", em_atendimento:"Atendimento", aguardando:"Aguardando", resolvida:"Resolvidas" };

// Extrai o texto de uma mensagem independente do nome da coluna
const msgTexto = (m) => m?.texto || m?.conteudo || m?.mensagem || m?.corpo || "";
// Extrai o timestamp de uma mensagem
const msgHora  = (m) => m?.hora || m?.created_at || null;
// Verifica se a mensagem é do atendente (enviada pelo sistema)
const isOutgoing = (m) => m?.de === "me" || m?.remetente === "me" || m?.remetente === "atendente" || m?.remetente === "campanha";

export default function PageChat({ user }) {
  const [conversas,    setConversas]    = useState([]);
  const [mensagens,    setMensagens]    = useState([]);
  const [activeConv,   setActiveConv]   = useState(null);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(true);
  const [sending,      setSending]      = useState(false);
  const [sendErr,      setSendErr]      = useState("");
  const [busca,        setBusca]        = useState("");
  const [statusTab,    setStatusTab]    = useState("todas");
  const [novaModal,    setNovaModal]    = useState(false);
  const [novaForm,     setNovaForm]     = useState({ nome:"", telefone:"", empresa_contato:"" });
  const [evoConnected, setEvoConnected] = useState(null);
  const [atendentes,   setAtendentes]   = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [showQuick,    setShowQuick]    = useState(false);
  const [showRight,    setShowRight]    = useState(true);
  const [isNote,       setIsNote]       = useState(false);
  const [noteText,     setNoteText]     = useState("");
  const bottomRef    = useRef(null);
  const activeConvRef = useRef(null);   // ref sempre atualizado para evitar stale closure
  const statusTabRef  = useRef("todas");
  const { isMobile } = useBreakpoint();

  // Mantém refs sincronizados
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);
  useEffect(() => { statusTabRef.current  = statusTab;  }, [statusTab]);

  /* ── dados iniciais ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!user?.empresa_id) return;
    supabase.from("empresas").select("evolution_connected").eq("id", user.empresa_id).single()
      .then(({ data }) => setEvoConnected(data?.evolution_connected ?? false));
    supabase.from("usuarios").select("id, nome").eq("empresa_id", user.empresa_id).eq("ativo", true)
      .then(({ data }) => setAtendentes(data || []));
    supabase.from("respostas_rapidas").select("*").eq("empresa_id", user.empresa_id).eq("ativo", true)
      .then(({ data }) => setQuickReplies(data || []));
  }, [user?.empresa_id]);

  /* ── loadConversas estável via useCallback ─────────────────────────── */
  const loadConversas = useCallback(async (silent = false) => {
    if (!user?.empresa_id) return;
    if (!silent) setLoading(true);
    const tab = statusTabRef.current;
    // Busca conversas + tenta join com atendentes (safe: sem forçar nome de FK)
    let q = supabase
      .from("conversas")
      .select("*")
      .eq("empresa_id", user.empresa_id)
      .order("ultima_hora", { ascending: false, nullsFirst: false });
    if (tab !== "todas") q = q.eq("status", tab);
    const { data, error } = await q;
    if (error) { console.error("Erro ao carregar conversas:", error); if(!silent) setLoading(false); return; }
    const lista = data || [];

    // Enriquece com nome do atendente via segunda query (evita problema de FK name)
    const atendenteIds = [...new Set(lista.filter(c => c.atendente_id).map(c => c.atendente_id))];
    let atendenteMap = {};
    if (atendenteIds.length > 0) {
      const { data: ats } = await supabase.from("usuarios").select("id, nome").in("id", atendenteIds);
      if (ats) ats.forEach(a => { atendenteMap[a.id] = a.nome; });
    }
    const listaEnriquecida = lista.map(c => ({
      ...c,
      _atendente_nome: atendenteMap[c.atendente_id] || null,
    }));

    setConversas(listaEnriquecida);

    // Seleciona primeiro se não houver seleção atual
    if (listaEnriquecida.length > 0 && !activeConvRef.current) {
      setActiveConv(listaEnriquecida[0]);
    }
    // Atualiza conversa ativa se foi modificada
    if (activeConvRef.current) {
      const updated = listaEnriquecida.find(c => c.id === activeConvRef.current.id);
      if (updated) setActiveConv(p => ({ ...p, ...updated }));
    }
    if (!silent) setLoading(false);
  }, [user?.empresa_id]);

  // Carrega ao mudar tab ou empresa
  useEffect(() => { loadConversas(); }, [loadConversas, statusTab]);

  /* ── Realtime CONVERSAS ────────────────────────────────────────────── */
  useEffect(() => {
    if (!user?.empresa_id) return;
    const ch = supabase
      .channel(`conv:${user.empresa_id}:${Date.now()}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "conversas",
        filter: `empresa_id=eq.${user.empresa_id}`
      }, () => loadConversas(true))
      .subscribe();
    // Polling de fallback a cada 8s caso o realtime não dispare
    const timer = setInterval(() => loadConversas(true), 8000);
    return () => { supabase.removeChannel(ch); clearInterval(timer); };
  }, [user?.empresa_id, loadConversas]);

  /* ── loadMensagens ─────────────────────────────────────────────────── */
  const loadMensagens = useCallback(async (convId) => {
    if (!convId) return;
    // Ordena por hora (com fallback para created_at se nula)
    const { data, error } = await supabase
      .from("mensagens")
      .select("*")
      .eq("conversa_id", convId)
      .order("hora",       { ascending: true, nullsFirst: false });
    if (error) { console.error("Erro ao carregar mensagens:", error); return; }
    // Se hora é nulo em todos, usa created_at como fallback
    const msgs = data || [];
    const sorted = msgs.sort((a, b) => {
      const ta = new Date(msgHora(a) || 0).getTime();
      const tb = new Date(msgHora(b) || 0).getTime();
      return ta - tb;
    });
    setMensagens(sorted);
    // Zera contador de não lidas
    await supabase.from("conversas").update({ nao_lidas: 0 }).eq("id", convId);
    setConversas(p => p.map(c => c.id === convId ? { ...c, nao_lidas: 0 } : c));
  }, []);

  /* ── Realtime MENSAGENS ────────────────────────────────────────────── */
  useEffect(() => {
    if (!activeConv?.id) return;
    loadMensagens(activeConv.id);
    const convId = activeConv.id;
    const ch = supabase
      .channel(`msgs:${convId}:${Date.now()}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "mensagens",
        filter: `conversa_id=eq.${convId}`
      }, (payload) => {
        setMensagens(p => {
          if (p.find(m => m.id === payload.new.id)) return p;
          // Remove temporário com mesmo texto e timestamp próximo
          const now = Date.now();
          const filtered = p.filter(m => {
            if (!m.id?.toString().startsWith("tmp-")) return true;
            const diff = now - parseInt(m.id.replace("tmp-",""));
            return diff > 5000; // Remove temporários com mais de 5s
          });
          return [...filtered, payload.new];
        });
        // Scroll para baixo ao receber mensagem
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      })
      .subscribe();
    // Polling de fallback para mensagens a cada 5s
    const timer = setInterval(() => loadMensagens(convId), 5000);
    return () => { supabase.removeChannel(ch); clearInterval(timer); };
  }, [activeConv?.id, loadMensagens]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens.length]);

  /* ── ações ─────────────────────────────────────────────────────────── */
  const selectConv = (c) => {
    setActiveConv(c);
    setMensagens([]);
    setShowQuick(false);
    setIsNote(false);
    setNoteText("");
    setSendErr("");
  };

  const updateConvStatus = async (status) => {
    if (!activeConv) return;
    await supabase.from("conversas").update({ status }).eq("id", activeConv.id);
    setActiveConv(p => ({ ...p, status }));
    setConversas(p => p.map(c => c.id === activeConv.id ? { ...c, status } : c));
  };

  const assignAtendente = async (atendente_id) => {
    if (!activeConv) return;
    await supabase.from("conversas").update({
      atendente_id: atendente_id || null, status: "em_atendimento"
    }).eq("id", activeConv.id);
    const at = atendentes.find(a => a.id === atendente_id);
    setActiveConv(p => ({ ...p, atendente_id, status: "em_atendimento", _atendente_nome: at?.nome || null }));
    setConversas(p => p.map(c => c.id === activeConv.id ? { ...c, atendente_id, status: "em_atendimento", _atendente_nome: at?.nome || null } : c));
  };

  const toggleBot = async () => {
    if (!activeConv) return;
    const novo = !activeConv.bot_ativo;
    await supabase.from("conversas").update({ bot_ativo: novo }).eq("id", activeConv.id);
    setActiveConv(p => ({ ...p, bot_ativo: novo }));
  };

  const saveNote = async () => {
    if (!activeConv || !noteText.trim()) return;
    await supabase.from("conversas").update({ nota_interna: noteText }).eq("id", activeConv.id);
    setActiveConv(p => ({ ...p, nota_interna: noteText }));
    setConversas(p => p.map(c => c.id === activeConv.id ? { ...c, nota_interna: noteText } : c));
    setIsNote(false);
  };

  const send = async () => {
    if (!input.trim() || !activeConv || sending) return;
    const texto = input.trim();
    setInput("");
    setSending(true);
    setSendErr("");
    const tmpId = `tmp-${Date.now()}`;
    const tmpMsg = { id: tmpId, conversa_id: activeConv.id, de: "me", remetente: "me", texto, hora: new Date().toISOString(), status: "enviando" };
    setMensagens(p => [...p, tmpMsg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    // Insere no banco
    const { data: msg, error: dbErr } = await supabase
      .from("mensagens")
      .insert({ conversa_id: activeConv.id, empresa_id: activeConv.empresa_id || user.empresa_id, de: "me", remetente: "me", texto, hora: new Date().toISOString(), status: "enviado" })
      .select()
      .single();

    if (dbErr) {
      // Tenta sem campos que podem não existir
      const { data: msg2, error: dbErr2 } = await supabase
        .from("mensagens")
        .insert({ conversa_id: activeConv.id, empresa_id: activeConv.empresa_id || user.empresa_id, remetente: "atendente", texto, status: "enviado" })
        .select()
        .single();
      if (dbErr2) {
        setSendErr("Erro ao salvar mensagem: " + (dbErr2.message || dbErr.message));
        setMensagens(p => p.filter(m => m.id !== tmpId));
        setSending(false);
        return;
      }
      setMensagens(p => p.map(m => m.id === tmpId ? (msg2 || m) : m));
    } else {
      setMensagens(p => p.map(m => m.id === tmpId ? (msg || m) : m));
    }

    const now = new Date().toISOString();
    await supabase.from("conversas").update({
      ultima_mensagem: texto, ultima_hora: now, status: "em_atendimento"
    }).eq("id", activeConv.id);
    setConversas(p => p.map(c => c.id === activeConv.id ? { ...c, ultima_mensagem: texto, ultima_hora: now, status: "em_atendimento" } : c));

    // Envia via Evolution GO (assíncrono, não bloqueia UI)
    if (activeConv.contato_telefone?.trim()) {
      supabase.functions.invoke("evolution-action", {
        body: { action: "send", empresa_id: user.empresa_id, phone: activeConv.contato_telefone, message: texto }
      }).then(({ error: fnErr }) => {
        if (fnErr) setSendErr("⚠️ Mensagem salva mas não enviada ao WhatsApp: " + (fnErr.message || "verifique a conexão."));
      }).catch(() => setSendErr("⚠️ Mensagem salva mas não enviada ao WhatsApp."));
    }
    setSending(false);
  };

  const criarConversa = async () => {
    if (!novaForm.nome.trim()) return;
    const { data } = await supabase.from("conversas").insert({
      empresa_id: user.empresa_id,
      contato_nome: novaForm.nome.trim(),
      contato_telefone: novaForm.telefone.replace(/\D/g,""),
      contato_empresa: novaForm.empresa_contato.trim(),
      ultima_mensagem: "", ultima_hora: new Date().toISOString(),
      nao_lidas: 0, status: "aberta",
    }).select().single();
    if (data) { setConversas(p => [data, ...p]); setActiveConv(data); setMensagens([]); }
    setNovaModal(false);
    setNovaForm({ nome: "", telefone: "", empresa_contato: "" });
  };

  /* ── filtros ────────────────────────────────────────────────────────── */
  const filtradas = conversas.filter(c =>
    c.contato_nome?.toLowerCase().includes(busca.toLowerCase()) ||
    c.contato_empresa?.toLowerCase().includes(busca.toLowerCase()) ||
    c.contato_telefone?.includes(busca)
  );
  const totalNaoLidas = conversas.reduce((s, c) => s + (c.nao_lidas || 0), 0);

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Banner WhatsApp */}
      {evoConnected === false && (
        <div style={{ padding: "8px 16px", background: "#fffbf0", border: `1px solid ${L.yellow}44`, borderRadius: 10, marginBottom: 10, fontSize: 12 }}>
          ⚠️ <b>WhatsApp desconectado.</b> Conecte em <b>Minha Empresa → Integrações</b>.
        </div>
      )}
      {evoConnected === true && (
        <div style={{ padding: "6px 16px", background: L.greenBg, border: `1px solid ${L.green}33`, borderRadius: 10, marginBottom: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: L.green, display: "inline-block", flexShrink:0 }} />
          <span style={{ color: L.green, fontWeight: 600 }}>WhatsApp conectado</span>
          <span style={{ color: L.t3 }}>· Evolution GO · sincronização em tempo real</span>
        </div>
      )}

      <div style={{ display: "flex", height: isMobile ? "calc(100dvh - 130px)" : "calc(100vh - 170px)", background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>

        {/* ═══ LISTA ESQUERDA ═══════════════════════════════════════════ */}
        {(!isMobile || !activeConv) && (
          <div style={{ width: isMobile ? "100%" : 285, minWidth: isMobile ? 0 : 285, borderRight: isMobile ? "none" : `1px solid ${L.line}`, display: "flex", flexDirection: "column" }}>
            {/* Header da lista */}
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${L.lineSoft}` }}>
              <Row between mb={10}>
                <Row gap={8}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: L.t1 }}>Chat</span>
                  {totalNaoLidas > 0 && (
                    <span style={{ background: L.green, color: "white", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                      {totalNaoLidas}
                    </span>
                  )}
                </Row>
                <Row gap={6}>
                  <button onClick={() => loadConversas()} title="Atualizar" style={btnStyle(L.surface)}>⟳</button>
                  <button onClick={() => setNovaModal(true)} style={btnStyle(L.t1, "white")}>+ Nova</button>
                </Row>
              </Row>
              {/* Busca */}
              <div style={{ display: "flex", alignItems: "center", gap: 7, background: L.surface, border: `1px solid ${L.line}`, borderRadius: 8, padding: "5px 10px", marginBottom: 10 }}>
                <span style={{ color: L.t4, fontSize: 13 }}>⌕</span>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar contato..."
                  style={{ background: "none", border: "none", outline: "none", color: L.t1, fontSize: 12, width: "100%", fontFamily: "inherit" }} />
              </div>
              {/* Abas de status */}
              <div style={{ display: "flex", gap: 2, overflowX: "auto" }}>
                {STATUS_TABS.map(t => (
                  <button key={t} onClick={() => setStatusTab(t)}
                    style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 6, fontSize: 10, cursor: "pointer", fontFamily: "inherit", border: "none", fontWeight: statusTab === t ? 700 : 400, background: statusTab === t ? L.t1 : "transparent", color: statusTab === t ? "white" : L.t3, transition: "all .1s" }}>
                    {STATUS_TAB_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de conversas */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: 24, textAlign: "center", color: L.t4, fontSize: 12 }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>⟳</div>Carregando...
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
                return (
                  <div key={c.id} onClick={() => selectConv(c)}
                    style={{ padding: "11px 14px", cursor: "pointer", borderBottom: `1px solid ${L.lineSoft}`, background: isActive ? L.tealBg+"55" : "transparent", borderLeft: `3px solid ${isActive ? L.teal : "transparent"}`, transition: "all .1s" }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = L.surface; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                    <Row gap={9}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <Av name={c.contato_nome || "?"} color={L.t1} size={36} />
                        {c.nao_lidas > 0 && (
                          <div style={{ position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderRadius: "50%", background: L.green, border: `2px solid ${L.white}` }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Row between>
                          <span style={{ fontSize: 12.5, fontWeight: c.nao_lidas > 0 ? 700 : 500, color: L.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>
                            {c.contato_nome || c.contato_telefone || "Desconhecido"}
                          </span>
                          <span style={{ fontSize: 10, color: L.t4, flexShrink: 0 }}>{fmtHora(c.ultima_hora)}</span>
                        </Row>
                        <div style={{ fontSize: 11, color: L.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                          {c.ultima_mensagem || "Sem mensagens"}
                        </div>
                        <Row gap={4} mt={3}>
                          <span style={{ fontSize: 9, background: st.bg, color: st.c, padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>{st.label}</span>
                          {c._atendente_nome && <span style={{ fontSize: 9, color: L.teal }}>👤 {c._atendente_nome}</span>}
                          {c.bot_ativo && <span style={{ fontSize: 9, color: L.t3 }}>🤖</span>}
                          {c.nao_lidas > 0 && <span style={{ background: L.green, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "white", marginLeft: "auto" }}>{c.nao_lidas}</span>}
                        </Row>
                      </div>
                    </Row>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ ÁREA CENTRAL DE CHAT ═════════════════════════════════════ */}
        {(!isMobile || activeConv) && (activeConv ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

            {/* Header da conversa */}
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${L.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: L.white, gap: 8 }}>
              <Row gap={10} style={{ minWidth: 0, flex: 1 }}>
                {isMobile && (
                  <button onClick={() => setActiveConv(null)} style={btnStyle(L.surface)}>←</button>
                )}
                <Av name={activeConv.contato_nome || "?"} color={L.t1} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: L.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeConv.contato_nome || activeConv.contato_telefone || "Desconhecido"}
                  </div>
                  <div style={{ fontSize: 10, color: L.t3 }}>
                    {activeConv.contato_telefone || "Sem telefone"}
                    {activeConv._atendente_nome && ` · 👤 ${activeConv._atendente_nome}`}
                  </div>
                </div>
              </Row>

              <Row gap={5} style={{ flexShrink: 0 }}>
                {/* Status */}
                <select value={activeConv.status || "aberta"} onChange={e => updateConvStatus(e.target.value)}
                  style={{ fontSize: 11, border: `1px solid ${L.line}`, borderRadius: 7, padding: "4px 8px", background: STATUS_LABELS[activeConv.status]?.bg || L.greenBg, color: STATUS_LABELS[activeConv.status]?.c || L.green, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, outline: "none" }}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>

                {/* Atribuir atendente */}
                <select value={activeConv.atendente_id || ""} onChange={e => assignAtendente(e.target.value)}
                  style={{ fontSize: 11, border: `1px solid ${L.line}`, borderRadius: 7, padding: "4px 8px", background: L.white, color: L.t2, cursor: "pointer", fontFamily: "inherit", outline: "none", maxWidth: 120 }}>
                  <option value="">👤 Atribuir</option>
                  {atendentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>

                {/* Bot toggle */}
                <button onClick={toggleBot}
                  title={activeConv.bot_ativo ? "Bot ativo — clique para desativar" : "Bot inativo — clique para ativar"}
                  style={{ fontSize: 11, border: `1px solid ${activeConv.bot_ativo ? L.teal + "44" : L.line}`, borderRadius: 7, padding: "4px 8px", background: activeConv.bot_ativo ? L.tealBg : L.surface, color: activeConv.bot_ativo ? L.teal : L.t3, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                  🤖 {activeConv.bot_ativo ? "Bot On" : "Bot Off"}
                </button>

                {!isMobile && (
                  <button onClick={() => setShowRight(p => !p)}
                    style={{ fontSize: 11, border: `1px solid ${L.line}`, borderRadius: 7, padding: "4px 8px", background: showRight ? L.surface : L.white, color: L.t3, cursor: "pointer", fontFamily: "inherit" }}>
                    ⊞
                  </button>
                )}

                {activeConv.contato_telefone && (
                  <button onClick={() => window.open(`https://wa.me/${activeConv.contato_telefone.replace(/\D/g,"")}`)}
                    style={{ fontSize: 11, border: `1px solid ${L.green}44`, borderRadius: 7, padding: "4px 8px", background: L.greenBg, color: L.green, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                    WA ↗
                  </button>
                )}
              </Row>
            </div>

            {/* Área de mensagens */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 4, background: "#f0f2f5" }}>
              {mensagens.length === 0 && (
                <div style={{ textAlign: "center", color: L.t4, fontSize: 12, padding: 30 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>◈</div>
                  <div>Nenhuma mensagem ainda.</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Aguardando ou inicie a conversa abaixo.</div>
                </div>
              )}
              {mensagens.map((m, i) => {
                const outgoing = isOutgoing(m);
                const isBot = m.remetente === "bot" || m.de === "bot";
                const isCampanha = m.remetente === "campanha";
                const texto = msgTexto(m);
                if (!texto) return null;

                // Mostrar separador de data
                const horaAtual = msgHora(m);
                const horaAnterior = i > 0 ? msgHora(mensagens[i-1]) : null;
                const showDate = i === 0 || (horaAtual && horaAnterior &&
                  new Date(horaAtual).toDateString() !== new Date(horaAnterior).toDateString());

                return (
                  <div key={m.id}>
                    {showDate && horaAtual && (
                      <div style={{ textAlign: "center", margin: "8px 0" }}>
                        <span style={{ fontSize: 10, color: L.t4, background: "rgba(255,255,255,0.8)", padding: "2px 10px", borderRadius: 10 }}>
                          {new Date(horaAtual).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                        </span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: outgoing ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "70%", padding: "9px 13px",
                        borderRadius: outgoing ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                        background: outgoing ? (isBot ? L.teal : isCampanha ? L.copper : L.t1) : L.white,
                        border: outgoing ? "none" : `1px solid ${L.line}`,
                        fontSize: 12.5, color: outgoing ? "white" : L.t1, lineHeight: 1.55,
                        boxShadow: outgoing ? "none" : "0 1px 2px rgba(0,0,0,0.06)",
                        opacity: m.status === "enviando" ? 0.6 : 1,
                      }}>
                        {isBot      && <div style={{ fontSize: 9, marginBottom: 3, opacity: 0.7 }}>🤖 Bot</div>}
                        {isCampanha && <div style={{ fontSize: 9, marginBottom: 3, opacity: 0.7 }}>📢 Campanha</div>}
                        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{texto}</div>
                        <div style={{ fontSize: 10, marginTop: 3, textAlign: "right", color: outgoing ? "rgba(255,255,255,0.55)" : L.t4 }}>
                          {fmtHora(horaAtual)}
                          {outgoing && (m.status === "enviando" ? " ◷" : " ✓✓")}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Erro de envio */}
            {sendErr && (
              <div style={{ background: "#fff8e1", borderTop: `1px solid ${L.yellow}44`, padding: "7px 14px", fontSize: 11.5, color: "#a37000", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{sendErr}</span>
                <button onClick={() => setSendErr("")} style={{ background: "none", border: "none", cursor: "pointer", color: L.t3, fontSize: 14 }}>×</button>
              </div>
            )}

            {/* Respostas rápidas */}
            {showQuick && quickReplies.length > 0 && (
              <div style={{ background: L.white, borderTop: `1px solid ${L.line}`, padding: "8px 14px", maxHeight: 160, overflowY: "auto" }}>
                <div style={{ fontSize: 10, color: L.t4, marginBottom: 6, fontWeight: 700 }}>RESPOSTAS RÁPIDAS</div>
                {quickReplies.map(r => (
                  <div key={r.id} onClick={() => { setInput(r.mensagem); setShowQuick(false); }}
                    style={{ padding: "6px 10px", borderRadius: 7, cursor: "pointer", marginBottom: 4, background: L.surface, border: `1px solid ${L.line}`, transition: "background .1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = L.tealBg}
                    onMouseLeave={e => e.currentTarget.style.background = L.surface}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: L.teal }}>/{r.titulo}</div>
                    <div style={{ fontSize: 11, color: L.t2, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.mensagem}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Input area */}
            <div style={{ borderTop: `1px solid ${L.line}`, background: L.white, flexShrink: 0 }}>
              {/* Tabs mensagem / nota */}
              <div style={{ display: "flex", gap: 0, padding: "6px 14px 0" }}>
                {[["msg", "💬 Mensagem"], ["nota", "📝 Nota"]].map(([k, l]) => (
                  <button key={k} onClick={() => setIsNote(k === "nota")}
                    style={{ padding: "4px 12px", fontSize: 11, border: "none", borderBottom: `2px solid ${(k === "nota") === isNote ? L.teal : "transparent"}`, background: "none", color: (k === "nota") === isNote ? L.teal : L.t3, cursor: "pointer", fontFamily: "inherit", fontWeight: (k === "nota") === isNote ? 600 : 400, transition: "all .1s" }}>
                    {l}
                  </button>
                ))}
              </div>

              {isNote ? (
                <div style={{ padding: "8px 14px 12px" }}>
                  <textarea
                    value={noteText || activeConv.nota_interna || ""}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Nota interna (não enviada ao contato)..."
                    rows={3}
                    style={{ width: "100%", background: "#fffde7", border: `1.5px solid ${L.yellow}55`, borderRadius: 9, padding: "8px 12px", color: L.t1, fontSize: 12, fontFamily: "inherit", resize: "none", outline: "none", boxSizing: "border-box" }} />
                  <Row gap={8} mt={6}>
                    <button onClick={() => setIsNote(false)} style={btnStyle(L.surface)}>Cancelar</button>
                    <button onClick={saveNote} style={btnStyle(L.teal, "white")}>Salvar nota</button>
                  </Row>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: "8px 14px 12px" }}>
                  {quickReplies.length > 0 && (
                    <button onClick={() => setShowQuick(p => !p)} title="Respostas rápidas"
                      style={{ padding: "8px 10px", borderRadius: 9, background: showQuick ? L.tealBg : L.surface, border: `1px solid ${showQuick ? L.teal + "44" : L.line}`, color: showQuick ? L.teal : L.t3, cursor: "pointer", fontSize: 14, flexShrink: 0 }}>
                      ⚡
                    </button>
                  )}
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
                    rows={1}
                    style={{ flex: 1, background: L.surface, border: `1.5px solid ${L.line}`, borderRadius: 9, padding: "9px 13px", color: L.t1, fontSize: 12.5, fontFamily: "inherit", outline: "none", resize: "none", minHeight: 38, maxHeight: 100 }}
                    onFocus={e => e.target.style.borderColor = L.t1}
                    onBlur={e => e.target.style.borderColor = L.line}
                    onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }}
                  />
                  <button onClick={send} disabled={sending || !input.trim()}
                    style={{ padding: "9px 18px", borderRadius: 9, background: input.trim() ? L.t1 : L.surface, border: "none", color: input.trim() ? "white" : L.t3, fontWeight: 600, cursor: sending || !input.trim() ? "not-allowed" : "pointer", fontSize: 14, flexShrink: 0, transition: "all .15s" }}>
                    {sending ? "⟳" : "➤"}
                  </button>
                </div>
              )}
            </div>
          </div>

        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
            <div style={{ textAlign: "center", color: L.t4 }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>◈</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: L.t2 }}>Selecione uma conversa</div>
              <div style={{ fontSize: 12 }}>ou clique em "+ Nova" para iniciar</div>
            </div>
          </div>
        ))}

        {/* ═══ PAINEL DIREITO ════════════════════════════════════════════ */}
        {activeConv && showRight && !isMobile && (
          <div style={{ width: 240, borderLeft: `1px solid ${L.line}`, display: "flex", flexDirection: "column", overflowY: "auto", background: L.white }}>
            <div style={{ padding: "16px 14px", borderBottom: `1px solid ${L.lineSoft}` }}>
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <Av name={activeConv.contato_nome || "?"} color={L.t1} size={52} />
                <div style={{ fontSize: 13, fontWeight: 700, color: L.t1, marginTop: 8 }}>
                  {activeConv.contato_nome || activeConv.contato_telefone || "Desconhecido"}
                </div>
                {activeConv.contato_empresa && <div style={{ fontSize: 11, color: L.t3, marginTop: 2 }}>{activeConv.contato_empresa}</div>}
              </div>
              {[["📱", activeConv.contato_telefone], ["🏢", activeConv.contato_empresa]].filter(([, v]) => v).map(([ico, v]) => (
                <div key={v} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", fontSize: 11, color: L.t2 }}>
                  <span>{ico}</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${L.lineSoft}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: L.t4, marginBottom: 8, letterSpacing: "1px" }}>ATENDIMENTO</div>
              <div style={{ fontSize: 11, color: L.t3, marginBottom: 4 }}>Status</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: STATUS_LABELS[activeConv.status]?.c || L.green, background: STATUS_LABELS[activeConv.status]?.bg || L.greenBg, padding: "3px 8px", borderRadius: 6, display: "inline-block", marginBottom: 8 }}>
                {STATUS_LABELS[activeConv.status]?.label || "Aberta"}
              </div>
              {activeConv._atendente_nome && (
                <>
                  <div style={{ fontSize: 11, color: L.t3, marginBottom: 4 }}>Atendente</div>
                  <div style={{ fontSize: 12, color: L.t1, fontWeight: 500 }}>👤 {activeConv._atendente_nome}</div>
                </>
              )}
              <div style={{ fontSize: 11, color: L.t3, marginTop: 8 }}>
                Bot: <b style={{ color: activeConv.bot_ativo ? L.teal : L.t3 }}>{activeConv.bot_ativo ? "Ativo" : "Inativo"}</b>
              </div>
            </div>

            {activeConv.nota_interna && (
              <div style={{ padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: L.t4, marginBottom: 8, letterSpacing: "1px" }}>NOTA INTERNA</div>
                <div style={{ fontSize: 11, color: L.t2, background: "#fffde7", padding: "8px 10px", borderRadius: 8, border: `1px solid ${L.yellow}44`, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {activeConv.nota_interna}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ MODAL NOVA CONVERSA ═════════════════════════════════════════ */}
      {novaModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setNovaModal(false)}>
          <div style={{ background: L.white, borderRadius: 14, padding: 24, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 700, color: L.t1, marginBottom: 18 }}>Nova Conversa</div>
            {[["Nome do contato *","nome","Ex: Carlos Silva"],["Telefone com DDI","telefone","5511999990000"],["Empresa","empresa_contato","Nome da empresa"]].map(([l,k,ph]) => (
              <div key={k} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: L.t3, textTransform: "uppercase", letterSpacing: "1.2px", display: "block", marginBottom: 5, fontFamily: "'JetBrains Mono',monospace" }}>{l}</label>
                <input value={novaForm[k]} onChange={e => setNovaForm(p => ({ ...p, [k]: e.target.value }))} placeholder={ph}
                  style={{ width: "100%", background: L.surface, border: `1.5px solid ${L.line}`, borderRadius: 9, padding: "9px 12px", color: L.t1, fontSize: 12.5, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = L.t1} onBlur={e => e.target.style.borderColor = L.line} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={() => setNovaModal(false)} style={{ flex: 1, padding: "9px", borderRadius: 9, background: L.surface, border: `1px solid ${L.line}`, color: L.t2, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5 }}>Cancelar</button>
              <button onClick={criarConversa} style={{ flex: 2, padding: "9px", borderRadius: 9, background: L.t1, border: "none", color: "white", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5 }}>Criar Conversa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = (bg, color = L.t2) => ({
  padding: "5px 10px", borderRadius: 7, fontSize: 11, background: bg,
  border: `1px solid ${L.line}`, color, cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
});
