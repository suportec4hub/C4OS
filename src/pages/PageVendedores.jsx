import { useState, useEffect, useCallback } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Fade, Row, Grid, Card, Tag, Av } from "../components/ui";
import Modal, { Field, Input, ModalFooter } from "../components/Modal";

const fmtBRL = (v) => Number(v||0).toLocaleString("pt-BR", { style:"currency", currency:"BRL", minimumFractionDigits:0 });
const fmtPct = (n, d) => d > 0 ? `${Math.round((n/d)*100)}%` : "—";
const mesLabel = (m) => {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo)-1, 1).toLocaleString("pt-BR", { month:"long", year:"numeric" });
};

const MEDAL = ["🥇","🥈","🥉"];
const RANK_COLORS = [L.yellow, L.t3, "#cd7f32"];

// KPI box pequeno
function KPI({ label, value, color = L.teal, sub }) {
  return (
    <div style={{ background:L.white, border:`1px solid ${L.line}`, borderRadius:10, padding:"12px 14px" }}>
      <div style={{ fontSize:9, color:L.t4, fontFamily:"'JetBrains Mono',monospace", letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:19, fontWeight:800, color, fontFamily:"'Outfit',sans-serif", lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:L.t4, marginTop:3 }}>{sub}</div>}
    </div>
  );
}

// Barra de progresso da meta
function MetaBar({ realizado, meta }) {
  const pct = meta > 0 ? Math.min(100, Math.round((realizado/meta)*100)) : 0;
  const color = pct >= 100 ? L.green : pct >= 70 ? L.teal : pct >= 40 ? L.yellow : L.red;
  return (
    <div>
      <Row between style={{ marginBottom:3 }}>
        <span style={{ fontSize:10, color:L.t4 }}>Meta: {fmtBRL(meta)}</span>
        <span style={{ fontSize:10, fontWeight:700, color }}>{pct}%</span>
      </Row>
      <div style={{ height:5, borderRadius:3, background:L.surface, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:3, transition:"width .4s" }}/>
      </div>
    </div>
  );
}

export default function PageVendedores({ user }) {
  const hoje = new Date();
  const [mes, setMes] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}`);
  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null); // vendedor selecionado para detalhe
  const [metaModal, setMetaModal] = useState(null); // { vendedor, valor }
  const [metaVal, setMetaVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [dealsVend, setDealsVend] = useState([]); // deals do vendedor selecionado
  const [tab, setTab] = useState("ranking"); // ranking | deals | metas

  const load = useCallback(async () => {
    if (!user?.empresa_id) return;
    setLoading(true);

    const [
      { data: usrs },
      { data: deals },
      { data: vendas },
      { data: metas },
    ] = await Promise.all([
      supabase.from("usuarios")
        .select("id, nome, cargo, foto_url, cor, ativo, role")
        .eq("empresa_id", user.empresa_id)
        .neq("role", "c4hub_admin")
        .eq("ativo", true)
        .order("nome"),
      supabase.from("deals")
        .select("id, titulo, valor, etapa, responsavel_id, updated_at, created_at")
        .eq("empresa_id", user.empresa_id),
      supabase.from("vendas_realizadas")
        .select("*")
        .eq("empresa_id", user.empresa_id)
        .eq("mes", mes),
      supabase.from("metas_vendedores")
        .select("*")
        .eq("empresa_id", user.empresa_id)
        .eq("mes", mes),
    ]);

    const enrich = (usrs||[]).map(u => {
      const meusMetas = (metas||[]).find(m => m.usuario_id === u.id);
      const meta = Number(meusMetas?.meta_individual || 0);

      // Deals fechados atribuídos a este vendedor (all time)
      const fechados = (deals||[]).filter(d => d.responsavel_id === u.id && d.etapa === "fechado");
      const emAberto = (deals||[]).filter(d => d.responsavel_id === u.id && !["fechado","perdido"].includes(d.etapa));
      const perdidos  = (deals||[]).filter(d => d.responsavel_id === u.id && d.etapa === "perdido");

      // Vendas do mês (via tabela vendas_realizadas — alimentada pelo trigger)
      const vendasMes = (vendas||[]).filter(v => v.usuario_id === u.id);
      const valorMes  = vendasMes.reduce((s, v) => s + Number(v.valor||0), 0);
      const qtdMes    = vendasMes.length;

      // All-time stats (direto dos deals)
      const valorTotal = fechados.reduce((s, d) => s + Number(d.valor||0), 0);
      const conv = (fechados.length + perdidos.length) > 0
        ? Math.round((fechados.length / (fechados.length + perdidos.length)) * 100)
        : null;

      return {
        ...u,
        meta,
        // Mês atual
        valorMes, qtdMes,
        pctMeta: meta > 0 ? Math.round((valorMes/meta)*100) : null,
        // All time
        qtdFechados: fechados.length,
        valorTotal,
        qtdAberto: emAberto.length,
        qtdPerdidos: perdidos.length,
        conv,
        deals: deals.filter(d => d.responsavel_id === u.id),
      };
    });

    // Ordena por valor do mês (ranking)
    enrich.sort((a, b) => b.valorMes - a.valorMes || b.qtdMes - a.qtdMes);
    setVendedores(enrich);
    setLoading(false);
  }, [user?.empresa_id, mes]);

  useEffect(() => { load(); }, [load]);

  // Meses disponíveis (6 últimos + próximo)
  const meses = [];
  for (let i = -1; i <= 5; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }

  const salvarMeta = async () => {
    if (!metaModal) return;
    setSaving(true);
    const val = Number(metaVal) || 0;
    await supabase.from("metas_vendedores").upsert({
      empresa_id: user.empresa_id,
      usuario_id: metaModal.id,
      mes,
      meta_individual: val,
    }, { onConflict: "empresa_id,usuario_id,mes" });
    setSaving(false);
    setMetaModal(null);
    setMetaVal("");
    load();
  };

  // Stats gerais do mês
  const totalMes   = vendedores.reduce((s, v) => s + v.valorMes, 0);
  const totalMeta  = vendedores.reduce((s, v) => s + v.meta, 0);
  const qtdMes     = vendedores.reduce((s, v) => s + v.qtdMes, 0);
  const comMeta    = vendedores.filter(v => v.meta > 0).length;
  const atingiram  = vendedores.filter(v => v.meta > 0 && v.pctMeta >= 100).length;

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"50vh", gap:10, flexDirection:"column" }}>
      <div style={{ width:28, height:28, borderRadius:"50%", border:`3px solid ${L.tealA2}`, borderTopColor:L.accent, animation:"spin 0.8s linear infinite" }}/>
      <span style={{ fontSize:12, color:L.t4 }}>Carregando vendedores...</span>
    </div>
  );

  return (
    <Fade>
      {/* Header */}
      <Row between mb={16} style={{ flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:L.t1, fontFamily:"'Outfit',sans-serif" }}>Gerência de Vendedores</div>
          <div style={{ fontSize:12, color:L.t3, marginTop:2 }}>Performance e metas por vendedor</div>
        </div>
        <Row gap={8} style={{ flexWrap:"wrap" }}>
          <select value={mes} onChange={e=>setMes(e.target.value)}
            style={{ background:L.surface, border:`1px solid ${L.line}`, borderRadius:8, padding:"7px 12px", fontSize:12, color:L.t1, fontFamily:"inherit", cursor:"pointer" }}>
            {meses.map(m => <option key={m} value={m}>{mesLabel(m)}</option>)}
          </select>
          <button onClick={load}
            style={{ background:L.surface, border:`1px solid ${L.line}`, borderRadius:8, padding:"7px 12px", fontSize:12, color:L.t2, cursor:"pointer", fontFamily:"inherit" }}>
            ↺ Atualizar
          </button>
        </Row>
      </Row>

      {/* KPIs do mês */}
      <Grid cols={5} gap={10} mb={18} responsive>
        <KPI label="Receita do mês"   value={fmtBRL(totalMes)}   color={L.green} sub={`Meta: ${fmtBRL(totalMeta)}`}/>
        <KPI label="Deals fechados"   value={qtdMes}             color={L.teal}  sub="no mês atual"/>
        <KPI label="% da meta geral"  value={fmtPct(totalMes, totalMeta)} color={totalMeta > 0 && totalMes >= totalMeta ? L.green : L.yellow}/>
        <KPI label="Com meta definida" value={comMeta}           color={L.blue}  sub={`de ${vendedores.length} ativos`}/>
        <KPI label="Atingiram meta"   value={atingiram}          color={L.green} sub={`de ${comMeta} com meta`}/>
      </Grid>

      {/* Tabs */}
      <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${L.line}`, marginBottom:16 }}>
        {[
          { id:"ranking", label:"🏆 Ranking" },
          { id:"cards",   label:"◉ Cards" },
          { id:"metas",   label:"🎯 Metas" },
        ].map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ padding:"9px 18px", border:"none", background:"none", fontFamily:"inherit",
              fontSize:12, fontWeight:tab===t.id?700:400, cursor:"pointer",
              color:tab===t.id?L.t1:L.t3,
              borderBottom:tab===t.id?`2px solid ${L.accent}`:"2px solid transparent",
              transition:"all .12s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RANKING ── */}
      {tab === "ranking" && (
        <div>
          {/* Pódio top-3 */}
          {vendedores.length >= 3 && (
            <div style={{ display:"flex", gap:12, justifyContent:"center", marginBottom:20, flexWrap:"wrap" }}>
              {[vendedores[1], vendedores[0], vendedores[2]].map((v, i) => {
                if (!v) return null;
                const realPos = i === 1 ? 0 : i === 0 ? 1 : 2;
                const heights = [130, 160, 110];
                const mc = RANK_COLORS[realPos];
                return (
                  <div key={v.id} onClick={()=>setSel(v)}
                    style={{ display:"flex", flexDirection:"column", alignItems:"center", cursor:"pointer",
                      background:L.white, border:`2px solid ${realPos===0?L.yellow:L.line}`,
                      borderRadius:14, padding:"16px 20px", width:150, justifyContent:"flex-end",
                      minHeight:heights[i], boxShadow:realPos===0?"0 4px 24px rgba(0,0,0,0.12)":"0 1px 4px rgba(0,0,0,0.05)",
                      transition:"transform .15s" }}
                    onMouseEnter={e=>e.currentTarget.style.transform="translateY(-3px)"}
                    onMouseLeave={e=>e.currentTarget.style.transform="none"}>
                    <div style={{ fontSize:24, marginBottom:4 }}>{MEDAL[realPos]}</div>
                    <Av name={v.nome} size={40} color={mc} src={v.foto_url}/>
                    <div style={{ fontSize:12, fontWeight:700, color:L.t1, marginTop:8, textAlign:"center" }}>{v.nome.split(" ")[0]}</div>
                    <div style={{ fontSize:11, color:mc, fontWeight:700, fontFamily:"'Outfit',sans-serif", marginTop:2 }}>{fmtBRL(v.valorMes)}</div>
                    <div style={{ fontSize:10, color:L.t4 }}>{v.qtdMes} fechado{v.qtdMes!==1?"s":""}</div>
                    {v.meta > 0 && <div style={{ marginTop:6, width:"100%" }}><MetaBar realizado={v.valorMes} meta={v.meta}/></div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Tabela completa */}
          <div style={{ background:L.white, borderRadius:12, border:`1px solid ${L.line}`, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:L.surface, borderBottom:`2px solid ${L.line}` }}>
                  {["#","Vendedor","Cargo","Fechados/Mês","Receita/Mês","Meta","Ating.","Em aberto","Taxa conv.",""].map(h => (
                    <th key={h} style={{ padding:"9px 14px", textAlign:"left", fontSize:9, fontWeight:700, color:L.t4, letterSpacing:"1.2px", textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendedores.map((v, i) => {
                  const pct = v.pctMeta;
                  const pctColor = pct === null ? L.t4 : pct >= 100 ? L.green : pct >= 70 ? L.teal : pct >= 40 ? L.yellow : L.red;
                  return (
                    <tr key={v.id}
                      style={{ borderBottom:`1px solid ${L.lineSoft}`, cursor:"pointer", transition:"background .1s" }}
                      onClick={()=>setSel(v)}
                      onMouseEnter={e=>e.currentTarget.style.background=L.surface}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding:"11px 14px" }}>
                        <span style={{ fontSize:16 }}>{MEDAL[i] || `${i+1}`}</span>
                      </td>
                      <td style={{ padding:"11px 14px" }}>
                        <Row gap={8}>
                          <Av name={v.nome} size={30} color={v.cor||L.teal} src={v.foto_url}/>
                          <span style={{ fontSize:12.5, fontWeight:600, color:L.t1 }}>{v.nome}</span>
                        </Row>
                      </td>
                      <td style={{ padding:"11px 14px", fontSize:11.5, color:L.t3 }}>{v.cargo||"—"}</td>
                      <td style={{ padding:"11px 14px" }}>
                        <div style={{ fontSize:15, fontWeight:700, color:L.teal, fontFamily:"'Outfit',sans-serif" }}>{v.qtdMes}</div>
                      </td>
                      <td style={{ padding:"11px 14px" }}>
                        <div style={{ fontSize:14, fontWeight:700, color:L.green, fontFamily:"'Outfit',sans-serif" }}>{fmtBRL(v.valorMes)}</div>
                      </td>
                      <td style={{ padding:"11px 14px" }}>
                        {v.meta > 0
                          ? <div style={{ minWidth:90 }}><MetaBar realizado={v.valorMes} meta={v.meta}/></div>
                          : <button onClick={e=>{e.stopPropagation();setMetaModal(v);setMetaVal("");}}
                              style={{ fontSize:10, color:L.teal, background:L.tealBg, border:`1px solid ${L.tealA}`, borderRadius:6, padding:"2px 8px", cursor:"pointer", fontFamily:"inherit" }}>
                              + Definir meta
                            </button>
                        }
                      </td>
                      <td style={{ padding:"11px 14px" }}>
                        <Tag color={pctColor} bg={L.surface} small>{pct !== null ? `${pct}%` : "—"}</Tag>
                      </td>
                      <td style={{ padding:"11px 14px", fontSize:12, color:L.blue }}>{v.qtdAberto}</td>
                      <td style={{ padding:"11px 14px" }}>
                        <Tag color={v.conv>=60?L.green:v.conv>=30?L.yellow:L.red} bg={L.surface} small>
                          {v.conv !== null ? `${v.conv}%` : "—"}
                        </Tag>
                      </td>
                      <td style={{ padding:"11px 14px" }}>
                        <button onClick={e=>{e.stopPropagation();setMetaModal(v);setMetaVal(String(v.meta||""));}}
                          style={{ fontSize:10, color:L.t3, background:"none", border:`1px solid ${L.line}`, borderRadius:6, padding:"3px 8px", cursor:"pointer", fontFamily:"inherit" }}
                          onMouseEnter={e=>{e.currentTarget.style.color=L.teal;e.currentTarget.style.borderColor=L.teal;}}
                          onMouseLeave={e=>{e.currentTarget.style.color=L.t3;e.currentTarget.style.borderColor=L.line;}}>
                          🎯 Meta
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {vendedores.length === 0 && (
              <div style={{ padding:40, textAlign:"center", color:L.t4, fontSize:12 }}>
                Nenhum vendedor cadastrado.<br/>
                <span style={{ fontSize:11 }}>Adicione usuários na tela de Equipe e atribua deals no Pipeline.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CARDS ── */}
      {tab === "cards" && (
        <Grid cols={3} gap={14} responsive>
          {vendedores.map((v, i) => (
            <div key={v.id}
              style={{ background:L.white, border:`1.5px solid ${i===0&&v.qtdMes>0?L.yellow:L.line}`,
                borderRadius:14, padding:20, cursor:"pointer", transition:"all .15s",
                boxShadow:i===0&&v.qtdMes>0?"0 4px 20px rgba(0,0,0,0.1)":"0 1px 3px rgba(0,0,0,0.04)" }}
              onClick={()=>setSel(v)}
              onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
              onMouseLeave={e=>e.currentTarget.style.transform="none"}>
              <Row gap={12} mb={14}>
                <Av name={v.nome} size={44} color={v.cor||L.teal} src={v.foto_url}/>
                <div style={{ flex:1 }}>
                  <Row between>
                    <div style={{ fontSize:14, fontWeight:700, color:L.t1 }}>{v.nome}</div>
                    {i < 3 && v.qtdMes > 0 && <span style={{ fontSize:18 }}>{MEDAL[i]}</span>}
                  </Row>
                  <div style={{ fontSize:11, color:L.t3 }}>{v.cargo||"Vendedor"}</div>
                </div>
              </Row>
              <Grid cols={2} gap={8} mb={12}>
                <div style={{ background:L.surface, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:800, color:L.teal, fontFamily:"'Outfit',sans-serif" }}>{v.qtdMes}</div>
                  <div style={{ fontSize:9, color:L.t4, textTransform:"uppercase", letterSpacing:"1px" }}>fechados/mês</div>
                </div>
                <div style={{ background:L.surface, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                  <div style={{ fontSize:13, fontWeight:800, color:L.green, fontFamily:"'Outfit',sans-serif" }}>{fmtBRL(v.valorMes)}</div>
                  <div style={{ fontSize:9, color:L.t4, textTransform:"uppercase", letterSpacing:"1px" }}>receita/mês</div>
                </div>
              </Grid>
              {v.meta > 0 && <MetaBar realizado={v.valorMes} meta={v.meta}/>}
              {!v.meta && (
                <button onClick={e=>{e.stopPropagation();setMetaModal(v);setMetaVal("");}}
                  style={{ width:"100%", padding:"6px", background:L.tealBg, border:`1px dashed ${L.tealA2}`, borderRadius:8, color:L.teal, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                  + Definir meta do mês
                </button>
              )}
              <Row gap={8} style={{ marginTop:10 }}>
                <Tag color={L.blue}   bg={L.blueBg}   small>{v.qtdAberto} em aberto</Tag>
                {v.conv !== null && <Tag color={v.conv>=60?L.green:L.yellow} bg={L.surface} small>{v.conv}% conv.</Tag>}
              </Row>
            </div>
          ))}
        </Grid>
      )}

      {/* ── METAS ── */}
      {tab === "metas" && (
        <div>
          <div style={{ marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:12, color:L.t3 }}>Metas de <b>{mesLabel(mes)}</b></span>
            <div style={{ marginLeft:"auto", fontSize:11, color:L.t4 }}>
              Clique em "Editar" para definir ou alterar a meta individual
            </div>
          </div>
          <div style={{ background:L.white, borderRadius:12, border:`1px solid ${L.line}`, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:L.surface, borderBottom:`2px solid ${L.line}` }}>
                  {["Vendedor","Meta Individual","Realizado","Atingimento","Diferença",""].map(h => (
                    <th key={h} style={{ padding:"9px 16px", textAlign:"left", fontSize:9, fontWeight:700, color:L.t4, letterSpacing:"1.2px", textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendedores.map((v) => {
                  const diff = v.valorMes - v.meta;
                  const pct = v.pctMeta;
                  const pctColor = pct === null ? L.t4 : pct >= 100 ? L.green : pct >= 70 ? L.teal : pct >= 40 ? L.yellow : L.red;
                  return (
                    <tr key={v.id} style={{ borderBottom:`1px solid ${L.lineSoft}` }}>
                      <td style={{ padding:"12px 16px" }}>
                        <Row gap={8}>
                          <Av name={v.nome} size={28} color={v.cor||L.teal} src={v.foto_url}/>
                          <div>
                            <div style={{ fontSize:12.5, fontWeight:600, color:L.t1 }}>{v.nome}</div>
                            <div style={{ fontSize:10.5, color:L.t3 }}>{v.cargo||"—"}</div>
                          </div>
                        </Row>
                      </td>
                      <td style={{ padding:"12px 16px" }}>
                        <div style={{ fontSize:14, fontWeight:700, color:L.t2, fontFamily:"'Outfit',sans-serif" }}>
                          {v.meta > 0 ? fmtBRL(v.meta) : <span style={{ color:L.t4, fontSize:12 }}>Não definida</span>}
                        </div>
                      </td>
                      <td style={{ padding:"12px 16px" }}>
                        <div style={{ fontSize:14, fontWeight:700, color:L.green, fontFamily:"'Outfit',sans-serif" }}>{fmtBRL(v.valorMes)}</div>
                        <div style={{ fontSize:10, color:L.t4 }}>{v.qtdMes} deal{v.qtdMes!==1?"s":""}</div>
                      </td>
                      <td style={{ padding:"12px 16px" }}>
                        {v.meta > 0
                          ? <div style={{ minWidth:100 }}><MetaBar realizado={v.valorMes} meta={v.meta}/></div>
                          : <span style={{ fontSize:11, color:L.t4 }}>—</span>}
                      </td>
                      <td style={{ padding:"12px 16px" }}>
                        {v.meta > 0 ? (
                          <span style={{ fontSize:13, fontWeight:700, color:diff>=0?L.green:L.red, fontFamily:"'Outfit',sans-serif" }}>
                            {diff >= 0 ? "+" : ""}{fmtBRL(diff)}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding:"12px 16px" }}>
                        <button onClick={()=>{setMetaModal(v);setMetaVal(String(v.meta||""));}}
                          style={{ fontSize:11, color:L.teal, background:L.tealBg, border:`1px solid ${L.tealA}`, borderRadius:7, padding:"5px 12px", cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                          ✎ Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Linha de totais */}
              {vendedores.length > 0 && (
                <tfoot>
                  <tr style={{ background:L.surface, borderTop:`2px solid ${L.line}` }}>
                    <td style={{ padding:"10px 16px", fontSize:11, fontWeight:700, color:L.t2 }}>TOTAL</td>
                    <td style={{ padding:"10px 16px", fontSize:13, fontWeight:700, color:L.t2, fontFamily:"'Outfit',sans-serif" }}>{fmtBRL(totalMeta)}</td>
                    <td style={{ padding:"10px 16px", fontSize:13, fontWeight:700, color:L.green, fontFamily:"'Outfit',sans-serif" }}>{fmtBRL(totalMes)}</td>
                    <td style={{ padding:"10px 16px" }}>
                      <MetaBar realizado={totalMes} meta={totalMeta}/>
                    </td>
                    <td style={{ padding:"10px 16px", fontSize:13, fontWeight:700, color:totalMes>=totalMeta?L.green:L.red, fontFamily:"'Outfit',sans-serif" }}>
                      {totalMeta > 0 ? `${totalMes>=totalMeta?"+":""}${fmtBRL(totalMes-totalMeta)}` : "—"}
                    </td>
                    <td/>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL DETALHE VENDEDOR ── */}
      {sel && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={()=>setSel(null)}>
          <div style={{ background:L.white, borderRadius:16, padding:28, width:560, maxHeight:"85vh", overflowY:"auto", boxShadow:"0 16px 64px rgba(0,0,0,.25)", border:`1px solid ${L.line}` }}
            onClick={e=>e.stopPropagation()} className="modal-box">
            {/* Header */}
            <Row gap={14} mb={20}>
              <Av name={sel.nome} size={52} color={sel.cor||L.teal} src={sel.foto_url}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:16, fontWeight:800, color:L.t1 }}>{sel.nome}</div>
                <div style={{ fontSize:12, color:L.t3 }}>{sel.cargo||"Vendedor"}</div>
                <Row gap={6} style={{ marginTop:6 }}>
                  <Tag color={L.green} bg={L.greenBg} small>{sel.qtdFechados} fechados (all time)</Tag>
                  <Tag color={L.blue}  bg={L.blueBg}  small>{sel.qtdAberto} em aberto</Tag>
                </Row>
              </div>
              <button onClick={()=>setSel(null)} style={{ background:"none", border:"none", cursor:"pointer", color:L.t4, fontSize:18 }}>✕</button>
            </Row>

            {/* KPIs */}
            <Grid cols={3} gap={10} mb={18}>
              <KPI label={`Receita ${mesLabel(mes).split(" ")[0]}`} value={fmtBRL(sel.valorMes)} color={L.green}/>
              <KPI label="Meta do mês" value={sel.meta>0?fmtBRL(sel.meta):"—"} color={L.teal}/>
              <KPI label="Atingimento" value={sel.pctMeta!==null?`${sel.pctMeta}%`:"—"} color={sel.pctMeta>=100?L.green:sel.pctMeta>=50?L.yellow:L.red}/>
            </Grid>
            {sel.meta > 0 && <div style={{ marginBottom:18 }}><MetaBar realizado={sel.valorMes} meta={sel.meta}/></div>}

            {/* Deals do vendedor */}
            <div style={{ fontSize:12, fontWeight:700, color:L.t1, marginBottom:10 }}>
              Deals atribuídos ({sel.deals?.length || 0})
            </div>
            <div style={{ maxHeight:220, overflowY:"auto" }}>
              {(sel.deals||[]).length === 0
                ? <div style={{ fontSize:12, color:L.t4, padding:16, textAlign:"center" }}>Nenhum deal atribuído</div>
                : (sel.deals||[]).sort((a,b) => b.etapa==="fechado"?1:-1).map(d => {
                    const isGanho  = d.etapa === "fechado";
                    const isPerdido= d.etapa === "perdido";
                    return (
                      <div key={d.id} style={{ display:"flex", gap:10, padding:"8px 0", borderBottom:`1px solid ${L.lineSoft}`, alignItems:"center" }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:isGanho?L.green:isPerdido?L.red:L.teal, flexShrink:0 }}/>
                        <div style={{ flex:1, fontSize:12, color:L.t1 }}>{d.titulo}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:isGanho?L.green:L.t2, fontFamily:"'Outfit',sans-serif", flexShrink:0 }}>
                          {fmtBRL(d.valor||0)}
                        </div>
                        <Tag color={isGanho?L.green:isPerdido?L.red:L.teal} bg={L.surface} small>
                          {isGanho?"Fechado":isPerdido?"Perdido":d.etapa}
                        </Tag>
                      </div>
                    );
                  })
              }
            </div>

            <div style={{ marginTop:18, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <button onClick={()=>{setSel(null);setMetaModal(sel);setMetaVal(String(sel.meta||""));}}
                style={{ background:L.tealBg, border:`1px solid ${L.tealA}`, borderRadius:8, padding:"8px 16px", fontSize:12, color:L.teal, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                🎯 Editar meta do mês
              </button>
              <button onClick={()=>setSel(null)}
                style={{ background:L.surface, border:`1px solid ${L.line}`, borderRadius:8, padding:"8px 16px", fontSize:12, color:L.t2, cursor:"pointer", fontFamily:"inherit" }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL META ── */}
      {metaModal && (
        <Modal title={`Meta de ${mesLabel(mes)}`} onClose={()=>setMetaModal(null)} width={380}>
          <Row gap={12} mb={16}>
            <Av name={metaModal.nome} size={40} color={metaModal.cor||L.teal} src={metaModal.foto_url}/>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:L.t1 }}>{metaModal.nome}</div>
              <div style={{ fontSize:11, color:L.t3 }}>{metaModal.cargo||"Vendedor"}</div>
            </div>
          </Row>
          <Field label="Meta individual (R$)">
            <Input value={metaVal} onChange={v=>setMetaVal(v)} type="number" placeholder="Ex: 50000"/>
          </Field>
          <div style={{ fontSize:11, color:L.t3, marginBottom:12 }}>
            Realizado até agora: <b style={{ color:L.green }}>{fmtBRL(metaModal.valorMes)}</b>
            {Number(metaVal) > 0 && ` · Atingimento projetado: ${Math.round((metaModal.valorMes/Number(metaVal))*100)}%`}
          </div>
          <ModalFooter onClose={()=>setMetaModal(null)} onSave={salvarMeta} loading={saving} label="Salvar meta"/>
        </Modal>
      )}
    </Fade>
  );
}
