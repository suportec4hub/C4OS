import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { L } from "../constants/theme";
import { Fade, Card, Grid, Tag, Row, TT } from "../components/ui";
import { supabase } from "../lib/supabase";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function getLast6Months() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`, label: MESES[d.getMonth()] };
  });
}

// ─── Funções de export ─────────────────────────────────────────────────────────
function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function toCSV(headers, rows) {
  const escape = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
  return [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
}
function toExcel(headers, rows) { return "\uFEFF" + toCSV(headers, rows); }
function printHTML(title, tableHTML) {
  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
    <style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin-bottom:6px}p{font-size:12px;color:#888;margin-bottom:24px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#111827;color:#fff;padding:10px 12px;text-align:left}td{padding:9px 12px;border-bottom:1px solid #e5e7eb}tr:nth-child(even) td{background:#f9fafb}@media print{@page{margin:1cm}}</style>
    </head><body><h1>${title}</h1><p>Gerado em ${new Date().toLocaleString("pt-BR")} · C4 OS by C4HUB</p>${tableHTML}
    <script>window.onload=()=>{window.print();}<\/script></body></html>`);
  w.document.close();
}

// ─── Card de relatório ─────────────────────────────────────────────────────────
function ReportCard({ title, sub, icon, color, bg, tag, rowCount, onOpen, loading }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{background:L.white,borderRadius:12,border:`1px solid ${hover?color+"55":L.line}`,padding:18,boxShadow:hover?"0 6px 20px rgba(0,0,0,0.08)":"0 1px 3px rgba(0,0,0,0.04)",transition:"all .15s",cursor:"pointer",transform:hover?"translateY(-2px)":"none"}}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
    >
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{width:38,height:38,borderRadius:10,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color}}>{icon}</div>
        <Tag color={color} bg={bg} small>{tag}</Tag>
      </div>
      <div style={{fontSize:13,fontWeight:600,color:L.t1,marginBottom:3}}>{title}</div>
      <div style={{fontSize:11,color:L.t4,marginBottom:14}}>{loading?"Carregando...":`${rowCount} registros`}</div>
      <button onClick={onOpen}
        style={{width:"100%",padding:"7px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:bg,color,border:`1px solid ${color}22`,transition:"all .12s"}}
        onMouseEnter={e=>e.currentTarget.style.filter="brightness(.96)"}
        onMouseLeave={e=>e.currentTarget.style.filter="none"}
      >Gerar Relatório →</button>
    </div>
  );
}

// ─── Modal de relatório ────────────────────────────────────────────────────────
function ReportModal({ title, headers, rows, chart, chartKey, chartLabel, color, onClose }) {
  if (!rows) return null;

  const exportPDF = () => {
    const thead = `<tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr>`;
    const tbody = rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("");
    printHTML(title, `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`);
  };
  const exportExcel = () => downloadFile(toExcel(headers, rows), `${title.replace(/\s+/g,"-")}.csv`, "text/csv;charset=utf-8");
  const exportCSV   = () => downloadFile(toCSV(headers, rows),   `${title.replace(/\s+/g,"-")}.csv`, "text/csv;charset=utf-8");
  const exportJSON  = () => {
    const obj = rows.map(r => Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
    downloadFile(JSON.stringify({ relatorio:title, geradoEm:new Date().toISOString(), total:rows.length, dados:obj },null,2),`${title.replace(/\s+/g,"-")}.json`,"application/json");
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:L.white,borderRadius:16,width:"min(860px,100%)",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.18)"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${L.line}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:L.t1}}>{title}</div>
            <div style={{fontSize:11,color:L.t4,marginTop:2}}>Gerado em {new Date().toLocaleString("pt-BR")}</div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <button onClick={exportPDF}   style={{padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.redBg,   color:L.red,  border:`1px solid ${L.red}22`}}>↓ PDF</button>
            <button onClick={exportExcel} style={{padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.greenBg, color:L.green,border:`1px solid ${L.green}22`}}>↓ Excel</button>
            <button onClick={exportCSV}   style={{padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.yellowBg,color:L.yellow,border:`1px solid ${L.yellow}22`}}>↓ CSV</button>
            <button onClick={exportJSON}  style={{padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.tealBg,  color:L.teal, border:`1px solid ${L.teal}22`}}>↓ JSON</button>
            <button onClick={onClose} style={{padding:"6px 10px",borderRadius:8,fontSize:14,cursor:"pointer",background:"none",border:`1px solid ${L.line}`,color:L.t3,lineHeight:1}}>✕</button>
          </div>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:24}}>
          {chart?.length > 0 && (
            <div style={{marginBottom:20,background:L.surface,borderRadius:12,padding:16,border:`1px solid ${L.line}`}}>
              <div style={{fontSize:11,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:12,fontFamily:"'JetBrains Mono',monospace"}}>{chartLabel}</div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke={L.lineSoft} vertical={false}/>
                  <XAxis dataKey={Object.keys(chart[0]||{}).find(k=>k==="m"||k==="name")} tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={TT}/>
                  <Bar dataKey={chartKey} fill={color} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {rows.length === 0 ? (
            <div style={{textAlign:"center",padding:40,color:L.t4}}>
              <div style={{fontSize:24,marginBottom:8}}>◎</div>
              <div>Nenhum dado disponível ainda</div>
            </div>
          ) : (
            <div style={{border:`1px solid ${L.line}`,borderRadius:10,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:L.teal}}>
                    {headers.map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:"#fff",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.5px",textTransform:"uppercase"}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row,i)=>(
                    <tr key={i} style={{background:i%2===0?L.white:L.surface}}>
                      {row.map((cell,j)=><td key={j} style={{padding:"9px 14px",fontSize:12,color:L.t2,borderBottom:`1px solid ${L.lineSoft}`}}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{marginTop:10,fontSize:11,color:L.t4,textAlign:"right"}}>{rows.length} registros</div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers de formatação ─────────────────────────────────────────────────────
const fmtR = v => v >= 1000 ? `R$ ${(v/1000).toFixed(1)}k` : `R$ ${Number(v).toLocaleString("pt-BR")}`;
const fmtD = iso => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

export default function PageReports({ user }) {
  const [dados,   setDados]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [active,  setActive]  = useState(null);

  useEffect(() => {
    if (!user?.empresa_id) return;
    load(user.empresa_id);
  }, [user?.empresa_id]);

  async function load(empresa_id) {
    setLoading(true);
    const [{ data: leads }, { data: deals }, { data: usuarios }] = await Promise.all([
      supabase.from("leads").select("id,nome,empresa_nome,status,origem,score,valor_estimado,created_at,ultima_atividade").eq("empresa_id", empresa_id),
      supabase.from("deals").select("id,titulo,valor,etapa,created_at").eq("empresa_id", empresa_id),
      supabase.from("usuarios").select("id,nome,cargo,leads,fechados,conv,ativo").eq("empresa_id", empresa_id).eq("ativo", true),
    ]);
    setDados({ leads: leads||[], deals: deals||[], usuarios: usuarios||[] });
    setLoading(false);
  }

  // ─── Builders de relatório com dados reais ─────────────────────────────────
  const months = getLast6Months();

  function buildVendas() {
    if (!dados) return { rows:[], chart:[] };
    const dealsFechados = dados.deals.filter(d => ["fechado","ganho"].includes((d.etapa||"").toLowerCase()));
    const map = {}; months.forEach(m => { map[m.key] = 0; });
    dealsFechados.forEach(d => { const k = d.created_at?.slice(0,7); if (map[k]!==undefined) map[k] += (d.valor||0); });
    const chart = months.map(m => ({ m: m.label, r: map[m.key]||0 }));
    const rows  = months.map(m => [m.label, fmtR(map[m.key]||0), `${dados.deals.filter(d=>d.created_at?.startsWith(m.key)).length} deals`]);
    return { rows, chart, headers:["Mês","Receita","Deals"], chartKey:"r", chartLabel:"Receita por Mês" };
  }

  function buildPerformance() {
    if (!dados) return { rows:[], chart:[] };
    const rows  = dados.usuarios.map(u => [u.nome, u.cargo||"—", u.leads||0, u.fechados||0, u.conv||"—", "Ativo"]);
    const chart = dados.usuarios.map(u => ({ name: u.nome.split(" ")[0], leads: u.leads||0 }));
    return { rows, chart, headers:["Vendedor","Cargo","Leads","Fechados","Conversão","Status"], chartKey:"leads", chartLabel:"Leads por Vendedor" };
  }

  function buildFunil() {
    if (!dados) return { rows:[], chart:[] };
    const etapas = ["novo","qualificado","proposta","negociacao","fechado","perdido"];
    const count  = {}; etapas.forEach(e => { count[e] = 0; });
    dados.leads.forEach(l => { const s = (l.status||"novo").toLowerCase(); if (count[s]!==undefined) count[s]++; });
    const rows  = etapas.map(e => [e.charAt(0).toUpperCase()+e.slice(1), count[e], dados.leads.length > 0 ? `${Math.round(count[e]/dados.leads.length*100)}%` : "0%"]);
    const chart = etapas.map(e => ({ name: e.charAt(0).toUpperCase()+e.slice(1), total: count[e] }));
    return { rows, chart, headers:["Etapa","Leads","% do Total"], chartKey:"total", chartLabel:"Leads por Etapa" };
  }

  function buildCanais() {
    if (!dados) return { rows:[], chart:[] };
    const count = {};
    dados.leads.forEach(l => { const o = l.origem||"Outro"; count[o] = (count[o]||0)+1; });
    const total = dados.leads.length || 1;
    const entries = Object.entries(count).sort((a,b)=>b[1]-a[1]);
    const rows  = entries.map(([canal,n]) => [canal, n, `${Math.round(n/total*100)}%`]);
    const chart = entries.map(([canal,n]) => ({ name:canal, v:n }));
    return { rows, chart, headers:["Canal","Leads","% do Total"], chartKey:"v", chartLabel:"Leads por Canal" };
  }

  function buildRisco() {
    if (!dados) return { rows:[], chart:[] };
    const risco = dados.leads.filter(l => (l.score||50) < 60).sort((a,b)=>(a.score||50)-(b.score||50));
    const rows  = risco.map(l => [l.nome, l.empresa_nome||"—", fmtD(l.ultima_atividade), l.score||50, l.status||"—"]);
    const chart = risco.slice(0,10).map(l => ({ name: l.nome.split(" ")[0], score: l.score||50 }));
    return { rows, chart, headers:["Lead","Empresa","Última Atividade","Score","Status"], chartKey:"score", chartLabel:"Score de Risco" };
  }

  function buildPrevisao() {
    if (!dados) return { rows:[], chart:[] };
    const pipeline = dados.deals.filter(d => !["fechado","ganho","perdido"].includes((d.etapa||"").toLowerCase()));
    const totalPipeline = pipeline.reduce((s,d)=>s+(d.valor||0),0);
    const pct = [0.3, 0.35, 0.35];
    const futuroMeses = Array.from({length:3},(_,i)=>{
      const d = new Date(); d.setMonth(d.getMonth()+i+1);
      return MESES[d.getMonth()];
    });
    const rows  = futuroMeses.map((m,i)=>[m+"/"+new Date().getFullYear(), fmtR(totalPipeline*pct[i]), fmtR(totalPipeline), i===0?"Alto":"Médio"]);
    const chart = futuroMeses.map((m,i)=>({ m, v: Math.round(totalPipeline*pct[i]) }));
    return { rows, chart, headers:["Período","Previsão","Pipeline Total","Confiança"], chartKey:"v", chartLabel:"Previsão de Receita" };
  }

  const RELATORIOS = {
    vendas:      { title:"Relatório de Vendas",          ...buildVendas() },
    performance: { title:"Performance de Vendedores",    ...buildPerformance() },
    funil:       { title:"Análise de Funil",             ...buildFunil() },
    canais:      { title:"ROI de Canais de Origem",      ...buildCanais() },
    risco:       { title:"Leads em Risco",               ...buildRisco() },
    previsao:    { title:"Previsão de Receita — 90 dias",...buildPrevisao() },
  };

  const REP_LIST = [
    { key:"vendas",      icon:"◫", color:L.teal,    bg:L.tealBg,    tag:"Mensal"     },
    { key:"performance", icon:"◉", color:L.copper,  bg:L.copperBg,  tag:"Equipe"     },
    { key:"funil",       icon:"⬡", color:L.green,   bg:L.greenBg,   tag:"Tempo real" },
    { key:"canais",      icon:"◈", color:L.yellow,  bg:L.yellowBg,  tag:"Canais"     },
    { key:"risco",       icon:"⊗", color:L.red,     bg:L.redBg,     tag:"Alerta"     },
    { key:"previsao",    icon:"✦", color:"#7c3aed", bg:"#f5f3ff",   tag:"Previsão"   },
  ];

  const exportAll = (format) => {
    const all = Object.values(RELATORIOS);
    if (format === "json") {
      const obj = Object.fromEntries(all.map(r=>[r.title, r.rows.map(row=>Object.fromEntries(r.headers.map((h,i)=>[h,row[i]])))]));
      downloadFile(JSON.stringify({geradoEm:new Date().toISOString(),...obj},null,2),"C4OS-relatorios.json","application/json");
    } else if (format === "csv") {
      let txt = "";
      all.forEach(r=>{ txt += `\n=== ${r.title} ===\n`+toCSV(r.headers,r.rows)+"\n"; });
      downloadFile(txt,"C4OS-relatorios.csv","text/csv;charset=utf-8");
    } else if (format === "excel") {
      let txt = "\uFEFF";
      all.forEach(r=>{ txt += `\n${r.title}\n`+toExcel(r.headers,r.rows)+"\n\n"; });
      downloadFile(txt,"C4OS-relatorios.csv","text/csv;charset=utf-8");
    } else if (format === "pdf") {
      let html = "";
      all.forEach(r=>{ const thead=`<tr>${r.headers.map(h=>`<th>${h}</th>`).join("")}</tr>`; const tbody=r.rows.map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join("")}</tr>`).join(""); html+=`<h2 style="margin-top:32px;font-size:15px">${r.title}</h2><table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`; });
      printHTML("Relatório Completo — C4 OS", html);
    }
  };

  // Conversão semanal baseada em leads reais (por dia da semana)
  const convSemanal = (() => {
    const dias = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
    const count = [0,0,0,0,0,0,0];
    if (dados) dados.leads.forEach(l => { const d = new Date(l.created_at).getDay(); count[d]++; });
    return dias.map((d,i) => ({ d, tx: count[i] }));
  })();

  const activeRep = active ? RELATORIOS[active.key] : null;

  return (
    <Fade>
      <Grid cols={3} gap={14} mb={18} responsive>
        {REP_LIST.map((r) => (
          <ReportCard key={r.key}
            title={RELATORIOS[r.key].title} sub="" icon={r.icon} color={r.color} bg={r.bg} tag={r.tag}
            rowCount={RELATORIOS[r.key].rows.length} loading={loading}
            onOpen={() => setActive(r)}
          />
        ))}
      </Grid>

      <Grid cols="2fr 1fr" gap={14} responsive>
        <Card title="Leads por Dia da Semana" sub="distribuição real">
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={convSemanal}>
              <CartesianGrid strokeDasharray="4 4" stroke={L.lineSoft} vertical={false}/>
              <XAxis dataKey="d" tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={TT} formatter={v=>[v,"leads"]}/>
              <Line type="monotone" dataKey="tx" stroke={L.teal} strokeWidth={2} dot={{fill:L.teal,r:3}} activeDot={{r:5}}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Exportar Tudo">
          <div style={{fontSize:11,color:L.t4,marginBottom:12}}>Exporta todos os relatórios de uma vez</div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {[
              ["PDF — Relatório completo",  "pdf",   "◫", L.red,    L.redBg   ],
              ["Excel — Planilha completa", "excel", "⊞", L.green,  L.greenBg ],
              ["CSV — Dados brutos",        "csv",   "≡", L.yellow, L.yellowBg],
              ["JSON — API / Integração",   "json",  "{}", L.teal,  L.tealBg  ],
            ].map(([label,fmt,ic,c,bg]) => (
              <button key={fmt} onClick={()=>exportAll(fmt)}
                style={{padding:"10px 14px",borderRadius:9,cursor:"pointer",fontFamily:"inherit",background:L.surface,color:L.t2,border:`1px solid ${L.line}`,display:"flex",alignItems:"center",gap:10,fontSize:12.5,transition:"all .12s",textAlign:"left"}}
                onMouseEnter={e=>{e.currentTarget.style.background=bg;e.currentTarget.style.color=c;e.currentTarget.style.borderColor=c+"33";}}
                onMouseLeave={e=>{e.currentTarget.style.background=L.surface;e.currentTarget.style.color=L.t2;e.currentTarget.style.borderColor=L.line;}}
              >
                <span style={{fontSize:14,width:18,textAlign:"center"}}>{ic}</span> {label}
              </button>
            ))}
          </div>
        </Card>
      </Grid>

      {active && activeRep && (
        <ReportModal
          title={activeRep.title}
          headers={activeRep.headers}
          rows={activeRep.rows}
          chart={activeRep.chart}
          chartKey={activeRep.chartKey}
          chartLabel={activeRep.chartLabel}
          color={active.color}
          onClose={()=>setActive(null)}
        />
      )}
    </Fade>
  );
}
