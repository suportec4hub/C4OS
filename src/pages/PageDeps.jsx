import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { Fade, Row, Card, Grid, PBtn, Tag, TT } from "../components/ui";
import Modal, { Field, Input, ModalFooter } from "../components/Modal";
import { logAction } from "../lib/log";

const ICONS = ["◈","◎","⊙","⊞","▦","◷","◉","⬡"];
const CORES = [L.teal, L.copper, L.green, L.blue, L.yellow, L.red];
const CORES_BG = [L.tealBg, L.copperBg, L.greenBg, L.blueBg, L.yellowBg, L.redBg];
const NOVO_VAZIO = { nome:"", descricao:"", meta:"", responsavel:"", cor: L.teal, bg: L.tealBg };

export default function PageDeps({ user }) {
  const { data: deps, loading, insert, update, remove } = useTable("departamentos", { empresa_id: user?.empresa_id });
  const { data: usuarios } = useTable("usuarios", { empresa_id: user?.empresa_id, ativo: true });

  const [expanded,   setExpanded]   = useState(null);
  const [modal,      setModal]      = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState(NOVO_VAZIO);
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState("");

  const toggle = (id) => setExpanded(p => p === id ? null : id);
  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  const openNew = () => { setForm(NOVO_VAZIO); setEditId(null); setErr(""); setModal(true); };
  const openEdit = (d) => { setForm({ nome:d.nome, descricao:d.descricao||"", meta:d.meta||"", responsavel:d.responsavel||"", cor:d.cor||L.teal, bg:d.bg||L.tealBg }); setEditId(d.id); setErr(""); setModal(true); };

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
    await remove(id);
    logAction({ empresa_id: user?.empresa_id, usuario_id: user?.id, usuario_email: user?.email, tipo: "DATA", nivel: "warn", acao: `Departamento excluído: ${nome}` });
  };

  // Membros do departamento = usuarios com cargo relacionado ou responsável pelo dep
  const membrosDepart = (dep) => {
    const resp = dep.responsavel?.toLowerCase() || "";
    return usuarios.filter(u =>
      u.nome?.toLowerCase().includes(resp) ||
      u.cargo?.toLowerCase().includes(dep.nome?.toLowerCase())
    );
  };

  const corIdx = (dep, arr) => {
    const idx = arr.indexOf(dep.cor);
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
              const ico     = ICONS[corIdx(d, CORES) % ICONS.length];

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
                          <div style={{fontSize:11,color:L.t4}}>{membros.length} membro{membros.length !== 1 ? "s" : ""}{d.responsavel ? ` · ${d.responsavel}` : ""}</div>
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
                      {/* Membros */}
                      {membros.length > 0 && (
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:9,fontFamily:"'JetBrains Mono',monospace"}}>Membros da equipe</div>
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {membros.map((m,i) => (
                              <div key={i} style={{background:L.white,borderRadius:8,padding:"9px 12px",border:`1px solid ${L.line}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                                <div>
                                  <div style={{fontSize:12,fontWeight:600,color:L.t1}}>{m.nome}</div>
                                  <div style={{fontSize:10,color:L.t4}}>{m.cargo || "—"}</div>
                                </div>
                                <div style={{textAlign:"right"}}>
                                  <div style={{fontSize:11,color:cor,fontWeight:600}}>{m.conv || "—"}</div>
                                  <div style={{fontSize:10,color:L.t4}}>{m.leads || 0} leads</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

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

      {/* Modal */}
      {modal && (
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
    </Fade>
  );
}
