import { useState, useMemo } from "react";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { Fade, Row, Grid, PBtn, Tag, Av, IBtn, TD } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const PRIO_C   = { baixa:L.green, media:L.yellow, alta:L.copper, critica:L.red };
const PRIO_BG  = { baixa:L.greenBg, media:L.yellowBg, alta:L.copperBg, critica:L.redBg };
const TIPO_C   = { tarefa:L.teal, bug:L.red, feature:L.green, melhoria:L.copper };
const TIPO_BG  = { tarefa:L.tealBg, bug:L.redBg, feature:L.greenBg, melhoria:L.copperBg };
const PROJ_C   = { ativo:L.green, em_pausa:L.yellow, concluido:L.teal, cancelado:L.t4 };
const PROJ_BG  = { ativo:L.greenBg, em_pausa:L.yellowBg, concluido:L.tealBg, cancelado:L.surface };

const COLUNAS = [
  { id:"backlog",     label:"Backlog",       cor:L.t4 },
  { id:"todo",        label:"A Fazer",       cor:L.copper },
  { id:"em_andamento",label:"Em Andamento",  cor:L.teal },
  { id:"revisao",     label:"Em Revisão",    cor:L.yellow },
  { id:"concluido",   label:"Concluído",     cor:L.green },
];

const VAZIO_PROJ = { nome:"", descricao:"", status:"ativo", prioridade:"media", data_inicio:"", data_fim:"", cor:L.teal };
const VAZIO_TASK = { titulo:"", descricao:"", status:"backlog", prioridade:"media", tipo:"tarefa", data_prazo:"", estimativa_horas:"" };

const fmtDate = (d) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : null;

export default function PageDigital({ user }) {
  const { data:projetos, loading:loadP, insert:insP, update:updP, remove:remP, refetch:refP } = useTable("digital_projetos", { empresa_id:user?.empresa_id });
  const { data:tarefas,  loading:loadT, insert:insT, update:updT, remove:remT, refetch:refT } = useTable("digital_tarefas",  { empresa_id:user?.empresa_id });
  const { data:usuarios }                                                                       = useTable("usuarios",          { empresa_id:user?.empresa_id });

  const [projetoAtivo, setProjetoAtivo] = useState(null);
  const [modal,        setModal]        = useState(false); // "projeto" | "tarefa" | false
  const [edit,         setEdit]         = useState(null);
  const [form,         setForm]         = useState(VAZIO_PROJ);
  const [saving,       setSaving]       = useState(false);
  const [err,          setErr]          = useState("");
  const [drag,         setDrag]         = useState(null); // id da tarefa em drag

  const F = k => v => setForm(p=>({...p,[k]:v}));

  const tarefasDoProjeto = tarefas.filter(t => t.projeto_id === projetoAtivo);

  // KPIs
  const projAtivos = projetos.filter(p=>p.status==="ativo").length;
  const emAndamento = tarefas.filter(t=>t.status==="em_andamento").length;
  const bugs       = tarefas.filter(t=>t.tipo==="bug"&&t.status!=="concluido").length;
  const concluidas = tarefas.filter(t=>t.status==="concluido").length;

  const nomeUser = (uid) => usuarios.find(u=>u.id===uid)?.nome || null;

  const openProjeto = (p=null) => {
    setForm(p ? {...p} : VAZIO_PROJ); setEdit(p?.id||null); setErr(""); setModal("projeto");
  };
  const openTarefa = (t=null,status="backlog") => {
    setForm(t ? {...t} : {...VAZIO_TASK, status}); setEdit(t?.id||null); setErr(""); setModal("tarefa");
  };

  const saveProjeto = async () => {
    if (!form.nome.trim()) { setErr("Nome é obrigatório."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, empresa_id:user?.empresa_id };
    const {error} = edit ? await updP(edit,payload) : await insP(payload);
    if (error) setErr(error.message);
    else { setModal(false); refP(); }
    setSaving(false);
  };

  const saveTarefa = async () => {
    if (!form.titulo.trim()) { setErr("Título é obrigatório."); return; }
    if (!projetoAtivo) { setErr("Selecione um projeto primeiro."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, projeto_id:projetoAtivo, empresa_id:user?.empresa_id, estimativa_horas:form.estimativa_horas ? parseFloat(form.estimativa_horas) : null };
    const {error} = edit ? await updT(edit,payload) : await insT(payload);
    if (error) setErr(error.message);
    else { setModal(false); refT(); }
    setSaving(false);
  };

  const moverTarefa = async (tarefaId, novoStatus) => {
    const tarefa = tarefas.find(t=>t.id===tarefaId);
    if (!tarefa || tarefa.status===novoStatus) return;
    await updT(tarefaId, { status:novoStatus });
  };

  const CORES_PROJ = [L.teal, L.copper, L.green, L.blue, L.yellow, L.red];

  return (
    <Fade>
      {/* KPIs */}
      <Grid cols={4} gap={12} mb={16} responsive>
        {[
          {l:"Projetos Ativos",    v:projAtivos,  c:L.teal},
          {l:"Em Andamento",       v:emAndamento, c:L.copper},
          {l:"Bugs em Aberto",     v:bugs,        c:L.red},
          {l:"Tarefas Concluídas", v:concluidas,  c:L.green},
        ].map((k,i)=>(
          <div key={i} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"15px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:9.5,color:L.t4,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:5,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{k.l}</div>
            <div style={{fontSize:28,fontWeight:700,color:k.c,fontFamily:"'Outfit',sans-serif"}}>{k.v}</div>
          </div>
        ))}
      </Grid>

      <div style={{display:"flex",gap:14,minHeight:500}}>
        {/* ── SIDEBAR PROJETOS ── */}
        <div style={{width:230,minWidth:230,display:"flex",flexDirection:"column",gap:8}}>
          <Row between mb={4}>
            <span style={{fontSize:11,fontWeight:600,color:L.t3,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace"}}>Projetos</span>
            <button onClick={()=>openProjeto()}
              style={{background:L.teal,color:"white",border:"none",borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              +
            </button>
          </Row>

          {loadP ? (
            <div style={{textAlign:"center",padding:20,color:L.t4,fontSize:11}}>Carregando...</div>
          ) : projetos.length===0 ? (
            <div style={{textAlign:"center",padding:20,color:L.t4,fontSize:11}}>
              <div style={{fontSize:20,marginBottom:8,opacity:.4}}>⬡</div>
              Nenhum projeto.<br/>Crie o primeiro!
            </div>
          ) : projetos.map(p=>{
            const ativo = projetoAtivo===p.id;
            const qt = tarefas.filter(t=>t.projeto_id===p.id).length;
            const qtDone = tarefas.filter(t=>t.projeto_id===p.id&&t.status==="concluido").length;
            const pct = qt>0 ? Math.round(qtDone/qt*100) : 0;
            return (
              <div key={p.id} onClick={()=>setProjetoAtivo(ativo?null:p.id)}
                style={{padding:"11px 13px",borderRadius:10,cursor:"pointer",background:ativo?L.white:L.surface,border:`1.5px solid ${ativo?(p.cor||L.teal)+"66":L.line}`,transition:"all .15s",boxShadow:ativo?"0 2px 8px rgba(0,0,0,0.06)":"none"}}
                onMouseEnter={e=>{if(!ativo)e.currentTarget.style.background=L.hover;}}
                onMouseLeave={e=>{if(!ativo)e.currentTarget.style.background=L.surface;}}
              >
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:p.cor||L.teal,flexShrink:0}}/>
                    <div style={{fontSize:12,fontWeight:ativo?600:400,color:ativo?L.t1:L.t2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:130}}>{p.nome}</div>
                  </div>
                  <div style={{display:"flex",gap:4}}>
                    <button onClick={e=>{e.stopPropagation();openProjeto(p);}}
                      style={{background:"none",border:"none",cursor:"pointer",color:L.t5,fontSize:11,padding:2,transition:"color .1s"}}
                      onMouseEnter={e=>e.currentTarget.style.color=L.teal}
                      onMouseLeave={e=>e.currentTarget.style.color=L.t5}>✎</button>
                    <button onClick={e=>{e.stopPropagation();if(confirm("Excluir projeto?"))remP(p.id);}}
                      style={{background:"none",border:"none",cursor:"pointer",color:L.t5,fontSize:11,padding:2,transition:"color .1s"}}
                      onMouseEnter={e=>e.currentTarget.style.color=L.red}
                      onMouseLeave={e=>e.currentTarget.style.color=L.t5}>⊗</button>
                  </div>
                </div>
                <Tag color={PROJ_C[p.status]||L.t4} bg={PROJ_BG[p.status]||L.surface}>{p.status.replace("_"," ")}</Tag>
                {p.prioridade==="critica"&&<Tag color={L.red} bg={L.redBg} style={{marginLeft:4}}>🔴 crítica</Tag>}
                {qt > 0 && (
                  <div style={{marginTop:7}}>
                    <div style={{height:3,borderRadius:4,background:L.lineSoft,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${pct}%`,background:p.cor||L.teal,borderRadius:4,transition:"width .3s"}}/>
                    </div>
                    <div style={{fontSize:9.5,color:L.t4,marginTop:3,fontFamily:"'JetBrains Mono',monospace"}}>{qtDone}/{qt} tarefas · {pct}%</div>
                  </div>
                )}
                {p.data_fim&&<div style={{fontSize:9.5,color:L.t5,marginTop:4}}>Prazo: {fmtDate(p.data_fim)}</div>}
              </div>
            );
          })}
        </div>

        {/* ── BOARD KANBAN ── */}
        <div style={{flex:1,minWidth:0}}>
          {!projetoAtivo ? (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",background:L.white,borderRadius:12,border:`1px solid ${L.line}`,flexDirection:"column",gap:12,color:L.t4,padding:40}}>
              <div style={{fontSize:32,opacity:.3}}>⊞</div>
              <div style={{fontSize:13,fontWeight:500}}>Selecione um projeto para ver o board</div>
              <div style={{fontSize:11}}>ou crie um novo projeto à esquerda</div>
            </div>
          ) : (
            <>
              <Row between mb={10}>
                <div>
                  <span style={{fontSize:13,fontWeight:700,color:L.t1}}>{projetos.find(p=>p.id===projetoAtivo)?.nome}</span>
                  <span style={{fontSize:11,color:L.t4,marginLeft:8}}>{tarefasDoProjeto.length} tarefa{tarefasDoProjeto.length!==1?"s":""}</span>
                </div>
                <PBtn onClick={()=>openTarefa()}>+ Tarefa</PBtn>
              </Row>
              <div className="kanban-wrap" style={{display:"flex",gap:10,alignItems:"flex-start",minHeight:400}}>
                {COLUNAS.map(col=>{
                  const colTarefas = tarefasDoProjeto.filter(t=>t.status===col.id);
                  return (
                    <div key={col.id}
                      style={{minWidth:200,width:200,flexShrink:0,background:L.surface,borderRadius:10,overflow:"hidden",border:`1px solid ${L.line}`}}
                      onDragOver={e=>e.preventDefault()}
                      onDrop={e=>{ e.preventDefault(); if(drag)moverTarefa(drag,col.id); setDrag(null); }}
                    >
                      {/* Coluna header */}
                      <div style={{padding:"9px 12px",borderBottom:`1px solid ${L.line}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:L.white}}>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:col.cor}}/>
                          <span style={{fontSize:11,fontWeight:600,color:L.t2}}>{col.label}</span>
                        </div>
                        <span style={{fontSize:10,fontWeight:600,color:L.t4,fontFamily:"'JetBrains Mono',monospace"}}>{colTarefas.length}</span>
                      </div>

                      {/* Cards */}
                      <div style={{padding:8,display:"flex",flexDirection:"column",gap:6,minHeight:60}}>
                        {colTarefas.map(t=>(
                          <div key={t.id} draggable
                            onDragStart={()=>setDrag(t.id)}
                            onDragEnd={()=>setDrag(null)}
                            style={{background:L.white,borderRadius:8,padding:"10px 11px",border:`1px solid ${L.line}`,cursor:"grab",boxShadow:"0 1px 3px rgba(0,0,0,0.05)",transition:"box-shadow .1s",opacity:drag===t.id?.5:1}}
                            onMouseEnter={e=>e.currentTarget.style.boxShadow="0 3px 10px rgba(0,0,0,0.1)"}
                            onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.05)"}
                          >
                            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6}}>
                              <div style={{fontSize:11.5,fontWeight:500,color:L.t1,lineHeight:1.4,flex:1,marginRight:4}}>{t.titulo}</div>
                              <div style={{display:"flex",gap:3,flexShrink:0}}>
                                <button onClick={()=>openTarefa(t)}
                                  style={{background:"none",border:"none",cursor:"pointer",color:L.t5,fontSize:10,padding:1}}
                                  onMouseEnter={e=>e.currentTarget.style.color=L.teal}
                                  onMouseLeave={e=>e.currentTarget.style.color=L.t5}>✎</button>
                                <button onClick={()=>{if(confirm("Excluir?"))remT(t.id);}}
                                  style={{background:"none",border:"none",cursor:"pointer",color:L.t5,fontSize:10,padding:1}}
                                  onMouseEnter={e=>e.currentTarget.style.color=L.red}
                                  onMouseLeave={e=>e.currentTarget.style.color=L.t5}>⊗</button>
                              </div>
                            </div>
                            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:t.data_prazo||nomeUser(t.responsavel_id)?5:0}}>
                              <Tag color={TIPO_C[t.tipo]||L.teal} bg={TIPO_BG[t.tipo]||L.tealBg} small>{t.tipo}</Tag>
                              <Tag color={PRIO_C[t.prioridade]||L.yellow} bg={PRIO_BG[t.prioridade]||L.yellowBg} small>{t.prioridade}</Tag>
                            </div>
                            {(t.data_prazo||nomeUser(t.responsavel_id))&&(
                              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:4}}>
                                {t.data_prazo&&<span style={{fontSize:9.5,color:L.t4,fontFamily:"'JetBrains Mono',monospace"}}>{fmtDate(t.data_prazo)}</span>}
                                {nomeUser(t.responsavel_id)&&<Av name={nomeUser(t.responsavel_id)} size={18} color={L.copper}/>}
                              </div>
                            )}
                            {t.estimativa_horas&&<div style={{fontSize:9.5,color:L.t5,marginTop:3}}>⏱ {t.estimativa_horas}h</div>}
                          </div>
                        ))}
                        {/* Adicionar rápido */}
                        <button onClick={()=>openTarefa(null,col.id)}
                          style={{width:"100%",padding:"7px",borderRadius:7,fontSize:11,color:L.t5,border:`1.5px dashed ${L.line}`,background:"transparent",cursor:"pointer",fontFamily:"inherit",transition:"all .12s"}}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor=L.teal;e.currentTarget.style.color=L.teal;e.currentTarget.style.background=L.tealBg;}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t5;e.currentTarget.style.background="transparent";}}>
                          + Adicionar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Projeto */}
      {modal==="projeto"&&(
        <Modal title={edit?"Editar Projeto":"Novo Projeto"} onClose={()=>setModal(false)} width={480}>
          <Field label="Nome do Projeto *"><Input value={form.nome} onChange={F("nome")} placeholder="Ex: Site Redesign 2025"/></Field>
          <Field label="Descrição"><Input value={form.descricao||""} onChange={F("descricao")} placeholder="Objetivo do projeto..."/></Field>
          <div className="form-grid">
            <Field label="Status">
              <Select value={form.status} onChange={F("status")}>
                {["ativo","em_pausa","concluido","cancelado"].map(s=><option key={s} value={s}>{s.replace("_"," ")}</option>)}
              </Select>
            </Field>
            <Field label="Prioridade">
              <Select value={form.prioridade} onChange={F("prioridade")}>
                {["baixa","media","alta","critica"].map(s=><option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Data Início">
              <Input value={form.data_inicio||""} onChange={F("data_inicio")} type="date"/>
            </Field>
            <Field label="Data Prazo">
              <Input value={form.data_fim||""} onChange={F("data_fim")} type="date"/>
            </Field>
          </div>
          <Field label="Cor do Projeto">
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {CORES_PROJ.map(c=>(
                <button key={c} onClick={()=>setForm(p=>({...p,cor:c}))}
                  style={{width:28,height:28,borderRadius:8,background:c,border:form.cor===c?`3px solid ${L.t1}`:`2px solid transparent`,cursor:"pointer",transition:"all .1s"}}/>
              ))}
            </div>
          </Field>
          {err&&<div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginTop:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={saveProjeto} loading={saving} label={edit?"Salvar":"Criar Projeto"}/>
        </Modal>
      )}

      {/* Modal Tarefa */}
      {modal==="tarefa"&&(
        <Modal title={edit?"Editar Tarefa":"Nova Tarefa"} onClose={()=>setModal(false)} width={480}>
          <Field label="Título *"><Input value={form.titulo} onChange={F("titulo")} placeholder="Descreva a tarefa..."/></Field>
          <Field label="Descrição"><Input value={form.descricao||""} onChange={F("descricao")} placeholder="Detalhes, critérios de aceite..."/></Field>
          <div className="form-grid">
            <Field label="Status">
              <Select value={form.status} onChange={F("status")}>
                {COLUNAS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="Tipo">
              <Select value={form.tipo} onChange={F("tipo")}>
                {["tarefa","bug","feature","melhoria"].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Prioridade">
              <Select value={form.prioridade} onChange={F("prioridade")}>
                {["baixa","media","alta","critica"].map(p=><option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Responsável">
              <Select value={form.responsavel_id||""} onChange={F("responsavel_id")}>
                <option value="">Sem responsável</option>
                {usuarios.filter(u=>u.ativo).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
              </Select>
            </Field>
            <Field label="Data Prazo">
              <Input value={form.data_prazo||""} onChange={F("data_prazo")} type="date"/>
            </Field>
            <Field label="Estimativa (horas)">
              <Input value={form.estimativa_horas||""} onChange={F("estimativa_horas")} type="number" placeholder="0.0" step="0.5"/>
            </Field>
          </div>
          {err&&<div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginTop:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={saveTarefa} loading={saving} label={edit?"Salvar":"Criar Tarefa"}/>
        </Modal>
      )}
    </Fade>
  );
}
