import { useState, useEffect, useCallback } from "react";

const C = {
  dark:       "#111827",
  darkSoft:   "#1f2937",
  teal:       "#1aaa96",
  tealDk:     "#0d8a78",
  tealLight:  "#e6f7f5",
  tealA:      "rgba(26,170,150,0.15)",
  tealA2:     "rgba(26,170,150,0.30)",
  green:      "#16a34a",
  greenLight: "#f0fdf4",
  blue:       "#2563eb",
  blueBg:     "#eff6ff",
  amber:      "#ca8a04",
  amberBg:    "#fefce8",
  white:      "#ffffff",
  surface:    "#f9fafb",
  border:     "#e5e7eb",
  text:       "#374151",
  muted:      "#6b7280",
  faint:      "#9ca3af",
};

/* ─── Mock screens ───────────────────────────────────────────────── */

const MockDashboard = () => (
  <div style={{ display: "flex", height: "100%" }}>
    <div style={{ width: 48, background: C.dark, display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 0", gap: 10, flexShrink: 0 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: C.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff", marginBottom: 6 }}>C4</div>
      {[true, false, false, false, false, false].map((a, i) => (
        <div key={i} style={{ width: 30, height: 30, borderRadius: 8, background: a ? C.tealA : "rgba(255,255,255,0.05)", border: a ? `1px solid ${C.tealA2}` : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 9, height: 9, borderRadius: 2, background: a ? C.teal : "rgba(255,255,255,0.25)" }} />
        </div>
      ))}
    </div>
    <div style={{ flex: 1, background: C.surface, padding: 14, overflow: "hidden" }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: C.dark, marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>Dashboard</div>
      <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
        {[
          { l: "Leads hoje", v: "47", d: "+12%", dc: C.teal, bg: C.tealLight },
          { l: "Deals ativos", v: "23", d: null,  dc: C.blue, bg: C.blueBg },
          { l: "Mensagens",   v: "1.2k", d: "+8%", dc: C.amber, bg: C.amberBg },
        ].map((m, i) => (
          <div key={i} style={{ flex: 1, background: C.white, borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>{m.l}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.dark, lineHeight: 1 }}>{m.v}</div>
            {m.d && <div style={{ fontSize: 9, color: m.dc, fontWeight: 700, marginTop: 2 }}>{m.d}</div>}
          </div>
        ))}
      </div>
      <div style={{ background: C.white, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: C.dark, marginBottom: 8 }}>Desempenho — últimos 7 dias</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 64 }}>
          {[38, 55, 42, 70, 58, 85, 72].map((h, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
              <div style={{ height: `${h}%`, background: i === 5 ? C.teal : `rgba(26,170,150,${0.18 + i * 0.09})`, borderRadius: "3px 3px 0 0" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 4 }}>
          {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d => (
            <div key={d} style={{ flex: 1, fontSize: 8, color: C.faint, textAlign: "center" }}>{d}</div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const MockChat = () => (
  <div style={{ display: "flex", height: "100%" }}>
    <div style={{ width: 130, background: C.white, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "10px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.dark }}>Atendimento</div>
        <div style={{ fontSize: 8, color: C.teal, marginTop: 1 }}>● 3 conversas ativas</div>
      </div>
      {[
        { name: "Maria Silva",   preview: "Gostaria de saber...", time: "09:42", unread: 2, color: C.teal },
        { name: "João Santos",   preview: "Obrigado pela aten...", time: "09:15", unread: 0, color: C.blue },
        { name: "Ana Costa",     preview: "Pode me enviar o...", time: "08:58", unread: 0, color: C.amber },
      ].map((c, i) => (
        <div key={i} style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}`, background: i === 0 ? C.tealLight : "transparent", display: "flex", gap: 7, alignItems: "flex-start" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{c.name[0]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>{c.name.split(" ")[0]}</div>
              <div style={{ fontSize: 8, color: C.faint }}>{c.time}</div>
            </div>
            <div style={{ fontSize: 9, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.preview}</div>
          </div>
          {c.unread > 0 && <div style={{ width: 14, height: 14, borderRadius: "50%", background: C.teal, fontSize: 8, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>{c.unread}</div>}
        </div>
      ))}
    </div>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#efeae2" }}>
      <div style={{ padding: "8px 12px", background: C.dark, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>M</div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>Maria Silva</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.55)" }}>● online agora</div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ alignSelf: "flex-start", background: "#fff", borderRadius: "0 10px 10px 10px", padding: "6px 10px", maxWidth: "75%", fontSize: 10, color: C.dark, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}>
          Olá! Gostaria de saber sobre os planos disponíveis 😊
        </div>
        <div style={{ alignSelf: "flex-end", background: "#d9fdd3", borderRadius: "10px 0 10px 10px", padding: "6px 10px", maxWidth: "75%", fontSize: 10, color: C.dark, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}>
          Olá Maria! Temos 3 opções. Qual o tamanho do seu time?
        </div>
        <div style={{ alignSelf: "flex-start", background: "#fff", borderRadius: "0 10px 10px 10px", padding: "6px 10px", maxWidth: "75%", fontSize: 10, color: C.dark, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}>
          Somos 8 pessoas no comercial
        </div>
      </div>
      <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 20, padding: "7px 14px" }}>
        <div style={{ fontSize: 9, color: C.faint }}>Digite uma mensagem...</div>
      </div>
    </div>
  </div>
);

const MockPipeline = () => (
  <div style={{ height: "100%", padding: 12, background: C.surface, overflow: "hidden" }}>
    <div style={{ fontWeight: 700, fontSize: 13, color: C.dark, marginBottom: 10, fontFamily: "'Outfit',sans-serif" }}>Pipeline de Vendas</div>
    <div style={{ display: "flex", gap: 8, height: "calc(100% - 34px)" }}>
      {[
        { stage: "Prospecção", c: C.blue, bg: C.blueBg, deals: [
          { name: "Tech Solutions Ltda", val: "R$ 4.800" },
          { name: "Grupo Comercial XP",  val: "R$ 12.000" },
        ]},
        { stage: "Proposta", c: C.teal, bg: C.tealLight, deals: [
          { name: "Mercado Central Sul", val: "R$ 7.200" },
        ]},
        { stage: "Fechamento", c: C.green, bg: C.greenLight, deals: [
          { name: "Distribuidora Norte", val: "R$ 18.500" },
        ]},
      ].map((col) => (
        <div key={col.stage} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: col.c, background: col.bg, borderRadius: 6, padding: "4px 8px", textAlign: "center", border: `1px solid ${col.c}30` }}>
            {col.stage} · {col.deals.length}
          </div>
          {col.deals.map((d, di) => (
            <div key={di} style={{ background: C.white, borderRadius: 8, padding: "9px 10px", border: `1px solid ${C.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.dark, marginBottom: 5, lineHeight: 1.3 }}>{d.name}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: col.c }}>{d.val}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                {[C.teal, C.blue].map((cc, i) => <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: cc, opacity: 0.7 }} />)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const MockChatbot = () => (
  <div style={{ height: "100%", background: "#0d1117", padding: 14, overflow: "hidden" }}>
    <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 14, fontFamily: "'Outfit',sans-serif" }}>Chatbot Builder</div>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      <div style={{ background: C.teal, borderRadius: 8, padding: "6px 18px", fontSize: 10, fontWeight: 700, color: "#fff" }}>▶ Início</div>
      <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.2)" }} />
      <div style={{ background: "#161b22", border: `1px solid ${C.tealA2}`, borderRadius: 10, padding: "8px 14px", width: "85%", marginBottom: 0 }}>
        <div style={{ fontSize: 9, color: C.teal, fontWeight: 700, marginBottom: 4 }}>💬 Mensagem de boas-vindas</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
          Olá! Sou o assistente virtual.<br />
          Como posso ajudar hoje?<br />
          1️⃣ Informações  2️⃣ Suporte  3️⃣ Preços
        </div>
      </div>
      <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.2)" }} />
      <div style={{ display: "flex", gap: 8, width: "85%" }}>
        <div style={{ flex: 1, background: "#161b22", border: `1px solid rgba(37,99,235,0.35)`, borderRadius: 10, padding: "8px 10px" }}>
          <div style={{ fontSize: 8, color: "#60a5fa", fontWeight: 700, marginBottom: 3 }}>📋 Opção 1</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.65)" }}>Enviar catálogo de produtos</div>
        </div>
        <div style={{ flex: 1, background: "#161b22", border: `1px solid rgba(22,163,74,0.35)`, borderRadius: 10, padding: "8px 10px" }}>
          <div style={{ fontSize: 8, color: "#4ade80", fontWeight: 700, marginBottom: 3 }}>🎧 Opção 2</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.65)" }}>Abrir chamado no suporte</div>
        </div>
      </div>
      <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.15)" }} />
      <div style={{ background: "#161b22", border: `1px solid rgba(202,138,4,0.35)`, borderRadius: 10, padding: "6px 14px", width: "85%" }}>
        <div style={{ fontSize: 8, color: "#fbbf24", fontWeight: 700, marginBottom: 2 }}>👤 Transferir para humano</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)" }}>Se não satisfeito → Atendente</div>
      </div>
    </div>
  </div>
);

const MockLeads = () => (
  <div style={{ height: "100%", background: C.white, padding: 12, overflow: "hidden" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: C.dark, fontFamily: "'Outfit',sans-serif" }}>Leads</div>
      <div style={{ background: C.teal, color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 9, fontWeight: 700 }}>+ Novo Lead</div>
    </div>
    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
      {[
        { l: "Total", v: "284", c: C.teal },
        { l: "Novos hoje", v: "12", c: C.blue },
        { l: "Qualificados", v: "67", c: C.green },
      ].map((s, i) => (
        <div key={i} style={{ flex: 1, background: C.surface, borderRadius: 8, padding: "6px 8px", border: `1px solid ${C.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: s.c }}>{s.v}</div>
          <div style={{ fontSize: 8, color: C.muted }}>{s.l}</div>
        </div>
      ))}
    </div>
    <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", background: C.surface, padding: "5px 10px", borderBottom: `1px solid ${C.border}` }}>
        {["Nome", "Status", "Origem", "Criado"].map(h => (
          <div key={h} style={{ flex: 1, fontSize: 8, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>{h}</div>
        ))}
      </div>
      {[
        { n: "Carlos Menezes", s: "Qualificado", sc: C.teal,  o: "WhatsApp", d: "hoje" },
        { n: "Patrícia Rocha", s: "Novo",        sc: C.blue,  o: "Site",     d: "hoje" },
        { n: "Roberto Lima",   s: "Negociando",  sc: C.amber, o: "Indicação", d: "ontem" },
      ].map((r, i) => (
        <div key={i} style={{ display: "flex", padding: "7px 10px", borderBottom: i < 2 ? `1px solid ${C.border}` : "none", alignItems: "center", background: i % 2 === 0 ? C.white : C.surface }}>
          <div style={{ flex: 1, fontSize: 9, fontWeight: 600, color: C.dark }}>{r.n}</div>
          <div style={{ flex: 1 }}><span style={{ fontSize: 8, fontWeight: 600, color: r.sc, background: `${r.sc}18`, borderRadius: 4, padding: "2px 6px" }}>{r.s}</span></div>
          <div style={{ flex: 1, fontSize: 9, color: C.muted }}>{r.o}</div>
          <div style={{ flex: 1, fontSize: 9, color: C.faint }}>{r.d}</div>
        </div>
      ))}
    </div>
  </div>
);

const SLIDES = [
  { id: "dashboard", label: "Dashboard",   icon: "▦", component: <MockDashboard /> },
  { id: "chat",      label: "WhatsApp",    icon: "◈", component: <MockChat /> },
  { id: "pipeline",  label: "Pipeline",    icon: "⬡", component: <MockPipeline /> },
  { id: "chatbot",   label: "Chatbot",     icon: "🤖", component: <MockChatbot /> },
  { id: "leads",     label: "Leads",       icon: "◎", component: <MockLeads /> },
];

const BrowserFrame = ({ slide, onPrev, onNext, onDot, activeIdx }) => (
  <div style={{ background: C.white, borderRadius: 16, boxShadow: "0 28px 80px rgba(0,0,0,0.22), 0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden", border: `1px solid ${C.border}`, width: "100%" }}>
    {/* Browser chrome */}
    <div style={{ background: "#f3f4f6", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.border}` }}>
      <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
      <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
      <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
      <div style={{ flex: 1, background: C.white, borderRadius: 6, padding: "4px 12px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.teal }} />
        <span style={{ fontSize: 11, color: C.muted }}>app.c4os.com.br</span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={onPrev} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, lineHeight: 1, padding: "2px 4px" }}>‹</button>
        <button onClick={onNext} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, lineHeight: 1, padding: "2px 4px" }}>›</button>
      </div>
    </div>
    {/* Tab bar */}
    <div style={{ background: "#f9fafb", borderBottom: `1px solid ${C.border}`, display: "flex", padding: "0 8px", gap: 2, overflowX: "auto" }}>
      {SLIDES.map((s, i) => (
        <button key={s.id} onClick={() => onDot(i)} style={{ background: i === activeIdx ? C.white : "none", border: "none", borderBottom: i === activeIdx ? `2px solid ${C.teal}` : "2px solid transparent", cursor: "pointer", padding: "7px 12px", fontSize: 10, fontWeight: i === activeIdx ? 700 : 500, color: i === activeIdx ? C.teal : C.muted, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", transition: "all .15s" }}>
          <span>{s.icon}</span>{s.label}
        </button>
      ))}
    </div>
    {/* Screen content */}
    <div style={{ height: 320, overflow: "hidden" }}>
      {slide.component}
    </div>
    {/* Dot indicators */}
    <div style={{ padding: "8px 0", display: "flex", justifyContent: "center", gap: 6, background: C.surface, borderTop: `1px solid ${C.border}` }}>
      {SLIDES.map((_, i) => (
        <button key={i} onClick={() => onDot(i)} style={{ width: i === activeIdx ? 20 : 7, height: 7, borderRadius: 4, background: i === activeIdx ? C.teal : C.border, border: "none", cursor: "pointer", padding: 0, transition: "all .3s" }} />
      ))}
    </div>
  </div>
);

/* ─── Header ─────────────────────────────────────────────────────── */

const Header = ({ onNavigate }) => {
  const [hov, setHov] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 64, display: "flex", alignItems: "center", padding: "0 40px", justifyContent: "space-between", background: scrolled ? "rgba(255,255,255,0.96)" : C.white, backdropFilter: "blur(10px)", borderBottom: `1px solid ${scrolled ? C.border : "transparent"}`, boxShadow: scrolled ? "0 2px 16px rgba(0,0,0,0.07)" : "none", transition: "all .2s" }}>
      <button onClick={() => onNavigate("landing")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: 0 }}>
        <img src="/logo.png" alt="C4 OS" width={36} height={36} style={{ objectFit: "contain", display: "block" }} />
        <div style={{ textAlign: "left" }}>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 17, color: C.dark, lineHeight: 1, letterSpacing: "-0.3px" }}>C4 <span style={{ color: C.teal }}>OS</span></div>
          <div style={{ fontSize: 9, color: C.faint, fontWeight: 500, letterSpacing: "1.5px", textTransform: "uppercase" }}>by C4HUB</div>
        </div>
      </button>

      <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {[["Blog", "blog"], ["Documentação", "docs"]].map(([l, t]) => (
          <button key={t} onClick={() => onNavigate(t)} onMouseEnter={() => setHov(t)} onMouseLeave={() => setHov(null)}
            style={{ background: hov === t ? C.surface : "none", border: "none", cursor: "pointer", color: hov === t ? C.dark : C.text, fontWeight: 500, fontSize: 14, padding: "7px 14px", borderRadius: 8, transition: "all .15s" }}>
            {l}
          </button>
        ))}
        <button onClick={() => onNavigate("login")} onMouseEnter={() => setHov("cta")} onMouseLeave={() => setHov(null)}
          style={{ marginLeft: 8, background: hov === "cta" ? C.tealDk : C.teal, color: "#fff", border: "none", borderRadius: 10, padding: "9px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "background .15s", boxShadow: `0 4px 14px ${C.tealA2}`, letterSpacing: "0.1px" }}>
          Acessar Plataforma →
        </button>
      </nav>
    </header>
  );
};

/* ─── Main page ──────────────────────────────────────────────────── */

export default function PageLanding({ onNavigate }) {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hov, setHov] = useState(null);

  const prev = useCallback(() => setSlide(s => (s - 1 + SLIDES.length) % SLIDES.length), []);
  const next = useCallback(() => setSlide(s => (s + 1) % SLIDES.length), []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(next, 3500);
    return () => clearInterval(t);
  }, [paused, next]);

  const Btn = ({ id, children, onClick, variant = "solid" }) => {
    const isHov = hov === id;
    const base = { border: "none", borderRadius: 10, padding: "13px 26px", fontWeight: 700, fontSize: 15, cursor: "pointer", transition: "all .18s", fontFamily: "'Outfit',sans-serif" };
    const solid = { background: isHov ? C.tealDk : C.teal, color: "#fff", boxShadow: `0 4px 18px ${C.tealA2}`, ...base };
    const outline = { background: isHov ? C.tealLight : "transparent", color: C.teal, border: `2px solid ${C.teal}`, ...base };
    return (
      <button style={variant === "solid" ? solid : outline} onClick={onClick} onMouseEnter={() => setHov(id)} onMouseLeave={() => setHov(null)}>
        {children}
      </button>
    );
  };

  const FEATURES = [
    { ico: "◈", label: "WhatsApp Business", desc: "Conecte seu WhatsApp Business API e centralize todos os atendimentos em um só lugar, com histórico completo e múltiplos atendentes.", color: C.teal },
    { ico: "⬡", label: "Pipeline Kanban",   desc: "Visualize seu funil de vendas em tempo real. Arraste deals entre etapas, atribua valores e acompanhe cada oportunidade até o fechamento.", color: C.blue },
    { ico: "🤖", label: "Chatbot com IA",    desc: "Crie fluxos de atendimento inteligentes sem código. Respostas automáticas 24/7 com transferência para humano quando necessário.", color: C.teal },
    { ico: "◷", label: "Follow-up Inteligente", desc: "Agende lembretes e mensagens automáticas para não perder nenhuma oportunidade. O sistema avisa quando é hora de retomar o contato.", color: C.green },
    { ico: "◎", label: "Gestão de Leads",   desc: "Capture, qualifique e organize seus leads. Rastreie a origem de cada contato e meça a conversão por canal de aquisição.", color: C.amber },
    { ico: "◫", label: "Relatórios e Metas", desc: "Dashboards completos com métricas de desempenho, atendimentos, conversões e metas por período para tomada de decisão rápida.", color: C.blue },
  ];

  const STATS = [
    { v: "500+",  l: "Empresas atendidas" },
    { v: "2M+",   l: "Mensagens por mês" },
    { v: "99.9%", l: "Uptime garantido" },
    { v: "24h",   l: "Suporte em português" },
  ];

  const STEPS = [
    { n: "01", title: "Conecte seu WhatsApp", desc: "Vincule seu número de WhatsApp Business à plataforma em menos de 5 minutos, sem precisar trocar de número." },
    { n: "02", title: "Configure sua equipe",  desc: "Adicione atendentes, crie departamentos, defina regras de roteamento e personalize o chatbot com seus fluxos." },
    { n: "03", title: "Venda e acompanhe",     desc: "Gerencie leads, deals no pipeline e follow-ups automáticos. Relatórios em tempo real para nunca perder uma oportunidade." },
  ];

  return (
    <div style={{ fontFamily: "'Outfit', 'Inter', system-ui, sans-serif", background: C.white, color: C.text, minHeight: "100vh" }}>
      <Header onNavigate={onNavigate} />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section style={{ paddingTop: 100, paddingBottom: 72, background: `linear-gradient(150deg, #f0faf9 0%, ${C.white} 50%)`, minHeight: "88vh", display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 40px", display: "flex", alignItems: "center", gap: 64, width: "100%" }}>
          <div style={{ flex: "0 0 46%", minWidth: 0 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: C.tealLight, border: `1px solid ${C.tealA2}`, borderRadius: 999, padding: "6px 16px", fontSize: 13, fontWeight: 600, color: C.tealDk, marginBottom: 28 }}>
              🚀 Plataforma CRM + WhatsApp tudo-em-um
            </div>
            <h1 style={{ fontSize: "clamp(38px,4.8vw,64px)", fontWeight: 900, lineHeight: 1.06, color: C.dark, letterSpacing: "-1.5px", margin: "0 0 24px" }}>
              Gerencie.<br />Automatize.<br />
              <span style={{ color: C.teal }}>Escale.</span>
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.75, color: C.text, maxWidth: 440, marginBottom: 36 }}>
              CRM inteligente, WhatsApp automatizado e pipeline visual para times comerciais de alta performance.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
              <Btn id="hero-start" onClick={() => onNavigate("login")}>Começar agora →</Btn>
              <Btn id="hero-docs" onClick={() => onNavigate("docs")} variant="outline">Ver como funciona</Btn>
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13, color: C.muted }}>
              <span>✓ Sem cartão de crédito</span>
              <span>✓ Setup em minutos</span>
              <span>✓ Suporte em português</span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}>
            <BrowserFrame slide={SLIDES[slide]} onPrev={prev} onNext={next} onDot={setSlide} activeIdx={slide} />
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────── */}
      <section style={{ background: C.dark, padding: "36px 40px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", gap: 0, flexWrap: "wrap" }}>
          {STATS.map((s, i) => (
            <div key={i} style={{ flex: "1 1 160px", textAlign: "center", padding: "12px 24px", borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: C.teal, fontFamily: "'Outfit',sans-serif", letterSpacing: "-1px" }}>{s.v}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ─────────────────────────────────────── */}
      <section style={{ padding: "96px 40px", background: C.white }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ display: "inline-block", background: C.tealLight, color: C.teal, borderRadius: 999, padding: "5px 16px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Módulos do sistema</div>
            <h2 style={{ fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 800, color: C.dark, letterSpacing: "-0.8px", margin: "0 0 16px" }}>
              Tudo que seu time precisa<br />em um só lugar
            </h2>
            <p style={{ fontSize: 16, color: C.muted, maxWidth: 500, margin: "0 auto", lineHeight: 1.7 }}>
              Do primeiro contato ao fechamento da venda, o C4 OS cobre cada etapa do seu processo comercial.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {FEATURES.map((f) => (
              <div key={f.label} style={{ background: C.surface, borderRadius: 16, padding: "28px 28px", border: `1px solid ${C.border}`, transition: "all .2s", cursor: "default" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = f.color; e.currentTarget.style.boxShadow = `0 8px 32px ${f.color}18`; e.currentTarget.style.background = C.white; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = C.surface; }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${f.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 16 }}>{f.ico}</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.dark, marginBottom: 10 }}>{f.label}</div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────── */}
      <section style={{ padding: "96px 40px", background: C.surface }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ display: "inline-block", background: C.tealLight, color: C.teal, borderRadius: 999, padding: "5px 16px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Como funciona</div>
            <h2 style={{ fontSize: "clamp(28px,3.5vw,42px)", fontWeight: 800, color: C.dark, letterSpacing: "-0.8px", margin: 0 }}>
              Comece a vender mais em 3 passos
            </h2>
          </div>
          <div style={{ display: "flex", gap: 40, position: "relative" }}>
            <div style={{ position: "absolute", top: 28, left: "16%", right: "16%", height: 1, background: `linear-gradient(90deg, ${C.teal}, ${C.teal})`, opacity: 0.2 }} />
            {STEPS.map((s) => (
              <div key={s.n} style={{ flex: 1, textAlign: "center", position: "relative" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.dark, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: `0 0 0 6px ${C.tealLight}` }}>
                  <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 900, fontSize: 14, color: C.teal }}>{s.n}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 17, color: C.dark, marginBottom: 10 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Full carousel section ─────────────────────────────── */}
      <section style={{ padding: "96px 40px", background: C.dark }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ display: "inline-block", background: C.tealA, color: C.teal, borderRadius: 999, padding: "5px 16px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Veja o sistema</div>
            <h2 style={{ fontSize: "clamp(28px,3.5vw,42px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.8px", margin: "0 0 16px" }}>
              Interface pensada para<br />times comerciais
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", maxWidth: 460, margin: "0 auto", lineHeight: 1.7 }}>
              Design limpo, rápido e intuitivo. Sua equipe aprende em minutos.
            </p>
          </div>
          <div style={{ display: "flex", gap: 16, marginBottom: 32, justifyContent: "center", flexWrap: "wrap" }}>
            {SLIDES.map((s, i) => (
              <button key={s.id} onClick={() => setSlide(i)}
                style={{ background: i === slide ? C.teal : "rgba(255,255,255,0.07)", color: i === slide ? "#fff" : "rgba(255,255,255,0.55)", border: `1px solid ${i === slide ? C.teal : "rgba(255,255,255,0.12)"}`, borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .18s", display: "flex", alignItems: "center", gap: 7 }}>
                <span>{s.icon}</span>{s.label}
              </button>
            ))}
          </div>
          <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <BrowserFrame slide={SLIDES[slide]} onPrev={prev} onNext={next} onDot={setSlide} activeIdx={slide} />
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section style={{ padding: "96px 40px", background: `linear-gradient(135deg, ${C.teal} 0%, ${C.tealDk} 100%)`, textAlign: "center" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(28px,3.8vw,46px)", fontWeight: 900, color: "#fff", letterSpacing: "-1px", margin: "0 0 16px" }}>
            Pronto para transformar<br />seu time comercial?
          </h2>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.8)", marginBottom: 40, lineHeight: 1.7 }}>
            Junte-se a centenas de empresas que já automatizaram<br />seu atendimento e vendas com o C4 OS.
          </p>
          <button onClick={() => onNavigate("login")} onMouseEnter={e => { e.currentTarget.style.background = C.dark; }} onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
            style={{ background: "#fff", color: C.dark, border: "none", borderRadius: 12, padding: "16px 40px", fontWeight: 800, fontSize: 17, cursor: "pointer", transition: "background .18s, color .18s", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", fontFamily: "'Outfit',sans-serif" }}>
            Acessar Plataforma →
          </button>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 28, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
            <span>✓ Configuração gratuita</span>
            <span>✓ Suporte dedicado</span>
            <span>✓ Dados seguros</span>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer style={{ background: C.dark, borderTop: "1px solid rgba(255,255,255,0.07)", padding: "36px 40px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <img src="/logo.png" alt="C4 OS" width={28} height={28} style={{ objectFit: "contain", display: "block" }} />
              <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 15, color: "#fff" }}>C4 OS <span style={{ color: C.faint, fontWeight: 400, fontSize: 12 }}>by C4HUB</span></span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>© 2025 C4HUB. Todos os direitos reservados.</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["Blog", "blog"], ["Documentação", "docs"], ["Acessar", "login"]].map(([l, t]) => (
              <button key={t} onClick={() => onNavigate(t)}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, cursor: "pointer", color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, padding: "7px 14px", transition: "all .15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = C.tealA; e.currentTarget.style.color = C.teal; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
