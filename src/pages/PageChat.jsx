import { useState, useEffect, useRef } from "react";
import { L } from "../constants/theme";
import { Av, Row, IBtn } from "../components/ui";
import { supabase } from "../lib/supabase";

const fmtHora = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

export default function PageChat({ user }) {
  const [conversas,   setConversas]   = useState([]);
  const [mensagens,   setMensagens]   = useState([]);
  const [activeConv,  setActiveConv]  = useState(null);
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [busca,       setBusca]       = useState("");
  const [novaModal,   setNovaModal]   = useState(false);
  const [novaForm,    setNovaForm]    = useState({ nome:"", telefone:"", empresa_contato:"" });
  const bottomRef = useRef(null);

  useEffect(() => { loadConversas(); }, [user?.empresa_id]);

  useEffect(() => {
    if (activeConv?.id) loadMensagens(activeConv.id);
  }, [activeConv?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const loadConversas = async () => {
    if (!user?.empresa_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("conversas")
      .select("*")
      .eq("empresa_id", user.empresa_id)
      .order("ultima_hora", { ascending: false });
    const lista = data || [];
    setConversas(lista);
    if (lista.length > 0 && !activeConv) setActiveConv(lista[0]);
    setLoading(false);
  };

  const loadMensagens = async (convId) => {
    const { data } = await supabase
      .from("mensagens")
      .select("*")
      .eq("conversa_id", convId)
      .order("hora", { ascending: true });
    setMensagens(data || []);
    // mark as read
    await supabase.from("conversas").update({ nao_lidas: 0 }).eq("id", convId);
    setConversas(p => p.map(c => c.id === convId ? { ...c, nao_lidas: 0 } : c));
  };

  const selectConv = (c) => {
    setActiveConv(c);
    setMensagens([]);
  };

  const send = async () => {
    if (!input.trim() || !activeConv || sending) return;
    const texto = input.trim();
    setInput("");
    setSending(true);

    const { data: msg } = await supabase.from("mensagens").insert({
      conversa_id: activeConv.id,
      empresa_id: user.empresa_id,
      de: "me",
      texto,
      hora: new Date().toISOString(),
      status: "enviado",
    }).select().single();

    if (msg) setMensagens(p => [...p, msg]);

    const now = new Date().toISOString();
    await supabase.from("conversas").update({ ultima_mensagem: texto, ultima_hora: now }).eq("id", activeConv.id);
    setConversas(p => p.map(c => c.id === activeConv.id ? { ...c, ultima_mensagem: texto, ultima_hora: now } : c));

    // Try WhatsApp API if contact has phone
    if (activeConv.contato_telefone?.trim()) {
      try {
        await supabase.functions.invoke("waba-send", {
          body: { empresa_id: user.empresa_id, phone: activeConv.contato_telefone, message: texto }
        });
      } catch (_) { /* silent – mensagem já salva localmente */ }
    }

    setSending(false);
  };

  const criarConversa = async () => {
    if (!novaForm.nome.trim()) return;
    const { data } = await supabase.from("conversas").insert({
      empresa_id: user.empresa_id,
      contato_nome: novaForm.nome.trim(),
      contato_telefone: novaForm.telefone.trim(),
      contato_empresa: novaForm.empresa_contato.trim(),
      ultima_mensagem: "",
      ultima_hora: new Date().toISOString(),
      nao_lidas: 0,
    }).select().single();
    if (data) {
      setConversas(p => [data, ...p]);
      setActiveConv(data);
      setMensagens([]);
    }
    setNovaModal(false);
    setNovaForm({ nome:"", telefone:"", empresa_contato:"" });
  };

  const filtradas = conversas.filter(c =>
    c.contato_nome?.toLowerCase().includes(busca.toLowerCase()) ||
    c.contato_empresa?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div style={{display:"flex",height:"calc(100vh - 130px)",background:L.white,borderRadius:12,border:`1px solid ${L.line}`,overflow:"hidden",animation:"in .3s ease",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>

      {/* ── LISTA DE CONVERSAS ── */}
      <div style={{width:268,minWidth:268,borderRight:`1px solid ${L.line}`,display:"flex",flexDirection:"column"}}>
        <div style={{padding:"12px 14px",borderBottom:`1px solid ${L.lineSoft}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:600,color:L.t1}}>Conversas</span>
            <button onClick={()=>setNovaModal(true)}
              style={{background:L.tealBg,border:`1px solid ${L.teal}22`,borderRadius:7,padding:"4px 10px",fontSize:11,color:L.teal,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
              + Nova
            </button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7,background:L.surface,border:`1px solid ${L.line}`,borderRadius:8,padding:"5px 10px"}}>
            <span style={{color:L.t4,fontSize:13}}>⌕</span>
            <input value={busca} onChange={e=>setBusca(e.target.value)}
              placeholder="Buscar contato..."
              style={{background:"none",border:"none",outline:"none",color:L.t1,fontSize:12,width:"100%",fontFamily:"inherit"}}/>
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto"}}>
          {loading ? (
            <div style={{padding:24,textAlign:"center",color:L.t4,fontSize:12}}>Carregando...</div>
          ) : filtradas.length === 0 ? (
            <div style={{padding:24,textAlign:"center",color:L.t4}}>
              <div style={{fontSize:28,marginBottom:8}}>◈</div>
              <div style={{fontSize:12,marginBottom:4}}>Nenhuma conversa</div>
              <div style={{fontSize:10,color:L.t5}}>As conversas do WhatsApp aparecerão aqui automaticamente, ou clique em "+ Nova"</div>
            </div>
          ) : filtradas.map(c => (
            <div key={c.id} onClick={()=>selectConv(c)}
              style={{padding:"11px 14px",cursor:"pointer",borderBottom:`1px solid ${L.lineSoft}`,background:activeConv?.id===c.id?L.tealBg:"transparent",borderLeft:`3px solid ${activeConv?.id===c.id?L.teal:"transparent"}`,transition:"all .1s"}}
            >
              <Row gap={9}>
                <div style={{position:"relative",flexShrink:0}}>
                  <Av name={c.contato_nome} color={L.teal} size={36}/>
                  {c.nao_lidas > 0 && (
                    <div style={{position:"absolute",bottom:-1,right:-1,width:10,height:10,borderRadius:"50%",background:L.green,border:`2px solid ${activeConv?.id===c.id?L.tealBg:L.white}`}}/>
                  )}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <Row between>
                    <span style={{fontSize:12.5,fontWeight:c.nao_lidas>0?700:500,color:L.t1}}>{c.contato_nome}</span>
                    <span style={{fontSize:10,color:L.t4}}>{fmtHora(c.ultima_hora)}</span>
                  </Row>
                  <div style={{fontSize:11,color:L.t3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:1}}>
                    {c.contato_empresa && <span style={{color:L.teal,fontSize:10}}>{c.contato_empresa} · </span>}
                    {c.ultima_mensagem||"Sem mensagens"}
                  </div>
                </div>
                {c.nao_lidas > 0 && (
                  <span style={{background:L.teal,borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"white",flexShrink:0}}>{c.nao_lidas}</span>
                )}
              </Row>
            </div>
          ))}
        </div>
      </div>

      {/* ── ÁREA DE MENSAGENS ── */}
      {activeConv ? (
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,background:"#f0f2f5"}}>
          {/* Header da conversa */}
          <div style={{padding:"11px 18px",borderBottom:`1px solid ${L.line}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,background:L.white}}>
            <Row gap={10}>
              <Av name={activeConv.contato_nome} color={L.teal} size={36}/>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:L.t1}}>{activeConv.contato_nome}</div>
                <div style={{fontSize:10,color:L.t3}}>
                  {activeConv.contato_telefone||"Sem telefone"}
                  {activeConv.contato_empresa && ` · ${activeConv.contato_empresa}`}
                </div>
              </div>
            </Row>
            <Row gap={6}>
              {activeConv.contato_telefone && (
                <IBtn c={L.green} onClick={()=>window.open(`https://wa.me/${activeConv.contato_telefone.replace(/\D/g,"")}`)}>
                  ◈ WhatsApp
                </IBtn>
              )}
              <IBtn c={L.t3}>⊞ Perfil</IBtn>
            </Row>
          </div>

          {/* Mensagens */}
          <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:8}}>
            {mensagens.length === 0 && (
              <div style={{textAlign:"center",color:L.t4,fontSize:12,padding:30}}>
                <div style={{fontSize:24,marginBottom:8}}>◈</div>
                <div>Nenhuma mensagem ainda. Inicie a conversa!</div>
              </div>
            )}
            {mensagens.map(m => (
              <div key={m.id} style={{display:"flex",justifyContent:m.de==="me"?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"68%",padding:"10px 14px",borderRadius:m.de==="me"?"12px 12px 3px 12px":"12px 12px 12px 3px",background:m.de==="me"?L.teal:L.white,border:m.de==="me"?"none":`1px solid ${L.line}`,fontSize:12.5,color:m.de==="me"?"white":L.t1,lineHeight:1.55,boxShadow:m.de==="me"?"none":"0 1px 2px rgba(0,0,0,0.06)"}}>
                  {m.texto}
                  <div style={{fontSize:10,marginTop:3,textAlign:"right",color:m.de==="me"?"rgba(255,255,255,0.65)":L.t4}}>
                    {fmtHora(m.hora)}{m.de==="me" && " ✓✓"}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div style={{padding:"12px 18px",borderTop:`1px solid ${L.line}`,display:"flex",gap:8,alignItems:"center",flexShrink:0,background:L.white}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
              placeholder="Digite sua mensagem..."
              style={{flex:1,background:L.surface,border:`1.5px solid ${L.line}`,borderRadius:9,padding:"9px 13px",color:L.t1,fontSize:12.5,fontFamily:"inherit",outline:"none",transition:"border-color .12s"}}
              onFocus={e=>e.target.style.borderColor=L.teal}
              onBlur={e=>e.target.style.borderColor=L.line}
            />
            <button onClick={send} disabled={sending}
              style={{padding:"9px 18px",borderRadius:9,background:L.teal,border:"none",color:"white",fontWeight:600,cursor:sending?"not-allowed":"pointer",fontSize:13,transition:"opacity .12s",boxShadow:`0 4px 10px ${L.teal}30`,opacity:sending?.6:1}}
            >➤</button>
          </div>
        </div>
      ) : (
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#f0f2f5"}}>
          <div style={{textAlign:"center",color:L.t4}}>
            <div style={{fontSize:44,marginBottom:14}}>◈</div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:4,color:L.t2}}>Selecione uma conversa</div>
            <div style={{fontSize:12}}>ou clique em "+ Nova" para iniciar</div>
          </div>
        </div>
      )}

      {/* ── MODAL NOVA CONVERSA ── */}
      {novaModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}
          onClick={()=>setNovaModal(false)}>
          <div style={{background:L.white,borderRadius:14,padding:24,width:400,boxShadow:"0 20px 60px rgba(0,0,0,0.18)"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:14,fontWeight:700,color:L.t1,marginBottom:18}}>Nova Conversa</div>
            {[["Nome do contato *","nome","Ex: Carlos Silva"],["Telefone (WhatsApp)","telefone","55 11 99999-0000"],["Empresa","empresa_contato","Nome da empresa"]].map(([l,k,ph])=>(
              <div key={k} style={{marginBottom:14}}>
                <label style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1.2px",display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace"}}>{l}</label>
                <input value={novaForm[k]} onChange={e=>setNovaForm(p=>({...p,[k]:e.target.value}))}
                  placeholder={ph}
                  style={{width:"100%",background:L.surface,border:`1.5px solid ${L.line}`,borderRadius:9,padding:"9px 12px",color:L.t1,fontSize:12.5,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}
                  onFocus={e=>e.target.style.borderColor=L.teal}
                  onBlur={e=>e.target.style.borderColor=L.line}
                />
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button onClick={()=>setNovaModal(false)}
                style={{flex:1,padding:"9px",borderRadius:9,background:L.surface,border:`1px solid ${L.line}`,color:L.t2,cursor:"pointer",fontFamily:"inherit",fontSize:12.5}}>
                Cancelar
              </button>
              <button onClick={criarConversa}
                style={{flex:2,padding:"9px",borderRadius:9,background:L.teal,border:"none",color:"white",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:12.5,boxShadow:`0 3px 10px ${L.teal}28`}}>
                Criar Conversa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
