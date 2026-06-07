import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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

// ─── Notification helpers ────────────────────────────────────────────────────
let _waAudio = null;
function playNotificationSound() {
  // Tenta tocar o arquivo de som real primeiro
  try {
    if (!_waAudio) {
      _waAudio = new Audio("/wa-notify.wav");
      _waAudio.volume = 0.7;
    }
    _waAudio.currentTime = 0;
    _waAudio.play().catch(() => _playFallbackSound());
    return;
  } catch (_) {}
  _playFallbackSound();
}

function _playFallbackSound() {
  // Fallback: síntese de sino via Web Audio API
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [[1319, 0.5], [3634, 0.25], [7128, 0.12]].forEach(([freq, amp]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(amp * 0.35, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now); osc.stop(now + 0.45);
    });
    setTimeout(() => ctx.close(), 800);
  } catch (_) {}
}

function showBrowserNotification(title, body) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "c4os-msg",
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 8000);
  } catch (_) {}
}

// ─── Helpers para mídia criptografada do WhatsApp ────────────────────────────
async function fetchMediaViaWamid(wamid, empresaId) {
  const { data } = await supabase.functions.invoke("evolution-action", {
    body: { action: "fetchMedia", empresa_id: empresaId, wamid },
  });
  if (!data?.base64) throw new Error(data?.error || "Sem base64");
  const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
  const blob  = new Blob([bytes], { type: data.mimetype || "application/octet-stream" });
  return { blobUrl: URL.createObjectURL(blob), mimetype: data.mimetype };
}
const isEncUrl = (u) => u && (u.includes(".enc") || u.includes("t62.7"));

// ─── MediaImage — imagem com lazy-load/descriptografia automática ─────────────
function MediaImage({ url, wamid, out, onImageClick, empresaId, caption }) {
  const needsFetch = isEncUrl(url) || !url;
  const [blobUrl,  setBlobUrl]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [failed,   setFailed]   = useState(false);

  const load = async () => {
    if (loading || blobUrl || !wamid || !empresaId) { if (!wamid) setFailed(true); return; }
    setLoading(true);
    try {
      const { blobUrl: bu } = await fetchMediaViaWamid(wamid, empresaId);
      setBlobUrl(bu);
    } catch { setFailed(true); }
    setLoading(false);
  };

  const displayUrl = blobUrl || (!needsFetch ? url : null);
  const accent = out ? "rgba(255,255,255,.9)" : L.teal;

  if (failed) return (
    <div style={{ fontSize:12, color: out ? "rgba(255,255,255,.5)" : L.t4, padding:"6px 0" }}>⚠ Imagem indisponível</div>
  );

  if (!displayUrl) return (
    <button onClick={load} disabled={loading}
      style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
        background: out ? "rgba(255,255,255,.14)" : L.surface,
        border: `1px solid ${out ? "rgba(255,255,255,.22)" : L.line}`,
        borderRadius:10, cursor: loading ? "wait" : "pointer",
        color: accent, fontSize:12.5, fontFamily:"inherit", outline:"none" }}>
      {loading
        ? <><span style={{ display:"inline-block", animation:"spin .7s linear infinite" }}>⟳</span> Carregando...</>
        : <>🖼 Ver imagem</>}
    </button>
  );

  return (
    <div>
      <img src={displayUrl} alt="imagem"
        onClick={() => onImageClick?.(displayUrl)}
        onError={() => { if (!blobUrl && wamid) load(); else setFailed(true); }}
        style={{ maxWidth:"100%", borderRadius:8, marginBottom: caption ? 4 : 0,
          cursor:"zoom-in", display:"block" }} />
      {caption && <div style={{ fontSize:12, marginTop:2 }}>{caption}</div>}
    </div>
  );
}

// ─── Custom Audio Player (WhatsApp-style) ────────────────────────────────────
function AudioPlayer({ src, wamid, out, empresaId }) {
  const needsFetch = isEncUrl(src) || !src;
  const [playing,   setPlaying]   = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [current,   setCurrent]   = useState(0);
  const [loaded,    setLoaded]    = useState(false);
  const [errored,   setErrored]   = useState(false);
  const [fetching,  setFetching]  = useState(false);
  const [blobSrc,   setBlobSrc]   = useState(null);
  const audioRef = useRef(null);

  const activeSrc = blobSrc || (!needsFetch ? src : null);

  const fetchAndPlay = async () => {
    if (fetching || blobSrc || !wamid || !empresaId) { if (!wamid && !blobSrc) setErrored(true); return; }
    setFetching(true);
    try {
      const { blobUrl, mimetype } = await fetchMediaViaWamid(wamid, empresaId);
      setBlobSrc(blobUrl);
      setLoaded(false);
      if (audioRef.current) {
        audioRef.current.src = blobUrl;
        audioRef.current.load();
        audioRef.current.play().catch(() => {});
        setPlaying(true);
      }
    } catch { setErrored(true); }
    setFetching(false);
  };

  const toggle = () => {
    if (fetching || errored) return;
    if (needsFetch && !blobSrc) { fetchAndPlay(); return; }
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => fetchAndPlay()); setPlaying(true); }
  };

  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a) return;
    setCurrent(a.currentTime);
    setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
  };
  const onLoaded = () => { if (audioRef.current) { setDuration(audioRef.current.duration); setLoaded(true); } };
  const onEnded  = () => { setPlaying(false); setProgress(0); setCurrent(0); if (audioRef.current) audioRef.current.currentTime = 0; };
  const seek     = (e) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };
  const fmt = (s) => {
    if (!s || isNaN(s) || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const accent   = out ? "rgba(255,255,255,.95)" : L.teal;
  const track    = out ? "rgba(255,255,255,.28)" : L.line;
  const dimColor = out ? "rgba(255,255,255,.65)" : L.t4;

  if (errored) return (
    <a href={src || "#"} download target="_blank" rel="noreferrer"
      style={{ display:"flex", alignItems:"center", gap:7, fontSize:12,
        color: out ? "rgba(255,255,255,.85)" : L.teal, textDecoration:"none" }}>
      <span style={{ fontSize:18 }}>⬇</span> Baixar áudio
    </a>
  );

  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:200, maxWidth:260, padding:"2px 0" }}>
      {activeSrc && (
        <audio ref={audioRef} src={activeSrc} preload="metadata"
          onTimeUpdate={onTimeUpdate} onLoadedMetadata={onLoaded}
          onEnded={onEnded} onCanPlay={onLoaded}
          onError={() => { if (!blobSrc) fetchAndPlay(); else setErrored(true); }}
          style={{ display:"none" }} />
      )}

      <button onClick={toggle}
        style={{ width:36, height:36, borderRadius:"50%", border:"none",
          cursor: fetching ? "wait" : "pointer",
          background: out ? "rgba(255,255,255,.22)" : L.tealBg,
          color: accent, fontSize: fetching ? 11 : 13, display:"flex",
          alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .15s",
          opacity: fetching ? 0.7 : 1 }}>
        {fetching ? "⟳" : playing ? "⏸" : "▶"}
      </button>

      <div style={{ flex:1, minWidth:0 }}>
        <div onClick={seek} style={{ height:4, background:track, borderRadius:2,
          cursor:"pointer", marginBottom:5, position:"relative", overflow:"hidden" }}>
          <div style={{ width:`${progress}%`, height:"100%", background:accent,
            borderRadius:2, transition:"width .08s linear" }} />
        </div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:1.5, height:14, marginBottom:4, overflow:"hidden" }}>
          {Array.from({ length: 32 }, (_, i) => {
            const h = [4,6,10,8,13,9,6,12,8,5,11,7,9,14,6,10,8,12,5,9,13,7,11,6,10,8,14,9,6,11,7,9][i % 32];
            const filled = progress / 100 > i / 32;
            return <div key={i} style={{ width:2.5, height:h, borderRadius:2, flexShrink:0,
              background: filled ? accent : track, transition:"background .08s" }} />;
          })}
        </div>
        <div style={{ fontSize:10, color:dimColor, fontFamily:"'JetBrains Mono',monospace", letterSpacing:".5px" }}>
          {fmt(current)} / {fmt(duration || 0)}
        </div>
      </div>
    </div>
  );
}

// ─── Media message renderer ──────────────────────────────────────────────────
function renderMsgContent(m, out, onImageClick, empresaId) {
  const t      = msgTexto(m);
  const tipo   = (m.tipo || m.type || "texto").toLowerCase();
  const url    = m.midia_url || m.url || m.media_url || m.mediaUrl;
  const wamid  = m.wamid;
  const fname  = m.nome_arquivo || "";

  const isImage = (tipo === "imagem" || tipo === "image" || tipo === "imagemessage" || tipo.startsWith("image/"))
    || (tipo === "documento" && /\.(jpe?g|png|gif|webp)$/i.test(fname))
    || (url && !tipo.includes("audio") && !tipo.includes("video") && isEncUrl(url) && /imagem|image/i.test(tipo));
  const isAudio = tipo === "audio" || tipo === "ptt" || tipo === "audiomessage" || tipo.startsWith("audio/")
    || (url && /\.(ogg|mp3|m4a|aac|wav|opus)(\?|$)/i.test(url));
  const isVideo = tipo === "video" || tipo === "videomessage" || tipo.startsWith("video/")
    || (url && /\.(mp4|webm|mov)(\?|$)/i.test(url));
  const isDoc   = !isImage && (tipo === "documento" || tipo === "document" || tipo === "documentmessage"
    || tipo.startsWith("application/"));

  if (isImage) return <MediaImage url={url} wamid={wamid} out={out} onImageClick={onImageClick} empresaId={empresaId} caption={t} />;
  if (isAudio) return (
    <div>
      <AudioPlayer src={url} wamid={wamid} out={out} empresaId={empresaId} />
      {t && <div style={{ fontSize:11, marginTop:3, opacity:.8 }}>{t}</div>}
    </div>
  );
  if (isVideo) return (
    <div>
      <video controls src={url} onClick={e => e.stopPropagation()}
        style={{ maxWidth:"100%", maxHeight:220, borderRadius:8, marginBottom: t ? 4 : 0, display:"block" }}/>
      {t && <div style={{ fontSize:12, marginTop:2 }}>{t}</div>}
    </div>
  );
  if (isDoc) return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ color: out ? "rgba(255,255,255,.9)" : L.blue, display:"flex", alignItems:"center", gap:5, textDecoration:"none" }}>
      <span>📎</span>
      <span style={{ textDecoration:"underline", fontSize:12, wordBreak:"break-all" }}>
        {fname || t || "Documento"}
      </span>
    </a>
  );
  return t ? t.split("\n").map((line, i) => (
    <span key={i}>{line}{i < t.split("\n").length - 1 && <br/>}</span>
  )) : null;
}

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
              style={{ ...btnStyle(destTipo === t ? L.accent : L.surface, destTipo === t ? "white" : L.t2), flex: 1, textTransform: "capitalize" }}>
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
            style={destId ? { ...btnStyle(L.accent, "white") } : { ...btnStyle(L.surface, L.t3), cursor: "not-allowed", border: `1px solid ${L.line}` }}>
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

  // Data mínima = agora + 2 min (para não agendar no passado)
  const minDT = new Date(Date.now() + 2 * 60000).toISOString().slice(0, 16);

  const handleSave = async () => {
    if (!mensagem.trim()) { setErr("Digite a mensagem."); return; }
    if (!dataHora)         { setErr("Escolha a data e hora."); return; }
    if (new Date(dataHora) <= new Date()) { setErr("A data deve ser no futuro."); return; }
    setSaving(true);
    const { error } = await supabase.from("mensagens_agendadas").insert({
      empresa_id:   empresaId,
      conversa_id:  conversa.id,
      destinatario: conversa.contato_telefone,
      mensagem:     mensagem.trim(),
      agendado_para: new Date(dataHora).toISOString(),
      status:       "pendente",
      criado_por:   userId,
    });
    if (error) { setErr(error.message); setSaving(false); return; }
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}
        style={{ background: L.white, borderRadius: 14, padding: 24, width: 420, boxShadow: "0 12px 48px rgba(0,0,0,.22)", border: `1px solid ${L.line}` }}>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: L.tealA, border: `1px solid ${L.tealA2}`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⏰</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: L.t1 }}>Agendar mensagem</div>
            <div style={{ fontSize: 10.5, color: L.t3 }}>Para: {conversa?.contato_nome || conversa?.contato_telefone}</div>
          </div>
        </div>

        <label style={{ fontSize: 11, fontWeight: 600, color: L.t3, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".5px" }}>Data e hora do envio</label>
        <input type="datetime-local" value={dataHora} min={minDT} onChange={e => setDataHora(e.target.value)}
          style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "9px 12px",
            fontSize: 12.5, color: L.t1, background: L.surface, outline: "none", fontFamily: "inherit", marginBottom: 14, boxSizing: "border-box" }} />

        <label style={{ fontSize: 11, fontWeight: 600, color: L.t3, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".5px" }}>Mensagem</label>
        <textarea value={mensagem} onChange={e => setMensagem(e.target.value)}
          placeholder="Digite o texto que será enviado automaticamente..."
          rows={4}
          style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "9px 12px",
            fontSize: 12.5, color: L.t1, background: L.surface, outline: "none", fontFamily: "inherit",
            resize: "vertical", marginBottom: 14, boxSizing: "border-box" }} />

        {err && (
          <div style={{ background: L.redBg, border: `1px solid ${L.redA2}`, borderRadius: 7, padding: "7px 10px",
            color: L.red, fontSize: 11.5, marginBottom: 12 }}>⚠ {err}</div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnStyle()}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            style={btnStyle(L.accent, "white")}>
            {saving ? "Salvando..." : "⏰ Agendar envio"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function PageChat({ user, openPhone, onChatTargetUsed }) {
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
  const [rightTab,     setRightTab]     = useState("info"); // info | etiquetas | agendadas | log | script
  const [convEtiquetas,setConvEtiquetas]= useState([]);

  // ── script / fluxo vendedor ───────────────────────────────────────────────
  const [scriptFluxo,  setScriptFluxo]  = useState(null);
  const [scriptPassos, setScriptPassos] = useState([]);
  const [scriptSending,setScriptSending]= useState(null);
  const [logsAtend,    setLogsAtend]    = useState([]);
  const [agendadas,    setAgendadas]    = useState([]);
  const [showRight,    setShowRight]    = useState(true);

  // ── distribuição de atendentes (round-robin) ──────────────────────────────
  const [distModal,    setDistModal]    = useState(false);
  const [distCfg,      setDistCfg]      = useState(null);
  const [distVendedores, setDistVendedores] = useState([]);
  const [distSaving,   setDistSaving]   = useState(false);
  const [distMsg,      setDistMsg]      = useState("");

  useEffect(() => {
    if (!user?.empresa_id) return;
    supabase.from("distribuicao_atendimento").select("*").eq("empresa_id", user.empresa_id).maybeSingle()
      .then(({ data }) => setDistCfg(data));
    supabase.from("usuarios").select("id, nome, foto_url, ativo, cargo").eq("empresa_id", user.empresa_id).eq("ativo", true).order("nome")
      .then(({ data }) => setDistVendedores(data || []));
  }, [user?.empresa_id]);

  const saveDistCfg = async (patch) => {
    setDistSaving(true); setDistMsg("");
    const next = { ...(distCfg || {}), ...patch, empresa_id: user.empresa_id };
    if (distCfg?.id) {
      await supabase.from("distribuicao_atendimento").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", distCfg.id);
    } else {
      const { data } = await supabase.from("distribuicao_atendimento")
        .insert({ empresa_id: user.empresa_id, ativo: true, vendedores_ids: [], proximo_indice: 0, ...patch })
        .select().single();
      if (data) next.id = data.id;
    }
    setDistCfg(next);
    setDistMsg("Salvo!"); setTimeout(() => setDistMsg(""), 2000);
    setDistSaving(false);
  };

  const toggleDistVendedor = (id) => {
    const ids = distCfg?.vendedores_ids || [];
    const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
    setDistCfg(p => ({ ...p, vendedores_ids: next }));
  };

  // ── modals / panels ───────────────────────────────────────────────────────
  const [novaModal,    setNovaModal]    = useState(false);
  const [novaForm,     setNovaForm]     = useState({ nome: "", telefone: "", empresa_contato: "" });
  const [savingNova,   setSavingNova]   = useState(false);
  const [novaErr,      setNovaErr]      = useState("");
  const [transferModal,setTransferModal]= useState(false);
  const [agendarModal, setAgendarModal] = useState(false);
  const [showQuick,    setShowQuick]    = useState(false);
  const [quickFilter,  setQuickFilter]  = useState("");

  // ── media upload ──────────────────────────────────────────────────────────
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // ── profile photos cache (phone → url) ───────────────────────────────────
  const [profilePhotos, setProfilePhotos] = useState({});
  const fetchedPhonesRef = useRef(new Set()); // guarda phones JÁ BUSCADOS com sucesso ou null
  const failedPhonesRef  = useRef(new Set()); // phones que retornaram null (não retry em sessão)

  // ── presence / digitando ──────────────────────────────────────────────────
  const [typingMap, setTypingMap] = useState({}); // { phone: expiresAt }

  // ── etiqueta filter ───────────────────────────────────────────────────────
  const [etiquetaFiltro,  setEtiquetaFiltro]  = useState(null); // etiqueta.id | null
  const [convEtiquetasMap,setConvEtiquetasMap] = useState({}); // { conversa_id: [etiqueta_id,...] }

  // ── audio recording ───────────────────────────────────────────────────────
  const [recording,     setRecording]     = useState(false);
  const [recSeconds,    setRecSeconds]    = useState(0);
  const mediaRecorderRef = useRef(null);
  const recChunksRef     = useRef([]);
  const recTimerRef      = useRef(null);

  // ── lightbox ──────────────────────────────────────────────────────────────
  const [lightboxImg, setLightboxImg] = useState(null);

  // ── notifications ─────────────────────────────────────────────────────────
  const [toast, setToast]         = useState(null); // { msg, tipo }
  // Lê permissão sincronamente para evitar flash do banner
  const [notifPerm, setNotifPerm] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted"
  );

  // ── refs ──────────────────────────────────────────────────────────────────
  const bottomRef      = useRef(null);
  const activeConvRef  = useRef(null);
  const statusTabRef   = useRef("todas");
  const inputRef       = useRef(null);
  const fileRef        = useRef(null);
  const { isMobile, isTablet } = useBreakpoint();

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
    // Carrega TODOS os usuários da empresa (sem filtro de ativo)
    supabase.from("usuarios").select("id, nome, avatar_url, foto_url, cargo, departamento_id")
      .eq("empresa_id", user.empresa_id)
      .then(({ data, error }) => { if (!error) setAtendentes(data || []); else console.warn("[Chat] usuarios query error:", error); });
    // Carrega TODOS os setores da empresa (sem filtro de ativo)
    supabase.from("setores").select("*")
      .eq("empresa_id", user.empresa_id)
      .order("ordem")
      .then(({ data, error }) => { if (!error) setSetores(data || []); else console.warn("[Chat] setores query error:", error); });
    supabase.from("etiquetas").select("*").eq("empresa_id", user.empresa_id).eq("ativo", true)
      .then(({ data }) => setEtiquetas(data || []));
    supabase.from("respostas_rapidas").select("*").eq("empresa_id", user.empresa_id).eq("ativo", true)
      .then(({ data }) => setQuickReplies(data || []));
  }, [user?.empresa_id]);

  // ── permissão de notificação — não auto-solicita (browser bloqueia sem gesto)
  // O banner com botão "Ativar" é exibido quando não está granted
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setNotifPerm(Notification.permission === "granted");
  }, []);

  // ── badge no título da aba ────────────────────────────────────────────────
  useEffect(() => {
    const total = conversas.reduce((s, c) => s + (c.nao_lidas || 0), 0);
    document.title = total > 0 ? `(${total}) WhatsApp · C4 OS` : "C4 OS";
    return () => { document.title = "C4 OS"; };
  }, [conversas]);

  // ── batch fetch de fotos de perfil (contatos e grupos) ───────────────────
  useEffect(() => {
    if (!conversas.length || !user?.empresa_id) return;
    const missing = conversas
      .map(c => c.contato_telefone)
      .filter(p => p && !profilePhotos[p] && !fetchedPhonesRef.current.has(p) && !failedPhonesRef.current.has(p));
    if (!missing.length) return;
    // Marca como em busca ANTES de chamar — evita duplicatas concorrentes
    missing.slice(0, 40).forEach(p => fetchedPhonesRef.current.add(p));
    missing.slice(0, 40).forEach((phone, i) => {
      setTimeout(() => {
        supabase.functions.invoke("evolution-action", {
          body: { action: "fetchProfilePhoto", empresa_id: user.empresa_id, phone },
        }).then(({ data }) => {
          if (data?.photoUrl) {
            setProfilePhotos(prev => ({ ...prev, [phone]: data.photoUrl }));
          } else {
            // Sem foto: remove do "buscando" e coloca em "falhou" para não tentar de novo na sessão
            fetchedPhonesRef.current.delete(phone);
            failedPhonesRef.current.add(phone);
          }
        }).catch(() => { fetchedPhonesRef.current.delete(phone); });
      }, i * 350);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversas.length, user?.empresa_id]);

  // ── subscription a notificações pessoais (transferências / atribuições) ───
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase.channel(`notif:${user.id}:${Date.now()}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notificacoes",
        filter: `usuario_id=eq.${user.id}`,
      }, (payload) => {
        const n = payload.new;
        playNotificationSound();
        showBrowserNotification(n.titulo || "Nova notificação", n.conteudo || "");
        setToast({ msg: n.conteudo || n.titulo || "Você recebeu uma notificação", tipo: n.tipo || "info" });
        setTimeout(() => setToast(null), 7000);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.id]);

  // ── presença / "digitando..." via Realtime broadcast ─────────────────────
  useEffect(() => {
    if (!user?.empresa_id) return;
    const ch = supabase.channel(`typing:${user.empresa_id}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload?.phone) return;
        const exp = Date.now() + 4000;
        setTypingMap(prev => ({ ...prev, [payload.phone]: exp }));
        setTimeout(() => {
          setTypingMap(prev => {
            const next = { ...prev };
            if (next[payload.phone] <= Date.now()) delete next[payload.phone];
            return next;
          });
        }, 4200);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.empresa_id]);

  // ── carregar mapa de etiquetas de todas as conversas ─────────────────────
  useEffect(() => {
    if (!user?.empresa_id) return;
    supabase.from("conversa_etiquetas")
      .select("conversa_id, etiqueta_id")
      .then(({ data }) => {
        if (!data) return;
        const map = {};
        data.forEach(({ conversa_id, etiqueta_id }) => {
          if (!map[conversa_id]) map[conversa_id] = [];
          map[conversa_id].push(etiqueta_id);
        });
        setConvEtiquetasMap(map);
      });
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

        // Som + notificação apenas para mensagens recebidas (não enviadas por nós)
        if (!isOutgoing(payload.new)) {
          playNotificationSound();
          if (document.visibilityState !== "visible") {
            const conv = activeConvRef.current;
            showBrowserNotification(
              conv?.contato_nome || conv?.contato_telefone || "Nova mensagem",
              msgTexto(payload.new) || "📎 Mídia recebida"
            );
          }
        }
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
    // agendadas — mostra pendentes + histórico recente (enviado/falhou/cancelado)
    supabase.from("mensagens_agendadas").select("*")
      .eq("conversa_id", activeConv.id)
      .order("agendado_para", { ascending: false })
      .limit(20)
      .then(({ data }) => setAgendadas(data || []));
    // fluxo de vendas: prioridade 1 = fluxo do vendedor, 2 = fluxo da empresa
    (async () => {
      setScriptFluxo(null); setScriptPassos([]);
      let fluxo = null;
      if (user?.id) {
        const { data: personal } = await supabase.from("chatbot_fluxos")
          .select("id, nome, descricao, ativo, usuario_id, nos, conexoes")
          .eq("empresa_id", user.empresa_id).eq("usuario_id", user.id).eq("ativo", true)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        fluxo = personal;
      }
      if (!fluxo) {
        const { data: empresa } = await supabase.from("chatbot_fluxos")
          .select("id, nome, descricao, ativo, usuario_id, nos, conexoes")
          .eq("empresa_id", user.empresa_id).is("usuario_id", null).eq("ativo", true)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        fluxo = empresa;
      }
      if (fluxo) {
        setScriptFluxo(fluxo);
        // Extrai nós de mensagem em ordem topológica a partir do nó "inicio"
        const ns = fluxo.nos || [];
        const cs = fluxo.conexoes || [];
        const ordered = [];
        const visited = new Set();
        const walk = (id) => {
          if (visited.has(id)) return;
          visited.add(id);
          const no = ns.find(n => n.id === id);
          if (no && ["mensagem","respostas","lista"].includes(no.tipo) && no.mensagem?.trim()) {
            ordered.push(no);
          }
          cs.filter(c => c.de === id).forEach(c => walk(c.para));
        };
        const inicio = ns.find(n => n.tipo === "inicio");
        if (inicio) walk(inicio.id);
        // Passos sem conexão ao início também incluídos
        ns.filter(n => ["mensagem","respostas","lista"].includes(n.tipo) && !visited.has(n.id) && n.mensagem?.trim())
          .forEach(n => ordered.push(n));
        setScriptPassos(ordered);
      }
    })();
  }, [activeConv?.id]);

  // ── realtime mensagens_agendadas (auto-atualiza aba Agendadas) ────────────
  useEffect(() => {
    if (!activeConv?.id) return;
    const convId = activeConv.id;
    const reloadAgendadas = () =>
      supabase.from("mensagens_agendadas").select("*")
        .eq("conversa_id", convId)
        .order("agendado_para", { ascending: false })
        .limit(20)
        .then(({ data }) => setAgendadas(data || []));

    const ch = supabase.channel(`agend:${convId}:${Date.now()}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "mensagens_agendadas",
        filter: `conversa_id=eq.${convId}`,
      }, () => reloadAgendadas())
      .subscribe();

    // Polling a cada 30s como fallback (realtime pode falhar em edge cases)
    const timer = setInterval(reloadAgendadas, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(timer); };
  }, [activeConv?.id]);

  // ── actions ───────────────────────────────────────────────────────────────
  const selectConv = (c) => {
    setActiveConv(c);
    setMensagens([]);
    setShowQuick(false);
    setQuickFilter("");
    setSendErr("");
    setInput("");
    // Busca foto de perfil lazily (se ainda não cacheada)
    const phone = c?.contato_telefone;
    if (phone && !profilePhotos[phone] && user?.empresa_id) {
      supabase.functions.invoke("evolution-action", {
        body: { action: "fetchProfilePhoto", empresa_id: user.empresa_id, phone },
      }).then(({ data }) => {
        if (data?.photoUrl) {
          setProfilePhotos(prev => ({ ...prev, [phone]: data.photoUrl }));
        }
      }).catch(() => {});
    }
  };

  // ── auto-abrir conversa quando vindo de Leads / Pipeline ─────────────────
  useEffect(() => {
    if (!openPhone || loading) return; // aguarda conversas carregarem
    const isObj = typeof openPhone === "object" && openPhone !== null;
    const rawPhone = isObj ? openPhone.phone : openPhone;
    const nome     = isObj ? (openPhone.nome || "") : "";
    const tel = rawPhone.replace(/\D/g, "");
    // Match exato ou com prefixo 55 (DDI)
    const found = conversas.find(c => {
      const ct = (c.contato_telefone || "").replace(/\D/g, "");
      return ct === tel || ct.endsWith(tel) || tel.endsWith(ct);
    });
    if (found) {
      selectConv(found);
    } else {
      // Sem conversa existente → abre modal Nova Conversa pré-preenchido
      setNovaForm({ nome, telefone: tel, empresa_contato: "" });
      setNovaModal(true);
    }
    onChatTargetUsed?.();
  }, [openPhone, conversas, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateConvStatus = async (status) => {
    if (!activeConv) return;
    await supabase.from("conversas").update({ status }).eq("id", activeConv.id);
    setActiveConv(p => ({ ...p, status }));
    setConversas(p => p.map(c => c.id === activeConv.id ? { ...c, status } : c));
    logAtendimento(user.empresa_id, activeConv.id, user.id,
      status === "resolvida" ? "resolveu" : status === "em_atendimento" ? "reabriu" : "status_alterado",
      `Status: ${status}`);

    // CSAT: ao resolver, envia pesquisa de satisfação se habilitado e conversa tem telefone
    if (status === "resolvida" && activeConv.contato_telefone && !activeConv.csat_enviado) {
      const { data: emp } = await supabase.from("empresas")
        .select("csat_ativo, csat_mensagem, evolution_instance_id, evolution_instance_token")
        .eq("id", user.empresa_id).single();
      if (emp?.csat_ativo && emp?.evolution_instance_token) {
        const msg = emp.csat_mensagem || "Como você avalia nosso atendimento? Responda com um número de 1 a 5 (1 = péssimo, 5 = ótimo)";
        supabase.functions.invoke("evolution-action", {
          body: { action: "sendText", empresa_id: user.empresa_id, phone: activeConv.contato_telefone, text: msg },
        }).then(() => {
          supabase.from("conversas").update({ csat_enviado: true }).eq("id", activeConv.id);
        }).catch(() => {});
      }
    }
  };

  // Assume uma conversa da fila diretamente pelo id (sem precisar ser a ativa)
  const assumirConversa = async (convId, e) => {
    e?.stopPropagation();
    await supabase.from("conversas").update({
      atendente_id: user.id, status: "em_atendimento"
    }).eq("id", convId);
    setConversas(p => p.map(c => c.id === convId
      ? { ...c, atendente_id: user.id, status: "em_atendimento", _atendente_nome: user.nome }
      : c));
    if (activeConv?.id === convId)
      setActiveConv(p => ({ ...p, atendente_id: user.id, status: "em_atendimento", _atendente_nome: user.nome }));
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

    // Notifica o atendente destinatário (se não for o próprio usuário)
    if (atendente_id && atendente_id !== user.id) {
      supabase.from("notificacoes").insert({
        empresa_id:  user.empresa_id,
        usuario_id:  atendente_id,
        tipo:        "atribuicao",
        titulo:      "Conversa atribuída a você",
        conteudo:    `"${activeConv.contato_nome || activeConv.contato_telefone || "Contato"}" foi atribuído a você`,
        conversa_id: activeConv.id,
        lida:        false,
      }).catch(() => {}); // silencia erro se tabela não existir
    }
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

    // Notifica o destinatário da transferência
    if (destTipo === "atendente" && destId && destId !== user.id) {
      supabase.from("notificacoes").insert({
        empresa_id:  user.empresa_id,
        usuario_id:  destId,
        tipo:        "transferencia",
        titulo:      "Conversa transferida para você",
        conteudo:    `"${activeConv.contato_nome || activeConv.contato_telefone || "Contato"}" foi transferido para você por ${user.nome || "um colega"}${obs ? ` · "${obs}"` : ""}`,
        conversa_id: activeConv.id,
        lida:        false,
      }).catch(() => {});
    }

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

  // ── send media file ───────────────────────────────────────────────────────
  const sendMedia = async (file) => {
    if (!file || !activeConv) return;
    setUploadingMedia(true);
    setSendErr("");

    // 1. Upload to Supabase Storage
    const ext  = file.name.split(".").pop().toLowerCase();
    const path = `chat/${user.empresa_id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("midia").upload(path, file, { upsert: true });
    if (uploadErr) {
      setSendErr("Erro ao enviar arquivo: " + uploadErr.message);
      setUploadingMedia(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("midia").getPublicUrl(path);

    // 2. Determine media type
    const ft = file.type || "";
    const tipo = ft.startsWith("image/") ? "imagem"
               : ft.startsWith("audio/") ? "audio"
               : ft.startsWith("video/") ? "video"
               : "documento";

    // 3. Persist message to DB
    await supabase.from("mensagens").insert({
      conversa_id: activeConv.id,
      empresa_id:  activeConv.empresa_id || user.empresa_id,
      de: "me", remetente: "me",
      tipo, midia_url: publicUrl, nome_arquivo: file.name,
      hora: new Date().toISOString(), status: "enviado",
    });

    // 4. Update conversa
    const now = new Date().toISOString();
    await supabase.from("conversas").update({
      ultima_mensagem: `[${tipo}] ${file.name}`, ultima_hora: now, status: "em_atendimento",
    }).eq("id", activeConv.id);
    setConversas(p => p.map(c => c.id === activeConv.id
      ? { ...c, ultima_mensagem: `[${tipo}] ${file.name}`, ultima_hora: now }
      : c));

    // 5. Send via Evolution (WhatsApp)
    if (activeConv.contato_telefone?.trim()) {
      supabase.functions.invoke("evolution-action", {
        body: { action: "sendMedia", empresa_id: user.empresa_id, phone: activeConv.contato_telefone, url: publicUrl, tipo, caption: file.name },
      }).then(({ data: fnData, error: fnErr }) => {
        if (fnErr || fnData?.error) {
          const msg = fnErr?.message || fnData?.error || "verifique conexão.";
          setSendErr("⚠️ Arquivo salvo mas não enviado ao WhatsApp: " + msg);
        }
      }).catch((e) => setSendErr("⚠️ Arquivo salvo mas não enviado ao WhatsApp: " + (e?.message || "erro de rede.")));
    }

    setUploadingMedia(false);
    loadMensagens(activeConv.id);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
  };

  // ── gravar áudio ─────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (recording || !activeConv) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
      recChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(recTimerRef.current);
        setRecSeconds(0);
        const blob = new Blob(recChunksRef.current, { type: mr.mimeType });
        const ext  = mr.mimeType.includes("webm") ? "webm" : "ogg";
        const file = new File([blob], `audio_${Date.now()}.${ext}`, { type: mr.mimeType });
        await sendMedia(file);
        setRecording(false);
      };
      mr.start(250);
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch (e) {
      setSendErr("Microfone não disponível: " + e.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
        clearInterval(recTimerRef.current);
        setRecSeconds(0);
        setRecording(false);
      };
      mediaRecorderRef.current.stop();
    }
  };

  const criarConversa = async () => {
    setNovaErr("");
    const nome = novaForm.nome.trim();
    const telefone = novaForm.telefone.replace(/\D/g, "");
    if (!nome)     { setNovaErr("Nome do contato é obrigatório."); return; }
    if (!telefone) { setNovaErr("Telefone é obrigatório para enviar mensagens no WhatsApp."); return; }
    if (telefone.length < 10) { setNovaErr("Telefone inválido. Use DDD + número (ex: 11999998888)."); return; }

    setSavingNova(true);
    const { data, error } = await supabase.from("conversas").insert({
      empresa_id:       user.empresa_id,
      whatsapp_numero:  telefone,
      contato_nome:     nome,
      contato_telefone: telefone,
      contato_empresa:  novaForm.empresa_contato.trim(),
      ultima_mensagem:  "",
      ultima_hora:      new Date().toISOString(),
      nao_lidas:        0,
      status:           "aberta",
    }).select().single();

    setSavingNova(false);

    if (error) {
      setNovaErr("Erro ao criar conversa: " + (error.message || "tente novamente."));
      return;
    }

    if (data) {
      // Atualiza lista de conversas e contatos imediatamente
      setConversas(p => [data, ...p]);
      setWppContatos(p => [data, ...p]);
      // Abre a conversa recém-criada
      setActiveConv(data);
      setMensagens([]);
      // Volta para aba conversas para o usuário ver e interagir
      setSidebarTab("conversas");
    }

    setNovaModal(false);
    setNovaForm({ nome: "", telefone: "", empresa_contato: "" });
    setNovaErr("");
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
  const filtradas = useMemo(() => conversas.filter(c => {
    const matchSearch = !busca ||
      c.contato_nome?.toLowerCase().includes(busca.toLowerCase()) ||
      c.contato_empresa?.toLowerCase().includes(busca.toLowerCase()) ||
      c.contato_telefone?.includes(busca);
    const matchSetor = !setorFiltro || c.setor_id === setorFiltro;
    const isGrpC = c.contato_telefone?.endsWith("@g.us");
    const matchTipo  = tipoFiltro === "todos"    ? true
                     : tipoFiltro === "grupos"   ? !!isGrpC
                     : /* contatos */              !isGrpC;
    const matchEtiqueta = !etiquetaFiltro ||
      (convEtiquetasMap[c.id] || []).includes(etiquetaFiltro);
    return matchSearch && matchSetor && matchTipo && matchEtiqueta;
  }), [conversas, busca, setorFiltro, tipoFiltro, etiquetaFiltro, convEtiquetasMap]);

  const filteredQuick = quickReplies.filter(r =>
    r.titulo?.toLowerCase().includes(quickFilter) ||
    r.mensagem?.toLowerCase().includes(quickFilter)
  );

  const totalNaoLidas = conversas.reduce((s, c) => s + (c.nao_lidas || 0), 0);
  const showRightPanel = showRight && !isMobile && !isTablet && activeConv;

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Banner status WhatsApp */}
      {evoConnected === false && (
        <div style={{ padding: isMobile ? "6px 10px" : "8px 16px", background: L.yellowBg, border: `1px solid ${L.yellowA2}`,
          borderRadius: 10, marginBottom: 10, fontSize: isMobile ? 11 : 12, color: L.t1 }}>
          ⚠️ <b>WhatsApp desconectado.</b>{!isMobile && <> Conecte em <b>Minha Empresa → Integrações</b>.</>}
        </div>
      )}
      {evoConnected === true && (
        <div style={{ padding: isMobile ? "5px 10px" : "6px 16px", background: L.greenBg, border: `1px solid ${L.green}33`,
          borderRadius: 10, marginBottom: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 11, flexWrap: "wrap" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: L.green, display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: L.green, fontWeight: 600 }}>WhatsApp</span>
          {!isMobile && <span style={{ color: L.t3 }}>· Evolution GO</span>}
          <span style={{ marginLeft: "auto", display: "flex", gap: 5, alignItems: "center" }}>
            {importInfo && !isMobile && (
              <span style={{ color: importInfo.error ? L.red : L.t3, fontSize: 10 }}>
                {importing
                  ? `⏳ Sincronizando… ${importInfo.imported || 0}`
                  : importInfo.error
                    ? importInfo.error
                    : importInfo.isGroups
                      ? `✅ ${importInfo.total || 0} grupos`
                      : `✅ ${importInfo.imported || 0} msgs`}
              </span>
            )}
            <button onClick={() => syncGroups()} disabled={importing}
              style={{ ...btnStyle(importing ? L.surface : L.blue, importing ? L.t4 : "white"),
                fontSize: 10, padding: "3px 8px", opacity: importing ? 0.6 : 1 }}>
              {importing ? "⟳" : "👥"}
            </button>
            <button onClick={() => importHistory(1)} disabled={importing}
              style={{ ...btnStyle(importing ? L.surface : L.accent, importing ? L.t4 : "white"),
                fontSize: 10, padding: "3px 8px", opacity: importing ? 0.6 : 1 }}>
              {importing ? "⟳" : "⬇"}
            </button>
          </span>
        </div>
      )}

      <div style={{ display: "flex", height: isMobile ? "calc(100dvh - 130px)" : isTablet ? "calc(100dvh - 150px)" : "calc(100dvh - 162px)",
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
                  <button onClick={() => setDistModal(true)} title="Distribuição de atendentes"
                    style={btnStyle(distCfg?.ativo === false ? L.surface : L.tealBg, distCfg?.ativo === false ? L.t3 : L.teal)}>⇄</button>
                  <button onClick={() => setNovaModal(true)} style={btnStyle(L.accent, "white")}>+ Nova</button>
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
                      const count = t.id === "todas" ? totalNaoLidas
                        : t.id === "aguardando" ? conversas.filter(c => c.status === "aguardando" && !c.atendente_id).length
                        : conversas.filter(c => c.status === t.id && c.nao_lidas > 0).reduce((s, c) => s + (c.nao_lidas || 0), 0);
                      return (
                        <button key={t.id} onClick={() => setStatusTab(t.id)}
                          style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 6, fontSize: 10, cursor: "pointer",
                            fontFamily: "inherit", border: "none", fontWeight: statusTab === t.id ? 700 : 400,
                            background: statusTab === t.id ? L.accent : "transparent",
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

            {/* Filtro por etiqueta */}
            {sidebarTab === "conversas" && etiquetas.length > 0 && (
              <div style={{ padding: "4px 10px 6px", display: "flex", gap: 4, flexWrap: "wrap", borderBottom: `1px solid ${L.lineSoft}` }}>
                <button onClick={() => setEtiquetaFiltro(null)}
                  style={{ fontSize: 9, padding: "2px 7px", borderRadius: 8, cursor: "pointer", border: "none",
                    background: !etiquetaFiltro ? L.accent : L.surface, color: !etiquetaFiltro ? "white" : L.t3,
                    fontWeight: !etiquetaFiltro ? 700 : 400, fontFamily: "inherit" }}>
                  Todas
                </button>
                {etiquetas.map(e => (
                  <button key={e.id} onClick={() => setEtiquetaFiltro(etiquetaFiltro === e.id ? null : e.id)}
                    style={{ fontSize: 9, padding: "2px 7px", borderRadius: 8, cursor: "pointer",
                      border: `1px solid ${e.cor}44`, fontFamily: "inherit", fontWeight: 600,
                      background: etiquetaFiltro === e.id ? e.cor : e.cor + "22",
                      color: etiquetaFiltro === e.id ? "white" : e.cor }}>
                    {e.nome}
                  </button>
                ))}
              </div>
            )}

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
                      background: isActive ? L.tealA : "transparent",
                      borderLeft: `3px solid ${isActive ? L.accent : "transparent"}`, transition: "all .1s" }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = L.surface; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                    <Row gap={9}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <Av name={nomeExibido} color={isGrp ? L.blue : L.t1} size={36} src={profilePhotos[c.contato_telefone]} />
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
                          {typingMap[c.contato_telefone] && typingMap[c.contato_telefone] > Date.now()
                            ? <span style={{ color: L.teal, fontStyle: "italic" }}>digitando...</span>
                            : (c.ultima_mensagem || "Sem mensagens")}
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
                          {c.status === "aguardando" && !c.atendente_id && (
                            <button onClick={e => assumirConversa(c.id, e)}
                              style={{ fontSize: 9, color: L.teal, background: L.tealBg, border: `1px solid ${L.tealA2}`,
                                borderRadius: 4, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit",
                                fontWeight: 700, marginLeft: "auto", flexShrink: 0 }}>
                              ⊕ Assumir
                            </button>
                          )}
                          {c.nao_lidas > 0 && (
                            <span style={{ background: L.green, borderRadius: "50%", width: 16, height: 16,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 9, fontWeight: 700, color: "white", marginLeft: c.status === "aguardando" && !c.atendente_id ? 4 : "auto" }}>
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
                      background: isActive ? L.tealA : "transparent",
                      borderLeft: `3px solid ${isActive ? L.accent : "transparent"}`, transition: "all .1s" }}
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
              justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: L.waHeaderBg, gap: 8 }}>
              <Row gap={9} style={{ minWidth: 0, flex: 1 }}>
                {isMobile && (
                  <button onClick={() => setActiveConv(null)} style={btnStyle()}>←</button>
                )}
                <div style={{ position: "relative" }}>
                  <Av name={activeConv.contato_nome || "?"} color={L.t1} size={34} src={profilePhotos[activeConv.contato_telefone]} />
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
                {/* Assumir conversa da fila */}
                {activeConv.status === "aguardando" && !activeConv.atendente_id && (
                  <button onClick={e => assumirConversa(activeConv.id, e)}
                    style={{ fontSize: 11, fontWeight: 700, color: "white", background: L.teal,
                      border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                    ⊕ Assumir conversa
                  </button>
                )}
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
                      background: L.waHeaderBg, color: L.t2, cursor: "pointer", fontFamily: "inherit", outline: "none", maxWidth: 100 }}>
                    <option value="">🏢 Setor</option>
                    {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                )}

                {/* Atribuir atendente */}
                <select value={activeConv.atendente_id || ""} onChange={e => assignAtendente(e.target.value)}
                  style={{ fontSize: 10, border: `1px solid ${L.line}`, borderRadius: 6, padding: "4px 7px",
                    background: L.waHeaderBg, color: L.t2, cursor: "pointer", fontFamily: "inherit", outline: "none", maxWidth: 110 }}>
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
                  <button onClick={() => setShowRight(p => !p)}
                    title={showRight ? "Ocultar painel de info" : "Mostrar Info / Tags / Agendadas / Log"}
                    style={{ ...btnStyle(showRight ? L.tealBg : L.surface, showRight ? L.teal : L.t3),
                      display: "flex", alignItems: "center", gap: 4, fontWeight: showRight ? 700 : 400 }}>
                    <span style={{ fontSize: 12 }}>{showRight ? "⊟" : "⊞"}</span>
                    <span style={{ fontSize: 10 }}>Info</span>
                  </button>
                )}
              </Row>
            </div>

            {/* Etiquetas da conversa */}
            {convEtiquetas.length > 0 && (
              <div style={{ padding: "6px 14px", borderBottom: `1px solid ${L.lineSoft}`,
                display: "flex", gap: 5, flexWrap: "wrap", background: L.waHeaderBg }}>
                {convEtiquetas.map(e => (
                  <EtiquetaChip key={e.id} etiqueta={e} onRemove={() => removeEtiqueta(e.id)} />
                ))}
              </div>
            )}

            {/* Mensagens */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px",
              background: L.waChatBg, display: "flex", flexDirection: "column", gap: 2 }}>
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
                        <span style={{ fontSize: 10.5, color: L.waDateText, background: L.waDateBg,
                          padding: "4px 12px", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.13)",
                          fontWeight: 500 }}>
                          {new Date(h).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                        </span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: out ? "flex-end" : "flex-start", marginBottom: 3 }}>
                      {!out && (
                        <Av name={activeConv.contato_nome || "?"} color={L.t3} size={22}
                          src={profilePhotos[activeConv.contato_telefone]}
                          style={{ marginRight: 6, marginTop: 2, flexShrink: 0 }} />
                      )}
                      <div style={{
                        maxWidth: "72%", padding: nota ? "6px 10px" : "7px 9px 6px 9px",
                        borderRadius: out ? "8px 8px 2px 8px" : "8px 8px 8px 2px",
                        background: nota ? L.yellowBg : out ? L.waBubbleOut : L.waBubbleIn,
                        color: nota ? L.yellow : out ? L.waBubbleOutText : L.t1,
                        border: nota ? `1px dashed ${L.yellow}` : "none",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.13)",
                        fontSize: 13, lineHeight: 1.5, wordBreak: "break-word",
                        opacity: m.status === "enviando" ? 0.6 : 1,
                        transition: "opacity .2s",
                      }}>
                        {nota && <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3, opacity: .7 }}>📝 NOTA INTERNA</div>}
                        {m.remetente === "bot" && !nota && (
                          <div style={{ fontSize: 9, marginBottom: 2, color: L.waTimestamp }}>🤖 Bot</div>
                        )}
                        {renderMsgContent(m, out, setLightboxImg, user?.empresa_id)}
                        <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2,
                          justifyContent: "flex-end" }}>
                          <span style={{ fontSize: 10, color: L.waTimestamp }}>{fmtHora(h)}</span>
                          {out && !nota && (
                            <span style={{ fontSize: 10, color: m.lido ? L.waTick : L.waTimestamp }}>
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
            <div style={{ padding: "8px 10px", borderTop: `1px solid ${L.line}`,
              background: L.waInputBg, flexShrink: 0 }}>

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

              {/* Hidden file input */}
              <input ref={fileRef} type="file" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                style={{ display:"none" }} onChange={e => { if (e.target.files?.[0]) sendMedia(e.target.files[0]); e.target.value = ""; }}/>

              {recording ? (
                /* Modo de gravação */
                <Row gap={8} style={{ background: L.redBg, borderRadius: 10, padding: "8px 12px",
                  border: `1px solid ${L.red}33`, alignItems: "center" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: L.red,
                    animation: "pulse 1s infinite", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: L.red, fontWeight: 600, flex: 1 }}>
                    Gravando... {Math.floor(recSeconds / 60).toString().padStart(2, "0")}:{(recSeconds % 60).toString().padStart(2, "0")}
                  </span>
                  <button onClick={cancelRecording}
                    style={{ ...btnStyle(L.surface, L.t3), padding: "5px 10px", fontSize: 11 }}>
                    ✕ Cancelar
                  </button>
                  <button onClick={stopRecording}
                    style={{ background: L.red, color: "white", border: "none", borderRadius: 8,
                      padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
                    ⏹ Enviar
                  </button>
                </Row>
              ) : (
                <Row gap={8}>
                  {/* Note toggle */}
                  <button onClick={() => {
                    if (input.startsWith("/nota ")) setInput(input.slice(6));
                    else setInput("/nota " + input);
                  }}
                    title="Nota interna (/nota texto)"
                    style={{ ...btnStyle(input.startsWith("/nota") ? L.yellowBg : L.surface, input.startsWith("/nota") ? L.yellow : L.t3), flexShrink: 0, padding: "7px 10px" }}>
                    📝
                  </button>

                  {/* Media upload */}
                  <button onClick={() => fileRef.current?.click()} disabled={uploadingMedia}
                    title="Enviar imagem / áudio / arquivo"
                    style={{ ...btnStyle(L.surface, uploadingMedia ? L.t4 : L.t3), flexShrink: 0, padding: "7px 10px", opacity: uploadingMedia ? 0.5 : 1 }}>
                    {uploadingMedia ? "⟳" : "📎"}
                  </button>

                  <div style={{ flex: 1, position: "relative" }}>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder={input.startsWith("/nota") ? "Nota interna (não enviada ao contato)..." : isMobile ? "Digite uma mensagem…" : "Digite / para respostas rápidas · Enter para enviar · Shift+Enter nova linha"}
                      rows={1}
                      style={{ width: "100%", border: `1px solid ${input.startsWith("/nota") ? L.yellow : "transparent"}`,
                        borderRadius: 9, padding: "8px 12px", fontSize: 13, color: L.t1,
                        background: input.startsWith("/nota") ? L.yellowBg : L.white,
                        outline: "none", fontFamily: "inherit", resize: "none",
                        maxHeight: 100, overflowY: "auto", boxSizing: "border-box", lineHeight: 1.5 }}
                    />
                  </div>

                  {/* Gravar áudio */}
                  {!input.trim() && (
                    <button onClick={startRecording} disabled={uploadingMedia}
                      title="Gravar mensagem de voz"
                      style={{ ...btnStyle(L.surface, L.t3), flexShrink: 0, padding: "7px 10px" }}>
                      🎙
                    </button>
                  )}

                  <button onClick={() => {
                    if (input.startsWith("/nota ")) {
                      sendNote(input.slice(6));
                      setInput("");
                    } else {
                      send();
                    }
                  }} disabled={!input.trim() || sending}
                    style={{ background: L.accent, color: "white", border: "none",
                      borderRadius: "50%", width: 40, height: 40, flexShrink: 0, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, transition: "all .15s",
                      opacity: (!input.trim() || sending) ? .4 : 1,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}>
                    {sending ? "⟳" : "➤"}
                  </button>
                </Row>
              )}
              <div style={{ fontSize: 10, color: L.t4, marginTop: 4, paddingLeft: 2 }}>
                Digite <b>/</b> para respostas rápidas · <b>/nota texto</b> para nota interna
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            color: L.waTimestamp, flexDirection: "column", gap: 8, background: L.waChatBg }}>
            <div style={{ fontSize: 40, opacity: .5 }}>◈</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Selecione uma conversa</div>
            <div style={{ fontSize: 11 }}>ou aguarde novas mensagens via WhatsApp</div>
          </div>
        ))}

        {/* ══════════════════ PAINEL DIREITO ════════════════════ */}
        {activeConv && !isMobile && (
          <div style={{
            position: "relative", display: "flex", flexShrink: 0,
            width: showRight ? 261 : 18, minWidth: showRight ? 261 : 18,
            transition: "width .22s ease, min-width .22s ease",
            borderLeft: `1px solid ${L.line}`, background: L.white, overflow: "hidden",
          }}>

            {/* ── Tab de colapso / expansão (sempre visível na borda) ── */}
            <button
              onClick={() => setShowRight(p => !p)}
              title={showRight ? "Ocultar painel" : "Mostrar Info / Tags / Agendadas / Log"}
              style={{
                position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                width: 18, height: 52, background: L.surface,
                border: `1px solid ${L.line}`, borderLeft: "none",
                borderRadius: "0 8px 8px 0", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: L.t3, fontSize: 10, zIndex: 10, transition: "all .15s",
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = L.tealBg; e.currentTarget.style.color = L.teal; e.currentTarget.style.borderColor = L.teal + "55"; }}
              onMouseLeave={e => { e.currentTarget.style.background = L.surface; e.currentTarget.style.color = L.t3; e.currentTarget.style.borderColor = L.line; }}
            >
              {showRight ? "›" : "‹"}
            </button>

            {/* ── Conteúdo do painel (largura fixa, desliza por overflow hidden) ── */}
            <div style={{ width: 260, minWidth: 260, marginLeft: 18, display: "flex", flexDirection: "column" }}>

            {/* Abas do painel */}
            <div style={{ display: "flex", borderBottom: `1px solid ${L.line}` }}>
              {[
                { id: "info",      label: "Info"    },
                { id: "etiquetas", label: "Tags"    },
                { id: "agendadas", label: "Agenda"  },
                { id: "log",       label: "Log"     },
                { id: "script",    label: "Script"  },
              ].map(t => (
                <button key={t.id} onClick={() => setRightTab(t.id)}
                  style={{ flex: 1, padding: "8px 2px", fontSize: 11, fontWeight: rightTab === t.id ? 700 : 400,
                    background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                    color: rightTab === t.id ? L.accent : L.t3,
                    borderBottom: rightTab === t.id ? `2px solid ${L.accent}` : "2px solid transparent",
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
                    src={profilePhotos[activeConv.contato_telefone]}
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
                    <button onClick={() => setAgendarModal(true)} style={btnStyle(L.accent, "white", { fontSize: 10, padding: "3px 10px" })}>
                      + Agendar
                    </button>
                  </Row>
                  {agendadas.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 0" }}>
                      <div style={{ fontSize: 22, marginBottom: 6 }}>⏰</div>
                      <div style={{ fontSize: 11, color: L.t3 }}>Nenhuma mensagem agendada</div>
                      <div style={{ fontSize: 10.5, color: L.t4, marginTop: 2 }}>Clique em "+ Agendar" para programar um envio</div>
                    </div>
                  ) : agendadas.map(a => {
                    const cfg = {
                      pendente:  { color: L.blue,   bg: L.blueBg,   border: L.blueA,  icon: "⏰", label: "Agendado" },
                      enviando:  { color: L.yellow,  bg: L.yellowBg, border: L.yellowA,icon: "⟳", label: "Enviando" },
                      enviado:   { color: L.green,   bg: L.greenBg,  border: L.greenA, icon: "✓", label: "Enviado" },
                      falhou:    { color: L.red,     bg: L.redBg,    border: L.redA,   icon: "⚠", label: "Falhou" },
                      cancelado: { color: L.t4,      bg: L.surface,  border: L.line,   icon: "×", label: "Cancelado" },
                    }[a.status] || { color: L.t3, bg: L.surface, border: L.line, icon: "?", label: a.status };
                    return (
                      <div key={a.id} style={{ padding: "10px 12px", background: L.white, borderRadius: 9,
                        border: `1px solid ${a.status === "pendente" ? L.line : cfg.border}`,
                        marginBottom: 7, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        opacity: a.status === "cancelado" ? 0.6 : 1 }}>
                        <div style={{ fontSize: 11.5, color: L.t1, marginBottom: 6, lineHeight: 1.4 }}>{a.mensagem}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                              background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                              {cfg.icon} {cfg.label}
                            </span>
                            <span style={{ fontSize: 10, color: L.t4 }}>
                              {new Date(a.agendado_para).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          {a.status === "pendente" && (
                            <button onClick={() => cancelAgendada(a.id)} title="Cancelar agendamento"
                              style={{ background: "none", border: "none", cursor: "pointer", color: L.t4, fontSize: 14, padding: "0 2px", lineHeight: 1 }}
                              onMouseEnter={e => e.currentTarget.style.color = L.red}
                              onMouseLeave={e => e.currentTarget.style.color = L.t4}>×</button>
                          )}
                        </div>
                        {(a.status === "falhou") && a.erro && (
                          <div style={{ fontSize: 10, color: L.red, marginTop: 5, padding: "4px 6px",
                            background: L.redBg, borderRadius: 5, wordBreak: "break-word" }}>
                            {a.erro.slice(0, 160)}
                          </div>
                        )}
                      </div>
                    );
                  })}
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

              {/* SCRIPT TAB */}
              {rightTab === "script" && (
                <div>
                  {!scriptFluxo ? (
                    <div style={{ textAlign: "center", padding: "28px 0" }}>
                      <div style={{ fontSize: 26, marginBottom: 8 }}>📋</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: L.t2, marginBottom: 6 }}>
                        Nenhum script ativo
                      </div>
                      <div style={{ fontSize: 11, color: L.t4, lineHeight: 1.5 }}>
                        Crie um fluxo de vendas em<br/>
                        <strong>Scripts Vendas</strong> no menu lateral
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Cabeçalho do fluxo */}
                      <div style={{ padding: "10px 12px", borderRadius: 9, marginBottom: 12,
                        background: scriptFluxo.cor + "14", border: `1px solid ${scriptFluxo.cor}33` }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: L.t1 }}>{scriptFluxo.nome}</div>
                        {scriptFluxo.descricao && (
                          <div style={{ fontSize: 10.5, color: L.t3, marginTop: 2 }}>{scriptFluxo.descricao}</div>
                        )}
                        <div style={{ fontSize: 10, color: L.t4, marginTop: 4 }}>
                          {scriptFluxo.usuario_id ? "📌 Seu script pessoal" : "🏢 Script da empresa"}
                          {" · "}{scriptPassos.length} {scriptPassos.length === 1 ? "passo" : "passos"}
                        </div>
                      </div>

                      {/* Passos */}
                      {scriptPassos.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px 0" }}>
                          <div style={{ fontSize: 11, color: L.t4, marginBottom: 6 }}>
                            Este fluxo não tem nós de mensagem ainda.
                          </div>
                          <div style={{ fontSize: 10.5, color: L.t4 }}>
                            Adicione nós do tipo "Mensagem" no editor visual.
                          </div>
                        </div>
                      ) : scriptPassos.map((no, i) => {
                        const isSending = scriptSending === no.id;
                        const contact   = activeConv?.contato_nome || "";
                        const phone     = activeConv?.contato_telefone || "";
                        const emp       = activeConv?.contato_empresa || "";
                        const preview   = (no.mensagem || "")
                          .replace(/\{nome\}/g, contact || "{nome}")
                          .replace(/\{telefone\}/g, phone || "{telefone}")
                          .replace(/\{empresa\}/g, emp || "{empresa}");
                        const nCfg = { mensagem: { ico: "💬", cor: "#2563eb" }, respostas: { ico: "🔘", cor: "#2563eb" }, lista: { ico: "☰", cor: "#059669" } }[no.tipo] || { ico: "💬", cor: L.teal };
                        return (
                          <div key={no.id} style={{ background: L.white, border: `1px solid ${L.line}`,
                            borderRadius: 10, padding: "10px 12px", marginBottom: 8,
                            boxShadow: "0 1px 4px rgba(0,0,0,0.04)", opacity: isSending ? 0.7 : 1,
                            transition: "opacity .15s" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                              <div style={{ width: 20, height: 20, borderRadius: 5, background: nCfg.cor + "18",
                                border: `1px solid ${nCfg.cor}33`, display: "flex", alignItems: "center",
                                justifyContent: "center", fontSize: 10, flexShrink: 0 }}>
                                {nCfg.ico}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: L.t1, flex: 1,
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {no.nome || `Mensagem ${i + 1}`}
                              </div>
                              <span style={{ fontSize: 9, color: L.t4, flexShrink: 0 }}>#{i + 1}</span>
                            </div>
                            <div style={{ fontSize: 11, color: L.t2, lineHeight: 1.5, marginBottom: 8,
                              padding: "6px 8px", background: L.surface, borderRadius: 6,
                              wordBreak: "break-word", whiteSpace: "pre-wrap", maxHeight: 100,
                              overflowY: "auto" }}>
                              {preview}
                            </div>
                            <button
                              disabled={isSending || !activeConv}
                              onClick={async () => {
                                setScriptSending(no.id);
                                await send(preview);
                                setScriptSending(null);
                              }}
                              style={{ width: "100%", background: isSending ? L.surface : L.accent,
                                color: isSending ? L.t3 : "white", border: "none", borderRadius: 7,
                                padding: "6px 0", fontSize: 11, fontWeight: 600,
                                cursor: isSending ? "wait" : "pointer", fontFamily: "inherit",
                                transition: "all .12s" }}>
                              {isSending ? "Enviando..." : "▶ Enviar esta mensagem"}
                            </button>
                          </div>
                        );
                      })}

                      <div style={{ fontSize: 10, color: L.t4, textAlign: "center",
                        marginTop: 8, lineHeight: 1.5 }}>
                        As variáveis {"{nome}"}, {"{telefone}"} e {"{empresa}"} são substituídas automaticamente
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>{/* fecha inner content div (marginLeft:18) */}
          </div>
        )}
      </div>

      {/* ══════════ MODALS ══════════ */}
      {novaModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => { if (!savingNova) { setNovaModal(false); setNovaErr(""); setNovaForm({ nome:"", telefone:"", empresa_contato:"" }); } }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}
            style={{ background: L.white, borderRadius: 14, padding: 24, width: 400,
              boxShadow: "0 8px 40px rgba(0,0,0,.20)" }}>

            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:L.tealBg,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:18, color:L.teal, flexShrink:0 }}>💬</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:L.t1, lineHeight:1.2 }}>Nova conversa</div>
                <div style={{ fontSize:11, color:L.t3 }}>O contato aparecerá na lista após criar</div>
              </div>
            </div>

            {/* Fields */}
            {[
              { label: "Nome do contato *", key: "nome",            placeholder: "João Silva",      type: "text" },
              { label: "Telefone (DDD + número) *", key: "telefone", placeholder: "11999998888",    type: "tel"  },
              { label: "Empresa do contato",  key: "empresa_contato", placeholder: "Empresa Ltda", type: "text" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4,
                  fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px",
                  fontFamily: "'JetBrains Mono',monospace" }}>{f.label}</label>
                <input
                  type={f.type}
                  value={novaForm[f.key]}
                  onChange={e => { setNovaForm(p => ({ ...p, [f.key]: e.target.value })); setNovaErr(""); }}
                  onKeyDown={e => e.key === "Enter" && criarConversa()}
                  placeholder={f.placeholder}
                  disabled={savingNova}
                  style={{ width: "100%", border: `1.5px solid ${novaErr && (f.key==="nome"||f.key==="telefone") ? L.red : L.line}`,
                    borderRadius: 9, padding: "9px 13px", fontSize: 12.5, color: L.t1,
                    background: savingNova ? L.surface : L.white, outline: "none",
                    fontFamily: "inherit", boxSizing: "border-box", transition: "border-color .12s" }}
                  onFocus={e => e.target.style.borderColor = L.teal}
                  onBlur={e => e.target.style.borderColor = L.line}
                />
              </div>
            ))}

            {/* Error */}
            {novaErr && (
              <div style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 12px",
                background:L.redBg, border:`1px solid ${L.red}28`, borderRadius:8, marginBottom:14 }}>
                <span style={{ color:L.red, fontSize:13 }}>✕</span>
                <span style={{ fontSize:12, color:L.red }}>{novaErr}</span>
              </div>
            )}

            {/* Actions */}
            <Row gap={8} style={{ justifyContent: "flex-end", marginTop: 6 }}>
              <button
                onClick={() => { setNovaModal(false); setNovaErr(""); setNovaForm({ nome:"", telefone:"", empresa_contato:"" }); }}
                disabled={savingNova}
                style={btnStyle()}>
                Cancelar
              </button>
              <button
                onClick={criarConversa}
                disabled={savingNova || !novaForm.nome.trim()}
                style={{ ...btnStyle(savingNova || !novaForm.nome.trim() ? L.surface : L.teal, savingNova || !novaForm.nome.trim() ? L.t3 : "white"),
                  opacity: savingNova || !novaForm.nome.trim() ? 0.7 : 1,
                  display: "flex", alignItems: "center", gap: 6 }}>
                {savingNova ? (
                  <>
                    <span style={{ width:13, height:13, border:"2px solid rgba(255,255,255,.4)",
                      borderTopColor:"white", borderRadius:"50%",
                      display:"inline-block", animation:"spin .7s linear infinite" }} />
                    Criando...
                  </>
                ) : "✓ Criar conversa"}
              </button>
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

      {/* ── Toast de notificação ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "max(24px, calc(env(safe-area-inset-bottom) + 76px))", right: isMobile ? 12 : 24, zIndex: 9999,
          background: L.accent, color: "white", padding: "12px 18px",
          borderRadius: 12, boxShadow: "0 6px 24px rgba(0,0,0,.28)",
          fontSize: 12.5, maxWidth: 320, animation: "up .2s ease",
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
            {toast.tipo === "transferencia" ? "🔄" : toast.tipo === "atribuicao" ? "👤" : "🔔"}
          </span>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 3 }}>
              {toast.tipo === "transferencia" ? "Conversa transferida" :
               toast.tipo === "atribuicao"    ? "Conversa atribuída"  : "Notificação"}
            </div>
            <div style={{ opacity: .85, lineHeight: 1.4 }}>{toast.msg}</div>
          </div>
          <button onClick={() => setToast(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.6)", fontSize: 16, lineHeight: 1, padding: 0, marginLeft: "auto", flexShrink: 0 }}>
            ×
          </button>
        </div>
      )}

      {/* Aviso se notificações do browser não foram permitidas */}
      {!notifPerm && typeof Notification !== "undefined" && (
        <div style={{
          position: "fixed", bottom: 24, left: 24, zIndex: 9998,
          background: L.white, border: `1px solid ${L.line}`,
          borderLeft: `3px solid ${L.yellow}`,
          padding: "10px 14px", borderRadius: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          fontSize: 11, maxWidth: 300,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🔔</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: L.t1, marginBottom: 2 }}>
              {Notification.permission === "denied"
                ? "Notificações bloqueadas"
                : "Ative as notificações"}
            </div>
            <div style={{ color: L.t3, lineHeight: 1.4 }}>
              {Notification.permission === "denied"
                ? "Desbloqueie nas configurações do navegador."
                : "Receba alertas de novas mensagens no WhatsApp."}
            </div>
          </div>
          {Notification.permission !== "denied" && (
            <button onClick={() =>
              Notification.requestPermission().then(p => {
                setNotifPerm(p === "granted");
                if (p === "granted") playNotificationSound();
              })
            }
              style={{ ...btnStyle(L.accent, "white"), fontSize: 10.5, padding: "5px 12px", flexShrink: 0 }}>
              Ativar
            </button>
          )}
          {Notification.permission === "denied" && (
            <button onClick={() => setNotifPerm(true) /* esconde banner */}
              style={{ background: "none", border: "none", cursor: "pointer", color: L.t4, fontSize: 16, padding: 2 }}>×</button>
          )}
        </div>
      )}

      {/* ── Modal: Distribuição de Atendentes (Round-Robin) ── */}
      {distModal && (
        <div style={{ position:"fixed",inset:0,zIndex:9900,background:"rgba(0,0,0,.45)",
          display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
          onClick={() => setDistModal(false)}>
          <div style={{ background:L.white,borderRadius:16,width:"100%",maxWidth:460,
            boxShadow:"0 8px 40px rgba(0,0,0,.22)",overflow:"hidden" }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding:"18px 20px",borderBottom:`1px solid ${L.lineSoft}`,
              display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <span style={{ fontSize:22 }}>⇄</span>
                <div>
                  <div style={{ fontSize:14,fontWeight:700,color:L.t1 }}>Distribuição de Atendentes</div>
                  <div style={{ fontSize:11,color:L.t3 }}>
                    {distCfg?.ativo === false ? "Desativado — atribuição manual" : "Ativo — novos clientes distribuídos automaticamente"}
                  </div>
                </div>
              </div>
              <button onClick={() => setDistModal(false)}
                style={{ background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:20,lineHeight:1,padding:4 }}>×</button>
            </div>

            <div style={{ padding:"18px 20px" }}>
              {/* Toggle */}
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18 }}>
                <div>
                  <div style={{ fontSize:13,fontWeight:600,color:L.t1 }}>Round-robin automático</div>
                  <div style={{ fontSize:11,color:L.t3,marginTop:2 }}>Cada novo cliente vai para o próximo atendente na fila</div>
                </div>
                <button onClick={() => saveDistCfg({ ativo: distCfg?.ativo === false ? true : false })}
                  disabled={distSaving}
                  style={{ display:"flex",alignItems:"center",gap:8,
                    background: distCfg?.ativo === false ? L.surface : L.tealBg,
                    border:`1px solid ${distCfg?.ativo === false ? L.line : L.tealA2}`,
                    borderRadius:20,padding:"7px 14px",cursor:"pointer",fontSize:12,
                    fontWeight:600,color:distCfg?.ativo === false ? L.t3 : L.teal,fontFamily:"inherit" }}>
                  <span style={{ width:14,height:14,borderRadius:"50%",
                    background: distCfg?.ativo === false ? L.t4 : L.teal,
                    display:"inline-block",transition:"background .15s" }}/>
                  {distCfg?.ativo === false ? "Desativado" : "Ativado"}
                </button>
              </div>

              {/* Seleção de atendentes */}
              {distCfg?.ativo !== false && (
                <>
                  <div style={{ fontSize:11,color:L.t3,fontWeight:600,letterSpacing:"1px",
                    textTransform:"uppercase",fontFamily:"'JetBrains Mono',monospace",marginBottom:10 }}>
                    Atendentes na fila — {!distCfg?.vendedores_ids?.length ? "todos ativos" : `${distCfg.vendedores_ids.length} selecionado(s)`}
                  </div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:16 }}>
                    {distVendedores.map(v => {
                      const ids = distCfg?.vendedores_ids || [];
                      const sel = !ids.length || ids.includes(v.id);
                      const eff = ids.length ? ids : distVendedores.map(x => x.id);
                      const isNext = eff[(distCfg?.proximo_indice || 0) % eff.length] === v.id;
                      return (
                        <button key={v.id} onClick={() => toggleDistVendedor(v.id)}
                          style={{ display:"flex",alignItems:"center",gap:7,padding:"6px 12px",
                            borderRadius:20,border:`1.5px solid ${sel?L.tealA2:L.line}`,
                            background:sel?L.tealBg:L.surface,cursor:"pointer",
                            color:sel?L.teal:L.t3,fontSize:12,fontWeight:sel?600:400,
                            fontFamily:"inherit",transition:"all .12s" }}>
                          <span style={{ width:22,height:22,borderRadius:"50%",background:sel?L.tealA2:L.surface,
                            border:`1px solid ${sel?L.tealA2:L.line}`,display:"flex",alignItems:"center",
                            justifyContent:"center",fontSize:11,fontWeight:700,color:sel?L.teal:L.t4,flexShrink:0 }}>
                            {v.nome[0]}
                          </span>
                          {v.nome.split(" ")[0]}
                          {isNext && sel && (
                            <span style={{ background:L.teal,color:"white",borderRadius:8,
                              padding:"1px 6px",fontSize:9,fontWeight:700 }}>próximo</span>
                          )}
                        </button>
                      );
                    })}
                    {distVendedores.length === 0 && (
                      <span style={{ color:L.t4,fontSize:12 }}>Nenhum atendente ativo encontrado.</span>
                    )}
                  </div>

                  {/* Ações */}
                  <div style={{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" }}>
                    <button onClick={() => saveDistCfg({ vendedores_ids: distCfg?.vendedores_ids || [], proximo_indice: 0 })}
                      disabled={distSaving}
                      style={{ ...btnStyle(), fontSize:12 }}>
                      ⟳ Reiniciar fila
                    </button>
                    <button onClick={() => saveDistCfg({ vendedores_ids: distCfg?.vendedores_ids || [] })}
                      disabled={distSaving}
                      style={{ background:L.teal,border:"none",borderRadius:8,padding:"7px 18px",
                        cursor:"pointer",fontSize:12,color:"white",fontFamily:"inherit",fontWeight:600 }}>
                      {distSaving ? "Salvando…" : "💾 Salvar"}
                    </button>
                    {distMsg && <span style={{ fontSize:12,color:L.green,fontWeight:600 }}>{distMsg}</span>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox de imagem ──────────────────────────────────────────── */}
      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:9999,
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"zoom-out" }}>
          <img src={lightboxImg} alt=""
            onClick={e => e.stopPropagation()}
            style={{ maxWidth:"92vw", maxHeight:"88vh", objectFit:"contain",
              borderRadius:10, boxShadow:"0 8px 40px rgba(0,0,0,.6)", cursor:"default" }}/>
          <button onClick={() => setLightboxImg(null)}
            style={{ position:"absolute", top:18, right:22, background:"rgba(255,255,255,.12)",
              border:"none", color:"white", fontSize:26, cursor:"pointer", lineHeight:1,
              borderRadius:8, width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center" }}>
            ×
          </button>
          <a href={lightboxImg} download target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ position:"absolute", bottom:22, right:22, background:"rgba(255,255,255,.15)",
              color:"white", padding:"8px 18px", borderRadius:10, textDecoration:"none",
              fontSize:13, fontWeight:600, fontFamily:"inherit" }}>
            ⬇ Baixar
          </a>
        </div>
      )}
    </div>
  );
}
