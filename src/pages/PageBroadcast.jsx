import { useState, useEffect, useRef } from "react";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { Fade, Row, Tag } from "../components/ui";
import { supabase } from "../lib/supabase";

const SEGMENTOS = ["Todos os Leads","Quentes","Mornos","Frios","Enterprise","Inativos","Follow-up Pendente"];
const VAZIO = { titulo:"", mensagem:"", segmentacao:[], agendado_para:"" };

const ST = {
  rascunho:  { c: L.t3,     bg: L.surface  },
  agendado:  { c: L.yellow, bg: L.yellowBg },
  enviando:  { c: L.blue,   bg: L.blueBg   },
  concluido: { c: L.green,  bg: L.greenBg  },
  cancelado: { c: L.red,    bg: L.redBg    },
};

export default function PageBroadcast({ user }) {
  const { data: campanhas, loading, insert, update, refetch } = useTable("campanhas", { empresa_id: user?.empresa_id });
  const [tab, setTab]       = useState("nova");
  const [form, setForm]     = useState(VAZIO);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");
  const [succ, setSucc]     = useState("");
  const [leadCount, setLeadCount]   = useState(null);
  const [sending, setSending]       = useState(false); // campanha sendo enviada
  const [sendingId, setSendingId]   = useState(null);  // id da campanha em envio
  const [progress, setProgress]     = useState(null);  // { enviados, total }
  const pollRef = useRef(null);

  // Conta leads quando segmentação muda
  useEffect(() => {
    if (!user?.empresa_id) return;
    let q = supabase.from("leads").select("id", { count: "exact", head: true }).eq("empresa_id", user.empresa_id);
    if (!form.segmentacao.includes("Todos os Leads") && form.segmentacao.length > 0) {
      const MAPA = { "Quentes":"quente","Mornos":"morno","Frios":"frio","Enterprise":"enterprise","Inativos":"inativo","Follow-up Pendente":"followup" };
      const scores = form.segmentacao.map(s => MAPA[s]).filter(Boolean);
      if (scores.length > 0) q = q.in("temperatura", scores);
    }
    q.then(({ count }) => setLeadCount(count ?? 0));
  }, [form.segmentacao, user?.empresa_id]);

  // Poll progresso enquanto campanha está enviando
  useEffect(() => {
    if (!sendingId) { clearInterval(pollRef.current); return; }
    pollRef.current = setInterval(async () => {
      const { data } = await supabase.from("campanhas").select("enviados, total_contatos, status").eq("id", sendingId).single();
      if (data) {
        setProgress({ enviados: data.enviados, total: data.total_contatos });
        refetch();
        if (data.status !== "enviando") {
          setSending(false);
          setSendingId(null);
          clearInterval(pollRef.current);
          setSucc("Campanha enviada com sucesso! ✓");
          setTimeout(() => setSucc(""), 4000);
        }
      }
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [sendingId, refetch]);

  const toggleSeg = (s) => setForm(p => ({
    ...p,
    segmentacao: p.segmentacao.includes(s)
      ? p.segmentacao.filter(x => x !== s)
      : [...p.segmentacao, s]
  }));

  const salvarRascunho = async () => {
    if (!form.titulo.trim()) { setErr("Nome da campanha obrigatório."); return; }
    if (!form.mensagem.trim()) { setErr("Mensagem obrigatória."); return; }
    setSaving(true); setErr(""); setSucc("");
    const payload = {
      ...form, empresa_id: user?.empresa_id, status: "rascunho",
      agendado_para: form.agendado_para || null,
      total_contatos: leadCount || 0, enviados: 0, entregues: 0, lidos: 0, respostas: 0
    };
    const { error } = await insert(payload);
    if (error) setErr(error.message || "Erro ao salvar.");
    else { setSucc("Rascunho salvo!"); setForm(VAZIO); setTab("hist"); }
    setSaving(false);
  };

  const enviarAgora = async () => {
    if (!form.titulo.trim()) { setErr("Nome da campanha obrigatório."); return; }
    if (!form.mensagem.trim()) { setErr("Mensagem obrigatória."); return; }
    if (!form.segmentacao.length) { setErr("Selecione ao menos um segmento."); return; }
    setSaving(true); setErr(""); setSucc("");

    // Cria a campanha com status "enviando"
    const payload = {
      ...form, empresa_id: user?.empresa_id, status: "enviando",
      agendado_para: form.agendado_para || null,
      total_contatos: leadCount || 0, enviados: 0, entregues: 0, lidos: 0, respostas: 0
    };
    const { data: camp, error: insErr } = await insert(payload);
    if (insErr || !camp) { setErr(insErr?.message || "Erro ao criar campanha."); setSaving(false); return; }

    setSaving(false);
    setSending(true);
    setSendingId(camp.id);
    setForm(VAZIO);
    setTab("hist");
    setSucc("Campanha iniciada! Enviando mensagens...");

    // Dispara a edge function broadcast-send
    supabase.functions.invoke("broadcast-send", {
      body: { campanha_id: camp.id, empresa_id: user?.empresa_id }
    }).then(({ error: fnErr }) => {
      if (fnErr) {
        setErr("Erro ao enviar: " + (fnErr.message || "verifique os logs."));
        setSending(false);
        setSendingId(null);
      }
    }).catch(e => {
      setErr("Erro ao enviar: " + e.message);
      setSending(false);
      setSendingId(null);
    });
  };

  // Enviar campanha existente (rascunho)
  const enviarCampanhaExistente = async (campanha) => {
    setSending(true);
    setSendingId(campanha.id);
    await update(campanha.id, { status: "enviando" });
    supabase.functions.invoke("broadcast-send", {
      body: { campanha_id: campanha.id, empresa_id: user?.empresa_id }
    }).catch(() => {});
  };

  const cancelar = async (id) => {
    await update(id, { status: "cancelado" });
  };

  return (
    <Fade>
      <div style={{ display:"flex", gap:4, marginBottom:20, background:L.surface, padding:4, borderRadius:9, border:`1px solid ${L.line}`, width:"fit-content" }}>
        {[["nova","◉ Nova Campanha"],["hist","≡ Histórico"]].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:"7px 18px", borderRadius:7, fontSize:12.5, fontWeight:tab===t?600:400, cursor:"pointer", fontFamily:"inherit", background:tab===t?L.white:L.surface, color:tab===t?L.teal:L.t3, border:"none", transition:"all .12s", boxShadow:tab===t?"0 1px 3px rgba(0,0,0,0.07)":"none" }}>
            {l}
          </button>
        ))}
      </div>

      {tab === "nova" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          {/* Configurar */}
          <div style={{ background:L.white, borderRadius:12, border:`1px solid ${L.line}`, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize:13, fontWeight:700, color:L.t1, marginBottom:18 }}>⚙ Configurar Campanha</div>

            <Field label="Nome da campanha *">
              <input value={form.titulo} onChange={e => setForm(p => ({...p, titulo:e.target.value}))}
                placeholder="Ex: Promoção Maio 2025"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor=L.teal} onBlur={e => e.target.style.borderColor=L.line}/>
            </Field>

            <div style={{ marginBottom:14 }}>
              <label style={labelStyle}>Segmentação</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
                {SEGMENTOS.map(s => {
                  const sel = form.segmentacao.includes(s);
                  return (
                    <button key={s} onClick={() => toggleSeg(s)}
                      style={{ padding:"4px 11px", borderRadius:6, fontSize:11, cursor:"pointer", fontFamily:"inherit", background:sel?L.tealBg:L.surface, color:sel?L.teal:L.t3, border:`1.5px solid ${sel?L.teal+"44":L.line}`, transition:"all .1s", fontWeight:sel?600:400 }}>
                      {sel ? "✓ " : ""}{s}
                    </button>
                  );
                })}
              </div>
              {leadCount !== null && (
                <div style={{ fontSize:11, color:L.teal, marginTop:8, fontWeight:600 }}>
                  📊 {leadCount.toLocaleString()} contatos alcançados com esta segmentação
                </div>
              )}
            </div>

            <Field label="Agendamento (opcional)">
              <input type="datetime-local" value={form.agendado_para}
                onChange={e => setForm(p => ({...p, agendado_para:e.target.value}))}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor=L.teal} onBlur={e => e.target.style.borderColor=L.line}/>
            </Field>

            <Field label="Mensagem *">
              <textarea value={form.mensagem} onChange={e => setForm(p => ({...p, mensagem:e.target.value}))}
                placeholder={"Olá {nome}! Temos uma oferta especial para você..."}
                rows={5}
                style={{ ...inputStyle, resize:"vertical" }}
                onFocus={e => e.target.style.borderColor=L.teal} onBlur={e => e.target.style.borderColor=L.line}/>
              <div style={{ fontSize:10, color:L.t4, marginTop:4 }}>
                {form.mensagem.length}/1000 · variáveis: {"{nome}"} {"{empresa}"}
              </div>
            </Field>

            {err  && <div style={{ padding:"8px 12px", background:L.redBg,   borderRadius:8, fontSize:12, color:L.red,   marginBottom:12 }}>{err}</div>}
            {succ && <div style={{ padding:"8px 12px", background:L.greenBg, borderRadius:8, fontSize:12, color:L.green, marginBottom:12 }}>{succ}</div>}

            <div style={{ display:"flex", gap:8 }}>
              <button onClick={salvarRascunho} disabled={saving}
                style={{ flex:1, padding:"10px", borderRadius:9, background:L.surface, border:`1px solid ${L.line}`, color:L.t2, cursor:"pointer", fontFamily:"inherit", fontWeight:500, fontSize:12.5 }}>
                Salvar rascunho
              </button>
              <button onClick={enviarAgora} disabled={saving || sending}
                style={{ flex:2, padding:"10px", borderRadius:9, background:sending?L.surface:L.teal, border:"none", color:sending?L.t3:"white", cursor:(saving||sending)?"not-allowed":"pointer", fontFamily:"inherit", fontWeight:600, fontSize:12.5, boxShadow:sending?"none":`0 3px 10px ${L.teal}28` }}>
                {saving ? "Criando..." : sending ? "⟳ Enviando..." : "▶ Enviar Agora"}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div style={{ background:L.white, borderRadius:12, border:`1px solid ${L.line}`, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize:13, fontWeight:700, color:L.t1, marginBottom:16 }}>Preview WhatsApp</div>
            <div style={{ background:"#dfe7dd", borderRadius:10, padding:16, minHeight:180, marginBottom:16 }}>
              {form.mensagem ? (
                <div style={{ background:"white", borderRadius:"12px 12px 12px 3px", padding:"10px 14px", maxWidth:"82%", fontSize:12.5, color:L.t1, lineHeight:1.55, boxShadow:"0 1px 3px rgba(0,0,0,0.12)", wordBreak:"break-word" }}>
                  <div style={{ whiteSpace:"pre-wrap" }}>{form.mensagem}</div>
                  <div style={{ fontSize:10, color:"#6a8a72", textAlign:"right", marginTop:4 }}>agora ✓✓</div>
                </div>
              ) : (
                <div style={{ color:"#8aaa8e", fontSize:12, fontStyle:"italic", textAlign:"center", paddingTop:40 }}>Sua mensagem aparecerá aqui...</div>
              )}
            </div>

            <div style={{ padding:14, background:L.surface, borderRadius:10, border:`1px solid ${L.line}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:L.t2, marginBottom:10 }}>Estimativa de alcance</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  ["Segmentos",    form.segmentacao.length || 0],
                  ["Contatos",     leadCount !== null ? leadCount.toLocaleString() : "—"],
                  ["Taxa entrega", "~97%"],
                  ["Taxa resposta","~15%"],
                ].map(([k, v]) => (
                  <div key={k} style={{ textAlign:"center", padding:"10px", background:L.white, borderRadius:8, border:`1px solid ${L.line}` }}>
                    <div style={{ fontSize:17, fontWeight:700, color:L.teal, fontFamily:"'Outfit',sans-serif" }}>{v}</div>
                    <div style={{ fontSize:10, color:L.t3, marginTop:2 }}>{k}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Aviso de intervalo */}
            <div style={{ marginTop:12, padding:"8px 12px", background:"#fffbf0", border:`1px solid ${L.yellow}44`, borderRadius:8, fontSize:11.5, color:"#a37000" }}>
              ⚠️ <b>Intervalo de 1,5s</b> entre mensagens para evitar bloqueio do WhatsApp.
            </div>
          </div>
        </div>
      )}

      {tab === "hist" && (
        loading ? (
          <div style={{ textAlign:"center", padding:40, color:L.t4 }}>Carregando...</div>
        ) : campanhas.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, color:L.t3 }}>
            <div style={{ fontSize:32, marginBottom:12 }}>◉</div>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>Nenhuma campanha ainda</div>
            <button onClick={() => setTab("nova")} style={{ padding:"9px 18px", borderRadius:9, background:L.teal, color:"white", border:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:600, marginTop:8 }}>
              Criar primeira campanha
            </button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {err  && <div style={{ padding:"8px 12px", background:L.redBg,   borderRadius:8, fontSize:12, color:L.red   }}>{err}</div>}
            {succ && <div style={{ padding:"8px 12px", background:L.greenBg, borderRadius:8, fontSize:12, color:L.green }}>{succ}</div>}

            {campanhas.map(c => {
              const isThisSending = c.status === "enviando";
              const progressPct = isThisSending && c.total_contatos > 0
                ? Math.round((c.enviados / c.total_contatos) * 100)
                : null;

              return (
                <div key={c.id} style={{ background:L.white, borderRadius:12, border:`1px solid ${c.id===sendingId?L.teal:L.line}`, padding:"16px 18px", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
                  <Row between mb={10}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:L.t1 }}>{c.titulo}</div>
                      <div style={{ fontSize:11, color:L.t4, marginTop:2 }}>
                        {c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—"}
                        {c.segmentacao?.length > 0 && ` · ${c.segmentacao.join(", ")}`}
                      </div>
                    </div>
                    <Row gap={8}>
                      <Tag color={ST[c.status]?.c||L.t3} bg={ST[c.status]?.bg||L.surface}>{c.status}</Tag>
                      {c.status === "rascunho" && (
                        <button onClick={() => enviarCampanhaExistente(c)}
                          style={{ fontSize:11, color:"white", background:L.teal, border:"none", borderRadius:6, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                          ▶ Enviar
                        </button>
                      )}
                      {(c.status === "agendado" || c.status === "rascunho") && (
                        <button onClick={() => { if(confirm("Cancelar campanha?")) cancelar(c.id); }}
                          style={{ fontSize:11, color:L.red, background:"none", border:`1px solid ${L.red}22`, borderRadius:6, padding:"3px 8px", cursor:"pointer", fontFamily:"inherit" }}>
                          Cancelar
                        </button>
                      )}
                    </Row>
                  </Row>

                  {/* Barra de progresso para campanhas enviando */}
                  {isThisSending && c.total_contatos > 0 && (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:L.t3, marginBottom:4 }}>
                        <span>⟳ Enviando... {c.enviados}/{c.total_contatos} mensagens</span>
                        <span>{progressPct}%</span>
                      </div>
                      <div style={{ height:5, background:L.surface, borderRadius:3, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${progressPct}%`, background:L.teal, borderRadius:3, transition:"width .5s" }}/>
                      </div>
                    </div>
                  )}

                  <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
                    {[
                      ["📤 Enviados",   c.enviados   || 0],
                      ["✅ Entregues",  c.entregues  || 0],
                      ["👁 Lidos",      c.lidos      || 0],
                      ["💬 Respostas",  c.respostas  || 0],
                      ["👥 Total",      c.total_contatos || 0],
                    ].map(([k, v]) => (
                      <div key={k} style={{ fontSize:11, color:L.t3 }}>{k}: <b style={{ color:L.t1 }}>{v}</b></div>
                    ))}
                  </div>

                  {c.mensagem && (
                    <div style={{ marginTop:10, fontSize:11.5, color:L.t2, background:L.surface, padding:"8px 12px", borderRadius:8, border:`1px solid ${L.line}`, whiteSpace:"pre-wrap" }}>
                      {c.mensagem.length > 120 ? c.mensagem.slice(0,120)+"..." : c.mensagem}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </Fade>
  );
}

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ marginTop:5 }}>{children}</div>
    </div>
  );
}

const labelStyle = { fontSize:10, fontWeight:700, color:L.t3, textTransform:"uppercase", letterSpacing:"1.2px", display:"block", fontFamily:"'JetBrains Mono',monospace" };
const inputStyle = { width:"100%", background:L.surface, border:`1.5px solid ${L.line}`, borderRadius:9, padding:"9px 12px", color:L.t1, fontSize:12.5, fontFamily:"inherit", outline:"none", display:"block", boxSizing:"border-box" };
