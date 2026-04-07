import { useState, useEffect } from "react";
import Logo from "../components/Logo";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { Fade, Card, Grid, Row, Tag, PBtn } from "../components/ui";

const COPY_TIMEOUT = 2000;

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_TIMEOUT);
  };
  return (
    <button onClick={copy} style={{
      padding:"4px 10px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",
      fontFamily:"inherit",background:copied?L.greenBg:L.tealBg,color:copied?L.green:L.teal,
      border:`1.5px solid ${copied?L.green:L.teal}22`,transition:"all .15s",flexShrink:0
    }}>
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${L.lineSoft}`}}>
      <span style={{fontSize:11,color:L.t4,minWidth:130}}>{label}</span>
      <span style={{fontSize:12.5,color:L.t1}}>{value}</span>
    </div>
  );
}

function LabelInput({ label, value, onChange, placeholder, type="text", readOnly=false }) {
  return (
    <div>
      <label style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1.2px",display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace"}}>{label}</label>
      <input value={value} onChange={onChange} placeholder={placeholder} type={type} readOnly={readOnly}
        style={{width:"100%",background:readOnly?L.surface:L.white,border:`1.5px solid ${L.line}`,borderRadius:9,padding:"9px 12px",color:readOnly?L.t3:L.t1,fontSize:12.5,fontFamily:"inherit",outline:"none",marginBottom:14,cursor:readOnly?"default":"text"}}
        onFocus={e=>{ if(!readOnly) e.target.style.borderColor=L.teal; }}
        onBlur={e=>{ e.target.style.borderColor=L.line; }}
      />
    </div>
  );
}

const WEBHOOK_URL = "https://zexjmlthyxtunioojlga.supabase.co/functions/v1/waba-webhook";

export default function PageEmpresa({ empresa, user }) {
  const [tab, setTab] = useState("info");
  const [saving, setSaving] = useState(false);
  const [savingWaba, setSavingWaba] = useState(false);
  const [succ, setSucc] = useState("");
  const [succWaba, setSuccWaba] = useState("");
  const [wabaInteg, setWabaInteg] = useState(null); // "modal" | null

  const { data: empresas } = useTable("empresas", {});
  const empData = empresas.find(e => e.id === user?.empresa_id) || {};

  const [infoForm, setInfoForm] = useState({});
  const [wabaForm, setWabaForm] = useState({ waba_phone_number_id:"", waba_access_token:"", waba_verify_token:"" });
  const { update } = useTable("empresas");

  // sync wabaForm from empData
  useEffect(() => {
    if (empData.id) {
      setWabaForm({
        waba_phone_number_id: empData.waba_phone_number_id || "",
        waba_access_token:    empData.waba_access_token    || "",
        waba_verify_token:    empData.waba_verify_token    || "",
      });
    }
  }, [empData.id]);

  const saveInfo = async () => {
    setSaving(true); setSucc("");
    await update(user?.empresa_id, infoForm);
    setSucc("Alterações salvas com sucesso!"); setSaving(false);
  };

  const saveWaba = async () => {
    setSavingWaba(true); setSuccWaba("");
    const { error } = await supabase.from("empresas").update({
      waba_phone_number_id: wabaForm.waba_phone_number_id,
      waba_access_token:    wabaForm.waba_access_token,
      waba_verify_token:    wabaForm.waba_verify_token,
    }).eq("id", user?.empresa_id);
    if (error) setSuccWaba("Erro ao salvar: " + error.message);
    else setSuccWaba("Configurações do WhatsApp salvas!");
    setSavingWaba(false);
  };

  const wabaStatus = empData.waba_phone_number_id ? "Configurado" : "Não configurado";

  const OTHER_INTEG = [
    {n:"Meta Ads",         s:"Desconectado", c:L.red,    bg:L.redBg,    i:"⊞"},
    {n:"Facebook ADS",     s:"Desconectado", c:L.red,    bg:L.redBg,    i:"f"},
    {n:"API de Conversão", s:"Desconectado", c:L.red,    bg:L.redBg,    i:"⚡"},
    {n:"Google Analytics", s:"Desconectado", c:L.red,    bg:L.redBg,    i:"◫"},
    {n:"Webhook API",      s:"Configurado",  c:L.teal,   bg:L.tealBg,   i:"{}"},
  ];

  return (
    <Fade>
      {/* Header card */}
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

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:16,background:L.surface,padding:4,borderRadius:9,border:`1px solid ${L.line}`,width:"fit-content"}}>
        {["info","configurações","integrações"].map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:"6px 14px",borderRadius:7,fontSize:12,fontWeight:tab===t?600:400,cursor:"pointer",fontFamily:"inherit",background:tab===t?L.white:L.surface,color:tab===t?L.teal:L.t3,border:"none",transition:"all .12s",boxShadow:tab===t?"0 1px 3px rgba(0,0,0,0.07)":"none"}}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {tab==="info" && (
        <Grid cols={2} gap={14}>
          <Card title="Informações da Empresa">
            {[["Nome",empData.nome||"—"],["CNPJ",empData.cnpj||"—"],["Segmento",empData.segmento||"—"],["Website",empData.website||"—"],["Telefone",empData.telefone||"—"],["Endereço",empData.endereco||"—"],["Status",empData.status||"—"]].map(([k,v])=>(
              <InfoRow key={k} label={k} value={v}/>
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

      {/* Configurações tab */}
      {tab==="configurações" && (
        <Card title="Configurações da Empresa">
          {succ && <div style={{padding:"8px 12px",background:L.greenBg,borderRadius:8,fontSize:12,color:L.green,marginBottom:14}}>{succ}</div>}
          <Grid cols={2} gap={14}>
            {[["Nome da Empresa","nome",empData.nome||"","text"],["CNPJ","cnpj",empData.cnpj||"","text"],["Telefone","telefone",empData.telefone||"","text"],["Website","website",empData.website||"","text"],["Segmento","segmento",empData.segmento||"","text"],["Endereço","endereco",empData.endereco||"","text"],["MRR (R$) — Receita Recorrente Mensal","mrr",empData.mrr||"","number"]].map(([l,k,v,type])=>(
              <div key={k}>
                <label style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1.2px",display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace"}}>{l}</label>
                <input defaultValue={v} type={type} onChange={e=>setInfoForm(p=>({...p,[k]:type==="number"?parseFloat(e.target.value)||0:e.target.value}))}
                  style={{width:"100%",background:L.surface,border:`1.5px solid ${L.line}`,borderRadius:9,padding:"9px 12px",color:L.t1,fontSize:12.5,fontFamily:"inherit",outline:"none",marginBottom:14}}
                  onFocus={e=>e.target.style.borderColor=L.teal} onBlur={e=>e.target.style.borderColor=L.line}/>
              </div>
            ))}
          </Grid>
          <PBtn onClick={saveInfo}>{saving?"Salvando...":"Salvar Alterações"}</PBtn>
        </Card>
      )}

      {/* Integrações tab */}
      {tab==="integrações" && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* WhatsApp Business — expanded card */}
          <div style={{background:L.white,borderRadius:12,border:`1.5px solid ${empData.waba_phone_number_id?L.teal+"33":L.line}`,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <Row between mb={16}>
              <Row gap={12}>
                <div style={{width:42,height:42,borderRadius:11,background:L.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>💬</div>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:L.t1}}>WhatsApp Business API</div>
                  <div style={{fontSize:11,color:L.t3,marginTop:2}}>Meta / Graph API v19.0</div>
                </div>
              </Row>
              <Tag color={empData.waba_phone_number_id?L.green:L.red} bg={empData.waba_phone_number_id?L.greenBg:L.redBg}>
                {wabaStatus}
              </Tag>
            </Row>

            {/* Webhook info (readonly) */}
            <div style={{background:L.surface,borderRadius:10,padding:14,marginBottom:16,border:`1px solid ${L.line}`}}>
              <div style={{fontSize:11,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:10,fontFamily:"'JetBrains Mono',monospace"}}>Configuração do Webhook (Meta Developer Console)</div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:L.t4,marginBottom:4}}>URL do Webhook</div>
                <Row gap={8}>
                  <div style={{flex:1,background:L.white,border:`1px solid ${L.line}`,borderRadius:8,padding:"7px 10px",fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:L.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{WEBHOOK_URL}</div>
                  <CopyBtn value={WEBHOOK_URL}/>
                </Row>
              </div>
              <div>
                <div style={{fontSize:10,color:L.t4,marginBottom:4}}>Verify Token (cole no Meta)</div>
                <Row gap={8}>
                  <div style={{flex:1,background:L.white,border:`1px solid ${L.line}`,borderRadius:8,padding:"7px 10px",fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:L.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {wabaForm.waba_verify_token || <span style={{color:L.t4}}>—  (preencha abaixo e salve primeiro)</span>}
                  </div>
                  {wabaForm.waba_verify_token && <CopyBtn value={wabaForm.waba_verify_token}/>}
                </Row>
              </div>
            </div>

            {/* Instructions */}
            <div style={{background:"#fffbf0",border:`1px solid ${L.yellow}44`,borderRadius:10,padding:12,marginBottom:16,fontSize:11,color:L.t2,lineHeight:1.7}}>
              <div style={{fontWeight:700,color:L.yellow,marginBottom:6,fontSize:11}}>⚡ Como configurar no Meta Developer Console</div>
              <ol style={{paddingLeft:18,margin:0}}>
                <li>Acesse <b>Meta for Developers</b> → seu App → WhatsApp → Configuração</li>
                <li>Em <b>Webhooks</b>, clique em <b>Editar</b></li>
                <li>Cole a URL e o Verify Token acima</li>
                <li>Assine os eventos: <b>messages</b></li>
                <li>Salve o <b>Phone Number ID</b> e <b>Access Token</b> nos campos abaixo</li>
              </ol>
            </div>

            {/* Editable fields */}
            {succWaba && (
              <div style={{padding:"8px 12px",background:succWaba.startsWith("Erro")?L.redBg:L.greenBg,borderRadius:8,fontSize:12,color:succWaba.startsWith("Erro")?L.red:L.green,marginBottom:14}}>
                {succWaba}
              </div>
            )}
            <Grid cols={2} gap={12}>
              <LabelInput label="Phone Number ID" value={wabaForm.waba_phone_number_id}
                onChange={e=>setWabaForm(p=>({...p,waba_phone_number_id:e.target.value}))}
                placeholder="Ex: 123456789012345"/>
              <LabelInput label="Verify Token (crie um token secreto)" value={wabaForm.waba_verify_token}
                onChange={e=>setWabaForm(p=>({...p,waba_verify_token:e.target.value}))}
                placeholder="Ex: meu_token_secreto_123"/>
              <div style={{gridColumn:"1/-1"}}>
                <LabelInput label="Access Token (permanente do App)" value={wabaForm.waba_access_token}
                  onChange={e=>setWabaForm(p=>({...p,waba_access_token:e.target.value}))}
                  placeholder="EAAxxxxxxxx..." type="password"/>
              </div>
            </Grid>
            <PBtn onClick={saveWaba}>{savingWaba?"Salvando...":"Salvar Configurações WhatsApp"}</PBtn>
          </div>

          {/* Other integrations */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
            {OTHER_INTEG.map((it,i)=>(
              <div key={i}
                style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:18,cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",transition:"all .15s"}}
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
          </div>
        </div>
      )}
    </Fade>
  );
}
