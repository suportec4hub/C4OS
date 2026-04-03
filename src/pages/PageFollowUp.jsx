import { useState } from "react";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { Fade, Row, PBtn, Tag } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const PRIORIDADES = ["Alta","Media","Baixa"];
const CANAIS = ["WhatsApp","Email","Ligação","Reunião","Outro"];
const VAZIO = { titulo:"", descricao:"", canal:"WhatsApp", prioridade:"Media", agendado_para:"" };

export default function PageFollowUp({ user }) {
  const { data: followups, loading, insert, update, remove } = useTable("follow_ups", { empresa_id: user?.empresa_id });
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState(VAZIO);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");
  const [filtro, setFiltro] = useState("pendente");

  const pc = { Alta:{c:L.red,bg:L.redBg}, Media:{c:L.yellow,bg:L.yellowBg}, Baixa:{c:L.green,bg:L.greenBg} };

  const filtered = filtro === "todos" ? followups : followups.filter(f => f.status === filtro);

  const openNew  = () => { setForm(VAZIO); setEditId(null); setErr(""); setModal(true); };
  const openEdit = (f) => { setForm({...VAZIO,...f,agendado_para:f.agendado_para?.slice(0,16)||""}); setEditId(f.id); setErr(""); setModal(true); };

  const save = async () => {
    if (!form.titulo.trim()) { setErr("Título obrigatório."); return; }
    if (!form.agendado_para) { setErr("Data/hora obrigatória."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, empresa_id: user?.empresa_id, status: "pendente", criado_por: user?.id };
    const { error } = editId ? await update(editId, payload) : await insert(payload);
    if (error) setErr(error.message||"Erro ao salvar.");
    else setModal(false);
    setSaving(false);
  };

  const concluir = async (id) => { await update(id, { status:"concluido", concluido_em: new Date().toISOString() }); };
  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  const urgentes = filtered.filter(f => f.prioridade==="Alta" && f.status==="pendente").length;

  return (
    <Fade>
      <Row between mb={14}>
        <div style={{display:"flex",gap:6}}>
          {["pendente","concluido","todos"].map(s=>(
            <button key={s} onClick={()=>setFiltro(s)}
              style={{padding:"6px 14px",borderRadius:7,fontSize:12,fontWeight:filtro===s?600:400,cursor:"pointer",fontFamily:"inherit",background:filtro===s?L.white:L.surface,color:filtro===s?L.teal:L.t3,border:`1.5px solid ${filtro===s?L.teal+"44":L.line}`,transition:"all .12s"}}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
          {urgentes>0 && <span style={{padding:"6px 12px",borderRadius:7,background:L.redBg,color:L.red,fontSize:12,fontWeight:600,border:`1px solid ${L.red}22`}}>{urgentes} urgentes</span>}
        </div>
        <PBtn onClick={openNew}>+ Novo Follow-up</PBtn>
      </Row>

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div style={{textAlign:"center",padding:60,color:L.t3}}>
          <div style={{fontSize:32,marginBottom:12}}>◷</div>
          <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>Nenhum follow-up {filtro}</div>
          <PBtn onClick={openNew}>+ Criar Follow-up</PBtn>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(item=>{
            const done = item.status === "concluido";
            return (
              <div key={item.id}
                style={{background:L.white,borderRadius:11,border:`1.5px solid ${done?L.green+"44":L.line}`,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,opacity:done?.6:1,transition:"all .22s",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}
              >
                <button onClick={()=>done?null:concluir(item.id)}
                  style={{width:22,height:22,borderRadius:6,flexShrink:0,background:done?L.green:"transparent",border:`2px solid ${done?L.green:L.line}`,cursor:done?"default":"pointer",color:"white",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .18s"}}>
                  {done?"✓":""}
                </button>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:done?L.t4:L.t1,textDecoration:done?"line-through":"none",marginBottom:2}}>{item.titulo}</div>
                  {item.descricao && <div style={{fontSize:11,color:L.t4,marginBottom:2}}>{item.descricao}</div>}
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:11.5,fontWeight:500,color:L.teal,marginBottom:5,fontFamily:"'JetBrains Mono',monospace"}}>{item.agendado_para ? new Date(item.agendado_para).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—"}</div>
                  <Row gap={5} justify="flex-end">
                    <Tag color={pc[item.prioridade]?.c||L.t3} bg={pc[item.prioridade]?.bg||L.surface} small>{item.prioridade}</Tag>
                    <Tag color={L.t3} bg={L.surface} small>{item.canal}</Tag>
                  </Row>
                </div>
                {!done && (
                  <Row gap={4}>
                    <button onClick={()=>openEdit(item)} style={{background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:13,padding:"3px 6px",borderRadius:5,transition:"color .1s"}}
                      onMouseEnter={e=>e.currentTarget.style.color=L.teal} onMouseLeave={e=>e.currentTarget.style.color=L.t4}>✎</button>
                    <button onClick={()=>{if(confirm("Excluir?"))remove(item.id);}} style={{background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:13,padding:"3px 6px",borderRadius:5,transition:"color .1s"}}
                      onMouseEnter={e=>e.currentTarget.style.color=L.red} onMouseLeave={e=>e.currentTarget.style.color=L.t4}>⊗</button>
                  </Row>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal title={editId?"Editar Follow-up":"Novo Follow-up"} onClose={()=>setModal(false)} width={460}>
          <Field label="Título *"><Input value={form.titulo} onChange={F("titulo")} placeholder="Ex: Enviar proposta revisada"/></Field>
          <Field label="Descrição"><Input value={form.descricao} onChange={F("descricao")} placeholder="Detalhes opcionais"/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
            <Field label="Data e Hora *">
              <input type="datetime-local" value={form.agendado_para} onChange={e=>F("agendado_para")(e.target.value)}
                style={{width:"100%",background:L.surface,border:`1.5px solid ${L.line}`,borderRadius:9,padding:"9px 12px",color:L.t1,fontSize:12.5,fontFamily:"inherit",outline:"none"}}
                onFocus={e=>e.target.style.borderColor=L.teal} onBlur={e=>e.target.style.borderColor=L.line}
              />
            </Field>
            <Field label="Canal">
              <Select value={form.canal} onChange={F("canal")}>
                {CANAIS.map(c=><option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Prioridade">
              <Select value={form.prioridade} onChange={F("prioridade")}>
                {PRIORIDADES.map(p=><option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
          </div>
          {err && <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginBottom:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={save} loading={saving} label={editId?"Salvar":"Criar Follow-up"}/>
        </Modal>
      )}
    </Fade>
  );
}
