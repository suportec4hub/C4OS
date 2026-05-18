import { useState } from "react";

const C = {
  green: "#16a34a",
  greenCta: "#22c55e",
  greenLight: "#f0fdf4",
  greenDark: "#052e16",
  body: "#374151",
  border: "#e5e7eb",
  white: "#ffffff",
};

const Header = ({ onNavigate }) => {
  const [hovered, setHovered] = useState(null);

  const navBtn = (label, target) => (
    <button
      key={target}
      onMouseEnter={() => setHovered(target)}
      onMouseLeave={() => setHovered(null)}
      onClick={() => onNavigate(target)}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: hovered === target ? C.green : C.body,
        fontWeight: 500,
        fontSize: 15,
        padding: "6px 12px",
        borderRadius: 6,
        transition: "color .15s",
      }}
    >
      {label}
    </button>
  );

  return (
    <header style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      background: C.white,
      borderBottom: `1px solid ${C.border}`,
      boxShadow: "0 1px 8px rgba(0,0,0,.06)",
      height: 64,
      display: "flex",
      alignItems: "center",
      padding: "0 40px",
      justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span style={{ fontWeight: 800, fontSize: 20, color: C.greenDark, letterSpacing: "-0.5px" }}>C4 OS</span>
        <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, letterSpacing: "0.3px" }}>by C4HUB</span>
      </div>
      <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {navBtn("Blog", "blog")}
        {navBtn("Documentação", "docs")}
        <button
          onMouseEnter={() => setHovered("login-cta")}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onNavigate("login")}
          style={{
            marginLeft: 8,
            background: hovered === "login-cta" ? C.green : C.greenCta,
            color: C.white,
            border: "none",
            borderRadius: 999,
            padding: "9px 22px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            transition: "background .15s",
            letterSpacing: "0.1px",
          }}
        >
          Acessar Plataforma →
        </button>
      </nav>
    </header>
  );
};

const MockDashboard = () => (
  <div style={{
    background: C.white,
    borderRadius: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,.18)",
    overflow: "hidden",
    border: `1px solid ${C.border}`,
    width: "100%",
    maxWidth: 480,
  }}>
    <div style={{ background: "#f3f4f6", padding: "10px 16px", display: "flex", alignItems: "center", gap: 6, borderBottom: `1px solid ${C.border}` }}>
      <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
      <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
      <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
      <span style={{ marginLeft: 8, fontSize: 12, color: "#9ca3af" }}>app.c4os.com.br</span>
    </div>
    <div style={{ display: "flex", height: 320 }}>
      <div style={{
        width: 52,
        background: "#111827",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "16px 0",
        gap: 14,
      }}>
        {["#22c55e", "#6b7280", "#6b7280", "#6b7280", "#6b7280"].map((c, i) => (
          <div key={i} style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: c === "#22c55e" ? "rgba(34,197,94,.15)" : "rgba(255,255,255,.05)",
            border: c === "#22c55e" ? "1px solid rgba(34,197,94,.4)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: "16px", overflow: "hidden" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 14 }}>Dashboard</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Leads Hoje", value: "47", delta: "+12%", color: "#dcfce7", tc: "#15803d" },
            { label: "Deals Abertos", value: "23", delta: null, color: "#eff6ff", tc: "#1d4ed8" },
            { label: "Atendimentos", value: "156", delta: "+8%", color: "#fef9c3", tc: "#854d0e" },
          ].map((m, i) => (
            <div key={i} style={{
              flex: 1,
              background: m.color,
              borderRadius: 8,
              padding: "8px 10px",
            }}>
              <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 500, marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{m.value}</div>
              {m.delta && <div style={{ fontSize: 10, color: m.tc, fontWeight: 600, marginTop: 2 }}>{m.delta}</div>}
            </div>
          ))}
        </div>
        <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 72, marginBottom: 6 }}>
            {[40, 55, 35, 70, 60, 85, 75].map((h, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                <div style={{
                  height: `${h}%`,
                  background: i === 5 ? C.greenCta : `rgba(34,197,94,${0.25 + i * 0.06})`,
                  borderRadius: "4px 4px 0 0",
                  transition: "height .3s",
                }} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center" }}>Desempenho dos últimos 7 dias</div>
        </div>
      </div>
    </div>
  </div>
);

const PageLanding = ({ onNavigate }) => {
  const [btnHovered, setBtnHovered] = useState(null);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: C.white, color: C.body, minHeight: "100vh" }}>
      <Header onNavigate={onNavigate} />

      <section style={{
        paddingTop: 120,
        paddingBottom: 80,
        background: `linear-gradient(160deg, ${C.greenLight} 0%, ${C.white} 55%)`,
        minHeight: "85vh",
        display: "flex",
        alignItems: "center",
      }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 40px", display: "flex", alignItems: "center", gap: 60, width: "100%" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#dcfce7",
              border: "1px solid #bbf7d0",
              borderRadius: 999,
              padding: "6px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: C.green,
              marginBottom: 28,
            }}>
              🚀 Plataforma completa para times modernos
            </div>

            <h1 style={{
              fontSize: "clamp(42px, 5.5vw, 68px)",
              fontWeight: 900,
              lineHeight: 1.05,
              color: C.greenDark,
              letterSpacing: "-1.5px",
              marginBottom: 24,
              margin: "0 0 24px 0",
            }}>
              Gerencie.<br />Automatize.<br />
              <span style={{ color: C.greenCta }}>Escale.</span>
            </h1>

            <p style={{
              fontSize: 18,
              lineHeight: 1.7,
              color: C.body,
              maxWidth: 460,
              marginBottom: 36,
            }}>
              CRM inteligente, WhatsApp automatizado e pipeline visual para times de alta performance.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              <button
                onMouseEnter={() => setBtnHovered("start")}
                onMouseLeave={() => setBtnHovered(null)}
                onClick={() => onNavigate("login")}
                style={{
                  background: btnHovered === "start" ? C.green : C.greenCta,
                  color: C.white,
                  border: "none",
                  borderRadius: 10,
                  padding: "14px 28px",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: "pointer",
                  transition: "background .15s",
                  boxShadow: "0 4px 14px rgba(34,197,94,.35)",
                }}
              >
                Começar agora →
              </button>
              <button
                onMouseEnter={() => setBtnHovered("how")}
                onMouseLeave={() => setBtnHovered(null)}
                onClick={() => onNavigate("docs")}
                style={{
                  background: "transparent",
                  color: C.green,
                  border: `2px solid ${C.green}`,
                  borderRadius: 10,
                  padding: "14px 28px",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: "pointer",
                  transition: "background .15s, color .15s",
                  ...(btnHovered === "how" ? { background: C.greenLight } : {}),
                }}
              >
                Ver como funciona
              </button>
            </div>

            <div style={{ fontSize: 13, color: "#6b7280", display: "flex", gap: 20, flexWrap: "wrap" }}>
              <span>✓ Sem cartão de crédito</span>
              <span>✓ Setup em minutos</span>
              <span>✓ Suporte em português</span>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minWidth: 0 }}>
            <MockDashboard />
          </div>
        </div>
      </section>

      <section style={{ background: C.greenLight, padding: "64px 40px" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            {[
              {
                icon: "⚡",
                title: "Rápido",
                desc: "Setup em minutos, integração com WhatsApp Business sem complicação.",
              },
              {
                icon: "🤖",
                title: "Automatizado",
                desc: "Chatbots, follow-ups e disparos que trabalham enquanto você dorme.",
              },
              {
                icon: "📊",
                title: "Inteligente",
                desc: "Pipeline visual, relatórios e metas para decisões baseadas em dados.",
              },
            ].map((f) => (
              <div key={f.title} style={{
                flex: "1 1 260px",
                background: C.white,
                borderRadius: 14,
                padding: "28px 28px",
                border: `1px solid ${C.border}`,
                boxShadow: "0 2px 10px rgba(0,0,0,.04)",
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: C.greenDark, marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 15, color: C.body, lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{
        background: C.greenDark,
        padding: "80px 40px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: C.white, marginBottom: 16, letterSpacing: "-0.5px" }}>
            Pronto para transformar seu time comercial?
          </h2>
          <p style={{ fontSize: 17, color: "#d1fae5", marginBottom: 36, lineHeight: 1.7 }}>
            Junte-se a centenas de empresas que já usam o C4 OS.
          </p>
          <button
            onMouseEnter={() => setBtnHovered("cta-footer")}
            onMouseLeave={() => setBtnHovered(null)}
            onClick={() => onNavigate("login")}
            style={{
              background: btnHovered === "cta-footer" ? C.greenCta : C.white,
              color: btnHovered === "cta-footer" ? C.white : C.greenDark,
              border: "none",
              borderRadius: 10,
              padding: "16px 36px",
              fontWeight: 700,
              fontSize: 17,
              cursor: "pointer",
              transition: "background .15s, color .15s",
              boxShadow: "0 4px 20px rgba(0,0,0,.2)",
            }}
          >
            Acessar Plataforma →
          </button>
        </div>
      </section>

      <footer style={{
        background: C.white,
        borderTop: `1px solid ${C.border}`,
        padding: "28px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.greenDark }}>C4 OS by C4HUB</div>
          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>© 2025 C4HUB. Todos os direitos reservados.</div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {[["Blog", "blog"], ["Documentação", "docs"]].map(([label, target]) => (
            <button
              key={target}
              onClick={() => onNavigate(target)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: C.body,
                fontSize: 14,
                fontWeight: 500,
                padding: 0,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
};

export default PageLanding;
