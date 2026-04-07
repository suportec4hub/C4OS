import { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";
import { L } from "../constants/theme";
import { Fade, Card, Grid, TT } from "../components/ui";
import { supabase } from "../lib/supabase";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const ETAPAS_FUNIL = ["Novo","Qualificado","Proposta","Negociação","Fechado"];
const STATUS_MAP = { novo:"Novo", qualificado:"Qualificado", proposta:"Proposta", negociacao:"Negociação", negociação:"Negociação", fechado:"Fechado", ganho:"Fechado", perdido:"Perdido" };
const CORES_ORIGEM = { whatsapp:L.teal, email:L.copper, indicação:L.green, indicacao:L.green, site:L.blue, outro:L.t4 };

function fmt(v) {
  if (v >= 1_000_000) return `R$ ${(v/1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v/1_000).toFixed(0)}k`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}
function pct(a, b) { return b === 0 ? 0 : Math.round((a / b) * 1000) / 10; }

function getLast6Months() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MESES[d.getMonth()] };
  });
}

function EmptyChart({ height = 170 }) {
  return (
    <div style={{ height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
      <div style={{ fontSize: 22, opacity: .25 }}>📊</div>
      <div style={{ fontSize: 11, color: L.t4 }}>Sem dados ainda</div>
    </div>
  );
}

export default function PageDashboard({ user }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.empresa_id) return;
    load(user.empresa_id);
  }, [user?.empresa_id]);

  async function load(empresa_id) {
    setLoading(true);
    const [{ data: empresa }, { data: leads }, { data: deals }, { data: usuarios }] = await Promise.all([
      supabase.from("empresas").select("mrr, nome").eq("id", empresa_id).single(),
      supabase.from("leads").select("id, status, origem, valor_estimado, created_at").eq("empresa_id", empresa_id),
      supabase.from("deals").select("id, valor, etapa, created_at").eq("empresa_id", empresa_id),
      supabase.from("usuarios").select("nome, cargo, leads, fechados, conv").eq("empresa_id", empresa_id).eq("ativo", true),
    ]);

    const leadsArr  = leads  || [];
    const dealsArr  = deals  || [];
    const usersArr  = usuarios || [];
    const months    = getLast6Months();

    // ── KPIs ──
    const mrr = empresa?.mrr || 0;
    const now30 = new Date(); now30.setDate(now30.getDate() - 30);
    const novosLeads = leadsArr.filter(l => new Date(l.created_at) >= now30).length;
    const totalLeads = leadsArr.length;
    const totalFechados = leadsArr.filter(l => ["fechado","ganho"].includes((l.status||"").toLowerCase())).length;
    const txConversao = pct(totalFechados, totalLeads);

    const dealsAbertos = dealsArr.filter(d => !["perdido","fechado"].includes((d.etapa||"").toLowerCase()));
    const dealsFechados = dealsArr.filter(d => ["fechado","ganho"].includes((d.etapa||"").toLowerCase()));
    const pipeline = dealsAbertos.reduce((s, d) => s + (d.valor || 0), 0);
    const ticketMedio = dealsFechados.length ? dealsFechados.reduce((s, d) => s + (d.valor || 0), 0) / dealsFechados.length : 0;

    // ── Receita por mês (deals fechados) ──
    const receitaMap = {};
    months.forEach(m => { receitaMap[m.key] = 0; });
    dealsFechados.forEach(d => {
      const key = d.created_at?.slice(0, 7);
      if (receitaMap[key] !== undefined) receitaMap[key] += (d.valor || 0);
    });
    const receitaData = months.map(m => ({ m: m.label, r: receitaMap[m.key] || 0, meta: mrr || 0 }));

    // ── Leads por mês ──
    const leadsMap = {};
    months.forEach(m => { leadsMap[m.key] = 0; });
    leadsArr.forEach(l => {
      const key = l.created_at?.slice(0, 7);
      if (leadsMap[key] !== undefined) leadsMap[key]++;
    });
    const leadsData = months.map(m => ({ m: m.label, leads: leadsMap[m.key] || 0 }));

    // ── Canais de origem ──
    const origemCount = {};
    leadsArr.forEach(l => {
      const o = (l.origem || "Outro").trim();
      origemCount[o] = (origemCount[o] || 0) + 1;
    });
    const canaisData = Object.entries(origemCount).map(([name, value]) => ({
      name,
      value,
      c: CORES_ORIGEM[(name||"").toLowerCase()] || L.t4,
    })).sort((a, b) => b.value - a.value);
    const canaisTotal = canaisData.reduce((s, c) => s + c.value, 0);
    const canaisComPct = canaisData.map(c => ({ ...c, pct: pct(c.value, canaisTotal) }));

    // ── Funil por status ──
    const statusCount = {};
    leadsArr.forEach(l => {
      const s = STATUS_MAP[(l.status || "novo").toLowerCase()] || "Outro";
      statusCount[s] = (statusCount[s] || 0) + 1;
    });
    const funilData = ETAPAS_FUNIL.map(s => ({ s, v: statusCount[s] || 0 }));

    // ── Performance equipe (radar) ──
    const radarDims = ["Prospecção","Qualificação","Fechamento","Follow-up"];
    let radarData;
    if (usersArr.some(u => u.leads || u.fechados)) {
      const totLeads = usersArr.reduce((s, u) => s + (u.leads || 0), 0) || 1;
      const totFech  = usersArr.reduce((s, u) => s + (u.fechados || 0), 0) || 1;
      radarData = [
        { s: "Prospecção",  A: Math.min(100, Math.round((totLeads / Math.max(totLeads, 1)) * 100)) },
        { s: "Qualificação",A: Math.min(100, Math.round(pct(usersArr.filter(u => (u.leads||0) > 0).length, usersArr.length))) },
        { s: "Fechamento",  A: Math.min(100, Math.round(pct(totFech, totLeads) * 5)) },
        { s: "Follow-up",   A: Math.min(100, usersArr.length * 25) },
      ];
    } else {
      radarData = radarDims.map(s => ({ s, A: 0 }));
    }

    setDados({ mrr, novosLeads, txConversao, ticketMedio, pipeline, totalLeads, totalFechados, receitaData, leadsData, canaisComPct, funilData, radarData, usersArr });
    setLoading(false);
  }

  const hasReceitaData = dados?.receitaData?.some(d => d.r > 0);
  const hasLeadsData   = dados?.leadsData?.some(d => d.leads > 0);
  const hasCanaisData  = dados?.canaisComPct?.length > 0;
  const hasFunilData   = dados?.funilData?.some(d => d.v > 0);

  const kpis = dados ? [
    { l: "MRR",           v: dados.mrr ? fmt(dados.mrr) : "—",                 d: dados.mrr ? "Receita recorrente" : "Configure em Empresa",   up: dados.mrr > 0, s: "mês atual",         c: L.teal,   bg: L.tealBg },
    { l: "Novos Leads",   v: String(dados.novosLeads),                           d: `${dados.totalLeads} total`,                                  up: dados.novosLeads > 0, s: "últimos 30 dias",  c: L.copper, bg: L.copperBg },
    { l: "Tx. Conversão", v: dados.txConversao ? `${dados.txConversao}%` : "—", d: `${dados.totalFechados} fechados`,                            up: dados.txConversao > 0, s: `de ${dados.totalLeads} leads`, c: L.teal, bg: L.tealBg },
    { l: "Ticket Médio",  v: dados.ticketMedio ? fmt(dados.ticketMedio) : "—",  d: "média deals fechados",                                       up: dados.ticketMedio > 0, s: "em deals",         c: L.copper, bg: L.copperBg },
    { l: "Pipeline",      v: dados.pipeline ? fmt(dados.pipeline) : "—",        d: "oportunidades abertas",                                      up: dados.pipeline > 0,    s: "total em aberto",  c: L.teal,   bg: L.tealBg },
    { l: "Equipe Ativa",  v: String(dados.usersArr.length),                      d: `${dados.usersArr.filter(u=>(u.fechados||0)>0).length} com vendas`, up: true, s: "membros",       c: L.yellow, bg: L.yellowBg },
  ] : [];

  if (loading) return (
    <Fade>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Grid cols={3} gap={12} mb={16} responsive>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ height: 88, background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, animation: "pulse 1.5s ease infinite" }}/>
          ))}
        </Grid>
        <div style={{ height: 240, background: L.white, borderRadius: 12, border: `1px solid ${L.line}` }}/>
      </div>
    </Fade>
  );

  return (
    <Fade>
      {/* ── ESTADO VAZIO ── */}
      {dados.totalLeads === 0 && dados.mrr === 0 && (
        <div style={{ background: `linear-gradient(135deg,${L.tealBg},${L.copperBg})`, border: `1px solid ${L.teal}22`, borderRadius: 12, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 20 }}>📋</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: L.t1 }}>Dashboard pronto — aguardando seus dados</div>
            <div style={{ fontSize: 11, color: L.t3, marginTop: 2 }}>Cadastre leads, crie deals no funil e configure o MRR em <b>Minha Empresa</b> para ver os indicadores reais.</div>
          </div>
        </div>
      )}

      {/* ── KPIs ── */}
      <Grid cols={3} gap={12} mb={16} responsive>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: "16px 18px", position: "relative", overflow: "hidden", animation: `up .35s ease ${i*.05}s both`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 10, color: L.t3, textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: "'JetBrains Mono',monospace", marginBottom: 8, fontWeight: 600 }}>{k.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Outfit',sans-serif", color: L.t1, marginBottom: 8, letterSpacing: "-.5px" }}>{k.v}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: k.up ? L.green : L.t4, background: k.up ? L.greenBg : L.line, padding: "2px 8px", borderRadius: 5 }}>{k.d}</span>
              <span style={{ fontSize: 10, color: L.t4 }}>{k.s}</span>
            </div>
            <div style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: 9, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: k.c, opacity: .7 }}/>
            </div>
          </div>
        ))}
      </Grid>

      {/* ── RECEITA + CANAIS ── */}
      <Grid cols="2fr 1fr" gap={12} mb={12} responsive>
        <Card title="Receita vs Meta" sub="últimos 6 meses">
          {hasReceitaData ? (
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={dados.receitaData}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={L.teal} stopOpacity={.12}/><stop offset="95%" stopColor={L.teal} stopOpacity={0}/></linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={L.copper} stopOpacity={.1}/><stop offset="95%" stopColor={L.copper} stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={L.lineSoft} vertical={false}/>
                <XAxis dataKey="m" tick={{ fill: L.t4, fontSize: 10 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill: L.t4, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
                <Tooltip contentStyle={TT} formatter={v => [`R$ ${v.toLocaleString("pt-BR")}`]}/>
                <Area type="monotone" dataKey="r"    stroke={L.teal}   strokeWidth={2}   fill="url(#g1)" name="Receita"/>
                <Area type="monotone" dataKey="meta" stroke={L.copper} strokeWidth={1.5} fill="url(#g2)" strokeDasharray="5 4" name="Meta (MRR)"/>
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart height={190}/>}
        </Card>

        <Card title="Canais de Origem" sub="distribuição de leads">
          {hasCanaisData ? (
            <>
              <ResponsiveContainer width="100%" height={148}>
                <PieChart>
                  <Pie data={dados.canaisComPct} cx="50%" cy="50%" innerRadius={44} outerRadius={66} dataKey="value" paddingAngle={3}>
                    {dados.canaisComPct.map((c, i) => <Cell key={i} fill={c.c}/>)}
                  </Pie>
                  <Tooltip contentStyle={TT} formatter={(v, n) => [`${v} leads`, n]}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
                {dados.canaisComPct.map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: L.t3 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: c.c }}/>
                    {c.name} <b style={{ color: L.t1 }}>{c.pct}%</b>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyChart height={180}/>}
        </Card>
      </Grid>

      {/* ── FUNIL + RADAR + LEADS ── */}
      <Grid cols={3} gap={12} responsive>
        <Card title="Funil de Conversão" sub="leads por etapa">
          {hasFunilData ? (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={dados.funilData} layout="vertical">
                <CartesianGrid strokeDasharray="4 4" stroke={L.lineSoft} horizontal={false}/>
                <XAxis type="number" tick={{ fill: L.t4, fontSize: 10 }} axisLine={false} tickLine={false}/>
                <YAxis dataKey="s" type="category" tick={{ fill: L.t3, fontSize: 10 }} axisLine={false} tickLine={false} width={68}/>
                <Tooltip contentStyle={TT} formatter={v => [v, "leads"]}/>
                <Bar dataKey="v" fill={L.teal} radius={[0, 5, 5, 0]} opacity={.85}/>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart/>}
        </Card>

        <Card title="Performance Equipe" sub="score por dimensão">
          {dados.usersArr.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={dados.radarData}>
                <PolarGrid stroke={L.line}/>
                <PolarAngleAxis dataKey="s" tick={{ fill: L.t4, fontSize: 9 }}/>
                <Radar dataKey="A" stroke={L.copper} fill={L.copper} fillOpacity={.12} strokeWidth={1.8}/>
                <Tooltip contentStyle={TT} formatter={v => [`${v}%`]}/>
              </RadarChart>
            </ResponsiveContainer>
          ) : <EmptyChart height={200}/>}
        </Card>

        <Card title="Leads por Mês" sub="volume captado">
          {hasLeadsData ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dados.leadsData}>
                <CartesianGrid strokeDasharray="4 4" stroke={L.lineSoft} vertical={false}/>
                <XAxis dataKey="m" tick={{ fill: L.t4, fontSize: 10 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill: L.t4, fontSize: 10 }} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={TT} formatter={v => [v, "leads"]}/>
                <Bar dataKey="leads" fill={L.copper} radius={[5, 5, 0, 0]} opacity={.85}/>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart height={200}/>}
        </Card>
      </Grid>
    </Fade>
  );
}
