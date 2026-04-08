import { useState, useRef, useEffect } from "react";
import { L } from "../constants/theme";
import { Av, Tag } from "../components/ui";

/* ─── Groq API ─── */
const GROQ_KEY   = import.meta.env.VITE_GROQ_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `Você é o C4 AI, assistente inteligente do C4 OS — um CRM focado em vendas e gestão comercial.

Você ajuda times de vendas a:
- Analisar funis de conversão e identificar gargalos
- Priorizar leads com maior potencial de fechamento
- Sugerir estratégias para melhorar taxas de conversão
- Gerar insights e relatórios a partir de dados de vendas
- Identificar leads em risco de churn
- Projetar receita, pipeline e metas comerciais

Responda sempre em português brasileiro. Seja objetivo, prático e orientado a resultados. Use formatação markdown quando útil (listas, negrito, seções com ##).`;

/* ─── Renderizador de Markdown simplificado ─── */
function MdLine({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} style={{ fontWeight: 700, color: L.t1 }}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("*")  && p.endsWith("*"))  return <em key={i} style={{ fontStyle: "italic" }}>{p.slice(1, -1)}</em>;
        if (p.startsWith("`")  && p.endsWith("`"))  return <code key={i} style={{ background: L.surface, border: `1px solid ${L.line}`, borderRadius: 4, padding: "1px 5px", fontSize: "0.9em", fontFamily: "'JetBrains Mono',monospace" }}>{p.slice(1, -1)}</code>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function MdBlock({ content }) {
  const lines = content.split("\n");
  const out = [];
  let listItems = [];
  let numItems = [];

  const flushList = () => {
    if (listItems.length) { out.push(<ul key={out.length} style={{ paddingLeft: 18, margin: "6px 0" }}>{listItems}</ul>); listItems = []; }
    if (numItems.length)  { out.push(<ol key={out.length} style={{ paddingLeft: 18, margin: "6px 0" }}>{numItems}</ol>); numItems = []; }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) { flushList(); out.push(<br key={`br${i}`}/>); return; }

    if (/^[-•*]\s/.test(trimmed)) {
      const txt = trimmed.replace(/^[-•*]\s/, "");
      listItems.push(<li key={i} style={{ marginBottom: 2, lineHeight: 1.6 }}><MdLine text={txt}/></li>);
      return;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      const txt = trimmed.replace(/^\d+\.\s/, "");
      numItems.push(<li key={i} style={{ marginBottom: 2, lineHeight: 1.6 }}><MdLine text={txt}/></li>);
      return;
    }
    if (trimmed.startsWith("### ")) { flushList(); out.push(<div key={i} style={{ fontSize: 13, fontWeight: 700, color: L.t1, marginTop: 10, marginBottom: 4 }}><MdLine text={trimmed.slice(4)}/></div>); return; }
    if (trimmed.startsWith("## "))  { flushList(); out.push(<div key={i} style={{ fontSize: 14, fontWeight: 700, color: L.t1, marginTop: 10, marginBottom: 4 }}><MdLine text={trimmed.slice(3)}/></div>); return; }
    if (trimmed.startsWith("# "))   { flushList(); out.push(<div key={i} style={{ fontSize: 15, fontWeight: 700, color: L.t1, marginTop: 10, marginBottom: 4 }}><MdLine text={trimmed.slice(2)}/></div>); return; }
    if (/^---+$/.test(trimmed)) { flushList(); out.push(<hr key={i} style={{ border: "none", borderTop: `1px solid ${L.line}`, margin: "8px 0" }}/>); return; }

    flushList();
    out.push(<div key={i} style={{ lineHeight: 1.65, marginBottom: 2 }}><MdLine text={trimmed}/></div>);
  });
  flushList();
  return <div>{out}</div>;
}

const SUGS = [
  "Analise meu funil de vendas",
  "Quais leads devo priorizar?",
  "Como melhorar minha taxa de conversão?",
  "Gere um relatório semanal",
  "Previsão de receita — próximos 90 dias",
  "Leads em risco de churn",
];

export default function PageAI({ user }) {
  const welcome = `Olá, **${user?.nome?.split(" ")[0] || ""}**! Sou o **C4 AI**, powered by Groq · Llama 3.3.\n\nPosso analisar seu funil de vendas, sugerir ações estratégicas, gerar relatórios e identificar oportunidades.\n\nComo posso ajudar hoje?`;

  const [chat, setChat] = useState([{ role: "assistant", content: welcome }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [model, setModel] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, loading]);

  const send = async (txt) => {
    const q = (txt || input).trim();
    if (!q || loading) return;
    setInput(""); setErr("");

    const userMsg = { role: "user", content: q };
    const history = [...chat, userMsg];
    setChat(history);
    setLoading(true);

    try {
      // Formato OpenAI-compatible (Groq)
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...history
          .filter(m => m.role === "user" || m.role === "assistant")
          .map(m => ({ role: m.role, content: m.content })),
      ];

      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "Sem resposta.";
      if (data.model) setModel(data.model);
      setChat(p => [...p, { role: "assistant", content: text }]);
    } catch (e) {
      setErr(e.message);
      setChat(p => [...p, { role: "assistant", content: `❌ ${e.message}` }]);
    }

    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const clearChat = () => {
    setChat([{ role: "assistant", content: welcome }]);
    setErr(""); setModel("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 86px)", minHeight: 400, animation: "in .3s ease" }}>

      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(135deg,${L.tealBg},${L.copperBg})`, border: `1px solid ${L.teal}22`, borderRadius: 12, padding: "12px 16px", marginBottom: 12, flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: L.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "white", flexShrink: 0, boxShadow: `0 4px 12px ${L.teal}40` }}>✦</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: L.t1, fontFamily: "'Outfit',sans-serif" }}>
              C4 <span style={{ color: L.teal }}>AI</span>
              {model && <span style={{ fontSize: 9, color: L.t4, fontFamily: "'JetBrains Mono',monospace", marginLeft: 6, fontWeight: 400 }}>{model}</span>}
            </div>
            <div style={{ fontSize: 10, color: L.t3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Powered by Groq · Llama 3.3 70B · Inteligência de negócios</div>
          </div>
          <button onClick={clearChat} title="Limpar conversa" style={{ background: "none", border: `1px solid ${L.line}`, borderRadius: 7, cursor: "pointer", color: L.t4, fontSize: 11, padding: "4px 9px", fontFamily: "inherit", transition: "all .12s", flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.color = L.red; e.currentTarget.style.borderColor = L.red + "88"; }} onMouseLeave={e => { e.currentTarget.style.color = L.t4; e.currentTarget.style.borderColor = L.line; }}>
            ↺ Limpar
          </button>
        </div>
        <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
          {["Análise", "Relatório", "Sugestão", "Previsão"].map(t => (
            <Tag key={t} color={L.teal} bg={L.tealBg} small>{t}</Tag>
          ))}
        </div>
      </div>

      {/* ── SUGESTÕES ── */}
      <div className="hide-mobile" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, flexShrink: 0 }}>
        {SUGS.map(s => (
          <button key={s} onClick={() => send(s)} disabled={loading}
            style={{ padding: "5px 11px", borderRadius: 8, fontSize: 11, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", background: L.white, color: L.t3, border: `1px solid ${L.line}`, transition: "all .12s", opacity: loading ? .5 : 1, whiteSpace: "nowrap" }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = L.teal; e.currentTarget.style.color = L.teal; e.currentTarget.style.background = L.tealBg; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = L.line; e.currentTarget.style.color = L.t3; e.currentTarget.style.background = L.white; }}
          >✦ {s}</button>
        ))}
      </div>

      {/* ── MENSAGENS ── */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: "2px 0 8px" }}>
        {chat.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            {m.role === "assistant"
              ? <div style={{ width: 28, height: 28, borderRadius: 8, background: L.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "white", flexShrink: 0, marginTop: 1 }}>✦</div>
              : <Av name={user?.nome || "U"} color={user?.cor || L.copper} size={28} />
            }
            <div style={{
              flex: 1, padding: "10px 14px",
              borderRadius: m.role === "assistant" ? "3px 12px 12px 12px" : "12px 3px 12px 12px",
              background: m.role === "assistant" ? L.white : L.tealBg,
              border: `1px solid ${m.role === "assistant" ? L.teal + "22" : L.teal + "33"}`,
              fontSize: 12.5, color: L.t1, boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              wordBreak: "break-word",
            }}>
              {m.role === "assistant"
                ? <MdBlock content={m.content} />
                : <span style={{ lineHeight: 1.6 }}>{m.content}</span>
              }
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: L.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "white", flexShrink: 0 }}>✦</div>
            <div style={{ padding: "12px 16px", background: L.white, border: `1px solid ${L.teal}22`, borderRadius: "3px 12px 12px 12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {[0, 1, 2].map(j => (
                  <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: L.teal, animation: `blink 1.2s ease ${j * .22}s infinite` }} />
                ))}
                <span style={{ fontSize: 11, color: L.t4, marginLeft: 6 }}>Analisando...</span>
              </div>
            </div>
          </div>
        )}

        {err && !loading && (
          <div style={{ padding: "8px 14px", background: L.redBg, border: `1px solid ${L.red}22`, borderRadius: 8, fontSize: 12, color: L.red }}>
            ❌ {err}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* ── INPUT ── */}
      <div style={{ display: "flex", gap: 8, marginTop: 6, flexShrink: 0 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Pergunte sobre seus dados, relatórios ou análises..."
          disabled={loading}
          style={{ flex: 1, background: L.white, border: `1.5px solid ${L.line}`, borderRadius: 10, padding: "11px 15px", color: L.t1, fontSize: 12.5, fontFamily: "inherit", outline: "none", transition: "border-color .12s", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", opacity: loading ? .7 : 1 }}
          onFocus={e => e.target.style.borderColor = L.teal}
          onBlur={e => e.target.style.borderColor = L.line}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          style={{ padding: "11px 20px", borderRadius: 10, background: loading || !input.trim() ? L.surface : L.teal, border: "none", color: loading || !input.trim() ? L.t4 : "white", fontWeight: 600, cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontSize: 13, transition: "all .15s", fontFamily: "inherit", boxShadow: !loading && input.trim() ? `0 4px 12px ${L.teal}30` : "none", whiteSpace: "nowrap" }}
        >
          {loading ? "..." : "Enviar"}
        </button>
      </div>
      <div style={{ textAlign: "center", fontSize: 10, color: L.t5, marginTop: 6 }}>
        Enter para enviar · Shift+Enter para nova linha
      </div>
    </div>
  );
}
