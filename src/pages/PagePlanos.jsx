import { useState } from "react";
import { L } from "../constants/theme";
import { usePlanos } from "../hooks/useData";
import { Fade, Grid, Row, Tag } from "../components/ui";
import Modal, { Field, Input, ModalFooter } from "../components/Modal";

const ao = (color, pct) =>
  color?.startsWith?.("var(")
    ? `color-mix(in srgb, ${color} ${pct}%, transparent)`
    : `${color}${Math.round(pct * 2.55).toString(16).padStart(2, "0")}`;

const PLANO_CORES = {
  Starter:    { c: L.copper,  bg: L.copperBg  },
  Enterprise: { c: L.accent,  bg: L.tealBg, destaque: true },
  "C4HUB":   { c: L.green,   bg: L.greenBg  },
};

export default function PagePlanos({ user }) {
  const isAdmin = user?.role === "c4hub_admin";
  const { planos, loading, update, refetch } = usePlanos();

  const [editP, setEditP] = useState(null);
  const [form, setForm]   = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");
  const [newFeat, setNewFeat] = useState("");

  const visiveis = planos.filter(p => p.ativo && (p.nome !== "C4HUB" || isAdmin));

  const openEdit = (p) => {
    setForm({ preco_mensal: p.preco_mensal, features: [...(p.features||[])] });
    setEditP(p); setErr("");
  };

  const addFeat = () => {
    if (!newFeat.trim()) return;
    setForm(f => ({ ...f, features: [...(f.features||[]), newFeat.trim()] }));
    setNewFeat("");
  };
  const removeFeat = (i) => setForm(f => ({ ...f, features: f.features.filter((_,j)=>j!==i) }));
  const moveFeat   = (i, dir) => {
    const arr = [...form.features];
    [arr[i], arr[i+dir]] = [arr[i+dir], arr[i]];
    setForm(f => ({ ...f, features: arr }));
  };

  const save = async () => {
    if (!form.preco_mensal && form.preco_mensal !== 0) { setErr("Preço obrigatório."); return; }
    setSaving(true); setErr("");
    const { error } = await update(editP.id, { preco_mensal: parseFloat(form.preco_mensal), features: form.features });
    if (error) setErr(error.message||"Erro ao salvar.");
    else { setEditP(null); refetch(); }
    setSaving(false);
  };

  if (loading) return <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando planos...</div>;

  return (
    <Fade>
      {/* ── Header ── */}
      <div style={{textAlign:"center",marginBottom:36}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:12}}>
          <div style={{width:36,height:2,background:L.tealA2,borderRadius:2}}/>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:"3px",textTransform:"uppercase",color:L.t4,fontFamily:"'JetBrains Mono',monospace"}}>PLANOS</span>
          <div style={{width:36,height:2,background:L.tealA2,borderRadius:2}}/>
        </div>
        <div style={{fontSize:30,fontWeight:800,fontFamily:"'Outfit',sans-serif",color:L.t1,letterSpacing:"-.7px",marginBottom:6,lineHeight:1.1}}>
          C4 <span style={{color:L.accent}}>OS</span> — Escolha seu plano
        </div>
        <div style={{fontSize:13,color:L.t3,maxWidth:420,margin:"0 auto",lineHeight:1.6}}>
          Cada empresa escolhe o plano ideal para seu crescimento
        </div>
        {isAdmin && (
          <div style={{marginTop:10,display:"inline-flex",alignItems:"center",gap:6,fontSize:11,color:L.accent,background:ao(L.accent,8),border:`1px solid ${ao(L.accent,20)}`,borderRadius:20,padding:"4px 14px"}}>
            <span>✦</span>
            <span>Clique em qualquer plano para editar preço e recursos</span>
          </div>
        )}
      </div>

      {/* ── Cards ── */}
      <Grid cols={visiveis.length <= 2 ? visiveis.length : 3} gap={16} mb={24} responsive>
        {visiveis.map((p, i) => {
          const meta = PLANO_CORES[p.nome] || {c:L.t3, bg:L.surface};
          const destaque = !!meta.destaque;
          return (
            <div key={p.id}
              onClick={() => isAdmin && openEdit(p)}
              style={{
                background: destaque ? L.cardFeature : L.white,
                borderRadius: 16,
                border: destaque ? "none" : `1.5px solid ${L.line}`,
                outline: destaque ? `1.5px solid ${ao(L.accent,30)}` : "none",
                outlineOffset: destaque ? "0px" : "0px",
                padding: destaque ? "28px 24px" : "24px",
                display:"flex", flexDirection:"column", gap:16,
                position:"relative", overflow:"hidden",
                boxShadow: destaque
                  ? "0 20px 60px rgba(26,170,150,0.25), 0 4px 20px rgba(0,0,0,0.15)"
                  : "0 1px 4px rgba(0,0,0,0.06)",
                animation:`up .4s ease ${i*.08}s both`,
                cursor: isAdmin ? "pointer" : "default",
                transition:"all .18s",
              }}
              onMouseEnter={e=>{ if(isAdmin){ e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow=destaque?"0 28px 70px rgba(26,170,150,0.35), 0 8px 30px rgba(0,0,0,0.2)":"0 8px 28px rgba(0,0,0,0.1)"; }}}
              onMouseLeave={e=>{ e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow=destaque?"0 20px 60px rgba(26,170,150,0.25), 0 4px 20px rgba(0,0,0,0.15)":"0 1px 4px rgba(0,0,0,0.06)"; }}
            >
              {/* Decoração de fundo para o card destaque */}
              {destaque && (
                <div style={{position:"absolute",top:-40,right:-40,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,0.05)",pointerEvents:"none"}}/>
              )}
              {destaque && (
                <div style={{position:"absolute",bottom:-30,left:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.04)",pointerEvents:"none"}}/>
              )}

              {/* Badge POPULAR */}
              {destaque && (
                <div style={{position:"absolute",top:16,right:16,background:"rgba(255,255,255,0.18)",backdropFilter:"blur(8px)",color:"white",fontSize:9,fontWeight:800,letterSpacing:"1.5px",padding:"3px 10px",borderRadius:20,textTransform:"uppercase",border:"1px solid rgba(255,255,255,0.3)"}}>POPULAR</div>
              )}

              {/* Badge Editar (admin) */}
              {isAdmin && (
                <div style={{position:"absolute",top:16,left:16,background: destaque?"rgba(255,255,255,0.15)":L.surface,color:destaque?"white":L.t3,fontSize:9,padding:"3px 9px",borderRadius:10,fontWeight:600,border: destaque?"1px solid rgba(255,255,255,0.2)":`1px solid ${L.line}`}}>✎ editar</div>
              )}

              {/* Nome e preço */}
              <div style={{marginTop: isAdmin ? 22 : 0}}>
                <div style={{
                  fontSize:9,fontWeight:700,letterSpacing:"2.5px",textTransform:"uppercase",
                  color: destaque ? "rgba(255,255,255,0.6)" : meta.c,
                  marginBottom:6,fontFamily:"'JetBrains Mono',monospace"
                }}>{p.nome}</div>

                <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                  <span style={{
                    fontSize:32,fontWeight:800,
                    color: destaque ? "white" : L.t1,
                    fontFamily:"'Outfit',sans-serif",letterSpacing:"-.7px",lineHeight:1
                  }}>
                    {p.nome==="C4HUB" ? "Interno" : parseFloat(p.preco_mensal)===0 ? "Grátis" : `R$ ${parseFloat(p.preco_mensal).toLocaleString("pt-BR",{minimumFractionDigits:2})}`}
                  </span>
                  {parseFloat(p.preco_mensal)>0 && (
                    <span style={{fontSize:11,color: destaque?"rgba(255,255,255,0.45)":L.t4}}>/mês</span>
                  )}
                </div>
              </div>

              {/* Divisor */}
              <div style={{height:1,background: destaque?"rgba(255,255,255,0.15)":L.line}}/>

              {/* Features */}
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:7}}>
                {(p.features||[]).map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:9,alignItems:"flex-start"}}>
                    <span style={{
                      color: destaque?"rgba(255,255,255,0.9)":L.green,
                      fontSize:10,marginTop:2,flexShrink:0,fontWeight:700
                    }}>✓</span>
                    <span style={{
                      fontSize:12,
                      color: destaque?"rgba(255,255,255,0.8)":L.t2,
                      lineHeight:1.5
                    }}>{f}</span>
                  </div>
                ))}
              </div>

              {/* Botão CTA (não-admin) */}
              {!isAdmin && (
                <button style={{
                  width:"100%",padding:"11px",borderRadius:10,fontSize:12.5,
                  fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                  background: destaque ? "rgba(255,255,255,0.15)" : ao(meta.c, 8),
                  color: destaque ? "white" : meta.c,
                  border: destaque ? "1.5px solid rgba(255,255,255,0.3)" : `1.5px solid ${ao(meta.c, 25)}`,
                  transition:"all .15s",
                  backdropFilter: destaque ? "blur(8px)" : "none",
                }}
                onMouseEnter={e=>{ e.currentTarget.style.background=destaque?"rgba(255,255,255,0.25)":ao(meta.c,15); }}
                onMouseLeave={e=>{ e.currentTarget.style.background=destaque?"rgba(255,255,255,0.15)":ao(meta.c,8); }}
                >
                  {p.nome==="C4HUB" ? "Acesso Interno" : "Contratar Plano"}
                </button>
              )}
            </div>
          );
        })}
      </Grid>

      {/* ── Tabela comparativa ── */}
      <div style={{background:L.white,borderRadius:14,border:`1px solid ${L.line}`,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${L.line}`,display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:3,height:18,background:L.accent,borderRadius:2}}/>
          <div style={{fontSize:13,fontWeight:700,color:L.t1}}>Comparativo de Limites</div>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:400}}>
            <thead>
              <tr style={{background:L.surface}}>
                <th style={{padding:"11px 20px",textAlign:"left",fontSize:10,color:L.t4,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",fontFamily:"'JetBrains Mono',monospace"}}>Recurso</th>
                {visiveis.map(p=>{
                  const meta = PLANO_CORES[p.nome] || {c:L.t3};
                  return (
                    <th key={p.id} style={{padding:"11px 20px",textAlign:"center",fontSize:11,color:meta.c,fontWeight:700}}>
                      {p.nome}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {[
                ["Contatos",     p => p.max_contatos>=999999?"Ilimitado":p.max_contatos?.toLocaleString()],
                ["Usuários",     p => p.max_usuarios>=999?"Ilimitado":p.max_usuarios],
                ["Disparos/mês", p => p.max_disparos>=999999?"Ilimitado":p.max_disparos?.toLocaleString()],
                ["IA",           p => p.tem_ia?"✓":"—"],
                ["Multi-agente", p => p.tem_multiagente?"✓":"—"],
                ["API Access",   p => p.tem_api?"✓":"—"],
              ].map(([label, fn], i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${L.lineSoft}`,transition:"background .1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=L.hover}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"11px 20px",fontSize:12,color:L.t2,fontWeight:500}}>{label}</td>
                  {visiveis.map(p=>{
                    const v = fn(p);
                    const isCheck = v==="✓";
                    const isDash = v==="—";
                    const meta = PLANO_CORES[p.nome] || {c:L.t3};
                    return (
                      <td key={p.id} style={{padding:"11px 20px",textAlign:"center",fontSize:12,
                        color: isCheck ? L.green : isDash ? L.t5 : meta.destaque ? L.accent : L.t1,
                        fontWeight: isCheck||(!isDash&&v==="Ilimitado") ? 700 : 400}}>
                        {v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal edição de plano ── */}
      {editP && isAdmin && (
        <Modal title={`Editar Plano: ${editP.nome}`} onClose={()=>setEditP(null)} width={500}>
          <Field label="Preço Mensal (R$)">
            <Input value={form.preco_mensal} onChange={v=>setForm(f=>({...f,preco_mensal:v}))} type="number" placeholder="Ex: 149.90"/>
          </Field>

          <div style={{marginBottom:14}}>
            <label style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1.2px",display:"block",marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>Recursos incluídos</label>
            {(form.features||[]).map((feat,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 10px",background:L.surface,borderRadius:7,border:`1px solid ${L.line}`,marginBottom:5}}>
                <span style={{fontSize:11,color:L.green,fontWeight:700,flexShrink:0}}>✓</span>
                <span style={{flex:1,fontSize:12,color:L.t1}}>{feat}</span>
                <button onClick={()=>moveFeat(i,-1)} disabled={i===0} style={{background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:12,padding:"0 3px"}} title="Mover para cima">↑</button>
                <button onClick={()=>moveFeat(i, 1)} disabled={i===(form.features.length-1)} style={{background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:12,padding:"0 3px"}} title="Mover para baixo">↓</button>
                <button onClick={()=>removeFeat(i)} style={{background:"none",border:"none",cursor:"pointer",color:L.red,fontSize:13,padding:"0 3px"}} title="Remover">×</button>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <input value={newFeat} onChange={e=>setNewFeat(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addFeat()}
                placeholder="Novo recurso... (Enter para adicionar)"
                style={{flex:1,background:L.surface,border:`1.5px solid ${L.line}`,borderRadius:8,padding:"8px 11px",color:L.t1,fontSize:12,fontFamily:"inherit",outline:"none"}}
                onFocus={e=>e.target.style.borderColor="var(--c-accent)"} onBlur={e=>e.target.style.borderColor=L.line}
              />
              <button onClick={addFeat}
                style={{padding:"8px 14px",borderRadius:8,background:L.accent,color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>
                +
              </button>
            </div>
          </div>

          {err && <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginBottom:4}}>{err}</div>}
          <ModalFooter onClose={()=>setEditP(null)} onSave={save} loading={saving} label="Salvar Plano"/>
        </Modal>
      )}
    </Fade>
  );
}
