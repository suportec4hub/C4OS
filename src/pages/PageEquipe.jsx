import { useState } from "react";
import { L } from "../constants/theme";
import { useTable, criarUsuario } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { hasFullAccess, getCargoGroup } from "../lib/auth";
import { Fade, Row, Grid, TabPills, PBtn, DataTable, Av, Tag, IBtn, TD } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

// Perfis de acesso disponíveis
const PERFIS_ACESSO = [
  { v:"vendas",     l:"Vendas",              role:"client_user",  pa:"vendas"     },
  { v:"marketing",  l:"Marketing",           role:"client_user",  pa:"marketing"  },
  { v:"trafego",    l:"Tráfego Pago",        role:"client_user",  pa:"trafego"    },
  { v:"digital",    l:"Digital / Produto",   role:"client_user",  pa:"digital"    },
  { v:"financeiro", l:"Financeiro",          role:"client_user",  pa:"financeiro" },
  { v:"rh",         l:"RH / Pessoas",        role:"client_user",  pa:"rh"         },
  { v:"suporte",    l:"Suporte / CS",        role:"client_user",  pa:"suporte"    },
  { v:"ti",         l:"T.I (Acesso Total)",  role:"client_user",  pa:"full"       },
  { v:"admin",      l:"Admin Empresa",       role:"client_admin", pa:"full"       },
];
const PERFIS_C4HUB = [
  ...PERFIS_ACESSO,
  { v:"c4hub_admin", l:"Admin C4HUB",        role:"c4hub_admin",  pa:null         },
];

// Cargos predefinidos por setor
const CARGOS_GRUPOS = [
  { g:"C-Level & Diretoria", items:["CEO","COO","CFO","CTO","CMO","Diretor","Co-Founder","Sócio","Presidente","VP"] },
  { g:"Vendas",              items:["Gerente de Vendas","Coordenador de Vendas","SDR","BDR","Closer","Hunter","Farmer","Executivo de Vendas","Representante de Vendas"] },
  { g:"Marketing",           items:["Gerente de Marketing","Analista de Marketing","Social Media","Designer","Redator","Copywriter","Branding"] },
  { g:"Tráfego Pago",        items:["Gestor de Tráfego","Analista de Mídia Paga","Media Buyer"] },
  { g:"Digital / Produto",   items:["Desenvolvedor","Analista Digital","UX Designer","Product Manager","Web Designer"] },
  { g:"T.I",                 items:["Analista de T.I","Suporte T.I","Infraestrutura","DevOps"] },
  { g:"Financeiro",          items:["Gerente Financeiro","Analista Financeiro","Controladoria","Contabilidade","Fiscal"] },
  { g:"RH / Pessoas",        items:["Gerente de RH","Analista de RH","Recrutamento","DP"] },
  { g:"Suporte / CS",        items:["Gerente de CS","Customer Success","Atendimento","SAC","Helpdesk","Pós-Venda"] },
  { g:"Outros",              items:["Assistente","Estagiário","Freelancer"] },
];

const FILTRO_GROUP = { Vendas:"vendas", Marketing:"marketing", Tráfego:"trafego", Digital:"digital", Financeiro:"financeiro", RH:"rh", Suporte:"suporte", "T.I":"full" };

const rc  = { c4hub_admin:L.teal, client_admin:L.teal, client_user:L.copper };
const rbg = { c4hub_admin:L.tealBg, client_admin:L.tealBg, client_user:L.copperBg };

// Derive perfil value from user data
function derivarPerfil(m, perfisOpt) {
  if (m.role === "c4hub_admin") return "c4hub_admin";
  if (m.role === "client_admin") return "admin";
  if (m.perfil_acesso) {
    const found = perfisOpt.find(p => p.pa === m.perfil_acesso && p.role === m.role);
    if (found) return found.v;
    if (m.perfil_acesso === "full") return "ti";
  }
  const group = getCargoGroup(m);
  const found = perfisOpt.find(p => p.pa === group);
  return found?.v || "vendas";
}

const VAZIO = { nome:"", email:"", senha:"", cargo:"", whatsapp:"", perfil:"vendas" };

export default function PageEquipe({ user }) {
  const isAdmin    = hasFullAccess(user) || user?.role === "client_admin";
  const isC4Admin  = hasFullAccess(user) && user?.role === "c4hub_admin";
  const perfisOpt  = isC4Admin ? PERFIS_C4HUB : PERFIS_ACESSO;

  // Sempre filtra por empresa_id — Admin C4HUB vê todos os usuários em PageUsers
  const { data: usuarios, loading, update, remove, refetch } = useTable("usuarios", {
    empresa_id: user?.empresa_id,
  });

  const [filtro,        setFiltro]        = useState("Todos");
  const [modal,         setModal]         = useState(false);
  const [selected,      setSelected]      = useState(null);
  const [form,          setForm]          = useState(VAZIO);
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState("");
  const [succ,          setSucc]          = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // usuário a excluir
  const [deleting,      setDeleting]      = useState(false);

  const filtered = usuarios.filter(m => {
    if (filtro === "Todos")   return true;
    if (filtro === "Admin")   return m.role === "client_admin" || m.role === "c4hub_admin";
    if (filtro === "Inativo") return !m.ativo;
    const groupTarget = FILTRO_GROUP[filtro];
    if (groupTarget) return getCargoGroup(m) === groupTarget;
    return true;
  });

  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  const openNovo = () => {
    setForm(VAZIO); setErr(""); setSucc(""); setSelected(null); setModal("novo");
  };

  const openEditar = (m) => {
    setForm({ nome: m.nome, cargo: m.cargo || "", whatsapp: m.whatsapp || "", perfil: derivarPerfil(m, perfisOpt), email:"", senha:"" });
    setSelected(m); setErr(""); setSucc(""); setModal("editar");
  };

  const openDetalhes = (m) => { setSelected(m); setModal("detalhes"); };

  const salvarNovo = async () => {
    if (!form.email || !form.senha || !form.nome) { setErr("Nome, e-mail e senha são obrigatórios."); return; }
    if (form.senha.length < 6) { setErr("Senha mínima: 6 caracteres."); return; }
    setSaving(true); setErr("");
    const perfilItem = perfisOpt.find(p => p.v === form.perfil) || perfisOpt[0];
    const res = await criarUsuario({
      email:        form.email.trim().toLowerCase(),
      senha:        form.senha,
      nome:         form.nome.trim(),
      cargo:        form.cargo,
      whatsapp:     form.whatsapp,
      role:         perfilItem.role,
      empresa_id:   user?.empresa_id,
      perfil_acesso: perfilItem.pa,
    });
    if (res.error) setErr(res.error);
    else { setSucc(`${form.nome} adicionado à equipe!`); refetch(); }
    setSaving(false);
  };

  const salvarEdicao = async () => {
    if (!selected) return;
    setSaving(true); setErr("");
    const perfilItem = perfisOpt.find(p => p.v === form.perfil) || perfisOpt[0];
    // Protege contra downgrade de c4hub_admin por não-c4hub
    const newRole = (selected.role === "c4hub_admin" && !isC4Admin) ? "c4hub_admin" : perfilItem.role;
    const changes = {
      nome:          form.nome,
      cargo:         form.cargo,
      whatsapp:      form.whatsapp,
      role:          newRole,
      perfil_acesso: perfilItem.pa,
    };
    const { error } = await update(selected.id, changes);
    if (error) setErr(error.message || "Erro ao salvar.");
    else { setSucc("Alterações salvas!"); refetch(); setTimeout(() => setModal(false), 1200); }
    setSaving(false);
  };

  const toggleAtivo = async (m) => { await update(m.id, { ativo: !m.ativo }); };

  const excluirConfirmado = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    await supabase.auth.admin?.deleteUser?.(confirmDelete.id).catch(() => {});
    await remove(confirmDelete.id);
    setConfirmDelete(null);
    setDeleting(false);
  };

  const ativos   = usuarios.filter(m => m.ativo).length;

  // Label do perfil para exibição
  const perfilLabel = (m) => {
    const p = perfisOpt.find(x => x.v === derivarPerfil(m, perfisOpt));
    return p?.l || "Vendas";
  };

  const TABS = ["Todos","Admin","Vendas","Marketing","Tráfego","Digital","Financeiro","RH","Suporte","T.I","Inativo"];

  return (
    <Fade>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:14}}>
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <TabPills tabs={TABS} active={filtro} onChange={setFiltro}/>
        </div>
        {isAdmin && <PBtn onClick={openNovo}>+ Convidar</PBtn>}
      </div>

      <Grid cols={3} gap={12} mb={14} responsive>
        {[
          { l:"Ativos",           v:ativos,                                        c:L.teal },
          { l:"Leads Atribuídos", v:usuarios.reduce((s,m)=>s+(m.leads||0),0),     c:L.copper },
          { l:"Deals Fechados",   v:usuarios.reduce((s,m)=>s+(m.fechados||0),0),  c:L.green },
        ].map((k,i) => (
          <div key={i} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"15px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:10,color:L.t4,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:6,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{k.l}</div>
            <div style={{fontSize:22,fontWeight:700,color:k.c,fontFamily:"'Outfit',sans-serif"}}>{k.v}</div>
          </div>
        ))}
      </Grid>

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando equipe...</div>
      ) : (
        <DataTable heads={["Membro","Cargo","Perfil de Acesso","Leads","Fechados","Conv.","Status","Ações"]}>
          {filtered.map(m => (
            <tr key={m.id} style={{borderBottom:`1px solid ${L.lineSoft}`,opacity:m.ativo?1:0.55}}
              onMouseEnter={e=>e.currentTarget.style.background=L.surface}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            >
              <td style={TD}>
                <Row gap={9}>
                  <Av name={m.nome} color={rc[m.role]||L.t3}/>
                  <div>
                    <div style={{fontSize:12.5,fontWeight:500,color:L.t1}}>{m.nome}</div>
                    <div style={{fontSize:10,color:L.t4}}>{m.whatsapp || "—"}</div>
                  </div>
                </Row>
              </td>
              <td style={{...TD,color:L.t3,fontSize:11.5}}>{m.cargo||"—"}</td>
              <td style={TD}>
                <Tag color={rc[m.role]||L.t3} bg={rbg[m.role]||L.surface}>{perfilLabel(m)}</Tag>
              </td>
              <td style={{...TD,textAlign:"center",fontWeight:600,color:L.t1}}>{m.leads||0}</td>
              <td style={{...TD,textAlign:"center",fontWeight:600,color:L.green}}>{m.fechados||0}</td>
              <td style={{...TD,fontFamily:"'JetBrains Mono',monospace",color:L.copper,fontSize:11}}>{m.conv||"—"}</td>
              <td style={TD}><Tag color={m.ativo?L.green:L.red} bg={m.ativo?L.greenBg:L.redBg}>{m.ativo?"Ativo":"Inativo"}</Tag></td>
              <td style={TD}>
                <Row gap={5}>
                  <IBtn c={L.teal}              title="Ver detalhes"  onClick={()=>openDetalhes(m)}>◷</IBtn>
                  {isAdmin && <IBtn c={L.t3}    title="Editar"        onClick={()=>openEditar(m)}>✎</IBtn>}
                  {isAdmin && <IBtn c={m.ativo?L.red:L.green} title={m.ativo?"Desativar":"Ativar"} onClick={()=>toggleAtivo(m)}>{m.ativo?"⊗":"✓"}</IBtn>}
                  {isC4Admin && <IBtn c={L.red}  title="Excluir permanentemente" onClick={()=>setConfirmDelete(m)}>🗑</IBtn>}
                </Row>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={8} style={{...TD,textAlign:"center",color:L.t4,padding:32}}>Nenhum membro encontrado.</td></tr>
          )}
        </DataTable>
      )}

      {/* Modal — Novo membro */}
      {modal === "novo" && (
        <Modal title="Convidar Membro da Equipe" onClose={()=>setModal(false)} width={480}>
          {succ ? (
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{fontSize:32,marginBottom:12}}>✓</div>
              <div style={{fontSize:14,fontWeight:600,color:L.green,marginBottom:4}}>{succ}</div>
              <div style={{fontSize:12,color:L.t3,marginBottom:20}}>O membro pode fazer login imediatamente.</div>
              <Row gap={8} justify="center">
                <IBtn c={L.teal} onClick={openNovo}>Convidar outro</IBtn>
                <IBtn c={L.t3}   onClick={()=>setModal(false)}>Fechar</IBtn>
              </Row>
            </div>
          ) : (
            <>
              <Field label="Nome completo *"><Input value={form.nome} onChange={F("nome")} placeholder="Nome do membro"/></Field>
              <div className="form-grid">
                <Field label="E-mail *">    <Input value={form.email}    onChange={F("email")}    type="email"    placeholder="email@empresa.com"/></Field>
                <Field label="Senha *">     <Input value={form.senha}    onChange={F("senha")}    type="password" placeholder="Mínimo 6 caracteres"/></Field>
                <Field label="Cargo / Setor">
                  <Select value={form.cargo} onChange={F("cargo")}>
                    <option value="">Selecionar cargo...</option>
                    {CARGOS_GRUPOS.map(g => (
                      <optgroup key={g.g} label={g.g}>
                        {g.items.map(c => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                    ))}
                  </Select>
                </Field>
                <Field label="WhatsApp"><Input value={form.whatsapp} onChange={F("whatsapp")} placeholder="(11) 99999-0000"/></Field>
                <Field label="Perfil de acesso" style={{gridColumn:"1/-1"}}>
                  <Select value={form.perfil} onChange={F("perfil")}>
                    {perfisOpt.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
                  </Select>
                </Field>
              </div>
              {err && <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginBottom:4}}>{err}</div>}
              <ModalFooter onClose={()=>setModal(false)} onSave={salvarNovo} loading={saving} label="Convidar Membro"/>
            </>
          )}
        </Modal>
      )}

      {/* Modal — Editar */}
      {modal === "editar" && selected && (
        <Modal title={`Editar — ${selected.nome}`} onClose={()=>setModal(false)} width={440}>
          {succ ? (
            <div style={{textAlign:"center",padding:"16px 0",color:L.green,fontWeight:600}}>{succ}</div>
          ) : (
            <>
              <div className="form-grid">
                <Field label="Nome completo"><Input value={form.nome}     onChange={F("nome")}/></Field>
                <Field label="WhatsApp">     <Input value={form.whatsapp} onChange={F("whatsapp")} placeholder="(11) 99999-0000"/></Field>
                <Field label="Cargo / Setor" style={{gridColumn:"1/-1"}}>
                  <Select value={form.cargo} onChange={F("cargo")}>
                    <option value="">Selecionar cargo...</option>
                    {CARGOS_GRUPOS.map(g => (
                      <optgroup key={g.g} label={g.g}>
                        {g.items.map(c => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                    ))}
                  </Select>
                </Field>
                <Field label="Perfil de acesso" style={{gridColumn:"1/-1"}}>
                  <Select value={form.perfil} onChange={F("perfil")}>
                    {perfisOpt.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
                  </Select>
                </Field>
              </div>
              {err && <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginBottom:4}}>{err}</div>}
              <ModalFooter onClose={()=>setModal(false)} onSave={salvarEdicao} loading={saving} label="Salvar Alterações"/>
            </>
          )}
        </Modal>
      )}

      {/* Modal — Detalhes */}
      {modal === "detalhes" && selected && (
        <Modal title="Detalhes do Membro" onClose={()=>setModal(false)} width={420}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <Av name={selected.nome} color={rc[selected.role]||L.t3} size={52}/>
            <div style={{fontSize:16,fontWeight:700,color:L.t1,marginTop:10}}>{selected.nome}</div>
            <div style={{fontSize:12,color:L.t4,marginTop:2}}>{selected.cargo||"—"}</div>
            <Tag color={rc[selected.role]||L.t3} bg={rbg[selected.role]||L.surface}>{perfilLabel(selected)}</Tag>
          </div>
          {[
            ["WhatsApp",      selected.whatsapp||"—"],
            ["Leads",         selected.leads||0],
            ["Fechados",      selected.fechados||0],
            ["Conversão",     selected.conv||"—"],
            ["Status",        selected.ativo?"Ativo":"Inativo"],
            ["Último acesso", selected.ultimo_acesso ? new Date(selected.ultimo_acesso).toLocaleDateString("pt-BR") : "—"],
          ].map(([k,v]) => (
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${L.lineSoft}`}}>
              <span style={{fontSize:11,color:L.t4}}>{k}</span>
              <span style={{fontSize:12.5,color:L.t1,fontWeight:500}}>{v}</span>
            </div>
          ))}
          {isAdmin && (
            <div style={{marginTop:16,display:"flex",gap:8}}>
              <button onClick={()=>{setModal(false);openEditar(selected);}}
                style={{flex:1,padding:"8px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.tealBg,color:L.teal,border:`1px solid ${L.teal}22`}}>
                Editar
              </button>
              <button onClick={()=>toggleAtivo(selected).then(()=>setModal(false))}
                style={{flex:1,padding:"8px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:selected.ativo?L.redBg:L.greenBg,color:selected.ativo?L.red:L.green,border:`1px solid ${(selected.ativo?L.red:L.green)}22`}}>
                {selected.ativo?"Desativar":"Ativar"}
              </button>
            </div>
          )}
        </Modal>
      )}
      {/* Modal confirmação de exclusão */}
      {confirmDelete && (
        <Modal title="Excluir usuário permanentemente" onClose={()=>setConfirmDelete(null)} width={420}>
          <div style={{padding:"8px 0 20px"}}>
            <div style={{display:"flex",alignItems:"center",gap:14,padding:"16px",background:L.redBg,borderRadius:10,border:`1px solid ${L.red}33`,marginBottom:18}}>
              <span style={{fontSize:28}}>⚠️</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:L.red,marginBottom:3}}>Esta ação é permanente</div>
                <div style={{fontSize:12,color:L.t2,lineHeight:1.5}}>O usuário será removido do sistema e perderá acesso imediatamente. Esta operação não pode ser desfeita.</div>
              </div>
            </div>

            <div style={{background:L.surface,borderRadius:8,padding:"12px 14px",marginBottom:20,border:`1px solid ${L.line}`}}>
              <div style={{fontSize:12,color:L.t3,marginBottom:4}}>Usuário a ser excluído:</div>
              <div style={{fontSize:14,fontWeight:700,color:L.t1}}>{confirmDelete.nome}</div>
              <div style={{fontSize:12,color:L.t3}}>{confirmDelete.cargo||"—"} · {confirmDelete.role}</div>
            </div>

            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirmDelete(null)} disabled={deleting}
                style={{flex:1,padding:"10px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.surface,color:L.t2,border:`1px solid ${L.line}`}}>
                Cancelar
              </button>
              <button onClick={excluirConfirmado} disabled={deleting}
                style={{flex:1,padding:"10px",borderRadius:8,fontSize:13,fontWeight:600,cursor:deleting?"wait":"pointer",fontFamily:"inherit",background:L.red,color:"#fff",border:"none",opacity:deleting?.7:1}}>
                {deleting ? "Excluindo..." : "🗑 Excluir Permanentemente"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Fade>
  );
}
