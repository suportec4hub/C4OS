import { useState } from "react";
import { L } from "../constants/theme";
import { useTable, criarUsuario } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { hasFullAccess } from "../lib/auth";
import { Fade, Row, Grid, TabPills, PBtn, DataTable, Av, Tag, IBtn, TD } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const ROLES_LABEL = { c4hub_admin:"Admin C4HUB", client_admin:"Admin", client_user:"Vendedor" };
// Opções disponíveis para editor c4hub_admin (pode promover a c4hub_admin)
const ROLES_OPT_FULL = [
  { v:"client_user",  l:"Vendedor" },
  { v:"client_admin", l:"Admin" },
  { v:"c4hub_admin",  l:"Admin C4HUB (Acesso Total)" },
];
// Opções para editor client_admin (não pode promover a c4hub_admin)
const ROLES_OPT_LIMITED = [
  { v:"client_user",  l:"Vendedor" },
  { v:"client_admin", l:"Admin" },
];
const rc  = { c4hub_admin:L.teal,   client_admin:L.teal,   client_user:L.copper };
const rbg = { c4hub_admin:L.tealBg, client_admin:L.tealBg, client_user:L.copperBg };

const VAZIO = { nome:"", email:"", senha:"", cargo:"", whatsapp:"", role:"client_user" };

export default function PageEquipe({ user }) {
  const isAdmin    = hasFullAccess(user) || user?.role === "client_admin";
  const isC4Admin  = hasFullAccess(user);
  const rolesOpt   = isC4Admin ? ROLES_OPT_FULL : ROLES_OPT_LIMITED;

  const { data: usuarios, loading, update, remove, refetch } = useTable("usuarios", {
    empresa_id: user?.role === "c4hub_admin" ? undefined : user?.empresa_id,
  });

  const [filtro,    setFiltro]    = useState("Todos");
  const [modal,     setModal]     = useState(false);  // "novo" | "editar" | "detalhes" | false
  const [selected,  setSelected]  = useState(null);
  const [form,      setForm]      = useState(VAZIO);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");
  const [succ,      setSucc]      = useState("");

  const filtered = usuarios.filter(m => {
    if (filtro === "Todos")    return true;
    if (filtro === "Admin")    return m.role === "client_admin" || m.role === "c4hub_admin";
    if (filtro === "Vendedor") return m.role === "client_user";
    if (filtro === "Inativo")  return !m.ativo;
    return true;
  });

  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  const openNovo = () => {
    setForm(VAZIO); setErr(""); setSucc(""); setSelected(null); setModal("novo");
  };

  const openEditar = (m) => {
    setForm({ nome: m.nome, cargo: m.cargo || "", whatsapp: m.whatsapp || "", role: m.role, email:"", senha:"" });
    setSelected(m); setErr(""); setSucc(""); setModal("editar");
  };

  // Impede downgrade: salva c4hub_admin se o usuário editado for c4hub_admin e o editor não for c4hub_admin
  const safeRole = (targetUser, newRole) => {
    if (targetUser?.role === "c4hub_admin" && !isC4Admin) return "c4hub_admin";
    return newRole;
  };

  const openDetalhes = (m) => {
    setSelected(m); setModal("detalhes");
  };

  const salvarNovo = async () => {
    if (!form.email || !form.senha || !form.nome) { setErr("Nome, e-mail e senha são obrigatórios."); return; }
    if (form.senha.length < 6) { setErr("Senha mínima: 6 caracteres."); return; }
    setSaving(true); setErr("");
    const res = await criarUsuario({
      email: form.email.trim().toLowerCase(),
      senha: form.senha,
      nome: form.nome.trim(),
      cargo: form.cargo,
      role: form.role,
      empresa_id: user?.empresa_id,
    });
    if (res.error) setErr(res.error);
    else { setSucc(`${form.nome} adicionado à equipe!`); refetch(); }
    setSaving(false);
  };

  const salvarEdicao = async () => {
    if (!selected) return;
    setSaving(true); setErr("");
    const changes = { nome: form.nome, cargo: form.cargo, role: safeRole(selected, form.role) };
    if (form.whatsapp) changes.whatsapp = form.whatsapp;
    const { error } = await update(selected.id, changes);
    if (error) setErr(error.message || "Erro ao salvar.");
    else { setSucc("Alterações salvas!"); refetch(); setTimeout(() => setModal(false), 1200); }
    setSaving(false);
  };

  const toggleAtivo = async (m) => {
    await update(m.id, { ativo: !m.ativo });
  };

  const excluir = async (m) => {
    if (!window.confirm(`Remover ${m.nome} da equipe?`)) return;
    await supabase.auth.admin?.deleteUser?.(m.id).catch(() => {});
    await remove(m.id);
  };

  const ativos   = usuarios.filter(m => m.ativo).length;
  const inativos = usuarios.filter(m => !m.ativo).length;

  return (
    <Fade>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:14}}>
        <TabPills tabs={["Todos","Admin","Vendedor","Inativo"]} active={filtro} onChange={setFiltro}/>
        {isAdmin && <PBtn onClick={openNovo}>+ Convidar</PBtn>}
      </div>

      <Grid cols={3} gap={12} mb={14} responsive>
        {[
          { l:"Ativos",           v:ativos,                                              c:L.teal },
          { l:"Leads Atribuídos", v:usuarios.reduce((s,m)=>s+(m.leads||0),0),           c:L.copper },
          { l:"Deals Fechados",   v:usuarios.reduce((s,m)=>s+(m.fechados||0),0),        c:L.green },
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
        <DataTable heads={["Membro","Cargo","Perfil","Leads","Fechados","Conv.","Status","Ações"]}>
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
              <td style={TD}><Tag color={rc[m.role]||L.t3} bg={rbg[m.role]||L.surface}>{ROLES_LABEL[m.role]||m.role}</Tag></td>
              <td style={{...TD,textAlign:"center",fontWeight:600,color:L.t1}}>{m.leads||0}</td>
              <td style={{...TD,textAlign:"center",fontWeight:600,color:L.green}}>{m.fechados||0}</td>
              <td style={{...TD,fontFamily:"'JetBrains Mono',monospace",color:L.copper,fontSize:11}}>{m.conv||"—"}</td>
              <td style={TD}><Tag color={m.ativo?L.green:L.red} bg={m.ativo?L.greenBg:L.redBg}>{m.ativo?"Ativo":"Inativo"}</Tag></td>
              <td style={TD}>
                <Row gap={5}>
                  <IBtn c={L.teal}    title="Ver detalhes"  onClick={()=>openDetalhes(m)}>◷</IBtn>
                  {isAdmin && <IBtn c={L.t3} title="Editar" onClick={()=>openEditar(m)}>✎</IBtn>}
                  {isAdmin && <IBtn c={m.ativo?L.red:L.green} title={m.ativo?"Desativar":"Ativar"} onClick={()=>toggleAtivo(m)}>{m.ativo?"⊗":"✓"}</IBtn>}
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
                <Field label="E-mail *"><Input value={form.email} onChange={F("email")} type="email" placeholder="email@empresa.com"/></Field>
                <Field label="Senha *"><Input value={form.senha} onChange={F("senha")} type="password" placeholder="Mínimo 6 caracteres"/></Field>
                <Field label="Cargo"><Input value={form.cargo} onChange={F("cargo")} placeholder="Ex: SDR, Closer, CS..."/></Field>
                <Field label="WhatsApp"><Input value={form.whatsapp} onChange={F("whatsapp")} placeholder="(11) 99999-0000"/></Field>
                <Field label="Perfil de acesso" style={{gridColumn:"1/-1"}}>
                  <Select value={form.role} onChange={F("role")}>
                    {rolesOpt.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}
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
                <Field label="Nome completo"><Input value={form.nome} onChange={F("nome")}/></Field>
                <Field label="Cargo"><Input value={form.cargo} onChange={F("cargo")} placeholder="Ex: SDR, Closer..."/></Field>
                <Field label="WhatsApp"><Input value={form.whatsapp} onChange={F("whatsapp")} placeholder="(11) 99999-0000"/></Field>
                <Field label="Perfil de acesso">
                  <Select value={form.role} onChange={F("role")}>
                    {rolesOpt.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}
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
            <Tag color={rc[selected.role]||L.t3} bg={rbg[selected.role]||L.surface}>{ROLES_LABEL[selected.role]||selected.role}</Tag>
          </div>
          {[
            ["WhatsApp",   selected.whatsapp||"—"],
            ["Leads",      selected.leads||0],
            ["Fechados",   selected.fechados||0],
            ["Conversão",  selected.conv||"—"],
            ["Status",     selected.ativo?"Ativo":"Inativo"],
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
    </Fade>
  );
}
