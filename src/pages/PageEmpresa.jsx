import { useState } from "react";
import Logo from "../components/Logo";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { Fade, Card, Grid, Row, Tag, PBtn } from "../components/ui";
import Modal, { Field, Input, ModalFooter } from "../components/Modal";

const INTEG = [
  {n:"WhatsApp Business", s:"Conectado",    c:L.green,  bg:L.greenBg,  i:"◈", key:"waba"},
  {n:"Meta Ads",          s:"Conectado",    c:L.green,  bg:L.greenBg,  i:"⊞", key:"meta"},
  {n:"Facebook ADS",      s:"Desconectado", c:L.red,    bg:L.redBg,    i:"f", key:"fbads"},
  {n:"API de Conversão",  s:"Desconectado", c:L.red,    bg:L.redBg,    i:"⚡", key:"capi"},
  {n:"Google Analytics",  s:"Desconectado", c:L.red,    bg:L.redBg,    i:"◫", key:"ga"},
  {n:"Webhook API",       s:"Configurado",  c:L.teal,   bg:L.tealBg,   i:"{}", key:"webhook"},
];

export default function PageEmpresa({ empresa, user }) {
  const [tab, setTab] = useState("info");
  const [saving, setSaving] = useState(false);
  const [succ, setSucc] = useState("");

  const { data: empresas } = useTable("empresas", {});
  const empData = empresas.find(e => e.id === user?.empresa_id) || {};

  const [infoForm, setInfoForm] = useState({});
  const { update } = useTable("empresas");

  const saveInfo = async () => {
    setSaving(true); setSucc("");
    await update(user?.empresa_id, infoForm);
    setSucc("Alterações salvas com sucesso!"); setSaving(false);
  };

  return (
    <Fade>
      <div style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:22,marginBottom:14,display:"flex",alignItems:"center",gap:20,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
        <div style={{width:56,height:56,borderRadius:14,background:L.tealBg,border:`1.5px solid ${L.teal}22`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Logo size={40}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:18,fontWeight:700,color:L.t1,fontFamily:"'Outfit',sans-serif",marginBottom:4,letterSpacing:"-.3px"}}>{empData.nome||empresa}</div>
          <Row gap={14}>
            {[["CNPJ",empData.cnpj||"—"],["Segmento",empData.segmento||"—"],["Status",empData.status||"—"]].map(([k,v])=>(
              <span key={k} style={{fontSize:11,color:L.t4}}>{k}: <b style={{color:L.t2}}>{v}</b></span>
            ))}
          </Row>
        </div>
        <Row gap={8}>
          <Tag color={L.copper} bg={L.copperBg}>{empData.status||"trial"}</Tag>
        </Row>
      </div>

      <div style={{display:"flex",gap:4,marginBottom:16,background:L.surface,padding:4,borderRadius:9,border:`1px solid ${L.line}`,width:"fit-content"}}>
        {["info","configurações","integrações"].map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:"6px 14px",borderRadius:7,fontSize:12,fontWeight:tab===t?600:400,cursor:"pointer",fontFamily:"inherit",background:tab===t?L.white:L.surface,color:tab===t?L.teal:L.t3,border:"none",transition:"all .12s",boxShadow:tab===t?"0 1px 3px rgba(0,0,0,0.07)":"none"}}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {tab==="info" && (
        <Grid cols={2} gap={14}>
          <Card title="Informações da Empresa">
            {[["Nome",empData.nome||"—"],["CNPJ",empData.cnpj||"—"],["Segmento",empData.segmento||"—"],["Website",empData.website||"—"],["Telefone",empData.telefone||"—"],["Endereço",empData.endereco||"—"],["Status",empData.status||"—"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${L.lineSoft}`}}>
                <span style={{fontSize:11,color:L.t4,minWidth:130}}>{k}</span>
                <span style={{fontSize:12.5,color:L.t1}}>{v}</span>
              </div>
            ))}
          </Card>
          <Card title="Plano e Uso">
            <Grid cols={2} gap={8} mb={14}>
              {[["MRR",`R$ ${parseFloat(empData.mrr||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`,L.teal,L.tealBg],["Status",empData.status||"—",L.copper,L.copperBg]].map(([k,v,c,bg])=>(
                <div key={k} style={{padding:11,background:bg,borderRadius:9,border:`1px solid ${c}18`}}>
                  <div style={{fontSize:10,color:c,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"1px",textTransform:"uppercase",marginBottom:4,fontWeight:600}}>{k}</div>
                  <div style={{fontSize:15,fontWeight:700,color:L.t1,fontFamily:"'Outfit',sans-serif"}}>{v}</div>
                </div>
              ))}
            </Grid>
          </Card>
        </Grid>
      )}

      {tab==="configurações" && (
        <Card title="Configurações da Empresa">
          {succ && <div style={{padding:"8px 12px",background:L.greenBg,borderRadius:8,fontSize:12,color:L.green,marginBottom:14}}>{succ}</div>}
          <Grid cols={2} gap={14}>
            {[["Nome da Empresa","nome",empData.nome||""],["CNPJ","cnpj",empData.cnpj||""],["Telefone","telefone",empData.telefone||""],["Website","website",empData.website||""],["Segmento","segmento",empData.segmento||""],["Endereço","endereco",empData.endereco||""]].map(([l,k,v])=>(
              <div key={k}>
                <label style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1.2px",display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace"}}>{l}</label>
                <input defaultValue={v} onChange={e=>setInfoForm(p=>({...p,[k]:e.target.value}))}
                  style={{width:"100%",background:L.surface,border:`1.5px solid ${L.line}`,borderRadius:9,padding:"9px 12px",color:L.t1,fontSize:12.5,fontFamily:"inherit",outline:"none",marginBottom:14}}
                  onFocus={e=>e.target.style.borderColor=L.teal} onBlur={e=>e.target.style.borderColor=L.line}/>
              </div>
            ))}
          </Grid>
          <PBtn onClick={saveInfo}>{saving?"Salvando...":"Salvar Alterações"}</PBtn>
        </Card>
      )}

      {tab==="integrações" && (
        <Grid cols={3} gap={12}>
          {INTEG.map((it,i)=>(
            <div key={i}
              style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:18,transition:"all .15s",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=it.c+"55";e.currentTarget.style.transform="translateY(-1px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.transform="none";}}
            >
              <Row between mb={12}>
                <div style={{width:38,height:38,borderRadius:10,background:it.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:it.i==="f"?18:16,color:it.c,fontWeight:700}}>{it.i}</div>
                <Tag color={it.c} bg={it.bg} small>{it.s}</Tag>
              </Row>
              <div style={{fontSize:13,fontWeight:600,color:L.t1,marginBottom:12}}>{it.n}</div>
              <button
                style={{width:"100%",padding:"7px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:it.bg,color:it.c,border:`1.5px solid ${it.c}22`,transition:"all .12s"}}
                onMouseEnter={e=>{e.currentTarget.style.filter="brightness(.96)";}}
                onMouseLeave={e=>{e.currentTarget.style.filter="none";}}
              >
                {it.s==="Conectado"?"Gerenciar":it.s==="Configurado"?"Ver Config":"Conectar"}
              </button>
            </div>
          ))}
        </Grid>
      )}
    </Fade>
  );
}
