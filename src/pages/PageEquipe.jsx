import { useState } from "react";
import { L } from "../constants/theme";
import { equipeInit } from "../constants/mockData";
import { Fade, Row, Grid, TabPills, PBtn, DataTable, Av, Tag, IBtn, TD } from "../components/ui";

export default function PageEquipe() {
  const [f,setF] = useState("Todos");
  const rc  = {Admin:L.teal, Vendedor:L.copper, Suporte:L.blue};
  const rbg = {Admin:L.tealBg, Vendedor:L.copperBg, Suporte:L.blueBg};
  const rows = f==="Todos" ? equipeInit : equipeInit.filter(m => m.role===f);

  return (
    <Fade>
      <Row between mb={14}>
        <TabPills tabs={["Todos","Admin","Vendedor","Suporte"]} active={f} onChange={setF}/>
        <PBtn>+ Convidar</PBtn>
      </Row>

      <Grid cols={3} gap={12} mb={14}>
        {[
          {l:"Ativos",v:equipeInit.filter(m=>m.status==="Ativo").length,c:L.teal},
          {l:"Leads Atribuídos",v:equipeInit.reduce((s,m)=>s+m.leads,0),c:L.copper},
          {l:"Deals Fechados",v:equipeInit.reduce((s,m)=>s+m.fechados,0),c:L.green},
        ].map((k,i) => (
          <div key={i} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"15px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:10,color:L.t4,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:6,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{k.l}</div>
            <div style={{fontSize:22,fontWeight:700,color:k.c,fontFamily:"'Outfit',sans-serif"}}>{k.v}</div>
          </div>
        ))}
      </Grid>

      <DataTable heads={["Membro","Cargo","WhatsApp","Perfil","Leads","Fechados","Conv.","Status","Ações"]}>
        {rows.map(m => (
          <tr key={m.id} style={{borderBottom:`1px solid ${L.lineSoft}`}}
            onMouseEnter={e=>e.currentTarget.style.background=L.surface}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
          >
            <td style={TD}>
              <Row gap={9}>
                <Av name={m.nome} color={rc[m.role]||L.t3}/>
                <div>
                  <div style={{fontSize:12.5,fontWeight:500,color:L.t1}}>{m.nome}</div>
                  <div style={{fontSize:10,color:L.t4}}>{m.email}</div>
                </div>
              </Row>
            </td>
            <td style={{...TD,color:L.t3,fontSize:11.5}}>{m.cargo}</td>
            <td style={{...TD,fontFamily:"'JetBrains Mono',monospace",color:L.teal,fontSize:11}}>{m.whatsapp}</td>
            <td style={TD}><Tag color={rc[m.role]||L.t3} bg={rbg[m.role]||L.surface}>{m.role}</Tag></td>
            <td style={{...TD,textAlign:"center",fontWeight:600,color:L.t1}}>{m.leads}</td>
            <td style={{...TD,textAlign:"center",fontWeight:600,color:L.green}}>{m.fechados}</td>
            <td style={{...TD,fontFamily:"'JetBrains Mono',monospace",color:L.copper,fontSize:11}}>{m.conv}</td>
            <td style={TD}><Tag color={m.status==="Ativo"?L.green:L.red} bg={m.status==="Ativo"?L.greenBg:L.redBg}>{m.status}</Tag></td>
            <td style={TD}><Row gap={5}><IBtn c={L.teal}>◷</IBtn><IBtn c={L.t3}>✎</IBtn><IBtn c={L.red}>⊗</IBtn></Row></td>
          </tr>
        ))}
      </DataTable>
    </Fade>
  );
}
