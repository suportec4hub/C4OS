import { useState } from "react";
import Logo from "./Logo";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { useBreakpoint } from "../hooks/useBreakpoint";

export default function Login() {
  const [email,setEmail]     = useState("");
  const [pass,setPass]       = useState("");
  const [show,setShow]       = useState(false);
  const [err,setErr]         = useState("");
  const [loading,setLoading] = useState(false);
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  const handle = async () => {
    if (!email.trim() || !pass) { setErr("Preencha e-mail e senha."); return; }
    setErr(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: pass,
    });
    if (error) setErr("E-mail ou senha incorretos.");
    setLoading(false);
  };

  const iStyle = (hasErr) => ({
    width:"100%", background:L.white,
    border:`1.5px solid ${hasErr ? L.red : L.line}`,
    borderRadius:9, padding:"11px 14px",
    color:L.t1, fontSize:13, fontFamily:"inherit",
    outline:"none", transition:"border-color .15s",
    boxShadow:"0 1px 2px rgba(0,0,0,0.04)"
  });

  const labelS = {
    display:"block", fontSize:11, fontWeight:600,
    color:L.t2, marginBottom:6, textTransform:"uppercase",
    letterSpacing:"1px", fontFamily:"'JetBrains Mono',monospace"
  };

  const features = ["Funil Kanban arrastar e soltar","Disparos em massa WhatsApp","Agente de IA embarcado","Multi-tenant com isolamento"];

  /* ── MOBILE: layout coluna única ── */
  if (isMobile) {
    return (
      <div style={{minHeight:"100dvh",display:"flex",flexDirection:"column",background:L.bg,fontFamily:"'Instrument Sans',sans-serif"}}>
        {/* Topo escuro compacto */}
        <div style={{background:L.teal,padding:"28px 24px 24px",textAlign:"center"}}>
          <div style={{display:"inline-flex",width:64,height:64,borderRadius:18,background:"rgba(255,255,255,0.15)",alignItems:"center",justifyContent:"center",marginBottom:12}}>
            <Logo size={48}/>
          </div>
          <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:24,color:"white",letterSpacing:"-.4px",lineHeight:1,marginBottom:4}}>C4 OS</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.55)",letterSpacing:"2px",textTransform:"uppercase",fontFamily:"'JetBrains Mono',monospace"}}>by C4HUB</div>
        </div>

        {/* Formulário */}
        <div style={{flex:1,padding:"28px 20px 32px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <div style={{marginBottom:24}}>
            <div style={{fontSize:20,fontWeight:700,fontFamily:"'Outfit',sans-serif",color:L.t1,letterSpacing:"-.3px",marginBottom:4}}>Bem-vindo de volta</div>
            <div style={{fontSize:12,color:L.t3}}>Entre com sua conta C4 OS para continuar</div>
          </div>

          <div style={{marginBottom:14}}>
            <label style={labelS}>E-mail</label>
            <input value={email} onChange={e=>{setEmail(e.target.value);setErr("");}}
              onKeyDown={e=>e.key==="Enter"&&handle()}
              placeholder="seu@email.com" type="email"
              style={iStyle(!!err)}
              onFocus={e=>e.target.style.borderColor=L.teal}
              onBlur={e=>e.target.style.borderColor=err?L.red:L.line}
            />
          </div>

          <div style={{marginBottom:err?12:20}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <label style={labelS}>Senha</label>
              <span style={{fontSize:11,color:L.teal,cursor:"pointer",fontWeight:500}}>Esqueci a senha</span>
            </div>
            <div style={{position:"relative"}}>
              <input value={pass} onChange={e=>{setPass(e.target.value);setErr("");}}
                onKeyDown={e=>e.key==="Enter"&&handle()}
                placeholder="••••••••" type={show?"text":"password"}
                style={{...iStyle(!!err),paddingRight:42}}
                onFocus={e=>e.target.style.borderColor=L.teal}
                onBlur={e=>e.target.style.borderColor=err?L.red:L.line}
              />
              <button onClick={()=>setShow(p=>!p)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:13,padding:2}}>
                {show?"●":"○"}
              </button>
            </div>
          </div>

          {err && (
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:L.redBg,border:`1px solid ${L.red}28`,borderRadius:8,marginBottom:14}}>
              <span style={{color:L.red,fontSize:12,fontWeight:600}}>✕</span>
              <span style={{fontSize:12,color:L.red}}>{err}</span>
            </div>
          )}

          <button onClick={handle} disabled={loading}
            style={{width:"100%",padding:"13px",borderRadius:10,fontSize:14,fontWeight:600,cursor:loading?"wait":"pointer",fontFamily:"inherit",border:"none",background:L.teal,color:"white",opacity:loading?.7:1,transition:"opacity .15s",boxShadow:`0 4px 14px ${L.teal}30`}}
          >
            {loading ? (
              <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",display:"inline-block",animation:"spin .7s linear infinite"}}/>
                Entrando...
              </span>
            ) : "Entrar"}
          </button>
        </div>
      </div>
    );
  }

  /* ── TABLET: painel lateral compacto ── */
  if (isTablet) {
    return (
      <div style={{minHeight:"100dvh",display:"flex",background:L.bg,fontFamily:"'Instrument Sans',sans-serif"}}>
        {/* Painel lateral compacto */}
        <div style={{width:240,background:L.teal,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 24px",flexShrink:0}}>
          <div style={{textAlign:"center",animation:"in .6s ease"}}>
            <div style={{display:"inline-flex",width:72,height:72,borderRadius:20,background:"rgba(255,255,255,0.15)",alignItems:"center",justifyContent:"center",marginBottom:16}}>
              <Logo size={54}/>
            </div>
            <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:24,color:"white",letterSpacing:"-.4px",lineHeight:1,marginBottom:4}}>C4 OS</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.55)",letterSpacing:"2px",textTransform:"uppercase",fontFamily:"'JetBrains Mono',monospace",marginBottom:28}}>by C4HUB</div>
            <div style={{color:"rgba(255,255,255,0.85)",fontSize:12,fontWeight:500,lineHeight:1.6,marginBottom:6}}>O Command Center completo para sua equipe.</div>
            <div style={{color:"rgba(255,255,255,0.45)",fontSize:11,lineHeight:1.6,marginBottom:24}}>CRM · WhatsApp · IA · Funil</div>
            {features.map(t => (
              <div key={t} style={{display:"flex",alignItems:"center",gap:8,color:"rgba(255,255,255,0.75)",fontSize:11,marginBottom:8,textAlign:"left"}}>
                <span style={{width:16,height:16,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,flexShrink:0}}>✓</span>
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Formulário */}
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"32px 40px"}}>
          <div style={{width:"100%",maxWidth:360,animation:"up .5s ease"}}>
            <div style={{marginBottom:28}}>
              <div style={{fontSize:22,fontWeight:700,fontFamily:"'Outfit',sans-serif",color:L.t1,letterSpacing:"-.4px",marginBottom:6}}>Bem-vindo de volta</div>
              <div style={{fontSize:13,color:L.t3}}>Entre com sua conta C4 OS para continuar</div>
            </div>

            <div style={{marginBottom:14}}>
              <label style={labelS}>E-mail</label>
              <input value={email} onChange={e=>{setEmail(e.target.value);setErr("");}}
                onKeyDown={e=>e.key==="Enter"&&handle()}
                placeholder="seu@email.com" type="email"
                style={iStyle(!!err)}
                onFocus={e=>e.target.style.borderColor=L.teal}
                onBlur={e=>e.target.style.borderColor=err?L.red:L.line}
              />
            </div>

            <div style={{marginBottom:err?12:24}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <label style={labelS}>Senha</label>
                <span style={{fontSize:11,color:L.teal,cursor:"pointer",fontWeight:500}}>Esqueci a senha</span>
              </div>
              <div style={{position:"relative"}}>
                <input value={pass} onChange={e=>{setPass(e.target.value);setErr("");}}
                  onKeyDown={e=>e.key==="Enter"&&handle()}
                  placeholder="••••••••" type={show?"text":"password"}
                  style={{...iStyle(!!err),paddingRight:42}}
                  onFocus={e=>e.target.style.borderColor=L.teal}
                  onBlur={e=>e.target.style.borderColor=err?L.red:L.line}
                />
                <button onClick={()=>setShow(p=>!p)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:13,padding:2}}>
                  {show?"●":"○"}
                </button>
              </div>
            </div>

            {err && (
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:L.redBg,border:`1px solid ${L.red}28`,borderRadius:8,marginBottom:16}}>
                <span style={{color:L.red,fontSize:12,fontWeight:600}}>✕</span>
                <span style={{fontSize:12,color:L.red}}>{err}</span>
              </div>
            )}

            <button onClick={handle} disabled={loading}
              style={{width:"100%",padding:"12px",borderRadius:10,fontSize:13,fontWeight:600,cursor:loading?"wait":"pointer",fontFamily:"inherit",border:"none",background:L.teal,color:"white",opacity:loading?.7:1,transition:"opacity .15s",boxShadow:`0 4px 14px ${L.teal}30`}}
            >
              {loading ? (
                <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  <span style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",display:"inline-block",animation:"spin .7s linear infinite"}}/>
                  Entrando...
                </span>
              ) : "Entrar"}
            </button>

            <div style={{marginTop:18,padding:"11px 14px",background:L.surface,borderRadius:10,border:`1px solid ${L.line}`}}>
              <div style={{fontSize:11,color:L.t4,fontFamily:"'JetBrains Mono',monospace"}}>
                Acesse com as credenciais cadastradas no Supabase.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── DESKTOP / LARGE / TV: layout original aprimorado ── */
  return (
    <div style={{minHeight:"100vh",display:"flex",background:L.bg,fontFamily:"'Instrument Sans',sans-serif"}}>
      {/* Painel esquerdo */}
      <div style={{width:isDesktop?420:480,background:L.teal,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:48,flexShrink:0}}>
        <div style={{textAlign:"center",animation:"in .6s ease"}}>
          <div style={{display:"inline-flex",width:96,height:96,borderRadius:24,background:"rgba(255,255,255,0.15)",alignItems:"center",justifyContent:"center",marginBottom:24}}>
            <Logo size={76}/>
          </div>
          <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:32,color:"white",letterSpacing:"-.5px",lineHeight:1,marginBottom:6}}>C4 OS</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",letterSpacing:"2.5px",textTransform:"uppercase",fontFamily:"'JetBrains Mono',monospace",marginBottom:40}}>by C4HUB</div>
          <div style={{color:"rgba(255,255,255,0.9)",fontSize:15,fontWeight:500,lineHeight:1.6,marginBottom:8}}>O Command Center completo para sua equipe comercial.</div>
          <div style={{color:"rgba(255,255,255,0.5)",fontSize:12,lineHeight:1.7,marginBottom:40}}>CRM · WhatsApp · Disparos em massa · Funil · IA · Relatórios · Multi-empresa</div>
          {features.map(t => (
            <div key={t} style={{display:"flex",alignItems:"center",gap:10,color:"rgba(255,255,255,0.8)",fontSize:12,marginBottom:10}}>
              <span style={{width:18,height:18,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0}}>✓</span>
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* Formulário */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:48}}>
        <div style={{width:"100%",maxWidth:400,animation:"up .5s ease"}}>
          <div style={{marginBottom:32}}>
            <div style={{fontSize:24,fontWeight:700,fontFamily:"'Outfit',sans-serif",color:L.t1,letterSpacing:"-.4px",marginBottom:6}}>Bem-vindo de volta</div>
            <div style={{fontSize:13,color:L.t3}}>Entre com sua conta C4 OS para continuar</div>
          </div>

          <div style={{marginBottom:14}}>
            <label style={labelS}>E-mail</label>
            <input value={email} onChange={e=>{setEmail(e.target.value);setErr("");}}
              onKeyDown={e=>e.key==="Enter"&&handle()}
              placeholder="seu@email.com" type="email"
              style={iStyle(!!err)}
              onFocus={e=>e.target.style.borderColor=L.teal}
              onBlur={e=>e.target.style.borderColor=err?L.red:L.line}
            />
          </div>

          <div style={{marginBottom:err?12:24}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <label style={labelS}>Senha</label>
              <span style={{fontSize:11,color:L.teal,cursor:"pointer",fontWeight:500}}>Esqueci a senha</span>
            </div>
            <div style={{position:"relative"}}>
              <input value={pass} onChange={e=>{setPass(e.target.value);setErr("");}}
                onKeyDown={e=>e.key==="Enter"&&handle()}
                placeholder="••••••••" type={show?"text":"password"}
                style={{...iStyle(!!err),paddingRight:42}}
                onFocus={e=>e.target.style.borderColor=L.teal}
                onBlur={e=>e.target.style.borderColor=err?L.red:L.line}
              />
              <button onClick={()=>setShow(p=>!p)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:13,padding:2}}>
                {show?"●":"○"}
              </button>
            </div>
          </div>

          {err && (
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:L.redBg,border:`1px solid ${L.red}28`,borderRadius:8,marginBottom:16}}>
              <span style={{color:L.red,fontSize:12,fontWeight:600}}>✕</span>
              <span style={{fontSize:12,color:L.red}}>{err}</span>
            </div>
          )}

          <button onClick={handle} disabled={loading}
            style={{width:"100%",padding:"11px",borderRadius:10,fontSize:13,fontWeight:600,cursor:loading?"wait":"pointer",fontFamily:"inherit",border:"none",background:L.teal,color:"white",opacity:loading?.7:1,transition:"opacity .15s",boxShadow:`0 4px 14px ${L.teal}30`}}
          >
            {loading ? (
              <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",display:"inline-block",animation:"spin .7s linear infinite"}}/>
                Entrando...
              </span>
            ) : "Entrar"}
          </button>

          <div style={{marginTop:20,padding:"12px 16px",background:L.surface,borderRadius:10,border:`1px solid ${L.line}`}}>
            <div style={{fontSize:11,color:L.t4,fontFamily:"'JetBrains Mono',monospace"}}>
              Acesse com as credenciais cadastradas no Supabase.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
