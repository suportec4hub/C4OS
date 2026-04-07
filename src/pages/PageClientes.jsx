import { useState } from "react";
import { L } from "../constants/theme";
import { useTable, usePlanos } from "../hooks/useData";
import { Fade, Row, Grid, PBtn, DataTable, Tag, ScBar, IBtn, TD } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const VAZIO = { nome:"", cnpj:"", segmento:"", telefone:"", website:"", plano_id:"", status:"trial" };

export default function PageClientes() {
  const { data: empresas, loading, insert, update, remove, refetch } = useTable("empresas");
  const { planos } = usePlanos();
  const [modal, setModal]   = useState(false);
  const [edit, setEdit]     = useState(null);
  const [form, setForm]     = useState(VAZIO);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");
  const [view, setView]     = useState(null);

  const pc = { Enterprise:{c:L.teal,bg:L.tealBg}, Starter:{c:L.copper,bg:L.copperBg}, "C4HUB":{c:L.green,bg:L.greenBg} };

  const openNew  = () => { setForm(VAZIO); setEdit(null); setErr(""); setModal(true); };
  const openEdit = (e) => { setForm({...VAZIO,...e, plano_id:e.plano_id||""}); setEdit(e.id); setErr(""); setModal(true); };

  const save = async () => {
    if (!form.nome.trim()) { setErr("Nome da empresa é obrigatório."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, is_c4hub: false, assinatura_ativa: form.status === "ativo" };
    const { error } = edit ? await update(edit, payload) : await insert(payload);
    if (error) setErr(error.message || "Erro ao salvar.");
    else { setModal(false); refetch(); }
    setSaving(false);
  };

  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  const mrr = empresas.filter(e=>e.status==="ativo").reduce((s,e)=>s+parseFloat(e.mrr||0),0);
  const planoNome = (pid) => planos.find(p=>p.id===pid)?.nome || "—";

  return (
    <Fade>
      <Grid cols={4} gap={12} mb={14} responsive>
        {[
          {l:"Clientes Ativos",v:empresas.filter(e=>e.status==="ativo"&&!e.is_c4hub).length,c:L.green},
          {l:"MRR Total",v:`R$ ${mrr.toLocaleString("pt-BR",{minimumFractionDigits:2})}`,c:L.teal},
          {l:"Em Trial",v:empresas.filter(e=>e.status==="trial").length,c:L.yellow},
          {l:"Total Empresas",v:empresas.filter(e=>!e.is_c4hub).length,c:L.copper},
        ].map((k,i)=>(
          <div key={i} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"16px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:10,color:L.t4,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:6,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{k.l}</div>
            <div style={{fontSize:22,fontWeight:700,color:k.c,fontFamily:"'Outfit',sans-serif"}}>{k.v}</div>
          </div>
        ))}
      </Grid>

      <Row between mb={12}>
        <span style={{fontSize:13,fontWeight:600,color:L.t1}}>Empresas Cadastradas</span>
        <PBtn onClick={openNew}>+ Nova Empresa</PBtn>
      </Row>

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando clientes...</div>
      ) : (
        <DataTable heads={["Empresa","Plano","Status","MRR","Vencimento","Saúde","Ações"]}>
          {empresas.filter(e=>!e.is_c4hub).map(emp => {
            const pn = planoNome(emp.plano_id);
            return (
              <tr key={emp.id} style={{borderBottom:`1px solid ${L.lineSoft}`}}
                onMouseEnter={e=>e.currentTarget.style.background=L.surface}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              >
                <td style={{...TD,fontWeight:500,color:L.t1,fontSize:12.5}}>{emp.nome}</td>
                <td style={TD}><Tag color={pc[pn]?.c||L.t3} bg={pc[pn]?.bg||L.surface}>{pn}</Tag></td>
                <td style={TD}><Tag color={emp.status==="ativo"?L.green:emp.status==="trial"?L.yellow:L.red} bg={emp.status==="ativo"?L.greenBg:emp.status==="trial"?L.yellowBg:L.redBg}>{emp.status}</Tag></td>
                <td style={{...TD,fontWeight:600,color:L.green}}>R$ {parseFloat(emp.mrr||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td>
                <td style={{...TD,color:L.t4,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{emp.vencimento||"—"}</td>
                <td style={TD}>
                  <Row gap={6}>
                    <ScBar v={emp.assinatura_ativa?95:40}/>
                    <span style={{fontSize:10,color:emp.assinatura_ativa?L.green:L.yellow,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{emp.assinatura_ativa?"95%":"40%"}</span>
                  </Row>
                </td>
                <td style={TD}>
                  <Row gap={5}>
                    <IBtn c={L.teal} onClick={()=>openEdit(emp)}>✎ Editar</IBtn>
                    <IBtn c={L.red} onClick={()=>{if(confirm("Excluir empresa?"))remove(emp.id);}}>⊗</IBtn>
                  </Row>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      {modal && (
        <Modal title={edit ? "Editar Empresa" : "Nova Empresa"} onClose={()=>setModal(false)} width={520}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
            <Field label="Nome da Empresa *"><Input value={form.nome} onChange={F("nome")} placeholder="Razão social / nome fantasia"/></Field>
            <Field label="CNPJ"><Input value={form.cnpj} onChange={F("cnpj")} placeholder="XX.XXX.XXX/XXXX-XX"/></Field>
            <Field label="Segmento"><Input value={form.segmento} onChange={F("segmento")} placeholder="Ex: Varejo, Tecnologia..."/></Field>
            <Field label="Telefone"><Input value={form.telefone} onChange={F("telefone")} placeholder="(11) 99999-9999"/></Field>
            <Field label="Website"><Input value={form.website} onChange={F("website")} placeholder="www.empresa.com.br"/></Field>
            <Field label="Status">
              <Select value={form.status} onChange={F("status")}>
                {["trial","ativo","inativo","cancelado"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Plano">
              <Select value={form.plano_id} onChange={F("plano_id")}>
                <option value="">— Sem plano —</option>
                {planos.filter(p=>p.ativo).map(p=><option key={p.id} value={p.id}>{p.nome} — R$ {parseFloat(p.preco_mensal).toLocaleString("pt-BR",{minimumFractionDigits:2})}</option>)}
              </Select>
            </Field>
            <Field label="MRR (R$)"><Input value={form.mrr||""} onChange={F("mrr")} type="number" placeholder="0,00"/></Field>
          </div>
          {err && <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginBottom:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={save} loading={saving} label={edit?"Salvar Alterações":"Criar Empresa"}/>
        </Modal>
      )}
    </Fade>
  );
}
