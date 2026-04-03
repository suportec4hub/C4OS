import { useState } from "react";
import { L } from "../constants/theme";
import { logsInit } from "../constants/mockData";
import { Fade, Row, Grid, TabPills, Tag, IBtn } from "../components/ui";

export default function PageLogs() {
  const [f,setF] = useState("Todos");
  const nc  = {info:L.blue, warn:L.yellow, error:L.red};
  const nbg = {info:L.blueBg, warn:L.yellowBg, error:L.redBg};
  const tc  = {AUTH:L.copper, DATA:L.blue, BILLING:L.green, API:L.teal, SYSTEM:L.t3};
  const tcbg= {AUTH:L.copperBg, DATA:L.blueBg, BILLING:L.greenBg, API:L.tealBg, SYSTEM:L.surface};
  const rows = f==="Todos" ? logsInit : logsInit.filter(l => l.nivel===f.toLowerCase());

  return (
    <Fade>
      <Grid cols={4} gap={12} mb={14}>
        {[
          {l:"Total Hoje",v:"247",c:L.teal},
          {l:"Warnings",v:"12",c:L.yellow},
          {l:"Erros",v:"3",c:L.red},
          {l:"Status",v:"Online",c:L.green},
        ].map((k,i) => (
          <div key={i} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"15px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:10,color:L.t4,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:5,fontWeight:600}}>{k.l}</div>
            <div style={{fontSize:20,fontWeight:700,color:k.c,fontFamily:"'Outfit',sans-serif"}}>{k.v}</div>
          </div>
        ))}
      </Grid>

      <Row between mb={12}>
        <TabPills tabs={["Todos","Info","Warn","Error"]} active={f} onChange={setF}/>
        <IBtn c={L.teal}>Exportar</IBtn>
      </Row>

      <div style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
        {/* Terminal header */}
        <div style={{background:L.surface,padding:"9px 16px",borderBottom:`1px solid ${L.line}`,display:"flex",alignItems:"center",gap:8}}>
          <div style={{display:"flex",gap:5}}>
            {[L.red,L.yellow,L.green].map((c,i) => <div key={i} style={{width:10,height:10,borderRadius:"50%",background:c,opacity:.7}}/>)}
          </div>
          <span style={{fontSize:11,color:L.t4,fontFamily:"'JetBrains Mono',monospace",marginLeft:6}}>c4os::audit_log</span>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:L.green,animation:"blink 1.5s infinite"}}/>
            <span style={{fontSize:10,color:L.green,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>LIVE</span>
          </div>
        </div>

        {rows.map(log => (
          <div key={log.id}
            style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${L.lineSoft}`,background:log.nivel==="error"?L.redBg:log.nivel==="warn"?L.yellow+"08":"transparent",transition:"background .1s"}}
            onMouseEnter={e=>e.currentTarget.style.background=L.surface}
            onMouseLeave={e=>e.currentTarget.style.background=log.nivel==="error"?L.redBg:log.nivel==="warn"?L.yellow+"08":"transparent"}
          >
            <div style={{width:3,alignSelf:"stretch",background:nc[log.nivel],flexShrink:0}}/>
            <div style={{display:"flex",alignItems:"center",flex:1,padding:"9px 14px",flexWrap:"wrap",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>
              <span style={{color:L.t4,width:68,flexShrink:0}}>{log.hora}</span>
              <span style={{marginRight:10,flexShrink:0}}><Tag color={nc[log.nivel]} bg={nbg[log.nivel]} small>{log.nivel.toUpperCase()}</Tag></span>
              <span style={{marginRight:12,flexShrink:0}}><Tag color={tc[log.tipo]||L.t3} bg={tcbg[log.tipo]||L.surface} small>{log.tipo}</Tag></span>
              <span style={{color:L.t1,flex:1,marginRight:12,fontFamily:"'Instrument Sans',sans-serif",fontSize:12}}>{log.msg}</span>
              <span style={{color:L.t3,marginRight:10,fontSize:10.5}}>{log.user}</span>
              <span style={{color:L.copper,marginRight:8,fontSize:10.5,fontWeight:500}}>[{log.empresa}]</span>
              <span style={{color:L.t4,fontSize:10}}>{log.ip}</span>
            </div>
          </div>
        ))}
      </div>
    </Fade>
  );
}
