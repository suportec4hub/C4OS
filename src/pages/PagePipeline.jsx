import { useState, useEffect } from "react";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { Fade, Row, PBtn, Tag, ScBar, IBtn } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const ETAPAS_DEFAULT = [
  {id:"novo",    label:"Novos",       cor:L.teal},
  {id:"qualif",  label:"Qualificação",cor:L.copper},
  {id:"proposta",label:"Proposta",    cor:L.yellow},
  {id:"negoc",   label:"Negociação",  cor:L.blue},
  {id:"fechado", label:"Fechado ✓",   cor:L.green},
  {id:"perdido", label:"Perdido ✗",   cor:L.red},
];

const CANAIS_AQUISICAO = ["WhatsApp","Site","Instagram","Facebook ADS","Google ADS","Email","Indicação","Ligação","Evento","Outro"];
const CORES_ETAPA = [L.teal, L.copper, L.yellow, L.blue, L.green, L.red, "#6366F1", "#f59e0b", "#10b981"];

const VAZIO = { titulo:"", valor:"", etapa:"novo", probabilidade:50, observacoes:"", canal_aquisicao:"WhatsApp", lead_id:"", whatsapp_contato:"" };
const VAZIO_COL = { label:"", cor: L.teal };

export default function PagePipeline({ user }) {
  const { data: deals, loading, insert, update, remove } = useTable("deals", { empresa_id: user?.empresa_id });
  const { data: leads } = useTable("leads", { empresa_id: user?.empresa_id });

  const [etapas,  setEtapas]   = useState(ETAPAS_DEFAULT);
  const [modal,   setModal]    = useState(false);
  const [form,    setForm]     = useState(VAZIO);
  const [editId,  setEditId]   = useState(null);
  const [saving,  setSaving]   = useState(false);
  const [err,     setErr]      = useState("");
  const [dragging,setDragging] = useState(null);
  const [dragOver,setDragOver] = useState(null);

  // Gestão de colunas
  const [colModal,     setColModal]     = useState(false); // "add" | "edit" | false
  const [colEditIdx,   setColEditIdx]   = useState(null);
  const [colForm,      setColForm]      = useState(VAZIO_COL);
  const [colDrag,      setColDrag]      = useState(null);
  const [colDragOver,  setColDragOver]  = useState(null);

  // Carrega etapas customizadas do Supabase (se houver)
  useEffect(() => {
    if (!user?.empresa_id) return;
    supabase.from("pipeline_etapas").select("*").eq("empresa_id", user.empresa_id).order("ordem").then(({ data }) => {
      if (data && data.length > 0) {
        setEtapas(data.map(e => ({ id: e.slug, label: e.label, cor: e.cor || L.teal, dbId: e.id, ordem: e.ordem })));
      }
    });
  }, [user?.empresa_id]);

  const salvarEtapas = async (novas) => {
    // Persiste no banco (upsert por slug + empresa_id)
    await Promise.all(novas.map((e, i) =>
      supabase.from("pipeline_etapas").upsert({ empresa_id: user.empresa_id, slug: e.id, label: e.label, cor: e.cor, ordem: i }, { onConflict: "empresa_id,slug" })
    ));
  };

  // Total do pipeline (excluindo perdidos)
  const totalPipeline = deals.filter(d => d.etapa !== "perdido").reduce((s, d) => s + parseFloat(d.valor || 0), 0);
  // Faturamento fechado
  const totalFechado  = deals.filter(d => d.etapa === "fechado").reduce((s, d) => s + parseFloat(d.valor || 0), 0);

  const byEtapa = (id) => deals.filter(d => d.etapa === id);

  const openNew  = (etapa = "novo") => {
    const lead = null;
    setForm({ ...VAZIO, etapa }); setEditId(null); setErr(""); setModal(true);
  };
  const openEdit = (d) => { setForm({ ...VAZIO, ...d, valor: d.valor?.toString() || "" }); setEditId(d.id); setErr(""); setModal(true); };

  // Ao selecionar um lead, preenche WhatsApp automaticamente
  const onSelectLead = (leadId) => {
    const lead = leads.find(l => l.id === leadId);
    setForm(p => ({ ...p, lead_id: leadId, titulo: p.titulo || lead?.nome || "", whatsapp_contato: lead?.whatsapp || p.whatsapp_contato }));
  };

  const save = async () => {
    if (!form.titulo.trim()) { setErr("Título obrigatório."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, valor: parseFloat(form.valor) || 0, probabilidade: parseInt(form.probabilidade) || 50, empresa_id: user?.empresa_id };
    const { error } = editId ? await update(editId, payload) : await insert(payload);
    if (error) setErr(error.message || "Erro ao salvar.");
    else setModal(false);
    setSaving(false);
  };

  const onDrop = async (toEtapa) => {
    if (!dragging || dragging.etapa === toEtapa) { setDragging(null); setDragOver(null); return; }
    await update(dragging.id, { etapa: toEtapa });
    setDragging(null); setDragOver(null);
  };

  // Mover coluna (drag)
  const onColDrop = (toIdx) => {
    if (colDrag === null || colDrag === toIdx) { setColDrag(null); setColDragOver(null); return; }
    const novas = [...etapas];
    const [moved] = novas.splice(colDrag, 1);
    novas.splice(toIdx, 0, moved);
    setEtapas(novas);
    salvarEtapas(novas);
    setColDrag(null); setColDragOver(null);
  };

  const addColuna = async () => {
    if (!colForm.label.trim()) return;
    const slug = colForm.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const novas = [...etapas, { id: slug + "_" + Date.now(), label: colForm.label, cor: colForm.cor }];
    setEtapas(novas);
    await salvarEtapas(novas);
    setColModal(false); setColForm(VAZIO_COL);
  };

  const editColuna = async () => {
    if (!colForm.label.trim() || colEditIdx === null) return;
    const novas = etapas.map((e, i) => i === colEditIdx ? { ...e, label: colForm.label, cor: colForm.cor } : e);
    setEtapas(novas);
    await salvarEtapas(novas);
    setColModal(false); setColEditIdx(null); setColForm(VAZIO_COL);
  };

  const removeColuna = async (idx) => {
    const col = etapas[idx];
    const temDeals = deals.some(d => d.etapa === col.id);
    if (temDeals && !confirm(`A coluna "${col.label}" tem deals. Excluir mesmo assim? Os deals permanecerão no banco.`)) return;
    if (!temDeals && !confirm(`Excluir coluna "${col.label}"?`)) return;
    const novas = etapas.filter((_, i) => i !== idx);
    setEtapas(novas);
    // Remove do banco
    await supabase.from("pipeline_etapas").delete().eq("empresa_id", user.empresa_id).eq("slug", col.id);
    setColModal(false);
  };

  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando PIPELINE...</div>;

  return (
    <Fade>
      {/* Header */}
      <Row between mb={16} style={{flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:L.t3}}>
            Pipeline ativo: <b style={{color:L.teal,fontSize:15,fontFamily:"'Outfit',sans-serif"}}>
              R$ {totalPipeline.toLocaleString("pt-BR",{minimumFractionDigits:2})}
            </b>
          </span>
          <span style={{fontSize:12,color:L.t3}}>
            Fechado: <b style={{color:L.green,fontSize:14,fontFamily:"'Outfit',sans-serif"}}>
              R$ {totalFechado.toLocaleString("pt-BR",{minimumFractionDigits:2})}
            </b>
          </span>
          <span style={{fontSize:12,color:L.t3}}>{deals.filter(d=>d.etapa!=="perdido").length} deals ativos</span>
        </div>
        <Row gap={8}>
          {/* Botão gerenciar colunas */}
          <button
            onClick={() => { setColModal("add"); setColEditIdx(null); setColForm(VAZIO_COL); }}
            style={{padding:"7px 13px",borderRadius:8,fontSize:11.5,fontWeight:500,cursor:"pointer",fontFamily:"inherit",background:L.surface,color:L.t2,border:`1px solid ${L.line}`,transition:"all .12s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=L.teal;e.currentTarget.style.color=L.teal;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t2;}}>
            ⊞ Colunas
          </button>
          <PBtn onClick={()=>openNew()}>+ Novo Deal</PBtn>
        </Row>
      </Row>

      {/* Kanban */}
      <div className="kanban-wrap" style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:12}}>
        {etapas.map((stage, stageIdx) => (
          <div key={stage.id}
            onDragOver={e=>{e.preventDefault();setDragOver(stage.id);setColDragOver(stageIdx);}}
            onDrop={()=>{ if(colDrag!==null) onColDrop(stageIdx); else onDrop(stage.id); }}
            onDragLeave={()=>{setDragOver(null);setColDragOver(null);}}
            style={{minWidth:220,flex:"0 0 220px",background:dragOver===stage.id?L.surface:L.white,borderRadius:12,border:`1.5px solid ${dragOver===stage.id||colDragOver===stageIdx?stage.cor+"55":L.line}`,padding:14,transition:"all .15s",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",opacity:colDrag===stageIdx?.5:1}}
          >
            {/* Cabeçalho coluna */}
            <Row between mb={12}>
              <div
                draggable
                onDragStart={()=>setColDrag(stageIdx)}
                onDragEnd={()=>{setColDrag(null);setColDragOver(null);}}
                style={{cursor:"grab",flex:1}}
                title="Arraste para reordenar a coluna">
                <div style={{fontSize:10,fontWeight:700,color:stage.cor,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace"}}>{stage.label}</div>
                <div style={{fontSize:10,color:L.t4,marginTop:1}}>
                  {byEtapa(stage.id).length} deals · R$ {byEtapa(stage.id).reduce((s,d)=>s+parseFloat(d.valor||0),0).toLocaleString("pt-BR",{maximumFractionDigits:0})}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:stage.cor}}/>
                {/* Botão editar/excluir coluna */}
                <button
                  onClick={()=>{ setColModal("edit"); setColEditIdx(stageIdx); setColForm({label:stage.label,cor:stage.cor}); }}
                  style={{background:"none",border:"none",cursor:"pointer",color:L.t5,fontSize:10,padding:"1px 3px",lineHeight:1}}
                  onMouseEnter={e=>e.currentTarget.style.color=L.teal}
                  onMouseLeave={e=>e.currentTarget.style.color=L.t5}
                  title="Editar coluna">✎</button>
              </div>
            </Row>

            {/* Cards */}
            {byEtapa(stage.id).map(deal => {
              const lead = leads.find(l => l.id === deal.lead_id);
              const tel  = deal.whatsapp_contato || lead?.whatsapp;
              return (
                <div key={deal.id} draggable
                  onDragStart={()=>setDragging(deal)}
                  onDragEnd={()=>setDragging(null)}
                  onClick={()=>openEdit(deal)}
                  style={{background:L.bg,borderRadius:10,border:`1px solid ${L.line}`,padding:12,marginBottom:8,cursor:"grab",transition:"all .15s",boxShadow:"0 1px 2px rgba(0,0,0,0.03)"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=stage.cor+"66";e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 1px 2px rgba(0,0,0,0.03)";}}
                >
                  <div style={{fontSize:12.5,fontWeight:600,color:L.t1,marginBottom:5,lineHeight:1.35}}>{deal.titulo}</div>
                  <div style={{fontSize:16,fontWeight:800,color:stage.cor,fontFamily:"'Outfit',sans-serif",marginBottom:6}}>
                    R$ {parseFloat(deal.valor||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                  </div>
                  {/* Canal de aquisição */}
                  {deal.canal_aquisicao && (
                    <div style={{marginBottom:6}}>
                      <Tag color={L.teal} bg={L.tealBg} small>{deal.canal_aquisicao}</Tag>
                    </div>
                  )}
                  <Row between>
                    <Row gap={5}>
                      <ScBar v={deal.probabilidade||50} w={28} h={3}/>
                      <span style={{fontSize:10,color:L.t4}}>{deal.probabilidade||50}%</span>
                    </Row>
                    <Row gap={4}>
                      {/* Botão WhatsApp direto */}
                      {tel && (
                        <button
                          onClick={e=>{ e.stopPropagation(); window.open(`https://wa.me/55${tel.replace(/\D/g,"")}`,"_blank"); }}
                          title="Abrir WhatsApp"
                          style={{background:L.greenBg,border:`1px solid ${L.green}22`,cursor:"pointer",color:L.green,fontSize:11,padding:"2px 6px",borderRadius:5,transition:"all .1s",fontWeight:700,lineHeight:1}}
                          onMouseEnter={e=>e.currentTarget.style.background=L.green+"33"}
                          onMouseLeave={e=>e.currentTarget.style.background=L.greenBg}>
                          💬
                        </button>
                      )}
                      <button onClick={e=>{e.stopPropagation();if(confirm("Excluir deal?"))remove(deal.id);}}
                        style={{background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:11,padding:"1px 5px",borderRadius:4}}
                        onMouseEnter={e=>e.currentTarget.style.color=L.red}
                        onMouseLeave={e=>e.currentTarget.style.color=L.t4}>⊗</button>
                    </Row>
                  </Row>
                </div>
              );
            })}

            <button onClick={()=>openNew(stage.id)}
              style={{width:"100%",padding:"7px",background:"transparent",border:`1.5px dashed ${L.line}`,borderRadius:9,color:L.t4,fontSize:11,cursor:"pointer",fontFamily:"inherit",transition:"all .12s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=stage.cor;e.currentTarget.style.color=stage.cor;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t4;}}
            >+ Adicionar</button>
          </div>
        ))}

        {/* Botão adicionar coluna inline */}
        <div style={{minWidth:50,display:"flex",alignItems:"flex-start",paddingTop:4}}>
          <button
            onClick={()=>{ setColModal("add"); setColEditIdx(null); setColForm(VAZIO_COL); }}
            style={{padding:"8px 12px",borderRadius:10,background:L.surface,border:`1.5px dashed ${L.line}`,color:L.t4,fontSize:18,cursor:"pointer",transition:"all .12s",lineHeight:1}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=L.teal;e.currentTarget.style.color=L.teal;e.currentTarget.style.background=L.tealBg;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t4;e.currentTarget.style.background=L.surface;}}
            title="Adicionar coluna">+</button>
        </div>
      </div>

      {/* Modal Novo/Editar Deal */}
      {modal && (
        <Modal title={editId ? "Editar Deal" : "Novo Deal"} onClose={()=>setModal(false)} width={500}>
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
                {etapas.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}
              </Select>
            </Field>
            <Field label="Canal de Aquisição">
              <Select value={form.canal_aquisicao||"WhatsApp"} onChange={F("canal_aquisicao")}>
                {CANAIS_AQUISICAO.map(c=><option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Lead vinculado">
              <Select value={form.lead_id||""} onChange={v=>{ F("lead_id")(v); onSelectLead(v); }}>
                <option value="">— Selecionar lead —</option>
                {leads.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}
              </Select>
            </Field>
            <Field label="WhatsApp do contato">
              <Input value={form.whatsapp_contato||""} onChange={F("whatsapp_contato")} placeholder="(11) 99999-9999"/>
            </Field>
          </div>
          <Field label="Observações">
            <textarea value={form.observacoes||""} onChange={e=>F("observacoes")(e.target.value)} rows={2}
              placeholder="Notas sobre o deal..."
              style={{width:"100%",background:L.surface,border:`1.5px solid ${L.line}`,borderRadius:9,padding:"9px 12px",color:L.t1,fontSize:12.5,fontFamily:"inherit",resize:"vertical",outline:"none"}}/>
          </Field>
          {err && <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginBottom:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={save} loading={saving} label={editId?"Salvar":"Criar Deal"}/>
        </Modal>
      )}

      {/* Modal Colunas */}
      {colModal && (
        <Modal title={colModal==="edit" ? "Editar Coluna" : "Nova Coluna"} onClose={()=>{setColModal(false);setColEditIdx(null);}} width={380}>
          {colModal === "edit" && colEditIdx !== null && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:L.t3,marginBottom:10}}>Gerenciar colunas (arraste no board para reordenar)</div>
              {etapas.map((e, i) => (
                <div key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:i===colEditIdx?L.tealBg:L.surface,borderRadius:8,marginBottom:4,border:`1px solid ${i===colEditIdx?L.teal+"44":L.line}`,cursor:"pointer"}} onClick={()=>{setColEditIdx(i);setColForm({label:e.label,cor:e.cor});}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:e.cor,flexShrink:0}}/>
                  <span style={{flex:1,fontSize:12,color:L.t1,fontWeight:i===colEditIdx?600:400}}>{e.label}</span>
                  {etapas.length > 2 && (
                    <button onClick={ev=>{ev.stopPropagation();removeColuna(i);}} style={{background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:12,padding:2}} onMouseEnter={e=>e.currentTarget.style.color=L.red} onMouseLeave={e=>e.currentTarget.style.color=L.t4}>⊗</button>
                  )}
                </div>
              ))}
              <div style={{height:1,background:L.line,margin:"14px 0"}}/>
              <div style={{fontSize:12,fontWeight:600,color:L.t1,marginBottom:10}}>Editar coluna selecionada:</div>
            </div>
          )}
          <Field label="Nome da coluna *">
            <Input value={colForm.label} onChange={v=>setColForm(p=>({...p,label:v}))} placeholder="Ex: Contrato Assinado"/>
          </Field>
          <Field label="Cor">
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {CORES_ETAPA.map(c => (
                <button key={c} onClick={()=>setColForm(p=>({...p,cor:c}))}
                  style={{width:28,height:28,borderRadius:"50%",background:c,border:`2.5px solid ${colForm.cor===c?"#333":"transparent"}`,cursor:"pointer",transition:"all .1s"}}/>
              ))}
            </div>
          </Field>
          {err && <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginBottom:4}}>{err}</div>}
          <ModalFooter
            onClose={()=>{setColModal(false);setColEditIdx(null);}}
            onSave={colModal==="edit" ? editColuna : addColuna}
            loading={false}
            label={colModal==="edit" ? "Salvar Alterações" : "Adicionar Coluna"}
          />
        </Modal>
      )}
    </Fade>
  );
}
