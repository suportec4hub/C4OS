import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { Fade, Row, Card, Grid, PBtn, Tag, TT, Av } from "../components/ui";
import Modal, { Field, Input, ModalFooter } from "../components/Modal";
import { logAction } from "../lib/log";

const ICONS = ["◈","◎","⊙","⊞","▦","◷","◉","⬡"];
const CORES = [L.teal, L.copper, L.green, L.blue, L.yellow, L.red];
const CORES_BG = [L.tealBg, L.copperBg, L.greenBg, L.blueBg, L.yellowBg, L.redBg];
const NOVO_VAZIO = { nome:"", descricao:"", meta:"", responsavel:"", cor: L.teal, bg: L.tealBg };

export default function PageDeps({ user }) {
  const { data: deps, loading, insert, update, remove } = useTable("departamentos", { empresa_id: user?.empresa_id });
  const { data: usuarios, refetch: refetchUsuarios } = useTable("usuarios", { empresa_id: user?.empresa_id, ativo: true });

  const [expanded,    setExpanded]    = useState(null);
  const [modal,       setModal]       = useState(false);   // "form" | "membros"
  const [editId,      setEditId]      = useState(null);
  const [form,        setForm]        = useState(NOVO_VAZIO);
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState("");
  const [membrosModal,setMembrosModal] = useState(null);   // dep selecionado p/ gerenciar
  const [savingMembro,setSavingMembro] = useState(false);

  const toggle = (id) => setExpanded(p => p === id ? null : id);
  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  const openNew  = () => { setForm(NOVO_VAZIO); setEditId(null); setErr(""); setModal("form"); };
  const openEdit = (d) => {
    setForm({ nome:d.nome, descricao:d.descricao||"", meta:d.meta||"", responsavel:d.responsavel||"", cor:d.cor||L.teal, bg:d.bg||L.tealBg });
    setEditId(d.id); setErr(""); setModal("form");
  };

  const save = async () => {
    if (!form.nome.trim()) { setErr("Nome é obrigatório."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, nome: form.nome.trim(), empresa_id: user?.empresa_id };
    const { error } = editId ? await update(editId, payload) : await insert(payload);
    if (error) { setErr(error.message || "Erro ao salvar."); setSaving(false); return; }
    logAction({ empresa_id: user?.empresa_id, usuario_id: user?.id, usuario_email: user?.email, tipo: "DATA", nivel: "info", acao: editId ? `Departamento editado: ${form.nome}` : `Departamento criado: ${form.nome}` });
    setModal(false); setSaving(false);
  };

  const del = async (id, nome) => {
    if (!confirm(`Excluir departamento "${nome}"?`)) return;
    // Remove membros do departamento antes de excluir
    await supabase.from("usuarios").update({ departamento_id: null }).eq("departamento_id", id);
    await remove(id);
    logAction({ empresa_id: user?.empresa_id, usuario_id: user?.id, usuario_email: user?.email, tipo: "DATA", nivel: "warn", acao: `Departamento excluído: ${nome}` });
  };

  // Membros = usuarios com departamento_id = dep.id
  const membrosDepart = (dep) => usuarios.filter(u => u.departamento_id === dep.id);

  // Adicionar membro ao departamento
  const adicionarMembro = async (userId) => {
    setSavingMembro(true);
    await supabase.from("usuarios").update({ departamento_id: membrosModal.id }).eq("id", userId);
    await refetchUsuarios();
    setSavingMembro(false);
  };

  // Remover membro do departamento
  const removerMembro = async (userId) => {
    setSavingMembro(true);
    await supabase.from("usuarios").update({ departamento_id: null }).eq("id", userId);
    await refetchUsuarios();
    setSavingMembro(false);
  };

  const corIdx = (dep) => {
    const idx = CORES.indexOf(dep.cor);
    return idx >= 0 ? idx : 0;
  };

  return (
    <Fade>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:14}}>
        <span style={{fontSize:12,color:L.t3}}>{deps.length} departamento{deps.length !== 1 ? "s" : ""}</span>
        <PBtn onClick={openNew}>+ Novo</PBtn>
      </div>

      {loading ? (
        <div style={{textAlign:"center",padding:60,color:L.t4}}>
          <div style={{fontSize:24,marginBottom:10}}>⊙</div>
          <div>Carregando departamentos...</div>
        </div>
      ) : deps.length === 0 ? (
        <div style={{textAlign:"center",padding:60,color:L.t3}}>
          <div style={{fontSize:32,marginBottom:12}}>⬡</div>
          <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>Nenhum departamento ainda</div>
          <div style={{fontSize:12,color:L.t4,marginBottom:20}}>Crie departamentos para organizar sua equipe</div>
          <PBtn onClick={openNew}>+ Criar Departamento</PBtn>
        </div>
      ) : (
        <>
          <Grid cols={2} gap={12} mb={14} responsive>
            {deps.map((d) => {
              const open    = expanded === d.id;
              const cor     = d.cor || L.teal;
              const bg      = d.bg  || L.tealBg;
              const membros = membrosDepart(d);
              const ico     = ICONS[corIdx(d) % ICONS.length];

              return (
                <div key={d.id} style={{background:L.white,borderRadius:12,border:`1.5px solid ${open ? cor+"66" : L.line}`,overflow:"hidden",transition:"border-color .2s",boxShadow:open?"0 4px 16px rgba(0,0,0,0.07)":"0 1px 3px rgba(0,0,0,0.04)"}}>
                  {/* Header */}
                  <div style={{padding:20,cursor:"pointer"}} onClick={()=>toggle(d.id)}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:38,height:38,borderRadius:10,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,color:cor,fontWeight:700}}>
                          {ico}
                        </div>
                        <div>
                          <div style={{fontSize:14,fontWeight:600,color:L.t1}}>{d.nome}</div>
                          <div style={{fontSize:11,color:L.t4}}>
                            {membros.length} membro{membros.length !== 1 ? "s" : ""}
                            {d.responsavel ? ` · ${d.responsavel}` : ""}
                          </div>
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {d.meta && <Tag color={cor} bg={bg} small>{d.meta}</Tag>}
                        <span style={{fontSize:14,color:open?cor:L.t4,transition:"color .2s"}}>{open?"▲":"▼"}</span>
                      </div>
                    </div>
                    {d.descricao && (
                      <div style={{fontSize:11.5,color:L.t3,lineHeight:1.5}}>{d.descricao}</div>
                    )}
                  </div>

                  {/* Expandido */}
                  {open && (
                    <div style={{borderTop:`1px solid ${L.line}`,background:L.surface,padding:20}}>
                      {/* Lista de membros */}
                      <div style={{marginBottom:14}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}>
                          <div style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace"}}>
                            Membros ({membros.length})
                          </div>
                          <button onClick={()=>setMembrosModal(d)}
                            style={{fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:bg,color:cor,border:`1px solid ${cor}33`,borderRadius:6,padding:"3px 10px",transition:"all .12s"}}
                            onMouseEnter={e=>e.currentTarget.style.filter="brightness(.95)"}
                            onMouseLeave={e=>e.currentTarget.style.filter="none"}
                          >+ Gerenciar</button>
                        </div>

                        {membros.length === 0 ? (
                          <div style={{textAlign:"center",padding:"14px 0",color:L.t4,fontSize:11}}>
                            Nenhum membro — clique em Gerenciar para adicionar
                          </div>
                        ) : (
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {membros.map((m) => (
                              <div key={m.id} style={{background:L.white,borderRadius:8,padding:"9px 12px",border:`1px solid ${L.line}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <Av name={m.nome} color={cor} size={26}/>
                                  <div>
                                    <div style={{fontSize:12,fontWeight:600,color:L.t1}}>{m.nome}</div>
                                    <div style={{fontSize:10,color:L.t4}}>{m.cargo || "—"}</div>
                                  </div>
                                </div>
                                <button onClick={()=>removerMembro(m.id)} title="Remover do departamento"
                                  style={{background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:13,padding:4,transition:"color .1s"}}
                                  onMouseEnter={e=>e.currentTarget.style.color=L.red}
                                  onMouseLeave={e=>e.currentTarget.style.color=L.t4}
                                >⊗</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Ações */}
                      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                        <button onClick={()=>openEdit(d)}
                          style={{padding:"6px 14px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.tealBg,color:L.teal,border:`1px solid ${L.teal}22`,transition:"all .12s"}}
                          onMouseEnter={e=>e.currentTarget.style.filter="brightness(.96)"}
                          onMouseLeave={e=>e.currentTarget.style.filter="none"}
                        >✎ Editar</button>
                        <button onClick={()=>del(d.id, d.nome)}
                          style={{padding:"6px 14px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.redBg,color:L.red,border:`1px solid ${L.red}22`,transition:"all .12s"}}
                          onMouseEnter={e=>e.currentTarget.style.filter="brightness(.96)"}
                          onMouseLeave={e=>e.currentTarget.style.filter="none"}
                        >⊗ Excluir</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Grid>

          {/* Chart geral */}
          <Card title="Departamentos" sub="membros por departamento">
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={deps.map(d => ({ name: d.nome, membros: membrosDepart(d).length, cor: d.cor || L.teal }))}>
                <CartesianGrid strokeDasharray="4 4" stroke={L.lineSoft} vertical={false}/>
                <XAxis dataKey="name" tick={{fill:L.t4,fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false} allowDecimals={false}/>
                <Tooltip contentStyle={TT} formatter={v=>[v,"membros"]}/>
                <Bar dataKey="membros" radius={[6,6,0,0]}>
                  {deps.map((d,i) => <Cell key={i} fill={d.cor || L.teal}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {/* Modal — Form departamento */}
      {modal === "form" && (
        <Modal title={editId ? "Editar Departamento" : "Novo Departamento"} onClose={()=>setModal(false)} width={440}>
          <Field label="Nome *"><Input value={form.nome} onChange={F("nome")} placeholder="Ex: Customer Success"/></Field>
          <Field label="Descrição"><Input value={form.descricao} onChange={F("descricao")} placeholder="Objetivo do departamento"/></Field>
          <div className="form-grid">
            <Field label="Meta"><Input value={form.meta} onChange={F("meta")} placeholder="Ex: R$50.000 ou NPS 80"/></Field>
            <Field label="Responsável"><Input value={form.responsavel} onChange={F("responsavel")} placeholder="Nome do líder"/></Field>
          </div>
          <Field label="Cor">
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {CORES.map((c, i) => (
                <button key={c} onClick={()=>setForm(p=>({...p,cor:c,bg:CORES_BG[i]}))}
                  style={{width:28,height:28,borderRadius:8,background:c,border:form.cor===c?`3px solid ${L.t1}`:`2px solid transparent`,cursor:"pointer",transition:"all .1s"}}
                />
              ))}
            </div>
          </Field>
          {err && <div style={{padding:"8px 12px",background:L.redBg,border:`1px solid ${L.red}22`,borderRadius:8,fontSize:12,color:L.red,marginBottom:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={save} loading={saving} label={editId?"Salvar Alterações":"Criar Departamento"}/>
        </Modal>
      )}

      {/* Modal — Gerenciar membros */}
      {membrosModal && (
        <Modal title={`Membros — ${membrosModal.nome}`} onClose={()=>setMembrosModal(null)} width={460}>
          <div style={{marginBottom:12,fontSize:11,color:L.t3}}>
            Selecione quais membros da equipe pertencem a este departamento.
          </div>

          {/* Membros já no dept */}
          {membrosDepart(membrosModal).length > 0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>
                No departamento
              </div>
              {membrosDepart(membrosModal).map(m => (
                <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",borderRadius:8,background:L.greenBg,border:`1px solid ${L.green}22`,marginBottom:5}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <Av name={m.nome} color={membrosModal.cor||L.teal} size={26}/>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:L.t1}}>{m.nome}</div>
                      <div style={{fontSize:10,color:L.t4}}>{m.cargo||"—"}</div>
                    </div>
                  </div>
                  <button onClick={()=>removerMembro(m.id)} disabled={savingMembro}
                    style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.redBg,color:L.red,border:`1px solid ${L.red}22`}}>
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Usuários disponíveis */}
          {(() => {
            const disponiveis = usuarios.filter(u => u.departamento_id !== membrosModal.id);
            if (disponiveis.length === 0) return (
              <div style={{textAlign:"center",padding:16,color:L.t4,fontSize:12}}>
                Todos os membros já estão neste departamento.
              </div>
            );
            return (
              <div>
                <div style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>
                  Adicionar da equipe
                </div>
                <div style={{maxHeight:240,overflowY:"auto",display:"flex",flexDirection:"column",gap:5}}>
                  {disponiveis.map(m => (
                    <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",borderRadius:8,background:L.surface,border:`1px solid ${L.line}`,transition:"background .1s"}}
                      onMouseEnter={e=>e.currentTarget.style.background=L.hover}
                      onMouseLeave={e=>e.currentTarget.style.background=L.surface}
                    >
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <Av name={m.nome} color={L.copper} size={26}/>
                        <div>
                          <div style={{fontSize:12,fontWeight:500,color:L.t1}}>{m.nome}</div>
                          <div style={{fontSize:10,color:L.t4}}>
                            {m.cargo||"Sem cargo"}
                            {m.departamento_id ? ` · já em outro dept.` : ""}
                          </div>
                        </div>
                      </div>
                      <button onClick={()=>adicionarMembro(m.id)} disabled={savingMembro}
                        style={{padding:"4px 12px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.tealBg,color:L.teal,border:`1px solid ${L.teal}22`}}>
                        + Adicionar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
            <button onClick={()=>setMembrosModal(null)}
              style={{padding:"8px 20px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.teal,color:"white",border:"none"}}>
              Concluir
            </button>
          </div>
        </Modal>
      )}
    </Fade>
  );
}
