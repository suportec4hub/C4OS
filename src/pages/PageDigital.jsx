import { useState, useEffect, useCallback } from "react";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { Fade, Row, Grid, TabPills, PBtn, DataTable, Tag, Av, IBtn, TD } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";
import { useBreakpoint } from "../hooks/useBreakpoint";

/* ── paletas ── */
const PRIO_C  = { baixa:L.green,   media:L.yellow, alta:L.copper, critica:L.red   };
const PRIO_BG = { baixa:L.greenBg, media:L.yellowBg, alta:L.copperBg, critica:L.redBg };
const TIPO_C  = { tarefa:L.teal, bug:L.red, feature:L.green, melhoria:L.copper };
const TIPO_BG = { tarefa:L.tealBg, bug:L.redBg, feature:L.greenBg, melhoria:L.copperBg };
const PROJ_C  = { ativo:L.green, em_pausa:L.yellow, concluido:L.teal, cancelado:L.t4 };
const PROJ_BG = { ativo:L.greenBg, em_pausa:L.yellowBg, concluido:L.tealBg, cancelado:L.surface };
const CH_C    = { aberto:L.copper, em_atendimento:L.teal, aguardando_resposta:L.yellow, resolvido:L.green, cancelado:L.t4 };
const CH_BG   = { aberto:L.copperBg, em_atendimento:L.tealBg, aguardando_resposta:L.yellowBg, resolvido:L.greenBg, cancelado:L.surface };
const CH_TIPO_C  = { bug:L.red, solicitacao:L.teal, duvida:L.yellow, acesso:L.copper, infraestrutura:L.blue, desenvolvimento:L.green, outro:L.t4 };
const CH_TIPO_BG = { bug:L.redBg, solicitacao:L.tealBg, duvida:L.yellowBg, acesso:L.copperBg, infraestrutura:L.blueBg||L.surface, desenvolvimento:L.greenBg, outro:L.surface };
const TIPO_LABEL = { bug:"Bug", solicitacao:"Solicitação", duvida:"Dúvida", acesso:"Acesso", infraestrutura:"Infra", desenvolvimento:"Dev", outro:"Outro" };
const COMENT_C  = { comentario:L.t3, atualizacao:L.teal, resolucao:L.green, interno:L.yellow };
const COMENT_BG = { comentario:L.surface, atualizacao:L.tealBg, resolucao:L.greenBg, interno:L.yellowBg };

/* ── SLA por prioridade (horas) ── */
const SLA_HORAS = { critica:2, alta:8, media:24, baixa:72 };

function slaInfo(chamado) {
  if (chamado.status === "resolvido" || chamado.status === "cancelado") return null;
  const horasAberto = (Date.now() - new Date(chamado.created_at)) / 3600000;
  const limite = SLA_HORAS[chamado.prioridade] || 24;
  const pct = Math.min((horasAberto / limite) * 100, 100);
  const restante = limite - horasAberto;
  const status = pct >= 100 ? "vencido" : pct >= 75 ? "critico" : "ok";
  const cor = pct >= 100 ? L.red : pct >= 75 ? L.yellow : L.green;
  const label = pct >= 100
    ? `SLA vencido (${Math.round(horasAberto - limite)}h atrás)`
    : restante < 1
    ? `${Math.round(restante * 60)}min restantes`
    : `${Math.round(restante)}h restantes`;
  return { pct, cor, status, label };
}

function tempoDecorrido(iso) {
  const diff = Date.now() - new Date(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `${d} dias atrás`;
}

const fmtDate = (d) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : null;
const fmtDt   = (iso) => iso ? new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";

/* ── Kanban colunas ── */
const COLUNAS = [
  { id:"backlog",      label:"Backlog",      cor:L.t4     },
  { id:"todo",         label:"A Fazer",      cor:L.copper },
  { id:"em_andamento", label:"Em Andamento", cor:L.teal   },
  { id:"revisao",      label:"Em Revisão",   cor:L.yellow },
  { id:"concluido",    label:"Concluído",    cor:L.green  },
];

const VAZIO_PROJ = { nome:"", descricao:"", status:"ativo", prioridade:"media", data_inicio:"", data_fim:"", cor:L.teal };
const VAZIO_TASK = { titulo:"", descricao:"", status:"backlog", prioridade:"media", tipo:"tarefa", data_prazo:"", estimativa_horas:"" };
const VAZIO_CH   = { titulo:"", descricao:"", tipo:"solicitacao", categoria:"Sistema", prioridade:"media", solicitante_nome:"", solicitante_email:"", cliente_nome:"" };
const CORES_PROJ = [L.teal, L.copper, L.green, "#6366F1", L.yellow, L.red];
const CATEGORIAS = ["Sistema","Acesso / Permissão","Hardware","Software / App","Rede / Internet","Desenvolvimento","Banco de Dados","Integração","Segurança","Outro"];

export default function PageDigital({ user }) {
  const { isMobile } = useBreakpoint();
  const { data:projetos,  loading:loadP, insert:insP, update:updP, remove:remP, refetch:refP } = useTable("digital_projetos",  { empresa_id:user?.empresa_id });
  const { data:tarefas,   loading:loadT, insert:insT, update:updT, remove:remT, refetch:refT } = useTable("digital_tarefas",   { empresa_id:user?.empresa_id });
  const { data:chamados,  loading:loadC, insert:insC, update:updC, remove:remC, refetch:refC } = useTable("digital_chamados",  { empresa_id:user?.empresa_id });
  const { data:usuarios }                                                                        = useTable("usuarios",          { empresa_id:user?.empresa_id });

  const [aba,          setAba]          = useState("Chamados");
  const [projetoAtivo, setProjetoAtivo] = useState(null);
  const [chamadoAtivo, setChamadoAtivo] = useState(null);
  const [comentarios,  setComentarios]  = useState([]);
  const [loadComent,   setLoadComent]   = useState(false);
  const [novoComent,   setNovoComent]   = useState("");
  const [tipoComent,   setTipoComent]   = useState("comentario");
  const [savingComent, setSavingComent] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("Abertos");

  const [modal,  setModal]  = useState(false);
  const [edit,   setEdit]   = useState(null);
  const [form,   setForm]   = useState(VAZIO_CH);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");
  const [drag,   setDrag]   = useState(null);

  const F = k => v => setForm(p => ({...p,[k]:v}));
  const nomeUser = (uid) => usuarios.find(u=>u.id===uid)?.nome || null;

  /* ── Comentários ── */
  const loadComentarios = useCallback(async (chamadoId) => {
    if (!chamadoId) return;
    setLoadComent(true);
    const { data } = await supabase
      .from("digital_chamados_comentarios")
      .select("*")
      .eq("chamado_id", chamadoId)
      .order("created_at", { ascending: true });
    setComentarios(data || []);
    setLoadComent(false);
  }, []);

  useEffect(() => {
    if (chamadoAtivo) loadComentarios(chamadoAtivo.id);
    else setComentarios([]);
  }, [chamadoAtivo, loadComentarios]);

  const abrirChamado = (c) => {
    setChamadoAtivo(c);
    setNovoComent("");
  };

  const enviarComentario = async () => {
    if (!novoComent.trim() || !chamadoAtivo) return;
    setSavingComent(true);
    await supabase.from("digital_chamados_comentarios").insert({
      chamado_id:  chamadoAtivo.id,
      usuario_id:  user?.id,
      usuario_nome: user?.nome || "Usuário",
      conteudo:    novoComent.trim(),
      tipo:        tipoComent,
    });
    // Se resolvido, atualizar status
    if (tipoComent === "resolucao") {
      await updC(chamadoAtivo.id, { status:"resolvido", resolved_at: new Date().toISOString() });
      setChamadoAtivo(p => ({...p, status:"resolvido"}));
      refC();
    }
    setNovoComent("");
    await loadComentarios(chamadoAtivo.id);
    setSavingComent(false);
  };

  const mudarStatus = async (novoStatus) => {
    if (!chamadoAtivo) return;
    const extra = novoStatus === "resolvido" ? { resolved_at: new Date().toISOString() } : {};
    await updC(chamadoAtivo.id, { status:novoStatus, updated_at:new Date().toISOString(), ...extra });
    // Log automático
    await supabase.from("digital_chamados_comentarios").insert({
      chamado_id:  chamadoAtivo.id,
      usuario_id:  user?.id,
      usuario_nome: user?.nome || "Sistema",
      conteudo:    `Status alterado para: ${novoStatus.replace("_"," ")}`,
      tipo:        "atualizacao",
    });
    setChamadoAtivo(p => ({...p, status:novoStatus, ...extra}));
    await loadComentarios(chamadoAtivo.id);
    refC();
  };

  const atribuir = async (responsavelId) => {
    if (!chamadoAtivo) return;
    await updC(chamadoAtivo.id, { responsavel_id: responsavelId||null });
    const nome = responsavelId ? nomeUser(responsavelId) : "ninguém";
    await supabase.from("digital_chamados_comentarios").insert({
      chamado_id:  chamadoAtivo.id,
      usuario_id:  user?.id,
      usuario_nome: user?.nome || "Sistema",
      conteudo:    `Chamado atribuído a: ${nome}`,
      tipo:        "atualizacao",
    });
    setChamadoAtivo(p => ({...p, responsavel_id:responsavelId||null}));
    await loadComentarios(chamadoAtivo.id);
    refC();
  };

  /* ── Chamado CRUD ── */
  const openNovoChamado = (c=null) => {
    setForm(c ? {...c} : {...VAZIO_CH, solicitante_nome:user?.nome||"", solicitante_email:user?.email||""});
    setEdit(c?.id||null); setErr(""); setModal("chamado");
  };

  const saveChamado = async () => {
    if (!form.titulo.trim()) { setErr("Título é obrigatório."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, empresa_id:user?.empresa_id, solicitante_id:edit?undefined:user?.id, updated_at:new Date().toISOString() };
    const {error, data:saved} = edit ? await updC(edit,payload) : await insC(payload);
    if (error) { setErr(error.message); setSaving(false); return; }
    if (!edit && saved) {
      // Log de abertura
      await supabase.from("digital_chamados_comentarios").insert({
        chamado_id: saved.id, usuario_id:user?.id,
        usuario_nome: user?.nome||"Usuário",
        conteudo: `Chamado aberto por ${form.solicitante_nome||user?.nome||"Usuário"}.`,
        tipo: "atualizacao",
      });
    }
    setModal(false); refC(); setSaving(false);
  };

  /* ── Chamados filtro ── */
  const chamadosFiltrados = chamados.filter(c => {
    if (filtroStatus === "Abertos")      return c.status === "aberto";
    if (filtroStatus === "Atendimento")  return c.status === "em_atendimento" || c.status === "aguardando_resposta";
    if (filtroStatus === "Resolvidos")   return c.status === "resolvido";
    if (filtroStatus === "Todos")        return true;
    return true;
  }).sort((a,b) => {
    const po = { critica:0, alta:1, media:2, baixa:3 };
    return (po[a.prioridade]??2) - (po[b.prioridade]??2) || new Date(b.created_at)-new Date(a.created_at);
  });

  /* ── KPIs ── */
  const abertos      = chamados.filter(c=>c.status==="aberto").length;
  const atendimento  = chamados.filter(c=>c.status==="em_atendimento"||c.status==="aguardando_resposta").length;
  const resolvidos   = chamados.filter(c=>c.status==="resolvido").length;
  const criticos     = chamados.filter(c=>c.prioridade==="critica"&&c.status!=="resolvido"&&c.status!=="cancelado").length;
  const projAtivos   = projetos.filter(p=>p.status==="ativo").length;
  const tarefasEmAnd = tarefas.filter(t=>t.status==="em_andamento").length;

  /* ── Projetos / Kanban ── */
  const tarefasDoProjeto = tarefas.filter(t => t.projeto_id === projetoAtivo);

  const openProjeto = (p=null) => { setForm(p?{...p}:VAZIO_PROJ); setEdit(p?.id||null); setErr(""); setModal("projeto"); };
  const openTarefa  = (t=null,status="backlog") => { setForm(t?{...t}:{...VAZIO_TASK,status}); setEdit(t?.id||null); setErr(""); setModal("tarefa"); };

  const saveProjeto = async () => {
    if (!form.nome.trim()) { setErr("Nome obrigatório."); return; }
    setSaving(true); setErr("");
    const {error} = edit ? await updP(edit,{...form,empresa_id:user?.empresa_id}) : await insP({...form,empresa_id:user?.empresa_id});
    if (error) setErr(error.message);
    else { setModal(false); refP(); }
    setSaving(false);
  };

  const saveTarefa = async () => {
    if (!form.titulo.trim()) { setErr("Título obrigatório."); return; }
    if (!projetoAtivo) { setErr("Selecione um projeto."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, projeto_id:projetoAtivo, empresa_id:user?.empresa_id, estimativa_horas:form.estimativa_horas?parseFloat(form.estimativa_horas):null };
    const {error} = edit ? await updT(edit,payload) : await insT(payload);
    if (error) setErr(error.message);
    else { setModal(false); refT(); }
    setSaving(false);
  };

  const moverTarefa = async (id, novoStatus) => {
    const t = tarefas.find(x=>x.id===id);
    if (!t||t.status===novoStatus) return;
    await updT(id,{status:novoStatus});
  };

  /* ══════════════════════════════════════════════════════════════════ */
  return (
    <Fade>
      {/* KPIs */}
      <Grid cols={6} gap={12} mb={14} responsive>
        {[
          {l:"Chamados Abertos",  v:abertos,    c:L.copper},
          {l:"Em Atendimento",    v:atendimento,c:L.teal},
          {l:"Resolvidos",        v:resolvidos, c:L.green},
          {l:"Críticos",          v:criticos,   c:L.red},
          {l:"Projetos Ativos",   v:projAtivos, c:L.teal},
          {l:"Tarefas em Andamento",v:tarefasEmAnd,c:L.copper},
        ].map((k,i)=>(
          <div key={i} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"13px 16px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:9,color:L.t4,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:4,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{k.l}</div>
            <div style={{fontSize:24,fontWeight:700,color:k.c,fontFamily:"'Outfit',sans-serif"}}>{k.v}</div>
          </div>
        ))}
      </Grid>

      {/* Tabs */}
      <Row between mb={14}>
        <TabPills tabs={["Chamados","Projetos","Tarefas"]} active={aba} onChange={v=>{setAba(v);setChamadoAtivo(null);}}/>
        {aba==="Chamados" && <PBtn onClick={()=>openNovoChamado()}>+ Novo Chamado</PBtn>}
        {aba==="Projetos" && <PBtn onClick={()=>openProjeto()}>+ Projeto</PBtn>}
        {aba==="Tarefas"  && projetoAtivo && <PBtn onClick={()=>openTarefa()}>+ Tarefa</PBtn>}
      </Row>

      {/* ══ ABA: CHAMADOS ══ */}
      {aba==="Chamados"&&(
        <div style={{display:"flex",gap:12,minHeight:520,alignItems:"flex-start"}}>

          {/* Lista de chamados */}
          <div style={{flex:"0 0 420px",minWidth:0,display:isMobile&&chamadoAtivo?"none":"flex",flexDirection:"column",gap:0,background:L.white,borderRadius:12,border:`1px solid ${L.line}`,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            {/* Filtros */}
            <div style={{padding:"10px 12px",borderBottom:`1px solid ${L.lineSoft}`,flexShrink:0}}>
              <TabPills tabs={["Abertos","Atendimento","Resolvidos","Todos"]} active={filtroStatus} onChange={setFiltroStatus}/>
            </div>

            {loadC ? (
              <div style={{textAlign:"center",padding:40,color:L.t4,fontSize:11}}>Carregando...</div>
            ) : chamadosFiltrados.length===0 ? (
              <div style={{textAlign:"center",padding:40,color:L.t4}}>
                <div style={{fontSize:24,marginBottom:8,opacity:.3}}>⊙</div>
                <div style={{fontSize:12}}>Nenhum chamado {filtroStatus.toLowerCase()}</div>
              </div>
            ) : (
              <div style={{overflowY:"auto",flex:1}}>
                {chamadosFiltrados.map(c=>{
                  const sla = slaInfo(c);
                  const ativo = chamadoAtivo?.id === c.id;
                  return (
                    <div key={c.id} onClick={()=>abrirChamado(c)}
                      style={{padding:"12px 14px",borderBottom:`1px solid ${L.lineSoft}`,cursor:"pointer",background:ativo?L.tealBg:"transparent",borderLeft:`3px solid ${ativo?L.teal:PRIO_C[c.prioridade]||L.t4}`,transition:"background .12s"}}
                      onMouseEnter={e=>{if(!ativo)e.currentTarget.style.background=L.surface;}}
                      onMouseLeave={e=>{if(!ativo)e.currentTarget.style.background="transparent";}}>
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:5}}>
                        <div style={{fontSize:12.5,fontWeight:500,color:ativo?L.teal:L.t1,flex:1,marginRight:8,lineHeight:1.4}}>{c.titulo}</div>
                        <Tag color={CH_C[c.status]||L.t4} bg={CH_BG[c.status]||L.surface} style={{flexShrink:0,fontSize:10}}>{c.status.replace("_"," ")}</Tag>
                      </div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:5}}>
                        <Tag color={CH_TIPO_C[c.tipo]||L.teal} bg={CH_TIPO_BG[c.tipo]||L.tealBg} small>{TIPO_LABEL[c.tipo]||c.tipo}</Tag>
                        <Tag color={PRIO_C[c.prioridade]||L.yellow} bg={PRIO_BG[c.prioridade]||L.yellowBg} small>{c.prioridade}</Tag>
                        {c.categoria&&<Tag color={L.t3} bg={L.surface} small>{c.categoria}</Tag>}
                      </div>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{fontSize:10,color:L.t4}}>
                          {c.solicitante_nome||nomeUser(c.solicitante_id)||"Externo"}
                          {c.cliente_nome&&<span style={{color:L.copper}}> · {c.cliente_nome}</span>}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          {sla&&(
                            <span style={{fontSize:9.5,color:sla.cor,fontFamily:"'JetBrains Mono',monospace"}}>{sla.label}</span>
                          )}
                          <span style={{fontSize:9.5,color:L.t5,fontFamily:"'JetBrains Mono',monospace"}}>{tempoDecorrido(c.created_at)}</span>
                        </div>
                      </div>
                      {sla&&(
                        <div style={{marginTop:5,height:2,borderRadius:2,background:L.lineSoft,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${sla.pct}%`,background:sla.cor,transition:"width .3s"}}/>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detalhe do chamado */}
          {chamadoAtivo ? (
            <div style={{flex:1,minWidth:0,background:L.white,borderRadius:12,border:`1px solid ${L.line}`,display:"flex",flexDirection:"column",overflow:"hidden",maxHeight:"calc(100dvh - 280px)",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
              {/* Header do detalhe */}
              <div style={{padding:"14px 18px",borderBottom:`1px solid ${L.lineSoft}`,flexShrink:0}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:8}}>
                  <div style={{flex:1}}>
                    {isMobile&&<button onClick={()=>setChamadoAtivo(null)} style={{background:"none",border:"none",cursor:"pointer",color:L.t3,fontSize:12,marginBottom:4,fontFamily:"inherit",padding:0}}>← Voltar</button>}
                    <div style={{fontSize:14,fontWeight:700,color:L.t1,lineHeight:1.4}}>{chamadoAtivo.titulo}</div>
                    <div style={{fontSize:10,color:L.t4,marginTop:3,fontFamily:"'JetBrains Mono',monospace"}}>
                      #{chamadoAtivo.id.slice(0,8).toUpperCase()} · aberto {fmtDt(chamadoAtivo.created_at)}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:5,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                    <Tag color={CH_C[chamadoAtivo.status]||L.t4} bg={CH_BG[chamadoAtivo.status]||L.surface}>{chamadoAtivo.status.replace("_"," ")}</Tag>
                    <Tag color={PRIO_C[chamadoAtivo.prioridade]} bg={PRIO_BG[chamadoAtivo.prioridade]}>{chamadoAtivo.prioridade}</Tag>
                  </div>
                </div>

                {/* Info row */}
                <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                  {[
                    {l:"Tipo",       v:<Tag color={CH_TIPO_C[chamadoAtivo.tipo]||L.teal} bg={CH_TIPO_BG[chamadoAtivo.tipo]||L.tealBg}>{TIPO_LABEL[chamadoAtivo.tipo]||chamadoAtivo.tipo}</Tag>},
                    {l:"Categoria",  v:<span style={{fontSize:12,color:L.t2}}>{chamadoAtivo.categoria||"—"}</span>},
                    {l:"Solicitante",v:<span style={{fontSize:12,color:L.t2}}>{chamadoAtivo.solicitante_nome||nomeUser(chamadoAtivo.solicitante_id)||"—"}</span>},
                    {l:"Cliente",    v:<span style={{fontSize:12,color:L.copper}}>{chamadoAtivo.cliente_nome||"Interno"}</span>},
                  ].map(({l,v})=>(
                    <div key={l}>
                      <div style={{fontSize:9,color:L.t5,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace",marginBottom:2}}>{l}</div>
                      {v}
                    </div>
                  ))}
                </div>
              </div>

              {/* Ações rápidas */}
              <div style={{padding:"8px 18px",borderBottom:`1px solid ${L.lineSoft}`,flexShrink:0,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                {/* Mudar status */}
                {chamadoAtivo.status!=="resolvido"&&chamadoAtivo.status!=="cancelado"&&[
                  {s:"em_atendimento",l:"▶ Atender",   c:L.teal},
                  {s:"aguardando_resposta",l:"⏸ Aguardar",c:L.yellow},
                  {s:"resolvido",l:"✓ Resolver",  c:L.green},
                  {s:"cancelado", l:"⊗ Cancelar", c:L.red},
                ].filter(x=>x.s!==chamadoAtivo.status).map(x=>(
                  <button key={x.s} onClick={()=>mudarStatus(x.s)}
                    style={{padding:"5px 12px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:"transparent",color:x.c,border:`1.5px solid ${x.c}44`,transition:"all .12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background=x.c+"15";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                    {x.l}
                  </button>
                ))}
                {/* Atribuir */}
                <select value={chamadoAtivo.responsavel_id||""} onChange={e=>atribuir(e.target.value||null)}
                  style={{padding:"5px 10px",borderRadius:7,fontSize:11,fontFamily:"inherit",border:`1px solid ${L.line}`,background:L.surface,color:L.t2,cursor:"pointer",outline:"none",marginLeft:"auto"}}>
                  <option value="">Atribuir a...</option>
                  {usuarios.filter(u=>u.ativo).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
                {chamadoAtivo.responsavel_id&&(
                  <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:L.t2}}>
                    <Av name={nomeUser(chamadoAtivo.responsavel_id)||"?"} size={20} color={L.teal}/>
                    <span>{nomeUser(chamadoAtivo.responsavel_id)}</span>
                  </div>
                )}
                <button onClick={()=>openNovoChamado(chamadoAtivo)}
                  style={{padding:"5px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"inherit",border:`1px solid ${L.line}`,background:"transparent",color:L.t3}}>
                  ✎ Editar
                </button>
              </div>

              {/* Descrição */}
              {chamadoAtivo.descricao&&(
                <div style={{padding:"12px 18px",borderBottom:`1px solid ${L.lineSoft}`,flexShrink:0}}>
                  <div style={{fontSize:9,color:L.t5,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace",marginBottom:6}}>Descrição</div>
                  <div style={{fontSize:12.5,color:L.t2,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{chamadoAtivo.descricao}</div>
                </div>
              )}

              {/* Timeline de comentários */}
              <div style={{flex:1,overflowY:"auto",padding:"12px 18px",display:"flex",flexDirection:"column",gap:8}}>
                <div style={{fontSize:9,color:L.t5,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace",marginBottom:4}}>
                  Histórico ({comentarios.length})
                </div>
                {loadComent ? (
                  <div style={{textAlign:"center",padding:20,color:L.t4,fontSize:11}}>Carregando...</div>
                ) : comentarios.map(cm=>(
                  <div key={cm.id} style={{display:"flex",gap:9,alignItems:"flex-start"}}>
                    <Av name={cm.usuario_nome} size={24} color={COMENT_C[cm.tipo]||L.t3}/>
                    <div style={{flex:1,background:COMENT_BG[cm.tipo]||L.surface,borderRadius:"3px 10px 10px 10px",padding:"8px 12px",border:`1px solid ${COMENT_C[cm.tipo]||L.line}22`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:11,fontWeight:600,color:L.t2}}>{cm.usuario_nome}</span>
                        <span style={{fontSize:9.5,color:L.t5,fontFamily:"'JetBrains Mono',monospace"}}>{tempoDecorrido(cm.created_at)}</span>
                      </div>
                      <div style={{fontSize:12,color:cm.tipo==="atualizacao"?COMENT_C[cm.tipo]:L.t1,lineHeight:1.5,fontStyle:cm.tipo==="atualizacao"?"italic":"normal"}}>{cm.conteudo}</div>
                    </div>
                  </div>
                ))}
                {comentarios.length===0&&!loadComent&&(
                  <div style={{textAlign:"center",padding:20,color:L.t5,fontSize:11}}>Sem histórico ainda.</div>
                )}
              </div>

              {/* Adicionar comentário */}
              {chamadoAtivo.status!=="cancelado"&&(
                <div style={{padding:"10px 18px",borderTop:`1px solid ${L.lineSoft}`,flexShrink:0,background:L.surface}}>
                  <div style={{display:"flex",gap:6,marginBottom:6}}>
                    {[
                      {v:"comentario",l:"Comentário",c:L.t3},
                      {v:"interno",   l:"🔒 Interno",c:L.yellow},
                      {v:"resolucao", l:"✓ Resolução",c:L.green},
                    ].map(t=>(
                      <button key={t.v} onClick={()=>setTipoComent(t.v)}
                        style={{padding:"4px 10px",borderRadius:6,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit",border:`1.5px solid ${tipoComent===t.v?t.c:L.line}`,background:tipoComent===t.v?t.c+"15":"transparent",color:tipoComent===t.v?t.c:L.t4,transition:"all .12s"}}>
                        {t.l}
                      </button>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <textarea value={novoComent} onChange={e=>setNovoComent(e.target.value)}
                      placeholder={tipoComent==="interno"?"Nota interna (visível só para o time)...":tipoComent==="resolucao"?"Descreva a solução...":"Adicionar comentário..."}
                      rows={2}
                      style={{flex:1,background:L.white,border:`1.5px solid ${L.line}`,borderRadius:8,padding:"8px 12px",color:L.t1,fontSize:12,fontFamily:"inherit",outline:"none",resize:"vertical",transition:"border-color .12s"}}
                      onFocus={e=>e.target.style.borderColor=L.teal}
                      onBlur={e=>e.target.style.borderColor=L.line}
                      onKeyDown={e=>{if(e.key==="Enter"&&e.metaKey)enviarComentario();}}
                    />
                    <button onClick={enviarComentario} disabled={savingComent||!novoComent.trim()}
                      style={{padding:"8px 16px",borderRadius:8,background:novoComent.trim()?L.teal:L.surface,border:"none",color:novoComent.trim()?"white":L.t4,fontWeight:600,cursor:novoComent.trim()?"pointer":"not-allowed",fontSize:12,fontFamily:"inherit",transition:"all .15s",alignSelf:"flex-end"}}>
                      {savingComent?"...":"Enviar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:L.white,borderRadius:12,border:`1px solid ${L.line}`,flexDirection:"column",gap:10,color:L.t4,padding:40}}>
              <div style={{fontSize:32,opacity:.2}}>⊙</div>
              <div style={{fontSize:13,fontWeight:500,color:L.t3}}>Selecione um chamado para ver os detalhes</div>
              <div style={{fontSize:11,color:L.t5}}>ou abra um novo chamado acima</div>
            </div>
          )}
        </div>
      )}

      {/* ══ ABA: PROJETOS ══ */}
      {aba==="Projetos"&&(
        <div style={{display:"flex",gap:14,minHeight:500}}>
          {/* Sidebar projetos */}
          <div style={{width:230,minWidth:230,display:"flex",flexDirection:"column",gap:8}}>
            <Row between mb={4}>
              <span style={{fontSize:11,fontWeight:600,color:L.t3,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace"}}>Projetos</span>
              <button onClick={()=>openProjeto()}
                style={{background:L.teal,color:"white",border:"none",borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+</button>
            </Row>
            {loadP ? <div style={{textAlign:"center",padding:20,color:L.t4,fontSize:11}}>Carregando...</div>
            : projetos.length===0 ? (
              <div style={{textAlign:"center",padding:20,color:L.t4,fontSize:11}}>
                <div style={{fontSize:20,marginBottom:8,opacity:.4}}>⬡</div>Nenhum projeto.
              </div>
            ) : projetos.map(p=>{
              const ativo = projetoAtivo===p.id;
              const qt = tarefas.filter(t=>t.projeto_id===p.id).length;
              const qtDone = tarefas.filter(t=>t.projeto_id===p.id&&t.status==="concluido").length;
              const pct = qt>0?Math.round(qtDone/qt*100):0;
              return (
                <div key={p.id} onClick={()=>setProjetoAtivo(ativo?null:p.id)}
                  style={{padding:"11px 13px",borderRadius:10,cursor:"pointer",background:ativo?L.white:L.surface,border:`1.5px solid ${ativo?(p.cor||L.teal)+"66":L.line}`,transition:"all .15s",boxShadow:ativo?"0 2px 8px rgba(0,0,0,0.06)":"none"}}
                  onMouseEnter={e=>{if(!ativo)e.currentTarget.style.background=L.hover;}}
                  onMouseLeave={e=>{if(!ativo)e.currentTarget.style.background=L.surface;}}
                >
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:p.cor||L.teal,flexShrink:0}}/>
                      <div style={{fontSize:12,fontWeight:ativo?600:400,color:ativo?L.t1:L.t2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:120}}>{p.nome}</div>
                    </div>
                    <div style={{display:"flex",gap:3}}>
                      <button onClick={e=>{e.stopPropagation();openProjeto(p);}} style={{background:"none",border:"none",cursor:"pointer",color:L.t5,fontSize:11,padding:2}} onMouseEnter={e=>e.currentTarget.style.color=L.teal} onMouseLeave={e=>e.currentTarget.style.color=L.t5}>✎</button>
                      <button onClick={e=>{e.stopPropagation();if(confirm("Excluir projeto?"))remP(p.id);}} style={{background:"none",border:"none",cursor:"pointer",color:L.t5,fontSize:11,padding:2}} onMouseEnter={e=>e.currentTarget.style.color=L.red} onMouseLeave={e=>e.currentTarget.style.color=L.t5}>⊗</button>
                    </div>
                  </div>
                  <Tag color={PROJ_C[p.status]||L.t4} bg={PROJ_BG[p.status]||L.surface}>{p.status.replace("_"," ")}</Tag>
                  {qt>0&&<div style={{marginTop:7}}><div style={{height:3,borderRadius:4,background:L.lineSoft,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:p.cor||L.teal,borderRadius:4}}/></div><div style={{fontSize:9.5,color:L.t4,marginTop:3,fontFamily:"'JetBrains Mono',monospace"}}>{qtDone}/{qt} · {pct}%</div></div>}
                  {p.data_fim&&<div style={{fontSize:9.5,color:L.t5,marginTop:4}}>Prazo: {fmtDate(p.data_fim)}</div>}
                </div>
              );
            })}
          </div>

          {/* Kanban */}
          <div style={{flex:1,minWidth:0}}>
            {!projetoAtivo ? (
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",background:L.white,borderRadius:12,border:`1px solid ${L.line}`,flexDirection:"column",gap:12,color:L.t4,padding:40}}>
                <div style={{fontSize:32,opacity:.3}}>⊞</div>
                <div style={{fontSize:13,fontWeight:500}}>Selecione um projeto para ver o board</div>
              </div>
            ) : (
              <>
                <Row between mb={10}>
                  <div>
                    <span style={{fontSize:13,fontWeight:700,color:L.t1}}>{projetos.find(p=>p.id===projetoAtivo)?.nome}</span>
                    <span style={{fontSize:11,color:L.t4,marginLeft:8}}>{tarefasDoProjeto.length} tarefa{tarefasDoProjeto.length!==1?"s":""}</span>
                  </div>
                  <PBtn onClick={()=>openTarefa()}>+ Tarefa</PBtn>
                </Row>
                <div className="kanban-wrap" style={{display:"flex",gap:10,alignItems:"flex-start",minHeight:400}}>
                  {COLUNAS.map(col=>{
                    const colT = tarefasDoProjeto.filter(t=>t.status===col.id);
                    return (
                      <div key={col.id} style={{minWidth:200,width:200,flexShrink:0,background:L.surface,borderRadius:10,border:`1px solid ${L.line}`,overflow:"hidden"}}
                        onDragOver={e=>e.preventDefault()}
                        onDrop={e=>{e.preventDefault();if(drag)moverTarefa(drag,col.id);setDrag(null);}}>
                        <div style={{padding:"9px 12px",borderBottom:`1px solid ${L.line}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:L.white}}>
                          <div style={{display:"flex",alignItems:"center",gap:7}}>
                            <div style={{width:8,height:8,borderRadius:"50%",background:col.cor}}/>
                            <span style={{fontSize:11,fontWeight:600,color:L.t2}}>{col.label}</span>
                          </div>
                          <span style={{fontSize:10,color:L.t4,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{colT.length}</span>
                        </div>
                        <div style={{padding:8,display:"flex",flexDirection:"column",gap:6,minHeight:60}}>
                          {colT.map(t=>(
                            <div key={t.id} draggable onDragStart={()=>setDrag(t.id)} onDragEnd={()=>setDrag(null)}
                              style={{background:L.white,borderRadius:8,padding:"10px 11px",border:`1px solid ${L.line}`,cursor:"grab",boxShadow:"0 1px 3px rgba(0,0,0,0.05)",opacity:drag===t.id?.5:1}}
                              onMouseEnter={e=>e.currentTarget.style.boxShadow="0 3px 10px rgba(0,0,0,0.1)"}
                              onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.05)"}>
                              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6}}>
                                <div style={{fontSize:11.5,fontWeight:500,color:L.t1,lineHeight:1.4,flex:1,marginRight:4}}>{t.titulo}</div>
                                <div style={{display:"flex",gap:3,flexShrink:0}}>
                                  <button onClick={()=>openTarefa(t)} style={{background:"none",border:"none",cursor:"pointer",color:L.t5,fontSize:10,padding:1}} onMouseEnter={e=>e.currentTarget.style.color=L.teal} onMouseLeave={e=>e.currentTarget.style.color=L.t5}>✎</button>
                                  <button onClick={()=>{if(confirm("Excluir?"))remT(t.id);}} style={{background:"none",border:"none",cursor:"pointer",color:L.t5,fontSize:10,padding:1}} onMouseEnter={e=>e.currentTarget.style.color=L.red} onMouseLeave={e=>e.currentTarget.style.color=L.t5}>⊗</button>
                                </div>
                              </div>
                              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:t.data_prazo||nomeUser(t.responsavel_id)?5:0}}>
                                <Tag color={TIPO_C[t.tipo]||L.teal} bg={TIPO_BG[t.tipo]||L.tealBg} small>{t.tipo}</Tag>
                                <Tag color={PRIO_C[t.prioridade]||L.yellow} bg={PRIO_BG[t.prioridade]||L.yellowBg} small>{t.prioridade}</Tag>
                              </div>
                              {(t.data_prazo||nomeUser(t.responsavel_id))&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:4}}>{t.data_prazo&&<span style={{fontSize:9.5,color:L.t4,fontFamily:"'JetBrains Mono',monospace"}}>{fmtDate(t.data_prazo)}</span>}{nomeUser(t.responsavel_id)&&<Av name={nomeUser(t.responsavel_id)} size={18} color={L.copper}/>}</div>}
                              {t.estimativa_horas&&<div style={{fontSize:9.5,color:L.t5,marginTop:3}}>⏱ {t.estimativa_horas}h</div>}
                            </div>
                          ))}
                          <button onClick={()=>openTarefa(null,col.id)}
                            style={{width:"100%",padding:"7px",borderRadius:7,fontSize:11,color:L.t5,border:`1.5px dashed ${L.line}`,background:"transparent",cursor:"pointer",fontFamily:"inherit",transition:"all .12s"}}
                            onMouseEnter={e=>{e.currentTarget.style.borderColor=L.teal;e.currentTarget.style.color=L.teal;e.currentTarget.style.background=L.tealBg;}}
                            onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t5;e.currentTarget.style.background="transparent";}}>
                            + Adicionar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ ABA: TAREFAS ══ */}
      {aba==="Tarefas"&&(
        <DataTable heads={["Tarefa","Projeto","Tipo","Prioridade","Responsável","Prazo","Status","Ações"]}>
          {tarefas.sort((a,b)=>{const po={critica:0,alta:1,media:2,baixa:3};return(po[a.prioridade]??2)-(po[b.prioridade]??2);}).map(t=>{
            const proj = projetos.find(p=>p.id===t.projeto_id);
            return (
              <tr key={t.id} style={{borderBottom:`1px solid ${L.lineSoft}`}}
                onMouseEnter={e=>e.currentTarget.style.background=L.surface}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{...TD,fontWeight:500,color:L.t1,maxWidth:200}}>
                  <div style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.titulo}</div>
                  {t.estimativa_horas&&<div style={{fontSize:9.5,color:L.t5}}>⏱ {t.estimativa_horas}h</div>}
                </td>
                <td style={{...TD,fontSize:11}}>
                  {proj?<span style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:7,height:7,borderRadius:"50%",background:proj.cor||L.teal}}/>{proj.nome}</span>:"—"}
                </td>
                <td style={TD}><Tag color={TIPO_C[t.tipo]||L.teal} bg={TIPO_BG[t.tipo]||L.tealBg}>{t.tipo}</Tag></td>
                <td style={TD}><Tag color={PRIO_C[t.prioridade]} bg={PRIO_BG[t.prioridade]}>{t.prioridade}</Tag></td>
                <td style={TD}>{nomeUser(t.responsavel_id)||<span style={{color:L.t5}}>—</span>}</td>
                <td style={{...TD,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:L.t4}}>{fmtDate(t.data_prazo)||"—"}</td>
                <td style={TD}>
                  <select value={t.status} onChange={e=>updT(t.id,{status:e.target.value})}
                    style={{padding:"4px 8px",borderRadius:6,fontSize:11,fontFamily:"inherit",border:`1px solid ${L.line}`,background:L.surface,color:L.t2,cursor:"pointer",outline:"none"}}>
                    {COLUNAS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </td>
                <td style={TD}>
                  <Row gap={4}>
                    <IBtn c={L.teal} onClick={()=>{setProjetoAtivo(t.projeto_id);setAba("Projetos");openTarefa(t);}}>✎</IBtn>
                    <IBtn c={L.red}  onClick={()=>{if(confirm("Excluir?"))remT(t.id);}}>⊗</IBtn>
                  </Row>
                </td>
              </tr>
            );
          })}
          {tarefas.length===0&&<tr><td colSpan={8} style={{...TD,textAlign:"center",color:L.t4,padding:40}}>Nenhuma tarefa cadastrada.</td></tr>}
        </DataTable>
      )}

      {/* ══ MODAIS ══ */}

      {/* Modal Chamado */}
      {modal==="chamado"&&(
        <Modal title={edit?"Editar Chamado":"Abrir Novo Chamado"} onClose={()=>setModal(false)} width={540}>
          <Field label="Título / Problema *">
            <Input value={form.titulo} onChange={F("titulo")} placeholder="Descreva resumidamente o problema ou solicitação"/>
          </Field>
          <Field label="Descrição detalhada">
            <textarea value={form.descricao||""} onChange={e=>F("descricao")(e.target.value)} rows={3}
              placeholder="Passos para reproduzir, contexto, prints, etc."
              style={{width:"100%",background:L.surface,border:`1.5px solid ${L.line}`,borderRadius:8,padding:"9px 12px",color:L.t1,fontSize:12,fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box",transition:"border-color .12s"}}
              onFocus={e=>e.target.style.borderColor=L.teal} onBlur={e=>e.target.style.borderColor=L.line}/>
          </Field>
          <div className="form-grid">
            <Field label="Tipo">
              <Select value={form.tipo} onChange={F("tipo")}>
                {Object.entries(TIPO_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Prioridade">
              <Select value={form.prioridade} onChange={F("prioridade")}>
                {["baixa","media","alta","critica"].map(p=><option key={p} value={p}>{p} — SLA {SLA_HORAS[p]}h</option>)}
              </Select>
            </Field>
            <Field label="Categoria">
              <Select value={form.categoria||"Sistema"} onChange={F("categoria")}>
                {CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Responsável (T.I)">
              <Select value={form.responsavel_id||""} onChange={F("responsavel_id")}>
                <option value="">A definir</option>
                {usuarios.filter(u=>u.ativo).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
              </Select>
            </Field>
            <Field label="Nome do Solicitante">
              <Input value={form.solicitante_nome||""} onChange={F("solicitante_nome")} placeholder="Quem está abrindo"/>
            </Field>
            <Field label="E-mail do Solicitante">
              <Input value={form.solicitante_email||""} onChange={F("solicitante_email")} type="email" placeholder="contato@empresa.com"/>
            </Field>
            <Field label="Empresa / Cliente" style={{gridColumn:"1/-1"}}>
              <Input value={form.cliente_nome||""} onChange={F("cliente_nome")} placeholder="Nome da empresa cliente (deixar vazio se for interno)"/>
            </Field>
          </div>
          {form.prioridade&&(
            <div style={{padding:"8px 12px",background:PRIO_BG[form.prioridade],borderRadius:8,fontSize:11,color:PRIO_C[form.prioridade],marginTop:4}}>
              SLA para prioridade {form.prioridade}: resposta em até <strong>{SLA_HORAS[form.prioridade]} hora{SLA_HORAS[form.prioridade]!==1?"s":""}</strong>
            </div>
          )}
          {err&&<div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginTop:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={saveChamado} loading={saving} label={edit?"Salvar Alterações":"Abrir Chamado"}/>
        </Modal>
      )}

      {/* Modal Projeto */}
      {modal==="projeto"&&(
        <Modal title={edit?"Editar Projeto":"Novo Projeto"} onClose={()=>setModal(false)} width={460}>
          <Field label="Nome *"><Input value={form.nome} onChange={F("nome")} placeholder="Ex: Redesign do Site"/></Field>
          <Field label="Descrição"><Input value={form.descricao||""} onChange={F("descricao")} placeholder="Objetivo do projeto"/></Field>
          <div className="form-grid">
            <Field label="Status"><Select value={form.status} onChange={F("status")}>{["ativo","em_pausa","concluido","cancelado"].map(s=><option key={s} value={s}>{s.replace("_"," ")}</option>)}</Select></Field>
            <Field label="Prioridade"><Select value={form.prioridade} onChange={F("prioridade")}>{["baixa","media","alta","critica"].map(p=><option key={p} value={p}>{p}</option>)}</Select></Field>
            <Field label="Data Início"><Input value={form.data_inicio||""} onChange={F("data_inicio")} type="date"/></Field>
            <Field label="Data Prazo"><Input value={form.data_fim||""} onChange={F("data_fim")} type="date"/></Field>
          </div>
          <Field label="Cor">
            <div style={{display:"flex",gap:8}}>{CORES_PROJ.map(c=><button key={c} onClick={()=>setForm(p=>({...p,cor:c}))} style={{width:28,height:28,borderRadius:8,background:c,border:form.cor===c?`3px solid ${L.t1}`:`2px solid transparent`,cursor:"pointer"}}/>)}</div>
          </Field>
          {err&&<div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginTop:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={saveProjeto} loading={saving} label={edit?"Salvar":"Criar Projeto"}/>
        </Modal>
      )}

      {/* Modal Tarefa */}
      {modal==="tarefa"&&(
        <Modal title={edit?"Editar Tarefa":"Nova Tarefa"} onClose={()=>setModal(false)} width={460}>
          <Field label="Título *"><Input value={form.titulo} onChange={F("titulo")} placeholder="Descreva a tarefa"/></Field>
          <Field label="Descrição"><Input value={form.descricao||""} onChange={F("descricao")} placeholder="Detalhes..."/></Field>
          <div className="form-grid">
            <Field label="Status"><Select value={form.status} onChange={F("status")}>{COLUNAS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>
            <Field label="Tipo"><Select value={form.tipo} onChange={F("tipo")}>{["tarefa","bug","feature","melhoria"].map(t=><option key={t} value={t}>{t}</option>)}</Select></Field>
            <Field label="Prioridade"><Select value={form.prioridade} onChange={F("prioridade")}>{["baixa","media","alta","critica"].map(p=><option key={p} value={p}>{p}</option>)}</Select></Field>
            <Field label="Responsável"><Select value={form.responsavel_id||""} onChange={F("responsavel_id")}><option value="">Sem responsável</option>{usuarios.filter(u=>u.ativo).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</Select></Field>
            <Field label="Data Prazo"><Input value={form.data_prazo||""} onChange={F("data_prazo")} type="date"/></Field>
            <Field label="Estimativa (h)"><Input value={form.estimativa_horas||""} onChange={F("estimativa_horas")} type="number" placeholder="0" step="0.5"/></Field>
          </div>
          {err&&<div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginTop:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={saveTarefa} loading={saving} label={edit?"Salvar":"Criar Tarefa"}/>
        </Modal>
      )}
    </Fade>
  );
}
