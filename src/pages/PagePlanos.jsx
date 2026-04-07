import { useState } from "react";
import { L } from "../constants/theme";
import { usePlanos } from "../hooks/useData";
import { Fade, Grid, Row, Tag } from "../components/ui";
import Modal, { Field, Input, ModalFooter } from "../components/Modal";

const PLANO_CORES = { Starter:{c:L.copper,bg:L.copperBg}, Enterprise:{c:L.teal,bg:L.tealBg,destaque:true}, "C4HUB":{c:L.green,bg:L.greenBg} };

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
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{fontSize:26,fontWeight:800,fontFamily:"'Outfit',sans-serif",color:L.t1,letterSpacing:"-.5px",marginBottom:6}}>
          Planos <span style={{color:L.teal}}>C4 OS</span>
        </div>
        <div style={{fontSize:12.5,color:L.t3}}>Cada empresa escolhe o plano ideal para seu crescimento</div>
        {isAdmin && <div style={{marginTop:8,fontSize:11,color:L.teal}}>✦ Clique em qualquer plano para editar preço e recursos</div>}
      </div>

      <Grid cols={visiveis.length <= 2 ? visiveis.length : 3} gap={16} mb={20} responsive>
        {visiveis.map((p, i) => {
          const meta = PLANO_CORES[p.nome] || {c:L.t3,bg:L.surface};
          return (
            <div key={p.id}
              onClick={() => isAdmin && openEdit(p)}
              style={{background:meta.destaque?L.teal:L.white,borderRadius:14,border:`1.5px solid ${meta.destaque?"transparent":L.line}`,padding:24,display:"flex",flexDirection:"column",gap:14,position:"relative",overflow:"hidden",
                boxShadow:meta.destaque?"0 12px 40px rgba(26,170,150,0.2)":"0 1px 3px rgba(0,0,0,0.05)",animation:`up .4s ease ${i*.07}s both`,
                cursor:isAdmin?"pointer":"default",transition:"all .15s"}}
              onMouseEnter={e=>{ if(isAdmin){ e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow=meta.destaque?"0 20px 50px rgba(26,170,150,0.3)":"0 8px 24px rgba(0,0,0,0.1)"; }}}
              onMouseLeave={e=>{ e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow=meta.destaque?"0 12px 40px rgba(26,170,150,0.2)":"0 1px 3px rgba(0,0,0,0.05)"; }}
            >
              {meta.destaque && (
                <div style={{position:"absolute",top:14,right:14,background:"rgba(255,255,255,0.25)",color:"white",fontSize:9,fontWeight:800,letterSpacing:"1px",padding:"3px 10px",borderRadius:20,textTransform:"uppercase"}}>POPULAR</div>
              )}
              {isAdmin && <div style={{position:"absolute",top:14,left:14,background:"rgba(255,255,255,0.2)",color:meta.destaque?"white":L.teal,fontSize:9,padding:"2px 8px",borderRadius:10,fontWeight:600}}>✎ editar</div>}

              <div style={{marginTop:isAdmin?20:0}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:"2.5px",textTransform:"uppercase",color:meta.destaque?"rgba(255,255,255,0.7)":meta.c,marginBottom:5,fontFamily:"'JetBrains Mono',monospace"}}>{p.nome}</div>
                <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                  <span style={{fontSize:26,fontWeight:800,color:meta.destaque?"white":L.t1,fontFamily:"'Outfit',sans-serif",letterSpacing:"-.5px"}}>
                    {p.nome==="C4HUB"?"Interno":parseFloat(p.preco_mensal)===0?"Grátis":`R$ ${parseFloat(p.preco_mensal).toLocaleString("pt-BR",{minimumFractionDigits:2})}`}
                  </span>
                  {parseFloat(p.preco_mensal)>0 && <span style={{fontSize:11,color:meta.destaque?"rgba(255,255,255,0.5)":L.t4}}>/mês</span>}
                </div>
              </div>

              <div style={{flex:1}}>
                {(p.features||[]).map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:8}}>
                    <span style={{color:meta.destaque?"white":meta.c,fontSize:11,marginTop:2,flexShrink:0,fontWeight:700}}>✓</span>
                    <span style={{fontSize:11.5,color:meta.destaque?"rgba(255,255,255,0.85)":L.t2,lineHeight:1.45}}>{f}</span>
                  </div>
                ))}
              </div>

              {!isAdmin && (
                <button style={{width:"100%",padding:"11px",borderRadius:10,fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                  background:meta.destaque?"white":`${meta.c}12`,color:meta.destaque?L.teal:meta.c,
                  border:meta.destaque?"none":`1.5px solid ${meta.c}22`,transition:"all .15s"}}>
                  {p.nome==="C4HUB"?"Acesso Interno":"Contratar Plano"}
                </button>
              )}
            </div>
          );
        })}
      </Grid>

      {/* Tabela comparativa */}
      <div style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
        <div style={{fontSize:13,fontWeight:600,color:L.t1,marginBottom:14}}>Comparativo de Limites</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:400}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${L.line}`}}>
                <th style={{padding:"9px 14px",textAlign:"left",fontSize:11,color:L.t3,fontWeight:600}}>Recurso</th>
                {visiveis.map(p=><th key={p.id} style={{padding:"9px 14px",textAlign:"center",fontSize:11,color:PLANO_CORES[p.nome]?.c||L.t3,fontWeight:700}}>{p.nome}</th>)}
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
                <tr key={i} style={{borderBottom:`1px solid ${L.lineSoft}`}}>
                  <td style={{padding:"9px 14px",fontSize:12,color:L.t3}}>{label}</td>
                  {visiveis.map(p=>{
                    const v = fn(p);
                    return <td key={p.id} style={{padding:"9px 14px",textAlign:"center",fontSize:12,color:v==="✓"?L.green:v==="—"?L.t5:L.t1,fontWeight:v==="✓"?700:400}}>{v}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de edição de plano */}
      {editP && isAdmin && (
        <Modal title={`Editar Plano: ${editP.nome}`} onClose={()=>setEditP(null)} width={500}>
          <Field label="Preço Mensal (R$)">
            <Input value={form.preco_mensal} onChange={v=>setForm(f=>({...f,preco_mensal:v}))} type="number" placeholder="Ex: 149.90"/>
          </Field>

          <div style={{marginBottom:14}}>
            <label style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1.2px",display:"block",marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>Recursos incluídos</label>
            {(form.features||[]).map((feat,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",background:L.surface,borderRadius:7,border:`1px solid ${L.line}`,marginBottom:5}}>
                <span style={{fontSize:11,color:L.teal,fontWeight:700,flexShrink:0}}>✓</span>
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
                onFocus={e=>e.target.style.borderColor=L.teal} onBlur={e=>e.target.style.borderColor=L.line}
              />
              <button onClick={addFeat}
                style={{padding:"8px 14px",borderRadius:8,background:L.teal,color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>
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
