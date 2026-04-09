import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { Fade, Row, Grid, TabPills, PBtn, DataTable, Tag, Av, IBtn, TD, Card, TT } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const TIPO_LABEL = { ferias:"Férias", afastamento:"Afastamento", licenca:"Licença", folga:"Day Off", homeoffice:"Home Office" };
const STATUS_C   = { solicitado:L.yellow, aprovado:L.green, rejeitado:L.red, em_andamento:L.teal, concluido:L.t4 };
const STATUS_BG  = { solicitado:L.yellowBg, aprovado:L.greenBg, rejeitado:L.redBg, em_andamento:L.tealBg, concluido:L.surface };

const VAZIO_FERIAS = { usuario_id:"", tipo:"ferias", data_inicio:"", data_fim:"", status:"solicitado", observacao:"" };

const fmtDate = (d) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : "—";
const diasEntre = (ini, fim) => {
  if (!ini||!fim) return 0;
  return Math.round((new Date(fim)-new Date(ini))/(1000*60*60*24))+1;
};

export default function PageRH({ user }) {
  const { data: colaboradores, loading: loadCo } = useTable("usuarios", { empresa_id:user?.empresa_id });
  const { data: ferias, loading:loadFer, insert:insFerias, update:updFerias, remove:remFerias, refetch:refFer } = useTable("rh_ferias", { empresa_id:user?.empresa_id });

  const [aba,    setAba]    = useState("Colaboradores");
  const [modal,  setModal]  = useState(false);
  const [edit,   setEdit]   = useState(null);
  const [form,   setForm]   = useState(VAZIO_FERIAS);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const F = k => v => setForm(p=>({...p,[k]:v}));
  const hoje = new Date().toISOString().split("T")[0];

  // KPIs
  const ativos    = colaboradores.filter(c=>c.ativo).length;
  const inativos  = colaboradores.filter(c=>!c.ativo).length;
  const emFerias  = ferias.filter(f=>f.status==="em_andamento"||
    (f.status==="aprovado"&&f.data_inicio<=hoje&&f.data_fim>=hoje)).length;
  const pendentes = ferias.filter(f=>f.status==="solicitado").length;

  // Cargo distribution
  const cargos = {};
  colaboradores.filter(c=>c.ativo).forEach(c=>{
    const g = c.cargo||"Sem cargo";
    cargos[g] = (cargos[g]||0)+1;
  });
  const pieData = Object.entries(cargos).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value])=>({name,value}));
  const PIE_COLORS = [L.teal,L.copper,L.green,L.yellow,L.red,L.blue];

  const nomeUser = (uid) => colaboradores.find(c=>c.id===uid)?.nome || "—";

  const openNew  = () => { setForm(VAZIO_FERIAS); setEdit(null); setErr(""); setModal(true); };
  const openEdit = (f) => { setForm({...f}); setEdit(f.id); setErr(""); setModal(true); };

  const save = async () => {
    if (!form.usuario_id) { setErr("Selecione o colaborador."); return; }
    if (!form.data_inicio||!form.data_fim) { setErr("Datas obrigatórias."); return; }
    if (form.data_fim < form.data_inicio) { setErr("Data fim deve ser após data início."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, empresa_id:user?.empresa_id };
    const {error} = edit ? await updFerias(edit,payload) : await insFerias(payload);
    if (error) setErr(error.message||"Erro ao salvar.");
    else { setModal(false); refFer(); }
    setSaving(false);
  };

  const aprovar  = async (f) => { await updFerias(f.id,{status:"aprovado"}); };
  const rejeitar = async (f) => { await updFerias(f.id,{status:"rejeitado"}); };

  return (
    <Fade>
      {/* KPIs */}
      <Grid cols={4} gap={12} mb={16} responsive>
        {[
          {l:"Colaboradores Ativos",   v:ativos,   c:L.green},
          {l:"Inativos",               v:inativos, c:L.t4},
          {l:"Em Férias / Afastamento",v:emFerias, c:L.teal},
          {l:"Pendentes de Aprovação", v:pendentes,c:L.yellow},
        ].map((k,i)=>(
          <div key={i} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"15px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:9.5,color:L.t4,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:5,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{k.l}</div>
            <div style={{fontSize:28,fontWeight:700,color:k.c,fontFamily:"'Outfit',sans-serif"}}>{k.v}</div>
          </div>
        ))}
      </Grid>

      {/* Charts */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:12,marginBottom:16}} className="rg-auto">
        <Card title="Distribuição por Cargo" sub="colaboradores ativos">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} dataKey="value" paddingAngle={2}>
                  {pieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%6]}/>)}
                </Pie>
                <Tooltip contentStyle={TT} formatter={v=>[`${v} pessoa${v!==1?"s":""}`]}/>
                <Legend iconSize={8} iconType="circle" wrapperStyle={{fontSize:10,color:L.t3}}/>
              </PieChart>
            </ResponsiveContainer>
          ):(
            <div style={{textAlign:"center",padding:40,color:L.t4,fontSize:11}}>Nenhum colaborador cadastrado</div>
          )}
        </Card>
        <Card title="Resumo RH" sub="visão geral">
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {l:"Total headcount",   v:colaboradores.length},
              {l:"Ativos",            v:ativos},
              {l:"Admitidos (período)",v:colaboradores.filter(c=>{const d=c.created_at?.slice(0,7);const now=new Date();const key=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;return d===key;}).length},
              {l:"Férias este mês",   v:ferias.filter(f=>{const now=new Date();const key=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;return (f.data_inicio||"").startsWith(key);}).length},
            ].map((r,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${L.lineSoft}`}}>
                <span style={{fontSize:11,color:L.t3}}>{r.l}</span>
                <span style={{fontSize:13,fontWeight:600,color:L.t1}}>{r.v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Row between mb={12}>
        <TabPills tabs={["Colaboradores","Férias & Afastamentos"]} active={aba} onChange={setAba}/>
        {aba==="Férias & Afastamentos"&&<PBtn onClick={openNew}>+ Registrar</PBtn>}
      </Row>

      {/* Tab: Colaboradores */}
      {aba==="Colaboradores"&&(
        loadCo ? <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando...</div> : (
          <DataTable heads={["Colaborador","Cargo","Setor","WhatsApp","Admissão","Status"]}>
            {colaboradores.map(c=>(
              <tr key={c.id} style={{borderBottom:`1px solid ${L.lineSoft}`}}
                onMouseEnter={e=>e.currentTarget.style.background=L.surface}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={TD}>
                  <Row gap={9}>
                    <Av name={c.nome} size={28} color={c.ativo?L.teal:L.t4}/>
                    <div>
                      <div style={{fontSize:12.5,fontWeight:500,color:L.t1}}>{c.nome}</div>
                      <div style={{fontSize:10,color:L.t4}}>{c.email||"—"}</div>
                    </div>
                  </Row>
                </td>
                <td style={{...TD,color:L.t2,fontSize:12}}>{c.cargo||"—"}</td>
                <td style={{...TD,color:L.t3,fontSize:11}}>{c.departamento||"—"}</td>
                <td style={{...TD,color:L.t3,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{c.whatsapp||"—"}</td>
                <td style={{...TD,fontSize:11,color:L.t4,fontFamily:"'JetBrains Mono',monospace"}}>{fmtDate(c.created_at?.split("T")[0])}</td>
                <td style={TD}><Tag color={c.ativo?L.green:L.red} bg={c.ativo?L.greenBg:L.redBg}>{c.ativo?"Ativo":"Inativo"}</Tag></td>
              </tr>
            ))}
            {colaboradores.length===0&&<tr><td colSpan={6} style={{...TD,textAlign:"center",color:L.t4,padding:40}}>Nenhum colaborador cadastrado.</td></tr>}
          </DataTable>
        )
      )}

      {/* Tab: Férias */}
      {aba==="Férias & Afastamentos"&&(
        loadFer ? <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando...</div> : (
          <DataTable heads={["Colaborador","Tipo","Início","Fim","Dias","Status","Ações"]}>
            {ferias.map(f=>{
              const dias = diasEntre(f.data_inicio,f.data_fim);
              return (
                <tr key={f.id} style={{borderBottom:`1px solid ${L.lineSoft}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=L.surface}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{...TD,fontWeight:500,color:L.t1}}>{nomeUser(f.usuario_id)}</td>
                  <td style={TD}><Tag color={L.teal} bg={L.tealBg}>{TIPO_LABEL[f.tipo]||f.tipo}</Tag></td>
                  <td style={{...TD,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{fmtDate(f.data_inicio)}</td>
                  <td style={{...TD,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{fmtDate(f.data_fim)}</td>
                  <td style={{...TD,textAlign:"center",fontWeight:600,color:L.t1}}>{dias}</td>
                  <td style={TD}><Tag color={STATUS_C[f.status]||L.t4} bg={STATUS_BG[f.status]||L.surface}>{f.status.replace("_"," ")}</Tag></td>
                  <td style={TD}>
                    <Row gap={4}>
                      {f.status==="solicitado"&&<IBtn c={L.green} onClick={()=>aprovar(f)} title="Aprovar">✓</IBtn>}
                      {f.status==="solicitado"&&<IBtn c={L.red}   onClick={()=>rejeitar(f)} title="Rejeitar">✕</IBtn>}
                      <IBtn c={L.teal} onClick={()=>openEdit(f)}>✎</IBtn>
                      <IBtn c={L.red}  onClick={()=>{if(confirm("Excluir registro?"))remFerias(f.id);}}>⊗</IBtn>
                    </Row>
                  </td>
                </tr>
              );
            })}
            {ferias.length===0&&<tr><td colSpan={7} style={{...TD,textAlign:"center",color:L.t4,padding:40}}>Nenhum registro. Clique em '+ Registrar' para adicionar.</td></tr>}
          </DataTable>
        )
      )}

      {modal&&(
        <Modal title={edit?"Editar Registro":"Novo Registro de Férias / Afastamento"} onClose={()=>setModal(false)} width={480}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
            <Field label="Colaborador *" style={{gridColumn:"1/-1"}}>
              <Select value={form.usuario_id} onChange={F("usuario_id")}>
                <option value="">Selecionar colaborador...</option>
                {colaboradores.filter(c=>c.ativo).map(c=><option key={c.id} value={c.id}>{c.nome} — {c.cargo||"Sem cargo"}</option>)}
              </Select>
            </Field>
            <Field label="Tipo">
              <Select value={form.tipo} onChange={F("tipo")}>
                {Object.entries(TIPO_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={F("status")}>
                {["solicitado","aprovado","rejeitado","em_andamento","concluido"].map(s=><option key={s} value={s}>{s.replace("_"," ")}</option>)}
              </Select>
            </Field>
            <Field label="Data Início *">
              <Input value={form.data_inicio||""} onChange={F("data_inicio")} type="date"/>
            </Field>
            <Field label="Data Fim *">
              <Input value={form.data_fim||""} onChange={F("data_fim")} type="date"/>
            </Field>
            {form.data_inicio&&form.data_fim&&form.data_fim>=form.data_inicio&&(
              <div style={{gridColumn:"1/-1",padding:"8px 12px",background:L.tealBg,borderRadius:8,fontSize:12,color:L.teal,marginBottom:4}}>
                Duração: {diasEntre(form.data_inicio,form.data_fim)} dia(s) corridos
              </div>
            )}
            <Field label="Observação" style={{gridColumn:"1/-1"}}>
              <Input value={form.observacao||""} onChange={F("observacao")} placeholder="Motivo ou observações..."/>
            </Field>
          </div>
          {err&&<div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginTop:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={save} loading={saving} label={edit?"Salvar Alterações":"Registrar"}/>
        </Modal>
      )}
    </Fade>
  );
}
