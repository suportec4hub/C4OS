import { useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { L } from "../constants/theme";
import { Fade, Card, Grid, Tag, Row, TT } from "../components/ui";
import { revData, leadsInit, kanbanInit, depsInit, equipeInit } from "../constants/mockData";

// ─── Funções de export ────────────────────────────────────────────────────────

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function toCSV(headers, rows) {
  const escape = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
}

function toExcel(headers, rows) {
  // BOM para Excel reconhecer UTF-8
  return "\uFEFF" + toCSV(headers, rows);
}

function printHTML(title, tableHTML) {
  const w = window.open("", "_blank");
  w.document.write(`
    <!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
        h1   { font-size: 20px; margin-bottom: 6px; }
        p    { font-size: 12px; color: #888; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th   { background: #111827; color: #fff; padding: 10px 12px; text-align: left; }
        td   { padding: 9px 12px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) td { background: #f9fafb; }
        @media print { @page { margin: 1cm; } }
      </style>
    </head><body>
      <h1>${title}</h1>
      <p>Gerado em ${new Date().toLocaleString("pt-BR")} · C4 OS by C4HUB</p>
      ${tableHTML}
      <script>window.onload=()=>{ window.print(); }<\/script>
    </body></html>
  `);
  w.document.close();
}

// ─── Dados de cada relatório ──────────────────────────────────────────────────

const RELATORIOS = {
  vendas: {
    title: "Relatório de Vendas",
    headers: ["Mês", "Receita", "Meta", "Leads"],
    rows: () => revData.map(r => [r.m, `R$ ${r.r.toLocaleString("pt-BR")}`, `R$ ${r.meta.toLocaleString("pt-BR")}`, r.leads]),
    chart: revData,
    chartKey: "r",
    chartLabel: "Receita (R$)",
  },
  performance: {
    title: "Performance de Vendedores",
    headers: ["Vendedor", "Cargo", "Leads", "Fechados", "Conversão", "Status"],
    rows: () => equipeInit.map(e => [e.nome, e.cargo, e.leads, e.fechados, e.conv, e.status]),
    chart: equipeInit.map(e => ({ name: e.nome.split(" ")[0], leads: e.leads, fechados: e.fechados })),
    chartKey: "leads",
    chartLabel: "Leads",
  },
  funil: {
    title: "Análise de Funil",
    headers: ["Etapa", "Negócios", "Volume Total"],
    rows: () => kanbanInit.map(k => [
      k.label,
      k.cards.length,
      "R$ " + k.cards.reduce((s,c) => s + parseFloat(c.valor.replace(/[^\d]/g,"")), 0).toLocaleString("pt-BR"),
    ]),
    chart: kanbanInit.map(k => ({
      name: k.label,
      total: k.cards.length,
      cor: k.cor,
    })),
    chartKey: "total",
    chartLabel: "Negócios",
  },
  roi: {
    title: "ROI de Campanhas WhatsApp",
    headers: ["Canal", "Leads", "Taxa Conversão", "Receita Estimada"],
    rows: () => [
      ["WhatsApp", "134", "24,5%", "R$ 312.000"],
      ["Email",    "61",  "8,2%",  "R$ 98.500"],
      ["Indicação","28",  "31,0%", "R$ 187.000"],
      ["Site",     "23",  "6,7%",  "R$ 42.000"],
    ],
    chart: [
      { name:"WhatsApp",v:24.5 },{ name:"Email",v:8.2 },
      { name:"Indicação",v:31.0 },{ name:"Site",v:6.7 },
    ],
    chartKey: "v",
    chartLabel: "Conversão %",
  },
  risco: {
    title: "Clientes em Risco",
    headers: ["Lead", "Empresa", "Última Interação", "Score", "Status"],
    rows: () => leadsInit.filter(l=>l.score<80).map(l => [l.nome, l.empresa, l.ultima, l.score, l.status]),
    chart: leadsInit.filter(l=>l.score<80).map(l => ({ name: l.nome.split(" ")[0], score: l.score })),
    chartKey: "score",
    chartLabel: "Score",
  },
  previsao: {
    title: "Previsão de Receita — 90 dias",
    headers: ["Período", "Previsão", "Pipeline", "Confiança"],
    rows: () => [
      ["Jul/2026", "R$ 95.000",  "R$ 312.000", "Alto (87%)"],
      ["Ago/2026", "R$ 108.000", "R$ 287.000", "Médio (73%)"],
      ["Set/2026", "R$ 124.000", "R$ 341.000", "Médio (68%)"],
    ],
    chart: [
      { m:"Jul",v:95000 },{ m:"Ago",v:108000 },{ m:"Set",v:124000 },
    ],
    chartKey: "v",
    chartLabel: "Previsão (R$)",
  },
};

// ─── Card de relatório ────────────────────────────────────────────────────────

function ReportCard({ rep, color, bg, icon, tag, onClick }) {
  const [loading, setLoading] = useState(false);
  const handle = () => {
    setLoading(true);
    setTimeout(() => { onClick(); setLoading(false); }, 400);
  };
  return (
    <div style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:18,boxShadow:"0 1px 3px rgba(0,0,0,0.04)",transition:"all .15s",cursor:"pointer"}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=color+"55";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,0.08)";}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)";}}
    >
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{width:38,height:38,borderRadius:10,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color}}>{icon}</div>
        <Tag color={color} bg={bg} small>{tag}</Tag>
      </div>
      <div style={{fontSize:13,fontWeight:600,color:L.t1,marginBottom:3}}>{rep.title}</div>
      <div style={{fontSize:11,color:L.t4,marginBottom:14}}>{rep.rows().length} registros disponíveis</div>
      <button onClick={handle}
        style={{width:"100%",padding:"7px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:bg,color,border:`1px solid ${color}22`,transition:"all .12s"}}
        onMouseEnter={e=>e.currentTarget.style.filter="brightness(.96)"}
        onMouseLeave={e=>e.currentTarget.style.filter="none"}
      >
        {loading ? "Gerando..." : "Gerar Relatório →"}
      </button>
    </div>
  );
}

// ─── Modal de relatório ───────────────────────────────────────────────────────

function ReportModal({ rep, color, onClose }) {
  if (!rep) return null;
  const rows = rep.rows();

  const exportPDF = () => {
    const thead = `<tr>${rep.headers.map(h=>`<th>${h}</th>`).join("")}</tr>`;
    const tbody = rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("");
    printHTML(rep.title, `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`);
  };

  const exportExcel = () => {
    downloadFile(toExcel(rep.headers, rows), `${rep.title.replace(/\s+/g,"-")}.csv`, "text/csv;charset=utf-8");
  };

  const exportCSV = () => {
    downloadFile(toCSV(rep.headers, rows), `${rep.title.replace(/\s+/g,"-")}.csv`, "text/csv;charset=utf-8");
  };

  const exportJSON = () => {
    const obj = rows.map(r => Object.fromEntries(rep.headers.map((h,i) => [h, r[i]])));
    downloadFile(JSON.stringify({ relatorio: rep.title, geradoEm: new Date().toISOString(), total: rows.length, dados: obj }, null, 2),
      `${rep.title.replace(/\s+/g,"-")}.json`, "application/json");
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:L.white,borderRadius:16,width:"min(860px,100%)",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.18)"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${L.line}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:L.t1}}>{rep.title}</div>
            <div style={{fontSize:11,color:L.t4,marginTop:2}}>Gerado em {new Date().toLocaleString("pt-BR")}</div>
          </div>
          <Row gap={8}>
            <button onClick={exportPDF}   style={{padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.redBg,   color:L.red,  border:`1px solid ${L.red}22`}}>↓ PDF</button>
            <button onClick={exportExcel} style={{padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.greenBg, color:L.green,border:`1px solid ${L.green}22`}}>↓ Excel</button>
            <button onClick={exportCSV}   style={{padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.yellowBg,color:L.yellow,border:`1px solid ${L.yellow}22`}}>↓ CSV</button>
            <button onClick={exportJSON}  style={{padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.tealBg,  color:L.teal, border:`1px solid ${L.teal}22`}}>↓ JSON</button>
            <button onClick={onClose} style={{padding:"6px 10px",borderRadius:8,fontSize:14,cursor:"pointer",background:"none",border:`1px solid ${L.line}`,color:L.t3,lineHeight:1}}>✕</button>
          </Row>
        </div>

        <div style={{overflowY:"auto",flex:1,padding:24}}>
          {/* Mini chart */}
          {rep.chart && (
            <div style={{marginBottom:20,background:L.surface,borderRadius:12,padding:16,border:`1px solid ${L.line}`}}>
              <div style={{fontSize:11,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:12,fontFamily:"'JetBrains Mono',monospace"}}>{rep.chartLabel}</div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={rep.chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke={L.lineSoft} vertical={false}/>
                  <XAxis dataKey={rep.chart[0] && Object.keys(rep.chart[0]).find(k=>k==="m"||k==="name")} tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={TT}/>
                  <Bar dataKey={rep.chartKey} fill={color} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabela */}
          <div style={{border:`1px solid ${L.line}`,borderRadius:10,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:L.teal}}>
                  {rep.headers.map(h => (
                    <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:"#fff",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.5px",textTransform:"uppercase"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row,i) => (
                  <tr key={i} style={{background:i%2===0?L.white:L.surface}}>
                    {row.map((cell,j) => (
                      <td key={j} style={{padding:"9px 14px",fontSize:12,color:L.t2,borderBottom:`1px solid ${L.lineSoft}`}}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{marginTop:10,fontSize:11,color:L.t4,textAlign:"right"}}>{rows.length} registros</div>
        </div>
      </div>
    </div>
  );
}

// ─── Export geral ─────────────────────────────────────────────────────────────

function exportAll(format) {
  const all = Object.values(RELATORIOS);
  if (format === "json") {
    const obj = Object.fromEntries(all.map(r => [r.title, r.rows().map(row => Object.fromEntries(r.headers.map((h,i)=>[h,row[i]])))]));
    downloadFile(JSON.stringify({ geradoEm: new Date().toISOString(), ...obj }, null, 2), "C4OS-relatorios.json", "application/json");
    return;
  }
  if (format === "csv") {
    let txt = "";
    all.forEach(r => {
      txt += `\n=== ${r.title} ===\n` + toCSV(r.headers, r.rows()) + "\n";
    });
    downloadFile(txt, "C4OS-relatorios.csv", "text/csv;charset=utf-8");
    return;
  }
  if (format === "excel") {
    let txt = "\uFEFF";
    all.forEach(r => {
      txt += `\n${r.title}\n` + toExcel(r.headers, r.rows()) + "\n\n";
    });
    downloadFile(txt, "C4OS-relatorios.csv", "text/csv;charset=utf-8");
    return;
  }
  if (format === "pdf") {
    let tablesHTML = "";
    all.forEach(r => {
      const thead = `<tr>${r.headers.map(h=>`<th>${h}</th>`).join("")}</tr>`;
      const tbody = r.rows().map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("");
      tablesHTML += `<h2 style="margin-top:32px;font-size:15px">${r.title}</h2><table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
    });
    printHTML("Relatório Completo — C4 OS", tablesHTML);
  }
}

const ct = [{d:"Seg",tx:14},{d:"Ter",tx:18},{d:"Qua",tx:22},{d:"Qui",tx:16},{d:"Sex",tx:25},{d:"Sáb",tx:12},{d:"Dom",tx:8}];

const REP_LIST = [
  { key:"vendas",      icon:"◫", color:L.teal,        bg:L.tealBg,    tag:"Mensal"     },
  { key:"performance", icon:"◉", color:L.copper,      bg:L.copperBg,  tag:"Semanal"    },
  { key:"funil",       icon:"⬡", color:L.green,       bg:L.greenBg,   tag:"Tempo real" },
  { key:"roi",         icon:"◈", color:L.yellow,      bg:L.yellowBg,  tag:"Campanha"   },
  { key:"risco",       icon:"⊗", color:L.red,         bg:L.redBg,     tag:"Alerta"     },
  { key:"previsao",    icon:"✦", color:"#7c3aed",     bg:"#f5f3ff",   tag:"IA"         },
];

export default function PageReports() {
  const [active, setActive] = useState(null);

  const activeRep   = active ? RELATORIOS[active.key] : null;
  const activeColor = active?.color;

  return (
    <Fade>
      <Grid cols={3} gap={14} mb={18}>
        {REP_LIST.map((r) => (
          <ReportCard key={r.key} rep={RELATORIOS[r.key]} color={r.color} bg={r.bg} icon={r.icon} tag={r.tag}
            onClick={() => setActive(r)}/>
        ))}
      </Grid>

      <Grid cols="2fr 1fr" gap={14}>
        <Card title="Conversão Semanal" sub="% por dia">
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={ct}>
              <CartesianGrid strokeDasharray="4 4" stroke={L.lineSoft} vertical={false}/>
              <XAxis dataKey="d" tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
              <Tooltip contentStyle={TT} formatter={v=>[`${v}%`]}/>
              <Line type="monotone" dataKey="tx" stroke={L.teal} strokeWidth={2} dot={{fill:L.teal,r:3}} activeDot={{r:5}}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Exportar Tudo">
          <div style={{fontSize:11,color:L.t4,marginBottom:12}}>Exporta todos os relatórios de uma vez</div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {[
              ["PDF — Relatório completo",     "pdf",   "◫", L.red,    L.redBg],
              ["Excel — Planilha completa",    "excel", "⊞", L.green,  L.greenBg],
              ["CSV — Dados brutos",           "csv",   "≡", L.yellow, L.yellowBg],
              ["JSON — API / Integração",      "json",  "{}", L.teal,  L.tealBg],
            ].map(([label, fmt, ic, c, bg]) => (
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

      {active && (
        <ReportModal rep={activeRep} color={activeColor} onClose={()=>setActive(null)}/>
      )}
    </Fade>
  );
}
