import { useState, useEffect } from "react";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { trackLead } from "../lib/analytics";
import { logAction } from "../lib/log";
import { Fade, Row, TabPills, PBtn, DataTable, Av, Tag, ScBar, IBtn, TD } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const STATUS_COLORS = {
  quente: { c: L.red,    bg: L.redBg,    l: "Quente" },
  morno:  { c: L.yellow, bg: L.yellowBg, l: "Morno"  },
  frio:   { c: L.blue,   bg: L.blueBg,   l: "Frio"   },
  novo:   { c: L.teal,   bg: L.tealBg,   l: "Novo"   },
};
// "há 5 min", "há 2 h", "ontem". Saber que o lead chegou agora muda a ação;
// uma data absoluta obriga a pessoa a fazer essa conta de cabeça.
const tempoRelativo = (iso) => {
  if (!iso) return null;
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1)    return "agora";
  if (min < 60)   return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)     return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1)    return "ontem";
  if (d < 30)     return `há ${d} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
};

// Lead novo = status "novo" e chegou nas últimas 24h. Só o status não basta:
// um lead de dois meses que ninguém qualificou continuaria "novo" para sempre.
const ehLeadNovo = (l) => {
  if (l.status !== "novo") return false;
  const ref = l.created_at || l.ultima_atividade;
  if (!ref) return true;
  return (Date.now() - new Date(ref).getTime()) < 24 * 3600 * 1000;
};

// Enquanto o WhatsApp não informa o número, o identificador interno (@lid)
// aparecia cru como nome e telefone. Não é informação para o usuário.
const semNumero = (v) => !v || String(v).includes("@");
const exibirWhats = (v) => semNumero(v) ? "aguardando número" : v;
const exibirNome  = (l) => (l.nome && !String(l.nome).includes("@")) ? l.nome : "Contato sem nome";

const CANAIS = ["WhatsApp","Site","Email","Indicação","Ligação","Instagram","Facebook ADS","Outro"];
const VAZIO  = { nome:"", email:"", whatsapp:"", empresa_nome:"", cargo:"", status:"novo", score:70, origem:"WhatsApp", valor_estimado:"", observacoes:"", atribuido_a:"" };
const PIPE_VAZIO = { lead_id:null, titulo:"", valor:"", etapa:"", empresa_nome:"", whatsapp:"", canal_aquisicao:"", responsavel_id:"" };

export default function PageLeads({ user, onOpenChat }) {
  /* ── lead modal ── */
  const [f, setF]         = useState("Todos");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [edit, setEdit]   = useState(null);
  const [form, setForm]   = useState(VAZIO);
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");

  /* ── pipeline modal ── */
  const [pipeModal, setPipeModal]   = useState(false);
  const [pipeForm, setPipeForm]     = useState(PIPE_VAZIO);
  const [pipeSaving, setPipeSaving] = useState(false);
  const [pipeErr, setPipeErr]       = useState("");

  /* ── whatsapp unread ── */
  const [conversaMap, setConversaMap] = useState({});

  /* ── data ── */
  const { data: leads, loading, insert, update, remove } = useTable("leads", { empresa_id: user?.empresa_id });
  const { data: usuarios } = useTable("usuarios", { empresa_id: user?.empresa_id, ativo: true });
  const { data: etapas }   = useTable("pipeline_etapas", { empresa_id: user?.empresa_id });

  const etapasOrdenadas = [...etapas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const firstEtapa      = etapasOrdenadas[0]?.slug || "novo";

  /* ── fetch unread conversations ── */
  useEffect(() => {
    if (!user?.empresa_id) return;
    supabase
      .from("conversas")
      .select("contato_telefone, nao_lidas, ultima_mensagem_at")
      .eq("empresa_id", user.empresa_id)
      .gt("nao_lidas", 0)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach(c => {
          const phone = (c.contato_telefone || "").replace(/\D/g, "");
          if (phone) map[phone] = c;
        });
        setConversaMap(map);
      });
  }, [user?.empresa_id]);

  /* ── helpers ── */
  // "Novos" é aba própria porque é a que exige ação imediata; as demais
  // continuam filtrando por temperatura.
  const porAba = f === "Todos"  ? leads
               : f === "Novos"  ? leads.filter(ehLeadNovo)
               : leads.filter(l => l.status === f.toLowerCase());

  const termo = busca.trim().toLowerCase();
  const filtered = (termo
    ? porAba.filter(l => [l.nome, l.whatsapp, l.empresa_nome, l.email]
        .some(v => String(v || "").toLowerCase().includes(termo)))
    : porAba
  // Lead novo primeiro: é dele que depende a resposta rápida.
  ).slice().sort((a, b) => {
    const na = ehLeadNovo(a) ? 0 : 1, nb = ehLeadNovo(b) ? 0 : 1;
    if (na !== nb) return na - nb;
    return new Date(b.ultima_atividade || b.created_at || 0) - new Date(a.ultima_atividade || a.created_at || 0);
  });

  const novos24h = leads.filter(ehLeadNovo).length;
  const F  = (k) => (v) => setForm(p => ({ ...p, [k]: v }));
  const PF = (k) => (v) => setPipeForm(p => ({ ...p, [k]: v }));

  const unreadCount = leads.filter(l => {
    const ph = (l.whatsapp || "").replace(/\D/g, "");
    return ph && conversaMap[ph];
  }).length;

  /* ── open lead modal ── */
  const openNew  = () => { setForm(VAZIO); setEdit(null); setErr(""); setModal(true); };
  const openEdit = (l) => { setForm({ ...VAZIO, ...l }); setEdit(l.id); setErr(""); setModal(true); };

  /* ── open pipeline modal ── */
  const openPipeModal = (lead) => {
    setPipeForm({
      lead_id:        lead.id,
      titulo:         lead.nome,
      valor:          lead.valor_estimado || "",
      etapa:          firstEtapa,
      empresa_nome:   lead.empresa_nome || "",
      whatsapp:       lead.whatsapp || "",
      canal_aquisicao: lead.origem || "",
      responsavel_id: lead.atribuido_a || "",
    });
    setPipeErr("");
    setPipeModal(true);
  };

  /* ── save pipeline deal ── */
  const salvarPipeline = async () => {
    if (!pipeForm.titulo?.trim()) { setPipeErr("Título obrigatório."); return; }
    setPipeSaving(true);
    const { error } = await supabase.from("deals").insert({
      empresa_id:      user?.empresa_id,
      lead_id:         pipeForm.lead_id,
      titulo:          pipeForm.titulo,
      valor:           parseFloat(pipeForm.valor) || 0,
      etapa:           pipeForm.etapa || firstEtapa,
      empresa_nome:    pipeForm.empresa_nome || null,
      whatsapp:        pipeForm.whatsapp || null,
      canal_aquisicao: pipeForm.canal_aquisicao || null,
      responsavel_id:  pipeForm.responsavel_id || null,
      criado_por:      user?.id,
    });
    if (error) { setPipeErr(error.message); setPipeSaving(false); return; }
    logAction({
      empresa_id: user?.empresa_id, usuario_id: user?.id,
      tipo: "DEAL", nivel: "info",
      acao: `Lead enviado ao Pipeline: ${pipeForm.titulo}`,
      detalhes: { lead_id: pipeForm.lead_id },
    });
    setPipeModal(false);
    setPipeSaving(false);
  };

  /* ── save lead ── */
  const save = async () => {
    if (!form.nome.trim()) { setErr("Nome é obrigatório."); return; }
    setSaving(true); setErr("");
    const payload = {
      ...form,
      score:           parseInt(form.score) || 50,
      valor_estimado:  form.valor_estimado ? parseFloat(form.valor_estimado) : null,
      empresa_id:      user?.empresa_id,
      ultima_atividade: new Date().toISOString(),
      atribuido_a:     form.atribuido_a || null,
    };
    const { data: saved, error } = edit ? await update(edit, payload) : await insert(payload);
    if (error) { setErr(error.message || "Erro ao salvar."); setSaving(false); return; }

    if (!edit) {
      trackLead(payload);
      const agendado = new Date(Date.now() + 2 * 3600000).toISOString();
      await supabase.from("follow_ups").insert({
        empresa_id:       user?.empresa_id,
        lead_id:          saved?.id,
        responsavel_id:   form.atribuido_a || null,
        titulo:           `Primeiro contato — ${form.nome}`,
        descricao:        form.whatsapp ? `WhatsApp: ${form.whatsapp}` : "",
        canal:            form.origem === "WhatsApp" ? "WhatsApp" : form.origem === "Email" ? "Email" : "Ligação",
        prioridade:       form.status === "quente" ? "Alta" : "Media",
        status:           "pendente",
        agendado_para:    agendado,
        mensagem_whatsapp: `Olá ${form.nome}! Vi que você entrou em contato conosco. Como posso te ajudar? 😊`,
        criado_por:       user?.id,
      });
      supabase.functions.invoke("track-conversion", {
        body: { empresa_id: user?.empresa_id, event_name: "Lead", event_data: { value: payload.valor_estimado || 0, content_name: form.nome, content_category: form.origem } },
      });
      logAction({ empresa_id: user?.empresa_id, usuario_id: user?.id, usuario_email: user?.email, tipo: "LEAD", nivel: "info", acao: `Lead criado: ${form.nome} (${form.origem})`, detalhes: { lead_id: saved?.id, valor: payload.valor_estimado } });
    } else {
      logAction({ empresa_id: user?.empresa_id, usuario_id: user?.id, usuario_email: user?.email, tipo: "LEAD", nivel: "info", acao: `Lead atualizado: ${form.nome}`, detalhes: { lead_id: edit } });
    }
    setModal(false);
    setSaving(false);
  };

  const del = async (id) => {
    if (!confirm("Excluir este lead?")) return;
    await remove(id);
  };

  /* ──────────────────── RENDER ──────────────────── */
  return (
    <Fade>
      {/* ── indicadores ──────────────────────────────────────────────────────
          O que importa ao abrir a tela é quantos leads chegaram agora e quantos
          estão esperando resposta — não o total histórico. */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }} className="rg-auto">
        {[
          { l:"Novos (24h)",  v:novos24h,     c:L.teal,   sub:"aguardando primeiro contato" },
          { l:"Com msg nova", v:unreadCount,  c:L.green,  sub:"esperando resposta" },
          { l:"Quentes",      v:leads.filter(x => x.status === "quente").length, c:L.red, sub:"prontos para fechar" },
          { l:"Total",        v:leads.length, c:L.t2,     sub:"na base" },
        ].map((k,i) => (
          <div key={i} style={{ background:L.white, borderRadius:12, border:`1px solid ${L.line}`,
            padding:"14px 16px", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize:9.5, color:L.t4, textTransform:"uppercase", letterSpacing:"1.4px",
              marginBottom:4, fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>{k.l}</div>
            <div style={{ fontSize:26, fontWeight:700, color:k.c, fontFamily:"'Outfit',sans-serif" }}>{k.v}</div>
            <div style={{ fontSize:10, color:L.t4, marginTop:1 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── toolbar ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <TabPills tabs={["Todos","Novos","Quente","Morno","Frio"]} active={f} onChange={setF}/>
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar nome, telefone ou empresa..."
            style={{ padding:"7px 12px", borderRadius:9, border:`1px solid ${L.line}`, background:L.surface,
              color:L.t1, fontSize:12, outline:"none", minWidth:230 }}
          />
          {unreadCount > 0 && (
            <button
              onClick={() => setF("Todos")}
              style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:L.green, background:L.greenBg, border:`1px solid ${L.greenA2}`, borderRadius:20, padding:"3px 10px", cursor:"pointer" }}
            >
              💬 {unreadCount} {unreadCount === 1 ? "lead com" : "leads com"} msg nova
            </button>
          )}
        </div>
        <PBtn onClick={openNew}>+ Novo Lead</PBtn>
      </div>

      {/* ── table ── */}
      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:L.t4 }}>Carregando leads...</div>
      ) : leads.length === 0 ? (
        <div style={{ textAlign:"center", padding:60, color:L.t3 }}>
          <div style={{ fontSize:32, marginBottom:12 }}>◎</div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>Nenhum lead ainda</div>
          <div style={{ fontSize:12, marginBottom:20 }}>Comece adicionando seu primeiro lead</div>
          <PBtn onClick={openNew}>+ Adicionar Lead</PBtn>
        </div>
      ) : (
        <DataTable heads={["Lead","Empresa","WhatsApp","Status","Score","Origem","Valor","Responsável","Ações"]}>
          {filtered.map(lead => {
            const sc    = STATUS_COLORS[lead.status] || STATUS_COLORS.novo;
            const phone = (lead.whatsapp || "").replace(/\D/g, "");
            const conv  = phone ? conversaMap[phone] : null;
            const novo  = ehLeadNovo(lead);
            const quando = tempoRelativo(lead.ultima_atividade || lead.created_at);
            return (
              <tr key={lead.id}
                style={{ borderBottom:`1px solid ${L.lineSoft}`,
                  // Faixa à esquerda no lead novo: identifica a linha de relance,
                  // sem depender de ler a coluna de status.
                  boxShadow: novo ? `inset 3px 0 0 ${L.teal}` : "none" }}
                onMouseEnter={e => e.currentTarget.style.background = L.surface}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {/* name + unread badge */}
                <td style={TD}>
                  <Row gap={9}>
                    <Av name={exibirNome(lead)} color={novo ? L.teal : L.copper}/>
                    <div style={{ minWidth:0 }}>
                      <Row gap={6}>
                        <span style={{ color:L.t1, fontWeight:500, fontSize:12.5 }}>{exibirNome(lead)}</span>
                        {novo && (
                          <span style={{ fontSize:9, fontWeight:800, color:"#fff", background:L.teal,
                            borderRadius:5, padding:"2px 6px", letterSpacing:".5px", whiteSpace:"nowrap" }}>
                            LEAD NOVO
                          </span>
                        )}
                        {conv && (
                          <span style={{ fontSize:10, fontWeight:700, color:L.green, background:L.greenBg, border:`1px solid ${L.greenA2}`, borderRadius:10, padding:"1px 6px", whiteSpace:"nowrap" }}>
                            💬 {conv.nao_lidas}
                          </span>
                        )}
                      </Row>
                      {quando && <div style={{ fontSize:10, color:L.t4, marginTop:1 }}>{quando}</div>}
                    </div>
                  </Row>
                </td>
                <td style={{ ...TD, color:L.t3, fontSize:12 }}>{lead.empresa_nome || "—"}</td>
                <td style={{ ...TD, fontFamily:"'JetBrains Mono',monospace", fontSize:11,
                  color: semNumero(lead.whatsapp) ? L.t4 : L.teal }}>{exibirWhats(lead.whatsapp)}</td>
                <td style={TD}><Tag color={sc.c} bg={sc.bg}>{sc.l}</Tag></td>
                <td style={TD}>
                  <Row gap={7}>
                    <ScBar v={lead.score || 50}/>
                    <span style={{ fontSize:10, color:L.t3, fontFamily:"'JetBrains Mono',monospace" }}>{lead.score || 50}</span>
                  </Row>
                </td>
                <td style={{ ...TD, color:L.t3, fontSize:12 }}>{lead.origem || "—"}</td>
                <td style={{ ...TD, color:L.green, fontWeight:600, fontSize:12.5 }}>
                  {lead.valor_estimado ? `R$ ${parseFloat(lead.valor_estimado).toLocaleString("pt-BR", { minimumFractionDigits:2 })}` : "—"}
                </td>
                <td style={TD}>
                  {(() => {
                    const u = usuarios.find(u => u.id === lead.atribuido_a);
                    return u
                      ? <Row gap={6}><Av name={u.nome} color={L.copper} size={20}/><span style={{ fontSize:11, color:L.t3 }}>{u.nome.split(" ")[0]}</span></Row>
                      : <span style={{ color:L.t4, fontSize:11 }}>—</span>;
                  })()}
                </td>
                <td style={TD}>
                  <Row gap={5}>
                    {/* enviar para pipeline */}
                    <IBtn c={L.copper} onClick={() => openPipeModal(lead)} title="Enviar para Pipeline">⬡</IBtn>
                    {lead.whatsapp && (
                      <IBtn c={L.green} onClick={() => onOpenChat ? onOpenChat({ phone, nome: lead.nome }) : window.open(`https://wa.me/55${phone}`)}>WhatsApp</IBtn>
                    )}
                    <IBtn c={L.teal} onClick={() => openEdit(lead)}>✎</IBtn>
                    <IBtn c={L.red}  onClick={() => del(lead.id)}>⊗</IBtn>
                  </Row>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      {/* ──────── MODAL LEAD ──────── */}
      {modal && (
        <Modal title={edit ? "Editar Lead" : "Novo Lead"} onClose={() => setModal(false)} width={520}>
          <div className="form-grid">
            <Field label="Nome *"><Input value={form.nome} onChange={F("nome")} placeholder="Nome completo"/></Field>
            <Field label="WhatsApp"><Input value={form.whatsapp} onChange={F("whatsapp")} placeholder="(11) 99999-9999"/></Field>
            <Field label="E-mail"><Input value={form.email} onChange={F("email")} type="email" placeholder="email@empresa.com"/></Field>
            <Field label="Empresa"><Input value={form.empresa_nome} onChange={F("empresa_nome")} placeholder="Nome da empresa"/></Field>
            <Field label="Cargo"><Input value={form.cargo} onChange={F("cargo")} placeholder="Cargo / função"/></Field>
            <Field label="Valor estimado"><Input value={form.valor_estimado} onChange={F("valor_estimado")} placeholder="Ex: 5000"/></Field>
            <Field label="Status">
              <Select value={form.status} onChange={F("status")}>
                {["novo","quente","morno","frio"].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Responsável (Vendedor)">
              <Select value={form.atribuido_a} onChange={F("atribuido_a")}>
                <option value="">— atribuir —</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </Select>
            </Field>
            <Field label="Origem">
              <Select value={form.origem} onChange={F("origem")}>
                {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label={`Score: ${form.score}`}>
              <input type="range" min={0} max={100} value={form.score}
                onChange={e => F("score")(e.target.value)}
                style={{ width:"100%", accentColor:L.teal }}/>
            </Field>
          </div>
          <Field label="Observações">
            <textarea value={form.observacoes} onChange={e => F("observacoes")(e.target.value)} rows={3}
              placeholder="Notas internas sobre o lead..."
              style={{ width:"100%", background:L.surface, border:`1.5px solid ${L.line}`, borderRadius:9, padding:"9px 12px", color:L.t1, fontSize:12.5, fontFamily:"'Instrument Sans',sans-serif", resize:"vertical", outline:"none" }}/>
          </Field>
          {err && (
            <div style={{ padding:"8px 12px", background:L.redBg, border:`1px solid ${L.redA}`, borderRadius:8, fontSize:12, color:L.red, marginBottom:4 }}>{err}</div>
          )}
          <ModalFooter onClose={() => setModal(false)} onSave={save} loading={saving} label={edit ? "Salvar Alterações" : "Criar Lead"}/>
        </Modal>
      )}

      {/* ──────── MODAL PIPELINE ──────── */}
      {pipeModal && (
        <Modal title="Enviar para Pipeline" onClose={() => setPipeModal(false)} width={440}>
          {/* info banner */}
          <div style={{ padding:"10px 14px", background:L.tealBg, border:`1px solid ${L.tealA}`, borderRadius:8, fontSize:12, color:L.t2, marginBottom:16, lineHeight:1.5 }}>
            <b style={{ color:L.teal }}>⬡ Pipeline</b> — Criando oportunidade com os dados deste lead. Você pode ajustar os campos antes de confirmar.
          </div>

          <Field label="Título da oportunidade *">
            <Input value={pipeForm.titulo} onChange={PF("titulo")} placeholder="Nome do negócio"/>
          </Field>
          <div className="form-grid">
            <Field label="Valor (R$)">
              <Input value={pipeForm.valor} onChange={PF("valor")} placeholder="Ex: 5000" type="number"/>
            </Field>
            <Field label="Etapa inicial">
              <Select value={pipeForm.etapa} onChange={PF("etapa")}>
                {etapasOrdenadas.length > 0
                  ? etapasOrdenadas.map(e => <option key={e.slug} value={e.slug}>{e.nome}</option>)
                  : <option value="novo">Novo</option>
                }
              </Select>
            </Field>
          </div>
          <Field label="Canal de aquisição">
            <Input value={pipeForm.canal_aquisicao} onChange={PF("canal_aquisicao")} placeholder="Ex: WhatsApp, Instagram, Indicação..."/>
          </Field>
          <Field label="Responsável">
            <Select value={pipeForm.responsavel_id} onChange={PF("responsavel_id")}>
              <option value="">— sem responsável —</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Select>
          </Field>

          {pipeErr && (
            <div style={{ padding:"8px 12px", background:L.redBg, border:`1px solid ${L.redA}`, borderRadius:8, fontSize:12, color:L.red, marginBottom:4 }}>{pipeErr}</div>
          )}
          <ModalFooter onClose={() => setPipeModal(false)} onSave={salvarPipeline} loading={pipeSaving} label="Enviar para Pipeline"/>
        </Modal>
      )}
    </Fade>
  );
}
