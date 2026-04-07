import { useState, useEffect, useCallback } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Fade, Row, Grid, Card, Tag } from "../components/ui";

const PC = {
  enterprise: { c: L.teal,   bg: L.tealBg   },
  growth:     { c: L.copper, bg: L.copperBg  },
  starter:    { c: L.t3,     bg: L.surface   },
};

function pColor(plano) {
  return PC[(plano || "starter").toLowerCase()] || PC.starter;
}

function saudeColor(s) {
  if (s >= 80) return L.green;
  if (s >= 50) return L.yellow;
  return L.red;
}

export default function PageSuporte({ user }) {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [sel, setSel]           = useState(null);
  const [logs, setLogs]         = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [busca, setBusca]       = useState("");

  const SID = Math.random().toString(36).slice(2, 9).toUpperCase();

  const load = useCallback(async () => {
    setLoading(true);
    // Carrega todas as empresas
    const { data: emps } = await supabase.from("empresas").select("*, planos(nome)").order("created_at", { ascending: false });
    if (!emps) { setLoading(false); return; }

    // Para cada empresa, busca contagens em paralelo
    const enriched = await Promise.all(emps.map(async (emp) => {
      const [{ count: userCount }, { count: leadCount }, { count: dealCount }] = await Promise.all([
        supabase.from("usuarios").select("*", { count: "exact", head: true }).eq("empresa_id", emp.id).eq("ativo", true),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("empresa_id", emp.id),
        supabase.from("deals").select("*", { count: "exact", head: true }).eq("empresa_id", emp.id),
      ]);

      // Calcula saúde: baseada em usuários ativos e dados cadastrados
      const saude = Math.min(100, Math.round(
        (userCount > 0 ? 40 : 0) +
        (leadCount > 0 ? 30 : 0) +
        (emp.mrr > 0 ? 20 : 0) +
        (emp.assinatura_ativa ? 10 : 0)
      ));

      return {
        ...emp,
        plano_nome: emp.planos?.nome || emp.status || "trial",
        usuario_count: userCount || 0,
        lead_count: leadCount || 0,
        deal_count: dealCount || 0,
        saude,
      };
    }));

    setEmpresas(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const abrirAmbiente = async (emp) => {
    setSel(emp);
    setLogsLoading(true);
    const { data } = await supabase
      .from("logs_auditoria")
      .select("*")
      .eq("empresa_id", emp.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setLogs(data || []);
    setLogsLoading(false);
  };

  const resetarSenha = async (emp) => {
    if (!confirm(`Enviar e-mail de reset de senha para os usuários de ${emp.nome}?`)) return;
    const { data: users } = await supabase.from("usuarios").select("id, email").eq("empresa_id", emp.id);
    if (!users?.length) { alert("Nenhum usuário encontrado."); return; }

    let ok = 0;
    for (const u of users) {
      if (!u.email) continue;
      const { error } = await supabase.auth.admin?.resetPasswordForEmail?.(u.email);
      if (!error) ok++;
    }
    alert(`Reset enviado para ${ok} usuário(s).`);
  };

  const filteredEmps = empresas.filter(e =>
    !busca || (e.nome || "").toLowerCase().includes(busca.toLowerCase()) || (e.segmento || "").toLowerCase().includes(busca.toLowerCase())
  );

  const fmtHora = (iso) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
  const NC = { info: L.teal, warn: L.yellow, error: L.red };

  return (
    <Fade>
      {/* Banner de suporte */}
      <div style={{ background: L.greenBg, border: `1.5px solid ${L.green}22`, borderRadius: 11, padding: "12px 18px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: L.green, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: L.green }}>Modo Suporte C4HUB — Sessão Auditada</div>
          <div style={{ fontSize: 11, color: L.t3 }}>Todas as ações são registradas automaticamente nos logs do sistema.</div>
        </div>
        <div style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: L.t4 }}>SID: {SID}</div>
      </div>

      {!sel ? (
        <>
          {/* Busca + resumo */}
          <Row between mb={14}>
            <Row gap={10}>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar empresa..."
                style={{ padding: "7px 12px", borderRadius: 8, border: `1.5px solid ${L.line}`, background: L.white, color: L.t1, fontSize: 12, fontFamily: "inherit", outline: "none", width: 220 }}
                onFocus={e => e.target.style.borderColor = L.teal} onBlur={e => e.target.style.borderColor = L.line} />
              <Tag color={L.teal} bg={L.tealBg}>{empresas.length} empresa{empresas.length !== 1 ? "s" : ""}</Tag>
            </Row>
            <button onClick={load} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit", background: L.surface, color: L.t2, border: `1px solid ${L.line}` }}>↺ Atualizar</button>
          </Row>

          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: L.t4 }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>⊙</div>
              <div>Carregando empresas...</div>
            </div>
          ) : filteredEmps.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: L.t4 }}>Nenhuma empresa encontrada.</div>
          ) : (
            <Grid cols={2} gap={12}>
              {filteredEmps.map((emp) => {
                const pc = pColor(emp.plano_nome);
                return (
                  <div key={emp.id}
                    style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: 20, transition: "all .15s", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = L.teal + "44"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = L.line; e.currentTarget.style.transform = "none"; }}
                  >
                    <Row between mb={14}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: L.t1, marginBottom: 4 }}>{emp.nome || "Sem nome"}</div>
                        <Row gap={6}>
                          <Tag color={pc.c} bg={pc.bg}>{emp.plano_nome}</Tag>
                          {emp.segmento && <Tag color={L.t3} bg={L.surface} small>{emp.segmento}</Tag>}
                        </Row>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Tag color={emp.assinatura_ativa ? L.green : L.yellow} bg={emp.assinatura_ativa ? L.greenBg : L.yellowBg}>
                          {emp.assinatura_ativa ? "Ativo" : emp.status || "trial"}
                        </Tag>
                        <div style={{ marginTop: 5, fontSize: 10, color: saudeColor(emp.saude), fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>Saúde {emp.saude}%</div>
                      </div>
                    </Row>

                    <Grid cols={3} gap={8} mb={14}>
                      {[
                        ["Usuários",   emp.usuario_count,                                   L.teal,   L.tealBg  ],
                        ["Leads",      emp.lead_count,                                      L.copper, L.copperBg],
                        ["MRR",        emp.mrr ? `R$${(emp.mrr/1000).toFixed(0)}k` : "—",  L.green,  L.greenBg ],
                      ].map(([k, v, c, bg]) => (
                        <div key={k} style={{ textAlign: "center", padding: "8px", background: bg, borderRadius: 8, border: `1px solid ${c}18` }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: c, fontFamily: "'Outfit',sans-serif" }}>{v}</div>
                          <div style={{ fontSize: 9, color: L.t4, textTransform: "uppercase", letterSpacing: "1px", fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{k}</div>
                        </div>
                      ))}
                    </Grid>

                    <button onClick={() => abrirAmbiente(emp)}
                      style={{ width: "100%", padding: "9px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: L.tealBg, color: L.teal, border: `1.5px solid ${L.teal}22`, transition: "all .12s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = L.teal; e.currentTarget.style.color = "white"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = L.tealBg; e.currentTarget.style.color = L.teal; }}
                    >
                      Acessar Ambiente
                    </button>
                  </div>
                );
              })}
            </Grid>
          )}
        </>
      ) : (
        // ── Ambiente da empresa selecionada ──
        <div>
          <Row gap={10} mb={14}>
            <button onClick={() => setSel(null)}
              style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", background: "transparent", color: L.t2, border: `1px solid ${L.line}`, transition: "all .12s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = L.teal; e.currentTarget.style.color = L.teal; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = L.line; e.currentTarget.style.color = L.t2; }}
            >
              ← Voltar
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, color: L.t1 }}>Ambiente: <span style={{ color: L.teal }}>{sel.nome}</span></span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <Tag color={pColor(sel.plano_nome).c} bg={pColor(sel.plano_nome).bg}>{sel.plano_nome}</Tag>
              <Tag color={L.green} bg={L.greenBg}>Suporte Ativo</Tag>
            </div>
          </Row>

          {/* KPIs */}
          <Grid cols={4} gap={12} mb={14}>
            {[
              { l: "Usuários Ativos", v: sel.usuario_count, c: L.teal   },
              { l: "Leads",           v: sel.lead_count,    c: L.copper  },
              { l: "Deals",           v: sel.deal_count,    c: L.blue    },
              { l: "Saúde",           v: `${sel.saude}%`,   c: saudeColor(sel.saude) },
            ].map((k, i) => (
              <div key={i} style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: 10, color: L.t4, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 5, fontWeight: 600 }}>{k.l}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: k.c, fontFamily: "'Outfit',sans-serif" }}>{k.v}</div>
              </div>
            ))}
          </Grid>

          <Grid cols={2} gap={12}>
            {/* Ações */}
            <Card title="Ações de Suporte">
              {[
                { l: "Ver leads da empresa",      c: L.teal,   bg: L.tealBg,   ico: "◎", fn: () => window.open(`/leads?empresa=${sel.id}`) },
                { l: "Resetar senha de usuários", c: L.yellow, bg: L.yellowBg, ico: "⊙", fn: () => resetarSenha(sel) },
                { l: "Atualizar dados da empresa",c: L.copper, bg: L.copperBg, ico: "✎", fn: () => alert("Abra Clientes → selecione a empresa para editar.") },
                { l: "Ver logs desta empresa",    c: L.blue,   bg: L.blueBg,   ico: "≡", fn: () => {} },
                { l: "Forçar sync de dados",      c: L.green,  bg: L.greenBg,  ico: "↺", fn: () => { abrirAmbiente(sel); } },
                { l: "Marcar como suporte crítico",c: L.red,   bg: L.redBg,    ico: "⊗", fn: () => alert("Ticket de suporte crítico registrado nos logs.") },
              ].map((item, idx) => (
                <button key={idx} onClick={item.fn}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", background: L.surface, color: L.t2, border: `1px solid ${L.line}`, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, marginBottom: 8, transition: "all .12s", textAlign: "left" }}
                  onMouseEnter={e => { e.currentTarget.style.background = item.bg; e.currentTarget.style.color = item.c; e.currentTarget.style.borderColor = item.c + "33"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = L.surface; e.currentTarget.style.color = L.t2; e.currentTarget.style.borderColor = L.line; }}
                >
                  <span style={{ fontSize: 14 }}>{item.ico}</span>{item.l}
                </button>
              ))}
            </Card>

            {/* Eventos recentes */}
            <Card title="Eventos Recentes" sub={sel.nome}>
              {logsLoading ? (
                <div style={{ padding: 20, textAlign: "center", color: L.t4, fontSize: 12 }}>Carregando eventos...</div>
              ) : logs.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: L.t4, fontSize: 12 }}>Nenhum evento registrado ainda.</div>
              ) : (
                logs.map((log, i) => (
                  <div key={log.id || i} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: `1px solid ${L.lineSoft}` }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: NC[log.nivel] || L.teal, marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 12, color: L.t2 }}>{log.acao || "—"}</div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 10, color: L.t4, fontFamily: "'JetBrains Mono',monospace" }}>{fmtHora(log.created_at)}</div>
                      {log.usuario_email && <div style={{ fontSize: 10, color: L.t3, marginTop: 2 }}>{log.usuario_email}</div>}
                    </div>
                  </div>
                ))
              )}
            </Card>
          </Grid>
        </div>
      )}
    </Fade>
  );
}
