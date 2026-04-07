import { useState, useEffect, useCallback } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Fade, Row, Grid, TabPills, Tag, IBtn } from "../components/ui";

const NC  = { info: L.blue,   warn: L.yellow,  error: L.red };
const NBG = { info: L.blueBg, warn: L.yellowBg, error: L.redBg };
const TC  = { AUTH: L.copper, DATA: L.blue, BILLING: L.green, API: L.teal, SYSTEM: L.t3, LEAD: L.teal, USER: L.copper, WHATSAPP: L.green };
const TCBG= { AUTH: L.copperBg, DATA: L.blueBg, BILLING: L.greenBg, API: L.tealBg, SYSTEM: L.surface, LEAD: L.tealBg, USER: L.copperBg, WHATSAPP: L.greenBg };

function fmtHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function downloadCSV(logs) {
  const header = "Data/Hora,Nível,Tipo,Ação,Usuário,Empresa,IP";
  const rows = logs.map(l => [
    fmtHora(l.created_at), l.nivel, l.tipo, `"${(l.acao||"").replace(/"/g,"'")}"`,
    l.usuario_email || "—", l.empresa_nome || "—", l.ip_address || "—"
  ].join(","));
  const blob = new Blob(["\uFEFF" + header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `logs_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export default function PageLogs({ user }) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro]   = useState("Todos");
  const [busca, setBusca]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("logs_auditoria")
      .select("*, empresas(nome)")
      .order("created_at", { ascending: false })
      .limit(500);

    setLogs((data || []).map(l => ({ ...l, empresa_nome: l.empresas?.nome || "—" })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("logs-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "logs_auditoria" }, payload => {
        setLogs(prev => [{ ...payload.new, empresa_nome: "—" }, ...prev].slice(0, 500));
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const hoje = new Date().toDateString();
  const todayLogs = logs.filter(l => new Date(l.created_at).toDateString() === hoje);
  const warns  = todayLogs.filter(l => l.nivel === "warn").length;
  const errors = todayLogs.filter(l => l.nivel === "error").length;

  const filtered = logs.filter(l => {
    const nivelOk = filtro === "Todos" || l.nivel === filtro.toLowerCase();
    const buscaOk = !busca || (l.acao || "").toLowerCase().includes(busca.toLowerCase()) || (l.usuario_email || "").toLowerCase().includes(busca.toLowerCase()) || (l.empresa_nome || "").toLowerCase().includes(busca.toLowerCase());
    return nivelOk && buscaOk;
  });

  return (
    <Fade>
      <Grid cols={4} gap={12} mb={14}>
        {[
          { l: "Total Hoje",  v: todayLogs.length, c: L.teal  },
          { l: "Warnings",    v: warns,             c: L.yellow },
          { l: "Erros",       v: errors,            c: errors > 0 ? L.red : L.t3 },
          { l: "Status",      v: "Online",          c: L.green  },
        ].map((k, i) => (
          <div key={i} style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: "15px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 10, color: L.t4, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 5, fontWeight: 600 }}>{k.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.c, fontFamily: "'Outfit',sans-serif" }}>{k.v}</div>
          </div>
        ))}
      </Grid>

      <Row between mb={12}>
        <Row gap={8}>
          <TabPills tabs={["Todos", "Info", "Warn", "Error"]} active={filtro} onChange={setFiltro} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar ação, usuário, empresa..."
            style={{ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${L.line}`, background: L.white, color: L.t1, fontSize: 12, fontFamily: "inherit", outline: "none", width: 220 }}
            onFocus={e => e.target.style.borderColor = L.teal} onBlur={e => e.target.style.borderColor = L.line} />
        </Row>
        <Row gap={8}>
          <IBtn c={L.teal} onClick={() => load()}>↺ Atualizar</IBtn>
          <IBtn c={L.green} onClick={() => downloadCSV(filtered)}>Exportar CSV</IBtn>
        </Row>
      </Row>

      <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        {/* Terminal header */}
        <div style={{ background: L.surface, padding: "9px 16px", borderBottom: `1px solid ${L.line}`, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {[L.red, L.yellow, L.green].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: .7 }} />)}
          </div>
          <span style={{ fontSize: 11, color: L.t4, fontFamily: "'JetBrains Mono',monospace", marginLeft: 6 }}>c4os::audit_log — {filtered.length} registros</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: L.green, animation: "blink 1.5s infinite" }} />
            <span style={{ fontSize: 10, color: L.green, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>LIVE</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: L.t4, fontSize: 13 }}>Carregando logs...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: L.t4 }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>≡</div>
            <div style={{ fontSize: 13 }}>{logs.length === 0 ? "Nenhum log registrado ainda" : "Nenhum log encontrado para este filtro"}</div>
          </div>
        ) : (
          filtered.map((log, i) => (
            <div key={log.id || i}
              style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${L.lineSoft}`, background: log.nivel === "error" ? L.redBg : log.nivel === "warn" ? L.yellow + "08" : "transparent", transition: "background .1s" }}
              onMouseEnter={e => e.currentTarget.style.background = L.surface}
              onMouseLeave={e => e.currentTarget.style.background = log.nivel === "error" ? L.redBg : log.nivel === "warn" ? L.yellow + "08" : "transparent"}
            >
              <div style={{ width: 3, alignSelf: "stretch", background: NC[log.nivel] || L.t4, flexShrink: 0 }} />
              <div style={{ display: "flex", alignItems: "center", flex: 1, padding: "9px 14px", flexWrap: "wrap", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, gap: 6 }}>
                <span style={{ color: L.t4, width: 120, flexShrink: 0, fontSize: 10 }}>{fmtHora(log.created_at)}</span>
                <span style={{ flexShrink: 0 }}><Tag color={NC[log.nivel] || L.t3} bg={NBG[log.nivel] || L.surface} small>{(log.nivel || "info").toUpperCase()}</Tag></span>
                <span style={{ flexShrink: 0 }}><Tag color={TC[log.tipo] || L.t3} bg={TCBG[log.tipo] || L.surface} small>{log.tipo || "SYSTEM"}</Tag></span>
                <span style={{ color: L.t1, flex: 1, fontFamily: "'Instrument Sans',sans-serif", fontSize: 12 }}>{log.acao || "—"}</span>
                <span style={{ color: L.t3, fontSize: 10.5 }}>{log.usuario_email || "sistema"}</span>
                <span style={{ color: L.copper, fontSize: 10.5, fontWeight: 500 }}>[{log.empresa_nome}]</span>
                {log.ip_address && <span style={{ color: L.t4, fontSize: 10 }}>{log.ip_address}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </Fade>
  );
}
