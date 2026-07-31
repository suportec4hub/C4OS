import { useState, useMemo, useCallback, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import ModalCobranca from "../components/ModalCobranca";
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

// Gera datas mensais a partir de uma data base para N meses (i=0 é o próprio mês da data base)
const gerarDatasRecorrentes = (dataBase, qtdMeses) => {
  const d = new Date(dataBase + "T12:00:00");
  const dia = d.getDate();
  return Array.from({ length: qtdMeses }, (_, i) => {
    const maxDia = new Date(d.getFullYear(), d.getMonth()+i+1, 0).getDate();
    const dFinal = new Date(d.getFullYear(), d.getMonth()+i, Math.min(dia, maxDia));
    return dFinal.toISOString().split("T")[0];
  });
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
  const [aba,      setAba]     = useState("lancamentos"); // "lancamentos" | "contratos"
  // Contratos: o que cada cliente paga por mês. Só a equipe C4HUB enxerga,
  // porque são os dados de cobrança de todos os clientes.
  const [contratos, setContratos] = useState([]);
  const [contratoEmpresa, setContratoEmpresa] = useState(null);
  const ehC4hub = String(user?.role || "").startsWith("c4hub");

  const carregarContratos = useCallback(async () => {
    if (!ehC4hub) return;
    // Parte das empresas, não da configuração: cliente recém-cadastrado ainda
    // não tem cobrança e precisa aparecer aqui justamente para ser configurado.
    const { data } = await supabase
      .from("empresas")
      .select("id, nome, status, is_c4hub, abacatepay_customer_id, cobranca_config(*)")
      .order("nome");
    const lista = (data || [])
      .filter(e => !e.is_c4hub)
      .map(e => {
        const c = Array.isArray(e.cobranca_config) ? e.cobranca_config[0] : e.cobranca_config;
        return { ...(c || {}), empresa_id: e.id, empresas: e, configurado: !!c?.valor_mensal };
      })
      // Sem cobrança primeiro: é o que exige ação.
      .sort((a, b) => (a.configurado === b.configurado)
        ? String(a.empresas.nome).localeCompare(String(b.empresas.nome))
        : (a.configurado ? 1 : -1));
    setContratos(lista);
  }, [ehC4hub]);

  useEffect(() => { carregarContratos(); }, [carregarContratos]);
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

  // KPIs (sobre todos os itens, ignorando filtro de período)
  const receitas  = itens.filter(l => l.tipo==="receita" && l.status==="pago").reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const despesas  = itens.filter(l => l.tipo==="despesa" && l.status==="pago").reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const lucro     = receitas - despesas;
  const aPagar    = itens.filter(l => l.tipo==="despesa" && (l.status==="pendente"||l.status==="atrasado")).reduce((s,l)=>s+parseFloat(l.valor||0),0);

  // A Receber dividido por ciclo (filtra pela data de vencimento)
  const pendRec   = (l) => l.tipo==="receita" && (l.status==="pendente"||l.status==="atrasado");
  const aReceberC1 = itens.filter(l=>pendRec(l)&&inCiclo(l,1)).reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const aReceberC2 = itens.filter(l=>pendRec(l)&&inCiclo(l,2)).reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const cntRcbC1   = itens.filter(l=>pendRec(l)&&inCiclo(l,1)).length;
  const cntRcbC2   = itens.filter(l=>pendRec(l)&&inCiclo(l,2)).length;

  // Contagens para sub-labels dos KPIs
  const cntRec    = itens.filter(l=>l.tipo==="receita"&&l.status==="pago").length;
  const cntDesp   = itens.filter(l=>l.tipo==="despesa"&&l.status==="pago").length;
  const cntPag    = itens.filter(l=>l.tipo==="despesa"&&(l.status==="pendente"||l.status==="atrasado")).length;
  const cntAtras  = itens.filter(l=>l.status==="atrasado").length;

  // Despesas/Receitas Fixas (recorrentes) — agrupadas por descricao+valor
  const recorrentesGrupos = useMemo(() => {
    const rec = itens.filter(l => l.recorrente);
    const grupos = {};
    rec.forEach(l => {
      const key = `${l.descricao.trim()}||${parseFloat(l.valor)}`;
      if (!grupos[key]) grupos[key] = {
        descricao: l.descricao, categoria: l.categoria || "—",
        valor: parseFloat(l.valor), tipo: l.tipo,
        dia: dayOfMonth(l.data_vencimento), entries: [],
      };
      grupos[key].entries.push(l);
    });
    // Para cada grupo, montar histórico dos últimos 4 meses
    const hoje4 = new Date();
    return Object.values(grupos)
      .sort((a,b) => a.descricao.localeCompare(b.descricao))
      .map(g => {
        const historico = Array.from({ length: 4 }, (_, i) => {
          const d = new Date(hoje4.getFullYear(), hoje4.getMonth()-3+i, 1);
          const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
          const label = d.toLocaleString("pt-BR",{month:"short"}).replace(/^\w/,c=>c.toUpperCase());
          const entry = g.entries.find(e => monthKey(e.data_vencimento) === mk);
          return { mk, label, status: entry?.status || null };
        });
        return { ...g, historico };
      });
  }, [itens]);

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
      if (filtro==="Ciclo 1"    && !inCiclo(l, 1)) return false;
      if (filtro==="Ciclo 2"    && !inCiclo(l, 2)) return false;
      if (filtro==="Recorrentes"&& !l.recorrente)  return false;
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

  // Cria a entrada do PRÓXIMO mês para um lançamento recorrente.
  // Busca a data mais recente já existente para este recorrente e avança 1 mês.
  const criarProximoRecorrente = async (entry) => {
    if (!entry.recorrente || !entry.data_vencimento) return;
    const empId = entry.empresa_id || user?.empresa_id;
    const { data: latest } = await supabase
      .from("financeiro_lancamentos")
      .select("data_vencimento")
      .eq("empresa_id", empId)
      .eq("descricao", entry.descricao)
      .eq("tipo", entry.tipo)
      .eq("recorrente", true)
      .order("data_vencimento", { ascending: false })
      .limit(1);
    if (!latest?.[0]) return;
    const nextDate = gerarDatasRecorrentes(latest[0].data_vencimento, 2)[1];
    await supabase.from("financeiro_lancamentos").insert({
      empresa_id: empId,
      tipo:       entry.tipo,
      categoria:  entry.categoria  || null,
      descricao:  entry.descricao,
      valor:      parseFloat(entry.valor),
      data_vencimento: nextDate,
      data_pagamento:  null,
      status:     "pendente",
      conta:      entry.conta      || "Conta Principal",
      recorrente: true,
      observacao: entry.observacao || null,
    });
  };

  const save = async () => {
    if (!form.descricao.trim()) { setErr("Descrição é obrigatória."); return; }
    if (!form.valor || parseFloat(form.valor)<=0) { setErr("Valor deve ser maior que zero."); return; }
    setSaving(true); setErr("");
    const base = { ...form, valor:parseFloat(form.valor), empresa_id:user?.empresa_id };

    if (edit) {
      const { error: updErr } = await update(edit, base);
      if (updErr) { setErr(updErr.message||"Erro ao salvar."); setSaving(false); return; }
      // Se agora é recorrente, verifica se já existe entrada futura; se não, cria a do próximo mês
      if (form.recorrente && form.data_vencimento) {
        const { data: futuras } = await supabase
          .from("financeiro_lancamentos")
          .select("id")
          .eq("empresa_id", base.empresa_id)
          .eq("descricao", base.descricao)
          .eq("tipo", base.tipo)
          .eq("recorrente", true)
          .gt("data_vencimento", base.data_vencimento)
          .limit(1);
        if (!futuras?.length) await criarProximoRecorrente(base);
      }
    } else if (form.recorrente && form.data_vencimento) {
      // Criação: insere a entrada atual + a do próximo mês (rolling automático)
      const [dt0, dt1] = gerarDatasRecorrentes(form.data_vencimento, 2);
      const { error } = await supabase.from("financeiro_lancamentos").insert([
        { ...base, data_vencimento: dt0, status: base.status, data_pagamento: base.data_pagamento||null },
        { ...base, data_vencimento: dt1, status: "pendente",  data_pagamento: null },
      ]);
      if (error) { setErr(error.message||"Erro ao salvar."); setSaving(false); return; }
    } else {
      const { error } = await insert(base);
      if (error) { setErr(error.message||"Erro ao salvar."); setSaving(false); return; }
    }

    refetch(); setModal(false);
    setSaving(false);
  };

  // Ao marcar pago: se recorrente, avança o ciclo criando o mês seguinte ao último existente
  const marcarPago = async (l) => {
    await update(l.id, { status:"pago", data_pagamento: hoje });
    if (l.recorrente) await criarProximoRecorrente(l);
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

      {ehC4hub && (
        <Row gap={6} mb={14}>
          {[["lancamentos","💰 Lançamentos"],["contratos","💳 Cobranças"]].map(([id,label])=>(
            <button key={id} onClick={()=>setAba(id)} style={{
              padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer",
              fontFamily:"inherit", border:`1.5px solid ${aba===id?L.teal:L.line}`,
              background: aba===id?L.teal:L.surface, color: aba===id?"#fff":L.t3,
            }}>{label}</button>
          ))}
        </Row>
      )}

      {aba === "contratos" && ehC4hub ? (
        <ContratosTab
          contratos={contratos}
          onAbrir={setContratoEmpresa}
        />
      ) : (
      <>

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
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginBottom:14}} className="rg-auto">
        {[
          { l:"Receitas",         v:fmt(receitas),   c:L.green,  bg:L.greenBg,   icon:"↑",  cnt:`${cntRec} pago${cntRec!==1?"s":""}` },
          { l:"Despesas",         v:fmt(despesas),   c:L.red,    bg:L.redBg,     icon:"↓",  cnt:`${cntDesp} pago${cntDesp!==1?"s":""}` },
          { l:"Lucro Líquido",    v:fmt(lucro),      c:lucro>=0?L.teal:L.red, bg:lucro>=0?L.tealBg:L.redBg, icon:"=", cnt:lucro>=0?"positivo":"negativo" },
          { l:"A Receber — C1",   v:fmt(aReceberC1), c:L.copper, bg:L.copperBg,  icon:"⌛", cnt:`${cntRcbC1} em aberto • até 5º dia útil`,
            onClick:()=>{setFiltro("Ciclo 1");} },
          { l:"A Receber — C2",   v:fmt(aReceberC2), c:L.teal,   bg:L.tealBg,    icon:"⌛", cnt:`${cntRcbC2} em aberto • dia 15`,
            onClick:()=>{setFiltro("Ciclo 2");} },
          { l:"A Pagar",          v:fmt(aPagar),     c:L.yellow, bg:L.yellowBg,  icon:"📋", cnt:`${cntPag} em aberto` },
        ].map((k,i)=>(
          <div key={i} style={{...kpiCard(k.c), cursor:k.onClick?"pointer":"default"}}
            onClick={k.onClick} title={k.onClick?"Filtrar por este ciclo":undefined}>
            <div style={kpiIcon(k.bg, k.c)}>{k.icon}</div>
            <div style={{fontSize:9,color:L.t4,textTransform:"uppercase",letterSpacing:"1.2px",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{k.l}</div>
            <div style={{fontSize:20,fontWeight:800,color:k.c,fontFamily:"'Outfit',sans-serif",lineHeight:1.15,marginTop:1}}>{k.v}</div>
            <div style={{fontSize:10,color:L.t4,marginTop:2}}>{k.cnt}</div>
          </div>
        ))}
      </div>

      {/* Despesas/Receitas Fixas (recorrentes) */}
      {recorrentesGrupos.length > 0 && (
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:L.t2,textTransform:"uppercase",letterSpacing:"1.2px",fontFamily:"'JetBrains Mono',monospace"}}>
              🔄 Lançamentos Fixos — {recorrentesGrupos.length} ativo{recorrentesGrupos.length!==1?"s":""}
            </div>
            <button onClick={()=>setFiltro("Recorrentes")}
              style={{fontSize:10,padding:"2px 10px",borderRadius:6,border:`1px solid ${L.line}`,
                background:L.surface,color:L.t3,cursor:"pointer",fontFamily:"inherit"}}>
              Ver todos na tabela
            </button>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${L.line}`}}>
                  {["Descrição","Categoria","Dia","Valor/mês","Total/ano",...(recorrentesGrupos[0]?.historico||[]).map(h=>h.label),""].map((h,i)=>(
                    <th key={i} style={{...TD,fontWeight:700,color:L.t4,fontSize:9.5,textTransform:"uppercase",
                      letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace",textAlign:i>=5?"center":"left"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recorrentesGrupos.map((g,gi)=>(
                  <tr key={gi} style={{borderBottom:`1px solid ${L.lineSoft}`}}
                    onMouseEnter={e=>e.currentTarget.style.background=L.surface}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{...TD,fontWeight:600,color:L.t1}}>
                      🔄 {g.descricao}
                    </td>
                    <td style={{...TD,color:L.t3}}>{g.categoria}</td>
                    <td style={{...TD,color:L.t4,fontFamily:"'JetBrains Mono',monospace"}}>
                      {g.dia ? `Dia ${g.dia}` : "—"}
                    </td>
                    <td style={{...TD,fontWeight:700,color:g.tipo==="receita"?L.green:L.red,fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap"}}>
                      {fmt(g.valor)}
                    </td>
                    <td style={{...TD,color:L.t3,fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap"}}>
                      {fmt(g.valor*12)}
                    </td>
                    {g.historico.map((h,hi)=>{
                      const sc = {pago:L.green,pendente:L.yellow,atrasado:L.red,cancelado:L.t4};
                      const sb = {pago:L.greenBg,pendente:L.yellowBg,atrasado:L.redBg,cancelado:L.surface};
                      return (
                        <td key={hi} style={{...TD,textAlign:"center"}}>
                          {h.status ? (
                            <span style={{
                              display:"inline-block",padding:"2px 6px",borderRadius:5,fontSize:9.5,fontWeight:700,
                              color:sc[h.status]||L.t4,background:sb[h.status]||L.surface,
                            }}>{h.status==="atrasado"?"⚠":h.status==="pago"?"✓":h.status==="pendente"?"…":"—"}</span>
                          ) : <span style={{color:L.lineSoft}}>—</span>}
                        </td>
                      );
                    })}
                    <td style={TD}/>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
        <TabPills tabs={["Todos","Receitas","Despesas","Pendente","Atrasado","Recorrentes","Ciclo 1","Ciclo 2"]} active={filtro} onChange={t=>{setFiltro(t);}}/>

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
                <div style={{display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  {l.recorrente&&<span title="Lançamento recorrente" style={{fontSize:11,color:L.teal,flexShrink:0}}>🔄</span>}
                  <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{l.descricao}</span>
                </div>
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

          {/* Recorrente */}
          <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${L.lineSoft}`}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",userSelect:"none"}}>
              <div onClick={()=>F("recorrente")(!form.recorrente)} style={{
                width:16,height:16,borderRadius:4,flexShrink:0,cursor:"pointer",transition:"all .12s",
                border:`2px solid ${form.recorrente?L.teal:L.line}`,
                background:form.recorrente?L.teal:"transparent",
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>
                {form.recorrente&&<span style={{color:"white",fontSize:10,lineHeight:1,fontWeight:700}}>✓</span>}
              </div>
              <span style={{fontSize:12,color:L.t2}}>🔄 Lançamento recorrente — repete todo mês na mesma data</span>
            </label>

            {form.recorrente && form.data_vencimento && (() => {
              const d = new Date(form.data_vencimento+"T12:00:00");
              const dia = d.getDate();
              const proximo = new Date(d.getFullYear(), d.getMonth()+1, dia);
              const proximoLabel = proximo.toLocaleDateString("pt-BR");
              return (
                <div style={{marginTop:10,padding:"10px 12px",background:L.tealBg,borderRadius:8,
                  border:`1px solid ${L.tealA}`,fontSize:11.5,color:L.teal,lineHeight:1.6}}>
                  <b>Ciclo automático:</b> a próxima entrada será dia <b>{proximoLabel}</b> com status <b>pendente</b>.<br/>
                  Ao marcar como pago, o mês seguinte é criado automaticamente — sempre 1 mês à frente.
                </div>
              );
            })()}
            {form.recorrente && !form.data_vencimento && (
              <div style={{marginTop:8,fontSize:11,color:L.yellow}}>⚠ Defina a data de vencimento para ativar o ciclo recorrente.</div>
            )}
          </div>

          {err&&<div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginTop:8}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={save} loading={saving}
            label={edit ? "Salvar Alterações" : "Criar Lançamento"}/>
        </Modal>
      )}
      </>
      )}

      {contratoEmpresa && (
        <ModalCobranca
          empresa={contratoEmpresa}
          onClose={() => setContratoEmpresa(null)}
          onSaved={() => carregarContratos()}
        />
      )}
    </Fade>
  );
}

// Lista o que cada cliente paga por mês, com acesso à configuração de cobrança.
function ContratosTab({ contratos, onAbrir }) {
  const fmt = (v) => v == null ? "—"
    : `R$ ${Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;

  const proximaFatura = (dia) => {
    const d = parseInt(dia);
    if (isNaN(d)) return "—";
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    let venc = new Date(hoje.getFullYear(), hoje.getMonth(), d);
    if (venc <= hoje) venc = new Date(hoje.getFullYear(), hoje.getMonth()+1, d);
    return venc.toLocaleDateString("pt-BR");
  };

  const total = contratos.reduce((s,c) => s + (Number(c.valor_mensal) || 0), 0);

  return (
    <div>
      <Row between mb={12}>
        <div style={{fontSize:13,fontWeight:700,color:L.t1}}>
          Cobranças
          <span style={{fontSize:11,fontWeight:400,color:L.t3,marginLeft:8}}>
            {contratos.filter(c=>c.configurado).length} configurada{contratos.filter(c=>c.configurado).length!==1?"s":""}
            {contratos.some(c=>!c.configurado) && (
              <span style={{color:L.yellow,marginLeft:8}}>
                · {contratos.filter(c=>!c.configurado).length} sem cobrança
              </span>
            )}
          </span>
        </div>
        <div style={{fontSize:12,color:L.green,fontWeight:700}}>
          {fmt(total)} <span style={{color:L.t3,fontWeight:400}}>por mês</span>
        </div>
      </Row>

      <DataTable heads={["Cliente","Produto","Valor","Cobrança","Vencimento","Próx. fatura","Ações"]}>
        {contratos.map(c => (
          <tr key={c.empresa_id} style={{opacity: c.configurado ? 1 : 0.75}}>
            <td style={TD}>
              <div style={{fontWeight:600,color:L.t1}}>{c.empresas?.nome || "—"}</div>
              {!c.configurado ? (
                <div style={{fontSize:10,color:L.yellow}}>sem cobrança configurada</div>
              ) : c.ativo === false ? (
                <div style={{fontSize:10,color:L.yellow}}>cobrança desativada</div>
              ) : null}
            </td>
            {c.configurado ? (
              <>
                <td style={TD}>{c.produto_nome || "—"}</td>
                <td style={{...TD,color:L.green,fontWeight:700}}>{fmt(c.valor_mensal)}</td>
                <td style={TD}>
                  {c.frequencia === "ONE_TIME" ? "Avulsa" :
                   c.frequencia === "WEEKLY" ? "Semanal" :
                   c.frequencia === "SEMIANNUALLY" ? "Semestral" :
                   c.frequencia === "ANNUALLY" ? "Anual" : "Mensal"}
                </td>
                <td style={TD}>Dia {c.dia_vencimento}</td>
                <td style={TD}>{proximaFatura(c.dia_vencimento)}</td>
              </>
            ) : (
              // Cliente ainda sem cobrança: as colunas de valor não têm o que
              // mostrar, e o vazio destaca quem precisa ser configurado.
              <td colSpan={5} style={{...TD,color:L.t4,fontSize:11.5}}>
                Configure valor, vencimento e forma de pagamento para começar a cobrar.
              </td>
            )}
            <td style={TD}>
              <Row gap={6}>
                <IBtn c={c.configurado ? L.copper : L.teal}
                  onClick={()=>onAbrir({ id: c.empresa_id, nome: c.empresas?.nome, telefone: null })}>
                  {c.configurado ? "💳 Configurar" : "＋ Configurar"}
                </IBtn>
                {c.abacatepay_url && (
                  <IBtn c={L.teal} onClick={()=>window.open(c.abacatepay_url,"_blank")}>🔗 Link</IBtn>
                )}
              </Row>
            </td>
          </tr>
        ))}
      </DataTable>

      {contratos.length === 0 && (
        <div style={{padding:"30px 0",textAlign:"center",color:L.t3,fontSize:12,lineHeight:1.6}}>
          Nenhum cliente cadastrado ainda.
        </div>
      )}
    </div>
  );
}
