import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";
import { L } from "../constants/theme";
import { revData } from "../constants/mockData";
import { Fade, Card, Grid, TT } from "../components/ui";

const ch = [{name:"WhatsApp",value:52,c:L.teal},{name:"Email",value:24,c:L.copper},{name:"Indicação",value:14,c:L.green},{name:"Site",value:10,c:L.blue}];
const cv = [{s:"Leads",v:289},{s:"Qualif.",v:187},{s:"Proposta",v:98},{s:"Negoc.",v:54},{s:"Fechado",v:31}];
const rd = [{s:"Prospecção",A:85},{s:"Qualificação",A:72},{s:"Fechamento",A:90},{s:"Pós-venda",A:65},{s:"Reativação",A:58},{s:"Follow-up",A:78}];

export default function PageDashboard() {
  const kpis = [
    {l:"MRR",          v:"R$ 89.400",d:"+18,4%",up:true, s:"vs mês anterior", c:L.teal,  bg:L.tealBg},
    {l:"Novos Leads",  v:"256",       d:"+23,1%",up:true, s:"últimos 30 dias", c:L.copper,bg:L.copperBg},
    {l:"Tx. Conversão",v:"18,4%",     d:"+2,3pp",up:true, s:"meta: 15%",       c:L.teal,  bg:L.tealBg},
    {l:"Ticket Médio", v:"R$ 14.200", d:"+6,7%", up:true, s:"deals fechados",  c:L.copper,bg:L.copperBg},
    {l:"Pipeline",     v:"R$ 312k",   d:"+31,2%",up:true, s:"total aberto",    c:L.teal,  bg:L.tealBg},
    {l:"NPS",          v:"74",        d:"-2pts",  up:false,s:"benchmark: 70",   c:L.yellow,bg:L.yellowBg},
  ];

  return (
    <Fade>
      <Grid cols={3} gap={12} mb={16}>
        {kpis.map((k,i) => (
          <div key={i} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"16px 18px",position:"relative",overflow:"hidden",animation:`up .35s ease ${i*.05}s both`,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:10,color:L.t3,textTransform:"uppercase",letterSpacing:"1.5px",fontFamily:"'JetBrains Mono',monospace",marginBottom:8,fontWeight:600}}>{k.l}</div>
            <div style={{fontSize:22,fontWeight:700,fontFamily:"'Outfit',sans-serif",color:L.t1,marginBottom:8,letterSpacing:"-.5px"}}>{k.v}</div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,fontWeight:600,color:k.up?L.green:L.red,background:k.up?L.greenBg:L.redBg,padding:"2px 8px",borderRadius:5}}>{k.d}</span>
              <span style={{fontSize:10,color:L.t4}}>{k.s}</span>
            </div>
            <div style={{position:"absolute",top:16,right:16,width:36,height:36,borderRadius:9,background:k.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:14,height:14,borderRadius:"50%",background:k.c,opacity:.7}}/>
            </div>
          </div>
        ))}
      </Grid>

      <Grid cols="2fr 1fr" gap={12} mb={12}>
        <Card title="Receita vs Meta" sub="últimos 7 meses">
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={revData}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={L.teal} stopOpacity={.12}/><stop offset="95%" stopColor={L.teal} stopOpacity={0}/></linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={L.copper} stopOpacity={.1}/><stop offset="95%" stopColor={L.copper} stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke={L.lineSoft} vertical={false}/>
              <XAxis dataKey="m" tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip contentStyle={TT} formatter={v=>[`R$ ${v.toLocaleString("pt-BR")}`]}/>
              <Area type="monotone" dataKey="r"    stroke={L.teal}   strokeWidth={2} fill="url(#g1)" name="Receita"/>
              <Area type="monotone" dataKey="meta" stroke={L.copper} strokeWidth={1.5} fill="url(#g2)" strokeDasharray="5 4" name="Meta"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Canais de Origem" sub="distribuição %">
          <ResponsiveContainer width="100%" height={148}>
            <PieChart>
              <Pie data={ch} cx="50%" cy="50%" innerRadius={44} outerRadius={66} dataKey="value" paddingAngle={3}>
                {ch.map((c,i) => <Cell key={i} fill={c.c}/>)}
              </Pie>
              <Tooltip contentStyle={TT} formatter={v=>[`${v}%`]}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginTop:8}}>
            {ch.map((c,i) => <div key={i} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:L.t3}}><div style={{width:7,height:7,borderRadius:2,background:c.c}}/>{c.name} <b style={{color:L.t1}}>{c.value}%</b></div>)}
          </div>
        </Card>
      </Grid>

      <Grid cols={3} gap={12}>
        <Card title="Funil de Conversão" sub="por etapa">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={cv} layout="vertical">
              <CartesianGrid strokeDasharray="4 4" stroke={L.lineSoft} horizontal={false}/>
              <XAxis type="number" tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis dataKey="s" type="category" tick={{fill:L.t3,fontSize:10}} axisLine={false} tickLine={false} width={52}/>
              <Tooltip contentStyle={TT}/>
              <Bar dataKey="v" fill={L.teal} radius={[0,5,5,0]} opacity={.85}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Performance Equipe" sub="score por área">
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={rd}>
              <PolarGrid stroke={L.line}/>
              <PolarAngleAxis dataKey="s" tick={{fill:L.t4,fontSize:9}}/>
              <Radar dataKey="A" stroke={L.copper} fill={L.copper} fillOpacity={.12} strokeWidth={1.8}/>
            </RadarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Leads por Mês" sub="volume captado">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revData}>
              <CartesianGrid strokeDasharray="4 4" stroke={L.lineSoft} vertical={false}/>
              <XAxis dataKey="m" tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={TT}/>
              <Bar dataKey="leads" fill={L.copper} radius={[5,5,0,0]} opacity={.85}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </Grid>
    </Fade>
  );
}
