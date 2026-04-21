import { useState, useEffect, useRef, useCallback } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Fade, Row, PBtn, IBtn, Av } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (iso) => {
  if (!iso) return "";
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 1) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const fmtFull = (iso) => iso
  ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  : "";

const fmtDay = (iso) => {
  if (!iso) return "";
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return "Hoje";
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};

// Presença baseada em last_seen
const presenca = (last_seen) => {
  if (!last_seen) return "offline";
  const diff = (Date.now() - new Date(last_seen).getTime()) / 1000 / 60; // minutos
  if (diff < 3) return "online";
  if (diff < 15) return "ausente";
  return "offline";
};

const corPresenca = (status) => {
  if (status === "online") return "#22c55e";
  if (status === "ausente") return "#eab308";
  return "rgba(255,255,255,.3)";
};

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏", "✅", "💯"];
const VAZIO_CANAL   = { nome: "", tipo: "publico", descricao: "", membros_ids: [] };
const VAZIO_REUNIAO = { titulo: "", descricao: "", data_inicio: "", link: "", participantes_ids: [] };

// Cor determinística por ID (sem depender de coluna cor no banco)
const AV_COLORS = ["#0d9488","#d97706","#3b82f6","#16a34a","#6366f1","#ec4899","#8b5cf6","#0ea5e9","#f59e0b","#ef4444"];
const avatarColor = (id) => AV_COLORS[((id || "x").charCodeAt(0) + (id || "x").charCodeAt(4||0)) % AV_COLORS.length];

// ─── Emoji Picker ────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose }) {
  return (
    <div
      style={{
        position: "absolute", bottom: "100%", right: 0, background: L.white,
        border: `1px solid ${L.line}`, borderRadius: 10, padding: "8px 10px",
        display: "flex", gap: 4, flexWrap: "wrap", width: 220, zIndex: 50,
        boxShadow: "0 4px 20px rgba(0,0,0,.12)",
      }}
      onClick={e => e.stopPropagation()}
    >
      {EMOJIS.map(e => (
        <button
          key={e}
          onClick={() => { onSelect(e); onClose(); }}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "2px 4px", borderRadius: 4 }}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

// ─── Separador de dia ────────────────────────────────────────────────────────
function DaySep({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 8px 6px" }}>
      <div style={{ flex: 1, height: 1, background: L.line }} />
      <span style={{ fontSize: 10, color: L.t4, fontWeight: 600, letterSpacing: ".5px" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: L.line }} />
    </div>
  );
}

// ─── Mensagem individual ─────────────────────────────────────────────────────
function MsgItem({ m, prev, user, onReact, onReply, onPin }) {
  const [hover, setHover] = useState(false);
  const [picker, setPicker] = useState(false);

  const agrupado = prev && prev.usuario_id === m.usuario_id &&
    (new Date(m.created_at) - new Date(prev.created_at)) < 300000 &&
    fmtDay(m.created_at) === fmtDay(prev.created_at);

  const nome = m.usuarios?.nome || "Usuário";
  const isMe = m.usuario_id === user.id;

  const reacoes = (m.reactions || []).reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r.usuario_id);
    return acc;
  }, {});

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPicker(false); }}
      style={{
        display: "flex", gap: 10, marginTop: agrupado ? 1 : 12,
        alignItems: "flex-start", position: "relative", padding: "2px 8px",
        borderRadius: 8, background: hover ? L.surface : "transparent", transition: "background .1s",
      }}
    >
      {/* Avatar ou espaço */}
      <div style={{ width: 34, flexShrink: 0, paddingTop: 1, display: "flex", alignItems: "flex-start" }}>
        {!agrupado
          ? <Av name={nome} size={32} color={avatarColor(m.usuario_id)} src={m.usuarios?.foto_url || m.usuarios?.avatar_url} />
          : <span style={{ fontSize: 9, color: L.t5, paddingTop: 4, paddingLeft: 4, fontFamily: "'JetBrains Mono',monospace" }}>
              {hover ? fmt(m.created_at) : ""}
            </span>
        }
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {!agrupado && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: isMe ? L.teal : L.t1 }}>{nome}</span>
            <span style={{ fontSize: 10, color: L.t4, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(m.created_at)}</span>
            {m.pinned && (
              <span style={{ fontSize: 9, color: L.copper, fontWeight: 600, background: L.copperBg, padding: "1px 6px", borderRadius: 4 }}>
                Fixada
              </span>
            )}
          </div>
        )}

        {/* Reply banner */}
        {m.reply_to_content && (
          <div style={{ borderLeft: `3px solid ${L.teal}`, paddingLeft: 8, marginBottom: 4, fontSize: 11, color: L.t4, fontStyle: "italic" }}>
            {m.reply_to_content.slice(0, 100)}{m.reply_to_content.length > 100 ? "…" : ""}
          </div>
        )}

        <div style={{ fontSize: 13, color: L.t2, lineHeight: 1.55, wordBreak: "break-word" }}>
          {m.content}
        </div>

        {/* Reações */}
        {Object.keys(reacoes).length > 0 && (
          <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
            {Object.entries(reacoes).map(([emoji, uids]) => (
              <button
                key={emoji}
                onClick={() => onReact(m.id, emoji)}
                style={{
                  display: "flex", alignItems: "center", gap: 3, padding: "2px 7px",
                  borderRadius: 12, border: `1px solid ${uids.includes(user.id) ? L.teal : L.line}`,
                  background: uids.includes(user.id) ? L.tealBg : L.surface,
                  cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                  color: uids.includes(user.id) ? L.teal : L.t3,
                }}
              >
                {emoji} <span style={{ fontSize: 11, fontWeight: 600 }}>{uids.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {hover && (
        <div style={{
          position: "absolute", right: 8, top: 2, display: "flex", gap: 2,
          background: L.white, border: `1px solid ${L.line}`, borderRadius: 8,
          padding: "2px 4px", boxShadow: "0 2px 8px rgba(0,0,0,.08)", zIndex: 10,
        }}>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setPicker(p => !p)}
              title="Reagir"
              style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 6px", borderRadius: 5, fontSize: 14, color: L.t3 }}
            >
              😊
            </button>
            {picker && <EmojiPicker onSelect={(e) => onReact(m.id, e)} onClose={() => setPicker(false)} />}
          </div>
          <button
            onClick={() => onReply(m)}
            title="Responder"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 6px", borderRadius: 5, fontSize: 13, color: L.t3 }}
          >
            ↩
          </button>
          <button
            onClick={() => onPin(m.id, !m.pinned)}
            title={m.pinned ? "Desafixar" : "Fixar"}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 6px", borderRadius: 5, fontSize: 13, color: m.pinned ? L.copper : L.t3 }}
          >
            📌
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Painel de Reuniões ──────────────────────────────────────────────────────
function PainelReunioes({ reunioes, user, onNova, onEntrar, onExcluir, reuniaoAtiva, onFecharReuniao }) {
  if (reuniaoAtiva) {
    // Modo reunião ativa — iframe Jitsi embutido
    return (
      <div style={{
        width: 480, minWidth: 480, borderLeft: `1px solid ${L.line}`,
        display: "flex", flexDirection: "column", background: "#000", flexShrink: 0,
      }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1a1d21" }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>🎥 {reuniaoAtiva.titulo || "Reunião"}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)", marginTop: 1 }}>Em andamento · áudio e vídeo ativos</div>
          </div>
          <button
            onClick={onFecharReuniao}
            style={{ background: "#ef4444", border: "none", borderRadius: 7, color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "5px 11px" }}
          >
            Sair
          </button>
        </div>
        <iframe
          src={reuniaoAtiva.link}
          allow="camera;microphone;display-capture;autoplay;clipboard-write"
          style={{ flex: 1, border: "none", width: "100%", minHeight: 0 }}
          title="Reunião"
        />
      </div>
    );
  }

  return (
    <div style={{
      width: 272, minWidth: 272, borderLeft: `1px solid ${L.line}`,
      display: "flex", flexDirection: "column", background: L.surface, flexShrink: 0,
    }}>
      <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${L.lineSoft}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: L.t1 }}>Próximas Reuniões</div>
        <div style={{ fontSize: 10, color: L.t4, marginTop: 1 }}>Videoconferências agendadas</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {reunioes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 10px", color: L.t4, fontSize: 11 }}>
            Nenhuma reunião agendada.{" "}
            <span onClick={onNova} style={{ cursor: "pointer", color: L.teal, fontWeight: 600, fontSize: 12 }}>
              Criar primeira
            </span>
          </div>
        ) : (
          reunioes.map(r => (
            <div key={r.id} style={{ border: `1px solid ${L.line}`, borderRadius: 10, padding: "12px 13px", marginBottom: 8, background: L.white }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: L.t1, flex: 1 }}>{r.titulo}</div>
                {r.criado_por === user.id && (
                  <button
                    onClick={() => onExcluir(r.id)}
                    title="Excluir"
                    style={{ background: "none", border: "none", cursor: "pointer", color: L.t5, fontSize: 12, padding: "0 2px" }}
                    onMouseEnter={e=>e.currentTarget.style.color=L.red}
                    onMouseLeave={e=>e.currentTarget.style.color=L.t5}
                  >×</button>
                )}
              </div>
              <div style={{ fontSize: 10, color: L.t4, marginBottom: r.descricao ? 4 : 10, fontFamily: "'JetBrains Mono',monospace" }}>
                📅 {fmtFull(r.data_inicio)}
              </div>
              {r.descricao && (
                <div style={{ fontSize: 11, color: L.t3, marginBottom: 8, lineHeight: 1.4 }}>{r.descricao}</div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => onEntrar(r)}
                  style={{ flex: 1, padding: "7px", background: L.teal, border: "none", borderRadius: 7, color: "white", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
                >
                  🎥 Entrar
                </button>
                <button
                  onClick={() => window.open(r.link, "_blank")}
                  title="Abrir em nova aba"
                  style={{ padding: "7px 10px", background: L.surface, border: `1px solid ${L.line}`, borderRadius: 7, color: L.t3, fontSize: 11, cursor: "pointer" }}
                >↗</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: "12px", borderTop: `1px solid ${L.lineSoft}` }}>
        <button
          onClick={onNova}
          style={{ width: "100%", padding: "8px", background: L.tealBg, border: `1px solid ${L.line}`, borderRadius: 8, color: L.teal, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
        >
          + Agendar Reunião
        </button>
      </div>
    </div>
  );
}

// ─── Painel de Perfil do Membro ──────────────────────────────────────────────
function PainelMembro({ membro, user, onClose, onDM, onLigar }) {
  const status = presenca(membro.last_seen);
  const cor = corPresenca(status);
  const labelStatus = status === "online" ? "Online" : status === "ausente" ? "Ausente" : "Offline";

  return (
    <div style={{
      width: 260, minWidth: 260, borderLeft: `1px solid ${L.line}`,
      display: "flex", flexDirection: "column", background: L.white, flexShrink: 0,
    }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${L.lineSoft}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: L.t1 }}>Perfil</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: L.t4, fontSize: 16, lineHeight: 1 }}>x</button>
      </div>

      <div style={{ padding: "24px 20px", textAlign: "center" }}>
        <div style={{ marginBottom: 12, position: "relative", display: "inline-block" }}>
          <Av name={membro.nome} size={56} color={avatarColor(membro.id)} src={membro.foto_url || membro.avatar_url} />
          <div style={{
            position: "absolute", bottom: 2, right: 2,
            width: 14, height: 14, borderRadius: "50%",
            background: cor, border: `2px solid ${L.white}`,
          }} />
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, color: L.t1, marginBottom: 2 }}>{membro.nome}</div>
        <div style={{ fontSize: 12, color: L.t3, marginBottom: 6 }}>{membro.cargo || "—"}</div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: L.t4, marginBottom: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: cor }} />
          {labelStatus}
        </div>

        {membro.email && (
          <div style={{ fontSize: 11, color: L.t4, marginBottom: 14, wordBreak: "break-all" }}>
            {membro.email}
          </div>
        )}

        {membro.id !== user.id && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={() => onDM(membro)}
              style={{ width: "100%", padding: "8px", background: L.teal, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Mensagem Direta
            </button>
            <button
              onClick={() => onLigar?.(membro)}
              style={{ width: "100%", padding: "8px", background: L.surface, border: `1px solid ${L.line}`, borderRadius: 8, color: L.t2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              🎥 Ligar agora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export default function PageWorkspace({ user }) {
  // ── state central ─────────────────────────────────────────────────────────
  const [canais,        setCanais]        = useState([]);
  const [canalId,       setCanalId]       = useState(null);
  const [mensagens,     setMensagens]     = useState([]);
  const [texto,         setTexto]         = useState("");
  const [reunioes,      setReunioes]      = useState([]);
  const [membros,       setMembros]       = useState([]);
  const [unread,        setUnread]        = useState({}); // { canalId: count }
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);

  // ── UI extras ─────────────────────────────────────────────────────────────
  const [busca,         setBusca]         = useState("");
  const [replyTo,       setReplyTo]       = useState(null);
  const [membroView,    setMembroView]    = useState(null);
  const [showReunioes,  setShowReunioes]  = useState(true);
  const [pinFilter,     setPinFilter]     = useState(false);
  const [reuniaoAtiva,  setReuniaoAtiva]  = useState(null); // { titulo, link } em andamento

  // ── modais ────────────────────────────────────────────────────────────────
  const [modalCanal,       setModalCanal]       = useState(false);
  const [modalReuniao,     setModalReuniao]      = useState(false);
  const [formCanal,        setFormCanal]         = useState(VAZIO_CANAL);
  const [formReuniao,      setFormReuniao]       = useState(VAZIO_REUNIAO);
  const [saving,           setSaving]            = useState(false);

  // ── edição de canal ───────────────────────────────────────────────────────
  const [modalEditCanal,   setModalEditCanal]    = useState(false);
  const [canalEditando,    setCanalEditando]     = useState(null);
  const [formEditCanal,    setFormEditCanal]     = useState({ nome: "", tipo: "publico", descricao: "" });
  const [editMembrosSel,   setEditMembrosSel]    = useState([]); // uuid[]

  const endRef    = useRef(null);
  const subRef    = useRef(null);
  const presRef   = useRef(null);
  const inputRef  = useRef(null);

  const canal = canais.find(c => c.id === canalId);
  const isDM  = canal?.tipo === "dm";

  // ─── carregamentos ────────────────────────────────────────────────────────
  const loadCanais = useCallback(async () => {
    const { data } = await supabase
      .from("workspace_canais")
      .select("*")
      .eq("empresa_id", user.empresa_id)
      .order("nome");
    const list = data || [];
    setCanais(list);
    if (list.length > 0 && !canalId) setCanalId(list[0].id);
    return list;
  }, [user.empresa_id]); // eslint-disable-line

  const loadMensagens = useCallback(async (id) => {
    if (!id) return;
    const { data } = await supabase
      .from("workspace_mensagens")
      .select("*, usuarios(id, nome, avatar_url, foto_url), reactions:workspace_reactions(*)")
      .eq("canal_id", id)
      .order("created_at")
      .limit(200);
    setMensagens(data || []);
  }, []);

  const loadReunioes = useCallback(async () => {
    const { data } = await supabase
      .from("workspace_reunioes")
      .select("*")
      .eq("empresa_id", user.empresa_id)
      .gte("data_inicio", new Date().toISOString())
      .order("data_inicio")
      .limit(10);
    setReunioes(data || []);
  }, [user.empresa_id]);

  const loadMembros = useCallback(async () => {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nome, cargo, avatar_url, foto_url, whatsapp, last_seen")
      .eq("empresa_id", user.empresa_id)
      .order("nome");
    if (!error) setMembros(data || []);
    else console.warn("[Workspace] loadMembros error:", error);
  }, [user.empresa_id]);

  // Carrega contadores de não lidas para todos os canais
  const loadUnread = useCallback(async (listaCanais) => {
    if (!listaCanais || listaCanais.length === 0) return;

    // Busca last_read_at de todos os canais do usuário
    const { data: reads } = await supabase
      .from("workspace_canal_reads")
      .select("canal_id, last_read_at")
      .eq("usuario_id", user.id);

    const readMap = {};
    (reads || []).forEach(r => { readMap[r.canal_id] = r.last_read_at; });

    const counts = {};
    await Promise.all(
      listaCanais.map(async (c) => {
        const lastRead = readMap[c.id];
        let q = supabase
          .from("workspace_mensagens")
          .select("id", { count: "exact", head: true })
          .eq("canal_id", c.id)
          .neq("usuario_id", user.id);
        if (lastRead) q = q.gt("created_at", lastRead);
        const { count } = await q;
        if (count && count > 0) counts[c.id] = count;
      })
    );
    setUnread(counts);
  }, [user.id]);

  // Marca canal como lido ao entrar
  const marcarLido = useCallback(async (id) => {
    if (!id) return;
    await supabase.from("workspace_canal_reads").upsert(
      { usuario_id: user.id, canal_id: id, last_read_at: new Date().toISOString() },
      { onConflict: "usuario_id,canal_id" }
    );
    setUnread(p => { const n = { ...p }; delete n[id]; return n; });
  }, [user.id]);

  // ─── efeitos ──────────────────────────────────────────────────────────────

  // Atualiza last_seen do usuário logado
  const atualizarLastSeen = useCallback(() => {
    supabase.from("usuarios")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", user.id);
  }, [user.id]);

  // Mount: carrega dados e inicia timer de presença
  useEffect(() => {
    setLoading(true);
    atualizarLastSeen();

    Promise.all([loadCanais(), loadReunioes(), loadMembros()])
      .then(([listaCanais]) => loadUnread(listaCanais))
      .finally(() => setLoading(false));

    // Atualiza last_seen a cada 60 segundos
    const timer = setInterval(atualizarLastSeen, 60000);
    return () => clearInterval(timer);
  }, [loadCanais, loadReunioes, loadMembros, loadUnread, atualizarLastSeen]);

  // Realtime: escuta mudanças de last_seen dos membros da empresa
  useEffect(() => {
    if (presRef.current) supabase.removeChannel(presRef.current);
    presRef.current = supabase
      .channel(`presenca-${user.empresa_id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "usuarios",
        filter: `empresa_id=eq.${user.empresa_id}`,
      }, (payload) => {
        setMembros(prev =>
          prev.map(m => m.id === payload.new.id ? { ...m, last_seen: payload.new.last_seen } : m)
        );
      })
      .subscribe();

    return () => { if (presRef.current) supabase.removeChannel(presRef.current); };
  }, [user.empresa_id]);

  // Realtime: mensagens do canal ativo
  useEffect(() => {
    if (!canalId) return;
    loadMensagens(canalId);
    marcarLido(canalId);

    if (subRef.current) supabase.removeChannel(subRef.current);
    subRef.current = supabase
      .channel(`ws-${canalId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "workspace_mensagens",
        filter: `canal_id=eq.${canalId}`,
      }, async (payload) => {
        if (payload.eventType === "INSERT") {
          const { data: u } = await supabase
            .from("usuarios").select("id, nome, avatar_url, foto_url").eq("id", payload.new.usuario_id).single();
          const { data: rx } = await supabase
            .from("workspace_reactions").select("*").eq("mensagem_id", payload.new.id);
          setMensagens(p => [...p, { ...payload.new, usuarios: u, reactions: rx || [] }]);
          // Marca como lido se for o canal ativo
          marcarLido(canalId);
        } else if (payload.eventType === "UPDATE") {
          setMensagens(p => p.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
        } else if (payload.eventType === "DELETE") {
          setMensagens(p => p.filter(m => m.id !== payload.old.id));
        }
      })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "workspace_reactions",
      }, async () => {
        const { data: msgs } = await supabase
          .from("workspace_mensagens")
          .select("id, reactions:workspace_reactions(*)")
          .eq("canal_id", canalId);
        if (msgs) {
          setMensagens(p => p.map(m => {
            const upd = msgs.find(x => x.id === m.id);
            return upd ? { ...m, reactions: upd.reactions } : m;
          }));
        }
      })
      .subscribe();

    return () => { if (subRef.current) supabase.removeChannel(subRef.current); };
  }, [canalId, loadMensagens, marcarLido]);

  // Scroll para o fim ao receber mensagem
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // ─── ações de mensagens ──────────────────────────────────────────────────
  const enviar = async () => {
    if (!texto.trim() || !canalId || sending) return;
    const content = texto.trim();
    setTexto("");
    setReplyTo(null);
    setSending(true);
    inputRef.current?.focus();

    await supabase.from("workspace_mensagens").insert({
      canal_id:         canalId,
      usuario_id:       user.id,
      content,
      tipo:             "texto",
      reply_to_id:      replyTo?.id || null,
      reply_to_content: replyTo?.content || null,
    });
    setSending(false);
  };

  const reagir = async (msgId, emoji) => {
    const existente = mensagens
      .find(m => m.id === msgId)
      ?.reactions?.find(r => r.usuario_id === user.id && r.emoji === emoji);

    if (existente) {
      await supabase.from("workspace_reactions").delete().eq("id", existente.id);
    } else {
      await supabase.from("workspace_reactions").insert({
        mensagem_id: msgId, usuario_id: user.id, emoji,
      });
    }
  };

  const fixarMsg = async (msgId, pinned) => {
    await supabase.from("workspace_mensagens").update({ pinned }).eq("id", msgId);
    setMensagens(p => p.map(m => m.id === msgId ? { ...m, pinned } : m));
  };

  // ─── DM ─────────────────────────────────────────────────────────────────
  const abrirDM = async (membro) => {
    setMembroView(null);
    const dm = canais.find(c =>
      c.tipo === "dm" &&
      ((c.dm_user_a === user.id && c.dm_user_b === membro.id) ||
       (c.dm_user_a === membro.id && c.dm_user_b === user.id))
    );
    if (dm) { setCanalId(dm.id); return; }

    const nome = `dm-${[user.id, membro.id].sort().join("-")}`;
    const { data } = await supabase.from("workspace_canais").insert({
      empresa_id: user.empresa_id,
      nome,
      tipo:       "dm",
      criado_por: user.id,
      dm_user_a:  user.id,
      dm_user_b:  membro.id,
      dm_nome:    membro.nome,
    }).select().single();
    if (data) {
      setCanais(p => [...p, data]);
      setCanalId(data.id);
    }
  };

  // ─── criar canal ─────────────────────────────────────────────────────────
  const criarCanal = async () => {
    if (!formCanal.nome.trim()) return;
    setSaving(true);
    const slug = formCanal.nome.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    // Sempre inclui o criador nos membros
    const membros_ids = [...new Set([user.id, ...(formCanal.membros_ids || [])])];
    const { data } = await supabase.from("workspace_canais").insert({
      empresa_id:  user.empresa_id,
      nome:        slug,
      tipo:        formCanal.tipo,
      descricao:   formCanal.descricao,
      criado_por:  user.id,
      membros_ids: formCanal.tipo === "privado" ? membros_ids : [],
    }).select().single();
    if (data) { setCanais(p => [...p, data]); setCanalId(data.id); }
    setModalCanal(false); setFormCanal(VAZIO_CANAL); setSaving(false);
  };

  // ─── abrir edição de canal ────────────────────────────────────────────────
  const abrirEditCanal = (c, e) => {
    e.stopPropagation();
    setCanalEditando(c);
    setFormEditCanal({ nome: c.nome, tipo: c.tipo, descricao: c.descricao || "" });
    setEditMembrosSel(c.membros_ids || []);
    setModalEditCanal(true);
  };

  // ─── salvar edição de canal ───────────────────────────────────────────────
  const salvarEdicaoCanal = async () => {
    if (!canalEditando || !formEditCanal.nome.trim()) return;
    setSaving(true);
    const slug = formEditCanal.nome.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { data } = await supabase.from("workspace_canais").update({
      nome:        slug,
      tipo:        formEditCanal.tipo,
      descricao:   formEditCanal.descricao,
      membros_ids: editMembrosSel,
    }).eq("id", canalEditando.id).select().single();
    if (data) setCanais(p => p.map(c => c.id === data.id ? data : c));
    setModalEditCanal(false); setCanalEditando(null); setSaving(false);
  };

  // ─── excluir canal ────────────────────────────────────────────────────────
  const excluirCanal = async () => {
    if (!canalEditando) return;
    if (!window.confirm(`Excluir o canal #${canalEditando.nome}? Todas as mensagens serão perdidas.`)) return;
    await supabase.from("workspace_canais").delete().eq("id", canalEditando.id);
    setCanais(p => p.filter(c => c.id !== canalEditando.id));
    if (canalId === canalEditando.id) setCanalId(null);
    setModalEditCanal(false); setCanalEditando(null);
  };

  // ─── criar reunião ────────────────────────────────────────────────────────
  const criarReuniao = async () => {
    if (!formReuniao.titulo || !formReuniao.data_inicio) return;
    setSaving(true);
    const link = formReuniao.link.trim() ||
      `https://meet.jit.si/c4hub-${(user.empresa_id || "").slice(0, 8)}-${Date.now()}`;
    const { data: nova } = await supabase.from("workspace_reunioes").insert({
      titulo: formReuniao.titulo, descricao: formReuniao.descricao,
      data_inicio: formReuniao.data_inicio,
      link, empresa_id: user.empresa_id, criado_por: user.id,
    }).select().single();
    await loadReunioes();
    setModalReuniao(false); setFormReuniao(VAZIO_REUNIAO); setSaving(false);
    // Pergunta se quer entrar agora
    if (nova && window.confirm(`Reunião criada! Entrar agora em "${nova.titulo}"?`)) {
      setReuniaoAtiva(nova);
      setShowReunioes(true);
      setMembroView(null);
    }
  };

  const ligarParaMembro = (membro) => {
    const ids = [user.id, membro.id].sort();
    const sala = `jitsi-dm-${ids[0].slice(0, 8)}-${ids[1].slice(0, 8)}`;
    const r = { titulo: `Ligação com ${membro.nome.split(" ")[0]}`, link: `https://meet.jit.si/${sala}` };
    setReuniaoAtiva(r);
    setShowReunioes(true);
    setMembroView(null);
  };

  const excluirReuniao = async (id) => {
    await supabase.from("workspace_reunioes").delete().eq("id", id).eq("criado_por", user.id);
    setReunioes(p => p.filter(r => r.id !== id));
  };

  // ─── helpers de lista ─────────────────────────────────────────────────────
  const canaisPublicos = canais.filter(c => c.tipo !== "dm");
  const canaisDM       = canais.filter(c => c.tipo === "dm");

  const msgsFiltradas = mensagens.filter(m => {
    if (pinFilter && !m.pinned) return false;
    if (busca && !m.content?.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  // nome exibido no canal DM — usa membros carregados para resolver o nome do outro usuário
  const nomeCanalDM = (c) => {
    const outroId = c.dm_user_a === user.id ? c.dm_user_b : c.dm_user_a;
    const outro = membros.find(m => m.id === outroId);
    return outro?.nome || c.dm_nome || c.nome;
  };

  const nomeCanalExibido = () => {
    if (!canal) return "";
    if (canal.tipo === "dm") return nomeCanalDM(canal);
    return canal.nome;
  };

  // membros online count
  const membrosOnline = membros.filter(m => presenca(m.last_seen) === "online").length;

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <Fade>
      <div style={{
        display: "flex", height: "calc(100vh - 110px)", borderRadius: 14,
        overflow: "hidden", border: `1px solid ${L.line}`, background: L.white,
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
      }}>

        {/* ══ SIDEBAR ESQUERDA ═══════════════════════════════════════════════ */}
        <div style={{
          width: 236, minWidth: 236, borderRight: `1px solid ${L.line}`,
          display: "flex", flexDirection: "column", background: "#1a1d21", flexShrink: 0,
        }}>
          {/* Header empresa */}
          <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif" }}>
              {user.empresa || "Workspace"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
              {membrosOnline} online &nbsp;&bull;&nbsp; {membros.length} membros
            </div>
          </div>

          {/* Busca rápida */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.08)", borderRadius: 7, padding: "5px 10px" }}>
              <span style={{ color: "rgba(255,255,255,.3)", fontSize: 12 }}>⌕</span>
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar mensagens..."
                style={{ background: "none", border: "none", outline: "none", color: "rgba(255,255,255,.7)", fontSize: 11.5, fontFamily: "inherit", width: "100%" }}
              />
            </div>
          </div>

          {/* Lista scrollável */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>

            {/* Canais */}
            <div style={{ padding: "6px 16px 4px", fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.3)", fontFamily: "'JetBrains Mono',monospace", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              Canais
              <button
                onClick={() => setModalCanal(true)}
                title="Novo canal"
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.35)", fontSize: 17, lineHeight: 1, padding: 0 }}
              >
                +
              </button>
            </div>

            {canaisPublicos.map(c => {
              const ativo = canalId === c.id;
              const badge = unread[c.id];
              const podeEditar = c.criado_por === user.id || user.role === "c4hub_admin" || user.role === "client_admin";
              return (
                <div
                  key={c.id}
                  style={{ position: "relative", display: "flex", alignItems: "center" }}
                  onMouseEnter={e => e.currentTarget.querySelector(".canal-edit-btn")?.style && (e.currentTarget.querySelector(".canal-edit-btn").style.opacity = "1")}
                  onMouseLeave={e => e.currentTarget.querySelector(".canal-edit-btn")?.style && (e.currentTarget.querySelector(".canal-edit-btn").style.opacity = "0")}
                >
                  <button
                    onClick={() => { setCanalId(c.id); setMembroView(null); }}
                    style={{
                      flex: 1, textAlign: "left", padding: "5px 14px 5px 16px",
                      background: ativo ? "rgba(255,255,255,.12)" : "transparent",
                      border: "none", cursor: "pointer",
                      color: ativo ? "#fff" : (badge ? "#fff" : "rgba(255,255,255,.55)"),
                      fontSize: 12.5, fontFamily: "inherit", transition: "all .1s",
                      fontWeight: ativo || badge ? 600 : 400,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                    onMouseEnter={e => { if (!ativo) e.currentTarget.style.background = "rgba(255,255,255,.07)"; }}
                    onMouseLeave={e => { if (!ativo) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span>
                      <span style={{ opacity: .5, marginRight: 4, fontSize: 11 }}>{c.tipo === "privado" ? "🔒" : "#"}</span>
                      {c.nome}
                    </span>
                    {badge > 0 && (
                      <span style={{ background: "#0f766e", color: "#fff", borderRadius: 10, fontSize: 9, fontWeight: 700, padding: "1px 5px", minWidth: 16, textAlign: "center" }}>
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </button>
                  {podeEditar && (
                    <button
                      className="canal-edit-btn"
                      onClick={(e) => abrirEditCanal(c, e)}
                      title="Editar canal"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "rgba(255,255,255,.4)", fontSize: 11, padding: "4px 8px 4px 2px",
                        opacity: 0, transition: "opacity .15s", flexShrink: 0,
                      }}
                    >
                      ✎
                    </button>
                  )}
                </div>
              );
            })}

            {/* Mensagens Diretas */}
            {canaisDM.length > 0 && (
              <>
                <div style={{ padding: "12px 16px 4px", fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.3)", fontFamily: "'JetBrains Mono',monospace" }}>
                  Mensagens Diretas
                </div>
                {canaisDM.map(c => {
                  const ativo = canalId === c.id;
                  const badge = unread[c.id];
                  const outroId = c.dm_user_a === user.id ? c.dm_user_b : c.dm_user_a;
                  const outro = membros.find(m => m.id === outroId);
                  const status = outro ? presenca(outro.last_seen) : "offline";
                  const dotColor = corPresenca(status);
                  const nomeDM = nomeCanalDM(c);

                  return (
                    <button
                      key={c.id}
                      onClick={() => { setCanalId(c.id); setMembroView(null); }}
                      style={{
                        width: "100%", textAlign: "left", padding: "5px 14px 5px 16px",
                        background: ativo ? "rgba(255,255,255,.12)" : "transparent",
                        border: "none", cursor: "pointer",
                        color: ativo ? "#fff" : (badge ? "#fff" : "rgba(255,255,255,.55)"),
                        fontSize: 12.5, fontFamily: "inherit", fontWeight: ativo || badge ? 600 : 400,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}
                      onMouseEnter={e => { if (!ativo) e.currentTarget.style.background = "rgba(255,255,255,.07)"; }}
                      onMouseLeave={e => { if (!ativo) e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>{nomeDM}</span>
                      </div>
                      {badge > 0 && (
                        <span style={{ background: "#0f766e", color: "#fff", borderRadius: 10, fontSize: 9, fontWeight: 700, padding: "1px 5px", minWidth: 16, textAlign: "center" }}>
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </>
            )}

            {/* Membros */}
            <div style={{ padding: "12px 16px 4px", fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.3)", fontFamily: "'JetBrains Mono',monospace" }}>
              Membros ({membros.length})
            </div>

            {membros.map(m => {
              const status = presenca(m.last_seen);
              const dotColor = corPresenca(status);
              const isMe = m.id === user.id;
              return (
                <div
                  key={m.id}
                  style={{ position: "relative", display: "flex", alignItems: "center" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.07)"; e.currentTarget.querySelector(".membro-info-btn")?.style && (e.currentTarget.querySelector(".membro-info-btn").style.opacity="1"); }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.querySelector(".membro-info-btn")?.style && (e.currentTarget.querySelector(".membro-info-btn").style.opacity="0"); }}
                >
                  <button
                    onClick={() => !isMe && abrirDM(m)}
                    title={isMe ? "Você" : `DM com ${m.nome.split(" ")[0]}`}
                    style={{
                      flex: 1, textAlign: "left", padding: "5px 8px 5px 16px",
                      background: "transparent", border: "none",
                      cursor: isMe ? "default" : "pointer", transition: "background .1s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <Av name={m.nome} size={22} color={avatarColor(m.id)} src={m.foto_url || m.avatar_url} />
                        <div style={{ position: "absolute", bottom: -1, right: -1, width: 7, height: 7, borderRadius: "50%", background: dotColor, border: "1.5px solid #1a1d21" }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: isMe ? "#22c55e" : "rgba(255,255,255,.65)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.nome.split(" ")[0]}{isMe ? " (eu)" : ""}
                        </div>
                        {m.cargo && <div style={{ fontSize: 9, color: "rgba(255,255,255,.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.cargo}</div>}
                      </div>
                    </div>
                  </button>
                  {/* Botão perfil — aparece no hover */}
                  <button
                    className="membro-info-btn"
                    onClick={() => setMembroView(membroView?.id === m.id ? null : m)}
                    title="Ver perfil"
                    style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,.35)", fontSize:11, padding:"4px 8px", opacity:0, transition:"opacity .15s", flexShrink:0 }}
                  >
                    👤
                  </button>
                </div>
              );
            })}
          </div>

          {/* Rodapé — usuário logado */}
          <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ position: "relative" }}>
              <Av name={user.nome} size={30} color={avatarColor(user.id)} src={user.foto_url || user.avatar_url} />
              <div style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, borderRadius: "50%", background: "#22c55e", border: "1.5px solid #1a1d21" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.nome}</div>
              <div style={{ fontSize: 10, color: "#22c55e" }}>Online</div>
            </div>
          </div>
        </div>

        {/* ══ AREA CENTRAL DE MENSAGENS ══════════════════════════════════════ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* Header do canal */}
          <div style={{ height: 52, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${L.line}`, flexShrink: 0, background: L.white }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: L.t1, whiteSpace: "nowrap" }}>
                {canal
                  ? <><span style={{ color: L.t4, marginRight: 2 }}>{isDM ? "@" : "#"}</span>{nomeCanalExibido()}</>
                  : <span style={{ color: L.t4, fontSize: 13 }}>Selecione um canal</span>
                }
              </span>
              {/* Botão editar canal (não DM) */}
              {canal && !isDM && (canal.criado_por === user.id || user.role === "c4hub_admin" || user.role === "client_admin") && (
                <button
                  onClick={() => abrirEditCanal(canal, { stopPropagation: ()=>{} })}
                  title="Editar canal"
                  style={{ background: "none", border: `1px solid ${L.line}`, borderRadius: 6, cursor: "pointer", color: L.t4, fontSize: 11, padding: "2px 8px", fontFamily: "inherit" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=L.teal;e.currentTarget.style.color=L.teal;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t4;}}
                >✎ Editar</button>
              )}
              {canal?.descricao && (
                <span style={{ fontSize: 11, color: L.t4, borderLeft: `1px solid ${L.line}`, paddingLeft: 8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth: 200 }}>
                  {canal.descricao}
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
              <button onClick={() => setPinFilter(p => !p)}
                style={{ padding: "4px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: pinFilter ? "#fef9c3" : L.surface, color: pinFilter ? "#a16207" : L.t3, border: `1px solid ${pinFilter ? "#fde047" : L.line}` }}>
                {pinFilter ? "Todas" : "📌 Fixadas"}
              </button>
              <button onClick={() => setShowReunioes(p => !p)}
                style={{ padding: "4px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: showReunioes ? L.tealBg : L.surface, color: showReunioes ? L.teal : L.t3, border: `1px solid ${L.line}` }}>
                🎥 Reuniões
              </button>
              <PBtn onClick={() => setModalReuniao(true)} style={{ padding: "5px 12px", fontSize: 11 }}>
                + Agendar
              </PBtn>
            </div>
          </div>

          {/* Lista de mensagens */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px 4px", display: "flex", flexDirection: "column", background: L.bgWarm }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: L.t4, fontSize: 12 }}>Carregando...</div>
            ) : !canalId ? (
              <div style={{ textAlign: "center", padding: 60, color: L.t4 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: L.t2, marginBottom: 6 }}>Bem-vindo ao Workspace</div>
                <div style={{ fontSize: 12, color: L.t4, maxWidth: 320, margin: "0 auto", lineHeight: 1.6 }}>
                  Selecione um canal na barra lateral ou clique em um membro para iniciar uma conversa.
                </div>
              </div>
            ) : msgsFiltradas.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: L.t4 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{pinFilter ? "📌" : "👋"}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: L.t2, marginBottom: 4 }}>
                  {pinFilter ? "Nenhuma mensagem fixada" : `Inicio de ${isDM ? "conversa" : "#" + canal?.nome}`}
                </div>
                {!pinFilter && (
                  <div style={{ fontSize: 11, color: L.t4 }}>
                    {isDM ? `Envie uma mensagem para ${nomeCanalExibido()}` : "Seja o primeiro a enviar uma mensagem aqui."}
                  </div>
                )}
              </div>
            ) : (
              (() => {
                // Renderiza com separadores de dia
                const items = [];
                let lastDay = null;
                msgsFiltradas.forEach((m, i) => {
                  const day = fmtDay(m.created_at);
                  if (day !== lastDay) {
                    items.push(<DaySep key={`day-${day}`} label={day} />);
                    lastDay = day;
                  }
                  items.push(
                    <MsgItem
                      key={m.id}
                      m={m}
                      prev={i > 0 ? msgsFiltradas[i - 1] : null}
                      user={user}
                      onReact={reagir}
                      onReply={(msg) => { setReplyTo(msg); inputRef.current?.focus(); }}
                      onPin={fixarMsg}
                    />
                  );
                });
                return items;
              })()
            )}
            <div ref={endRef} />
          </div>

          {/* Input de envio */}
          <div style={{ padding: "10px 16px 14px", borderTop: `1px solid ${L.line}`, flexShrink: 0, background: L.white }}>
            {replyTo && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: L.tealBg, border: `1px solid ${L.teal}22`, borderRadius: 8, padding: "6px 12px", marginBottom: 8, fontSize: 11 }}>
                <div style={{ color: L.teal }}>
                  Respondendo: <em style={{ color: L.t2 }}>"{replyTo.content?.slice(0, 80)}{replyTo.content?.length > 80 ? "…" : ""}"</em>
                </div>
                <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: L.t4, fontSize: 14, padding: "0 4px" }}>x</button>
              </div>
            )}

            <div style={{
              display: "flex", gap: 8, alignItems: "flex-end",
              background: L.surface, border: `1.5px solid ${L.line}`,
              borderRadius: 12, padding: "8px 12px", transition: "border-color .15s",
            }}>
              <textarea
                ref={inputRef}
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
                }}
                placeholder={
                  !canalId ? "Selecione um canal..." :
                  isDM ? `Mensagem para ${nomeCanalExibido()}...` :
                  `Mensagem em #${canal?.nome}...`
                }
                disabled={!canalId}
                rows={1}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  resize: "none", fontSize: 13, color: L.t1, fontFamily: "inherit",
                  lineHeight: 1.5, maxHeight: 140, minHeight: 22,
                }}
              />
              <button
                onClick={enviar}
                disabled={!texto.trim() || !canalId || sending}
                style={{
                  background: L.teal, border: "none", borderRadius: 9,
                  width: 34, height: 34, color: "white", cursor: "pointer", fontSize: 16,
                  opacity: (!texto.trim() || !canalId) ? 0.35 : 1, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "opacity .15s, transform .1s",
                }}
                onMouseEnter={e => { if (texto.trim()) e.currentTarget.style.transform = "scale(1.05)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                {sending ? "..." : "↑"}
              </button>
            </div>
            <div style={{ fontSize: 10, color: L.t5, marginTop: 4, textAlign: "right" }}>
              Enter para enviar · Shift+Enter nova linha
            </div>
          </div>
        </div>

        {/* ══ PAINEL DIREITO ════════════════════════════════════════════════ */}
        {membroView ? (
          <PainelMembro
            membro={membroView}
            user={user}
            onClose={() => setMembroView(null)}
            onDM={abrirDM}
            onLigar={ligarParaMembro}
          />
        ) : showReunioes ? (
          <PainelReunioes
            reunioes={reunioes}
            user={user}
            onNova={() => setModalReuniao(true)}
            onEntrar={(r) => { setReuniaoAtiva(r); setMembroView(null); }}
            onExcluir={excluirReuniao}
            reuniaoAtiva={reuniaoAtiva}
            onFecharReuniao={() => setReuniaoAtiva(null)}
          />
        ) : null}
      </div>

      {/* ══ MODAL: Novo Canal ════════════════════════════════════════════════ */}
      {modalCanal && (
        <Modal title="# Novo Canal" onClose={() => { setModalCanal(false); setFormCanal(VAZIO_CANAL); }} width={460}>
          <Field label="Nome do canal *">
            <Input value={formCanal.nome} onChange={v => setFormCanal(p => ({ ...p, nome: v }))} placeholder="ex: vendas, marketing, geral..." autoFocus/>
          </Field>
          <Field label="Descrição (opcional)">
            <Input value={formCanal.descricao} onChange={v => setFormCanal(p => ({ ...p, descricao: v }))} placeholder="Propósito deste canal..."/>
          </Field>
          <Field label="Visibilidade">
            <Select value={formCanal.tipo} onChange={v => setFormCanal(p => ({ ...p, tipo: v }))}>
              <option value="publico">🌐 Público — visível para todos</option>
              <option value="privado">🔒 Privado — apenas convidados</option>
            </Select>
          </Field>
          {formCanal.tipo === "privado" && (
            <Field label="Adicionar membros">
              <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"4px 0"}}>
                {membros.filter(m=>m.id!==user.id).map(m=>{
                  const sel=(formCanal.membros_ids||[]).includes(m.id);
                  return(
                    <button key={m.id} onClick={()=>setFormCanal(p=>({...p,membros_ids:sel?p.membros_ids.filter(x=>x!==m.id):[...(p.membros_ids||[]),m.id]}))}
                      style={{display:"flex",alignItems:"center",gap:5,padding:"4px 9px",borderRadius:20,border:`1.5px solid ${sel?L.teal:L.line}`,background:sel?L.tealBg:"transparent",cursor:"pointer",fontSize:11.5,color:sel?L.teal:L.t3,fontFamily:"inherit"}}>
                      <Av name={m.nome} size={16} color={avatarColor(m.id)}/>{m.nome.split(" ")[0]}{sel&&" ✓"}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}
          <ModalFooter onClose={() => { setModalCanal(false); setFormCanal(VAZIO_CANAL); }} onSave={criarCanal} loading={saving} label="Criar Canal"/>
        </Modal>
      )}

      {/* ══ MODAL: Editar Canal ══════════════════════════════════════════════ */}
      {modalEditCanal && canalEditando && (
        <Modal title={`✎ Editar #${canalEditando.nome}`} onClose={() => { setModalEditCanal(false); setCanalEditando(null); }} width={500}>
          {/* Tabs */}
          {(() => {
            const [tab, setTab] = [formEditCanal._tab||"info", v => setFormEditCanal(p=>({...p,_tab:v}))];
            return (
              <>
                <div style={{display:"flex",gap:2,marginBottom:18,borderBottom:`1px solid ${L.line}`,paddingBottom:0}}>
                  {[["info","📋 Informações"],["membros","👥 Membros"],["perigo","⚠️ Perigo"]].map(([k,l])=>(
                    <button key={k} onClick={()=>setTab(k)}
                      style={{padding:"8px 14px",border:"none",borderBottom:`2px solid ${tab===k?L.teal:"transparent"}`,background:"none",cursor:"pointer",fontSize:12,fontWeight:tab===k?700:400,color:tab===k?L.teal:L.t3,fontFamily:"inherit",transition:"all .12s"}}>
                      {l}
                    </button>
                  ))}
                </div>

                {tab==="info" && (
                  <>
                    <Field label="Nome do canal *">
                      <Input value={formEditCanal.nome} onChange={v=>setFormEditCanal(p=>({...p,nome:v}))} placeholder="nome-do-canal"/>
                    </Field>
                    <Field label="Descrição">
                      <Input value={formEditCanal.descricao||""} onChange={v=>setFormEditCanal(p=>({...p,descricao:v}))} placeholder="Propósito deste canal..."/>
                    </Field>
                    <Field label="Visibilidade">
                      <Select value={formEditCanal.tipo} onChange={v=>setFormEditCanal(p=>({...p,tipo:v}))}>
                        <option value="publico">🌐 Público — visível para todos</option>
                        <option value="privado">🔒 Privado — apenas convidados</option>
                      </Select>
                    </Field>
                    <ModalFooter onClose={()=>{setModalEditCanal(false);setCanalEditando(null);}} onSave={salvarEdicaoCanal} loading={saving} label="Salvar"/>
                  </>
                )}

                {tab==="membros" && (
                  <>
                    <div style={{fontSize:11,color:L.t3,marginBottom:12}}>
                      Marque quem deve ter acesso a este canal. Em canais públicos todos já têm acesso.
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:320,overflowY:"auto"}}>
                      {membros.map(m=>{
                        const sel=editMembrosSel.includes(m.id);
                        const isMe=m.id===user.id;
                        return(
                          <label key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:9,background:sel?L.tealBg:L.surface,border:`1px solid ${sel?L.teal+"44":L.line}`,cursor:isMe?"default":"pointer",transition:"all .1s"}}>
                            <input type="checkbox" checked={sel||isMe} disabled={isMe} onChange={()=>!isMe&&setEditMembrosSel(p=>sel?p.filter(x=>x!==m.id):[...p,m.id])} style={{accentColor:L.teal}}/>
                            <Av name={m.nome} size={24} color={avatarColor(m.id)} src={m.foto_url||m.avatar_url}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12.5,fontWeight:500,color:L.t1}}>{m.nome}{isMe?" (você)":""}</div>
                              {m.cargo&&<div style={{fontSize:10,color:L.t4}}>{m.cargo}</div>}
                            </div>
                            <div style={{width:8,height:8,borderRadius:"50%",background:corPresenca(presenca(m.last_seen)),flexShrink:0}}/>
                          </label>
                        );
                      })}
                    </div>
                    <ModalFooter onClose={()=>{setModalEditCanal(false);setCanalEditando(null);}} onSave={salvarEdicaoCanal} loading={saving} label={`Salvar (${editMembrosSel.length} membros)`}/>
                  </>
                )}

                {tab==="perigo" && (
                  <div style={{padding:"8px 0"}}>
                    <div style={{padding:"16px",background:L.redBg,borderRadius:10,border:`1px solid ${L.red}22`,marginBottom:12}}>
                      <div style={{fontSize:13,fontWeight:700,color:L.red,marginBottom:6}}>⚠️ Excluir canal</div>
                      <div style={{fontSize:12,color:L.t3,marginBottom:14,lineHeight:1.5}}>
                        Isso vai excluir permanentemente o canal <strong>#{canalEditando.nome}</strong> e <strong>todas as mensagens</strong>. Esta ação não pode ser desfeita.
                      </div>
                      <button onClick={excluirCanal}
                        style={{padding:"9px 18px",background:L.red,border:"none",borderRadius:8,color:"white",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        🗑 Excluir canal permanentemente
                      </button>
                    </div>
                    <button onClick={()=>{setModalEditCanal(false);setCanalEditando(null);}}
                      style={{padding:"9px 18px",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit",background:L.surface,color:L.t2,border:`1px solid ${L.line}`}}>
                      Cancelar
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </Modal>
      )}

      {/* ══ MODAL: Agendar Reunião ════════════════════════════════════════════ */}
      {modalReuniao && (
        <Modal title="🗓️ Agendar Reunião" onClose={() => { setModalReuniao(false); setFormReuniao(VAZIO_REUNIAO); }} width={480}>
          <Field label="Título *">
            <Input
              value={formReuniao.titulo}
              onChange={v => setFormReuniao(p => ({ ...p, titulo: v }))}
              placeholder="Reunião de alinhamento semanal..."
              autoFocus
            />
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
            <Field label="Data e Hora *">
              <Input
                type="datetime-local"
                value={formReuniao.data_inicio}
                onChange={v => setFormReuniao(p => ({ ...p, data_inicio: v }))}
              />
            </Field>
            <Field label="Link (opcional)">
              <Input
                value={formReuniao.link}
                onChange={v => setFormReuniao(p => ({ ...p, link: v }))}
                placeholder="meet.jit.si/... (auto)"
              />
            </Field>
          </div>
          <Field label="Pauta / Descrição">
            <Input
              value={formReuniao.descricao}
              onChange={v => setFormReuniao(p => ({ ...p, descricao: v }))}
              placeholder="Tópicos a discutir..."
            />
          </Field>
          <Field label="Convidar membros">
            <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"6px 0"}}>
              {membros.filter(m=>m.id!==user.id).map(m=>{
                const sel = (formReuniao.participantes_ids||[]).includes(m.id);
                return (
                  <button key={m.id}
                    onClick={()=>setFormReuniao(p=>({...p,participantes_ids:sel?p.participantes_ids.filter(x=>x!==m.id):[...(p.participantes_ids||[]),m.id]}))}
                    style={{display:"flex",alignItems:"center",gap:5,padding:"4px 9px",borderRadius:20,border:`1.5px solid ${sel?L.teal:L.line}`,background:sel?L.tealBg:"transparent",cursor:"pointer",fontSize:11.5,color:sel?L.teal:L.t3,fontFamily:"inherit",transition:"all .1s"}}>
                    <Av name={m.nome} size={16} color={avatarColor(m.id)}/>
                    {m.nome.split(" ")[0]}
                    {sel && " ✓"}
                  </button>
                );
              })}
            </div>
          </Field>
          <div style={{ fontSize: 11, color: L.t4, padding: "4px 0 8px" }}>
            💡 Link Jitsi gratuito gerado automaticamente. A reunião abre dentro do sistema.
          </div>
          <ModalFooter
            onClose={() => { setModalReuniao(false); setFormReuniao(VAZIO_REUNIAO); }}
            onSave={criarReuniao}
            loading={saving}
            label="Agendar Reunião"
          />
        </Modal>
      )}
    </Fade>
  );
}
