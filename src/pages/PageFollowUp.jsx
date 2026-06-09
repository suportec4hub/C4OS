import { useState, useEffect } from "react";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { Fade, Row, PBtn, Tag, Av } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const PRIORIDADES = ["Alta","Media","Baixa"];
const CANAIS = ["WhatsApp","Email","Ligação","Reunião","Outro"];
const VAZIO = { titulo:"", descricao:"", canal:"WhatsApp", prioridade:"Media", agendado_para:"", responsavel_id:"", lead_id:"", mensagem_whatsapp:"" };
const PC = { Alta:{c:L.red,bg:L.redBg}, Media:{c:L.yellow,bg:L.yellowBg}, Baixa:{c:L.green,bg:L.greenBg} };

function fmtDt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function isOverdue(iso) {
  return iso && new Date(iso) < new Date();
}

// Retorna string amigável de quando foi a última mensagem recebida
function tempoSemConversa(isoUltima) {
  if (!isoUltima) return null;
  const diff = Date.now() - new Date(isoUltima);
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "agora mesmo";
  if (m < 60)  return `${m}min sem contato`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h sem contato`;
  const d = Math.floor(h / 24);
  return `${d} dia${d > 1 ? "s" : ""} sem contato`;
}

export default function PageFollowUp({ user, onGoToChat }) {
  const [mainTab, setMainTab] = useState("followups");
  const { data: followups, loading, insert, update, remove, refetch } = useTable("follow_ups", { empresa_id: user?.empresa_id });
  const { data: usuarios } = useTable("usuarios", { empresa_id: user?.empresa_id, ativo: true });
  const [leads, setLeads] = useState([]);
  const [ultimasMensagens, setUltimasMensagens] = useState({}); // { [lead_whatsapp]: isoDate }
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [filtro, setFiltro] = useState("pendente");
  const [vendedorFiltro, setVendedorFiltro] = useState("todos");

  useEffect(() => {
    if (!user?.empresa_id) return;
    supabase.from("leads").select("id, nome, whatsapp, status, atribuido_a").eq("empresa_id", user.empresa_id).then(({ data }) => {
      setLeads(data || []);
    });
  }, [user?.empresa_id]);

  // Busca a última mensagem recebida (de="lead") por número, para mostrar "X dias sem contato"
  useEffect(() => {
    if (!user?.empresa_id) return;
    supabase
      .from("mensagens")
      .select("conversa_id, created_at, remetente, conversas!inner(contato_telefone, empresa_id)")
      .eq("conversas.empresa_id", user.empresa_id)
      .in("remetente", ["lead", "cliente", "contato"])
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!data) return;
        const map = {};
        data.forEach(m => {
          const tel = m.conversas?.contato_telefone;
          if (tel && !map[tel]) map[tel] = m.created_at;
        });
        setUltimasMensagens(map);
      });
  }, [user?.empresa_id]);

  const filtered = followups.filter(f => {
    const statusOk = filtro === "todos" || f.status === filtro;
    const vendOk = vendedorFiltro === "todos" || f.responsavel_id === vendedorFiltro;
    return statusOk && vendOk;
  });

  // Agrupar por responsável
  const grouped = {};
  filtered.forEach(f => {
    const key = f.responsavel_id || "__sem_responsavel__";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(f);
  });

  const urgentes = followups.filter(f => f.prioridade === "Alta" && f.status === "pendente").length;
  const vencidos = followups.filter(f => f.status === "pendente" && isOverdue(f.agendado_para)).length;

  const openNew = () => { setForm({ ...VAZIO, agendado_para: new Date(Date.now() + 3600000).toISOString().slice(0,16) }); setEditId(null); setErr(""); setModal(true); };
  const openEdit = (f) => { setForm({ ...VAZIO, ...f, agendado_para: f.agendado_para?.slice(0,16) || "" }); setEditId(f.id); setErr(""); setModal(true); };

  const save = async () => {
    if (!form.titulo.trim()) { setErr("Título obrigatório."); return; }
    if (!form.agendado_para) { setErr("Data/hora obrigatória."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, empresa_id: user?.empresa_id, status: editId ? form.status : "pendente", criado_por: user?.id };
    const { error } = editId ? await update(editId, payload) : await insert(payload);
    if (error) setErr(error.message || "Erro ao salvar.");
    else setModal(false);
    setSaving(false);
  };

  const concluir = async (id) => { await update(id, { status: "concluido", concluido_em: new Date().toISOString() }); };
  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  const getUser = (id) => usuarios.find(u => u.id === id);
  const getLead = (id) => leads.find(l => l.id === id);

  const openWhatsApp = (followup) => {
    const lead = getLead(followup.lead_id);
    const phone = lead?.whatsapp?.replace(/\D/g, "");
    if (!phone) return;
    const msg = followup.mensagem_whatsapp || `Olá ${lead?.nome || ""}! Tudo bem? Passando para dar continuidade no nosso contato. 😊`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const renderCard = (item) => {
    const done   = item.status === "concluido";
    const overdue = !done && isOverdue(item.agendado_para);
    const lead   = getLead(item.lead_id);
    // Calcula tempo sem conversa via última msg recebida do lead no WhatsApp
    const telLimpo = lead?.whatsapp?.replace(/\D/g, "");
    const ultimaMsg = telLimpo ? (ultimasMensagens[telLimpo] || ultimasMensagens["55" + telLimpo]) : null;
    const tsConversa = tempoSemConversa(ultimaMsg);
    const diasSemContato = ultimaMsg ? Math.floor((Date.now() - new Date(ultimaMsg)) / 86400000) : null;
    const alertaSemContato = diasSemContato !== null && diasSemContato >= 3; // alerta se 3+ dias

    return (
      <div key={item.id} style={{ background: L.white, borderRadius: 11, border: `1.5px solid ${done ? L.green + "44" : overdue ? L.red + "44" : L.line}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, opacity: done ? .6 : 1, transition: "all .18s", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        {/* Check */}
        <button onClick={() => !done && concluir(item.id)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: done ? L.green : "transparent", border: `2px solid ${done ? L.green : overdue ? L.red : L.line}`, cursor: done ? "default" : "pointer", color: "white", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .18s" }}>
          {done ? "✓" : ""}
        </button>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: done ? L.t4 : L.t1, textDecoration: done ? "line-through" : "none", marginBottom: 3 }}>{item.titulo}</div>
          <Row gap={8} style={{ flexWrap: "wrap" }}>
            {lead && <span style={{ fontSize: 11, color: L.teal, fontWeight: 500 }}>◎ {lead.nome}</span>}
            {item.descricao && <span style={{ fontSize: 11, color: L.t4 }}>{item.descricao}</span>}
            {overdue && <Tag color={L.red} bg={L.redBg} small>Vencido</Tag>}
            {/* Badge de tempo sem conversa */}
            {tsConversa && !done && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5, background: alertaSemContato ? L.redBg : L.yellowBg, color: alertaSemContato ? L.red : L.yellow, border: `1px solid ${alertaSemContato ? L.redA : L.yellowA}` }}>
                ⏱ {tsConversa}
              </span>
            )}
          </Row>
        </div>

        {/* Meta */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: overdue ? L.red : L.teal, marginBottom: 5, fontFamily: "'JetBrains Mono',monospace" }}>{fmtDt(item.agendado_para)}</div>
          <Row gap={5} style={{ justifyContent: "flex-end" }}>
            <Tag color={PC[item.prioridade]?.c || L.t3} bg={PC[item.prioridade]?.bg || L.surface} small>{item.prioridade}</Tag>
            <Tag color={L.t3} bg={L.surface} small>{item.canal}</Tag>
          </Row>
        </div>

        {/* Ações */}
        <Row gap={4}>
          {/* Botão: ir para conversa interna */}
          {!done && lead?.whatsapp && onGoToChat && (
            <button onClick={() => onGoToChat(item.lead_id)} title="Ver conversa no WhatsApp" style={{ background: L.tealBg, border: `1px solid ${L.tealA}`, cursor: "pointer", color: L.teal, fontSize: 11, padding: "4px 8px", borderRadius: 6, transition: "all .1s", fontWeight: 700, whiteSpace: "nowrap" }}>
              💬 Chat
            </button>
          )}
          {/* Botão: abrir WhatsApp externo */}
          {!done && lead?.whatsapp && (
            <button onClick={() => openWhatsApp(item)} title="Abrir no WhatsApp" style={{ background: L.greenBg, border: `1px solid ${L.greenA}`, cursor: "pointer", color: L.green, fontSize: 13, padding: "4px 8px", borderRadius: 6, transition: "all .1s", fontWeight: 700 }}>📱</button>
          )}
          {!done && (
            <>
              <button onClick={() => openEdit(item)} style={{ background: "none", border: "none", cursor: "pointer", color: L.t4, fontSize: 13, padding: "3px 6px", borderRadius: 5, transition: "color .1s" }} onMouseEnter={e => e.currentTarget.style.color = L.teal} onMouseLeave={e => e.currentTarget.style.color = L.t4}>✎</button>
              <button onClick={() => { if (confirm("Excluir?")) remove(item.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: L.t4, fontSize: 13, padding: "3px 6px", borderRadius: 5, transition: "color .1s" }} onMouseEnter={e => e.currentTarget.style.color = L.red} onMouseLeave={e => e.currentTarget.style.color = L.t4}>⊗</button>
            </>
          )}
        </Row>
      </div>
    );
  };

  return (
    <Fade>
      {/* Tabs principais */}
      <div style={{ display:"flex", gap:4, marginBottom:20, background:L.surface, padding:4, borderRadius:9, border:`1px solid ${L.line}`, width:"fit-content" }}>
        {[["followups","📋 Follow-ups"],["sequencias","🔄 Sequências Automáticas"]].map(([t,l]) => (
          <button key={t} onClick={() => setMainTab(t)}
            style={{ padding:"7px 18px", borderRadius:7, fontSize:12.5, fontWeight:mainTab===t?600:400, cursor:"pointer", fontFamily:"inherit",
              background:mainTab===t?L.white:L.surface, color:mainTab===t?L.teal:L.t3, border:"none", transition:"all .12s",
              boxShadow:mainTab===t?"0 1px 3px rgba(0,0,0,0.07)":"none" }}>
            {l}
          </button>
        ))}
      </div>

      {mainTab === "sequencias" && <TabSequencias user={user} />}

      {mainTab === "followups" && <>
      {/* Alertas */}
      {(urgentes > 0 || vencidos > 0) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          {urgentes > 0 && <div style={{ padding: "8px 14px", background: L.redBg, border: `1px solid ${L.redA2}`, borderRadius: 8, fontSize: 12, color: L.red, fontWeight: 600 }}>⚡ {urgentes} urgentes</div>}
          {vencidos > 0 && <div style={{ padding: "8px 14px", background: L.yellowBg, border: `1px solid ${L.yellowA2}`, borderRadius: 8, fontSize: 12, color: L.yellow, fontWeight: 600 }}>⏰ {vencidos} vencidos</div>}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:14 }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["pendente", "concluido", "todos"].map(s => (
            <button key={s} onClick={() => setFiltro(s)} style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: filtro === s ? 600 : 400, cursor: "pointer", fontFamily: "inherit", background: filtro === s ? L.white : L.surface, color: filtro === s ? L.teal : L.t3, border: `1.5px solid ${filtro === s ? L.teal + "44" : L.line}`, transition: "all .12s" }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <select value={vendedorFiltro} onChange={e => setVendedorFiltro(e.target.value)} style={{ padding: "6px 10px", borderRadius: 7, fontSize: 12, border: `1.5px solid ${L.line}`, background: L.white, color: L.t2, fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
            <option value="todos">Todos vendedores</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <PBtn onClick={openNew}>+ Novo Follow-up</PBtn>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: L.t4 }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: L.t3 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◷</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Nenhum follow-up {filtro !== "todos" ? filtro : ""}</div>
          <div style={{ fontSize: 12, color: L.t4, marginBottom: 20 }}>Crie um follow-up e vincule a um lead para acompanhar contatos</div>
          <PBtn onClick={openNew}>+ Criar Follow-up</PBtn>
        </div>
      ) : vendedorFiltro !== "todos" ? (
        // Visão flat quando filtrando por vendedor
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(renderCard)}
        </div>
      ) : (
        // Visão agrupada por vendedor
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {Object.entries(grouped).map(([vendId, items]) => {
            const vend = getUser(vendId);
            return (
              <div key={vendId}>
                <Row gap={8} mb={8}>
                  {vend ? <Av name={vend.nome} color={L.teal} size={24} /> : <div style={{ width: 24, height: 24, borderRadius: 6, background: L.surface, border: `1px solid ${L.line}` }} />}
                  <span style={{ fontSize: 12, fontWeight: 700, color: L.t2 }}>{vend ? vend.nome : "Sem responsável"}</span>
                  <Tag color={L.t4} bg={L.surface} small>{items.length}</Tag>
                </Row>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 32 }}>
                  {items.map(renderCard)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal title={editId ? "Editar Follow-up" : "Novo Follow-up"} onClose={() => setModal(false)} width={520}>
          <Field label="Título *"><Input value={form.titulo} onChange={F("titulo")} placeholder="Ex: Enviar proposta revisada" /></Field>

          <div className="form-grid">
            <Field label="Lead vinculado">
              <Select value={form.lead_id} onChange={F("lead_id")}>
                <option value="">— nenhum —</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </Select>
            </Field>
            <Field label="Responsável">
              <Select value={form.responsavel_id} onChange={F("responsavel_id")}>
                <option value="">— atribuir —</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </Select>
            </Field>
            <Field label="Data e Hora *">
              <input type="datetime-local" value={form.agendado_para} onChange={e => F("agendado_para")(e.target.value)} style={{ width: "100%", background: L.surface, border: `1.5px solid ${L.line}`, borderRadius: 9, padding: "9px 12px", color: L.t1, fontSize: 12.5, fontFamily: "inherit", outline: "none" }} onFocus={e => e.target.style.borderColor = L.teal} onBlur={e => e.target.style.borderColor = L.line} />
            </Field>
            <Field label="Canal">
              <Select value={form.canal} onChange={F("canal")}>
                {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Prioridade">
              <Select value={form.prioridade} onChange={F("prioridade")}>
                {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Descrição"><Input value={form.descricao} onChange={F("descricao")} placeholder="Detalhes opcionais" /></Field>

          {form.canal === "WhatsApp" && (
            <Field label="Mensagem WhatsApp (pré-preenchida)">
              <textarea value={form.mensagem_whatsapp} onChange={e => F("mensagem_whatsapp")(e.target.value)} rows={2} placeholder={`Olá! Passando para dar continuidade...`} style={{ width: "100%", background: L.surface, border: `1.5px solid ${L.line}`, borderRadius: 9, padding: "9px 12px", color: L.t1, fontSize: 12.5, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
            </Field>
          )}

          {err && <div style={{ padding: "8px 12px", background: L.redBg, border: `1px solid ${L.redA}`, borderRadius: 8, fontSize: 12, color: L.red, marginBottom: 4 }}>{err}</div>}
          <ModalFooter onClose={() => setModal(false)} onSave={save} loading={saving} label={editId ? "Salvar" : "Criar Follow-up"} />
        </Modal>
      )}
      </>}
    </Fade>
  );
}

/* ─── Aba Sequências Automáticas ────────────────────────────────────────────── */
function TabSequencias({ user }) {
  const [sequencias, setSequencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editSeq, setEditSeq] = useState(null);
  const [form, setForm] = useState({ nome:"", descricao:"", gatilho:"sem_resposta", horas_espera:24, ativo:true });
  const [passos, setPassos] = useState([{ delay_horas:24, mensagem:"", ativo:true }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [execucoes, setExecucoes] = useState([]);

  const load = async () => {
    if (!user?.empresa_id) return;
    setLoading(true);
    const [{ data: seqs }, { data: execs }] = await Promise.all([
      supabase.from("followup_sequencias").select("*, followup_passos(*)").eq("empresa_id", user.empresa_id).order("created_at", { ascending: false }),
      supabase.from("followup_execucoes").select("*, followup_sequencias(nome)").eq("empresa_id", user.empresa_id).eq("status", "ativo").order("proximo_envio"),
    ]);
    setSequencias(seqs || []);
    setExecucoes(execs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.empresa_id]);

  const openNew = () => {
    setEditSeq(null);
    setForm({ nome:"", descricao:"", gatilho:"sem_resposta", horas_espera:24, ativo:true });
    setPassos([{ delay_horas:24, mensagem:"", ativo:true }]);
    setErr(""); setModal(true);
  };

  const openEdit = (seq) => {
    setEditSeq(seq.id);
    setForm({ nome: seq.nome, descricao: seq.descricao||"", gatilho: seq.gatilho, horas_espera: seq.horas_espera, ativo: seq.ativo });
    setPassos((seq.followup_passos || []).sort((a,b) => a.ordem - b.ordem).map(p => ({ id: p.id, delay_horas: p.delay_horas, mensagem: p.mensagem, ativo: p.ativo })));
    setErr(""); setModal(true);
  };

  const save = async () => {
    if (!form.nome.trim()) { setErr("Nome obrigatório."); return; }
    if (passos.length === 0) { setErr("Adicione pelo menos um passo."); return; }
    if (passos.some(p => !p.mensagem.trim())) { setErr("Preencha a mensagem de todos os passos."); return; }
    setSaving(true); setErr("");
    try {
      let seqId = editSeq;
      if (editSeq) {
        await supabase.from("followup_sequencias").update({ ...form }).eq("id", editSeq);
        await supabase.from("followup_passos").delete().eq("sequencia_id", editSeq);
      } else {
        const { data } = await supabase.from("followup_sequencias").insert({ ...form, empresa_id: user.empresa_id }).select().single();
        seqId = data.id;
      }
      await supabase.from("followup_passos").insert(
        passos.map((p, i) => ({ sequencia_id: seqId, ordem: i, delay_horas: p.delay_horas, mensagem: p.mensagem, ativo: p.ativo }))
      );
      setModal(false); load();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const toggleAtivo = async (seq) => {
    await supabase.from("followup_sequencias").update({ ativo: !seq.ativo }).eq("id", seq.id);
    setSequencias(p => p.map(s => s.id === seq.id ? { ...s, ativo: !s.ativo } : s));
  };

  const del = async (id) => {
    if (!window.confirm("Excluir sequência e todos os seus passos?")) return;
    await supabase.from("followup_sequencias").delete().eq("id", id);
    load();
  };

  const GATILHOS = [
    { id:"sem_resposta", label:"📭 Sem resposta do lead" },
    { id:"lead_criado",  label:"🆕 Lead recém criado" },
    { id:"manual",       label:"▶ Ativação manual" },
  ];

  const inStyle = { width:"100%", border:`1px solid ${L.line}`, borderRadius:8, padding:"8px 12px",
    fontSize:12, outline:"none", fontFamily:"inherit", boxSizing:"border-box", background:L.surface, color:L.t1 };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:L.t1 }}>Sequências Automáticas</div>
          <div style={{ fontSize:11, color:L.t3, marginTop:2 }}>Mensagens enviadas automaticamente quando leads ficam sem resposta</div>
        </div>
        <button onClick={openNew} style={{ background:L.accent, color:"white", border:"none", borderRadius:8, padding:"8px 16px", fontSize:12, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
          + Nova Sequência
        </button>
      </div>

      {/* Execuções ativas */}
      {execucoes.length > 0 && (
        <div style={{ background:L.blueBg, borderRadius:10, border:`1px solid ${L.blueA||L.line}`, padding:"12px 16px", marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:L.blue, marginBottom:8 }}>▶ {execucoes.length} sequência(s) em execução</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {execucoes.slice(0,5).map(e => (
              <div key={e.id} style={{ fontSize:11, color:L.t2, display:"flex", justifyContent:"space-between" }}>
                <span>{e.followup_sequencias?.nome} · Passo {e.passo_atual + 1}</span>
                <span style={{ color:L.t4 }}>Próximo: {e.proximo_envio ? new Date(e.proximo_envio).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:L.t4 }}>Carregando...</div>
      ) : sequencias.length === 0 ? (
        <div style={{ textAlign:"center", padding:60, color:L.t4 }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🔄</div>
          <div style={{ fontSize:14, fontWeight:600 }}>Nenhuma sequência criada</div>
          <div style={{ fontSize:12, marginTop:4 }}>Crie sequências para fazer follow-up automático com leads</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {sequencias.map(seq => (
            <div key={seq.id} style={{ background:L.white, borderRadius:12, border:`1px solid ${L.line}`, padding:"14px 18px", opacity:seq.ativo?1:0.6 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:L.t1 }}>{seq.nome}</div>
                  <div style={{ fontSize:11, color:L.t3, marginTop:2 }}>
                    {GATILHOS.find(g=>g.id===seq.gatilho)?.label} · {seq.horas_espera}h de espera · {(seq.followup_passos||[]).length} passo(s)
                  </div>
                  {seq.descricao && <div style={{ fontSize:11, color:L.t4, marginTop:2 }}>{seq.descricao}</div>}
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <button onClick={() => toggleAtivo(seq)}
                    style={{ fontSize:11, padding:"4px 12px", borderRadius:6, cursor:"pointer", fontFamily:"inherit", fontWeight:600, border:"none",
                      background:seq.ativo?L.greenBg:L.surface, color:seq.ativo?L.green:L.t3 }}>
                    {seq.ativo?"● Ativo":"○ Inativo"}
                  </button>
                  <button onClick={() => openEdit(seq)}
                    style={{ fontSize:11, padding:"4px 10px", borderRadius:6, cursor:"pointer", fontFamily:"inherit", border:`1px solid ${L.line}`, background:L.surface, color:L.t2 }}>
                    ✎ Editar
                  </button>
                  <button onClick={() => del(seq.id)}
                    style={{ fontSize:11, padding:"4px 10px", borderRadius:6, cursor:"pointer", fontFamily:"inherit", border:`1px solid ${L.redA||L.line}`, background:L.redBg, color:L.red }}>
                    🗑
                  </button>
                </div>
              </div>
              {/* Passos */}
              {(seq.followup_passos||[]).sort((a,b)=>a.ordem-b.ordem).map((p,i) => (
                <div key={p.id} style={{ marginTop:8, paddingLeft:16, borderLeft:`2px solid ${L.line}`, marginLeft:8 }}>
                  <div style={{ fontSize:10, color:L.t4, fontWeight:600 }}>Passo {i+1} — {i===0?"imediato após ativação":`${p.delay_horas}h após passo ${i}`}</div>
                  <div style={{ fontSize:11, color:L.t2, marginTop:2, whiteSpace:"pre-wrap" }}>{p.mensagem}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={() => setModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:L.white, borderRadius:14, padding:24, width:560, maxHeight:"90vh", overflowY:"auto",
              boxShadow:"0 8px 40px rgba(0,0,0,.18)" }}>
            <div style={{ fontSize:15, fontWeight:700, color:L.t1, marginBottom:16 }}>
              {editSeq ? "Editar Sequência" : "Nova Sequência"}
            </div>

            <label style={{ fontSize:11, color:L.t3, display:"block", marginBottom:4 }}>Nome *</label>
            <input value={form.nome} onChange={e => setForm(p=>({...p,nome:e.target.value}))} placeholder="Ex: Follow-up Leads Frios"
              style={{ ...inStyle, marginBottom:12 }} />

            <label style={{ fontSize:11, color:L.t3, display:"block", marginBottom:4 }}>Gatilho de ativação</label>
            <select value={form.gatilho} onChange={e => setForm(p=>({...p,gatilho:e.target.value}))} style={{ ...inStyle, marginBottom:12 }}>
              {GATILHOS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>

            <label style={{ fontSize:11, color:L.t3, display:"block", marginBottom:4 }}>Horas de espera antes de iniciar</label>
            <input type="number" min={1} value={form.horas_espera} onChange={e => setForm(p=>({...p,horas_espera:parseInt(e.target.value)||24}))}
              style={{ ...inStyle, marginBottom:12 }} />

            <label style={{ fontSize:11, color:L.t3, display:"block", marginBottom:4 }}>Descrição (opcional)</label>
            <input value={form.descricao} onChange={e => setForm(p=>({...p,descricao:e.target.value}))} placeholder="Para que serve esta sequência?"
              style={{ ...inStyle, marginBottom:16 }} />

            {/* Passos */}
            <div style={{ fontSize:12, fontWeight:700, color:L.t1, marginBottom:10 }}>Mensagens da sequência</div>
            {passos.map((p, i) => (
              <div key={i} style={{ background:L.surface, borderRadius:8, border:`1px solid ${L.line}`, padding:"12px 14px", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:L.t2 }}>
                    Passo {i+1} {i===0?"(imediato)":`(+${p.delay_horas}h após passo ${i})`}
                  </span>
                  {passos.length > 1 && (
                    <button onClick={() => setPassos(pp => pp.filter((_,j)=>j!==i))}
                      style={{ background:"none", border:"none", cursor:"pointer", color:L.red, fontSize:14 }}>×</button>
                  )}
                </div>
                {i > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <label style={{ fontSize:10, color:L.t4 }}>Horas de espera após passo anterior</label>
                    <input type="number" min={1} value={p.delay_horas}
                      onChange={e => setPassos(pp => pp.map((x,j)=>j===i?{...x,delay_horas:parseInt(e.target.value)||24}:x))}
                      style={{ ...inStyle, marginTop:4 }} />
                  </div>
                )}
                <label style={{ fontSize:10, color:L.t4 }}>Mensagem *</label>
                <textarea value={p.mensagem} rows={3} placeholder="Olá {nome}! Passando para retomar nosso contato..."
                  onChange={e => setPassos(pp => pp.map((x,j)=>j===i?{...x,mensagem:e.target.value}:x))}
                  style={{ ...inStyle, resize:"vertical", marginTop:4 }} />
                <div style={{ fontSize:10, color:L.t4, marginTop:4 }}>Variáveis: {"{nome}"} {"{telefone}"} {"{empresa}"}</div>
              </div>
            ))}
            <button onClick={() => setPassos(pp => [...pp, { delay_horas:24, mensagem:"", ativo:true }])}
              style={{ background:L.tealBg, color:L.teal, border:`1px solid ${L.tealA2||L.line}`, borderRadius:7, padding:"7px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit", fontWeight:600, marginBottom:16 }}>
              + Adicionar passo
            </button>

            {err && <div style={{ padding:"8px 12px", background:L.redBg, borderRadius:8, color:L.red, fontSize:11, marginBottom:10 }}>{err}</div>}

            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <button onClick={() => setModal(false)} style={{ padding:"8px 16px", borderRadius:8, fontSize:12, cursor:"pointer", fontFamily:"inherit", background:L.surface, color:L.t2, border:`1px solid ${L.line}` }}>Cancelar</button>
              <button onClick={save} disabled={saving} style={{ padding:"8px 20px", borderRadius:8, fontSize:12, cursor:"pointer", fontFamily:"inherit", background:L.accent, color:"white", border:"none", fontWeight:600, opacity:saving?0.6:1 }}>
                {saving?"Salvando...":"Salvar sequência"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
