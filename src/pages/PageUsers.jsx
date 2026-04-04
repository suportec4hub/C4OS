import { useState } from "react";
import { L } from "../constants/theme";
import { useTable, criarUsuario } from "../hooks/useData";
import { hasFullAccess } from "../lib/auth";
import { Fade, Row, Grid, PBtn, DataTable, Av, Tag, IBtn, TD } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const ROLES = [
  {v:"client_user",  l:"Vendedor"},
  {v:"client_admin", l:"Admin Cliente"},
  {v:"c4hub_admin",  l:"Admin C4HUB"},
];
const VAZIO = { nome:"", email:"", senha:"", cargo:"", role:"client_user" };

export default function PageUsers({ user }) {
  const isAdmin = hasFullAccess(user);
  const { data: usuarios, loading, update, remove, refetch } = useTable("usuarios", { empresa_id: isAdmin ? undefined : user?.empresa_id });
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState(VAZIO);
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");
  const [succ, setSucc]   = useState("");

  const rc  = { c4hub_admin:{c:L.teal,bg:L.tealBg}, client_admin:{c:L.copper,bg:L.copperBg}, client_user:{c:L.blue,bg:L.blueBg} };

  const openNew = () => { setForm(VAZIO); setErr(""); setSucc(""); setModal(true); };

  const save = async () => {
    if (!form.email || !form.senha || !form.nome) { setErr("Nome, e-mail e senha são obrigatórios."); return; }
    if (form.senha.length < 6) { setErr("Senha mínima: 6 caracteres."); return; }
    setSaving(true); setErr(""); setSucc("");
    const res = await criarUsuario({
      email: form.email.trim().toLowerCase(),
      senha: form.senha,
      nome: form.nome.trim(),
      cargo: form.cargo,
      role: form.role,
      empresa_id: user?.empresa_id,
    });
    if (res.error) setErr(res.error);
    else { setSucc(`Usuário ${form.nome} criado com sucesso!`); setForm(VAZIO); refetch(); }
    setSaving(false);
  };

  const toggleAtivo = async (u) => {
    await update(u.id, { ativo: !u.ativo });
  };

  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  return (
    <Fade>
      <Row between mb={14}>
        <Grid cols={3} gap={12}>
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
              <td style={TD}><Row gap={9}><Av name={u.nome} color={rc[u.role]?.c||L.t3}/><div><div style={{fontSize:12.5,fontWeight:500,color:L.t1}}>{u.nome}</div></div></Row></td>
              <td style={{...TD,color:L.t3,fontSize:11.5}}>{u.cargo||"—"}</td>
              <td style={TD}><Tag color={rc[u.role]?.c||L.t3} bg={rc[u.role]?.bg||L.surface}>{ROLES.find(r=>r.v===u.role)?.l||u.role}</Tag></td>
              <td style={TD}><Tag color={u.ativo?L.green:L.red} bg={u.ativo?L.greenBg:L.redBg}>{u.ativo?"Ativo":"Inativo"}</Tag></td>
              <td style={{...TD,color:L.t4,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleDateString("pt-BR") : "—"}</td>
              <td style={TD}>
                <Row gap={5}>
                  <IBtn c={u.ativo?L.red:L.green} onClick={()=>toggleAtivo(u)}>{u.ativo?"Desativar":"Ativar"}</IBtn>
                </Row>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      {modal && (
        <Modal title="Convidar Novo Usuário" onClose={()=>setModal(false)} width={460}>
          {succ ? (
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{fontSize:32,marginBottom:12}}>✓</div>
              <div style={{fontSize:14,fontWeight:600,color:L.green,marginBottom:4}}>{succ}</div>
              <div style={{fontSize:12,color:L.t3,marginBottom:20}}>O usuário pode fazer login imediatamente.</div>
              <Row gap={8} justify="center">
                <IBtn c={L.teal} onClick={openNew}>Criar outro</IBtn>
                <IBtn c={L.t3} onClick={()=>setModal(false)}>Fechar</IBtn>
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
    </Fade>
  );
}
