import { useState, useEffect, useCallback, useRef } from "react";

function useW() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 768, isTablet: w >= 768 && w < 1060, w };
}

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

const C = {
  dark:       "#0f172a",
  darkSoft:   "#1e293b",
  teal:       "#0f9490",
  tealDk:     "#0a7a76",
  tealLight:  "#e6f7f5",
  tealA:      "rgba(15,148,144,0.12)",
  tealA2:     "rgba(15,148,144,0.28)",
  green:      "#16a34a",
  greenLight: "#f0fdf4",
  blue:       "#2563eb",
  blueBg:     "#eff6ff",
  amber:      "#d97706",
  amberBg:    "#fffbeb",
  white:      "#ffffff",
  surface:    "#f8fafc",
  border:     "#e2e8f0",
  text:       "#334155",
  muted:      "#64748b",
  faint:      "#94a3b8",
  whatsapp:   "#25D366",
  waHov:      "#1aab52",
};

const WA_BASE = "https://wa.me/5562982054815";
function waLink(msg = "Olá! Vi o site do C4 OS e quero conhecer a plataforma.") {
  return `${WA_BASE}?text=${encodeURIComponent(msg)}`;
}

/* ─── Mock screens ─────────────────────────────────────────────────── */

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
              <div style={{ height: `${h}%`, background: i === 5 ? C.teal : `rgba(15,148,144,${0.18 + i * 0.09})`, borderRadius: "3px 3px 0 0" }} />
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
          Olá! Gostaria de saber sobre os planos 😊
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
        { stage: "Prospecção", c: C.blue,  bg: C.blueBg,    deals: [{ name: "Tech Solutions Ltda", val: "R$ 4.800" }, { name: "Grupo Comercial XP", val: "R$ 12.000" }] },
        { stage: "Proposta",   c: C.teal,  bg: C.tealLight,  deals: [{ name: "Mercado Central Sul", val: "R$ 7.200" }] },
        { stage: "Fechamento", c: C.green, bg: C.greenLight, deals: [{ name: "Distribuidora Norte", val: "R$ 18.500" }] },
      ].map((col) => (
        <div key={col.stage} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: col.c, background: col.bg, borderRadius: 6, padding: "4px 8px", textAlign: "center", border: `1px solid ${col.c}30` }}>
            {col.stage} · {col.deals.length}
          </div>
          {col.deals.map((d, di) => (
            <div key={di} style={{ background: C.white, borderRadius: 8, padding: "9px 10px", border: `1px solid ${C.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.dark, marginBottom: 5, lineHeight: 1.3 }}>{d.name}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: col.c }}>{d.val}</div>
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
      <div style={{ background: "#161b22", border: `1px solid ${C.tealA2}`, borderRadius: 10, padding: "8px 14px", width: "85%" }}>
        <div style={{ fontSize: 9, color: C.teal, fontWeight: 700, marginBottom: 4 }}>💬 Boas-vindas automáticas</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
          Olá! Sou o assistente virtual.<br />
          Como posso ajudar hoje?<br />
          1️⃣ Informações  2️⃣ Suporte  3️⃣ Preços
        </div>
      </div>
      <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.2)" }} />
      <div style={{ display: "flex", gap: 8, width: "85%" }}>
        <div style={{ flex: 1, background: "#161b22", border: "1px solid rgba(37,99,235,0.35)", borderRadius: 10, padding: "8px 10px" }}>
          <div style={{ fontSize: 8, color: "#60a5fa", fontWeight: 700, marginBottom: 3 }}>📋 Enviar catálogo</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.65)" }}>Opção 1 selecionada</div>
        </div>
        <div style={{ flex: 1, background: "#161b22", border: "1px solid rgba(22,163,74,0.35)", borderRadius: 10, padding: "8px 10px" }}>
          <div style={{ fontSize: 8, color: "#4ade80", fontWeight: 700, marginBottom: 3 }}>👤 Transferir</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.65)" }}>Para atendente humano</div>
        </div>
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
      {[{ l: "Total", v: "284", c: C.teal }, { l: "Novos hoje", v: "12", c: C.blue }, { l: "Qualificados", v: "67", c: C.green }].map((s, i) => (
        <div key={i} style={{ flex: 1, background: C.surface, borderRadius: 8, padding: "6px 8px", border: `1px solid ${C.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: s.c }}>{s.v}</div>
          <div style={{ fontSize: 8, color: C.muted }}>{s.l}</div>
        </div>
      ))}
    </div>
    <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
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
  { id: "dashboard", label: "Dashboard",  icon: "▦", component: <MockDashboard /> },
  { id: "chat",      label: "WhatsApp",   icon: "◈", component: <MockChat /> },
  { id: "pipeline",  label: "Pipeline",   icon: "⬡", component: <MockPipeline /> },
  { id: "chatbot",   label: "Chatbot",    icon: "🤖", component: <MockChatbot /> },
  { id: "leads",     label: "Leads",      icon: "◎", component: <MockLeads /> },
];

const BrowserFrame = ({ slide, onPrev, onNext, onDot, activeIdx, isMobile }) => (
  <div style={{ background: C.white, borderRadius: 16, boxShadow: "0 32px 80px rgba(0,0,0,0.22), 0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden", border: `1px solid ${C.border}`, width: "100%" }}>
    <div style={{ background: "#f1f5f9", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.border}` }}>
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
    <div style={{ background: "#f9fafb", borderBottom: `1px solid ${C.border}`, display: "flex", padding: "0 8px", gap: 2, overflowX: "auto" }}>
      {SLIDES.map((s, i) => (
        <button key={s.id} onClick={() => onDot(i)} style={{ background: i === activeIdx ? C.white : "none", border: "none", borderBottom: i === activeIdx ? `2px solid ${C.teal}` : "2px solid transparent", cursor: "pointer", padding: "7px 10px", fontSize: 10, fontWeight: i === activeIdx ? 700 : 500, color: i === activeIdx ? C.teal : C.muted, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", transition: "all .15s" }}>
          <span>{s.icon}</span>{!isMobile && s.label}
        </button>
      ))}
    </div>
    <div style={{ height: isMobile ? 260 : 320, overflow: "hidden" }}>
      {slide.component}
    </div>
    <div style={{ padding: "8px 0", display: "flex", justifyContent: "center", gap: 6, background: C.surface, borderTop: `1px solid ${C.border}` }}>
      {SLIDES.map((_, i) => (
        <button key={i} onClick={() => onDot(i)} style={{ width: i === activeIdx ? 20 : 7, height: 7, borderRadius: 4, background: i === activeIdx ? C.teal : C.border, border: "none", cursor: "pointer", padding: 0, transition: "all .3s" }} />
      ))}
    </div>
  </div>
);

/* ─── Header ──────────────────────────────────────────────────────── */

const Header = ({ onNavigate }) => {
  const [hov, setHov] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const { isMobile } = useW();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 64, display: "flex", alignItems: "center", padding: isMobile ? "0 16px" : "0 40px", justifyContent: "space-between", background: scrolled ? "rgba(255,255,255,0.97)" : C.white, backdropFilter: "blur(12px)", borderBottom: `1px solid ${scrolled ? C.border : "transparent"}`, boxShadow: scrolled ? "0 2px 16px rgba(0,0,0,0.07)" : "none", transition: "all .2s" }}>
      <button onClick={() => onNavigate("landing")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: 0 }}>
        <img src="/logo.png" alt="C4 OS" width={36} height={36} style={{ objectFit: "contain", display: "block" }} />
        <div style={{ textAlign: "left" }}>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 17, color: C.dark, lineHeight: 1, letterSpacing: "-0.3px" }}>C4 <span style={{ color: C.teal }}>OS</span></div>
          <div style={{ fontSize: 9, color: C.faint, fontWeight: 500, letterSpacing: "1.5px", textTransform: "uppercase" }}>by C4HUB</div>
        </div>
      </button>

      <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {!isMobile && [["Blog", "blog"], ["Documentação", "docs"]].map(([l, t]) => (
          <button key={t} onClick={() => onNavigate(t)} onMouseEnter={() => setHov(t)} onMouseLeave={() => setHov(null)}
            style={{ background: hov === t ? C.surface : "none", border: "none", cursor: "pointer", color: hov === t ? C.dark : C.text, fontWeight: 500, fontSize: 14, padding: "7px 14px", borderRadius: 8, transition: "all .15s" }}>
            {l}
          </button>
        ))}
        <a href={waLink("Olá! Vim pelo site do C4 OS e quero conhecer a plataforma.")} target="_blank" rel="noreferrer"
          onMouseEnter={() => setHov("cta")} onMouseLeave={() => setHov(null)}
          style={{ marginLeft: isMobile ? 0 : 8, background: hov === "cta" ? C.tealDk : C.teal, color: "#fff", textDecoration: "none", borderRadius: 10, padding: isMobile ? "8px 14px" : "9px 22px", fontWeight: 700, fontSize: isMobile ? 13 : 14, cursor: "pointer", transition: "background .15s", boxShadow: `0 4px 14px ${C.tealA2}`, letterSpacing: "0.1px", whiteSpace: "nowrap", display: "inline-block" }}>
          {isMobile ? "Falar agora →" : "Fale com Especialista →"}
        </a>
      </nav>
    </header>
  );
};

/* ─── Sticky WhatsApp Button ──────────────────────────────────────── */
const StickyWA = () => {
  const [hov, setHov] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <a href={waLink("Olá! Vim pelo site do C4 OS e quero conhecer a plataforma. Pode me ajudar?")} target="_blank" rel="noreferrer"
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        position: "fixed", bottom: 28, right: 28, zIndex: 999,
        background: hov ? C.waHov : C.whatsapp,
        borderRadius: hov ? 16 : "50%",
        width: hov ? "auto" : 60, height: 60,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 6px 28px rgba(37,211,102,0.45)",
        textDecoration: "none", color: "#fff",
        transition: "all .25s cubic-bezier(.34,1.56,.64,1)",
        opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none",
        padding: hov ? "0 20px" : 0, gap: hov ? 10 : 0,
        overflow: "hidden", whiteSpace: "nowrap",
      }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      {hov && <span style={{ fontSize: 14, fontWeight: 700 }}>Falar agora</span>}
    </a>
  );
};

/* ─── FadeIn wrapper ──────────────────────────────────────────────── */
const FadeIn = ({ children, delay = 0, style = {} }) => {
  const [ref, inView] = useInView();
  return (
    <div ref={ref} style={{ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(24px)", transition: `opacity .6s ease ${delay}s, transform .6s ease ${delay}s`, ...style }}>
      {children}
    </div>
  );
};

/* ─── Main page ───────────────────────────────────────────────────── */

export default function PageLanding({ onNavigate }) {
  const { isMobile, isTablet } = useW();
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovBtn, setHovBtn] = useState(null);
  const [faqOpen, setFaqOpen] = useState(null);
  const [countDone, setCountDone] = useState(false);
  const [counts, setCounts] = useState({ a: 0, b: 0, c: 0, d: 0 });
  const statsRef = useRef(null);

  const prev = useCallback(() => setSlide(s => (s - 1 + SLIDES.length) % SLIDES.length), []);
  const next = useCallback(() => setSlide(s => (s + 1) % SLIDES.length), []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(next, 3500);
    return () => clearInterval(t);
  }, [paused, next]);

  // Animated counter
  useEffect(() => {
    if (countDone) return;
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      setCountDone(true);
      const targets = { a: 500, b: 2000000, c: 99.9, d: 24 };
      const steps = 60;
      let step = 0;
      const t = setInterval(() => {
        step++;
        const p = step / steps;
        const ease = 1 - Math.pow(1 - p, 3);
        setCounts({ a: Math.round(targets.a * ease), b: Math.round(targets.b * ease), c: Math.round(targets.c * ease * 10) / 10, d: Math.round(targets.d * ease) });
        if (step >= steps) clearInterval(t);
      }, 25);
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [countDone]);

  const SolidBtn = ({ id, href, onClick, children, size = "md" }) => {
    const isHov = hovBtn === id;
    const pad = size === "lg" ? "15px 34px" : "12px 26px";
    const fs = size === "lg" ? 16 : 14;
    const s = { display: "inline-flex", alignItems: "center", gap: 8, background: isHov ? C.tealDk : C.teal, color: "#fff", border: "none", borderRadius: 12, padding: pad, fontWeight: 700, fontSize: fs, cursor: "pointer", transition: "all .18s", fontFamily: "'Outfit',sans-serif", boxShadow: `0 4px 20px ${C.tealA2}`, textDecoration: "none" };
    if (href) return <a href={href} target="_blank" rel="noreferrer" style={s} onMouseEnter={() => setHovBtn(id)} onMouseLeave={() => setHovBtn(null)}>{children}</a>;
    return <button style={s} onClick={onClick} onMouseEnter={() => setHovBtn(id)} onMouseLeave={() => setHovBtn(null)}>{children}</button>;
  };

  const OutlineBtn = ({ id, onClick, children }) => {
    const isHov = hovBtn === id;
    return (
      <button style={{ display: "inline-flex", alignItems: "center", gap: 8, background: isHov ? C.tealLight : "transparent", color: C.teal, border: `2px solid ${C.teal}`, borderRadius: 12, padding: "12px 26px", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all .18s", fontFamily: "'Outfit',sans-serif" }}
        onClick={onClick} onMouseEnter={() => setHovBtn(id)} onMouseLeave={() => setHovBtn(null)}>
        {children}
      </button>
    );
  };

  const PAINS = [
    { ico: "😤", title: "Leads que somem no WhatsApp pessoal", desc: "Mensagens perdidas, sem histórico, sem rastreabilidade. Cada atendente tem seu próprio caos." },
    { ico: "📉", title: "Pipeline no Excel ou na cabeça", desc: "Sem visibilidade real das oportunidades. Deals morrem por falta de follow-up na hora certa." },
    { ico: "🕐", title: "Equipe respondendo manualmente 24h", desc: "Fora do horário comercial, o cliente vai embora. Seu time passa o dia só respondendo perguntas repetitivas." },
    { ico: "📊", title: "Relatórios que demoram dias para montar", desc: "Gestão no escuro. Decisões por feeling, sem dados de conversão, tempo de resposta ou performance por vendedor." },
  ];

  const FEATURES = [
    { ico: "◈", label: "WhatsApp Centralizado", desc: "Toda a equipe atende por um só número. Histórico completo, distribuição automática de leads e métricas de atendimento em tempo real.", color: C.teal },
    { ico: "⬡", label: "Pipeline Visual Kanban",  desc: "Visualize e arraste deals entre etapas do funil. Nunca perca uma oportunidade por falta de visibilidade do processo.", color: C.blue },
    { ico: "🤖", label: "Chatbot com IA 24/7",     desc: "Atenda, qualifique e segmente leads automaticamente. Transfira para humano só quando necessário. Sem código.", color: C.teal },
    { ico: "◷", label: "Follow-up Automático",    desc: "Agende lembretes e mensagens em série. O sistema avisa quando e como agir. Zero lead esquecido.", color: C.green },
    { ico: "◎", label: "CRM e Gestão de Leads",   desc: "Capture leads do WhatsApp, site e formulários. Qualifique, pontue e acompanhe cada contato desde o primeiro toque.", color: C.amber },
    { ico: "◫", label: "Relatórios em Tempo Real", desc: "Dashboards de performance por vendedor, SLA de resposta, taxa de conversão e muito mais. Decisões com dados.", color: C.blue },
  ];

  const TESTIMONIALS = [
    {
      quote: "Em 3 semanas de C4 OS, nossos leads do WhatsApp aumentaram 40% — porque nenhum mais cai no esquecimento. O chatbot filtra e já manda para o vendedor certo.",
      name: "Ricardo Almeida",
      role: "Diretor Comercial · TechVend Soluções",
      avatar: "RA",
      color: C.teal,
      metric: "+40% conversão",
    },
    {
      quote: "Antes cada vendedor tinha seu WhatsApp pessoal e a gente não saía do caos. Hoje tudo num só lugar, com histórico completo e o gestor vendo tudo em tempo real.",
      name: "Camila Souza",
      role: "Gerente de Vendas · Grupo Irmãos Souza",
      avatar: "CS",
      color: C.blue,
      metric: "5 atendentes, 1 número",
    },
    {
      quote: "O chatbot sozinho economiza pelo menos 3 horas por dia do meu time. As perguntas repetitivas viram automação. Agora focamos só nas oportunidades quentes.",
      name: "Fernando Costa",
      role: "CEO · Costa Serviços Digitais",
      avatar: "FC",
      color: C.green,
      metric: "−3h/dia de trabalho manual",
    },
  ];

  const STEPS = [
    { n: "01", title: "Conecte seu WhatsApp", desc: "Escaneie o QR Code e seu número está conectado em menos de 5 minutos. Sem trocar de número, sem apps extras.", icon: "📱" },
    { n: "02", title: "Configure seu time",   desc: "Adicione vendedores, crie o fluxo do chatbot e defina as regras de distribuição de leads. Interface visual, sem código.", icon: "⚙️" },
    { n: "03", title: "Venda e escale",        desc: "Leads entram, chatbot qualifica, vendedor fecha. Relatórios mostram onde melhorar. Repita até escalar.", icon: "🚀" },
  ];

  const FOR_WHO = [
    { ico: "🏪", title: "Pequenas e Médias Empresas", desc: "Que perdiam leads por falta de organização e agora têm um CRM profissional acessível." },
    { ico: "📦", title: "Distribuidoras e Atacadistas", desc: "Com grande volume de pedidos e atendimento pelo WhatsApp que precisam de rastreabilidade." },
    { ico: "🏥", title: "Clínicas e Prestadores de Serviço", desc: "Que agendam e confirmam pelo WhatsApp e precisam automatizar sem perder o toque humano." },
    { ico: "🏢", title: "Times Comerciais B2B", desc: "Com múltiplos vendedores e necessidade de pipeline, follow-up e relatórios de performance." },
  ];

  const FAQS = [
    { q: "Funciona com meu número de WhatsApp atual?", a: "Sim. Você continua com o mesmo número. Conectamos via QR Code ou API oficial. Em menos de 5 minutos está funcionando, sem precisar trocar de chip ou número." },
    { q: "Quantos atendentes posso ter?", a: "Depende do plano escolhido. Oferecemos desde planos para times pequenos (2-3 atendentes) até enterprise sem limite de usuários. Fale conosco para o plano ideal para o seu time." },
    { q: "Preciso de conhecimento técnico para configurar?", a: "Não. A interface é visual e intuitiva. Criamos o chatbot arrastando blocos, cadastramos vendedores em segundos e o dashboard já vem configurado. Nossa equipe também auxilia no onboarding." },
    { q: "E se eu precisar cancelar?", a: "Sem fidelidade, sem multa. Você pode cancelar a qualquer momento com 30 dias de aviso. Seus dados podem ser exportados antes do encerramento." },
    { q: "Meus dados ficam seguros?", a: "Sim. Utilizamos infraestrutura brasileira com criptografia em trânsito e em repouso, backups automáticos diários e conformidade com a LGPD. Seus dados são seus." },
  ];

  return (
    <div style={{ fontFamily: "'Outfit', 'Inter', system-ui, sans-serif", background: C.white, color: C.text, minHeight: "100vh" }}>
      <Header onNavigate={onNavigate} />
      <StickyWA />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section style={{ paddingTop: isMobile ? 88 : 110, paddingBottom: isMobile ? 56 : 80, background: `linear-gradient(155deg, #edfaf8 0%, #f0fdf9 30%, ${C.white} 65%)`, minHeight: isMobile ? "auto" : "92vh", display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "0 20px" : "0 40px", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? 44 : 72, width: "100%" }}>

          {/* Left copy */}
          <div style={{ flex: isMobile ? "none" : "0 0 46%", minWidth: 0, width: isMobile ? "100%" : "auto" }}>
            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: C.tealLight, border: `1px solid ${C.tealA2}`, borderRadius: 999, padding: "6px 16px", fontSize: 13, fontWeight: 600, color: C.tealDk, marginBottom: 24 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.teal, display: "inline-block", animation: "pulse 2s infinite" }} />
              CRM + WhatsApp + IA — tudo em uma plataforma
            </div>

            <h1 style={{ fontSize: isMobile ? "clamp(36px,9vw,50px)" : "clamp(40px,4.5vw,62px)", fontWeight: 900, lineHeight: 1.05, color: C.dark, letterSpacing: "-1.5px", margin: "0 0 20px" }}>
              Seu time comercial<br />vendendo mais pelo<br />
              <span style={{ color: C.teal, position: "relative" }}>WhatsApp,</span> com<br />controle total.
            </h1>

            <p style={{ fontSize: isMobile ? 15 : 18, lineHeight: 1.75, color: C.muted, maxWidth: 460, marginBottom: 32 }}>
              Centralize atendimentos, automatize com IA e acompanhe cada lead do primeiro contato ao fechamento — sem planilha, sem caos.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
              <SolidBtn id="hero-wa" href={waLink("Olá! Vi o site do C4 OS e quero uma demonstração gratuita.")} size="lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Quero uma Demo Gratuita
              </SolidBtn>
              <OutlineBtn id="hero-how" onClick={() => onNavigate("docs")}>Ver como funciona</OutlineBtn>
            </div>

            {/* Trust micro-copy */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, color: C.muted, alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ color: C.teal }}>✓</span> Sem cartão de crédito</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ color: C.teal }}>✓</span> Setup em 5 minutos</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ color: C.teal }}>✓</span> Suporte em português</span>
            </div>

            {/* Social proof avatars */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 28, paddingTop: 28, borderTop: `1px solid ${C.border}` }}>
              <div style={{ display: "flex" }}>
                {["#0f9490","#2563eb","#16a34a","#d97706"].map((c, i) => (
                  <div key={i} style={{ width: 32, height: 32, borderRadius: "50%", background: c, border: "2px solid #fff", marginLeft: i ? -8 : 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                    {["R","C","F","A"][i]}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: C.dark }}>500+ empresas</span>
                <span style={{ color: C.muted }}> já transformaram suas vendas</span>
              </div>
            </div>
          </div>

          {/* Right: browser mockup */}
          <div style={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : "auto" }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}>
            <BrowserFrame slide={SLIDES[slide]} onPrev={prev} onNext={next} onDot={setSlide} activeIdx={slide} isMobile={isMobile} />
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16, fontSize: 12, color: C.muted }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: C.teal }}>🔒</span> Dados criptografados</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: C.teal }}>🇧🇷</span> Servidores no Brasil</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: C.teal }}>✅</span> LGPD</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEMA — dor ───────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? "60px 20px" : "88px 40px", background: C.dark }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: isMobile ? 40 : 56 }}>
              <div style={{ display: "inline-block", background: "rgba(239,68,68,0.12)", color: "#f87171", borderRadius: 999, padding: "5px 16px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                O problema que você vive todo dia
              </div>
              <h2 style={{ fontSize: "clamp(26px,3.2vw,40px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.8px", margin: "0 0 12px" }}>
                Quanto dinheiro sua empresa perde<br />por falta de organização comercial?
              </h2>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", maxWidth: 480, margin: "0 auto" }}>
                A maioria dos times comerciais sofre com os mesmos problemas. Reconhece algum destes?
              </p>
            </div>
          </FadeIn>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: isMobile ? 16 : 20 }}>
            {PAINS.map((p, i) => (
              <FadeIn key={p.title} delay={i * 0.08}>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "24px 28px", display: "flex", gap: 18, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 32, flexShrink: 0, lineHeight: 1 }}>{p.ico}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 8 }}>{p.title}</div>
                    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>{p.desc}</div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={0.3}>
            <div style={{ textAlign: "center", marginTop: isMobile ? 36 : 48 }}>
              <div style={{ fontSize: isMobile ? 15 : 17, color: "rgba(255,255,255,0.7)", marginBottom: 24, lineHeight: 1.7 }}>
                O C4 OS foi construído para resolver exatamente esses problemas.<br />
                <span style={{ color: C.teal, fontWeight: 600 }}>De ponta a ponta, no mesmo lugar, sem complexidade.</span>
              </div>
              <SolidBtn id="pain-cta" href={waLink("Olá! Tenho problemas com organização comercial e vi o C4 OS no site. Pode me ajudar?")}>
                Quero resolver isso agora →
              </SolidBtn>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────────── */}
      <div ref={statsRef}>
        <section style={{ background: C.teal, padding: isMobile ? "32px 20px" : "44px 40px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexWrap: "wrap" }}>
            {[
              { v: `${counts.a}+`,  l: "Empresas ativas na plataforma", icon: "🏢" },
              { v: `${counts.b >= 1000000 ? (counts.b / 1000000).toFixed(1) + "M" : counts.b.toLocaleString("pt-BR")}+`, l: "Mensagens processadas por mês", icon: "💬" },
              { v: `${counts.c}%`,  l: "Uptime garantido em SLA", icon: "⚡" },
              { v: `${counts.d}h`,  l: "Suporte em português disponível", icon: "🇧🇷" },
            ].map((s, i) => (
              <div key={i} style={{ flex: isMobile ? "1 1 50%" : "1 1 160px", textAlign: "center", padding: isMobile ? "16px 8px" : "12px 24px", borderRight: isMobile ? (i % 2 === 0 ? "1px solid rgba(255,255,255,0.2)" : "none") : (i < 3 ? "1px solid rgba(255,255,255,0.2)" : "none"), borderBottom: isMobile && i < 2 ? "1px solid rgba(255,255,255,0.2)" : "none" }}>
                <div style={{ fontSize: isMobile ? 22 : 26, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 900, color: "#fff", fontFamily: "'Outfit',sans-serif", letterSpacing: "-1px", lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: isMobile ? 11 : 13, color: "rgba(255,255,255,0.75)", marginTop: 6, lineHeight: 1.4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── FEATURES ─────────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? "64px 20px" : "96px 40px", background: C.white }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: isMobile ? 40 : 64 }}>
              <div style={{ display: "inline-block", background: C.tealLight, color: C.teal, borderRadius: 999, padding: "5px 16px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Módulos da plataforma</div>
              <h2 style={{ fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 800, color: C.dark, letterSpacing: "-0.8px", margin: "0 0 14px" }}>
                Tudo que seu time precisa<br />para vender mais
              </h2>
              <p style={{ fontSize: 16, color: C.muted, maxWidth: 500, margin: "0 auto", lineHeight: 1.7 }}>
                Do primeiro contato no WhatsApp ao relatório de conversão — o C4 OS cobre cada etapa do seu processo comercial.
              </p>
            </div>
          </FadeIn>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: isMobile ? 16 : 24 }}>
            {FEATURES.map((f, i) => (
              <FadeIn key={f.label} delay={i * 0.06}>
                <div style={{ background: C.surface, borderRadius: 18, padding: "28px", border: `1px solid ${C.border}`, transition: "all .22s", cursor: "default", height: "100%" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = f.color; e.currentTarget.style.boxShadow = `0 8px 32px ${f.color}20`; e.currentTarget.style.background = C.white; e.currentTarget.style.transform = "translateY(-3px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = C.surface; e.currentTarget.style.transform = "translateY(0)"; }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: `${f.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 18 }}>{f.ico}</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: C.dark, marginBottom: 10 }}>{f.label}</div>
                  <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.75 }}>{f.desc}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ──────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? "64px 20px" : "96px 40px", background: C.surface }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: isMobile ? 40 : 60 }}>
              <div style={{ display: "inline-block", background: C.tealLight, color: C.teal, borderRadius: 999, padding: "5px 16px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Quem já usa o C4 OS</div>
              <h2 style={{ fontSize: "clamp(26px,3.2vw,42px)", fontWeight: 800, color: C.dark, letterSpacing: "-0.8px", margin: 0 }}>
                Resultados reais de times reais
              </h2>
            </div>
          </FadeIn>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: isMobile ? 16 : 24 }}>
            {TESTIMONIALS.map((t, i) => (
              <FadeIn key={t.name} delay={i * 0.1}>
                <div style={{ background: C.white, borderRadius: 18, padding: "28px", border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
                  {/* Metric badge */}
                  <div style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", background: `${t.color}12`, border: `1px solid ${t.color}30`, borderRadius: 8, padding: "5px 12px" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.color }}>{t.metric}</span>
                  </div>
                  {/* Stars */}
                  <div style={{ color: "#f59e0b", fontSize: 14, letterSpacing: 2 }}>★★★★★</div>
                  {/* Quote */}
                  <p style={{ fontSize: 14, color: C.text, lineHeight: 1.75, margin: 0, flex: 1 }}>
                    "{t.quote}"
                  </p>
                  {/* Author */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{t.avatar}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{t.role}</div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ─────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? "64px 20px" : "96px 40px", background: C.white }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: isMobile ? 40 : 60 }}>
              <div style={{ display: "inline-block", background: C.tealLight, color: C.teal, borderRadius: 999, padding: "5px 16px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Como funciona</div>
              <h2 style={{ fontSize: "clamp(26px,3.2vw,42px)", fontWeight: 800, color: C.dark, letterSpacing: "-0.8px", margin: "0 0 12px" }}>
                De zero a vendendo em 3 passos
              </h2>
              <p style={{ fontSize: 16, color: C.muted, maxWidth: 400, margin: "0 auto" }}>
                Sem integrador, sem desenvolvedor, sem dor de cabeça.
              </p>
            </div>
          </FadeIn>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 32 : 0, position: "relative" }}>
            {!isMobile && <div style={{ position: "absolute", top: 36, left: "18%", right: "18%", height: 2, background: `linear-gradient(90deg, ${C.teal} 0%, ${C.teal} 100%)`, opacity: 0.15, borderRadius: 2 }} />}
            {STEPS.map((s, i) => (
              <FadeIn key={s.n} delay={i * 0.12} style={{ flex: 1, textAlign: "center", padding: isMobile ? 0 : "0 24px" }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: C.dark, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: `0 0 0 8px ${C.tealLight}`, fontSize: 24 }}>
                  {s.icon}
                </div>
                <div style={{ display: "inline-block", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: C.teal, marginBottom: 8, letterSpacing: "1px" }}>PASSO {s.n}</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: C.dark, marginBottom: 12 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.75 }}>{s.desc}</div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={0.3}>
            <div style={{ textAlign: "center", marginTop: isMobile ? 40 : 56 }}>
              <SolidBtn id="steps-cta" href={waLink("Olá! Quero começar a usar o C4 OS. Como faço para configurar?")} size="lg">
                Começar agora — é grátis na demo →
              </SolidBtn>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── SISTEMA (carousel escuro) ─────────────────────────────────── */}
      <section style={{ padding: isMobile ? "64px 20px" : "96px 40px", background: C.dark }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: isMobile ? 32 : 52 }}>
              <div style={{ display: "inline-block", background: C.tealA, color: C.teal, borderRadius: 999, padding: "5px 16px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Veja o sistema ao vivo</div>
              <h2 style={{ fontSize: "clamp(26px,3.2vw,40px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.8px", margin: "0 0 12px" }}>
                Interface pensada para<br />times comerciais de verdade
              </h2>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", maxWidth: 440, margin: "0 auto", lineHeight: 1.7 }}>
                Design limpo e rápido. Sua equipe aprende em minutos, não em semanas.
              </p>
            </div>
          </FadeIn>
          <div style={{ display: "flex", gap: isMobile ? 8 : 12, marginBottom: isMobile ? 20 : 32, justifyContent: "center", flexWrap: "wrap" }}>
            {SLIDES.map((s, i) => (
              <button key={s.id} onClick={() => setSlide(i)}
                style={{ background: i === slide ? C.teal : "rgba(255,255,255,0.06)", color: i === slide ? "#fff" : "rgba(255,255,255,0.5)", border: `1px solid ${i === slide ? C.teal : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: isMobile ? "7px 12px" : "8px 18px", fontSize: isMobile ? 12 : 13, fontWeight: 600, cursor: "pointer", transition: "all .18s", display: "flex", alignItems: "center", gap: isMobile ? 4 : 7 }}>
                <span>{s.icon}</span>{s.label}
              </button>
            ))}
          </div>
          <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <BrowserFrame slide={SLIDES[slide]} onPrev={prev} onNext={next} onDot={setSlide} activeIdx={slide} />
          </div>
        </div>
      </section>

      {/* ── PARA QUEM É ──────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? "64px 20px" : "88px 40px", background: C.surface }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 56 }}>
              <div style={{ display: "inline-block", background: C.tealLight, color: C.teal, borderRadius: 999, padding: "5px 16px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Para quem é o C4 OS</div>
              <h2 style={{ fontSize: "clamp(26px,3.2vw,40px)", fontWeight: 800, color: C.dark, letterSpacing: "-0.8px", margin: 0 }}>
                Feito para quem usa o WhatsApp<br />como canal de vendas
              </h2>
            </div>
          </FadeIn>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: isMobile ? 14 : 20 }}>
            {FOR_WHO.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.08}>
                <div style={{ background: C.white, borderRadius: 16, padding: "24px 22px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 14 }}>{f.ico}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.dark, marginBottom: 8, lineHeight: 1.3 }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>{f.desc}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? "64px 20px" : "88px 40px", background: C.white }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 52 }}>
              <div style={{ display: "inline-block", background: C.tealLight, color: C.teal, borderRadius: 999, padding: "5px 16px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Dúvidas frequentes</div>
              <h2 style={{ fontSize: "clamp(26px,3.2vw,40px)", fontWeight: 800, color: C.dark, letterSpacing: "-0.8px", margin: 0 }}>
                Respondemos antes de você perguntar
              </h2>
            </div>
          </FadeIn>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {FAQS.map((f, i) => (
              <FadeIn key={i} delay={i * 0.06}>
                <div style={{ border: `1px solid ${faqOpen === i ? C.teal : C.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color .2s", background: faqOpen === i ? C.tealLight : C.white }}>
                  <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                    style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, textAlign: "left", fontFamily: "inherit" }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: faqOpen === i ? C.tealDk : C.dark, lineHeight: 1.4 }}>{f.q}</span>
                    <span style={{ fontSize: 20, color: faqOpen === i ? C.teal : C.muted, flexShrink: 0, transform: faqOpen === i ? "rotate(45deg)" : "none", transition: "transform .2s", lineHeight: 1 }}>+</span>
                  </button>
                  {faqOpen === i && (
                    <div style={{ padding: "0 22px 20px", fontSize: 14, color: C.text, lineHeight: 1.75 }}>
                      {f.a}
                    </div>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={0.3}>
            <div style={{ textAlign: "center", marginTop: 36, fontSize: 14, color: C.muted }}>
              Ainda tem dúvidas?{" "}
              <a href={waLink("Olá! Tenho uma dúvida sobre o C4 OS antes de contratar.")} target="_blank" rel="noreferrer"
                style={{ color: C.teal, fontWeight: 600, textDecoration: "none" }}>
                Fale com a gente no WhatsApp →
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? "64px 24px" : "100px 40px", background: `linear-gradient(135deg, ${C.teal} 0%, ${C.tealDk} 60%, #073b38 100%)`, textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Background decoration */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -100, left: -60, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 680, margin: "0 auto", position: "relative" }}>
          <FadeIn>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.12)", borderRadius: 999, padding: "6px 18px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: 28 }}>
              🎁 Demo gratuita — sem compromisso
            </div>
            <h2 style={{ fontSize: "clamp(30px,4vw,52px)", fontWeight: 900, color: "#fff", letterSpacing: "-1.2px", margin: "0 0 20px", lineHeight: 1.1 }}>
              Pronto para transformar<br />seu time comercial?
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 18, color: "rgba(255,255,255,0.75)", marginBottom: 40, lineHeight: 1.7, maxWidth: 520, margin: "0 auto 40px" }}>
              Converse com um especialista e veja em 20 minutos como o C4 OS funciona para o seu negócio específico.
            </p>
            <a href={waLink("Olá! Quero uma demonstração gratuita do C4 OS para minha empresa.")} target="_blank" rel="noreferrer"
              onMouseEnter={e => { e.currentTarget.style.background = C.dark; e.currentTarget.style.color = "#fff"; e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = C.dark; e.currentTarget.style.transform = "scale(1)"; }}
              style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#fff", color: C.dark, textDecoration: "none", borderRadius: 14, padding: "16px 40px", fontWeight: 800, fontSize: isMobile ? 15 : 17, cursor: "pointer", transition: "all .2s", boxShadow: "0 8px 32px rgba(0,0,0,0.25)", fontFamily: "'Outfit',sans-serif" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill={C.whatsapp}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Quero minha Demo Gratuita
            </a>
            <div style={{ display: "flex", justifyContent: "center", gap: isMobile ? 16 : 28, marginTop: 28, fontSize: 13, color: "rgba(255,255,255,0.6)", flexWrap: "wrap" }}>
              <span>✓ Sem cartão de crédito</span>
              <span>✓ Resposta em menos de 1h</span>
              <span>✓ Suporte dedicado</span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer style={{ background: C.dark, borderTop: "1px solid rgba(255,255,255,0.06)", padding: isMobile ? "32px 20px" : "44px 40px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20, marginBottom: 28, paddingBottom: 28, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <img src="/logo.png" alt="C4 OS" width={28} height={28} style={{ objectFit: "contain" }} />
                <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 15, color: "#fff" }}>C4 OS <span style={{ color: C.faint, fontWeight: 400, fontSize: 12 }}>by C4HUB</span></span>
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", maxWidth: 280, lineHeight: 1.6 }}>
                CRM + WhatsApp + IA para times comerciais de alta performance.
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[["Blog", "blog"], ["Documentação", "docs"], ["Login", "login"]].map(([l, t]) => (
                <button key={t} onClick={() => onNavigate(t)}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, cursor: "pointer", color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 500, padding: "7px 14px", transition: "all .15s", fontFamily: "inherit" }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.tealA; e.currentTarget.style.color = C.teal; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}>
                  {l}
                </button>
              ))}
              <a href={waLink("Olá! Quero falar com a equipe C4 OS.")} target="_blank" rel="noreferrer"
                style={{ background: `${C.whatsapp}20`, border: `1px solid ${C.whatsapp}40`, borderRadius: 8, color: C.whatsapp, fontSize: 13, fontWeight: 600, padding: "7px 14px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
            <span>© 2025 C4HUB. Todos os direitos reservados.</span>
            <span>LGPD · Privacidade · Termos de Uso</span>
          </div>
        </div>
      </footer>

      {/* Keyframe para pulse badge */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
