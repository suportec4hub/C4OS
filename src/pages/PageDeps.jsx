import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { L } from "../constants/theme";
import { depsInit } from "../constants/mockData";
import { Fade, Row, Card, Grid, PBtn, TT } from "../components/ui";

export default function PageDeps() {
  return (
    <Fade>
      <Row between mb={14}>
        <span style={{fontSize:12,color:L.t3}}>{depsInit.length} departamentos</span>
        <PBtn>+ Novo</PBtn>
      </Row>

      <Grid cols={2} gap={12} mb={14}>
        {depsInit.map((d,i) => (
          <div key={i}
            style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:20,cursor:"pointer",transition:"all .15s",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=d.cor+"55";e.currentTarget.style.transform="translateY(-1px)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.transform="none";}}
          >
            <Row between mb={14}>
              <Row gap={10}>
                <div style={{width:38,height:38,borderRadius:10,background:d.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <div style={{width:14,height:14,borderRadius:"50%",background:d.cor}}/>
                </div>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:L.t1}}>{d.nome}</div>
                  <div style={{fontSize:11,color:L.t4}}>{d.membros} membros</div>
                </div>
              </Row>
              <span style={{fontSize:13,fontWeight:700,color:d.cor,fontFamily:"'Outfit',sans-serif"}}>{d.pct}%</span>
            </Row>
            <Row between mb={8}>
              <span style={{fontSize:11,color:L.t4}}>Meta: <b style={{color:L.t2}}>{d.meta}</b></span>
              <span style={{fontSize:11,color:d.cor,fontWeight:500}}>{d.atual}</span>
            </Row>
            <div style={{height:6,background:L.surface,borderRadius:4,overflow:"hidden",border:`1px solid ${L.line}`}}>
              <div style={{width:`${d.pct}%`,height:"100%",background:d.cor,borderRadius:4,transition:"width .6s ease"}}/>
            </div>
          </div>
        ))}
      </Grid>

      <Card title="Performance Geral" sub="progresso por departamento">
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={depsInit.map(d=>({name:d.nome,pct:d.pct}))}>
            <CartesianGrid strokeDasharray="4 4" stroke={L.lineSoft} vertical={false}/>
            <XAxis dataKey="name" tick={{fill:L.t4,fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} domain={[0,100]}/>
            <Tooltip contentStyle={TT} formatter={v=>[`${v}%`]}/>
            <Bar dataKey="pct" radius={[6,6,0,0]}>
              {depsInit.map((d,i) => <Cell key={i} fill={d.cor}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </Fade>
  );
}
