import { useState, useEffect } from "react";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { Fade, Row, PBtn, IBtn } from "../components/ui";
import Modal, { Field, Input, ModalFooter } from "../components/Modal";
import { supabase } from "../lib/supabase";

const DIAS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

export default function PageChatbot({ user }) {
  const [tab, setTab] = useState("config");

  return (
    <Fade>
      <div style={{display:"flex",gap:4,marginBottom:20,background:L.surface,padding:4,borderRadius:9,border:`1px solid ${L.line}`,width:"fit-content"}}>
        {[["config","⚙ Configurações"],["gatilhos","⚡ Gatilhos"],["rapidas","◈ Respostas Rápidas"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:"7px 18px",borderRadius:7,fontSize:12.5,fontWeight:tab===t?600:400,cursor:"pointer",fontFamily:"inherit",background:tab===t?L.white:L.surface,color:tab===t?L.teal:L.t3,border:"none",transition:"all .12s",boxShadow:tab===t?"0 1px 3px rgba(0,0,0,0.07)":"none"}}>
            {l}
          </button>
        ))}
      </div>

      {tab==="config"   && <TabConfig   user={user}/>}
      {tab==="gatilhos" && <TabGatilhos user={user}/>}
      {tab==="rapidas"  && <TabRapidas  user={user}/>}
    </Fade>
  );
}

/* ─── Configurações gerais do bot ─────────────────────────────────────────── */
function TabConfig({ user }) {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [succ, setSucc] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.from("chatbot_config").select("*").eq("empresa_id", user.empresa_id).single()
      .then(({ data }) => {
        if (data) setCfg(data);
        else setCfg({
          empresa_id: user.empresa_id,
          ativo: false,
          mensagem_boas_vindas: "Olá! Em que posso ajudar?",
          mensagem_fora_horario: "Nosso atendimento está encerrado no momento. Retornaremos em breve!",
          horario_inicio: "08:00",
          horario_fim: "18:00",
          dias_semana: [1,2,3,4,5],
          transferir_palavra: "atendente",
        });
      });
  }, [user.empresa_id]);

  const save = async () => {
    setSaving(true); setErr(""); setSucc("");
    const { id, ...fields } = cfg;
    const { error } = id
      ? await supabase.from("chatbot_config").update(fields).eq("id", id)
      : await supabase.from("chatbot_config").insert({ ...fields, empresa_id: user.empresa_id });
    if (error) setErr(error.message || "Erro ao salvar.");
    else {
      setSucc("Configurações salvas!");
      // reload to get id if new
      supabase.from("chatbot_config").select("*").eq("empresa_id", user.empresa_id).single().then(({ data }) => { if(data) setCfg(data); });
    }
    setSaving(false);
  };

  const toggleDia = (d) => setCfg(p => ({
    ...p,
    dias_semana: p.dias_semana.includes(d) ? p.dias_semana.filter(x=>x!==d) : [...p.dias_semana, d].sort((a,b)=>a-b)
  }));

  if (!cfg) return <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando...</div>;

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      {/* Coluna esquerda */}
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {/* Status do bot */}
        <Card title="Status do Chatbot">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0"}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:L.t1}}>Chatbot Automático</div>
              <div style={{fontSize:11.5,color:L.t3,marginTop:3}}>Responde automaticamente às mensagens recebidas</div>
            </div>
            <Toggle on={cfg.ativo} onChange={v=>setCfg(p=>({...p,ativo:v}))}/>
          </div>
        </Card>

        {/* Horário de atendimento */}
        <Card title="Horário de Atendimento">
          <div style={{marginBottom:14}}>
            <label style={labelStyle}>Dias da semana</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
              {DIAS.map((d,i)=>{
                const on = cfg.dias_semana.includes(i);
                return <button key={i} onClick={()=>toggleDia(i)}
                  style={{width:36,height:36,borderRadius:8,fontSize:11.5,fontWeight:on?700:400,cursor:"pointer",fontFamily:"inherit",background:on?L.tealBg:L.surface,color:on?L.teal:L.t3,border:`1.5px solid ${on?L.teal+"55":L.line}`,transition:"all .1s"}}>
                  {d}
                </button>;
              })}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Início">
              <input type="time" value={cfg.horario_inicio} onChange={e=>setCfg(p=>({...p,horario_inicio:e.target.value}))} style={timeStyle}/>
            </Field>
            <Field label="Fim">
              <input type="time" value={cfg.horario_fim} onChange={e=>setCfg(p=>({...p,horario_fim:e.target.value}))} style={timeStyle}/>
            </Field>
          </div>
        </Card>

        {/* Palavra de transferência */}
        <Card title="Transferência para Humano">
          <div style={{fontSize:11.5,color:L.t3,marginBottom:10,lineHeight:1.5}}>
            Quando o contato digitar esta palavra, o bot é desativado e a conversa vai para fila de atendimento.
          </div>
          <Field label="Palavra-chave de transferência">
            <Input value={cfg.transferir_palavra} onChange={v=>setCfg(p=>({...p,transferir_palavra:v}))} placeholder="Ex: atendente, humano, ajuda"/>
          </Field>
        </Card>
      </div>

      {/* Coluna direita */}
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {/* Mensagem de boas-vindas */}
        <Card title="Mensagem de Boas-vindas">
          <div style={{fontSize:11.5,color:L.t3,marginBottom:10,lineHeight:1.5}}>
            Enviada quando um novo contato inicia conversa dentro do horário comercial.
          </div>
          <textarea value={cfg.mensagem_boas_vindas} onChange={e=>setCfg(p=>({...p,mensagem_boas_vindas:e.target.value}))}
            rows={4} style={textareaStyle}
            onFocus={e=>e.target.style.borderColor=L.teal} onBlur={e=>e.target.style.borderColor=L.line}/>
        </Card>

        {/* Mensagem fora do horário */}
        <Card title="Mensagem Fora do Horário">
          <div style={{fontSize:11.5,color:L.t3,marginBottom:10,lineHeight:1.5}}>
            Enviada automaticamente quando uma mensagem chega fora do horário comercial.
          </div>
          <textarea value={cfg.mensagem_fora_horario} onChange={e=>setCfg(p=>({...p,mensagem_fora_horario:e.target.value}))}
            rows={4} style={textareaStyle}
            onFocus={e=>e.target.style.borderColor=L.teal} onBlur={e=>e.target.style.borderColor=L.line}/>
        </Card>

        {err && <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red}}>{err}</div>}
        {succ && <div style={{padding:"8px 12px",background:L.greenBg,borderRadius:8,fontSize:12,color:L.green}}>{succ}</div>}

        <button onClick={save} disabled={saving}
          style={{padding:"11px",borderRadius:9,background:L.teal,border:"none",color:"white",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:13,boxShadow:`0 3px 10px ${L.teal}28`}}>
          {saving?"Salvando...":"Salvar Configurações"}
        </button>
      </div>
    </div>
  );
}

/* ─── Gatilhos (chatbot_regras) ───────────────────────────────────────────── */
function TabGatilhos({ user }) {
  const { data: regras, loading, insert, update, remove } = useTable("chatbot_regras", { empresa_id: user.empresa_id });
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ gatilho:"", resposta:"", ativo:true, ordem:0 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const openNew  = () => { setForm({ gatilho:"", resposta:"", ativo:true, ordem: regras.length }); setEdit(null); setErr(""); setModal(true); };
  const openEdit = (r) => { setForm({ gatilho:r.gatilho, resposta:r.resposta, ativo:r.ativo, ordem:r.ordem }); setEdit(r.id); setErr(""); setModal(true); };

  const save = async () => {
    if (!form.gatilho.trim()) { setErr("Palavra-chave obrigatória."); return; }
    if (!form.resposta.trim()) { setErr("Resposta obrigatória."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, empresa_id: user.empresa_id };
    const { error } = edit ? await update(edit, payload) : await insert(payload);
    if (error) setErr(error.message || "Erro ao salvar.");
    else setModal(false);
    setSaving(false);
  };

  const sorted = [...regras].sort((a,b)=>a.ordem-b.ordem);

  return (
    <>
      <Row between mb={16}>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:L.t1}}>Gatilhos automáticos</div>
          <div style={{fontSize:11.5,color:L.t3,marginTop:2}}>O bot responde quando a mensagem contém a palavra-chave</div>
        </div>
        <PBtn onClick={openNew}>+ Novo Gatilho</PBtn>
      </Row>

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando...</div>
      ) : sorted.length === 0 ? (
        <EmptyState icon="⚡" title="Nenhum gatilho ainda" sub="Adicione palavras-chave para que o bot responda automaticamente." action="Criar primeiro gatilho" onClick={openNew}/>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {sorted.map(r => (
            <div key={r.id} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"14px 18px",display:"flex",gap:16,alignItems:"flex-start",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
              <div style={{flex:1,minWidth:0}}>
                <Row gap={8} mb={6}>
                  <div style={{background:L.tealBg,color:L.teal,borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{r.gatilho}</div>
                  {!r.ativo && <div style={{background:L.surface,color:L.t4,borderRadius:6,padding:"3px 8px",fontSize:10,border:`1px solid ${L.line}`}}>inativo</div>}
                </Row>
                <div style={{fontSize:12.5,color:L.t2,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{r.resposta}</div>
              </div>
              <Row gap={6} style={{flexShrink:0}}>
                <Toggle on={r.ativo} onChange={v=>update(r.id, {ativo:v})} small/>
                <IBtn c={L.teal} onClick={()=>openEdit(r)}>✎</IBtn>
                <IBtn c={L.red}  onClick={()=>{if(confirm("Excluir gatilho?"))remove(r.id);}}>⊗</IBtn>
              </Row>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={edit?"Editar Gatilho":"Novo Gatilho"} onClose={()=>setModal(false)} width={500}>
          <Field label="Palavra-chave *">
            <Input value={form.gatilho} onChange={v=>setForm(p=>({...p,gatilho:v}))} placeholder="Ex: preço, horário, endereço"/>
          </Field>
          <Field label="Resposta automática *">
            <textarea value={form.resposta} onChange={e=>setForm(p=>({...p,resposta:e.target.value}))}
              rows={5} placeholder="Digite a resposta que o bot enviará quando esta palavra-chave for detectada..."
              style={textareaStyle}
              onFocus={e=>e.target.style.borderColor=L.teal} onBlur={e=>e.target.style.borderColor=L.line}/>
          </Field>
          <Field label="Ordem de prioridade">
            <Input value={String(form.ordem)} onChange={v=>setForm(p=>({...p,ordem:parseInt(v)||0}))} type="number" placeholder="0"/>
          </Field>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <Toggle on={form.ativo} onChange={v=>setForm(p=>({...p,ativo:v}))}/>
            <span style={{fontSize:12.5,color:L.t2}}>Gatilho ativo</span>
          </div>
          {err && <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginBottom:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={save} loading={saving} label={edit?"Salvar":"Criar Gatilho"}/>
        </Modal>
      )}
    </>
  );
}

/* ─── Respostas Rápidas ───────────────────────────────────────────────────── */
function TabRapidas({ user }) {
  const { data: respostas, loading, insert, update, remove } = useTable("respostas_rapidas", { empresa_id: user.empresa_id });
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ titulo:"", mensagem:"", ativo:true });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const openNew  = () => { setForm({ titulo:"", mensagem:"", ativo:true }); setEdit(null); setErr(""); setModal(true); };
  const openEdit = (r) => { setForm({ titulo:r.titulo, mensagem:r.mensagem, ativo:r.ativo }); setEdit(r.id); setErr(""); setModal(true); };

  const save = async () => {
    if (!form.titulo.trim()) { setErr("Título obrigatório."); return; }
    if (!form.mensagem.trim()) { setErr("Mensagem obrigatória."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, empresa_id: user.empresa_id };
    const { error } = edit ? await update(edit, payload) : await insert(payload);
    if (error) setErr(error.message || "Erro ao salvar.");
    else setModal(false);
    setSaving(false);
  };

  return (
    <>
      <Row between mb={16}>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:L.t1}}>Respostas rápidas</div>
          <div style={{fontSize:11.5,color:L.t3,marginTop:2}}>Atalhos disponíveis no chat para os atendentes enviarem rapidamente</div>
        </div>
        <PBtn onClick={openNew}>+ Nova Resposta</PBtn>
      </Row>

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando...</div>
      ) : respostas.length === 0 ? (
        <EmptyState icon="◈" title="Nenhuma resposta rápida" sub="Crie atalhos de mensagem para agilizar o atendimento." action="Criar primeira resposta" onClick={openNew}/>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
          {respostas.map(r => (
            <div key={r.id} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"14px 16px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
              <Row between mb={8}>
                <div style={{fontSize:12,fontWeight:700,color:L.teal,background:L.tealBg,borderRadius:6,padding:"3px 10px",fontFamily:"'JetBrains Mono',monospace"}}>/{r.titulo}</div>
                <Row gap={5}>
                  <Toggle on={r.ativo} onChange={v=>update(r.id, {ativo:v})} small/>
                  <IBtn c={L.teal} onClick={()=>openEdit(r)}>✎</IBtn>
                  <IBtn c={L.red}  onClick={()=>{if(confirm("Excluir?"))remove(r.id);}}>⊗</IBtn>
                </Row>
              </Row>
              <div style={{fontSize:12,color:L.t2,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{r.mensagem}</div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={edit?"Editar Resposta":"Nova Resposta Rápida"} onClose={()=>setModal(false)} width={480}>
          <Field label="Título (atalho) *">
            <Input value={form.titulo} onChange={v=>setForm(p=>({...p,titulo:v}))} placeholder="Ex: saudacao, preco, horario"/>
          </Field>
          <Field label="Mensagem *">
            <textarea value={form.mensagem} onChange={e=>setForm(p=>({...p,mensagem:e.target.value}))}
              rows={5} placeholder="Texto que será enviado ao usar este atalho..."
              style={textareaStyle}
              onFocus={e=>e.target.style.borderColor=L.teal} onBlur={e=>e.target.style.borderColor=L.line}/>
          </Field>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <Toggle on={form.ativo} onChange={v=>setForm(p=>({...p,ativo:v}))}/>
            <span style={{fontSize:12.5,color:L.t2}}>Resposta ativa</span>
          </div>
          {err && <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginBottom:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={save} loading={saving} label={edit?"Salvar":"Criar"}/>
        </Modal>
      )}
    </>
  );
}

/* ─── Shared components ───────────────────────────────────────────────────── */
function Card({ title, children }) {
  return (
    <div style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:18,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
      <div style={{fontSize:11,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:14,fontFamily:"'JetBrains Mono',monospace"}}>{title}</div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, small }) {
  const w = small ? 32 : 40, h = small ? 18 : 22;
  return (
    <button onClick={()=>onChange(!on)}
      style={{width:w,height:h,borderRadius:h,background:on?L.teal:L.line,border:"none",cursor:"pointer",position:"relative",transition:"background .18s",flexShrink:0,padding:0}}>
      <span style={{position:"absolute",top:small?2:3,left:on?(small?16:20):(small?2:3),width:small?14:16,height:small?14:16,borderRadius:"50%",background:"white",transition:"left .18s",boxShadow:"0 1px 3px rgba(0,0,0,0.18)"}}/>
    </button>
  );
}

function EmptyState({ icon, title, sub, action, onClick }) {
  return (
    <div style={{textAlign:"center",padding:"60px 40px",color:L.t3}}>
      <div style={{fontSize:36,marginBottom:12}}>{icon}</div>
      <div style={{fontSize:14,fontWeight:600,color:L.t2,marginBottom:6}}>{title}</div>
      <div style={{fontSize:12.5,marginBottom:20}}>{sub}</div>
      <button onClick={onClick} style={{padding:"9px 18px",borderRadius:9,background:L.teal,color:"white",border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:12.5}}>{action}</button>
    </div>
  );
}

const labelStyle = { fontSize:10, fontWeight:700, color:L.t3, textTransform:"uppercase", letterSpacing:"1.2px", display:"block", fontFamily:"'JetBrains Mono',monospace" };
const timeStyle  = { width:"100%", background:L.surface, border:`1.5px solid ${L.line}`, borderRadius:9, padding:"9px 12px", color:L.t1, fontSize:12.5, fontFamily:"inherit", outline:"none" };
const textareaStyle = { width:"100%", background:L.surface, border:`1.5px solid ${L.line}`, borderRadius:9, padding:"9px 12px", color:L.t1, fontSize:12.5, fontFamily:"inherit", resize:"vertical", outline:"none", display:"block" };
