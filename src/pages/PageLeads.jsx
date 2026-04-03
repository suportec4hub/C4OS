import { useState } from "react";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { Fade, Row, TabPills, PBtn, DataTable, Av, Tag, ScBar, IBtn, TD } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const STATUS_COLORS = { quente:{c:L.red,bg:L.redBg,l:"Quente"}, morno:{c:L.yellow,bg:L.yellowBg,l:"Morno"}, frio:{c:L.blue,bg:L.blueBg,l:"Frio"}, novo:{c:L.teal,bg:L.tealBg,l:"Novo"} };
const CANAIS = ["WhatsApp","Site","Email","Indicação","Ligação","Instagram","Facebook ADS","Outro"];

const VAZIO = { nome:"", email:"", whatsapp:"", empresa_nome:"", cargo:"", status:"novo", score:70, origem:"WhatsApp", valor_estimado:"", observacoes:"" };

export default function PageLeads({ user }) {
  const [f, setF]       = useState("Todos");
  const [modal, setModal] = useState(false);
  const [edit, setEdit]   = useState(null);
  const [form, setForm]   = useState(VAZIO);
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");

  const { data: leads, loading, insert, update, remove } = useTable("leads", { empresa_id: user?.empresa_id });

  const filtered = f === "Todos" ? leads : leads.filter(l => l.status === f.toLowerCase());

  const openNew  = () => { setForm(VAZIO); setEdit(null); setErr(""); setModal(true); };
  const openEdit = (l) => { setForm({...VAZIO,...l}); setEdit(l.id); setErr(""); setModal(true); };

  const save = async () => {
    if (!form.nome.trim()) { setErr("Nome é obrigatório."); return; }
    setSaving(true); setErr("");
    const payload = {
      ...form,
      score: parseInt(form.score) || 50,
      valor_estimado: form.valor_estimado ? parseFloat(form.valor_estimado) : null,
      empresa_id: user?.empresa_id,
      ultima_atividade: new Date().toISOString(),
    };
    const { error } = edit ? await update(edit, payload) : await insert(payload);
    if (error) setErr(error.message || "Erro ao salvar.");
    else setModal(false);
    setSaving(false);
  };

  const del = async (id) => {
    if (!confirm("Excluir este lead?")) return;
    await remove(id);
  };

  const F = (k) => (v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Fade>
      <Row between mb={16}>
        <TabPills tabs={["Todos","Quente","Morno","Frio","Novo"]} active={f} onChange={setF}/>
        <PBtn onClick={openNew}>+ Novo Lead</PBtn>
      </Row>

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando leads...</div>
      ) : leads.length === 0 ? (
        <div style={{textAlign:"center",padding:60,color:L.t3}}>
          <div style={{fontSize:32,marginBottom:12}}>◎</div>
          <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>Nenhum lead ainda</div>
          <div style={{fontSize:12,marginBottom:20}}>Comece adicionando seu primeiro lead</div>
          <PBtn onClick={openNew}>+ Adicionar Lead</PBtn>
        </div>
      ) : (
        <DataTable heads={["Lead","Empresa","WhatsApp","Status","Score","Origem","Valor","Ações"]}>
          {filtered.map(l => {
            const sc = STATUS_COLORS[l.status] || STATUS_COLORS.novo;
            return (
              <tr key={l.id} style={{borderBottom:`1px solid ${L.lineSoft}`}}
                onMouseEnter={e=>e.currentTarget.style.background=L.surface}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              >
                <td style={TD}><Row gap={9}><Av name={l.nome} color={L.teal}/><span style={{color:L.t1,fontWeight:500,fontSize:12.5}}>{l.nome}</span></Row></td>
                <td style={{...TD,color:L.t3,fontSize:12}}>{l.empresa_nome||"—"}</td>
                <td style={{...TD,fontFamily:"'JetBrains Mono',monospace",color:L.teal,fontSize:11}}>{l.whatsapp||"—"}</td>
                <td style={TD}><Tag color={sc.c} bg={sc.bg}>{sc.l}</Tag></td>
                <td style={TD}><Row gap={7}><ScBar v={l.score||50}/><span style={{fontSize:10,color:L.t3,fontFamily:"'JetBrains Mono',monospace"}}>{l.score||50}</span></Row></td>
                <td style={{...TD,color:L.t3,fontSize:12}}>{l.origem||"—"}</td>
                <td style={{...TD,color:L.green,fontWeight:600,fontSize:12.5}}>{l.valor_estimado ? `R$ ${parseFloat(l.valor_estimado).toLocaleString("pt-BR",{minimumFractionDigits:2})}` : "—"}</td>
                <td style={TD}>
                  <Row gap={5}>
                    {l.whatsapp && <IBtn c={L.green} onClick={()=>window.open(`https://wa.me/55${l.whatsapp.replace(/\D/g,"")}`)}>WhatsApp</IBtn>}
                    <IBtn c={L.teal} onClick={()=>openEdit(l)}>✎</IBtn>
                    <IBtn c={L.red} onClick={()=>del(l.id)}>⊗</IBtn>
                  </Row>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      {modal && (
        <Modal title={edit ? "Editar Lead" : "Novo Lead"} onClose={()=>setModal(false)} width={520}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
            <Field label="Nome *"><Input value={form.nome} onChange={F("nome")} placeholder="Nome completo"/></Field>
            <Field label="WhatsApp"><Input value={form.whatsapp} onChange={F("whatsapp")} placeholder="(11) 99999-9999"/></Field>
            <Field label="E-mail"><Input value={form.email} onChange={F("email")} type="email" placeholder="email@empresa.com"/></Field>
            <Field label="Empresa"><Input value={form.empresa_nome} onChange={F("empresa_nome")} placeholder="Nome da empresa"/></Field>
            <Field label="Cargo"><Input value={form.cargo} onChange={F("cargo")} placeholder="Cargo / função"/></Field>
            <Field label="Valor estimado"><Input value={form.valor_estimado} onChange={F("valor_estimado")} placeholder="Ex: 5000"/></Field>
            <Field label="Status">
              <Select value={form.status} onChange={F("status")}>
                {["novo","quente","morno","frio"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Origem">
              <Select value={form.origem} onChange={F("origem")}>
                {CANAIS.map(c=><option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label={`Score: ${form.score}`} style={{gridColumn:"1/-1"}}>
              <input type="range" min={0} max={100} value={form.score} onChange={e=>F("score")(e.target.value)}
                style={{width:"100%",accentColor:L.teal}}/>
            </Field>
          </div>
          <Field label="Observações">
            <textarea value={form.observacoes} onChange={e=>F("observacoes")(e.target.value)} rows={3}
              placeholder="Notas internas sobre o lead..."
              style={{width:"100%",background:L.surface,border:`1.5px solid ${L.line}`,borderRadius:9,padding:"9px 12px",color:L.t1,fontSize:12.5,fontFamily:"'Instrument Sans',sans-serif",resize:"vertical",outline:"none"}}/>
          </Field>
          {err && <div style={{padding:"8px 12px",background:L.redBg,border:`1px solid ${L.red}22`,borderRadius:8,fontSize:12,color:L.red,marginBottom:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={save} loading={saving} label={edit?"Salvar Alterações":"Criar Lead"}/>
        </Modal>
      )}
    </Fade>
  );
}
