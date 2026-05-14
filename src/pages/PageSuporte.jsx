import { useState, useEffect, useCallback } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Fade, Row, Grid, Card, Tag, Av } from "../components/ui";

const PC = {
  enterprise: { c: L.teal,   bg: L.tealBg  },
  growth:     { c: L.copper, bg: L.copperBg },
  starter:    { c: L.t3,     bg: L.surface  },
};
const pColor = (p) => PC[(p||"starter").toLowerCase()] || PC.starter;
const saudeColor = (s) => s >= 80 ? L.green : s >= 50 ? L.yellow : L.red;
const fmtDt = (iso) => iso ? new Date(iso).toLocaleString("pt-BR", { day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit" }) : "—";
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

const btn = (bg=L.surface,c=L.t2,extra={}) => ({
  background:bg,color:c,border:`1px solid ${L.line}`,borderRadius:8,
  padding:"7px 14px",fontSize:11.5,cursor:"pointer",fontFamily:"inherit",
  fontWeight:500,transition:"all .12s",...extra,
});

// ── Status de lead ────────────────────────────────────────────────────────────
const LEAD_STATUS = {
  novo:    { l:"Novo",      c:"#6b7280", bg:"#f9fafb" },
  quente:  { l:"Quente",    c:"#dc2626", bg:"#fef2f2" },
  morno:   { l:"Morno",     c:"#d97706", bg:"#fffbeb" },
  frio:    { l:"Frio",      c:"#2563eb", bg:"#eff6ff" },
  ganho:   { l:"Ganho",     c:"#16a34a", bg:"#f0fdf4" },
  perdido: { l:"Perdido",   c:"#9ca3af", bg:"#f3f4f6" },
};

// ── Tabs da visão empresa ─────────────────────────────────────────────────────
const TABS = [
  { id:"overview",    label:"Visão Geral",  icon:"⊞" },
  { id:"leads",       label:"Leads",        icon:"◎" },
  { id:"conversas",   label:"Conversas",    icon:"💬" },
  { id:"usuarios",    label:"Usuários",     icon:"👥" },
  { id:"logs",        label:"Logs",         icon:"≡"  },
];

// ─── Painel de KPI ────────────────────────────────────────────────────────────
function KPIBox({ label, value, color }) {
  return (
    <div style={{ background:L.white, borderRadius:10, border:`1px solid ${L.line}`, padding:"14px 16px" }}>
      <div style={{ fontSize:9.5, color:L.t4, fontFamily:"'JetBrains Mono',monospace", letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, color, fontFamily:"'Outfit',sans-serif" }}>{value}</div>
    </div>
  );
}

// ── Componente de detalhes ────────────────────────────────────────────────────
function EmpresaDetail({ emp, onBack }) {
  const [tab,        setTab]        = useState("overview");
  const [leads,      setLeads]      = useState([]);
  const [conversas,  setConversas]  = useState([]);
  const [usuarios,   setUsuarios]   = useState([]);
  const [logs,       setLogs]       = useState([]);
  const [loading,    setLoading]    = useState({});
  const [busca,      setBusca]      = useState("");
  const [chamado,    setChamado]    = useState({ open:false, titulo:"", descricao:"", prioridade:"normal" });
  const [chamados,   setChamados]   = useState([]);

  const load = useCallback(async (t) => {
    setLoading(p => ({ ...p, [t]:true }));
    if (t === "leads") {
      const { data } = await supabase.from("leads").select("*")
        .eq("empresa_id", emp.id).order("created_at", { ascending:false }).limit(100);
      setLeads(data || []);
    } else if (t === "conversas") {
      const { data } = await supabase.from("conversas").select("*")
        .eq("empresa_id", emp.id).order("ultima_hora", { ascending:false }).limit(100);
      setConversas(data || []);
    } else if (t === "usuarios") {
      const { data } = await supabase.from("usuarios").select("*")
        .eq("empresa_id", emp.id).order("created_at", { ascending:false });
      setUsuarios(data || []);
    } else if (t === "logs") {
      const [
        { data: la },
        { data: laud },
        { data: lwa },
      ] = await Promise.all([
        supabase.from("logs_atendimento").select("*, conversas(contato_nome)")
          .eq("empresa_id", emp.id).order("created_at", { ascending:false }).limit(50),
        supabase.from("logs_auditoria").select("*")
          .eq("empresa_id", emp.id).order("created_at", { ascending:false }).limit(50),
        supabase.from("logs_whatsapp").select("*")
          .eq("empresa_id", emp.id).order("created_at", { ascending:false }).limit(150),
      ]);
      const combined = [
        ...(la  ||[]).map(l => ({ ...l, _src:"atendimento" })),
        ...(laud ||[]).map(l => ({ ...l, _src:"auditoria"  })),
        ...(lwa  ||[]).map(l => ({ ...l, _src:"whatsapp"   })),
      ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 200);
      setLogs(combined);
    }
    setLoading(p => ({ ...p, [t]:false }));
  }, [emp.id]);

  useEffect(() => { load(tab); }, [tab, load]);

  // Chamados ficam em sessionStorage por enquanto (sem tabela específica)
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(`chamados:${emp.id}`) || "[]");
      setChamados(stored);
    } catch(_) {}
  }, [emp.id]);

  const salvarChamado = () => {
    if (!chamado.titulo.trim()) return;
    const novo = {
      id: Date.now(),
      titulo: chamado.titulo,
      descricao: chamado.descricao,
      prioridade: chamado.prioridade,
      status: "aberto",
      criado_em: new Date().toISOString(),
    };
    const atualizados = [novo, ...chamados];
    setChamados(atualizados);
    sessionStorage.setItem(`chamados:${emp.id}`, JSON.stringify(atualizados));
    setChamado({ open:false, titulo:"", descricao:"", prioridade:"normal" });
  };

  const fecharChamado = (id) => {
    const atualizados = chamados.map(c => c.id === id ? { ...c, status:"resolvido" } : c);
    setChamados(atualizados);
    sessionStorage.setItem(`chamados:${emp.id}`, JSON.stringify(atualizados));
  };

  const pc = pColor(emp.plano_nome);
  const isLoading = loading[tab];

  const filtrar = (list, campos) => !busca ? list : list.filter(item =>
    campos.some(c => (item[c]||"").toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div>
      {/* Cabeçalho da empresa */}
      <Row gap={10} mb={14} style={{ flexWrap:"wrap" }}>
        <button onClick={onBack} style={btn()}>← Voltar</button>
        <Av name={emp.nome||"?"} color={pc.c} size={36} />
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:L.t1 }}>{emp.nome}</div>
          <Row gap={6} style={{ marginTop:3 }}>
            <Tag color={pc.c} bg={pc.bg}>{emp.plano_nome}</Tag>
            <Tag color={emp.assinatura_ativa?L.green:L.yellow} bg={emp.assinatura_ativa?L.greenBg:L.yellowBg}>
              {emp.assinatura_ativa?"Ativo":emp.status||"trial"}
            </Tag>
            <Tag color={saudeColor(emp.saude)} bg={L.surface}>Saúde {emp.saude}%</Tag>
          </Row>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
          <button onClick={() => setChamado(p => ({ ...p, open:true }))}
            style={btn(L.accent,"white",{ fontWeight:600 })}>
            + Chamado
          </button>
        </div>
      </Row>

      {/* KPIs */}
      <Grid cols={5} gap={10} mb={14} responsive>
        <KPIBox label="Usuários"   value={emp.usuario_count}        color={L.teal}   />
        <KPIBox label="Leads"      value={emp.lead_count}           color={L.copper} />
        <KPIBox label="Deals"      value={emp.deal_count}           color={L.blue}   />
        <KPIBox label="Conversas"  value={emp.conv_count||"—"}      color={L.green}  />
        <KPIBox label="Saúde"      value={`${emp.saude}%`}          color={saudeColor(emp.saude)} />
      </Grid>

      {/* Chamados abertos (badge) */}
      {chamados.filter(c => c.status==="aberto").length > 0 && (
        <div style={{ background:L.yellowBg, border:`1px solid ${L.yellowA2}`, borderRadius:9,
          padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:14 }}>⚠</span>
          <span style={{ fontSize:12, color:L.yellow, fontWeight:600 }}>
            {chamados.filter(c=>c.status==="aberto").length} chamado(s) aberto(s) para {emp.nome}
          </span>
          <button onClick={() => setTab("overview")} style={{ marginLeft:"auto", ...btn(L.yellowBg, L.yellow) }}>Ver chamados</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${L.line}`, marginBottom:16, overflowX:"auto", scrollbarWidth:"none" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setBusca(""); }}
            style={{ flexShrink:0, padding:"9px 16px", fontSize:12, fontWeight:tab===t.id?700:400,
              cursor:"pointer", fontFamily:"inherit", border:"none", background:"none",
              color: tab===t.id ? L.t1 : L.t3,
              borderBottom: tab===t.id ? `2px solid ${L.accent}` : "2px solid transparent",
              transition:"all .12s", display:"flex", alignItems:"center", gap:5 }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Busca (aparece nas tabs com listas) */}
      {["leads","conversas","usuarios","logs"].includes(tab) && (
        <div style={{ display:"flex", alignItems:"center", gap:8, background:L.surface,
          border:`1px solid ${L.line}`, borderRadius:8, padding:"6px 12px", marginBottom:12, maxWidth:320 }}>
          <span style={{ color:L.t4, fontSize:13 }}>⌕</span>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Filtrar..."
            style={{ background:"none", border:"none", outline:"none", color:L.t1, fontSize:12, width:"100%", fontFamily:"inherit" }} />
        </div>
      )}

      {isLoading && (
        <div style={{ padding:40, textAlign:"center", color:L.t4, fontSize:12 }}>
          <div style={{ animation:"spin 1s linear infinite", fontSize:20, marginBottom:6, display:"inline-block" }}>⟳</div>
          <div>Carregando...</div>
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {!isLoading && tab==="overview" && (
        <Grid cols={2} gap={14} responsive>
          {/* Chamados */}
          <Card title="Chamados de Suporte" sub={`${chamados.filter(c=>c.status==="aberto").length} abertos`} accent>
            {chamados.length === 0 ? (
              <div style={{ padding:"20px 0", textAlign:"center", color:L.t4, fontSize:12 }}>
                Nenhum chamado registrado.<br/>
                <button onClick={() => setChamado(p=>({...p,open:true}))}
                  style={{ marginTop:10, ...btn(L.tealBg,L.teal) }}>+ Abrir chamado</button>
              </div>
            ) : chamados.slice(0,8).map(c => (
              <div key={c.id} style={{ padding:"9px 0", borderBottom:`1px solid ${L.lineSoft}`, display:"flex", gap:10, alignItems:"flex-start" }}>
                <div style={{ width:7, height:7, borderRadius:"50%", marginTop:5, flexShrink:0,
                  background: c.status==="resolvido" ? L.green : c.prioridade==="critico" ? L.red : c.prioridade==="alto" ? L.yellow : L.blue }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:L.t1 }}>{c.titulo}</div>
                  {c.descricao && <div style={{ fontSize:11, color:L.t3, marginTop:2 }}>{c.descricao.slice(0,80)}{c.descricao.length>80?"...":""}</div>}
                  <Row gap={6} style={{ marginTop:4 }}>
                    <Tag color={c.prioridade==="critico"?L.red:c.prioridade==="alto"?L.yellow:L.blue}
                      bg={c.prioridade==="critico"?L.redBg:c.prioridade==="alto"?L.yellowBg:L.blueBg} small>
                      {c.prioridade}
                    </Tag>
                    <Tag color={c.status==="resolvido"?L.green:L.t3} bg={c.status==="resolvido"?L.greenBg:L.surface} small>
                      {c.status}
                    </Tag>
                    <span style={{ fontSize:10, color:L.t4 }}>{fmtDate(c.criado_em)}</span>
                  </Row>
                </div>
                {c.status==="aberto" && (
                  <button onClick={()=>fecharChamado(c.id)} style={{ ...btn(L.greenBg,L.green), padding:"3px 8px", fontSize:10, flexShrink:0 }}>✓ Resolver</button>
                )}
              </div>
            ))}
          </Card>

          {/* Ações rápidas */}
          <Card title="Ações Rápidas">
            {[
              { l:"Ver leads",            c:L.teal,   bg:L.tealBg,   ico:"◎", fn:()=>setTab("leads")   },
              { l:"Ver conversas WhatsApp",c:L.green,  bg:L.greenBg,  ico:"💬", fn:()=>setTab("conversas") },
              { l:"Ver usuários",         c:L.blue,   bg:L.blueBg,   ico:"👥", fn:()=>setTab("usuarios") },
              { l:"Ver logs de atividade",c:L.copper, bg:L.copperBg, ico:"≡",  fn:()=>setTab("logs")    },
              { l:"Abrir chamado",        c:L.yellow, bg:L.yellowBg, ico:"⚐",  fn:()=>setChamado(p=>({...p,open:true})) },
              { l:"Forçar atualização",   c:L.t3,     bg:L.surface,  ico:"↺",  fn:()=>load(tab)         },
            ].map((item,i) => (
              <button key={i} onClick={item.fn}
                style={{ width:"100%", padding:"9px 12px", borderRadius:8, cursor:"pointer", fontFamily:"inherit",
                  background:L.surface, color:L.t2, border:`1px solid ${L.line}`,
                  display:"flex", alignItems:"center", gap:10, fontSize:12, marginBottom:7,
                  transition:"all .12s", textAlign:"left" }}
                onMouseEnter={e=>{e.currentTarget.style.background=item.bg;e.currentTarget.style.color=item.c;e.currentTarget.style.borderColor=item.c+"33";}}
                onMouseLeave={e=>{e.currentTarget.style.background=L.surface;e.currentTarget.style.color=L.t2;e.currentTarget.style.borderColor=L.line;}}>
                <span style={{ fontSize:14 }}>{item.ico}</span>{item.l}
              </button>
            ))}
          </Card>

          {/* Info empresa */}
          <Card title="Dados da Empresa">
            {[
              ["Email",    emp.email],
              ["Telefone", emp.telefone],
              ["CNPJ",     emp.cnpj],
              ["Segmento", emp.segmento],
              ["MRR",      emp.mrr ? `R$ ${emp.mrr.toLocaleString("pt-BR")}` : null],
              ["Desde",    fmtDate(emp.created_at)],
              ["Vencimento", fmtDate(emp.vencimento_trial || emp.vencimento)],
            ].filter(([,v]) => v).map(([k,v]) => (
              <div key={k} style={{ display:"flex", gap:8, padding:"6px 0", borderBottom:`1px solid ${L.lineSoft}` }}>
                <span style={{ fontSize:10.5, color:L.t4, minWidth:80, fontWeight:600 }}>{k}</span>
                <span style={{ fontSize:11.5, color:L.t1 }}>{v}</span>
              </div>
            ))}
          </Card>

          {/* Últimos logs */}
          <Card title="Últimas Atividades" sub="API WhatsApp + atendimento">
            <button onClick={()=>load("logs")} style={{ ...btn(), fontSize:10, padding:"3px 8px", marginBottom:10 }}>↺ Atualizar</button>
            {loading.logs ? (
              <div style={{ color:L.t4, fontSize:12 }}>Carregando...</div>
            ) : logs.slice(0,8).length === 0 ? (
              <div style={{ color:L.t4, fontSize:12 }}>Nenhum log registrado.</div>
            ) : logs.slice(0,8).map((log,i) => {
              const isErr = log.nivel==="error";
              const isWarn= log.nivel==="warn";
              const dot = isErr?L.red:isWarn?L.yellow:log._src==="whatsapp"?L.blue:log._src==="atendimento"?L.green:L.copper;
              const titulo = log._src==="whatsapp" ? (log.resumo||log.tipo) : (log.acao||log.tipo||"—");
              return (
                <div key={log.id||i} style={{ display:"flex", gap:8, padding:"7px 0", borderBottom:`1px solid ${L.lineSoft}`,
                  borderLeft: isErr?`2px solid ${L.red}`:isWarn?`2px solid ${L.yellow}`:"2px solid transparent",
                  paddingLeft: isErr||isWarn ? 6 : 0 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:dot, marginTop:5, flexShrink:0 }} />
                  <div style={{ flex:1, fontSize:11, color:L.t2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{titulo}</div>
                  <div style={{ fontSize:10, color:L.t4, flexShrink:0 }}>{fmtDt(log.created_at)}</div>
                </div>
              );
            })}
            {logs.length > 0 && (
              <button onClick={()=>setTab("logs")} style={{ ...btn(), fontSize:10, padding:"3px 8px", marginTop:8, width:"100%" }}>
                Ver todos os logs →
              </button>
            )}
          </Card>
        </Grid>
      )}

      {/* ── LEADS ── */}
      {!isLoading && tab==="leads" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontSize:12, color:L.t3 }}>{leads.length} lead{leads.length!==1?"s":""} encontrado{leads.length!==1?"s":""}</span>
          </div>
          {filtrar(leads, ["nome","email","whatsapp","origem","status"]).length === 0 ? (
            <div style={{ padding:40, textAlign:"center", color:L.t4 }}>Nenhum lead encontrado.</div>
          ) : (
            <div style={{ background:L.white, borderRadius:10, border:`1px solid ${L.line}`, overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:L.surface, borderBottom:`2px solid ${L.line}` }}>
                    {["Nome","WhatsApp","Origem","Status","Score","Criado"].map(h => (
                      <th key={h} style={{ padding:"9px 14px", textAlign:"left", fontSize:9, fontWeight:700, color:L.t4, letterSpacing:"1.4px", textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrar(leads, ["nome","email","whatsapp","origem","status"]).map((l) => {
                    const st = LEAD_STATUS[l.status] || LEAD_STATUS.novo;
                    return (
                      <tr key={l.id} style={{ borderBottom:`1px solid ${L.lineSoft}`, transition:"background .1s" }}
                        onMouseEnter={e=>e.currentTarget.style.background=L.surface}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{ padding:"10px 14px" }}>
                          <div style={{ fontSize:12.5, fontWeight:600, color:L.t1 }}>{l.nome||"—"}</div>
                          {l.email && <div style={{ fontSize:10.5, color:L.t4 }}>{l.email}</div>}
                        </td>
                        <td style={{ padding:"10px 14px", fontSize:12, color:L.t2 }}>{l.whatsapp||"—"}</td>
                        <td style={{ padding:"10px 14px" }}>
                          <Tag color={L.t3} bg={L.surface} small>{l.origem||"—"}</Tag>
                        </td>
                        <td style={{ padding:"10px 14px" }}>
                          <Tag color={st.c} bg={st.bg} small>{st.l}</Tag>
                        </td>
                        <td style={{ padding:"10px 14px", fontSize:12, color:L.t2 }}>{l.score??"—"}</td>
                        <td style={{ padding:"10px 14px", fontSize:11, color:L.t4, fontFamily:"'JetBrains Mono',monospace" }}>{fmtDate(l.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CONVERSAS ── */}
      {!isLoading && tab==="conversas" && (
        <div>
          <div style={{ marginBottom:10 }}>
            <span style={{ fontSize:12, color:L.t3 }}>{conversas.length} conversa{conversas.length!==1?"s":""}</span>
          </div>
          {filtrar(conversas, ["contato_nome","contato_telefone","ultima_mensagem"]).length === 0 ? (
            <div style={{ padding:40, textAlign:"center", color:L.t4 }}>Nenhuma conversa encontrada.</div>
          ) : (
            <div style={{ background:L.white, borderRadius:10, border:`1px solid ${L.line}`, overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:L.surface, borderBottom:`2px solid ${L.line}` }}>
                    {["Contato","Telefone","Última Mensagem","Status","Última Atividade"].map(h => (
                      <th key={h} style={{ padding:"9px 14px", textAlign:"left", fontSize:9, fontWeight:700, color:L.t4, letterSpacing:"1.4px", textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrar(conversas, ["contato_nome","contato_telefone","ultima_mensagem"]).map((c) => (
                    <tr key={c.id} style={{ borderBottom:`1px solid ${L.lineSoft}`, transition:"background .1s" }}
                      onMouseEnter={e=>e.currentTarget.style.background=L.surface}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding:"10px 14px" }}>
                        <Row gap={8}>
                          <Av name={c.contato_nome||"?"} color={L.teal} size={28} />
                          <span style={{ fontSize:12.5, fontWeight:600, color:L.t1 }}>{c.contato_nome||"—"}</span>
                        </Row>
                      </td>
                      <td style={{ padding:"10px 14px", fontSize:12, color:L.t2 }}>{c.contato_telefone||"—"}</td>
                      <td style={{ padding:"10px 14px", fontSize:11.5, color:L.t3, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {c.ultima_mensagem||"Sem mensagens"}
                      </td>
                      <td style={{ padding:"10px 14px" }}>
                        <Tag color={c.status==="em_atendimento"?L.blue:c.status==="aguardando"?L.yellow:c.status==="resolvida"?L.t4:L.green}
                          bg={c.status==="em_atendimento"?L.blueBg:c.status==="aguardando"?L.yellowBg:c.status==="resolvida"?L.surface:L.greenBg} small>
                          {c.status||"aberta"}
                        </Tag>
                      </td>
                      <td style={{ padding:"10px 14px", fontSize:11, color:L.t4, fontFamily:"'JetBrains Mono',monospace" }}>{fmtDt(c.ultima_hora)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── USUÁRIOS ── */}
      {!isLoading && tab==="usuarios" && (
        <div>
          <div style={{ marginBottom:10 }}>
            <span style={{ fontSize:12, color:L.t3 }}>{usuarios.length} usuário{usuarios.length!==1?"s":""}</span>
          </div>
          {filtrar(usuarios, ["nome","email","cargo","role"]).length === 0 ? (
            <div style={{ padding:40, textAlign:"center", color:L.t4 }}>Nenhum usuário encontrado.</div>
          ) : (
            <div style={{ background:L.white, borderRadius:10, border:`1px solid ${L.line}`, overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:L.surface, borderBottom:`2px solid ${L.line}` }}>
                    {["Nome","Email","Cargo","Perfil","Status","Criado"].map(h => (
                      <th key={h} style={{ padding:"9px 14px", textAlign:"left", fontSize:9, fontWeight:700, color:L.t4, letterSpacing:"1.4px", textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrar(usuarios, ["nome","email","cargo","role"]).map((u) => (
                    <tr key={u.id} style={{ borderBottom:`1px solid ${L.lineSoft}`, transition:"background .1s" }}
                      onMouseEnter={e=>e.currentTarget.style.background=L.surface}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding:"10px 14px" }}>
                        <Row gap={8}>
                          <Av name={u.nome||"?"} color={L.copper} size={28} src={u.foto_url} />
                          <span style={{ fontSize:12.5, fontWeight:600, color:L.t1 }}>{u.nome||"—"}</span>
                        </Row>
                      </td>
                      <td style={{ padding:"10px 14px", fontSize:11.5, color:L.t3 }}>{u.email||"—"}</td>
                      <td style={{ padding:"10px 14px", fontSize:12, color:L.t2 }}>{u.cargo||"—"}</td>
                      <td style={{ padding:"10px 14px" }}>
                        <Tag color={u.role==="admin"?L.teal:u.role==="c4hub_admin"?L.copper:L.t3} bg={u.role==="admin"?L.tealBg:u.role==="c4hub_admin"?L.copperBg:L.surface} small>
                          {u.role||"user"}
                        </Tag>
                      </td>
                      <td style={{ padding:"10px 14px" }}>
                        <Tag color={u.ativo!==false?L.green:L.red} bg={u.ativo!==false?L.greenBg:L.redBg} small>
                          {u.ativo!==false?"Ativo":"Inativo"}
                        </Tag>
                      </td>
                      <td style={{ padding:"10px 14px", fontSize:11, color:L.t4, fontFamily:"'JetBrains Mono',monospace" }}>{fmtDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── LOGS ── */}
      {!isLoading && tab==="logs" && (() => {
        // Config de badge por tipo de log WhatsApp
        const WA_TIPO = {
          webhook_recebido:  { l:"Webhook",    c:L.blue,   bg:L.blueBg   },
          mensagem_bot:      { l:"Bot",        c:L.teal,   bg:L.tealBg   },
          mensagem_agendada: { l:"Agendada",   c:L.copper, bg:L.copperBg },
          erro_api:          { l:"Erro API",   c:L.red,    bg:L.redBg    },
          conexao:           { l:"Conexão",    c:L.green,  bg:L.greenBg  },
          fluxo:             { l:"Fluxo",      c:L.yellow, bg:L.yellowBg },
          conversa_criada:   { l:"Nova conv.", c:L.green,  bg:L.greenBg  },
        };
        const SRC_BADGE = {
          atendimento: { l:"atendimento", c:L.green,  bg:L.greenBg  },
          auditoria:   { l:"auditoria",   c:L.copper, bg:L.copperBg },
          whatsapp:    { l:"whatsapp",    c:L.blue,   bg:L.blueBg   },
        };
        const logsFiltered = filtrar(logs, ["acao","tipo","evento","usuario_email","detalhe","resumo","telefone"]);
        return (
          <div>
            <div style={{ marginBottom:10, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <span style={{ fontSize:12, color:L.t3 }}>{logs.length} evento{logs.length!==1?"s":""}</span>
              <button onClick={()=>load("logs")} style={{ ...btn(), fontSize:10, padding:"4px 10px" }}>↺ Atualizar</button>
              <div style={{ marginLeft:"auto", display:"flex", gap:6, flexWrap:"wrap" }}>
                {["whatsapp","atendimento","auditoria"].map(src => {
                  const b = SRC_BADGE[src];
                  return <Tag key={src} color={b.c} bg={b.bg} small>{b.l} {logs.filter(l=>l._src===src).length}</Tag>;
                })}
              </div>
            </div>
            {logsFiltered.length === 0 ? (
              <div style={{ padding:40, textAlign:"center", color:L.t4 }}>Nenhum log encontrado.</div>
            ) : (
              <div style={{ background:L.white, borderRadius:10, border:`1px solid ${L.line}`, overflow:"hidden" }}>
                {logsFiltered.map((log,i) => {
                  const isWA   = log._src === "whatsapp";
                  const waConf = WA_TIPO[log.tipo] || { l:log.tipo||"log", c:L.t3, bg:L.surface };
                  const srcConf= SRC_BADGE[log._src] || SRC_BADGE.auditoria;
                  const dotColor = log.nivel==="error"?L.red : log.nivel==="warn"?L.yellow
                    : isWA && log.tipo==="mensagem_bot"?L.teal
                    : isWA && log.tipo==="conexao"?L.green
                    : isWA?L.blue : log._src==="atendimento"?L.green : L.copper;
                  const titulo = isWA
                    ? (log.resumo || log.tipo || "—")
                    : (log.acao || log.tipo || "Evento");
                  const sub = isWA
                    ? null
                    : (log.detalhe || log.observacao || null);
                  return (
                    <div key={log.id||i} style={{ padding:"11px 16px", borderBottom:`1px solid ${L.lineSoft}`,
                      display:"flex", gap:12, alignItems:"flex-start", transition:"background .1s",
                      borderLeft: log.nivel==="error" ? `3px solid ${L.red}` : log.nivel==="warn" ? `3px solid ${L.yellow}` : "3px solid transparent" }}
                      onMouseEnter={e=>e.currentTarget.style.background=L.surface}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <div style={{ width:7, height:7, borderRadius:"50%", marginTop:6, flexShrink:0, background:dotColor }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:500, color:L.t1, wordBreak:"break-word" }}>{titulo}</div>
                        {sub && <div style={{ fontSize:11, color:L.t3, marginTop:2 }}>{sub}</div>}
                        <Row gap={6} style={{ marginTop:5, flexWrap:"wrap" }}>
                          <Tag color={srcConf.c} bg={srcConf.bg} small>{srcConf.l}</Tag>
                          {isWA && <Tag color={waConf.c} bg={waConf.bg} small>{waConf.l}</Tag>}
                          {isWA && log.origem && log.origem !== "evolution-webhook" && (
                            <Tag color={L.t3} bg={L.surface} small>{log.origem}</Tag>
                          )}
                          {isWA && log.evento && (
                            <span style={{ fontSize:10, color:L.t4, fontFamily:"'JetBrains Mono',monospace" }}>{log.evento}</span>
                          )}
                          {isWA && log.telefone && (
                            <span style={{ fontSize:10, color:L.t4 }}>📱 {log.telefone}</span>
                          )}
                          {!isWA && log.usuario_email && (
                            <span style={{ fontSize:10, color:L.t4 }}>👤 {log.usuario_email}</span>
                          )}
                          {!isWA && log.conversas?.contato_nome && (
                            <span style={{ fontSize:10, color:L.t4 }}>💬 {log.conversas.contato_nome}</span>
                          )}
                        </Row>
                      </div>
                      <div style={{ fontSize:10.5, color:L.t4, flexShrink:0, fontFamily:"'JetBrains Mono',monospace", minWidth:70, textAlign:"right" }}>
                        {fmtDt(log.created_at)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Modal Chamado ── */}
      {chamado.open && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:200,
          display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={() => setChamado(p=>({...p,open:false}))}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}
            style={{ background:L.white, borderRadius:14, padding:24, width:440, boxShadow:"0 12px 48px rgba(0,0,0,.22)", border:`1px solid ${L.line}` }}>
            <div style={{ fontSize:14, fontWeight:700, color:L.t1, marginBottom:4 }}>Abrir Chamado</div>
            <div style={{ fontSize:11.5, color:L.t3, marginBottom:16 }}>Empresa: {emp.nome}</div>

            <label style={{ fontSize:11, fontWeight:600, color:L.t3, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:".5px" }}>Título *</label>
            <input value={chamado.titulo} onChange={e=>setChamado(p=>({...p,titulo:e.target.value}))}
              placeholder="Descreva brevemente o chamado..."
              style={{ width:"100%", border:`1px solid ${L.line}`, borderRadius:8, padding:"9px 12px",
                fontSize:12.5, color:L.t1, background:L.surface, outline:"none", fontFamily:"inherit",
                marginBottom:12, boxSizing:"border-box" }} />

            <label style={{ fontSize:11, fontWeight:600, color:L.t3, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:".5px" }}>Prioridade</label>
            <select value={chamado.prioridade} onChange={e=>setChamado(p=>({...p,prioridade:e.target.value}))}
              style={{ width:"100%", border:`1px solid ${L.line}`, borderRadius:8, padding:"8px 12px",
                fontSize:12, color:L.t1, background:L.surface, outline:"none", fontFamily:"inherit", marginBottom:12 }}>
              <option value="normal">Normal</option>
              <option value="alto">Alto</option>
              <option value="critico">Crítico</option>
            </select>

            <label style={{ fontSize:11, fontWeight:600, color:L.t3, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:".5px" }}>Descrição</label>
            <textarea value={chamado.descricao} onChange={e=>setChamado(p=>({...p,descricao:e.target.value}))}
              placeholder="Detalhes adicionais..."
              rows={3}
              style={{ width:"100%", border:`1px solid ${L.line}`, borderRadius:8, padding:"8px 12px",
                fontSize:12, color:L.t1, background:L.surface, outline:"none", fontFamily:"inherit",
                resize:"vertical", marginBottom:16, boxSizing:"border-box" }} />

            <Row gap={8} style={{ justifyContent:"flex-end" }}>
              <button onClick={()=>setChamado(p=>({...p,open:false}))} style={btn()}>Cancelar</button>
              <button onClick={salvarChamado} disabled={!chamado.titulo.trim()}
                style={{ ...btn(L.accent,"white"), opacity:chamado.titulo.trim()?1:.5 }}>
                Abrir Chamado
              </button>
            </Row>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function PageSuporte({ user }) {
  const [empresas, setEmpresas] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [sel,      setSel]      = useState(null);
  const [busca,    setBusca]    = useState("");
  const [ordenar,  setOrdenar]  = useState("saude"); // saude | nome | plano | data

  const SID = Math.random().toString(36).slice(2,9).toUpperCase();

  const load = useCallback(async () => {
    setLoading(true);
    const { data: emps } = await supabase.from("empresas").select("*, planos(nome)").order("created_at", { ascending:false });
    if (!emps) { setLoading(false); return; }

    const enriched = await Promise.all(emps.map(async (emp) => {
      const [
        { count: userCount },
        { count: leadCount },
        { count: dealCount },
        { count: convCount },
      ] = await Promise.all([
        supabase.from("usuarios").select("*",{count:"exact",head:true}).eq("empresa_id",emp.id).eq("ativo",true),
        supabase.from("leads").select("*",{count:"exact",head:true}).eq("empresa_id",emp.id),
        supabase.from("deals").select("*",{count:"exact",head:true}).eq("empresa_id",emp.id),
        supabase.from("conversas").select("*",{count:"exact",head:true}).eq("empresa_id",emp.id),
      ]);

      const saude = Math.min(100, Math.round(
        (userCount > 0 ? 35 : 0) +
        (leadCount > 0 ? 25 : 0) +
        (convCount > 0 ? 20 : 0) +
        (emp.mrr > 0 ? 10 : 0) +
        (emp.assinatura_ativa ? 10 : 0)
      ));

      return {
        ...emp,
        plano_nome:    emp.planos?.nome || emp.status || "trial",
        usuario_count: userCount || 0,
        lead_count:    leadCount || 0,
        deal_count:    dealCount || 0,
        conv_count:    convCount || 0,
        saude,
      };
    }));

    setEmpresas(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtradas = empresas
    .filter(e => !busca || (e.nome||"").toLowerCase().includes(busca.toLowerCase()) || (e.segmento||"").toLowerCase().includes(busca.toLowerCase()))
    .sort((a,b) => {
      if (ordenar==="saude") return a.saude - b.saude; // menores primeiro (precisam atenção)
      if (ordenar==="nome")  return (a.nome||"").localeCompare(b.nome||"");
      if (ordenar==="plano") return (a.plano_nome||"").localeCompare(b.plano_nome||"");
      return new Date(b.created_at) - new Date(a.created_at);
    });

  const atenção = empresas.filter(e => e.saude < 50).length;
  const ativos   = empresas.filter(e => e.assinatura_ativa).length;

  if (sel) return (
    <Fade>
      <div style={{ background:L.greenBg, border:`1.5px solid ${L.greenA}`, borderRadius:10, padding:"8px 16px", marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:L.green, flexShrink:0 }} />
        <span style={{ fontSize:11.5, fontWeight:600, color:L.green }}>Modo Suporte C4HUB</span>
        <span style={{ fontSize:11, color:L.t3 }}>Sessão auditada · SID: {SID}</span>
      </div>
      <EmpresaDetail emp={sel} onBack={() => setSel(null)} />
    </Fade>
  );

  return (
    <Fade>
      {/* Banner */}
      <div style={{ background:L.greenBg, border:`1.5px solid ${L.greenA}`, borderRadius:10, padding:"10px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:L.green, flexShrink:0 }} />
        <div>
          <div style={{ fontSize:12, fontWeight:600, color:L.green }}>Modo Suporte C4HUB — Sessão Auditada</div>
          <div style={{ fontSize:11, color:L.t3 }}>Todas as ações são registradas automaticamente.</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          {atenção > 0 && <Tag color={L.red} bg={L.redBg}>⚠ {atenção} crítica{atenção!==1?"s":""}</Tag>}
          <Tag color={L.green} bg={L.greenBg}>{ativos} ativo{ativos!==1?"s":""}</Tag>
          <Tag color={L.teal} bg={L.tealBg}>{empresas.length} total</Tag>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:L.t4 }}>SID:{SID}</span>
        </div>
      </div>

      {/* Controles */}
      <Row between mb={12} style={{ flexWrap:"wrap", gap:8 }}>
        <Row gap={8} style={{ flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, background:L.surface,
            border:`1px solid ${L.line}`, borderRadius:8, padding:"6px 12px" }}>
            <span style={{ color:L.t4, fontSize:13 }}>⌕</span>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar empresa..."
              style={{ background:"none", border:"none", outline:"none", color:L.t1, fontSize:12, width:180, fontFamily:"inherit" }} />
          </div>
          <select value={ordenar} onChange={e=>setOrdenar(e.target.value)}
            style={{ ...btn(), fontSize:11 }}>
            <option value="saude">↑ Saúde (críticos primeiro)</option>
            <option value="nome">A→Z Nome</option>
            <option value="plano">Plano</option>
            <option value="data">Mais recentes</option>
          </select>
        </Row>
        <button onClick={load} style={btn()}>↺ Atualizar</button>
      </Row>

      {/* Grid de empresas */}
      {loading ? (
        <div style={{ padding:60, textAlign:"center", color:L.t4 }}>
          <div style={{ animation:"spin 1s linear infinite", fontSize:24, marginBottom:10, display:"inline-block" }}>⟳</div>
          <div>Carregando ambientes...</div>
        </div>
      ) : filtradas.length === 0 ? (
        <div style={{ padding:60, textAlign:"center", color:L.t4 }}>Nenhuma empresa encontrada.</div>
      ) : (
        <Grid cols={2} gap={12} responsive>
          {filtradas.map((emp) => {
            const pc = pColor(emp.plano_nome);
            const saude = emp.saude;
            const sc = saudeColor(saude);
            return (
              <div key={emp.id}
                style={{ background:L.white, borderRadius:12, border:`1.5px solid ${saude<50?L.red+"44":L.line}`,
                  padding:20, transition:"all .15s", boxShadow:"0 1px 3px rgba(0,0,0,0.04)", position:"relative" }}>
                {saude < 50 && (
                  <div style={{ position:"absolute", top:12, right:12, background:L.redBg, border:`1px solid ${L.redA2}`,
                    borderRadius:6, padding:"2px 8px", fontSize:9.5, color:L.red, fontWeight:700 }}>
                    ⚠ ATENÇÃO
                  </div>
                )}
                <Row gap={10} mb={12} style={{ alignItems:"flex-start" }}>
                  <Av name={emp.nome||"?"} color={pc.c} size={38} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:L.t1, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{emp.nome||"Sem nome"}</div>
                    <Row gap={5} style={{ flexWrap:"wrap" }}>
                      <Tag color={pc.c} bg={pc.bg}>{emp.plano_nome}</Tag>
                      {emp.segmento && <Tag color={L.t3} bg={L.surface} small>{emp.segmento}</Tag>}
                    </Row>
                  </div>
                </Row>

                {/* Métricas */}
                <Grid cols={4} gap={6} mb={14}>
                  {[
                    ["Usuários", emp.usuario_count, L.teal],
                    ["Leads",    emp.lead_count,    L.copper],
                    ["Deals",    emp.deal_count,    L.blue],
                    ["Chats",    emp.conv_count,    L.green],
                  ].map(([k,v,c]) => (
                    <div key={k} style={{ textAlign:"center", padding:"7px 4px", background:L.surface, borderRadius:8, border:`1px solid ${L.line}` }}>
                      <div style={{ fontSize:15, fontWeight:700, color:c, fontFamily:"'Outfit',sans-serif" }}>{v}</div>
                      <div style={{ fontSize:9, color:L.t4, textTransform:"uppercase", letterSpacing:"1px", fontFamily:"'JetBrains Mono',monospace" }}>{k}</div>
                    </div>
                  ))}
                </Grid>

                {/* Saúde bar */}
                <div style={{ marginBottom:14 }}>
                  <Row between style={{ marginBottom:4 }}>
                    <span style={{ fontSize:10, color:L.t4 }}>Saúde do cliente</span>
                    <span style={{ fontSize:10, fontWeight:700, color:sc, fontFamily:"'JetBrains Mono',monospace" }}>{saude}%</span>
                  </Row>
                  <div style={{ height:5, borderRadius:3, background:L.surface, overflow:"hidden" }}>
                    <div style={{ width:`${saude}%`, height:"100%", background:sc, borderRadius:3, transition:"width .4s" }} />
                  </div>
                </div>

                <Row gap={8}>
                  <Tag color={emp.assinatura_ativa?L.green:L.yellow} bg={emp.assinatura_ativa?L.greenBg:L.yellowBg}>
                    {emp.assinatura_ativa?"Ativo":emp.status||"trial"}
                  </Tag>
                  <button onClick={() => setSel(emp)}
                    style={{ flex:1, padding:"8px", borderRadius:9, fontSize:12, fontWeight:600,
                      cursor:"pointer", fontFamily:"inherit",
                      background: saude<50 ? L.red : L.tealBg,
                      color: saude<50 ? "white" : L.teal,
                      border: `1.5px solid ${saude<50 ? L.red+"44" : L.tealA}`,
                      transition:"all .12s" }}
                    onMouseEnter={e=>{e.currentTarget.style.background=L.accent;e.currentTarget.style.color="white";e.currentTarget.style.borderColor=L.accent;}}
                    onMouseLeave={e=>{e.currentTarget.style.background=saude<50?L.red:L.tealBg;e.currentTarget.style.color=saude<50?"white":L.teal;e.currentTarget.style.borderColor=saude<50?L.red+"44":L.tealA;}}>
                    {saude<50?"⚠ Ver urgente":"Acessar →"}
                  </button>
                </Row>
              </div>
            );
          })}
        </Grid>
      )}
    </Fade>
  );
}
