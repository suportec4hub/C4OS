import { useState } from "react";
import { supabase } from "../lib/supabase";
import { L } from "../constants/theme";

export default function ChangePasswordScreen({ user, onDone }) {
  const [novaSenha,  setNovaSenha]  = useState("");
  const [confirmar,  setConfirmar]  = useState("");
  const [showNova,   setShowNova]   = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState("");

  const force = async () => {
    if (!novaSenha || novaSenha.length < 6) { setErr("A senha deve ter no mínimo 6 caracteres."); return; }
    if (novaSenha !== confirmar)            { setErr("As senhas não coincidem."); return; }
    setSaving(true); setErr("");

    const { error: authErr } = await supabase.auth.updateUser({ password: novaSenha });
    if (authErr) { setErr(authErr.message); setSaving(false); return; }

    await supabase.from("usuarios").update({ must_change_password: false }).eq("id", user.id);

    setSaving(false);
    onDone();
  };

  const inp = (val, set, show, setShow, ph) => (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={val}
        onChange={e => set(e.target.value)}
        placeholder={ph}
        style={{
          width: "100%", padding: "11px 42px 11px 14px", borderRadius: 10,
          border: `1.5px solid ${L.line}`, background: L.surface,
          color: L.t1, fontSize: 13, fontFamily: "inherit", outline: "none",
          boxSizing: "border-box", transition: "border-color .12s",
        }}
        onFocus={e => e.target.style.borderColor = L.accent}
        onBlur={e  => e.target.style.borderColor = L.line}
      />
      <button
        onClick={() => setShow(s => !s)}
        style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", color: L.t4, fontSize: 15,
        }}
      >{show ? "🙈" : "👁"}</button>
    </div>
  );

  const strength = novaSenha.length === 0 ? 0
    : novaSenha.length < 6  ? 1
    : novaSenha.length < 10 ? 2
    : /[A-Z]/.test(novaSenha) && /[0-9]/.test(novaSenha) ? 4 : 3;
  const strColors = ["transparent", L.red, L.yellow, L.green, L.teal];
  const strLabels = ["", "Muito fraca", "Fraca", "Boa", "Forte"];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "var(--c-bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, zIndex: 9999,
    }}>
      <div style={{
        background: L.white, borderRadius: 20, padding: "44px 44px 40px",
        width: "100%", maxWidth: 440,
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        border: `1px solid ${L.line}`,
      }}>

        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: L.tealBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, marginBottom: 24,
        }}>🔐</div>

        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: L.t1, letterSpacing: "-0.3px" }}>
          Crie sua nova senha
        </h2>
        <p style={{ margin: "0 0 28px", fontSize: 13.5, color: L.t3, lineHeight: 1.65 }}>
          Por segurança, é necessário definir uma nova senha antes de acessar o sistema.
          {user?.nome ? ` Olá, ${user.nome.split(" ")[0]}!` : ""}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: L.t3, textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: 6 }}>
              Nova senha *
            </label>
            {inp(novaSenha, setNovaSenha, showNova, setShowNova, "Mínimo 6 caracteres")}
            {/* Barra de força */}
            {novaSenha.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, display: "flex", gap: 3 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{
                      flex: 1, height: 3, borderRadius: 99,
                      background: strength >= i ? strColors[strength] : L.line,
                      transition: "background .2s",
                    }}/>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: strColors[strength], fontWeight: 600, width: 70, textAlign: "right" }}>
                  {strLabels[strength]}
                </span>
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: L.t3, textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: 6 }}>
              Confirmar senha *
            </label>
            {inp(confirmar, setConfirmar, showConf, setShowConf, "Repita a nova senha")}
            {confirmar.length > 0 && novaSenha !== confirmar && (
              <div style={{ marginTop: 6, fontSize: 11, color: L.red }}>As senhas não coincidem</div>
            )}
            {confirmar.length > 0 && novaSenha === confirmar && (
              <div style={{ marginTop: 6, fontSize: 11, color: L.green }}>✓ Senhas conferem</div>
            )}
          </div>
        </div>

        {err && (
          <div style={{
            marginTop: 14, padding: "10px 14px", background: L.redBg,
            border: `1px solid ${L.redA2}`, borderRadius: 9, fontSize: 12, color: L.red,
          }}>
            {err}
          </div>
        )}

        <button
          onClick={force}
          disabled={saving || novaSenha.length < 6 || novaSenha !== confirmar}
          style={{
            marginTop: 24, width: "100%", padding: "13px",
            background: (saving || novaSenha.length < 6 || novaSenha !== confirmar) ? L.surface : L.accent,
            color: (saving || novaSenha.length < 6 || novaSenha !== confirmar) ? L.t3 : "white",
            border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700,
            cursor: (saving || novaSenha.length < 6 || novaSenha !== confirmar) ? "not-allowed" : "pointer",
            fontFamily: "inherit", transition: "all .15s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {saving ? (
            <>
              <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" }}/>
              Salvando...
            </>
          ) : "Definir senha e entrar →"}
        </button>

        <div style={{ marginTop: 16, fontSize: 11.5, color: L.t4, textAlign: "center", lineHeight: 1.6 }}>
          Após salvar, você terá acesso completo ao sistema.<br/>
          Em caso de dúvidas, contate o administrador.
        </div>
      </div>
    </div>
  );
}
