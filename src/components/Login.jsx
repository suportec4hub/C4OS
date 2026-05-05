import { useState } from "react";
import Logo from "./Logo";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [show,    setShow]    = useState(false);
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null); // "email" | "pass" | null

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

  const iStyle = (field) => ({
    width:"100%", background:L.white,
    border:`1.5px solid ${err ? L.red : focused === field ? L.t1 : L.line}`,
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

  const features = [
    { icon:"◈", text:"Funil Kanban arrastar e soltar" },
    { icon:"◇", text:"Disparos em massa WhatsApp" },
    { icon:"✦", text:"Agente de IA embarcado" },
    { icon:"⊞", text:"Multi-tenant com isolamento total" },
  ];

  return (
    <div style={{minHeight:"100dvh",display:"flex",background:L.white,fontFamily:"'Instrument Sans',sans-serif"}}>

      {/* ── Painel esquerdo — branco ── */}
      <div style={{
        width:"clamp(280px, 36%, 440px)",
        background:L.surface,
        borderRight:`1px solid ${L.line}`,
        display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",
        padding:"48px 40px",flexShrink:0,
      }}>
        <div style={{textAlign:"center",width:"100%",maxWidth:320}}>
          {/* Logo */}
          <div style={{
            display:"inline-flex",width:88,height:88,borderRadius:22,
            background:L.white,border:`1.5px solid ${L.line}`,
            alignItems:"center",justifyContent:"center",marginBottom:20,
            boxShadow:"0 2px 8px rgba(0,0,0,0.06)"
          }}>
            <Logo size={64}/>
          </div>

          {/* Brand */}
          <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:28,color:L.t1,letterSpacing:"-.5px",lineHeight:1,marginBottom:4}}>
            C4 <span style={{color:L.t3}}>OS</span>
          </div>
          <div style={{fontSize:10,color:L.t4,letterSpacing:"2.5px",textTransform:"uppercase",fontFamily:"'JetBrains Mono',monospace",marginBottom:32}}>
            by C4HUB
          </div>

          {/* Tagline */}
          <div style={{fontSize:13,fontWeight:500,color:L.t2,lineHeight:1.6,marginBottom:6}}>
            O Command Center completo para sua equipe comercial.
          </div>
          <div style={{fontSize:11,color:L.t4,lineHeight:1.7,marginBottom:32}}>
            CRM · WhatsApp · IA · Funil · Relatórios
          </div>

          {/* Features */}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {features.map(f => (
              <div key={f.text} style={{
                display:"flex",alignItems:"center",gap:10,
                padding:"9px 12px",
                background:L.white,borderRadius:9,
                border:`1px solid ${L.line}`,
                textAlign:"left"
              }}>
                <span style={{fontSize:13,color:L.t3,flexShrink:0}}>{f.icon}</span>
                <span style={{fontSize:11,color:L.t2,fontWeight:500}}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Formulário — branco ── */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 40px"}}>
        <div style={{width:"100%",maxWidth:400}}>

          {/* Header */}
          <div style={{marginBottom:32}}>
            <div style={{fontSize:24,fontWeight:700,fontFamily:"'Outfit',sans-serif",color:L.t1,letterSpacing:"-.4px",marginBottom:6}}>
              Bem-vindo de volta
            </div>
            <div style={{fontSize:13,color:L.t3}}>
              Entre com sua conta C4 OS para continuar
            </div>
          </div>

          {/* E-mail */}
          <div style={{marginBottom:14}}>
            <label style={labelS}>E-mail</label>
            <input
              value={email}
              onChange={e => { setEmail(e.target.value); if (err) setErr(""); }}
              onKeyDown={e => e.key === "Enter" && handle()}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              placeholder="seu@email.com"
              type="email"
              autoComplete="email"
              style={iStyle("email")}
            />
          </div>

          {/* Senha */}
          <div style={{marginBottom: err ? 12 : 24}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <label style={labelS}>Senha</label>
              <span style={{fontSize:11,color:L.t1,cursor:"pointer",fontWeight:500,textDecoration:"underline",textUnderlineOffset:3}}>
                Esqueci a senha
              </span>
            </div>
            <div style={{position:"relative"}}>
              <input
                value={pass}
                onChange={e => { setPass(e.target.value); if (err) setErr(""); }}
                onKeyDown={e => e.key === "Enter" && handle()}
                onFocus={() => setFocused("pass")}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                style={{...iStyle("pass"), paddingRight:42}}
              />
              <button
                onClick={() => setShow(p => !p)}
                type="button"
                style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:13,padding:2}}
              >
                {show ? "●" : "○"}
              </button>
            </div>
          </div>

          {/* Erro */}
          {err && (
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:L.redBg,border:`1px solid ${L.red}28`,borderRadius:8,marginBottom:16}}>
              <span style={{color:L.red,fontSize:12,fontWeight:600}}>✕</span>
              <span style={{fontSize:12,color:L.red}}>{err}</span>
            </div>
          )}

          {/* Botão */}
          <button
            onClick={handle}
            disabled={loading}
            type="button"
            style={{
              width:"100%",padding:"13px",borderRadius:10,fontSize:13,fontWeight:600,
              cursor: loading ? "wait" : "pointer",fontFamily:"inherit",border:"none",
              background:L.t1,color:L.white,
              opacity: loading ? 0.7 : 1,transition:"opacity .15s",
              boxShadow:"0 2px 8px rgba(0,0,0,0.12)"
            }}
          >
            {loading ? (
              <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",display:"inline-block",animation:"spin .7s linear infinite"}}/>
                Entrando...
              </span>
            ) : "Entrar na plataforma"}
          </button>

        </div>
      </div>
    </div>
  );
}
