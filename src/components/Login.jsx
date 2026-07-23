import { useState } from "react";
import Logo from "./Logo";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { useBreakpoint } from "../hooks/useBreakpoint";

export default function Login() {
  const [email,        setEmail]        = useState("");
  const [pass,         setPass]         = useState("");
  const [show,         setShow]         = useState(false);
  const [err,          setErr]          = useState("");
  const [loading,      setLoading]      = useState(false);
  const [focused,      setFocused]      = useState(null);
  const [resetMode,    setResetMode]    = useState(false);
  const [resetEmail,   setResetEmail]   = useState("");
  const [resetSent,    setResetSent]    = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { isMobile, isTablet } = useBreakpoint();
  const isSmall = isMobile || isTablet;

  const handle = async () => {
    if (!email.trim() || !pass) { setErr("Preencha e-mail e senha."); return; }
    setErr(""); setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: pass,
      });
      if (error) setErr("E-mail ou senha incorretos.");
    } catch (_) {
      setErr("Erro de conexão. Verifique sua internet.");
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!resetEmail.trim()) { setErr("Digite seu e-mail."); return; }
    setErr(""); setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        resetEmail.trim().toLowerCase(),
        { redirectTo: window.location.origin + "/c4os" }
      );
      if (error) { setErr(error.message); }
      else { setResetSent(true); }
    } catch (_) {
      setErr("Erro de conexão. Verifique sua internet.");
    }
    setResetLoading(false);
  };

  const iStyle = (field) => ({
    width: "100%", background: L.white,
    border: `1.5px solid ${err ? L.red : focused === field ? L.t1 : L.line}`,
    borderRadius: 10, padding: isSmall ? "13px 14px" : "11px 14px",
    color: L.t1, fontSize: isSmall ? 16 : 13, fontFamily: "inherit",
    outline: "none", transition: "border-color .15s",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    boxSizing: "border-box",
  });

  const labelS = {
    display: "block", fontSize: 11, fontWeight: 600,
    color: L.t2, marginBottom: 6, textTransform: "uppercase",
    letterSpacing: "1px", fontFamily: "'JetBrains Mono',monospace",
  };

  const features = [
    { icon: "◈", text: "Funil Kanban arrastar e soltar" },
    { icon: "◇", text: "Disparos em massa WhatsApp" },
    { icon: "✦", text: "Agente de IA embarcado" },
    { icon: "⊞", text: "Multi-tenant com isolamento total" },
  ];

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: isSmall ? "column" : "row",
      background: L.white,
      fontFamily: "'Instrument Sans',sans-serif",
    }}>

      {/* ── Painel esquerdo / topo — branding ── */}
      <div style={{
        width: isSmall ? "100%" : "clamp(280px, 36%, 440px)",
        minWidth: isSmall ? "auto" : 280,
        background: L.surface,
        borderRight: isSmall ? "none" : `1px solid ${L.line}`,
        borderBottom: isSmall ? `1px solid ${L.line}` : "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: isSmall ? "flex-start" : "center",
        padding: isSmall ? "32px 24px 24px" : "48px 40px",
        flexShrink: 0,
        paddingTop: isSmall ? "max(32px, env(safe-area-inset-top))" : "48px",
      }}>
        <div style={{ textAlign: "center", width: "100%", maxWidth: isSmall ? 340 : 320 }}>
          {/* Logo */}
          <div style={{
            display: "inline-flex",
            width: isSmall ? 72 : 88,
            height: isSmall ? 72 : 88,
            borderRadius: isSmall ? 18 : 22,
            background: L.white, border: `1.5px solid ${L.line}`,
            alignItems: "center", justifyContent: "center",
            marginBottom: isSmall ? 14 : 20,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}>
            <Logo size={isSmall ? 52 : 64} />
          </div>

          {/* Brand */}
          <div style={{
            fontFamily: "'Outfit',sans-serif", fontWeight: 800,
            fontSize: isSmall ? 24 : 28, color: L.t1,
            letterSpacing: "-.5px", lineHeight: 1, marginBottom: 4,
          }}>
            C4 <span style={{ color: L.t3 }}>OS</span>
          </div>
          <div style={{
            fontSize: 10, color: L.t4, letterSpacing: "2.5px",
            textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace",
            marginBottom: isSmall ? 16 : 32,
          }}>
            by C4HUB
          </div>

          {/* Tagline */}
          <div style={{ fontSize: 13, fontWeight: 500, color: L.t2, lineHeight: 1.6, marginBottom: 4 }}>
            O Command Center completo para sua equipe comercial.
          </div>
          <div style={{ fontSize: 11, color: L.t4, lineHeight: 1.7, marginBottom: isSmall ? 16 : 32 }}>
            CRM · WhatsApp · IA · Funil · Relatórios
          </div>

          {/* Features — visível apenas no desktop */}
          {!isSmall && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {features.map(f => (
                <div key={f.text} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px",
                  background: L.white, borderRadius: 9,
                  border: `1px solid ${L.line}`,
                  textAlign: "left",
                }}>
                  <span style={{ fontSize: 13, color: L.t3, flexShrink: 0 }}>{f.icon}</span>
                  <span style={{ fontSize: 11, color: L.t2, fontWeight: 500 }}>{f.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Formulário ── */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: isSmall ? "flex-start" : "center",
        justifyContent: "center",
        padding: isSmall ? "28px 20px" : "48px 40px",
        paddingBottom: isSmall ? "max(28px, env(safe-area-inset-bottom))" : "48px",
      }}>
        <div style={{ width: "100%", maxWidth: isSmall ? 400 : 400 }}>

          {/* ── MODO RESET DE SENHA ── */}
          {resetMode ? (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: isSmall ? 22 : 22, fontWeight: 700, fontFamily: "'Outfit',sans-serif", color: L.t1, letterSpacing: "-.4px", marginBottom: 6 }}>
                  Redefinir senha
                </div>
                <div style={{ fontSize: 13, color: L.t3 }}>
                  Informe seu e-mail e enviaremos um link para redefinir sua senha.
                </div>
              </div>

              {resetSent ? (
                <div style={{ background: L.greenBg, border: `1px solid ${L.green}33`, borderRadius: 10, padding: "18px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>✉️</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: L.t1, marginBottom: 6 }}>E-mail enviado!</div>
                  <div style={{ fontSize: 12, color: L.t3, lineHeight: 1.6, marginBottom: 18 }}>
                    Verifique sua caixa de entrada e siga o link para redefinir sua senha.
                  </div>
                  <button onClick={() => { setResetMode(false); setResetSent(false); setResetEmail(""); setErr(""); }}
                    style={{ fontSize: 12, color: L.teal, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>
                    Voltar ao login
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelS}>E-mail da conta</label>
                    <input value={resetEmail} onChange={e => { setResetEmail(e.target.value); if (err) setErr(""); }}
                      onKeyDown={e => e.key === "Enter" && handleReset()}
                      placeholder="seu@email.com" type="email" autoComplete="email"
                      style={iStyle("email")} autoFocus />
                  </div>

                  {err && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: L.redBg, border: `1px solid ${L.redA}`, borderRadius: 8, marginBottom: 16 }}>
                      <span style={{ color: L.red, fontSize: 12, fontWeight: 600 }}>✕</span>
                      <span style={{ fontSize: 12, color: L.red }}>{err}</span>
                    </div>
                  )}

                  <button onClick={handleReset} disabled={resetLoading} type="button"
                    style={{ width: "100%", padding: isSmall ? "15px" : "13px", borderRadius: 10, fontSize: isSmall ? 15 : 13, fontWeight: 600,
                      cursor: resetLoading ? "wait" : "pointer", fontFamily: "inherit", border: "none",
                      background: L.accent, color: "white", opacity: resetLoading ? 0.7 : 1,
                      transition: "opacity .15s", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", marginBottom: 14 }}>
                    {resetLoading ? (
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", display: "inline-block", animation: "spin .7s linear infinite" }} />
                        Enviando...
                      </span>
                    ) : "Enviar link de redefinição"}
                  </button>

                  <button onClick={() => { setResetMode(false); setErr(""); }}
                    style={{ width: "100%", fontSize: 13, color: L.t3, background: "none", border: `1px solid ${L.line}`, borderRadius: 10,
                      padding: isSmall ? "14px" : "10px", cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = L.t2; e.currentTarget.style.color = L.t1; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = L.line; e.currentTarget.style.color = L.t3; }}>
                    ← Voltar ao login
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              {/* ── MODO LOGIN ── */}
              <div style={{ marginBottom: isSmall ? 24 : 32 }}>
                <div style={{ fontSize: isSmall ? 22 : 24, fontWeight: 700, fontFamily: "'Outfit',sans-serif", color: L.t1, letterSpacing: "-.4px", marginBottom: 6 }}>
                  Bem-vindo de volta
                </div>
                <div style={{ fontSize: 13, color: L.t3 }}>
                  Entre com sua conta C4 OS para continuar
                </div>
              </div>

              {/* E-mail */}
              <div style={{ marginBottom: 16 }}>
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
              <div style={{ marginBottom: err ? 14 : 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={labelS}>Senha</label>
                  <button onClick={() => { setResetMode(true); setResetEmail(email); setErr(""); }}
                    type="button"
                    style={{ fontSize: 11, color: L.t1, cursor: "pointer", fontWeight: 500, textDecoration: "underline",
                      textUnderlineOffset: 3, background: "none", border: "none", fontFamily: "inherit", padding: 0, minHeight: 36 }}>
                    Esqueci a senha
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    value={pass}
                    onChange={e => { setPass(e.target.value); if (err) setErr(""); }}
                    onKeyDown={e => e.key === "Enter" && handle()}
                    onFocus={() => setFocused("pass")}
                    onBlur={() => setFocused(null)}
                    placeholder="••••••••"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    style={{ ...iStyle("pass"), paddingRight: 48 }}
                  />
                  <button
                    onClick={() => setShow(p => !p)}
                    type="button"
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", color: L.t4, fontSize: 15,
                      padding: 4, minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {show ? "●" : "○"}
                  </button>
                </div>
              </div>

              {/* Erro */}
              {err && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: L.redBg, border: `1px solid ${L.redA}`, borderRadius: 8, marginBottom: 16 }}>
                  <span style={{ color: L.red, fontSize: 13, fontWeight: 600 }}>✕</span>
                  <span style={{ fontSize: 13, color: L.red }}>{err}</span>
                </div>
              )}

              {/* Botão */}
              <button
                onClick={handle}
                disabled={loading}
                type="button"
                style={{
                  width: "100%",
                  padding: isSmall ? "15px" : "13px",
                  borderRadius: 10, fontSize: isSmall ? 16 : 13, fontWeight: 600,
                  cursor: loading ? "wait" : "pointer", fontFamily: "inherit", border: "none",
                  background: L.accent, color: "white",
                  opacity: loading ? 0.7 : 1, transition: "opacity .15s",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                  minHeight: isSmall ? 52 : 44,
                }}
              >
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", display: "inline-block", animation: "spin .7s linear infinite" }} />
                    Entrando...
                  </span>
                ) : "Entrar na plataforma"}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
