import { useState, useRef } from "react";
import { L } from "../constants/theme";
import { Av, Tag } from "../components/ui";
import { supabase } from "../lib/supabase";

export default function PageAI({ user }) {
  const [chat, setChat] = useState([{
    role: "assistant",
    content: `Olá, **${user?.nome || ""}**! Sou o **C4 AI**, powered by Claude. Posso analisar seu funil de vendas, sugerir ações estratégicas, gerar relatórios e identificar oportunidades. Como posso ajudar hoje?`,
  }]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  const sugs = [
    "Analise meu funil de vendas",
    "Gere um relatório semanal",
    "Quais leads devo priorizar?",
    "Como melhorar minha taxa de conversão?",
    "Previsão de receita para os próximos 90 dias",
    "Leads em risco de churn",
  ];

  const send = async (txt) => {
    const q = (txt || input).trim();
    if (!q || loading) return;
    setInput("");

    const userMsg = { role: "user", content: q };
    const newHistory = [...chat, userMsg];
    setChat(newHistory);
    setLoading(true);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      // Map to Anthropic message format — must start with "user"
      const apiMessages = newHistory
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, content: m.content.replace(/\*\*/g, "") }));

      // Anthropic API requires first message to be "user"
      const firstUserIdx = apiMessages.findIndex(m => m.role === "user");
      const trimmedMessages = firstUserIdx > 0 ? apiMessages.slice(firstUserIdx) : apiMessages;

      const { data, error } = await supabase.functions.invoke("c4-ai", {
        body: { messages: trimmedMessages, empresa_id: user?.empresa_id },
      });

      if (error || data?.error) {
        const msg = data?.error || error?.message || "Erro ao conectar com a IA.";
        setChat(p => [...p, { role: "assistant", content: `❌ ${msg}` }]);
      } else {
        setChat(p => [...p, { role: "assistant", content: data.text }]);
      }
    } catch (e) {
      setChat(p => [...p, { role: "assistant", content: `❌ Erro inesperado: ${e.message}` }]);
    }

    setLoading(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 130px)",animation:"in .3s ease"}}>

      {/* ── HEADER ── */}
      <div style={{background:`linear-gradient(135deg,${L.tealBg},${L.copperBg})`,border:`1px solid ${L.teal}22`,borderRadius:12,padding:"16px 20px",marginBottom:16,display:"flex",alignItems:"center",gap:16,flexShrink:0,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
        <div style={{width:44,height:44,borderRadius:12,background:L.teal,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"white",flexShrink:0,boxShadow:`0 4px 12px ${L.teal}40`}}>✦</div>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:L.t1,fontFamily:"'Outfit',sans-serif",letterSpacing:"-.2px"}}>
            C4 <span style={{color:L.teal}}>AI</span>
          </div>
          <div style={{fontSize:11,color:L.t3}}>Powered by Claude · Inteligência de negócios em tempo real</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:6,flexWrap:"wrap"}}>
          {["Análise","Relatório","Sugestão","Previsão"].map(t => (
            <Tag key={t} color={L.teal} bg={L.tealBg} small>{t}</Tag>
          ))}
        </div>
      </div>

      {/* ── SUGESTÕES RÁPIDAS ── */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,flexShrink:0}}>
        {sugs.map(s => (
          <button key={s} onClick={()=>send(s)} disabled={loading}
            style={{padding:"6px 12px",borderRadius:8,fontSize:11.5,cursor:"pointer",fontFamily:"inherit",background:L.white,color:L.t3,border:`1px solid ${L.line}`,transition:"all .12s",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",opacity:loading?.5:1}}
            onMouseEnter={e=>{if(!loading){e.currentTarget.style.borderColor=L.teal;e.currentTarget.style.color=L.teal;e.currentTarget.style.background=L.tealBg;}}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t3;e.currentTarget.style.background=L.white;}}
          >
            ✦ {s}
          </button>
        ))}
      </div>

      {/* ── MENSAGENS ── */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:14,padding:"2px 0"}}>
        {chat.map((m,i) => (
          <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            {m.role==="assistant"
              ? <div style={{width:30,height:30,borderRadius:8,background:L.teal,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"white",flexShrink:0}}>✦</div>
              : <Av name={user?.nome||"U"} color={user?.cor||L.copper} size={30}/>
            }
            <div style={{flex:1,padding:"11px 15px",borderRadius:m.role==="assistant"?"3px 12px 12px 12px":"12px 3px 12px 12px",background:L.white,border:`1px solid ${m.role==="assistant"?L.teal+"22":L.line}`,fontSize:12.5,color:L.t1,lineHeight:1.65,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
              {m.content.split("**").map((p,j) => j%2===0
                ? <span key={j}>{p}</span>
                : <b key={j} style={{color:L.teal,fontWeight:600}}>{p}</b>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <div style={{width:30,height:30,borderRadius:8,background:L.teal,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"white"}}>✦</div>
            <div style={{padding:"13px 18px",background:L.white,border:`1px solid ${L.teal}22`,borderRadius:"3px 12px 12px 12px",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
              <div style={{display:"flex",gap:5}}>
                {[0,1,2].map(i => (
                  <div key={i} style={{width:6,height:6,borderRadius:"50%",background:L.teal,animation:`blink 1.2s ease ${i*.22}s infinite`}}/>
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef}/>
      </div>

      {/* ── INPUT ── */}
      <div style={{display:"flex",gap:8,marginTop:14,flexShrink:0}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Pergunte sobre seus dados, relatórios ou análises..."
          style={{flex:1,background:L.white,border:`1.5px solid ${L.line}`,borderRadius:10,padding:"11px 15px",color:L.t1,fontSize:12.5,fontFamily:"inherit",outline:"none",transition:"border-color .12s",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}
          onFocus={e=>e.target.style.borderColor=L.teal}
          onBlur={e=>e.target.style.borderColor=L.line}
        />
        <button onClick={()=>send()} disabled={loading}
          style={{padding:"11px 20px",borderRadius:10,background:L.teal,border:"none",color:"white",fontWeight:600,cursor:loading?"not-allowed":"pointer",fontSize:13,opacity:loading?.5:1,transition:"opacity .12s",fontFamily:"inherit",boxShadow:`0 4px 12px ${L.teal}30`}}
        >
          {loading ? "..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}
