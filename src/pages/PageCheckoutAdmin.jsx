import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { L } from "../constants/theme";

const BASE_URL = "https://c4os.com.br/obrigado";

const DEFAULT_CONFIG = {
  titulo: "Sua compra foi confirmada!",
  subtitulo: "Estamos preparando tudo para você. Em breve você receberá o acesso completo à plataforma C4 OS e poderá começar a transformar seu time comercial.",
  badge: "🎉 Compra realizada com sucesso",
  whatsapp: "5562982054815",
  whatsapp_msg: "Olá! Acabei de finalizar minha compra do C4 OS e preciso de ajuda com o onboarding.",
  steps: [
    { n: "01", icon: "✉️", title: "Verifique seu e-mail", desc: "Enviamos um e-mail de confirmação com os detalhes do seu pedido e as instruções de acesso. Confira também sua caixa de spam." },
    { n: "02", icon: "⚙️", title: "Configure sua conta", desc: "Acesse a plataforma com as credenciais enviadas, complete o perfil da empresa e convide os membros do seu time." },
    { n: "03", icon: "🚀", title: "Conecte seu WhatsApp", desc: "Vincule seu número de WhatsApp Business e comece a centralizar atendimentos, automatizar respostas e fechar mais vendas." },
  ],
  planos: {
    starter:      { nome: "Starter",      cor: "#1aaa96", usuarios: "Até 3 usuários" },
    profissional: { nome: "Profissional", cor: "#2563eb", usuarios: "Até 10 usuários" },
    enterprise:   { nome: "Enterprise",   cor: "#7c3aed", usuarios: "Usuários ilimitados" },
  },
};

function buildUrl(plano, empresa, ref) {
  const p = new URLSearchParams();
  if (plano)   p.set("plano", plano);
  if (empresa) p.set("empresa", empresa);
  if (ref)     p.set("ref", ref);
  const qs = p.toString();
  return qs ? `${BASE_URL}?${qs}` : BASE_URL;
}

function useCopyToast() {
  const [copied, setCopied] = useState(null);
  const copy = useCallback((text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    });
  }, []);
  return { copied, copy };
}

/* ─── Tab: Gerador de Links ─────────────────────────────────────── */
function TabLinks({ config }) {
  const [plano,   setPlano]   = useState("starter");
  const [empresa, setEmpresa] = useState("");
  const [ref,     setRef]     = useState("");
  const { copied, copy } = useCopyToast();

  const url = buildUrl(plano, empresa, ref);

  const PLAN_KEYS = config?.planos ? Object.keys(config.planos) : Object.keys(DEFAULT_CONFIG.planos);
  const planos    = config?.planos ?? DEFAULT_CONFIG.planos;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Builder */}
      <div style={{ background: L.white, borderRadius: 14, border: `1px solid ${L.line}`, padding: "28px 28px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: L.t2, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 20, fontFamily: "'JetBrains Mono',monospace" }}>Construtor de URL</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: L.t3 }}>Plano</span>
            <select value={plano} onChange={e => setPlano(e.target.value)}
              style={{ border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: L.t1, background: L.surface, fontFamily: "inherit", outline: "none" }}>
              <option value="">— sem plano —</option>
              {PLAN_KEYS.map(k => (
                <option key={k} value={k}>{planos[k].nome}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: L.t3 }}>Nome da Empresa</span>
            <input value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="ex: Empresa XPTO"
              style={{ border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: L.t1, background: L.surface, fontFamily: "inherit", outline: "none" }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: L.t3 }}>Código de Referência</span>
            <input value={ref} onChange={e => setRef(e.target.value)} placeholder="ex: PROMO10"
              style={{ border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: L.t1, background: L.surface, fontFamily: "inherit", outline: "none" }} />
          </label>
        </div>

        {/* URL preview */}
        <div style={{ background: L.surface, border: `1px solid ${L.line}`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: L.t4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", flexShrink: 0 }}>URL</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: L.accent, flex: 1, wordBreak: "break-all" }}>{url}</span>
          <button onClick={() => copy(url, "custom")}
            style={{ background: copied === "custom" ? L.accent : L.white, color: copied === "custom" ? "#fff" : L.t2, border: `1px solid ${copied === "custom" ? L.accent : L.line}`, borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, transition: "all .15s", fontFamily: "inherit" }}>
            {copied === "custom" ? "✓ Copiado" : "Copiar"}
          </button>
          <button onClick={() => window.open(url, "_blank")}
            style={{ background: L.white, color: L.t3, border: `1px solid ${L.line}`, borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>
            Abrir ↗
          </button>
        </div>
      </div>

      {/* Quick links por plano */}
      <div style={{ background: L.white, borderRadius: 14, border: `1px solid ${L.line}`, padding: "28px 28px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: L.t2, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 20, fontFamily: "'JetBrains Mono',monospace" }}>Links Rápidos por Plano</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {PLAN_KEYS.map(k => {
            const p   = planos[k];
            const url = buildUrl(k, "", "");
            const key = `plan-${k}`;
            return (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", border: `1px solid ${L.line}`, borderRadius: 10, background: L.surface }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.cor, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: L.t1, marginBottom: 2 }}>{p.nome}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: L.t4, wordBreak: "break-all" }}>{url}</div>
                </div>
                <button onClick={() => copy(url, key)}
                  style={{ background: copied === key ? L.accent : L.white, color: copied === key ? "#fff" : L.t2, border: `1px solid ${copied === key ? L.accent : L.line}`, borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, transition: "all .15s", fontFamily: "inherit" }}>
                  {copied === key ? "✓ Copiado" : "Copiar"}
                </button>
                <button onClick={() => window.open(url, "_blank")}
                  style={{ background: L.white, color: L.t3, border: `1px solid ${L.line}`, borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>
                  ↗
                </button>
              </div>
            );
          })}
          {/* Link sem plano */}
          {(() => {
            const url = BASE_URL;
            const key = "plan-none";
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", border: `1px solid ${L.line}`, borderRadius: 10, background: L.surface }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: L.t4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: L.t1, marginBottom: 2 }}>Genérico (sem plano)</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: L.t4 }}>{url}</div>
                </div>
                <button onClick={() => copy(url, key)}
                  style={{ background: copied === key ? L.accent : L.white, color: copied === key ? "#fff" : L.t2, border: `1px solid ${copied === key ? L.accent : L.line}`, borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, transition: "all .15s", fontFamily: "inherit" }}>
                  {copied === key ? "✓ Copiado" : "Copiar"}
                </button>
                <button onClick={() => window.open(url, "_blank")}
                  style={{ background: L.white, color: L.t3, border: `1px solid ${L.line}`, borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>
                  ↗
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

/* ─── Tab: Conteúdo ─────────────────────────────────────────────── */
function TabConteudo({ config, setConfig, onSave, saving, saved }) {
  const c = config ?? DEFAULT_CONFIG;

  const set = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));
  const setStep = (i, field, val) => setConfig(prev => {
    const steps = [...(prev.steps ?? DEFAULT_CONFIG.steps)];
    steps[i] = { ...steps[i], [field]: val };
    return { ...prev, steps };
  });
  const setPlano = (k, field, val) => setConfig(prev => {
    const planos = { ...(prev.planos ?? DEFAULT_CONFIG.planos) };
    planos[k] = { ...planos[k], [field]: val };
    return { ...prev, planos };
  });


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Textos principais */}
      <div style={{ background: L.white, borderRadius: 14, border: `1px solid ${L.line}`, padding: "28px 28px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: L.t2, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 20, fontFamily: "'JetBrains Mono',monospace" }}>Textos Principais</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Badge / Etiqueta de sucesso" value={c.badge ?? ""} onChange={v => set("badge", v)} />
          <Field label="Título (sem empresa)" value={c.titulo ?? ""} onChange={v => set("titulo", v)} />
          <Field label="Subtítulo" value={c.subtitulo ?? ""} onChange={v => set("subtitulo", v)} multiline />
        </div>
      </div>

      {/* WhatsApp */}
      <div style={{ background: L.white, borderRadius: 14, border: `1px solid ${L.line}`, padding: "28px 28px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: L.t2, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 20, fontFamily: "'JetBrains Mono',monospace" }}>WhatsApp</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Número (somente dígitos, com DDI)" value={c.whatsapp ?? ""} onChange={v => set("whatsapp", v)} mono />
          <Field label="Mensagem pré-preenchida" value={c.whatsapp_msg ?? ""} onChange={v => set("whatsapp_msg", v)} multiline />
        </div>
      </div>

      {/* Próximos Passos */}
      <div style={{ background: L.white, borderRadius: 14, border: `1px solid ${L.line}`, padding: "28px 28px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: L.t2, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 20, fontFamily: "'JetBrains Mono',monospace" }}>Próximos Passos</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {(c.steps ?? DEFAULT_CONFIG.steps).map((s, i) => (
            <div key={i} style={{ padding: "16px 18px", border: `1px solid ${L.line}`, borderRadius: 10, background: L.surface }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: L.accent, marginBottom: 12, fontFamily: "'JetBrains Mono',monospace" }}>Passo {s.n}</div>
              <div className="rg-keep" style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 12, marginBottom: 12 }}>
                <Field label="Ícone" value={s.icon ?? ""} onChange={v => setStep(i, "icon", v)} />
                <Field label="Título" value={s.title ?? ""} onChange={v => setStep(i, "title", v)} />
              </div>
              <Field label="Descrição" value={s.desc ?? ""} onChange={v => setStep(i, "desc", v)} multiline />
            </div>
          ))}
        </div>
      </div>

      {/* Planos */}
      <div style={{ background: L.white, borderRadius: 14, border: `1px solid ${L.line}`, padding: "28px 28px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: L.t2, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 20, fontFamily: "'JetBrains Mono',monospace" }}>Planos</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Object.entries(c.planos ?? DEFAULT_CONFIG.planos).map(([k, p]) => (
            <div key={k} style={{ padding: "16px 18px", border: `1px solid ${L.line}`, borderRadius: 10, background: L.surface }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: L.t4, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12, fontFamily: "'JetBrains Mono',monospace" }}>{k}</div>
              <div className="rg-keep" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: 12 }}>
                <Field label="Nome do Plano" value={p.nome ?? ""} onChange={v => setPlano(k, "nome", v)} />
                <Field label="Usuários" value={p.usuarios ?? ""} onChange={v => setPlano(k, "usuarios", v)} />
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: L.t3 }}>Cor</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="color" value={p.cor ?? "#1aaa96"} onChange={e => setPlano(k, "cor", e.target.value)}
                      style={{ width: 38, height: 34, border: `1px solid ${L.line}`, borderRadius: 6, cursor: "pointer", padding: 2 }} />
                    <input value={p.cor ?? ""} onChange={e => setPlano(k, "cor", e.target.value)}
                      style={{ flex: 1, border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 8px", fontSize: 12, color: L.t1, background: L.surface, fontFamily: "'JetBrains Mono',monospace", outline: "none" }} />
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={onSave} disabled={saving}
          style={{ background: saving ? L.t4 : L.accent, color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background .15s" }}>
          {saving ? "Salvando..." : "Salvar Configurações"}
        </button>
        {saved && <span style={{ fontSize: 13, color: L.accent, fontWeight: 600 }}>✓ Salvo com sucesso</span>}
      </div>
    </div>
  );
}

/* ─── Página principal ──────────────────────────────────────────── */
// Fora do componente de propósito: declarado dentro, era recriado a cada
// tecla e remontava o input, que perdia o foco a cada caractere.
function Field({ label, value, onChange, multiline = false, mono = false }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: L.t3 }}>{label}</span>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
            style={{ border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: L.t1, background: L.surface, fontFamily: mono ? "'JetBrains Mono',monospace" : "inherit", outline: "none", resize: "vertical", lineHeight: 1.6 }} />
        : <input value={value} onChange={e => onChange(e.target.value)}
            style={{ border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: L.t1, background: L.surface, fontFamily: mono ? "'JetBrains Mono',monospace" : "inherit", outline: "none" }} />
      }
    </label>
  );
}

export default function PageCheckoutAdmin({ user }) {
  const [tab,     setTab]     = useState("links");
  const [config,  setConfig]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    supabase.from("checkout_config").select("config").eq("id", 1).single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setConfig(data?.config ?? DEFAULT_CONFIG);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const { error } = await supabase
      .from("checkout_config")
      .upsert({ id: 1, config, updated_by: user?.id, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) setError(error.message);
    else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  };

  const TABS = [
    { id: "links",    label: "🔗 Gerador de Links" },
    { id: "conteudo", label: "✏️ Conteúdo da Página" },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${L.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>✓</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: L.t1, letterSpacing: "-0.3px" }}>Página de Checkout</h1>
            <p style={{ margin: 0, fontSize: 13, color: L.t3 }}>Configure e gere links da página de finalização de compra</p>
          </div>
        </div>
        <div style={{ height: 1, background: L.line, marginTop: 16 }} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: L.surface, borderRadius: 10, padding: 4, border: `1px solid ${L.line}`, width: "fit-content" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: tab === t.id ? L.white : "transparent", color: tab === t.id ? L.t1 : L.t3, border: tab === t.id ? `1px solid ${L.line}` : "1px solid transparent", borderRadius: 7, padding: "7px 18px", fontSize: 13, fontWeight: tab === t.id ? 700 : 500, cursor: "pointer", fontFamily: "inherit", transition: "all .15s", boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,0.06)" : "none" }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 40, color: L.t3, fontSize: 14 }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${L.line}`, borderTopColor: L.accent, animation: "spin .7s linear infinite" }} />
          Carregando configurações...
        </div>
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#dc2626", marginBottom: 16 }}>
          Erro: {error}
        </div>
      )}

      {!loading && config && (
        <>
          {tab === "links"    && <TabLinks    config={config} />}
          {tab === "conteudo" && <TabConteudo config={config} setConfig={setConfig} onSave={handleSave} saving={saving} saved={saved} />}
        </>
      )}
    </div>
  );
}
