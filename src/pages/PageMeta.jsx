import { useState, useEffect, useRef, useCallback } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { hasFullAccess } from "../lib/auth";

/* ── helpers ── */
const fmt  = v  => `R$ ${parseFloat(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const pct  = (r,m) => m > 0 ? Math.round((r/m)*100) : 0;
const cap  = v  => Math.min(v, 100);

// Parse valor em formato brasileiro: "1.500,50" → 1500.50
const parseBRL = v => {
  if (!v && v !== 0) return 0;
  return parseFloat(String(v).replace(/\./g,"").replace(",",".")) || 0;
};
// Formata número para exibição no input: 1500.5 → "1.500,50"
const fmtInput = v => {
  const n = parseFloat(v);
  if (!v || isNaN(n)) return "";
  return n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
};

const corStatus = p => p >= 100 ? "verde" : p >= 70 ? "amarelo" : "vermelho";
const corHex    = p => p >= 100 ? L.green  : p >= 70 ? L.yellow  : L.red;
const corBgHex  = p => p >= 100 ? L.greenBg: p >= 70 ? L.yellowBg: L.redBg;

const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
};
const mesLabel = m => {
  if (!m) return "";
  const [y,mo] = m.split("-");
  return new Date(Number(y), Number(mo)-1, 1)
    .toLocaleString("pt-BR",{month:"long",year:"numeric"})
    .replace(/^\w/,c=>c.toUpperCase());
};
const mesOffset = (m, n) => {
  const [y,mo] = m.split("-").map(Number);
  const d = new Date(y, mo-1+n, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
};
// Converte "2026-05" → { mes: 5, ano: 2026 }
const parseMesAno = m => { const [y,mo] = m.split("-").map(Number); return { mes: mo, ano: y }; };
const mesesOpcoes = () => {
  const list = [];
  const hoje = mesAtual();
  for (let i = -2; i <= 3; i++) list.push(mesOffset(hoje, i));
  return list;
};

/* ── componente barra de progresso ── */
function BarraMeta({ pctVal, cor, height=10, animated=true }) {
  return (
    <div style={{width:"100%",height,borderRadius:99,background:L.line,overflow:"hidden"}}>
      <div style={{
        width:`${cap(pctVal)}%`, height:"100%", borderRadius:99,
        background: cor,
        transition: animated ? "width .6s cubic-bezier(.4,0,.2,1)" : "none",
      }}/>
    </div>
  );
}

/* ── card de vendedor ── */
function CardVendedor({ v, mesesVermelhos, tv=false }) {
  const p = pct(v.realizado, v.meta);
  const st = corStatus(p);
  const alertaRed = mesesVermelhos >= 3;

  const fs = tv ? { nome:22, pct:28, val:13, bar:14 } : { nome:13, pct:18, val:11, bar:8 };

  return (
    <div style={{
      background: L.white, borderRadius: tv?16:10,
      border:`1.5px solid ${corHex(p)}44`,
      padding: tv?"20px 24px":"14px 16px",
      position:"relative", overflow:"hidden",
    }}>
      {/* faixa colorida topo */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:corHex(p)}}/>

      {/* alerta 3 meses vermelho */}
      {alertaRed && (
        <div style={{
          position:"absolute",top:tv?12:8,right:tv?12:8,
          background:L.redBg,border:`1px solid ${L.red}44`,
          borderRadius:6,padding:"2px 7px",
          fontSize:tv?11:9,fontWeight:700,color:L.red,
          fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.5px"
        }}>⚠ 3M VERMELHO</div>
      )}

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:tv?12:8}}>
        {/* avatar */}
        <div style={{
          width:tv?44:32,height:tv?44:32,borderRadius:"50%",
          background:corBgHex(p),border:`2px solid ${corHex(p)}66`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:tv?16:12,fontWeight:700,color:corHex(p),flexShrink:0
        }}>
          {v.nome.split(" ").slice(0,2).map(n=>n[0]).join("").toUpperCase()}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:fs.nome,fontWeight:600,color:L.t1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
            {v.nome}
          </div>
          <div style={{fontSize:fs.val-1,color:L.t3}}>{v.cargo||"Vendedor"}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:fs.pct,fontWeight:800,color:corHex(p),lineHeight:1}}>
            {p}%
          </div>
          <div style={{fontSize:fs.val-1,color:L.t4,fontFamily:"'JetBrains Mono',monospace"}}>{st}</div>
        </div>
      </div>

      <BarraMeta pctVal={p} cor={corHex(p)} height={fs.bar}/>

      <div style={{display:"flex",justifyContent:"space-between",marginTop:tv?10:6}}>
        <span style={{fontSize:fs.val,color:L.t3}}>Realizado: <b style={{color:L.t1}}>{fmt(v.realizado)}</b></span>
        <span style={{fontSize:fs.val,color:L.t3}}>Meta: <b style={{color:L.t2}}>{fmt(v.meta)}</b></span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════ PÁGINA ══ */
export default function PageMeta({ user }) {
  const isGestor  = hasFullAccess(user);
  const [tab, setTab]     = useState("painel");
  const [mes, setMes]     = useState(mesAtual());
  const [loading, setLoading] = useState(false);

  /* dados */
  const [metaEmpresa, setMetaEmpresa]     = useState(null);   // { meta_total }
  const [metasVend,   setMetasVend]       = useState([]);     // [{ usuario_id, meta_individual }]
  const [vendas,      setVendas]          = useState([]);     // [{ usuario_id, valor, ... }]
  const [usuarios,    setUsuarios]        = useState([]);     // todos da empresa
  const [historico,   setHistorico]       = useState({});     // { usuario_id: [p1,p2,p3] últimos 3 meses

  /* form config */
  const [fMetaTotal,        setFMetaTotal]        = useState("");
  const [fMetasInd,         setFMetasInd]         = useState({});     // { usuario_id: valor }
  const [selVendedores,     setSelVendedores]     = useState(new Set()); // ids marcados como vendedores
  const [savingMeta, setSavingMeta]   = useState(false);

  /* form venda */
  const [fVenda, setFVenda] = useState({ usuario_id:"", valor:"", descricao:"" });
  const [savingV, setSavingV] = useState(false);
  const [deleting, setDeleting] = useState(null);

  /* tv */
  const tvRef = useRef(null);
  const [tvFull, setTvFull] = useState(false);
  const tvTimer = useRef(null);

  /* ── fetch ── */
  const load = useCallback(async () => {
    if (!user?.empresa_id) return;
    setLoading(true);
    const eid = user.empresa_id;

    const { mes: mesInt, ano } = parseMesAno(mes);
    const [rMeta, rMV, rVendas, rUsuarios] = await Promise.all([
      supabase.from("metas").select("*").eq("empresa_id",eid).eq("mes",mesInt).eq("ano",ano).maybeSingle(),
      supabase.from("metas_vendedores").select("*").eq("empresa_id",eid).eq("mes",mes),
      supabase.from("vendas_realizadas").select("*").eq("empresa_id",eid).eq("mes",mes).order("created_at",{ascending:false}),
      supabase.from("usuarios").select("id,nome,cargo,role").eq("empresa_id",eid),
    ]);

    setMetaEmpresa(rMeta.data || null);
    setMetasVend(rMV.data   || []);
    setVendas(rVendas.data  || []);
    const usrs = (rUsuarios.data||[]).filter(u => u.ativo !== false);
    setUsuarios(usrs);

    // seed form
    setFMetaTotal(fmtInput(rMeta.data?.valor_total));
    const ind = {};
    const sel = new Set();
    (rMV.data||[]).forEach(mv => {
      ind[mv.usuario_id] = fmtInput(mv.meta_individual);
      sel.add(mv.usuario_id);
    });
    setFMetasInd(ind);
    setSelVendedores(sel);

    // histórico últimos 3 meses para cada vendedor
    const meses3 = [mesOffset(mes,-3), mesOffset(mes,-2), mesOffset(mes,-1)];
    const [h1,h2,h3] = await Promise.all(
      meses3.map(m3 => Promise.all([
        supabase.from("metas_vendedores").select("usuario_id,meta_individual").eq("empresa_id",eid).eq("mes",m3),
        supabase.from("vendas_realizadas").select("usuario_id,valor").eq("empresa_id",eid).eq("mes",m3),
      ]))
    );

    const hist = {};
    [[h1,0],[h2,1],[h3,2]].forEach(([pair,idx]) => {
      const [mvRes,vrRes] = pair;
      const mvMap = {};
      (mvRes.data||[]).forEach(r => { mvMap[r.usuario_id] = parseFloat(r.meta_individual||0); });
      const vrMap = {};
      (vrRes.data||[]).forEach(r => { vrMap[r.usuario_id] = (vrMap[r.usuario_id]||0) + parseFloat(r.valor||0); });
      usrs.forEach(u => {
        if (!hist[u.id]) hist[u.id] = [];
        const m = mvMap[u.id]||0;
        const r = vrMap[u.id]||0;
        hist[u.id][idx] = pct(r,m);
      });
    });
    setHistorico(hist);
    setLoading(false);
  }, [user?.empresa_id, mes]);

  useEffect(() => { load(); }, [load]);

  /* auto-refresh TV */
  useEffect(() => {
    if (tab === "tv") {
      tvTimer.current = setInterval(load, 30000);
    } else {
      clearInterval(tvTimer.current);
    }
    return () => clearInterval(tvTimer.current);
  }, [tab, load]);

  /* fullscreen TV */
  const toggleFull = () => {
    if (!tvFull) {
      tvRef.current?.requestFullscreen?.().catch(()=>{});
      setTvFull(true);
    } else {
      document.exitFullscreen?.().catch(()=>{});
      setTvFull(false);
    }
  };
  useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) setTvFull(false); };
    document.addEventListener("fullscreenechange", handler);
    return () => document.removeEventListener("fullscreenechange", handler);
  }, []);

  /* ── derived ── */
  // painel e TV: só quem tem registro em metas_vendedores (selecionados)
  const idsNoPanel = new Set(metasVend.map(mv => mv.usuario_id));
  const vendedores = usuarios
    .filter(u => idsNoPanel.has(u.id))
    .map(u => {
      const meta = parseFloat(metasVend.find(m=>m.usuario_id===u.id)?.meta_individual || 0);
      const realizado = vendas.filter(v=>v.usuario_id===u.id).reduce((s,v)=>s+parseFloat(v.valor||0),0);
      const hist3 = historico[u.id] || [0,0,0];
      const mesesVermelhos = hist3.filter(p=>p < 70).length;
      return { ...u, meta, realizado, mesesVermelhos };
    }).sort((a,b) => pct(b.realizado,b.meta) - pct(a.realizado,a.meta));

  const totalMeta      = parseFloat(metaEmpresa?.valor_total||0);
  const totalRealizado = vendas.reduce((s,v)=>s+parseFloat(v.valor||0),0);
  const pctTotal       = pct(totalRealizado, totalMeta);

  /* ── save meta empresa + individuais ── */
  const saveMetas = async () => {
    if (!user?.empresa_id) return;
    setSavingMeta(true);
    const eid = user.empresa_id;

    const { mes: mesInt, ano } = parseMesAno(mes);
    await supabase.from("metas").upsert(
      { empresa_id:eid, mes:mesInt, ano, valor_total:parseBRL(fMetaTotal), updated_at:new Date().toISOString() },
      { onConflict:"empresa_id,mes,ano" }
    );

    // remover desmarcados
    const toDelete = metasVend.filter(mv => !selVendedores.has(mv.usuario_id)).map(mv => mv.id);
    if (toDelete.length) {
      await supabase.from("metas_vendedores").delete().in("id", toDelete);
    }

    // upsert selecionados
    for (const uid of selVendedores) {
      await supabase.from("metas_vendedores").upsert(
        { empresa_id:eid, usuario_id:uid, mes, meta_individual:parseBRL(fMetasInd[uid]) },
        { onConflict:"empresa_id,usuario_id,mes" }
      );
    }
    await load();
    setSavingMeta(false);
  };

  /* ── save venda ── */
  const saveVenda = async () => {
    if (!fVenda.usuario_id || !fVenda.valor) return;
    setSavingV(true);
    await supabase.from("vendas_realizadas").insert({
      empresa_id: user.empresa_id,
      usuario_id: fVenda.usuario_id,
      mes,
      valor: parseBRL(fVenda.valor),
      descricao: fVenda.descricao||"",
    });
    setFVenda({ usuario_id:"", valor:"", descricao:"" });
    await load();
    setSavingV(false);
  };

  const deleteVenda = async (id) => {
    setDeleting(id);
    await supabase.from("vendas_realizadas").delete().eq("id",id);
    await load();
    setDeleting(null);
  };

  /* ── estilos comuns ── */
  const inpS = { width:"100%", padding:"9px 12px", borderRadius:8, border:`1.5px solid ${L.line}`, fontSize:13, fontFamily:"inherit", color:L.t1, background:L.white, outline:"none" };
  const btnS = { padding:"9px 18px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", border:"none", fontFamily:"inherit" };
  const labelS = { fontSize:11, fontWeight:600, color:L.t2, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.8px", fontFamily:"'JetBrains Mono',monospace" };

  /* ════════════════════ RENDER ════════════════════ */
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:L.bg}}>

      {/* Header */}
      <div style={{background:L.white,borderBottom:`1px solid ${L.line}`,padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexShrink:0}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:L.t1,fontFamily:"'Outfit',sans-serif",letterSpacing:"-.3px"}}>🎯 Metas</div>
          <div style={{fontSize:12,color:L.t3,marginTop:2}}>{mesLabel(mes)}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {/* seletor de mês */}
          <select value={mes} onChange={e=>setMes(e.target.value)}
            style={{...inpS,width:"auto",padding:"7px 12px",fontSize:12,cursor:"pointer"}}>
            {mesesOpcoes().map(m=>(
              <option key={m} value={m}>{mesLabel(m)}{m===mesAtual()?" (atual)":""}</option>
            ))}
          </select>
          {/* tabs */}
          {["painel","configurar","tv"].map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{...btnS,padding:"7px 16px",fontSize:12,
                background:tab===t?L.t1:L.surface,
                color:tab===t?L.white:L.t2,
                border:`1px solid ${tab===t?L.t1:L.line}`}}>
              {t==="tv"?"📺 TV":t==="configurar"?"⚙ Configurar":"📊 Painel"}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{flex:1,overflowY:"auto",padding:"24px"}}>

        {/* ══ PAINEL ══ */}
        {tab==="painel" && (
          <div>
            {/* KPIs empresa */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
              {[
                {label:"Meta Total Empresa",value:fmt(totalMeta),cor:L.t2},
                {label:"Realizado Total",value:fmt(totalRealizado),cor:pctTotal>=100?L.green:pctTotal>=70?L.yellow:L.red},
                {label:"% Atingido",value:`${pctTotal}%`,cor:corHex(pctTotal)},
                {label:"Vendedores no Verde",value:`${vendedores.filter(v=>pct(v.realizado,v.meta)>=100).length} / ${vendedores.length}`,cor:L.green},
              ].map(k=>(
                <div key={k.label} style={{background:L.white,borderRadius:10,padding:"16px 18px",border:`1px solid ${L.line}`}}>
                  <div style={{fontSize:11,color:L.t3,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.8px",fontFamily:"'JetBrains Mono',monospace"}}>{k.label}</div>
                  <div style={{fontSize:22,fontWeight:800,color:k.cor,fontFamily:"'Outfit',sans-serif"}}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Barra empresa */}
            {totalMeta > 0 && (
              <div style={{background:L.white,borderRadius:10,padding:"18px 22px",border:`1px solid ${L.line}`,marginBottom:24}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                  <span style={{fontSize:13,fontWeight:600,color:L.t1}}>Progresso Empresa — {mesLabel(mes)}</span>
                  <span style={{fontSize:13,fontWeight:700,color:corHex(pctTotal)}}>{pctTotal}%</span>
                </div>
                <BarraMeta pctVal={pctTotal} cor={corHex(pctTotal)} height={14}/>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                  <span style={{fontSize:11,color:L.t3}}>Realizado: <b>{fmt(totalRealizado)}</b></span>
                  <span style={{fontSize:11,color:L.t3}}>Meta: <b>{fmt(totalMeta)}</b></span>
                </div>
              </div>
            )}

            {/* Cards vendedores */}
            {vendedores.length === 0 ? (
              <div style={{textAlign:"center",padding:48,color:L.t4,fontSize:13}}>
                Nenhum vendedor cadastrado ou metas não configuradas para este mês.
              </div>
            ) : (
              <>
                <div style={{fontSize:12,fontWeight:600,color:L.t3,marginBottom:12,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace"}}>
                  Ranking de Vendedores
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
                  {vendedores.map(v=>(
                    <CardVendedor key={v.id} v={v} mesesVermelhos={v.mesesVermelhos}/>
                  ))}
                </div>

                {/* Legenda */}
                <div style={{display:"flex",gap:20,marginTop:20,padding:"12px 16px",background:L.white,borderRadius:8,border:`1px solid ${L.line}`,width:"fit-content"}}>
                  {[["verde","≥ 100% — Meta batida",L.green,L.greenBg],["amarelo","70–99% — Perto",L.yellow,L.yellowBg],["vermelho","< 70% — Abaixo",L.red,L.redBg]].map(([k,lbl,c,bg])=>(
                    <div key={k} style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:10,height:10,borderRadius:3,background:c}}/>
                      <span style={{fontSize:11,color:L.t2}}>{lbl}</span>
                    </div>
                  ))}
                  <div style={{display:"flex",alignItems:"center",gap:6,borderLeft:`1px solid ${L.line}`,paddingLeft:16}}>
                    <span style={{fontSize:11,color:L.red,fontWeight:700}}>⚠ 3M VERMELHO</span>
                    <span style={{fontSize:11,color:L.t3}}>= 3 meses seguidos abaixo de 70%</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ CONFIGURAR ══ */}
        {tab==="configurar" && (
          <div style={{maxWidth:800}}>
            {!isGestor ? (
              <div style={{padding:32,textAlign:"center",color:L.t3,fontSize:13}}>
                Apenas administradores e gestores podem configurar metas.
              </div>
            ) : (
              <>
                {/* Meta total empresa */}
                <div style={{background:L.white,borderRadius:10,padding:"20px 22px",border:`1px solid ${L.line}`,marginBottom:20}}>
                  <div style={{fontSize:14,fontWeight:700,color:L.t1,marginBottom:16}}>Meta Total da Empresa — {mesLabel(mes)}</div>
                  <div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
                    <div style={{flex:1}}>
                      <label style={labelS}>Valor da Meta (R$)</label>
                      <input type="text" inputMode="numeric" placeholder="ex: 50.000,00"
                        value={fMetaTotal} onChange={e=>setFMetaTotal(e.target.value)}
                        style={inpS}/>
                    </div>
                  </div>
                </div>

                {/* Metas individuais */}
                <div style={{background:L.white,borderRadius:10,padding:"20px 22px",border:`1px solid ${L.line}`,marginBottom:20}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                    <div style={{fontSize:14,fontWeight:700,color:L.t1}}>Vendedores que aparecem no Painel</div>
                    <div style={{fontSize:11,color:L.t3}}>Marque quem participará das metas</div>
                  </div>
                  <div style={{fontSize:12,color:L.t4,marginBottom:16}}>
                    {selVendedores.size} de {usuarios.length} usuário(s) selecionado(s)
                  </div>
                  {usuarios.length === 0 ? (
                    <div style={{color:L.t4,fontSize:12}}>Nenhum usuário ativo encontrado.</div>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {usuarios.map(u => {
                        const marcado = selVendedores.has(u.id);
                        const toggle = () => {
                          const s = new Set(selVendedores);
                          if (marcado) s.delete(u.id); else s.add(u.id);
                          setSelVendedores(s);
                        };
                        return (
                          <div key={u.id} onClick={toggle} style={{
                            display:"flex",alignItems:"center",gap:12,
                            padding:"10px 12px",borderRadius:8,cursor:"pointer",
                            background: marcado ? L.surface : "transparent",
                            border:`1.5px solid ${marcado ? L.t1 : L.line}`,
                            transition:"all .12s",opacity: marcado?1:0.55,
                          }}>
                            {/* checkbox visual */}
                            <div style={{
                              width:18,height:18,borderRadius:4,flexShrink:0,
                              background: marcado?L.t1:L.white,
                              border:`2px solid ${marcado?L.t1:L.line}`,
                              display:"flex",alignItems:"center",justifyContent:"center",
                              transition:"all .12s",
                            }}>
                              {marcado && <span style={{color:"#fff",fontSize:11,lineHeight:1}}>✓</span>}
                            </div>
                            {/* avatar */}
                            <div style={{width:32,height:32,borderRadius:"50%",background:marcado?L.t1:L.surface,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:marcado?"#fff":L.t2,flexShrink:0,transition:"all .12s"}}>
                              {u.nome.split(" ").slice(0,2).map(n=>n[0]).join("").toUpperCase()}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:600,color:L.t1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.nome}</div>
                              <div style={{fontSize:11,color:L.t3}}>{u.cargo||"—"}</div>
                            </div>
                            {/* input meta */}
                            <div style={{width:180,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                              <input type="text" inputMode="numeric"
                                placeholder={marcado?"ex: 5.000,00":"—"}
                                disabled={!marcado}
                                value={fMetasInd[u.id]??""} onChange={e=>setFMetasInd(p=>({...p,[u.id]:e.target.value}))}
                                style={{...inpS,padding:"7px 10px",fontSize:12,opacity:marcado?1:0.4,cursor:marcado?"text":"not-allowed"}}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button onClick={saveMetas} disabled={savingMeta}
                  style={{...btnS,background:L.t1,color:L.white,opacity:savingMeta?.7:1,marginBottom:32}}>
                  {savingMeta?"Salvando...":"💾 Salvar Metas"}
                </button>

                {/* Registrar venda */}
                <div style={{background:L.white,borderRadius:10,padding:"20px 22px",border:`1px solid ${L.line}`,marginBottom:20}}>
                  <div style={{fontSize:14,fontWeight:700,color:L.t1,marginBottom:16}}>Registrar Venda Realizada</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 160px 1fr",gap:12,marginBottom:12}}>
                    <div>
                      <label style={labelS}>Vendedor</label>
                      <select value={fVenda.usuario_id} onChange={e=>setFVenda(p=>({...p,usuario_id:e.target.value}))}
                        style={{...inpS,cursor:"pointer"}}>
                        <option value="">Selecione...</option>
                        {usuarios.filter(u=>selVendedores.has(u.id)).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelS}>Valor (R$)</label>
                      <input type="text" inputMode="numeric" placeholder="ex: 1.500,00"
                        value={fVenda.valor} onChange={e=>setFVenda(p=>({...p,valor:e.target.value}))}
                        style={inpS}/>
                    </div>
                    <div>
                      <label style={labelS}>Descrição</label>
                      <input type="text" placeholder="Contrato, cliente, produto..."
                        value={fVenda.descricao} onChange={e=>setFVenda(p=>({...p,descricao:e.target.value}))}
                        style={inpS}/>
                    </div>
                  </div>
                  <button onClick={saveVenda} disabled={savingV||!fVenda.usuario_id||!fVenda.valor}
                    style={{...btnS,background:L.green,color:L.white,opacity:(savingV||!fVenda.usuario_id||!fVenda.valor)?.6:1}}>
                    {savingV?"Registrando...":"+ Registrar Venda"}
                  </button>
                </div>

                {/* Lista vendas */}
                {vendas.length > 0 && (
                  <div style={{background:L.white,borderRadius:10,border:`1px solid ${L.line}`,overflow:"hidden"}}>
                    <div style={{padding:"14px 18px",borderBottom:`1px solid ${L.line}`,fontSize:13,fontWeight:600,color:L.t1}}>
                      Vendas Registradas — {mesLabel(mes)}
                    </div>
                    {vendas.map(v=>{
                      const vend = usuarios.find(u=>u.id===v.usuario_id);
                      return (
                        <div key={v.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 18px",borderBottom:`1px solid ${L.lineSoft}`}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:500,color:L.t1}}>{vend?.nome||"—"}</div>
                            <div style={{fontSize:11,color:L.t3}}>{v.descricao||"—"} · {new Date(v.created_at).toLocaleDateString("pt-BR")}</div>
                          </div>
                          <div style={{fontSize:14,fontWeight:700,color:L.green,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(v.valor)}</div>
                          <button onClick={()=>deleteVenda(v.id)} disabled={deleting===v.id}
                            style={{background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:16,padding:4,opacity:deleting===v.id?.5:1}}
                            title="Remover">✕</button>
                        </div>
                      );
                    })}
                    <div style={{padding:"12px 18px",display:"flex",justifyContent:"flex-end"}}>
                      <span style={{fontSize:13,fontWeight:700,color:L.t1}}>Total: {fmt(totalRealizado)}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ TV MODE ══ */}
        {tab==="tv" && (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
              <button onClick={toggleFull}
                style={{...btnS,background:L.t1,color:L.white,display:"flex",alignItems:"center",gap:8}}>
                {tvFull?"⊡ Sair Tela Cheia":"⊞ Tela Cheia"}
              </button>
              <span style={{fontSize:12,color:L.t3}}>Auto-atualiza a cada 30 segundos · {mesLabel(mes)}</span>
            </div>

            {/* painel TV */}
            <div ref={tvRef} style={{
              background:"#0f1117", borderRadius:tvFull?0:16,
              padding: tvFull?"40px":"32px",
              minHeight: tvFull?"100vh":"auto",
            }}>
              {/* header TV */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:32}}>
                <div>
                  <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:900,fontSize:tvFull?42:28,color:"#fff",letterSpacing:"-.5px",lineHeight:1}}>
                    🎯 PAINEL DE METAS
                  </div>
                  <div style={{fontSize:tvFull?18:13,color:"rgba(255,255,255,0.5)",marginTop:6,fontFamily:"'JetBrains Mono',monospace"}}>
                    {mesLabel(mes).toUpperCase()} · Atualizado: {new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:tvFull?56:36,fontWeight:900,color:corHex(pctTotal),fontFamily:"'Outfit',sans-serif",lineHeight:1}}>
                    {pctTotal}%
                  </div>
                  <div style={{fontSize:tvFull?16:12,color:"rgba(255,255,255,0.5)"}}>da meta empresa</div>
                </div>
              </div>

              {/* barra empresa TV */}
              <div style={{marginBottom:32}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{color:"rgba(255,255,255,0.7)",fontSize:tvFull?16:13,fontWeight:600}}>Meta Total Empresa</span>
                  <span style={{color:"rgba(255,255,255,0.7)",fontSize:tvFull?16:13}}>
                    {fmt(totalRealizado)} / {fmt(totalMeta)}
                  </span>
                </div>
                <div style={{height:tvFull?20:14,borderRadius:99,background:"rgba(255,255,255,0.1)",overflow:"hidden"}}>
                  <div style={{
                    width:`${cap(pctTotal)}%`,height:"100%",borderRadius:99,
                    background:corHex(pctTotal),
                    transition:"width .8s cubic-bezier(.4,0,.2,1)",
                    boxShadow:`0 0 20px ${corHex(pctTotal)}88`,
                  }}/>
                </div>
              </div>

              {/* grid vendedores TV */}
              <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(vendedores.length,3)},1fr)`,gap:tvFull?20:14}}>
                {vendedores.map((v,i)=>{
                  const p = pct(v.realizado,v.meta);
                  const alertaRed = v.mesesVermelhos >= 3;
                  return (
                    <div key={v.id} style={{
                      background:"rgba(255,255,255,0.05)",
                      border:`2px solid ${corHex(p)}44`,
                      borderRadius:tvFull?20:14,
                      padding:tvFull?"24px 28px":"18px 22px",
                      position:"relative",
                    }}>
                      {/* rank */}
                      <div style={{
                        position:"absolute",top:tvFull?16:10,left:tvFull?16:10,
                        width:tvFull?32:24,height:tvFull?32:24,borderRadius:"50%",
                        background:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":"rgba(255,255,255,0.1)",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:tvFull?14:10,fontWeight:900,color:i<3?"#000":"rgba(255,255,255,0.5)",
                      }}>#{i+1}</div>

                      {alertaRed && (
                        <div style={{
                          position:"absolute",top:tvFull?16:10,right:tvFull?16:10,
                          background:"rgba(220,38,38,0.2)",border:"1px solid rgba(220,38,38,0.5)",
                          borderRadius:6,padding:"2px 8px",
                          fontSize:tvFull?11:9,fontWeight:700,color:"#fca5a5"
                        }}>⚠ 3M RED</div>
                      )}

                      <div style={{textAlign:"center",margin:`${tvFull?28:20}px 0 ${tvFull?16:12}px`}}>
                        <div style={{
                          width:tvFull?64:48,height:tvFull?64:48,borderRadius:"50%",
                          background:`${corHex(p)}22`,border:`3px solid ${corHex(p)}66`,
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:tvFull?24:18,fontWeight:800,color:corHex(p),
                          margin:"0 auto 10px",
                        }}>
                          {v.nome.split(" ").slice(0,2).map(n=>n[0]).join("").toUpperCase()}
                        </div>
                        <div style={{fontSize:tvFull?20:14,fontWeight:700,color:"#fff",marginBottom:2}}>{v.nome}</div>
                        <div style={{fontSize:tvFull?13:10,color:"rgba(255,255,255,0.4)"}}>{v.cargo||"Vendedor"}</div>
                      </div>

                      {/* pct grande */}
                      <div style={{textAlign:"center",marginBottom:tvFull?16:12}}>
                        <div style={{
                          fontSize:tvFull?52:36,fontWeight:900,color:corHex(p),
                          fontFamily:"'Outfit',sans-serif",lineHeight:1,
                          textShadow:`0 0 30px ${corHex(p)}88`,
                        }}>{p}%</div>
                        <div style={{fontSize:tvFull?13:10,color:"rgba(255,255,255,0.4)",marginTop:4}}>
                          {fmt(v.realizado)} / {fmt(v.meta)}
                        </div>
                      </div>

                      {/* barra */}
                      <div style={{height:tvFull?12:8,borderRadius:99,background:"rgba(255,255,255,0.1)",overflow:"hidden"}}>
                        <div style={{
                          width:`${cap(p)}%`,height:"100%",borderRadius:99,
                          background:corHex(p),
                          boxShadow:`0 0 12px ${corHex(p)}88`,
                          transition:"width .8s cubic-bezier(.4,0,.2,1)"
                        }}/>
                      </div>
                    </div>
                  );
                })}
              </div>

              {vendedores.length === 0 && (
                <div style={{textAlign:"center",color:"rgba(255,255,255,0.3)",fontSize:16,padding:48}}>
                  Configure as metas na aba ⚙ Configurar para visualizar o painel TV.
                </div>
              )}

              {/* rodapé TV */}
              <div style={{display:"flex",justifyContent:"center",gap:32,marginTop:tvFull?40:28}}>
                {[["🟢","Verde ≥ 100%"],["🟡","Amarelo 70–99%"],["🔴","Vermelho < 70%"]].map(([ico,lbl])=>(
                  <div key={lbl} style={{display:"flex",alignItems:"center",gap:8,color:"rgba(255,255,255,0.4)",fontSize:tvFull?14:11}}>
                    <span>{ico}</span><span>{lbl}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div style={{position:"fixed",bottom:24,right:24,background:L.t1,color:L.white,padding:"8px 16px",borderRadius:8,fontSize:12,fontWeight:500}}>
            Atualizando...
          </div>
        )}
      </div>
    </div>
  );
}
