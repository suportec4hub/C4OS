import { useState } from "react";
import { L } from "../constants/theme";
import { clientesInit } from "../constants/mockData";
import { Fade, Row, Grid, Card, Tag } from "../components/ui";

export default function PageSuporte() {
  const [sel,setSel] = useState(null);
  const pc = {Enterprise:{c:L.teal,bg:L.tealBg}, Growth:{c:L.copper,bg:L.copperBg}, Starter:{c:L.t3,bg:L.surface}};

  return (
    <Fade>
      <div style={{background:L.greenBg,border:`1.5px solid ${L.green}22`,borderRadius:11,padding:"12px 18px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:L.green,flexShrink:0}}/>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:L.green}}>Modo Suporte C4HUB — Sessão Auditada</div>
          <div style={{fontSize:11,color:L.t3}}>Todas as ações são registradas automaticamente nos logs do sistema.</div>
        </div>
        <div style={{marginLeft:"auto",fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:L.t4}}>
          SID: {Math.random().toString(36).slice(2,9).toUpperCase()}
        </div>
      </div>

      {!sel ? (
        <Grid cols={2} gap={12}>
          {clientesInit.map((c,i) => (
            <div key={i}
              style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:20,cursor:"pointer",transition:"all .15s",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=L.teal+"44";e.currentTarget.style.transform="translateY(-1px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.transform="none";}}
            >
              <Row between mb={14}>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:L.t1,marginBottom:5}}>{c.empresa}</div>
                  <Tag color={pc[c.plano]?.c||L.t3} bg={pc[c.plano]?.bg||L.surface}>{c.plano}</Tag>
                </div>
                <div style={{textAlign:"right"}}>
                  <Tag color={c.status==="Ativo"?L.green:L.yellow} bg={c.status==="Ativo"?L.greenBg:L.yellowBg}>{c.status}</Tag>
                  <div style={{marginTop:5,fontSize:10,color:c.saude>80?L.green:L.yellow,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>Saúde {c.saude}%</div>
                </div>
              </Row>
              <Grid cols={3} gap={8} mb={14}>
                {[["Usuários",c.usuarios,L.teal,L.tealBg],["Contatos",c.contatos.toLocaleString(),L.copper,L.copperBg],["MRR",c.mrr,L.green,L.greenBg]].map(([k,v,col,bg]) => (
                  <div key={k} style={{textAlign:"center",padding:"8px",background:bg,borderRadius:8,border:`1px solid ${col}18`}}>
                    <div style={{fontSize:13,fontWeight:700,color:col,fontFamily:"'Outfit',sans-serif"}}>{v}</div>
                    <div style={{fontSize:9,color:L.t4,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>{k}</div>
                  </div>
                ))}
              </Grid>
              <button onClick={()=>setSel(c)}
                style={{width:"100%",padding:"9px",borderRadius:9,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.tealBg,color:L.teal,border:`1.5px solid ${L.teal}22`,transition:"all .12s"}}
                onMouseEnter={e=>{e.currentTarget.style.background=L.teal;e.currentTarget.style.color="white";}}
                onMouseLeave={e=>{e.currentTarget.style.background=L.tealBg;e.currentTarget.style.color=L.teal;}}
              >
                Acessar Ambiente
              </button>
            </div>
          ))}
        </Grid>
      ) : (
        <div>
          <Row gap={10} mb={14}>
            <button onClick={()=>setSel(null)}
              style={{padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit",background:"transparent",color:L.t2,border:`1px solid ${L.line}`,transition:"all .12s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=L.teal;e.currentTarget.style.color=L.teal;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t2;}}
            >
              ← Voltar
            </button>
            <span style={{fontSize:14,fontWeight:600,color:L.t1}}>Ambiente: <span style={{color:L.teal}}>{sel.empresa}</span></span>
            <div style={{marginLeft:"auto",display:"flex",gap:6}}>
              <Tag color={pc[sel.plano]?.c||L.t3} bg={pc[sel.plano]?.bg||L.surface}>{sel.plano}</Tag>
              <Tag color={L.green} bg={L.greenBg}>Suporte Ativo</Tag>
            </div>
          </Row>

          <Grid cols={3} gap={12} mb={14}>
            {[{l:"Uptime",v:"99,87%",c:L.green},{l:"Resp. API",v:"124ms",c:L.teal},{l:"Erros 24h",v:"2",c:L.yellow}].map((k,i) => (
              <div key={i} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"16px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                <div style={{fontSize:10,color:L.t4,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:5,fontWeight:600}}>{k.l}</div>
                <div style={{fontSize:20,fontWeight:700,color:k.c,fontFamily:"'Outfit',sans-serif"}}>{k.v}</div>
              </div>
            ))}
          </Grid>

          <Grid cols={2} gap={12}>
            <Card title="Ações de Suporte">
              {[
                ["Ver leads da empresa",L.teal,L.tealBg,"◎"],
                ["Ver conversas WhatsApp",L.teal,L.tealBg,"◈"],
                ["Resetar senha de usuário",L.yellow,L.yellowBg,"⊙"],
                ["Verificar config de plano",L.copper,L.copperBg,"★"],
                ["Forçar sync de dados",L.green,L.greenBg,"↺"],
                ["Abrir ticket de suporte",L.red,L.redBg,"⊗"],
              ].map(([l,c,bg,ico],idx) => (
                <button key={idx}
                  style={{width:"100%",padding:"10px 14px",borderRadius:9,cursor:"pointer",fontFamily:"inherit",background:L.surface,color:L.t2,border:`1px solid ${L.line}`,display:"flex",alignItems:"center",gap:10,fontSize:12.5,marginBottom:8,transition:"all .12s",textAlign:"left"}}
                  onMouseEnter={e=>{e.currentTarget.style.background=bg;e.currentTarget.style.color=c;e.currentTarget.style.borderColor=c+"33";}}
                  onMouseLeave={e=>{e.currentTarget.style.background=L.surface;e.currentTarget.style.color=L.t2;e.currentTarget.style.borderColor=L.line;}}
                >
                  <span style={{fontSize:14}}>{ico}</span>{l}
                </button>
              ))}
            </Card>
            <Card title="Eventos Recentes">
              {[
                ["Login: larissa@alfacommerce.com","14:32","info"],
                ["Export de 47 leads","13:22","warn"],
                ["Campanha enviada: 1.240 msgs","12:00","info"],
                ["Limite de contatos 80%","09:15","warn"],
              ].map(([msg,hora,n],i) => (
                <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:`1px solid ${L.lineSoft}`}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:n==="warn"?L.yellow:L.teal,marginTop:5,flexShrink:0}}/>
                  <div style={{flex:1,fontSize:12,color:L.t2}}>{msg}</div>
                  <span style={{fontSize:10,color:L.t4,fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>{hora}</span>
                </div>
              ))}
            </Card>
          </Grid>
        </div>
      )}
    </Fade>
  );
}
