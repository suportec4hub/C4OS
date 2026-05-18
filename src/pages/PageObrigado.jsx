import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const C = {
  dark:      "#111827",
  teal:      "#1aaa96",
  tealDk:    "#0d8a78",
  tealLight: "#e6f7f5",
  tealA:     "rgba(26,170,150,0.15)",
  tealA2:    "rgba(26,170,150,0.30)",
  green:     "#16a34a",
  greenLight:"#f0fdf4",
  surface:   "#f9fafb",
  border:    "#e5e7eb",
  text:      "#374151",
  muted:     "#6b7280",
  faint:     "#9ca3af",
  white:     "#ffffff",
};

function useW() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 768 };
}

/* ── Confetti animado (CSS puro, partículas absolutas) ─────────── */
const CONFETTI_COLORS = ["#1aaa96","#111827","#f59e0b","#3b82f6","#ec4899","#8b5cf6"];
const Confetti = () => {
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${(i * 3.7) % 100}%`,
    delay: `${(i * 0.13) % 2}s`,
    dur: `${2.5 + (i % 5) * 0.3}s`,
    size: 7 + (i % 4) * 3,
    rotate: i * 47,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <style>{`
        @keyframes fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(340px) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: "absolute",
          left: p.left,
          top: 0,
          width: p.size,
          height: p.size * 0.55,
          borderRadius: 2,
          background: p.color,
          animation: `fall ${p.dur} ${p.delay} ease-in forwards`,
          transform: `rotate(${p.rotate}deg)`,
        }} />
      ))}
    </div>
  );
};

/* ── Check animado ──────────────────────────────────────────────── */
const CheckCircle = () => (
  <>
    <style>{`
      @keyframes popIn {
        0%   { transform: scale(0.3); opacity: 0; }
        70%  { transform: scale(1.12); }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes drawCheck {
        from { stroke-dashoffset: 60; }
        to   { stroke-dashoffset: 0; }
      }
    `}</style>
    <div style={{ animation: "popIn .55s cubic-bezier(.34,1.56,.64,1) forwards", width: 88, height: 88, borderRadius: "50%", background: C.teal, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 12px ${C.tealA}, 0 0 0 24px ${C.tealA}` }}>
      <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
        <polyline points="8,22 17,31 34,12" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: 60, strokeDashoffset: 60, animation: "drawCheck .45s .4s ease forwards" }} />
      </svg>
    </div>
  </>
);

const DEFAULT_STEPS = [
  { n: "01", icon: "✉️", title: "Verifique seu e-mail", desc: "Enviamos um e-mail de confirmação com os detalhes do seu pedido e as instruções de acesso. Confira também sua caixa de spam." },
  { n: "02", icon: "⚙️", title: "Configure sua conta", desc: "Acesse a plataforma com as credenciais enviadas, complete o perfil da empresa e convide os membros do seu time." },
  { n: "03", icon: "🚀", title: "Conecte seu WhatsApp", desc: "Vincule seu número de WhatsApp Business e comece a centralizar atendimentos, automatizar respostas e fechar mais vendas." },
];

const DEFAULT_PLANOS = {
  starter:      { nome: "Starter",      cor: C.teal,   usuarios: "Até 3 usuários" },
  profissional: { nome: "Profissional", cor: "#2563eb", usuarios: "Até 10 usuários" },
  enterprise:   { nome: "Enterprise",   cor: "#7c3aed", usuarios: "Usuários ilimitados" },
};

/* ── Página principal ───────────────────────────────────────────── */
export default function PageObrigado({ onNavigate }) {
  const { isMobile } = useW();
  const [hov, setHov]       = useState(null);
  const [cfg, setCfg]       = useState(null);

  useEffect(() => {
    supabase.from("checkout_config").select("config").eq("id", 1).single()
      .then(({ data }) => { if (data?.config) setCfg(data.config); });
  }, []);

  const titulo      = cfg?.titulo      ?? "Sua compra foi confirmada!";
  const subtitulo   = cfg?.subtitulo   ?? "Estamos preparando tudo para você. Em breve você receberá o acesso completo à plataforma C4 OS e poderá começar a transformar seu time comercial.";
  const badge       = cfg?.badge       ?? "🎉 Compra realizada com sucesso";
  const whatsapp    = cfg?.whatsapp    ?? "5562982054815";
  const whatsappMsg = cfg?.whatsapp_msg ?? "Olá! Acabei de finalizar minha compra do C4 OS e preciso de ajuda com o onboarding.";
  const STEPS       = cfg?.steps       ?? DEFAULT_STEPS;
  const PLANOS      = cfg?.planos      ?? DEFAULT_PLANOS;

  const params  = new URLSearchParams(window.location.search);
  const planoId = (params.get("plano") || "").toLowerCase();
  const empresa = params.get("empresa") || "";
  const ref     = params.get("ref") || Math.random().toString(36).slice(2, 8).toUpperCase();
  const plano   = PLANOS[planoId];

  const Btn = ({ id, children, onClick, variant = "solid", full = false }) => {
    const h = hov === id;
    const base = { borderRadius: 12, fontWeight: 700, fontSize: isMobile ? 14 : 15, cursor: "pointer", transition: "all .18s", fontFamily: "'Outfit',sans-serif", border: "none", padding: isMobile ? "13px 22px" : "14px 30px", width: full ? "100%" : "auto" };
    const solid   = { background: h ? C.tealDk : C.teal, color: "#fff", boxShadow: `0 4px 16px ${C.tealA2}`, ...base };
    const outline = { background: h ? C.tealLight : "transparent", color: C.teal, border: `2px solid ${C.teal}`, ...base };
    return <button style={variant === "solid" ? solid : outline} onClick={onClick} onMouseEnter={() => setHov(id)} onMouseLeave={() => setHov(null)}>{children}</button>;
  };

  return (
    <div style={{ fontFamily: "'Outfit','Inter',system-ui,sans-serif", background: C.surface, color: C.text, minHeight: "100vh" }}>

      {/* Header mínimo */}
      <header style={{ background: C.white, borderBottom: `1px solid ${C.border}`, height: 64, display: "flex", alignItems: "center", padding: isMobile ? "0 20px" : "0 40px", gap: 12 }}>
        <button onClick={() => onNavigate && onNavigate("landing")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: 0 }}>
          <img src="/logo.png" alt="C4 OS" width={34} height={34} style={{ objectFit: "contain" }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.dark, lineHeight: 1 }}>C4 <span style={{ color: C.teal }}>OS</span></div>
            <div style={{ fontSize: 9, color: C.faint, letterSpacing: "1.2px", textTransform: "uppercase" }}>by C4HUB</div>
          </div>
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />
          <span style={{ fontSize: 12, color: C.muted }}>Pedido confirmado</span>
        </div>
      </header>

      {/* Hero — confirmação */}
      <section style={{ background: `linear-gradient(160deg, ${C.tealLight} 0%, ${C.white} 55%)`, padding: isMobile ? "52px 20px 40px" : "72px 40px 56px", position: "relative", overflow: "hidden", textAlign: "center" }}>
        <Confetti />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 620, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <CheckCircle />
          </div>
          <div style={{ display: "inline-block", background: C.tealLight, border: `1px solid ${C.tealA2}`, borderRadius: 999, padding: "5px 18px", fontSize: 13, fontWeight: 600, color: C.tealDk, marginBottom: 20 }}>
            {badge}
          </div>
          <h1 style={{ fontSize: isMobile ? 30 : 44, fontWeight: 900, color: C.dark, letterSpacing: "-1px", margin: "0 0 16px", lineHeight: 1.1 }}>
            {empresa ? `Bem-vindo(a), ${empresa}!` : titulo}
          </h1>
          <p style={{ fontSize: isMobile ? 15 : 18, color: C.muted, lineHeight: 1.75, maxWidth: 500, margin: "0 auto 28px" }}>
            {subtitulo}
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 20px", fontSize: 13, color: C.muted }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600 }}>Nº do pedido</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: C.dark, fontSize: 15 }}>#{ref}</span>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: isMobile ? "32px 16px 64px" : "48px 24px 80px", display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Card do plano (se informado via ?plano=) */}
        {plano && (
          <div style={{ background: C.white, borderRadius: 16, border: `2px solid ${plano.cor}`, padding: isMobile ? "24px 20px" : "28px 32px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: `${plano.cor}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>📦</div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: plano.cor, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>Plano adquirido</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.dark }}>{plano.nome}</div>
              <div style={{ fontSize: 14, color: C.muted, marginTop: 2 }}>{plano.usuarios} · Suporte em português · Acesso imediato</div>
            </div>
            <div style={{ background: C.green, color: "#fff", borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>✓ Pago</div>
          </div>
        )}

        {/* Card genérico se não há plano */}
        {!plano && (
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: isMobile ? "24px 20px" : "28px 32px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>📦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>Plano adquirido</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.dark }}>C4 OS — Plataforma Completa</div>
              <div style={{ fontSize: 14, color: C.muted, marginTop: 2 }}>CRM · WhatsApp · Chatbot · Pipeline · Relatórios</div>
            </div>
            <div style={{ background: C.green, color: "#fff", borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>✓ Confirmado</div>
          </div>
        )}

        {/* Próximos passos */}
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: isMobile ? "24px 20px" : "36px 36px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.dark, marginBottom: 28, letterSpacing: "-0.3px" }}>O que acontece agora?</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 20 }}>{s.icon}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: C.teal }}>{s.n}</span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: C.dark }}>{s.title}</span>
                  </div>
                  <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ position: "absolute" }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
          <Btn id="plat" onClick={() => onNavigate && onNavigate("login")} full={isMobile}>
            Acessar a Plataforma →
          </Btn>
          <Btn id="wpp" variant="outline" onClick={() => window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(whatsappMsg)}`, "_blank")} full={isMobile}>
            💬 Falar com Especialista
          </Btn>
        </div>

        {/* Info extra */}
        <div style={{ background: C.tealLight, borderRadius: 12, padding: isMobile ? "16px 18px" : "18px 24px", border: `1px solid ${C.tealA2}`, display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.dark, marginBottom: 4 }}>Dúvidas sobre o acesso?</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>
              Nossa equipe de onboarding está disponível para ajudar. Entre em contato pelo WhatsApp <strong style={{ color: C.dark }}>({whatsapp.slice(2,4)}) {whatsapp.slice(4,9)}-{whatsapp.slice(9)}</strong> ou aguarde o contato do nosso especialista em até 24 horas úteis.
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: C.dark, padding: isMobile ? "24px 20px" : "28px 40px", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="C4 OS" width={26} height={26} style={{ objectFit: "contain", filter: "invert(1)" }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>C4 OS <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>by C4HUB</span></span>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>© 2025 C4HUB. Todos os direitos reservados.</div>
      </footer>
    </div>
  );
}
