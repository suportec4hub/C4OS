import { useState } from "react";
import { L } from "../constants/theme";
import { useTable, criarUsuario } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { hasFullAccess } from "../lib/auth";
import { Fade, Row, Grid, PBtn, DataTable, Av, Tag, IBtn, TD } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const ROLES = [
  {v:"client_user",  l:"Vendedor / Usuário"},
  {v:"client_admin", l:"Admin Cliente"},
  {v:"c4hub_admin",  l:"Admin C4HUB"},
];
const VAZIO      = { nome:"", email:"", senha:"", cargo:"", role:"client_user" };
const VAZIO_EDIT = { nome:"", cargo:"", role:"client_user", novaSenha:"" };

export default function PageUsers({ user }) {
  const isAdmin = hasFullAccess(user);
  const { data: usuarios, loading, update, remove, refetch } = useTable("usuarios", {
    empresa_id: isAdmin ? undefined : user?.empresa_id,
  });

  /* ── novo usuário ── */
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState(VAZIO);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");
  const [succ,    setSucc]    = useState("");

  /* ── editar ── */
  const [editTarget,  setEditTarget]  = useState(null);
  const [editForm,    setEditForm]    = useState(VAZIO_EDIT);
  const [editSaving,  setEditSaving]  = useState(false);
  const [editErr,     setEditErr]     = useState("");

  /* ── excluir ── */
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting,      setDeleting]      = useState(false);

  const rc  = { c4hub_admin:{c:L.teal,bg:L.tealBg}, client_admin:{c:L.copper,bg:L.copperBg}, client_user:{c:L.blue,bg:L.blueBg} };

  /* ── handlers novo ── */
  const openNew = () => { setForm(VAZIO); setErr(""); setSucc(""); setModal(true); };

  const save = async () => {
    if (!form.email || !form.senha || !form.nome) { setErr("Nome, e-mail e senha são obrigatórios."); return; }
    if (form.senha.length < 6) { setErr("Senha mínima: 6 caracteres."); return; }
    setSaving(true); setErr(""); setSucc("");
    const res = await criarUsuario({
      email:      form.email.trim().toLowerCase(),
      senha:      form.senha,
      nome:       form.nome.trim(),
      cargo:      form.cargo,
      role:       form.role,
      empresa_id: user?.empresa_id,
    });
    if (res.error) setErr(res.error);
    else { setSucc(`Usuário ${form.nome} criado com sucesso!`); setForm(VAZIO); refetch(); }
    setSaving(false);
  };

  /* ── handlers editar ── */
  const openEdit = (u) => {
    setEditTarget(u);
    setEditForm({ nome: u.nome||"", cargo: u.cargo||"", role: u.role||"client_user", novaSenha:"" });
    setEditErr("");
  };

  const saveEdit = async () => {
    if (!editForm.nome.trim()) { setEditErr("Nome é obrigatório."); return; }
    setEditSaving(true); setEditErr("");

    const changes = { nome: editForm.nome.trim(), cargo: editForm.cargo, role: editForm.role };
    await update(editTarget.id, changes);

    // reset de senha se preenchida
    if (editForm.novaSenha && editForm.novaSenha.length >= 6) {
      await supabase.auth.admin?.updateUserById?.(editTarget.id, { password: editForm.novaSenha }).catch(()=>{});
    }

    setEditTarget(null);
    setEditSaving(false);
  };

  /* ── handlers excluir ── */
  const excluirConfirmado = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    await supabase.auth.admin?.deleteUser?.(confirmDelete.id).catch(()=>{});
    await remove(confirmDelete.id);
    setConfirmDelete(null);
    setDeleting(false);
  };

  /* ── toggle ativo ── */
  const toggleAtivo = async (u) => { await update(u.id, { ativo: !u.ativo }); };

  const F  = k => v => setForm(p => ({ ...p, [k]: v }));
  const EF = k => v => setEditForm(p => ({ ...p, [k]: v }));

  return (
    <Fade>
      <Row between mb={14}>
        <Grid cols={3} gap={12} responsive>
          {[
            {l:"Ativos",   v:usuarios.filter(u=>u.ativo).length,  c:L.teal},
            {l:"Inativos", v:usuarios.filter(u=>!u.ativo).length, c:L.red},
            {l:"Total",    v:usuarios.length,                      c:L.t2},
          ].map((k,i)=>(
            <div key={i} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"13px 16px"}}>
              <div style={{fontSize:9,color:L.t4,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
              <div style={{fontSize:20,fontWeight:700,color:k.c,fontFamily:"'Outfit',sans-serif"}}>{k.v}</div>
            </div>
          ))}
        </Grid>
        <PBtn onClick={openNew}>+ Convidar Usuário</PBtn>
      </Row>

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando usuários...</div>
      ) : (
        <DataTable heads={["Usuário","Cargo","Perfil","Status","Último Acesso","Ações"]}>
          {usuarios.map(u => (
            <tr key={u.id} style={{borderBottom:`1px solid ${L.lineSoft}`}}
              onMouseEnter={e=>e.currentTarget.style.background=L.surface}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            >
              <td style={TD}>
                <Row gap={9}>
                  <Av name={u.nome} color={rc[u.role]?.c||L.t3}/>
                  <div>
                    <div style={{fontSize:12.5,fontWeight:500,color:L.t1}}>{u.nome}</div>
                  </div>
                </Row>
              </td>
              <td style={{...TD,color:L.t3,fontSize:11.5}}>{u.cargo||"—"}</td>
              <td style={TD}><Tag color={rc[u.role]?.c||L.t3} bg={rc[u.role]?.bg||L.surface}>{ROLES.find(r=>r.v===u.role)?.l||u.role}</Tag></td>
              <td style={TD}><Tag color={u.ativo?L.green:L.red} bg={u.ativo?L.greenBg:L.redBg}>{u.ativo?"Ativo":"Inativo"}</Tag></td>
              <td style={{...TD,color:L.t4,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>
                {u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleDateString("pt-BR") : "—"}
              </td>
              <td style={TD}>
                <Row gap={5}>
                  <IBtn c={L.t3}              title="Editar"                    onClick={()=>openEdit(u)}>✎</IBtn>
                  <IBtn c={u.ativo?L.red:L.green} title={u.ativo?"Desativar":"Ativar"} onClick={()=>toggleAtivo(u)}>
                    {u.ativo?"Desativar":"Ativar"}
                  </IBtn>
                  <IBtn c={L.red}             title="Excluir permanentemente"   onClick={()=>setConfirmDelete(u)}>🗑</IBtn>
                </Row>
              </td>
            </tr>
          ))}
          {usuarios.length === 0 && (
            <tr><td colSpan={6} style={{...TD,textAlign:"center",color:L.t4,padding:32}}>Nenhum usuário encontrado.</td></tr>
          )}
        </DataTable>
      )}

      {/* ── Modal: Novo usuário ── */}
      {modal && (
        <Modal title="Convidar Novo Usuário" onClose={()=>setModal(false)} width={460}>
          {succ ? (
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{fontSize:32,marginBottom:12}}>✓</div>
              <div style={{fontSize:14,fontWeight:600,color:L.green,marginBottom:4}}>{succ}</div>
              <div style={{fontSize:12,color:L.t3,marginBottom:20}}>O usuário pode fazer login imediatamente.</div>
              <Row gap={8} justify="center">
                <IBtn c={L.teal} onClick={openNew}>Criar outro</IBtn>
                <IBtn c={L.t3}   onClick={()=>setModal(false)}>Fechar</IBtn>
              </Row>
            </div>
          ) : (
            <>
              <Field label="Nome completo *"><Input value={form.nome} onChange={F("nome")} placeholder="Nome do usuário"/></Field>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
                <Field label="E-mail *"><Input value={form.email} onChange={F("email")} type="email" placeholder="email@empresa.com"/></Field>
                <Field label="Senha *"><Input value={form.senha} onChange={F("senha")} type="password" placeholder="Mínimo 6 caracteres"/></Field>
                <Field label="Cargo"><Input value={form.cargo} onChange={F("cargo")} placeholder="Ex: SDR, Closer..."/></Field>
                <Field label="Perfil de acesso">
                  <Select value={form.role} onChange={F("role")}>
                    {ROLES.filter(r => isAdmin || r.v !== "c4hub_admin").map(r=><option key={r.v} value={r.v}>{r.l}</option>)}
                  </Select>
                </Field>
              </div>
              {err && <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginBottom:4}}>{err}</div>}
              <ModalFooter onClose={()=>setModal(false)} onSave={save} loading={saving} label="Criar Usuário"/>
            </>
          )}
        </Modal>
      )}

      {/* ── Modal: Editar usuário ── */}
      {editTarget && (
        <Modal title={`Editar — ${editTarget.nome}`} onClose={()=>setEditTarget(null)} width={460}>
          <Field label="Nome completo *">
            <Input value={editForm.nome} onChange={EF("nome")} placeholder="Nome do usuário"/>
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
            <Field label="Cargo">
              <Input value={editForm.cargo} onChange={EF("cargo")} placeholder="Ex: SDR, Closer..."/>
            </Field>
            <Field label="Perfil de acesso">
              <Select value={editForm.role} onChange={EF("role")}>
                {ROLES.filter(r => isAdmin || r.v !== "c4hub_admin").map(r=><option key={r.v} value={r.v}>{r.l}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Nova senha (deixe vazio para não alterar)">
            <Input value={editForm.novaSenha} onChange={EF("novaSenha")} type="password" placeholder="Mínimo 6 caracteres"/>
          </Field>
          {editErr && <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginBottom:4}}>{editErr}</div>}
          <ModalFooter onClose={()=>setEditTarget(null)} onSave={saveEdit} loading={editSaving} label="Salvar Alterações"/>
        </Modal>
      )}

      {/* ── Modal: Confirmar exclusão ── */}
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
              <div style={{fontSize:12,color:L.t3}}>{confirmDelete.cargo||"—"} · {ROLES.find(r=>r.v===confirmDelete.role)?.l||confirmDelete.role}</div>
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
