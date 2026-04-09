import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { Fade, Row, Grid, TabPills, PBtn, DataTable, Tag, IBtn, TD, Card, TT } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const CAT_RECEITA = ["MRR / Mensalidade","Projeto Pontual","Consultoria","Licença de Software","Comissão","Serviços Extras","Outro"];
const CAT_DESPESA = ["Folha de Pagamento","Aluguel / Espaço","Marketing & Ads","Software & Ferramentas","Infraestrutura","Fornecedores","Impostos & Taxas","Comissões de Venda","Viagens","Equipamentos","Outro"];
const CONTAS      = ["Conta Principal","Conta PJ","Caixa","Investimentos","Cartão Empresarial"];
const STATUS_C    = { pendente:L.yellow, pago:L.green, cancelado:L.t4, atrasado:L.red };
const STATUS_BG   = { pendente:L.yellowBg, pago:L.greenBg, cancelado:L.surface, atrasado:L.redBg };

const VAZIO = { tipo:"receita", categoria:"", descricao:"", valor:"", data_vencimento:"", data_pagamento:"", status:"pendente", conta:"Conta Principal", recorrente:false, observacao:"" };

const fmt = (v) => `R$ ${parseFloat(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;
const fmtDate = (d) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : "—";
const monthKey = (d) => d ? d.slice(0,7) : "";

export default function PageFinanceiro({ user }) {
  const { data: lancamentos, loading, insert, update, remove, refetch } = useTable("financeiro_lancamentos", { empresa_id: user?.empresa_id });

  const [filtro, setFiltro] = useState("Todos");
  const [modal,  setModal]  = useState(false);
  const [edit,   setEdit]   = useState(null);
  const [form,   setForm]   = useState(VAZIO);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const F = k => v => setForm(p => ({ ...p, [k]: v }));
  const hoje = new Date().toISOString().split("T")[0];

  // Enriquecer com status "atrasado" calculado
  const itens = lancamentos.map(l => ({
    ...l,
    status: l.status === "pendente" && l.data_vencimento && l.data_vencimento < hoje ? "atrasado" : l.status,
  }));

  // KPIs
  const receitas  = itens.filter(l => l.tipo==="receita" && l.status==="pago").reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const despesas  = itens.filter(l => l.tipo==="despesa" && l.status==="pago").reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const lucro     = receitas - despesas;
  const aReceber  = itens.filter(l => l.tipo==="receita" && (l.status==="pendente"||l.status==="atrasado")).reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const aPagar    = itens.filter(l => l.tipo==="despesa" && (l.status==="pendente"||l.status==="atrasado")).reduce((s,l)=>s+parseFloat(l.valor||0),0);

  const filtered = itens.filter(l => {
    if (filtro==="Todos")    return true;
    if (filtro==="Receitas") return l.tipo==="receita";
    if (filtro==="Despesas") return l.tipo==="despesa";
    if (filtro==="Pendente") return l.status==="pendente";
    if (filtro==="Atrasado") return l.status==="atrasado";
    return true;
  });

  // Chart mensal (6 meses)
  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth()-i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const label = d.toLocaleString("pt-BR",{month:"short"});
      const rec = itens.filter(l=>l.tipo==="receita"&&l.status==="pago"&&monthKey(l.data_pagamento)===key).reduce((s,l)=>s+parseFloat(l.valor||0),0);
      const dep = itens.filter(l=>l.tipo==="despesa"&&l.status==="pago"&&monthKey(l.data_pagamento)===key).reduce((s,l)=>s+parseFloat(l.valor||0),0);
      months.push({ name:label, receitas:rec, despesas:dep, lucro:rec-dep });
    }
    return months;
  }, [itens]);

  // Pie categorias despesa
  const pieData = useMemo(() => {
    const cats = {};
    itens.filter(l=>l.tipo==="despesa"&&l.status==="pago").forEach(l=>{
      const c = l.categoria||"Outro";
      cats[c] = (cats[c]||0)+parseFloat(l.valor||0);
    });
    return Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value])=>({name,value}));
  }, [itens]);

  const PIE_COLORS = [L.teal,L.copper,L.red,L.green,L.yellow,L.blue];

  const openNew  = () => { setForm(VAZIO); setEdit(null); setErr(""); setModal(true); };
  const openEdit = (l) => { setForm({...l,valor:String(l.valor)}); setEdit(l.id); setErr(""); setModal(true); };

  const save = async () => {
    if (!form.descricao.trim()) { setErr("Descrição é obrigatória."); return; }
    if (!form.valor || parseFloat(form.valor)<=0) { setErr("Valor deve ser maior que zero."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, valor:parseFloat(form.valor), empresa_id:user?.empresa_id };
    const {error} = edit ? await update(edit,payload) : await insert(payload);
    if (error) setErr(error.message||"Erro ao salvar.");
    else { setModal(false); refetch(); }
    setSaving(false);
  };

  const marcarPago = async (l) => {
    await update(l.id, { status:"pago", data_pagamento: hoje });
  };

  return (
    <Fade>
      {/* KPIs */}
      <Grid cols={5} gap={12} mb={16} responsive>
        {[
          {l:"Receitas",     v:fmt(receitas),  c:L.green,  sub:"lançamentos pagos"},
          {l:"Despesas",     v:fmt(despesas),  c:L.red,    sub:"lançamentos pagos"},
          {l:"Lucro Líquido",v:fmt(lucro),     c:lucro>=0?L.teal:L.red, sub:lucro>=0?"positivo":"negativo"},
          {l:"A Receber",    v:fmt(aReceber),  c:L.copper, sub:"em aberto"},
          {l:"A Pagar",      v:fmt(aPagar),    c:L.yellow, sub:"em aberto"},
        ].map((k,i)=>(
          <div key={i} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"15px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:9.5,color:L.t4,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:5,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{k.l}</div>
            <div style={{fontSize:19,fontWeight:700,color:k.c,fontFamily:"'Outfit',sans-serif",lineHeight:1.2}}>{k.v}</div>
            <div style={{fontSize:10,color:L.t5,marginTop:3}}>{k.sub}</div>
          </div>
        ))}
      </Grid>

      {/* Charts */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:12,marginBottom:16}} className="rg-auto">
        <Card title="Fluxo de Caixa" sub="últimos 6 meses — lançamentos pagos">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barGap={3} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="4 4" stroke={L.lineSoft} vertical={false}/>
              <XAxis dataKey="name" tick={{fill:L.t4,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v} width={40}/>
              <Tooltip contentStyle={TT} formatter={v=>[fmt(v)]}/>
              <Bar dataKey="receitas" fill={L.green}  radius={[4,4,0,0]} name="Receitas"/>
              <Bar dataKey="despesas" fill={L.red}    radius={[4,4,0,0]} name="Despesas"/>
              <Bar dataKey="lucro"    fill={L.teal}   radius={[4,4,0,0]} name="Lucro"/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Despesas por Categoria" sub="lançamentos pagos">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                  {pieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                </Pie>
                <Tooltip contentStyle={TT} formatter={v=>[fmt(v)]}/>
                <Legend iconSize={8} iconType="circle" wrapperStyle={{fontSize:10,color:L.t3}}/>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{textAlign:"center",padding:40,color:L.t4,fontSize:11}}>Nenhum dado ainda</div>
          )}
        </Card>
      </div>

      {/* Lista */}
      <Row between mb={12}>
        <TabPills tabs={["Todos","Receitas","Despesas","Pendente","Atrasado"]} active={filtro} onChange={setFiltro}/>
        <PBtn onClick={openNew}>+ Lançamento</PBtn>
      </Row>

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando...</div>
      ) : (
        <DataTable heads={["Descrição","Categoria","Tipo","Vencimento","Pagamento","Valor","Status","Ações"]}>
          {filtered.map(l=>(
            <tr key={l.id} style={{borderBottom:`1px solid ${L.lineSoft}`}}
              onMouseEnter={e=>e.currentTarget.style.background=L.surface}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <td style={{...TD,fontWeight:500,color:L.t1,fontSize:12.5,maxWidth:200}}>
                <div style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.descricao}</div>
                {l.conta&&<div style={{fontSize:9.5,color:L.t5,marginTop:1}}>{l.conta}</div>}
              </td>
              <td style={{...TD,color:L.t3,fontSize:11}}>{l.categoria||"—"}</td>
              <td style={TD}>
                <Tag color={l.tipo==="receita"?L.green:L.red} bg={l.tipo==="receita"?L.greenBg:L.redBg}>
                  {l.tipo==="receita"?"↑ Receita":"↓ Despesa"}
                </Tag>
              </td>
              <td style={{...TD,fontSize:11,color:l.status==="atrasado"?L.red:L.t3,fontFamily:"'JetBrains Mono',monospace"}}>{fmtDate(l.data_vencimento)}</td>
              <td style={{...TD,fontSize:11,color:L.t3,fontFamily:"'JetBrains Mono',monospace"}}>{fmtDate(l.data_pagamento)}</td>
              <td style={{...TD,fontWeight:700,color:l.tipo==="receita"?L.green:L.red,whiteSpace:"nowrap"}}>{fmt(l.valor)}</td>
              <td style={TD}><Tag color={STATUS_C[l.status]||L.t4} bg={STATUS_BG[l.status]||L.surface}>{l.status}</Tag></td>
              <td style={TD}>
                <Row gap={4}>
                  {(l.status==="pendente"||l.status==="atrasado")&&<IBtn c={L.green} onClick={()=>marcarPago(l)} title="Marcar pago">✓</IBtn>}
                  <IBtn c={L.teal} onClick={()=>openEdit(l)}>✎</IBtn>
                  <IBtn c={L.red}  onClick={()=>{if(confirm("Excluir lançamento?"))remove(l.id);}}>⊗</IBtn>
                </Row>
              </td>
            </tr>
          ))}
          {filtered.length===0&&(
            <tr><td colSpan={8} style={{...TD,textAlign:"center",color:L.t4,padding:40}}>
              {loading?"Carregando...":"Nenhum lançamento. Clique em '+ Lançamento' para começar."}
            </td></tr>
          )}
        </DataTable>
      )}

      {/* Modal */}
      {modal&&(
        <Modal title={edit?"Editar Lançamento":"Novo Lançamento"} onClose={()=>setModal(false)} width={540}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
            <Field label="Tipo">
              <Select value={form.tipo} onChange={F("tipo")}>
                <option value="receita">↑ Receita</option>
                <option value="despesa">↓ Despesa</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={F("status")}>
                {["pendente","pago","cancelado"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Descrição *" style={{gridColumn:"1/-1"}}>
              <Input value={form.descricao} onChange={F("descricao")} placeholder="Ex: Mensalidade Empresa X — Março"/>
            </Field>
            <Field label="Categoria">
              <Select value={form.categoria} onChange={F("categoria")}>
                <option value="">Selecionar...</option>
                {(form.tipo==="receita"?CAT_RECEITA:CAT_DESPESA).map(c=><option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Conta">
              <Select value={form.conta} onChange={F("conta")}>
                {CONTAS.map(c=><option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Valor (R$) *">
              <Input value={form.valor} onChange={F("valor")} type="number" placeholder="0.00" step="0.01"/>
            </Field>
            <Field label="Vencimento">
              <Input value={form.data_vencimento||""} onChange={F("data_vencimento")} type="date"/>
            </Field>
            <Field label="Data Pagamento">
              <Input value={form.data_pagamento||""} onChange={F("data_pagamento")} type="date"/>
            </Field>
            <Field label="Observação" style={{gridColumn:"1/-1"}}>
              <Input value={form.observacao||""} onChange={F("observacao")} placeholder="Observações adicionais..."/>
            </Field>
          </div>
          {err&&<div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginTop:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={save} loading={saving} label={edit?"Salvar Alterações":"Criar Lançamento"}/>
        </Modal>
      )}
    </Fade>
  );
}
