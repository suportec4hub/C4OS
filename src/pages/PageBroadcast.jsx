import { useState } from "react";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { Fade, Row, Tag } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const SEGMENTOS = ["Todos os Leads","Quentes","Mornos","Frios","Enterprise","Inativos","Follow-up Pendente"];
const VAZIO = { titulo:"", mensagem:"", segmentacao:[], agendado_para:"" };

export default function PageBroadcast({ user }) {
  const { data: campanhas, loading, insert, update } = useTable("campanhas", { empresa_id: user?.empresa_id });
  const [tab, setTab]     = useState("nova");
  const [form, setForm]   = useState(VAZIO);
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");
  const [succ, setSucc]   = useState("");

  const toggleSeg = (s) => setForm(p => ({
    ...p, segmentacao: p.segmentacao.includes(s) ? p.segmentacao.filter(x=>x!==s) : [...p.segmentacao, s]
  }));

  const enviar = async (status = "rascunho") => {
    if (!form.titulo.trim()) { setErr("Nome da campanha obrigatório."); return; }
    if (!form.mensagem.trim()) { setErr("Mensagem obrigatória."); return; }
    setSaving(true); setErr(""); setSucc("");
    const payload = {
      ...form, empresa_id: user?.empresa_id, status,
      agendado_para: form.agendado_para || null,
      total_contatos: 0, enviados:0, entregues:0, lidos:0, respostas:0
    };
    const { error } = await insert(payload);
    if (error) setErr(error.message||"Erro ao salvar.");
    else {
      setSucc(status==="agendado"?"Campanha agendada com sucesso!":"Campanha salva como rascunho.");
      setForm(VAZIO); setTab("hist");
    }
    setSaving(false);
  };

  const cancelar = async (id) => { await update(id, { status:"cancelado" }); };

  const ST = { rascunho:{c:L.t3,bg:L.surface}, agendado:{c:L.yellow,bg:L.yellowBg}, enviando:{c:L.blue,bg:L.blueBg}, concluido:{c:L.green,bg:L.greenBg}, cancelado:{c:L.red,bg:L.redBg} };

  return (
    <Fade>
      <div style={{display:"flex",gap:4,marginBottom:20,background:L.surface,padding:4,borderRadius:9,border:`1px solid ${L.line}`,width:"fit-content"}}>
        {["nova","hist"].map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:"7px 18px",borderRadius:7,fontSize:12.5,fontWeight:tab===t?600:400,cursor:"pointer",fontFamily:"inherit",background:tab===t?L.white:L.surface,color:tab===t?L.teal:L.t3,border:"none",transition:"all .12s",boxShadow:tab===t?"0 1px 3px rgba(0,0,0,0.07)":"none"}}>
            {t==="nova"?"Nova Campanha":"Histórico"}
          </button>
        ))}
      </div>

      {tab==="nova" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <div style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:13,fontWeight:600,color:L.t1,marginBottom:18}}>Configurar Campanha</div>

            <Field label="Nome da campanha *"><Input value={form.titulo} onChange={v=>setForm(p=>({...p,titulo:v}))} placeholder="Ex: Promoção Abril 2024"/></Field>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1.2px",display:"block",marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>Segmentação</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {SEGMENTOS.map(s=>{
                  const sel = form.segmentacao.includes(s);
                  return <button key={s} onClick={()=>toggleSeg(s)}
                    style={{padding:"4px 11px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"inherit",background:sel?L.tealBg:L.surface,color:sel?L.teal:L.t3,border:`1.5px solid ${sel?L.teal+"44":L.line}`,transition:"all .1s",fontWeight:sel?600:400}}>
                    {sel?"✓ ":""}{s}
                  </button>;
                })}
              </div>
            </div>

            <Field label="Agendamento (opcional)">
              <input type="datetime-local" value={form.agendado_para} onChange={e=>setForm(p=>({...p,agendado_para:e.target.value}))}
                style={{width:"100%",background:L.surface,border:`1.5px solid ${L.line}`,borderRadius:9,padding:"9px 12px",color:L.t1,fontSize:12.5,fontFamily:"inherit",outline:"none"}}
                onFocus={e=>e.target.style.borderColor=L.teal} onBlur={e=>e.target.style.borderColor=L.line}/>
            </Field>

            <Field label="Mensagem *">
              <textarea value={form.mensagem} onChange={e=>setForm(p=>({...p,mensagem:e.target.value}))}
                placeholder="Olá {nome}! Temos uma oferta especial para você..."
                rows={5}
                style={{width:"100%",background:L.surface,border:`1.5px solid ${L.line}`,borderRadius:9,padding:"9px 12px",color:L.t1,fontSize:12.5,fontFamily:"inherit",resize:"vertical",outline:"none",display:"block"}}
                onFocus={e=>e.target.style.borderColor=L.teal} onBlur={e=>e.target.style.borderColor=L.line}/>
              <div style={{fontSize:10,color:L.t4,marginTop:4}}>{form.mensagem.length}/1000 · variáveis: {"{nome}"} {"{empresa}"}</div>
            </Field>

            {err && <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginBottom:12}}>{err}</div>}
            {succ && <div style={{padding:"8px 12px",background:L.greenBg,borderRadius:8,fontSize:12,color:L.green,marginBottom:12}}>{succ}</div>}

            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>enviar("rascunho")} disabled={saving}
                style={{flex:1,padding:"10px",borderRadius:9,background:L.surface,border:`1px solid ${L.line}`,color:L.t2,cursor:"pointer",fontFamily:"inherit",fontWeight:500,fontSize:12.5}}>
                Salvar rascunho
              </button>
              <button onClick={()=>enviar("agendado")} disabled={saving}
                style={{flex:2,padding:"10px",borderRadius:9,background:L.teal,border:"none",color:"white",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:12.5,boxShadow:`0 3px 10px ${L.teal}28`}}>
                {saving?"Salvando...":"◈ Agendar / Enviar"}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:13,fontWeight:600,color:L.t1,marginBottom:16}}>Preview WhatsApp</div>
            <div style={{background:"#dfe7dd",borderRadius:10,padding:16,minHeight:200,marginBottom:16}}>
              <div style={{background:"white",borderRadius:"12px 12px 12px 3px",padding:"10px 14px",maxWidth:"82%",fontSize:12.5,color:L.t1,lineHeight:1.55,marginBottom:6,boxShadow:"0 1px 3px rgba(0,0,0,0.12)",wordBreak:"break-word"}}>
                {form.mensagem||<span style={{color:"#aaa",fontStyle:"italic"}}>Sua mensagem aparecerá aqui...</span>}
              </div>
              <div style={{fontSize:10,color:"#6a8a72"}}>agora ✓✓</div>
            </div>
            <div style={{padding:14,background:L.surface,borderRadius:10,border:`1px solid ${L.line}`}}>
              <div style={{fontSize:11,fontWeight:600,color:L.t2,marginBottom:10}}>Estimativa de alcance</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[["Segmentos",form.segmentacao.length||0],["Estimativa","~2.340"],["Entrega","~97%"],["Resposta","~15%"]].map(([k,v])=>(
                  <div key={k} style={{textAlign:"center",padding:"10px",background:L.white,borderRadius:8,border:`1px solid ${L.line}`}}>
                    <div style={{fontSize:17,fontWeight:700,color:L.teal,fontFamily:"'Outfit',sans-serif"}}>{v}</div>
                    <div style={{fontSize:10,color:L.t3,marginTop:2}}>{k}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab==="hist" && (
        loading ? <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando...</div> :
        campanhas.length === 0 ? (
          <div style={{textAlign:"center",padding:60,color:L.t3}}>
            <div style={{fontSize:32,marginBottom:12}}>◉</div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>Nenhuma campanha ainda</div>
            <button onClick={()=>setTab("nova")} style={{padding:"9px 18px",borderRadius:9,background:L.teal,color:"white",border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:600,marginTop:8}}>Criar primeira campanha</button>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {campanhas.map(c=>(
              <div key={c.id} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"14px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                <Row between mb={8}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:L.t1}}>{c.titulo}</div>
                    <div style={{fontSize:11,color:L.t4,marginTop:2}}>{c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "—"}</div>
                  </div>
                  <Row gap={8}>
                    <Tag color={ST[c.status]?.c||L.t3} bg={ST[c.status]?.bg||L.surface}>{c.status}</Tag>
                    {c.status==="agendado" && <button onClick={()=>cancelar(c.id)} style={{fontSize:11,color:L.red,background:"none",border:`1px solid ${L.red}22`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>}
                  </Row>
                </Row>
                <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                  {[["Enviados",c.enviados],["Entregues",c.entregues],["Lidos",c.lidos],["Respostas",c.respostas]].map(([k,v])=>(
                    <div key={k} style={{fontSize:11,color:L.t3}}>{k}: <b style={{color:L.t1}}>{v||0}</b></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </Fade>
  );
}
