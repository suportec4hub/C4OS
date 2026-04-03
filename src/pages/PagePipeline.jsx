import { useState } from "react";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { Fade, Row, PBtn, Tag, ScBar } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const ETAPAS = [
  {id:"novo",    label:"Novos",      cor:L.teal},
  {id:"qualif",  label:"Qualificação",cor:L.copper},
  {id:"proposta",label:"Proposta",   cor:L.yellow},
  {id:"negoc",   label:"Negociação", cor:L.blue},
  {id:"fechado", label:"Fechado ✓",  cor:L.green},
  {id:"perdido", label:"Perdido ✗",  cor:L.red},
];

const VAZIO = { titulo:"", valor:0, etapa:"novo", probabilidade:50, observacoes:"" };

export default function PagePipeline({ user }) {
  const { data: deals, loading, insert, update, remove } = useTable("deals", { empresa_id: user?.empresa_id });
  const { data: leads } = useTable("leads", { empresa_id: user?.empresa_id });

  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(VAZIO);
  const [editId, setEditId]   = useState(null);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const total = deals.filter(d=>d.etapa!=="perdido").reduce((s,d)=>s+parseFloat(d.valor||0),0);

  const byEtapa = (id) => deals.filter(d => d.etapa === id);

  const openNew  = (etapa="novo") => { setForm({...VAZIO,etapa}); setEditId(null); setErr(""); setModal(true); };
  const openEdit = (d) => { setForm({...VAZIO,...d}); setEditId(d.id); setErr(""); setModal(true); };

  const save = async () => {
    if (!form.titulo.trim()) { setErr("Título obrigatório."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, valor: parseFloat(form.valor)||0, probabilidade: parseInt(form.probabilidade)||50, empresa_id: user?.empresa_id };
    const { error } = editId ? await update(editId, payload) : await insert(payload);
    if (error) setErr(error.message||"Erro ao salvar.");
    else setModal(false);
    setSaving(false);
  };

  const onDrop = async (toEtapa) => {
    if (!dragging || dragging.etapa === toEtapa) { setDragging(null); setDragOver(null); return; }
    await update(dragging.id, { etapa: toEtapa });
    setDragging(null); setDragOver(null);
  };

  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando funil...</div>;

  return (
    <Fade>
      <Row between mb={16}>
        <div style={{display:"flex",gap:16,alignItems:"center"}}>
          <span style={{fontSize:12,color:L.t3}}>Total pipeline: <b style={{color:L.teal,fontSize:15,fontFamily:"'Outfit',sans-serif"}}>R$ {total.toLocaleString("pt-BR",{minimumFractionDigits:2})}</b></span>
          <span style={{fontSize:12,color:L.t3}}>{deals.filter(d=>d.etapa!=="perdido").length} deals ativos</span>
        </div>
        <PBtn onClick={()=>openNew()}>+ Novo Deal</PBtn>
      </Row>

      <div style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:12}}>
        {ETAPAS.map(stage => (
          <div key={stage.id}
            onDragOver={e=>{e.preventDefault();setDragOver(stage.id);}}
            onDrop={()=>onDrop(stage.id)}
            onDragLeave={()=>setDragOver(null)}
            style={{minWidth:215,flex:"0 0 215px",background:dragOver===stage.id?L.surface:L.white,borderRadius:12,border:`1.5px solid ${dragOver===stage.id?stage.cor+"55":L.line}`,padding:14,transition:"all .15s",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}
          >
            <Row between mb={12}>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:stage.cor,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace"}}>{stage.label}</div>
                <div style={{fontSize:10,color:L.t4,marginTop:1}}>{byEtapa(stage.id).length} deals · R$ {byEtapa(stage.id).reduce((s,d)=>s+parseFloat(d.valor||0),0).toLocaleString("pt-BR",{maximumFractionDigits:0})}</div>
              </div>
              <div style={{width:8,height:8,borderRadius:"50%",background:stage.cor}}/>
            </Row>

            {byEtapa(stage.id).map(deal => (
              <div key={deal.id} draggable
                onDragStart={()=>setDragging(deal)}
                onClick={()=>openEdit(deal)}
                style={{background:L.bg,borderRadius:10,border:`1px solid ${L.line}`,padding:12,marginBottom:8,cursor:"grab",transition:"all .15s",boxShadow:"0 1px 2px rgba(0,0,0,0.03)"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=stage.cor+"66";e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 1px 2px rgba(0,0,0,0.03)";}}
              >
                <div style={{fontSize:12.5,fontWeight:600,color:L.t1,marginBottom:5,lineHeight:1.35}}>{deal.titulo}</div>
                <div style={{fontSize:16,fontWeight:800,color:stage.cor,fontFamily:"'Outfit',sans-serif",marginBottom:8}}>R$ {parseFloat(deal.valor||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</div>
                <Row between>
                  <ScBar v={deal.probabilidade||50} w={30} h={3}/>
                  <span style={{fontSize:10,color:L.t4}}>{deal.probabilidade||50}%</span>
                  <button onClick={e=>{e.stopPropagation();if(confirm("Excluir?"))remove(deal.id);}}
                    style={{background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:11,padding:"1px 5px",borderRadius:4}}
                    onMouseEnter={e=>e.currentTarget.style.color=L.red}
                    onMouseLeave={e=>e.currentTarget.style.color=L.t4}
                  >⊗</button>
                </Row>
              </div>
            ))}

            <button onClick={()=>openNew(stage.id)}
              style={{width:"100%",padding:"7px",background:"transparent",border:`1.5px dashed ${L.line}`,borderRadius:9,color:L.t4,fontSize:11,cursor:"pointer",fontFamily:"inherit",transition:"all .12s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=stage.cor;e.currentTarget.style.color=stage.cor;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t4;}}
            >+ Adicionar</button>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={editId ? "Editar Deal" : "Novo Deal"} onClose={()=>setModal(false)} width={480}>
          <Field label="Título *"><Input value={form.titulo} onChange={F("titulo")} placeholder="Ex: Proposta Empresa ABC"/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
            <Field label="Valor (R$)"><Input value={form.valor} onChange={F("valor")} type="number" placeholder="0,00"/></Field>
            <Field label="Probabilidade (%)">
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <input type="range" min={0} max={100} value={form.probabilidade} onChange={e=>F("probabilidade")(e.target.value)} style={{flex:1,accentColor:L.teal}}/>
                <span style={{fontSize:12,color:L.teal,fontWeight:600,minWidth:32}}>{form.probabilidade}%</span>
              </div>
            </Field>
            <Field label="Etapa">
              <Select value={form.etapa} onChange={F("etapa")}>
                {ETAPAS.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}
              </Select>
            </Field>
            <Field label="Lead (opcional)">
              <Select value={form.lead_id||""} onChange={F("lead_id")}>
                <option value="">— Selecionar lead —</option>
                {leads.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Observações">
            <textarea value={form.observacoes} onChange={e=>F("observacoes")(e.target.value)} rows={2}
              placeholder="Notas sobre o deal..."
              style={{width:"100%",background:L.surface,border:`1.5px solid ${L.line}`,borderRadius:9,padding:"9px 12px",color:L.t1,fontSize:12.5,fontFamily:"inherit",resize:"vertical",outline:"none"}}/>
          </Field>
          {err && <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginBottom:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={save} loading={saving} label={editId?"Salvar":"Criar Deal"}/>
        </Modal>
      )}
    </Fade>
  );
}
