import { useState, useEffect } from "react";

function useW() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 768 };
}

const C = {
  green:      "#1aaa96",
  greenCta:   "#1aaa96",
  greenLight: "#e6f7f5",
  greenDark:  "#111827",
  body:       "#374151",
  border:     "#e5e7eb",
  white:      "#ffffff",
};

const CATEGORY_COLORS = {
  Novidade: { bg: "#eff6ff", color: "#1d4ed8" },
  Tutorial: { bg: "#dcfce7", color: "#15803d" },
  Estratégia: { bg: "#fff7ed", color: "#c2410c" },
  Produto: { bg: "#faf5ff", color: "#7e22ce" },
};

const POSTS = [
  {
    cat: "Estratégia",
    title: "Como automatizar o follow-up e nunca perder uma venda",
    excerpt: "Descubra como configurar sequências de follow-up automáticas que mantêm seus leads aquecidos sem esforço manual.",
    date: "10 jan 2025",
    read: "5 min de leitura",
  },
  {
    cat: "Novidade",
    title: "C4OS lança Chatbot Builder visual com fluxos ilimitados",
    excerpt: "O novo construtor visual de chatbots permite criar fluxos de atendimento complexos com arrastar e soltar, sem código.",
    date: "22 jan 2025",
    read: "3 min de leitura",
  },
  {
    cat: "Tutorial",
    title: "Pipeline Kanban: como organizar seu funil de vendas",
    excerpt: "Aprenda a configurar etapas personalizadas, mover deals e usar os filtros avançados do pipeline para nunca perder oportunidades.",
    date: "5 fev 2025",
    read: "7 min de leitura",
  },
  {
    cat: "Tutorial",
    title: "WhatsApp Business API: guia completo de integração",
    excerpt: "Passo a passo para conectar sua conta oficial do WhatsApp Business ao C4OS e começar a automatizar atendimentos.",
    date: "18 fev 2025",
    read: "9 min de leitura",
  },
  {
    cat: "Estratégia",
    title: "Metas e relatórios: como medir o que importa",
    excerpt: "Saiba quais métricas acompanhar no seu time comercial e como os relatórios do C4OS ajudam a tomar decisões mais rápidas.",
    date: "3 mar 2025",
    read: "6 min de leitura",
  },
  {
    cat: "Novidade",
    title: "Novo módulo de Disparos em massa com personalização",
    excerpt: "O módulo de Disparos ganhou personalização por variáveis, agendamento por fuso horário e relatório de entrega em tempo real.",
    date: "20 mar 2025",
    read: "4 min de leitura",
  },
];

const SharedHeader = ({ onNavigate }) => {
  const [hovered, setHovered] = useState(null);
  const { isMobile } = useW();

  return (
    <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: C.white, borderBottom: `1px solid ${C.border}`, boxShadow: "0 1px 8px rgba(0,0,0,.06)", height: 64, display: "flex", alignItems: "center", padding: isMobile ? "0 16px" : "0 40px", justifyContent: "space-between" }}>
      <button onClick={() => onNavigate("landing")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <img src="/logo.png" alt="C4 OS" width={36} height={36} style={{ objectFit: "contain", display: "block" }} />
        <div style={{ textAlign: "left", lineHeight: 1.2 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.greenDark, letterSpacing: "-0.3px" }}>C4 OS</div>
          <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 500, letterSpacing: "1px", textTransform: "uppercase" }}>by C4HUB</div>
        </div>
      </button>
      <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {!isMobile && [["Blog", "blog"], ["Documentação", "docs"]].map(([label, target]) => (
          <button key={target} onMouseEnter={() => setHovered(target)} onMouseLeave={() => setHovered(null)} onClick={() => onNavigate(target)}
            style={{ background: "none", border: "none", cursor: "pointer", color: hovered === target ? C.green : C.body, fontWeight: 500, fontSize: 15, padding: "6px 12px", borderRadius: 6, transition: "color .15s" }}>
            {label}
          </button>
        ))}
        <button onMouseEnter={() => setHovered("cta")} onMouseLeave={() => setHovered(null)} onClick={() => onNavigate("login")}
          style={{ marginLeft: isMobile ? 0 : 8, background: hovered === "cta" ? C.green : C.greenCta, color: C.white, border: "none", borderRadius: 999, padding: isMobile ? "8px 14px" : "9px 22px", fontWeight: 700, fontSize: isMobile ? 13 : 14, cursor: "pointer", transition: "background .15s", whiteSpace: "nowrap" }}>
          {isMobile ? "Acessar →" : "Acessar Plataforma →"}
        </button>
      </nav>
    </header>
  );
};

const PostCard = ({ post }) => {
  const [hovered, setHovered] = useState(false);
  const cc = CATEGORY_COLORS[post.cat] ?? { bg: "#f3f4f6", color: "#374151" };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,.09)" : "0 2px 6px rgba(0,0,0,.04)",
        transition: "box-shadow .2s, transform .2s",
        transform: hovered ? "translateY(-3px)" : "none",
        cursor: "default",
      }}
    >
      <span style={{
        display: "inline-block",
        background: cc.bg,
        color: cc.color,
        fontSize: 12,
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: 999,
        alignSelf: "flex-start",
        letterSpacing: "0.2px",
      }}>
        {post.cat}
      </span>
      <div style={{ fontWeight: 700, fontSize: 17, color: "#111827", lineHeight: 1.35 }}>{post.title}</div>
      <div style={{ fontSize: 14, color: C.body, lineHeight: 1.65, flex: 1 }}>{post.excerpt}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 13, color: "#9ca3af" }}>{post.date} · {post.read}</span>
        <span style={{ fontSize: 14, color: C.green, fontWeight: 600, cursor: "pointer" }}>Ler mais →</span>
      </div>
    </div>
  );
};

const PageBlog = ({ onNavigate }) => {
  const { isMobile } = useW();
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#f9fafb", color: C.body, minHeight: "100vh" }}>
      <SharedHeader onNavigate={onNavigate} />

      <section style={{ paddingTop: 104, paddingBottom: 48, background: `linear-gradient(160deg, ${C.greenLight} 0%, ${C.white} 60%)`, textAlign: "center" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: isMobile ? "24px 20px 0" : "40px 24px 0" }}>
          <h1 style={{ fontSize: isMobile ? 32 : 44, fontWeight: 900, color: C.greenDark, letterSpacing: "-1px", marginBottom: 12 }}>Blog C4OS</h1>
          <p style={{ fontSize: isMobile ? 15 : 18, color: C.body, lineHeight: 1.7 }}>
            Novidades, dicas e estratégias para times comerciais.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "32px 16px 60px" : "48px 32px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: isMobile ? 16 : 24 }}>
          {POSTS.map((p) => <PostCard key={p.title} post={p} />)}
        </div>
      </section>

      <footer style={{ background: C.white, borderTop: `1px solid ${C.border}`, padding: isMobile ? "24px 20px" : "28px 40px", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.greenDark }}>C4 OS by C4HUB</div>
          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>© 2025 C4HUB. Todos os direitos reservados.</div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {[["Blog", "blog"], ["Documentação", "docs"]].map(([label, target]) => (
            <button key={target} onClick={() => onNavigate(target)} style={{ background: "none", border: "none", cursor: "pointer", color: C.body, fontSize: 14, fontWeight: 500, padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}>
              {label}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
};

export default PageBlog;
