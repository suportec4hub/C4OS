import { useState, useRef, useEffect, useCallback } from "react";
import { L } from "../constants/theme";
import { Av, Tag } from "../components/ui";
import { supabase } from "../lib/supabase";
import { useBreakpoint } from "../hooks/useBreakpoint";

/* ─── Groq API ─── */
const GROQ_KEY   = import.meta.env.VITE_GROQ_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `Você é o C4 AI, assistente inteligente do C4 OS — um CRM focado em vendas e gestão comercial.

Você tem acesso em tempo real aos dados do sistema do usuário logado (leads, pipeline, metas, equipe, vendas). Use esses dados para responder com precisão, sem pedir informações que já estão disponíveis no contexto fornecido.

Você ajuda times de vendas a:
- Analisar funis de conversão e identificar gargalos
- Priorizar leads com maior potencial de fechamento
- Sugerir estratégias para melhorar taxas de conversão
- Gerar insights e relatórios a partir dos dados reais
- Identificar leads em risco de churn
- Projetar receita, pipeline e metas comerciais

Responda sempre em português brasileiro. Seja objetivo, prático e orientado a resultados. Use formatação markdown quando útil (listas, negrito, seções com ##). Quando apresentar valores monetários, use o formato brasileiro (R$ 1.500,00).`;

/* ─── Busca contexto real do CRM ─── */
const fmtBRL = v => `R$ ${parseFloat(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

async function buscarContextoCRM(empresaId) {
  if (!empresaId) return "";
  try {
    const now   = new Date();
    const mesInt = now.getMonth() + 1;
    const ano    = now.getFullYear();
    const mesStr = `${ano}-${String(mesInt).padStart(2,"0")}`;
    const mesNome = now.toLocaleString("pt-BR",{month:"long",year:"numeric"});

    const [rLeads, rDeals, rMeta, rVendas, rEquipe, rMetasVend] = await Promise.all([
      supabase.from("leads").select("nome,status,valor_estimado,score,origem,ultima_atividade,created_at").eq("empresa_id", empresaId).order("created_at",{ascending:false}),
      supabase.from("deals").select("titulo,etapa,valor,probabilidade,previsao_fechamento").eq("empresa_id", empresaId),
      supabase.from("metas").select("valor_total").eq("empresa_id", empresaId).eq("mes", mesInt).eq("ano", ano).maybeSingle(),
      supabase.from("vendas_realizadas").select("valor,usuario_id,descricao,created_at").eq("empresa_id", empresaId).eq("mes", mesStr),
      supabase.from("usuarios").select("id,nome,cargo,ativo,role").eq("empresa_id", empresaId),
      supabase.from("metas_vendedores").select("usuario_id,meta_individual").eq("empresa_id", empresaId).eq("mes", mesStr),
    ]);

    const leads      = rLeads.data   || [];
    const deals      = rDeals.data   || [];
    const equipe     = rEquipe.data  || [];
    const vendas     = rVendas.data  || [];
    const metasVend  = rMetasVend.data || [];
    const metaTotal  = parseFloat(rMeta.data?.valor_total || 0);
    const vendasTot  = vendas.reduce((s,v)=>s+parseFloat(v.valor||0),0);
    const pctMeta    = metaTotal>0 ? Math.round((vendasTot/metaTotal)*100) : 0;

    // Leads por status
    const leadsByStatus = leads.reduce((a,l)=>{
      const k = l.status || "sem status"; a[k]=(a[k]||0)+1; return a;
    },{});
    const valorLeads = leads.reduce((s,l)=>s+parseFloat(l.valor_estimado||0),0);

    // Deals por etapa
    const dealsByEtapa = deals.reduce((a,d)=>{
      const k = d.etapa||"sem etapa";
      if(!a[k]) a[k]={count:0,valor:0,probMedia:0};
      a[k].count++; a[k].valor+=parseFloat(d.valor||0); a[k].probMedia+=parseInt(d.probabilidade||0);
      return a;
    },{});
    Object.values(dealsByEtapa).forEach(e=>{ e.probMedia=Math.round(e.probMedia/e.count); });
    const pipelineTotal = deals.reduce((s,d)=>s+parseFloat(d.valor||0),0);

    // Metas individuais por vendedor
    const metasMap = {};
    metasVend.forEach(mv=>{
      const u = equipe.find(u=>u.id===mv.usuario_id);
      const realizado = vendas.filter(v=>v.usuario_id===mv.usuario_id).reduce((s,v)=>s+parseFloat(v.valor||0),0);
      metasMap[mv.usuario_id]={ nome:u?.nome||"?", meta:parseFloat(mv.meta_individual||0), realizado };
    });

    // Montar contexto
    let ctx = `---\n## DADOS DO SISTEMA — ${now.toLocaleDateString("pt-BR")} (${mesNome})\n\n`;

    ctx += `### 📋 Leads (Total: ${leads.length})\n`;
    ctx += `- Valor total estimado em carteira: ${fmtBRL(valorLeads)}\n`;
    if (Object.keys(leadsByStatus).length) {
      ctx += `- Por status: ${Object.entries(leadsByStatus).map(([k,v])=>`**${k}** (${v})`).join(", ")}\n`;
    }
    // Últimos 8 leads
    if (leads.length > 0) {
      ctx += `- Leads recentes:\n`;
      leads.slice(0,8).forEach(l=>{
        const ult = l.ultima_atividade ? new Date(l.ultima_atividade).toLocaleDateString("pt-BR") : "—";
        ctx += `  - ${l.nome||"Lead sem nome"} | status: ${l.status||"—"} | valor: ${fmtBRL(l.valor_estimado)} | score: ${l.score||0} | última atividade: ${ult}\n`;
      });
    }

    ctx += `\n### 💰 Pipeline / Deals (Total: ${deals.length} | ${fmtBRL(pipelineTotal)})\n`;
    if (Object.keys(dealsByEtapa).length) {
      Object.entries(dealsByEtapa).forEach(([etapa,d])=>{
        ctx += `- **${etapa}**: ${d.count} deal(s), ${fmtBRL(d.valor)}, prob. média ${d.probMedia}%\n`;
      });
    } else {
      ctx += `- Nenhum deal cadastrado\n`;
    }
    // Deals com previsão próxima
    const proxFech = deals.filter(d=>d.previsao_fechamento).sort((a,b)=>new Date(a.previsao_fechamento)-new Date(b.previsao_fechamento)).slice(0,5);
    if (proxFech.length) {
      ctx += `- Próximos fechamentos previstos:\n`;
      proxFech.forEach(d=>{ ctx += `  - "${d.titulo||"Deal"}" | ${fmtBRL(d.valor)} | ${d.etapa||"—"} | previsão: ${new Date(d.previsao_fechamento).toLocaleDateString("pt-BR")}\n`; });
    }

    ctx += `\n### 🎯 Metas — ${mesNome}\n`;
    ctx += `- Meta total empresa: ${fmtBRL(metaTotal)}\n`;
    ctx += `- Vendas realizadas: ${fmtBRL(vendasTot)} (${pctMeta}% da meta)\n`;
    ctx += `- Falta para bater a meta: ${fmtBRL(Math.max(0, metaTotal-vendasTot))}\n`;
    if (Object.keys(metasMap).length) {
      ctx += `- Por vendedor:\n`;
      Object.values(metasMap).forEach(m=>{
        const p = m.meta>0?Math.round((m.realizado/m.meta)*100):0;
        ctx += `  - ${m.nome}: meta ${fmtBRL(m.meta)} | realizado ${fmtBRL(m.realizado)} | ${p}%\n`;
      });
    }
    if (vendas.length > 0) {
      ctx += `- Últimas vendas registradas:\n`;
      vendas.slice(0,5).forEach(v=>{
        const vend = equipe.find(u=>u.id===v.usuario_id);
        ctx += `  - ${fmtBRL(v.valor)} por ${vend?.nome||"—"} | ${v.descricao||"sem descrição"}\n`;
      });
    }

    ctx += `\n### 👥 Equipe (${equipe.filter(u=>u.ativo!==false).length} ativos)\n`;
    equipe.filter(u=>u.ativo!==false).forEach(u=>{
      ctx += `- ${u.nome} (${u.cargo||"sem cargo"}) — ${u.role||"user"}\n`;
    });

    ctx += `---\n`;
    return ctx;

  } catch(e) {
    console.warn("Erro ao buscar contexto CRM:", e);
    return "";
  }
}

/* ─── Markdown renderer ─── */
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
      listItems.push(<li key={i} style={{ marginBottom: 2, lineHeight: 1.6 }}><MdLine text={trimmed.replace(/^[-•*]\s/, "")}/></li>);
      return;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      numItems.push(<li key={i} style={{ marginBottom: 2, lineHeight: 1.6 }}><MdLine text={trimmed.replace(/^\d+\.\s/, "")}/></li>);
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
];

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins < 1) return "Agora";
  if (mins < 60) return `${mins}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(diff / 86400000);
  if (days === 1) return "Ontem";
  if (days < 7) return `${days} dias atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function PageAI({ user }) {
  const { isMobile } = useBreakpoint();
  const welcome = `Olá, **${user?.nome?.split(" ")[0] || ""}**! Sou o **C4 AI**, powered by Groq · Llama 3.3.\n\nPosso analisar seu funil de vendas, sugerir ações estratégicas, gerar relatórios e identificar oportunidades.\n\nComo posso ajudar hoje?`;

  // Conversas salvas
  const [conversas, setConversas]           = useState([]);
  const [activeConversa, setActiveConversa] = useState(null); // id da conversa ativa
  const [loadingHistorico, setLoadingHistorico] = useState(true);

  // Chat atual
  const [chat, setChat]     = useState([{ role: "assistant", content: welcome }]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState("");
  const [model, setModel]   = useState("");
  const [ctxLoaded, setCtxLoaded] = useState(false);

  // Mobile: mostrar sidebar ou chat
  const [showSidebar, setShowSidebar] = useState(!isMobile);

  const endRef   = useRef(null);
  const inputRef = useRef(null);

  // Carregar lista de conversas do usuário
  const loadConversas = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("ai_conversas")
      .select("id, titulo, updated_at, created_at")
      .eq("usuario_id", user.id)
      .order("updated_at", { ascending: false });
    setConversas(data || []);
    setLoadingHistorico(false);
  }, [user?.id]);

  useEffect(() => { loadConversas(); }, [loadConversas]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, loading]);

  // Abrir conversa existente
  const abrirConversa = async (conv) => {
    setActiveConversa(conv.id);
    setErr(""); setModel("");
    if (isMobile) setShowSidebar(false);

    const { data: msgs } = await supabase
      .from("ai_mensagens")
      .select("role, content, created_at")
      .eq("conversa_id", conv.id)
      .order("created_at", { ascending: true });

    if (msgs && msgs.length > 0) {
      setChat(msgs.map(m => ({ role: m.role, content: m.content })));
    } else {
      setChat([{ role: "assistant", content: welcome }]);
    }
  };

  // Nova conversa
  const novaConversa = () => {
    setActiveConversa(null);
    setChat([{ role: "assistant", content: welcome }]);
    setErr(""); setModel(""); setInput(""); setCtxLoaded(false);
    if (isMobile) setShowSidebar(false);
  };

  // Excluir conversa
  const excluirConversa = async (e, convId) => {
    e.stopPropagation();
    if (!confirm("Excluir esta conversa?")) return;
    await supabase.from("ai_conversas").delete().eq("id", convId);
    if (activeConversa === convId) novaConversa();
    setConversas(p => p.filter(c => c.id !== convId));
  };

  const send = async (txt) => {
    const q = (txt || input).trim();
    if (!q || loading) return;
    setInput(""); setErr("");
    if (isMobile) setShowSidebar(false);

    const userMsg = { role: "user", content: q };
    const history = [...chat, userMsg];
    setChat(history);
    setLoading(true);

    let convId = activeConversa;

    try {
      // Criar conversa nova se não existe
      if (!convId) {
        const titulo = q.length > 55 ? q.slice(0, 52) + "..." : q;
        const { data: novaConv, error: convErr } = await supabase
          .from("ai_conversas")
          .insert({ usuario_id: user.id, empresa_id: user.empresa_id, titulo })
          .select()
          .single();

        if (!convErr && novaConv) {
          convId = novaConv.id;
          setActiveConversa(convId);
          setConversas(p => [novaConv, ...p]);
        }
      }

      // Salvar mensagem do usuário
      if (convId) {
        await supabase.from("ai_mensagens").insert({ conversa_id: convId, role: "user", content: q });
      }

      // Buscar dados reais do CRM e montar contexto
      const contexto = await buscarContextoCRM(user?.empresa_id);
      if (contexto) setCtxLoaded(true);
      const systemContent = SYSTEM_PROMPT + (contexto ? `\n\n${contexto}` : "");

      // Chamar Groq
      const messages = [
        { role: "system", content: systemContent },
        ...history
          .filter(m => m.role === "user" || m.role === "assistant")
          .map(m => ({ role: m.role, content: m.content })),
      ];

      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.7, max_tokens: 2048 }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "Sem resposta.";
      if (data.model) setModel(data.model);

      setChat(p => [...p, { role: "assistant", content: text }]);

      // Salvar resposta + atualizar updated_at da conversa
      if (convId) {
        await supabase.from("ai_mensagens").insert({ conversa_id: convId, role: "assistant", content: text });
        await supabase.from("ai_conversas").update({ updated_at: new Date().toISOString() }).eq("id", convId);
        // Atualizar lista local
        setConversas(p => p.map(c => c.id === convId ? { ...c, updated_at: new Date().toISOString() } : c));
      }

    } catch (e) {
      setErr(e.message);
      setChat(p => [...p, { role: "assistant", content: `❌ ${e.message}` }]);
    }

    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  /* ── SIDEBAR ── */
  const Sidebar = (
    <div style={{
      width: isMobile ? "100%" : 240, minWidth: isMobile ? undefined : 240,
      background: L.white, borderRight: isMobile ? "none" : `1px solid ${L.line}`,
      display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0,
    }}>
      {/* Header sidebar */}
      <div style={{ padding: "12px 12px 8px", borderBottom: `1px solid ${L.lineSoft}`, flexShrink: 0 }}>
        <button onClick={novaConversa}
          style={{ width: "100%", padding: "9px 12px", borderRadius: 9, background: L.teal, color: "white", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7, justifyContent: "center", transition: "all .12s", boxShadow: `0 3px 10px ${L.teal}30` }}
          onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.08)"}
          onMouseLeave={e => e.currentTarget.style.filter = "none"}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Nova conversa
        </button>
      </div>

      {/* Lista de conversas */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 6px" }}>
        {loadingHistorico ? (
          <div style={{ textAlign: "center", padding: 20, color: L.t4, fontSize: 11 }}>Carregando...</div>
        ) : conversas.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: L.t4 }}>
            <div style={{ fontSize: 22, marginBottom: 8, opacity: .5 }}>✦</div>
            <div style={{ fontSize: 11 }}>Nenhuma conversa ainda</div>
          </div>
        ) : (
          conversas.map(c => {
            const active = c.id === activeConversa;
            return (
              <div key={c.id} onClick={() => abrirConversa(c)}
                style={{ padding: "9px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 2, background: active ? L.tealBg : "transparent", border: `1px solid ${active ? L.teal + "33" : "transparent"}`, transition: "all .12s", position: "relative", group: "conv" }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = L.surface; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? L.teal : L.t2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.4 }}>
                      {c.titulo}
                    </div>
                    <div style={{ fontSize: 10, color: L.t5, marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>
                      {formatDate(c.updated_at)}
                    </div>
                  </div>
                  <button onClick={e => excluirConversa(e, c.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: L.t5, fontSize: 12, padding: "1px 3px", borderRadius: 4, flexShrink: 0, lineHeight: 1, transition: "color .1s", opacity: active ? 1 : 0.4 }}
                    onMouseEnter={e => { e.currentTarget.style.color = L.red; e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = L.t5; e.currentTarget.style.opacity = active ? "1" : "0.4"; }}
                  >⊗</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer com info do modelo */}
      <div style={{ padding: "8px 12px", borderTop: `1px solid ${L.lineSoft}`, flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: L.t5, fontFamily: "'JetBrains Mono',monospace", textAlign: "center" }}>
          Groq · Llama 3.3 70B
        </div>
      </div>
    </div>
  );

  /* ── CHAT AREA ── */
  const ChatArea = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

      {/* Header chat */}
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${L.lineSoft}`, flexShrink: 0, background: `linear-gradient(135deg,${L.tealBg},${L.copperBg})`, display: "flex", alignItems: "center", gap: 10 }}>
        {isMobile && (
          <button onClick={() => setShowSidebar(true)}
            style={{ background: "none", border: `1px solid ${L.line}`, borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: L.t3, fontSize: 12, fontFamily: "inherit" }}>
            ☰
          </button>
        )}
        <div style={{ width: 30, height: 30, borderRadius: 8, background: L.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "white", flexShrink: 0, boxShadow: `0 3px 10px ${L.teal}40` }}>✦</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: L.t1, fontFamily: "'Outfit',sans-serif" }}>
            C4 <span style={{ color: L.teal }}>AI</span>
            {model && <span style={{ fontSize: 9, color: L.t4, fontFamily: "'JetBrains Mono',monospace", marginLeft: 6, fontWeight: 400 }}>{model}</span>}
          </div>
          {activeConversa && (
            <div style={{ fontSize: 10, color: L.t3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {conversas.find(c => c.id === activeConversa)?.titulo || "Conversa ativa"}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          {ctxLoaded && (
            <div style={{ fontSize: 10, color: L.green, background: L.greenBg, border: `1px solid ${L.green}33`, borderRadius: 6, padding: "3px 8px", fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap" }}>
              ● dados do sistema
            </div>
          )}
          {["Análise","Relatório","Sugestão"].map(t => (
            <Tag key={t} color={L.teal} bg={L.tealBg} small>{t}</Tag>
          ))}
        </div>
      </div>

      {/* Sugestões (só quando chat vazio/novo) */}
      {chat.length <= 1 && (
        <div className="hide-mobile" style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "10px 14px 0", flexShrink: 0 }}>
          {SUGS.map(s => (
            <button key={s} onClick={() => send(s)} disabled={loading}
              style={{ padding: "5px 11px", borderRadius: 8, fontSize: 11, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", background: L.white, color: L.t3, border: `1px solid ${L.line}`, transition: "all .12s", whiteSpace: "nowrap" }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = L.teal; e.currentTarget.style.color = L.teal; e.currentTarget.style.background = L.tealBg; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = L.line; e.currentTarget.style.color = L.t3; e.currentTarget.style.background = L.white; }}
            >✦ {s}</button>
          ))}
        </div>
      )}

      {/* Mensagens */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: "12px 14px 8px" }}>
        {chat.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            {m.role === "assistant"
              ? <div style={{ width: 28, height: 28, borderRadius: 8, background: L.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "white", flexShrink: 0, marginTop: 1 }}>✦</div>
              : <Av name={user?.nome || "U"} color={user?.cor || L.copper} size={28} src={user?.foto_url}/>
            }
            <div style={{
              flex: 1, padding: "10px 14px",
              borderRadius: m.role === "assistant" ? "3px 12px 12px 12px" : "12px 3px 12px 12px",
              background: m.role === "assistant" ? L.white : L.tealBg,
              border: `1px solid ${m.role === "assistant" ? L.teal + "22" : L.teal + "33"}`,
              fontSize: 12.5, color: L.t1, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", wordBreak: "break-word",
            }}>
              {m.role === "assistant"
                ? <MdBlock content={m.content}/>
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
                  <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: L.teal, animation: `blink 1.2s ease ${j * .22}s infinite` }}/>
                ))}
                <span style={{ fontSize: 11, color: L.t4, marginLeft: 6 }}>Analisando...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={endRef}/>
      </div>

      {/* Input */}
      <div style={{ padding: "8px 14px 10px", borderTop: `1px solid ${L.lineSoft}`, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8 }}>
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
            style={{ padding: "11px 20px", borderRadius: 10, background: loading || !input.trim() ? L.surface : L.teal, border: "none", color: loading || !input.trim() ? L.t4 : "white", fontWeight: 600, cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontSize: 13, transition: "all .15s", fontFamily: "inherit", boxShadow: !loading && input.trim() ? `0 4px 12px ${L.teal}30` : "none", whiteSpace: "nowrap" }}>
            {loading ? "..." : "Enviar"}
          </button>
        </div>
        <div style={{ textAlign: "center", fontSize: 10, color: L.t5, marginTop: 5 }}>
          Enter para enviar · Shift+Enter para nova linha
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "calc(100dvh - 86px)", minHeight: 400, background: L.bg, borderRadius: 12, overflow: "hidden", border: `1px solid ${L.line}`, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", animation: "in .3s ease" }}>
      {isMobile ? (
        showSidebar ? Sidebar : ChatArea
      ) : (
        <>
          {Sidebar}
          {ChatArea}
        </>
      )}
    </div>
  );
}
