import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { L } from "../constants/theme";
import { Fade, Card, Grid, Tag, TT } from "../components/ui";

const reps = [
  {t:"Relatório de Vendas",  s:"Resumo mensal completo",  i:"◫",c:L.teal,  bg:L.tealBg,  tag:"Mensal"},
  {t:"Performance Vendedor", s:"Ranking individual",       i:"◉",c:L.copper,bg:L.copperBg,tag:"Semanal"},
  {t:"Análise de Funil",     s:"Conversão por etapa",      i:"⬡",c:L.green, bg:L.greenBg, tag:"Tempo real"},
  {t:"ROI de Campanhas",     s:"Resultados WhatsApp",      i:"◈",c:L.yellow,bg:L.yellowBg,tag:"Campanha"},
  {t:"Clientes em Risco",    s:"Sem interação +7 dias",    i:"⊗",c:L.red,   bg:L.redBg,   tag:"Alerta"},
  {t:"Previsão de Receita",  s:"IA preditiva 90 dias",     i:"✦",c:"#7c3aed",bg:"#f5f3ff", tag:"IA"},
];

const ct = [{d:"Seg",tx:14},{d:"Ter",tx:18},{d:"Qua",tx:22},{d:"Qui",tx:16},{d:"Sex",tx:25},{d:"Sáb",tx:12},{d:"Dom",tx:8}];

export default function PageReports() {
  return (
    <Fade>
      <Grid cols={3} gap={14} mb={18}>
        {reps.map((r,i) => (
          <div key={i}
            style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:18,cursor:"pointer",transition:"all .15s",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=r.c+"55";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,0.08)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)";}}
          >
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{width:38,height:38,borderRadius:10,background:r.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:r.c}}>{r.i}</div>
              <Tag color={r.c} bg={r.bg} small>{r.tag}</Tag>
            </div>
            <div style={{fontSize:13,fontWeight:600,color:L.t1,marginBottom:3}}>{r.t}</div>
            <div style={{fontSize:11,color:L.t4,marginBottom:14}}>{r.s}</div>
            <button
              style={{width:"100%",padding:"7px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:r.bg,color:r.c,border:`1px solid ${r.c}22`,transition:"all .12s"}}
              onMouseEnter={e=>e.currentTarget.style.filter="brightness(.96)"}
              onMouseLeave={e=>e.currentTarget.style.filter="none"}
            >
              Gerar Relatório →
            </button>
          </div>
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
        <Card title="Exportar Dados">
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {[["PDF","◫",L.red,L.redBg],["Excel","⊞",L.green,L.greenBg],["CSV","≡",L.yellow,L.yellowBg],["API JSON","{ }",L.teal,L.tealBg]].map(([f,ic,c,bg]) => (
              <button key={f}
                style={{padding:"10px 14px",borderRadius:9,cursor:"pointer",fontFamily:"inherit",background:L.surface,color:L.t2,border:`1px solid ${L.line}`,display:"flex",alignItems:"center",gap:10,fontSize:12.5,transition:"all .12s"}}
                onMouseEnter={e=>{e.currentTarget.style.background=bg;e.currentTarget.style.color=c;e.currentTarget.style.borderColor=c+"33";}}
                onMouseLeave={e=>{e.currentTarget.style.background=L.surface;e.currentTarget.style.color=L.t2;e.currentTarget.style.borderColor=L.line;}}
              >
                <span style={{fontSize:14}}>{ic}</span> Exportar {f}
              </button>
            ))}
          </div>
        </Card>
      </Grid>
    </Fade>
  );
}
