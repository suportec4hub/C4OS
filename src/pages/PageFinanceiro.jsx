import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
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

const fmt     = (v) => `R$ ${parseFloat(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;
const fmtDate = (d) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : "—";
const monthKey = (d) => d ? d.slice(0,7) : "";
const dayOfMonth = (d) => d ? new Date(d+"T12:00:00").getDate() : null;

// Dia 1-9 = Ciclo 1 (até ~5º dia útil), dia 13-18 = Ciclo 2 (dia 15)
const inCiclo = (l, c) => {
  const day = dayOfMonth(l.data_vencimento);
  if (!day) return false;
  return c === 1 ? day <= 9 : day >= 13 && day <= 18;
};

// Gera lista dos últimos N meses no formato { value:"2026-07", label:"Jul/2026" }
const buildMonthOptions = (n=13) => {
  const opts = [{ value:"todos", label:"Todos os períodos" }];
  for (let i=0; i<n; i++) {
    const d = new Date(); d.setMonth(d.getMonth()-i);
    const value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label = d.toLocaleString("pt-BR",{month:"short",year:"numeric"}).replace(" de ","/"
    ).replace(/^\w/,c=>c.toUpperCase());
    opts.push({ value, label });
  }
  return opts;
};
const MONTH_OPTIONS = buildMonthOptions(12);

export default function PageFinanceiro({ user }) {
  const { data: lancamentos, loading, insert, update, remove, refetch } = useTable("financeiro_lancamentos", { empresa_id: user?.empresa_id });

  const [filtro,   setFiltro]  = useState("Todos");
  const [periodo,  setPeriodo] = useState("todos");
  const [busca,    setBusca]   = useState("");
  const [chartTab, setChartTab]= useState("fluxo"); // "fluxo" | "lucro"
  const [modal,    setModal]   = useState(false);
  const [edit,     setEdit]    = useState(null);
  const [form,     setForm]    = useState(VAZIO);
  const [saving,   setSaving]  = useState(false);
  const [err,      setErr]     = useState("");

  const F = k => v => setForm(p => ({ ...p, [k]: v }));
  const hoje = new Date().toISOString().split("T")[0];

  // Enriquecer com status "atrasado" calculado
  const itens = lancamentos.map(l => ({
    ...l,
    status: l.status === "pendente" && l.data_vencimento && l.data_vencimento < hoje ? "atrasado" : l.status,
  }));

  // KPIs (sobre todos os itens, ignorando filtro de período)
  const receitas  = itens.filter(l => l.tipo==="receita" && l.status==="pago").reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const despesas  = itens.filter(l => l.tipo==="despesa" && l.status==="pago").reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const lucro     = receitas - despesas;
  const aReceber  = itens.filter(l => l.tipo==="receita" && (l.status==="pendente"||l.status==="atrasado")).reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const aPagar    = itens.filter(l => l.tipo==="despesa" && (l.status==="pendente"||l.status==="atrasado")).reduce((s,l)=>s+parseFloat(l.valor||0),0);

  // Contagens para sub-labels dos KPIs
  const cntRec    = itens.filter(l=>l.tipo==="receita"&&l.status==="pago").length;
  const cntDesp   = itens.filter(l=>l.tipo==="despesa"&&l.status==="pago").length;
  const cntRcb    = itens.filter(l=>l.tipo==="receita"&&(l.status==="pendente"||l.status==="atrasado")).length;
  const cntPag    = itens.filter(l=>l.tipo==="despesa"&&(l.status==="pendente"||l.status==="atrasado")).length;
  const cntAtras  = itens.filter(l=>l.status==="atrasado").length;

  // Ciclos do mês atual
  const mesAtual = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }, []);

  const cicloData = useMemo(() => {
    const itensMes = itens.filter(l => monthKey(l.data_vencimento) === mesAtual);
    return [1, 2].map(c => {
      const sub = itensMes.filter(l => inCiclo(l, c));
      const recPrev  = sub.filter(l=>l.tipo==="receita").reduce((s,l)=>s+parseFloat(l.valor||0),0);
      const recPago  = sub.filter(l=>l.tipo==="receita"&&l.status==="pago").reduce((s,l)=>s+parseFloat(l.valor||0),0);
      const despPrev = sub.filter(l=>l.tipo==="despesa").reduce((s,l)=>s+parseFloat(l.valor||0),0);
      const despPago = sub.filter(l=>l.tipo==="despesa"&&l.status==="pago").reduce((s,l)=>s+parseFloat(l.valor||0),0);
      return { c, recPrev, recPago, despPrev, despPago, total: sub.length };
    });
  }, [itens, mesAtual]);

  // Filtrar por período e tipo/status
  const periodoFiltered = useMemo(() => {
    if (periodo === "todos") return itens;
    return itens.filter(l => {
      const key = l.data_vencimento ? monthKey(l.data_vencimento) : monthKey(l.data_pagamento);
      return key === periodo;
    });
  }, [itens, periodo]);

  const filtered = useMemo(() => {
    const lower = busca.trim().toLowerCase();
    return periodoFiltered.filter(l => {
      if (filtro==="Receitas"  && l.tipo!=="receita") return false;
      if (filtro==="Despesas"  && l.tipo!=="despesa") return false;
      if (filtro==="Pendente"  && l.status!=="pendente") return false;
      if (filtro==="Atrasado"  && l.status!=="atrasado") return false;
      if (filtro==="Ciclo 1"   && !inCiclo(l, 1)) return false;
      if (filtro==="Ciclo 2"   && !inCiclo(l, 2)) return false;
      if (lower && !l.descricao?.toLowerCase().includes(lower) && !l.categoria?.toLowerCase().includes(lower)) return false;
      return true;
    });
  }, [periodoFiltered, filtro, busca]);

  // Totais da lista visível
  const totalRecVis  = filtered.filter(l=>l.tipo==="receita").reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const totalDespVis = filtered.filter(l=>l.tipo==="despesa").reduce((s,l)=>s+parseFloat(l.valor||0),0);

  // Chart mensal (6 meses)
  const chartData = useMemo(() => {
    const months = [];
    for (let i=5; i>=0; i--) {
      const d = new Date(); d.setMonth(d.getMonth()-i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const label = d.toLocaleString("pt-BR",{month:"short"}).replace(/^\w/,c=>c.toUpperCase());
      const rec = itens.filter(l=>l.tipo==="receita"&&l.status==="pago"&&monthKey(l.data_pagamento)===key).reduce((s,l)=>s+parseFloat(l.valor||0),0);
      const dep = itens.filter(l=>l.tipo==="despesa"&&l.status==="pago"&&monthKey(l.data_pagamento)===key).reduce((s,l)=>s+parseFloat(l.valor||0),0);
      months.push({ name:label, Receitas:rec, Despesas:dep, Lucro:rec-dep });
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

  const PIE_COLORS = [L.red, L.teal, L.copper, L.green, L.yellow, L.blue];

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
    refetch();
  };

  // ── Estilos locais ──────────────────────────────────────────────────────
  const kpiCard = (borderColor) => ({
    background: L.white, borderRadius: 14,
    border: `1px solid ${L.line}`,
    borderTop: `3px solid ${borderColor}`,
    padding: "16px 18px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    display: "flex", flexDirection: "column", gap: 2,
  });

  const kpiIcon = (bg, color) => ({
    width: 32, height: 32, borderRadius: 9,
    background: bg, color, display: "flex",
    alignItems: "center", justifyContent: "center",
    fontSize: 15, flexShrink: 0, marginBottom: 6,
  });

  return (
    <Fade>

      {/* Alerta de atrasos */}
      {cntAtras > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: L.redBg, border: `1px solid ${L.redA2}`,
          borderRadius: 10, padding: "10px 14px", marginBottom: 14,
          fontSize: 12.5, color: L.red,
        }}>
          <span style={{fontSize:16}}>⚠️</span>
          <span><b>{cntAtras} lançamento{cntAtras>1?"s":""} atrasado{cntAtras>1?"s":""}</b> — verifique os vencimentos abaixo e regularize.</span>
          <button onClick={()=>{setFiltro("Atrasado");setPeriodo("todos");}}
            style={{marginLeft:"auto",background:L.red,color:"#fff",border:"none",borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            Ver atrasados
          </button>
        </div>
      )}

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:14}} className="rg-auto">
        {[
          { l:"Receitas",      v:fmt(receitas),  c:L.green,  bg:L.greenBg,   icon:"↑", cnt:`${cntRec} pago${cntRec!==1?"s":""}` },
          { l:"Despesas",      v:fmt(despesas),  c:L.red,    bg:L.redBg,     icon:"↓", cnt:`${cntDesp} pago${cntDesp!==1?"s":""}` },
          { l:"Lucro Líquido", v:fmt(lucro),     c:lucro>=0?L.teal:L.red, bg:lucro>=0?L.tealBg:L.redBg, icon:"=", cnt:lucro>=0?"positivo":"negativo" },
          { l:"A Receber",     v:fmt(aReceber),  c:L.copper, bg:L.copperBg,  icon:"⌛", cnt:`${cntRcb} em aberto` },
          { l:"A Pagar",       v:fmt(aPagar),    c:L.yellow, bg:L.yellowBg,  icon:"📋", cnt:`${cntPag} em aberto` },
        ].map((k,i)=>(
          <div key={i} style={kpiCard(k.c)}>
            <div style={kpiIcon(k.bg, k.c)}>{k.icon}</div>
            <div style={{fontSize:9,color:L.t4,textTransform:"uppercase",letterSpacing:"1.2px",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{k.l}</div>
            <div style={{fontSize:20,fontWeight:800,color:k.c,fontFamily:"'Outfit',sans-serif",lineHeight:1.15,marginTop:1}}>{k.v}</div>
            <div style={{fontSize:10,color:L.t4,marginTop:2}}>{k.cnt}</div>
          </div>
        ))}
      </div>

      {/* Ciclos de Cobrança do Mês */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {cicloData.map(cd => {
          const saldo = cd.recPrev - cd.despPrev;
          const label = cd.c === 1 ? "Ciclo 1 — Até 5º Dia Útil" : "Ciclo 2 — Dia 15";
          const accent = cd.c === 1 ? L.copper : L.teal;
          const accentBg = cd.c === 1 ? L.copperBg : L.tealBg;
          return (
            <div key={cd.c} style={{
              background: L.white, borderRadius: 12, border: `1px solid ${L.line}`,
              borderLeft: `3px solid ${accent}`, padding: "14px 16px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:700,color:accent,textTransform:"uppercase",letterSpacing:"1.2px",fontFamily:"'JetBrains Mono',monospace"}}>{label}</div>
                <button onClick={()=>{setFiltro(`Ciclo ${cd.c}`);setPeriodo(mesAtual);}}
                  style={{fontSize:10,padding:"2px 8px",borderRadius:5,border:`1px solid ${accent}`,background:accentBg,color:accent,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                  Ver lançamentos
                </button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <div>
                  <div style={{fontSize:9,color:L.t4,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace",marginBottom:2}}>Receitas</div>
                  <div style={{fontSize:13,fontWeight:700,color:L.green}}>{fmt(cd.recPrev)}</div>
                  <div style={{fontSize:9,color:L.t4,marginTop:1}}>pago: {fmt(cd.recPago)}</div>
                </div>
                <div>
                  <div style={{fontSize:9,color:L.t4,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace",marginBottom:2}}>Despesas</div>
                  <div style={{fontSize:13,fontWeight:700,color:L.red}}>{fmt(cd.despPrev)}</div>
                  <div style={{fontSize:9,color:L.t4,marginTop:1}}>pago: {fmt(cd.despPago)}</div>
                </div>
                <div>
                  <div style={{fontSize:9,color:L.t4,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace",marginBottom:2}}>Saldo</div>
                  <div style={{fontSize:13,fontWeight:700,color:saldo>=0?L.teal:L.red}}>{fmt(saldo)}</div>
                  <div style={{fontSize:9,color:L.t4,marginTop:1}}>{cd.total} lançamento{cd.total!==1?"s":""}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:10,marginBottom:14}} className="rg-auto">

        {/* Fluxo de Caixa */}
        <Card
          title={
            <Row gap={10} style={{alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:700,color:L.t1}}>Fluxo de Caixa</span>
              <div style={{display:"flex",gap:4}}>
                {["fluxo","lucro"].map(t=>(
                  <button key={t} onClick={()=>setChartTab(t)}
                    style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:5,border:"none",cursor:"pointer",fontFamily:"inherit",
                      background: chartTab===t ? L.accent : L.surface,
                      color: chartTab===t ? "#fff" : L.t3 }}>
                    {t==="fluxo" ? "Receita vs Despesa" : "Lucro"}
                  </button>
                ))}
              </div>
            </Row>
          }
          sub="últimos 6 meses — lançamentos pagos">
          <ResponsiveContainer width="100%" height={180}>
            {chartTab === "fluxo" ? (
              <BarChart data={chartData} barGap={2} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke={L.lineSoft} vertical={false}/>
                <XAxis dataKey="name" tick={{fill:L.t4,fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false}
                  tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v} width={38}/>
                <Tooltip contentStyle={TT} formatter={(v,n)=>[fmt(v),n]}/>
                <Legend iconSize={8} iconType="circle" wrapperStyle={{fontSize:10,color:L.t3,paddingTop:4}}/>
                <Bar dataKey="Receitas" fill={L.green} radius={[4,4,0,0]}/>
                <Bar dataKey="Despesas" fill={L.red}   radius={[4,4,0,0]}/>
              </BarChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={L.lineSoft} vertical={false}/>
                <XAxis dataKey="name" tick={{fill:L.t4,fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false}
                  tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v} width={38}/>
                <Tooltip contentStyle={TT} formatter={(v)=>[fmt(v),"Lucro"]}/>
                <Line dataKey="Lucro" stroke={L.teal} strokeWidth={2.5} dot={{fill:L.teal,r:4}} activeDot={{r:6}}/>
              </LineChart>
            )}
          </ResponsiveContainer>
        </Card>

        {/* Despesas por categoria */}
        <Card title="Despesas" sub="por categoria — pagas">
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={62}
                    dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                    {pieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip contentStyle={TT} formatter={v=>[fmt(v)]}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:2}}>
                {pieData.map((d,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:10}}>
                    <span style={{width:8,height:8,borderRadius:2,background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0}}/>
                    <span style={{flex:1,color:L.t3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</span>
                    <span style={{color:L.t2,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{textAlign:"center",padding:40,color:L.t4,fontSize:11}}>Nenhum dado ainda</div>
          )}
        </Card>
      </div>

      {/* Barra de filtros */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <TabPills tabs={["Todos","Receitas","Despesas","Pendente","Atrasado","Ciclo 1","Ciclo 2"]} active={filtro} onChange={t=>{setFiltro(t);}}/>

        <select value={periodo} onChange={e=>setPeriodo(e.target.value)}
          style={{height:32,borderRadius:8,border:`1px solid ${L.line}`,background:L.white,
            color:L.t2,fontSize:11.5,padding:"0 10px",fontFamily:"inherit",cursor:"pointer",outline:"none"}}>
          {MONTH_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div style={{position:"relative",flex:1,minWidth:140,maxWidth:260}}>
          <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:L.t4,fontSize:12,pointerEvents:"none"}}>🔍</span>
          <input value={busca} onChange={e=>setBusca(e.target.value)}
            placeholder="Buscar descrição ou categoria..."
            style={{width:"100%",height:32,border:`1px solid ${L.line}`,borderRadius:8,
              background:L.white,color:L.t1,fontSize:11.5,padding:"0 10px 0 28px",
              fontFamily:"inherit",outline:"none"}}/>
        </div>

        <div style={{marginLeft:"auto"}}>
          <PBtn onClick={openNew}>+ Lançamento</PBtn>
        </div>
      </div>

      {/* Resumo da lista visível */}
      {filtered.length > 0 && (
        <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:8,fontSize:11,color:L.t4}}>
          <span><b style={{color:L.t2}}>{filtered.length}</b> lançamento{filtered.length!==1?"s":""}</span>
          {totalRecVis > 0 && <span>Receitas: <b style={{color:L.green}}>{fmt(totalRecVis)}</b></span>}
          {totalDespVis > 0 && <span>Despesas: <b style={{color:L.red}}>{fmt(totalDespVis)}</b></span>}
          {totalRecVis > 0 && totalDespVis > 0 && (
            <span>Saldo: <b style={{color:totalRecVis-totalDespVis>=0?L.teal:L.red}}>{fmt(totalRecVis-totalDespVis)}</b></span>
          )}
        </div>
      )}

      {/* Tabela */}
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
              <td style={{...TD,fontSize:11,color:l.status==="atrasado"?L.red:L.t3,fontFamily:"'JetBrains Mono',monospace"}}>
                {fmtDate(l.data_vencimento)}
                {l.status==="atrasado"&&<span style={{display:"block",fontSize:9,color:L.red,fontFamily:"inherit"}}>ATRASADO</span>}
              </td>
              <td style={{...TD,fontSize:11,color:L.t3,fontFamily:"'JetBrains Mono',monospace"}}>{fmtDate(l.data_pagamento)}</td>
              <td style={{...TD,fontWeight:700,color:l.tipo==="receita"?L.green:L.red,whiteSpace:"nowrap",fontFamily:"'JetBrains Mono',monospace"}}>{fmt(l.valor)}</td>
              <td style={TD}>
                <Tag color={STATUS_C[l.status]||L.t4} bg={STATUS_BG[l.status]||L.surface}>
                  {l.status==="atrasado"?"⚠ atrasado":l.status}
                </Tag>
              </td>
              <td style={TD}>
                <Row gap={4}>
                  {(l.status==="pendente"||l.status==="atrasado")&&
                    <IBtn c={L.green} onClick={()=>marcarPago(l)} title="Marcar como pago">✓</IBtn>}
                  <IBtn c={L.teal} onClick={()=>openEdit(l)} title="Editar">✎</IBtn>
                  <IBtn c={L.red}  onClick={()=>{if(confirm("Excluir lançamento?"))remove(l.id);}} title="Excluir">⊗</IBtn>
                </Row>
              </td>
            </tr>
          ))}
          {filtered.length===0&&(
            <tr><td colSpan={8} style={{...TD,textAlign:"center",color:L.t4,padding:40}}>
              {loading ? "Carregando..." :
                busca ? `Nenhum resultado para "${busca}".` :
                "Nenhum lançamento neste filtro. Clique em '+ Lançamento' para começar."}
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
