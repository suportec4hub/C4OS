import { useState, useEffect, useRef, useCallback } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";

const TIPO_CFG = {
  info:    { ico: "ℹ", cor: "var(--c-teal)",   bg: "var(--c-tealBg)"   },
  sucesso: { ico: "✓", cor: "var(--c-green)",  bg: "var(--c-greenBg)"  },
  aviso:   { ico: "⚠", cor: "var(--c-yellow)", bg: "var(--c-yellowBg)" },
  alerta:  { ico: "✕", cor: "var(--c-red)",    bg: "var(--c-redBg)"    },
};

function getCfg(tipo) {
  return TIPO_CFG[tipo] || TIPO_CFG.info;
}

// Persiste IDs lidos no localStorage por usuário
function getLidas(userId) {
  try {
    const raw = localStorage.getItem(`c4os_notif_lidas_${userId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveLidas(userId, set) {
  try {
    // Guarda no máximo os últimos 200 IDs para não crescer indefinidamente
    const arr = [...set].slice(-200);
    localStorage.setItem(`c4os_notif_lidas_${userId}`, JSON.stringify(arr));
  } catch {}
}

export default function NotificacoesBell({ user }) {
  const [notifs, setNotifs]     = useState([]);
  const [lidas, setLidas]       = useState(() => getLidas(user?.id));
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const dropdownRef             = useRef(null);

  const fetchNotifs = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("notificacoes_sistema")
      .select("id, titulo, conteudo, tipo, empresa_id, created_at")
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifs(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchNotifs();

    // Realtime: nova notificação publicada
    const channel = supabase
      .channel("notif-sistema-bell")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notificacoes_sistema",
      }, () => fetchNotifs())
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "notificacoes_sistema",
      }, () => fetchNotifs())
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "notificacoes_sistema",
      }, () => fetchNotifs())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchNotifs]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const naoLidas = notifs.filter(n => !lidas.has(n.id));
  const count    = naoLidas.length;

  const marcarTodasLidas = useCallback(() => {
    const novo = new Set([...lidas, ...notifs.map(n => n.id)]);
    setLidas(novo);
    saveLidas(user?.id, novo);
  }, [lidas, notifs, user?.id]);

  const handleOpen = () => {
    setOpen(p => {
      if (!p) {
        // Ao abrir, marca todas como lidas
        const novo = new Set([...lidas, ...notifs.map(n => n.id)]);
        setLidas(novo);
        saveLidas(user?.id, novo);
      }
      return !p;
    });
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        title="Notificações do sistema"
        style={{
          background: open ? L.tealBg : L.surface,
          border: `1px solid ${open ? L.tealA2 : L.line}`,
          borderRadius: 9,
          padding: "5px 9px",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          transition: "all .15s",
          flexShrink: 0,
          minWidth: 36,
          minHeight: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          color: open ? L.teal : L.t3,
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.borderColor = L.tealA2;
            e.currentTarget.style.color = L.teal;
            e.currentTarget.style.background = L.tealBg;
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.borderColor = L.line;
            e.currentTarget.style.color = L.t3;
            e.currentTarget.style.background = L.surface;
          }
        }}
      >
        🔔
        {count > 0 && (
          <span style={{
            position: "absolute", top: 4, right: 4,
            background: L.red, color: "#fff",
            borderRadius: "50%", width: 14, height: 14,
            fontSize: 8, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            lineHeight: 1, fontFamily: "'JetBrains Mono',monospace",
            border: `1.5px solid ${L.white}`,
          }}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: 340,
          maxHeight: 480,
          background: L.white,
          border: `1px solid ${L.line}`,
          borderRadius: 14,
          boxShadow: "0 12px 40px rgba(0,0,0,0.14)",
          zIndex: 200,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "up .15s ease",
        }}>
          {/* Cabeçalho */}
          <div style={{
            padding: "14px 16px 10px",
            borderBottom: `1px solid ${L.lineSoft}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 15 }}>🔔</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: L.t1, fontFamily: "'Outfit',sans-serif" }}>
                Notificações
              </span>
              {count > 0 && (
                <span style={{
                  background: L.red, color: "#fff",
                  borderRadius: 10, padding: "1px 7px",
                  fontSize: 10, fontWeight: 700,
                }}>
                  {count} nova{count > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {count > 0 && (
              <button onClick={marcarTodasLidas}
                style={{ fontSize: 10, color: L.teal, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                Marcar todas lidas
              </button>
            )}
          </div>

          {/* Lista */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: "center", color: L.t4, fontSize: 12 }}>Carregando...</div>
            ) : notifs.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔕</div>
                <div style={{ fontSize: 12, color: L.t4 }}>Sem notificações no momento</div>
              </div>
            ) : (
              notifs.map(n => {
                const tc   = getCfg(n.tipo);
                const nova = !lidas.has(n.id);
                return (
                  <div key={n.id}
                    style={{
                      padding: "12px 16px",
                      borderBottom: `1px solid ${L.lineSoft}`,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      background: nova ? L.tealBg : "transparent",
                      transition: "background .15s",
                    }}>
                    {/* Ícone tipo */}
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: tc.bg, border: `1px solid ${tc.cor}33`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, color: tc.cor, flexShrink: 0,
                    }}>
                      {tc.ico}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: nova ? 700 : 500, color: L.t1 }}>
                          {n.titulo}
                        </span>
                        {nova && (
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: L.teal, flexShrink: 0 }} />
                        )}
                      </div>
                      {n.conteudo && (
                        <p style={{ fontSize: 11, color: L.t3, lineHeight: 1.5, marginTop: 2 }}>{n.conteudo}</p>
                      )}
                      <div style={{ fontSize: 10, color: L.t4, marginTop: 3 }}>
                        {new Date(n.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "short",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé */}
          <div style={{
            padding: "10px 16px",
            borderTop: `1px solid ${L.lineSoft}`,
            flexShrink: 0,
            background: L.surface,
          }}>
            <p style={{ fontSize: 10, color: L.t4, textAlign: "center" }}>
              Notificações publicadas pela equipe C4HUB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
