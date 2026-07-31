import { useState, useEffect, useCallback, useMemo } from "react";
import { L } from "../constants/theme";
import { useTable, usePlanos, criarUsuario } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { Fade, Row, Grid, PBtn, DataTable, Tag, ScBar, IBtn, TD } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const VAZIO = { nome:"", cnpj:"", segmento:"", marca:"", telefone:"", website:"", plano_id:"", status:"trial", mrr:"",
                admin_nome:"", admin_email:"", admin_senha:"", must_change_password: false, bloqueio_msg:"" };

const COBRANCA_VAZIO = {
  dia_vencimento: "10",
  whatsapp_cobranca: "",
  ativo: true,
  msg_2_dias_antes: "",
  msg_dia_vencimento: "",
  msg_5_dias_apos: "",
  msg_20_dias_apos: "",
};

const MSG_PLACEHOLDERS = {
  msg_2_dias_antes:   "Olá {nome}! Sua fatura de {valor} vence em 2 dias ({data_vencimento}). Efetue o pagamento para manter seu acesso.",
  msg_dia_vencimento: "Olá {nome}! Hoje é o dia de vencimento da sua fatura ({valor}). Efetue o pagamento para manter seu acesso ativo.",
  msg_5_dias_apos:    "Olá {nome}! Sua fatura de {valor} (venc. {data_vencimento}) está em aberto. Regularize para evitar suspensão.",
  msg_20_dias_apos:   "Atenção {nome}! Sua fatura de {valor} está em atraso há 20 dias. Entre em contato para evitar o cancelamento.",
};

const Checkbox = ({ checked, onChange, label }) => (
  <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginTop:10, userSelect:"none" }}>
    <div onClick={() => onChange(!checked)} style={{
      width:16, height:16, borderRadius:4, flexShrink:0, cursor:"pointer", transition:"all .12s",
      border:`2px solid ${checked ? L.accent : L.line}`,
      background: checked ? L.accent : "transparent",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      {checked && <span style={{ color:"white", fontSize:10, lineHeight:1, fontWeight:700 }}>✓</span>}
    </div>
    <span style={{ fontSize:12, color:L.t2, lineHeight:1.4 }}>{label}</span>
  </label>
);

const SectionLabel = ({ children, color }) => (
  <div style={{
    fontSize:10, fontWeight:700, color: color || L.t3, textTransform:"uppercase",
    letterSpacing:"1.5px", marginBottom:10, marginTop:16,
    fontFamily:"'JetBrains Mono',monospace", display:"flex", alignItems:"center", gap:6,
  }}>
    <span style={{ width:6, height:6, borderRadius:"50%", background: color || L.t3, display:"inline-block" }}/>
    {children}
  </div>
);

const Textarea = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    style={{
      width:"100%", boxSizing:"border-box", padding:"8px 10px", fontSize:12,
      border:`1px solid ${L.line}`, borderRadius:8, background:L.surface,
      color:L.t1, resize:"vertical", fontFamily:"inherit", lineHeight:1.5,
      outline:"none",
    }}
  />
);

export default function PageClientes({ user }) {
  const { data: empresas, loading, insert, update, remove, refetch } = useTable("empresas");
  const { planos } = usePlanos();
  const [modal, setModal]   = useState(false);
  const [edit, setEdit]     = useState(null);
  const [form, setForm]     = useState(VAZIO);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");
  const [succ, setSucc]     = useState("");

  // Bloqueio manual modal state
  const [bloqueioModal,   setBloqueioModal]   = useState(false);
  const [bloqueioEmpresa, setBloqueioEmpresa] = useState(null);
  const [bloqueioMsg,     setBloqueioMsg]     = useState("");
  const [bloqueioSaving,  setBloqueioSaving]  = useState(false);

  // Cobrança modal state
  const [cobrancaModal,   setCobrancaModal]   = useState(false);
  const [cobrancaEmpresa, setCobrancaEmpresa] = useState(null); // {id, nome, telefone, mrr}
  const [cobrancaForm,    setCobrancaForm]    = useState(COBRANCA_VAZIO);
  const [cobrancaSaving,  setCobrancaSaving]  = useState(false);
  const [cobrancaErr,     setCobrancaErr]     = useState("");
  const [cobrancaLog,     setCobrancaLog]     = useState([]);
  const [cobrancaTab,     setCobrancaTab]     = useState("config"); // "config" | "historico"
  const [abacate,         setAbacate]         = useState(null);  // { customer_id, billing_id, url, valor_mensal }
  const [abacateBusy,     setAbacateBusy]     = useState("");
  const [abacateMsg,      setAbacateMsg]      = useState(null);  // { ok, texto }

  // Billing config map: empresa_id -> { dia_vencimento, ativo }
  const [cfgMap, setCfgMap] = useState({});
  useEffect(() => {
    if (!empresas.length) return;
    supabase
      .from("cobranca_config")
      .select("empresa_id, dia_vencimento, ativo")
      .in("empresa_id", empresas.map(e => e.id))
      .then(({ data }) => {
        if (data) setCfgMap(Object.fromEntries(data.map(r => [r.empresa_id, r])));
      });
  }, [empresas]);

  const calcNextDue = useCallback((diaVenc) => {
    const d = parseInt(diaVenc);
    if (isNaN(d)) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    let due = new Date(today.getFullYear(), today.getMonth(), d);
    if (due <= today) due = new Date(today.getFullYear(), today.getMonth()+1, d);
    return due.toLocaleDateString("pt-BR");
  }, []);

  const pc = { Enterprise:{c:L.teal,bg:L.tealBg}, Starter:{c:L.copper,bg:L.copperBg}, "C4HUB":{c:L.green,bg:L.greenBg} };

  const openNew  = () => { setForm(VAZIO); setEdit(null); setErr(""); setSucc(""); setModal(true); };
  const openEdit = (e) => {
    setForm({ ...VAZIO, ...e, plano_id: e.plano_id||"", admin_nome:"", admin_email:"", admin_senha:"", bloqueio_msg: e.bloqueio_msg||"" });
    setEdit(e.id); setErr(""); setSucc(""); setModal(true);
  };

  const openBloqueio = (emp) => {
    setBloqueioEmpresa(emp);
    setBloqueioMsg(emp.bloqueio_msg || "");
    setBloqueioModal(true);
  };

  const confirmarBloqueio = async () => {
    if (!bloqueioEmpresa) return;
    setBloqueioSaving(true);
    const { error } = await supabase.from("empresas").update({
      bloqueado:     true,
      bloqueado_por: "manual",
      bloqueado_em:  new Date().toISOString(),
      bloqueio_msg:  bloqueioMsg.trim() || null,
    }).eq("id", bloqueioEmpresa.id);
    setBloqueioSaving(false);
    if (error) alert(error.message);
    else { setBloqueioModal(false); refetch(); }
  };

  const desbloquear = useCallback(async (emp) => {
    const { error } = await supabase.from("empresas").update({
      bloqueado: false, bloqueado_por: null, bloqueado_em: null,
    }).eq("id", emp.id);
    if (error) alert(error.message);
    else refetch();
  }, [refetch]);

  const openCobranca = useCallback(async (emp) => {
    setCobrancaEmpresa(emp);
    setCobrancaErr("");
    setCobrancaTab("config");
    setCobrancaLog([]);
    setCobrancaModal(true);

    // Load existing config
    const { data: cfg } = await supabase
      .from("cobranca_config")
      .select("*")
      .eq("empresa_id", emp.id)
      .maybeSingle();

    if (cfg) {
      setCobrancaForm({
        dia_vencimento:    String(cfg.dia_vencimento || "10"),
        whatsapp_cobranca: cfg.whatsapp_cobranca || "",
        ativo:             cfg.ativo ?? true,
        msg_2_dias_antes:  cfg.msg_2_dias_antes || "",
        msg_dia_vencimento:cfg.msg_dia_vencimento || "",
        msg_5_dias_apos:   cfg.msg_5_dias_apos || "",
        msg_20_dias_apos:  cfg.msg_20_dias_apos || "",
      });
    } else {
      setCobrancaForm({ ...COBRANCA_VAZIO });
    }

    // Load recent log
    const { data: logs } = await supabase
      .from("cobranca_log")
      .select("tipo, mes_referencia, enviado_em, status, telefone")
      .eq("empresa_id", emp.id)
      .order("enviado_em", { ascending: false })
      .limit(20);
    setCobrancaLog(logs || []);

    setAbacateMsg(null);
    // O e-mail do administrador do cliente vive em auth.users; a função
    // security definer é a única via de leitura pelo app.
    const { data: emailAdmin } = await supabase.rpc("email_admin_da_empresa", { p_empresa: emp.id });

    setAbacate({
      email_cobranca: cfg?.email_cobranca || emailAdmin || "",
      customer_id:  emp.abacatepay_customer_id || null,
      billing_id:   cfg?.abacatepay_billing_id || null,
      url:          cfg?.abacatepay_url || null,
      valor_mensal: cfg?.valor_mensal ?? "",
      produto_nome: cfg?.produto_nome || "",
      frequencia:   cfg?.frequencia || "MONTHLY",
      metodos:      cfg?.metodos || null,
    });
  }, []);

  // Chama a integração. A resposta crua do AbacatePay é mostrada em caso de
  // erro: a integração é nova e "falhou" não ajudaria a diagnosticar.
  const chamarAbacate = async (action, extra = {}) => {
    if (!cobrancaEmpresa) return;
    setAbacateBusy(action); setAbacateMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("abacatepay-action", {
        body: { action, empresa_id: cobrancaEmpresa.id, ...extra },
      });
      if (error) {
        // Em resposta não-2xx o supabase-js entrega só "Edge Function returned
        // a non-2xx status code" e guarda a resposta em error.context. Sem ler
        // esse corpo o motivo real — chave ausente, recusa do AbacatePay — se
        // perde e sobra uma mensagem que não diz nada.
        let detalhe = "";
        try {
          const corpo = await error.context?.json?.();
          if (corpo) detalhe = corpo.error
            ? `${corpo.error}${corpo.resposta ? ` — ${corpo.resposta}` : ""}`
            : JSON.stringify(corpo).slice(0, 400);
        } catch { /* corpo ilegível: fica a mensagem original */ }
        const status = error.context?.status ? ` (HTTP ${error.context.status})` : "";
        throw new Error(`${detalhe || error.message}${status}`);
      }
      if (data?.error) {
        setAbacateMsg({ ok: false, texto: `${data.error}${data.resposta ? ` — ${data.resposta}` : ""}` });
      } else {
        setAbacate(p => ({ ...p, ...data }));
        setAbacateMsg({ ok: true, texto: action === "sync_cliente"
          ? "Cliente sincronizado com o AbacatePay."
          : "Cobrança criada. O link está abaixo." });
      }
    } catch (e) {
      setAbacateMsg({ ok: false, texto: e.message });
    } finally { setAbacateBusy(""); }
  };

  const saveCobranca = async () => {
    if (!cobrancaEmpresa) return;
    const dia = parseInt(cobrancaForm.dia_vencimento);
    if (isNaN(dia) || dia < 1 || dia > 28) {
      setCobrancaErr("Dia de vencimento deve ser entre 1 e 28.");
      return;
    }
    setCobrancaSaving(true);
    setCobrancaErr("");

    const payload = {
      empresa_id:         cobrancaEmpresa.id,
      dia_vencimento:     dia,
      whatsapp_cobranca:  cobrancaForm.whatsapp_cobranca?.trim() || null,
      ativo:              cobrancaForm.ativo,
      msg_2_dias_antes:   cobrancaForm.msg_2_dias_antes?.trim()  || null,
      msg_dia_vencimento: cobrancaForm.msg_dia_vencimento?.trim() || null,
      msg_5_dias_apos:    cobrancaForm.msg_5_dias_apos?.trim()    || null,
      msg_20_dias_apos:   cobrancaForm.msg_20_dias_apos?.trim()   || null,
      updated_at:         new Date().toISOString(),
    };

    const { error } = await supabase
      .from("cobranca_config")
      .upsert(payload, { onConflict: "empresa_id" });

    if (error) {
      setCobrancaErr(error.message);
    } else {
      // A lista carrega as configurações uma vez, ao montar: sem atualizar aqui,
      // a coluna de cobrança e a próxima fatura seguiam mostrando o dia antigo
      // até recarregar a página.
      setCfgMap(prev => ({
        ...prev,
        [cobrancaEmpresa.id]: { empresa_id: cobrancaEmpresa.id, dia_vencimento: dia, ativo: cobrancaForm.ativo },
      }));
      setCobrancaModal(false);
    }
    setCobrancaSaving(false);
  };

  const save = async () => {
    if (!form.nome.trim()) { setErr("Nome da empresa é obrigatório."); return; }
    if (!edit && form.plano_id) {
      if (!form.admin_email.trim()) { setErr("E-mail de acesso é obrigatório ao selecionar um plano."); return; }
      if (!form.admin_senha || form.admin_senha.length < 6) { setErr("Senha mínima de 6 caracteres."); return; }
    }
    setSaving(true); setErr("");

    const { admin_nome, admin_email, admin_senha, must_change_password, bloqueio_msg, ...empresaFields } = form;
    const payload = {
      ...empresaFields,
      is_c4hub: false,
      bloqueio_msg: bloqueio_msg?.trim() || null,
      assinatura_ativa: form.status === "ativo",
      cnpj:     form.cnpj?.trim()    || null,
      telefone: form.telefone?.trim()|| null,
      website:  form.website?.trim() || null,
      mrr:      form.mrr      === "" || form.mrr      == null ? null : parseFloat(form.mrr),
      plano_id: form.plano_id === "" || form.plano_id == null ? null : form.plano_id,
    };

    const { data: novaEmpresa, error } = edit ? await update(edit, payload) : await insert(payload);
    if (error) { setErr(error.message || "Erro ao salvar."); setSaving(false); return; }

    if (!edit && form.plano_id && form.admin_email.trim()) {
      const res = await criarUsuario({
        email: form.admin_email.trim().toLowerCase(),
        senha: form.admin_senha,
        nome: (admin_nome || form.nome).trim(),
        cargo: "Admin",
        role: "client_admin",
        empresa_id: novaEmpresa.id,
        perfil_acesso: "full",
      });
      if (res.error) {
        setErr(`Empresa criada! Mas erro ao criar acesso: ${res.error}`);
        setSaving(false);
        refetch();
        return;
      }
      if (form.must_change_password) {
        await supabase.from("usuarios").update({ must_change_password: true })
          .eq("email", form.admin_email.trim().toLowerCase());
      }
      setSucc(`Empresa e acesso criados! Login: ${form.admin_email.trim().toLowerCase()}`);
    } else {
      setModal(false);
    }

    refetch();
    setSaving(false);
  };

  const F  = k => v => setForm(p => ({ ...p, [k]: v }));
  const FC = k => v => setCobrancaForm(p => ({ ...p, [k]: v }));

  const mrr = empresas.filter(e=>e.status==="ativo").reduce((s,e)=>s+parseFloat(e.mrr||0),0);
  const planoNome = (pid) => planos.find(p=>p.id===pid)?.nome || "—";
  const temPlano  = !!form.plano_id;

  const tipoLabel = { "2d_antes":"2 dias antes","vencimento":"No vencimento","5d_apos":"5 dias após","20d_apos":"20 dias após" };

  return (
    <Fade>
      <Grid cols={4} gap={12} mb={14} responsive>
        {[
          {l:"Clientes Ativos", v:empresas.filter(e=>e.status==="ativo"&&!e.is_c4hub).length, c:L.green},
          {l:"MRR Total",       v:`R$ ${mrr.toLocaleString("pt-BR",{minimumFractionDigits:2})}`, c:L.teal},
          {l:"Em Trial",       v:empresas.filter(e=>e.status==="trial").length, c:L.yellow},
          {l:"Total Empresas", v:empresas.filter(e=>!e.is_c4hub).length, c:L.copper},
        ].map((k,i)=>(
          <div key={i} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"16px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:10,color:L.t4,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:6,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{k.l}</div>
            <div style={{fontSize:22,fontWeight:700,color:k.c,fontFamily:"'Outfit',sans-serif"}}>{k.v}</div>
          </div>
        ))}
      </Grid>

      <Row between mb={12}>
        <span style={{fontSize:13,fontWeight:600,color:L.t1}}>Empresas Cadastradas</span>
        <PBtn onClick={openNew}>+ Nova Empresa</PBtn>
      </Row>

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando clientes...</div>
      ) : (
        <DataTable heads={["Empresa","Plano","Status","MRR","Cobrança","Próx. Fatura","Saúde","Ações"]}>
          {empresas.filter(e=>!e.is_c4hub).map(emp => {
            const pn = planoNome(emp.plano_id);
            return (
              <tr key={emp.id} style={{borderBottom:`1px solid ${L.lineSoft}`}}
                onMouseEnter={e=>e.currentTarget.style.background=L.surface}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              >
                <td style={{...TD,fontWeight:500,color:emp.bloqueado?L.red:L.t1,fontSize:12.5}}>
                  {emp.bloqueado && <span style={{marginRight:5}} title="Acesso bloqueado">🔒</span>}
                  {emp.nome}
                </td>
                <td style={TD}><Tag color={pc[pn]?.c||L.t3} bg={pc[pn]?.bg||L.surface}>{pn}</Tag></td>
                <td style={TD}><Tag color={emp.status==="ativo"?L.green:emp.status==="trial"?L.yellow:L.red} bg={emp.status==="ativo"?L.greenBg:emp.status==="trial"?L.yellowBg:L.redBg}>{emp.status}</Tag></td>
                <td style={{...TD,fontWeight:700,color:L.green,fontFamily:"'JetBrains Mono',monospace"}}>
                  R$ {parseFloat(emp.mrr||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                  <div style={{fontSize:9,color:L.t4,fontWeight:400,marginTop:1}}>por mês</div>
                </td>
                <td style={{...TD,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>
                  {cfgMap[emp.id] ? (
                    <>
                      <span style={{color:cfgMap[emp.id].ativo?L.teal:L.t4,fontWeight:600}}>
                        Dia {cfgMap[emp.id].dia_vencimento}
                      </span>
                      {!cfgMap[emp.id].ativo && <span style={{marginLeft:5,fontSize:9,color:L.t4}}>(inativo)</span>}
                    </>
                  ) : <span style={{color:L.t5}}>—</span>}
                </td>
                <td style={{...TD,fontSize:11,color:L.t3,fontFamily:"'JetBrains Mono',monospace"}}>
                  {cfgMap[emp.id]?.dia_vencimento
                    ? calcNextDue(cfgMap[emp.id].dia_vencimento)
                    : emp.vencimento || "—"}
                </td>
                <td style={TD}>
                  <Row gap={6}>
                    <ScBar v={emp.assinatura_ativa?95:40}/>
                    <span style={{fontSize:10,color:emp.assinatura_ativa?L.green:L.yellow,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{emp.assinatura_ativa?"95%":"40%"}</span>
                  </Row>
                </td>
                <td style={TD}>
                  <Row gap={5}>
                    <IBtn c={L.teal}   onClick={()=>openEdit(emp)}>✎ Editar</IBtn>
                    <IBtn c={L.copper} onClick={()=>openCobranca(emp)}>💳 Cobrança</IBtn>
                    {emp.bloqueado
                      ? <IBtn c={L.green} onClick={()=>{ if(confirm(`Desbloquear ${emp.nome}?`)) desbloquear(emp); }} title="Desbloquear acesso">🔓 Desbloquear</IBtn>
                      : <IBtn c={L.red}   onClick={()=>openBloqueio(emp)} title="Bloquear acesso">🔒 Bloquear</IBtn>
                    }
                    <IBtn c={emp.multi_instancia_ativo ? L.teal : L.t3}
                      title={emp.multi_instancia_ativo ? "Multi-Instância ATIVO — clique para desativar" : "Multi-Instância inativo — clique para ativar"}
                      onClick={async()=>{ await update(emp.id,{multi_instancia_ativo:!emp.multi_instancia_ativo}); refetch(); }}
                      style={{outline: emp.multi_instancia_ativo ? "2px solid #2dd4bf" : "none", position:"relative"}}
                    >{emp.multi_instancia_ativo ? "📲✓" : "📲"}</IBtn>
                    <IBtn c={L.red}    onClick={()=>{if(confirm("Excluir empresa?"))remove(emp.id);}}>⊗</IBtn>
                  </Row>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      {/* ── Modal: Editar / Nova Empresa ───────────────────────────────────── */}
      {modal && (
        <Modal title={edit ? "Editar Empresa" : "Nova Empresa"} onClose={()=>setModal(false)} width={560}>
          {succ ? (
            <div style={{textAlign:"center",padding:"24px 0"}}>
              <div style={{fontSize:36,marginBottom:12}}>✓</div>
              <div style={{fontSize:14,fontWeight:600,color:L.green,marginBottom:6}}>{succ}</div>
              <div style={{fontSize:12,color:L.t3,marginBottom:20}}>O administrador já pode fazer login com as credenciais acima.</div>
              <Row gap={8} justify="center">
                <IBtn c={L.teal} onClick={openNew}>Cadastrar outra</IBtn>
                <IBtn c={L.t3}   onClick={()=>setModal(false)}>Fechar</IBtn>
              </Row>
            </div>
          ) : (
            <>
              <SectionLabel>Dados da empresa</SectionLabel>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
                <Field label="Nome da Empresa *"><Input value={form.nome}      onChange={F("nome")}      placeholder="Razão social / nome fantasia"/></Field>
                <Field label="CNPJ">             <Input value={form.cnpj}      onChange={F("cnpj")}      placeholder="XX.XXX.XXX/XXXX-XX"/></Field>
                <Field label="Segmento">         <Input value={form.segmento}  onChange={F("segmento")}  placeholder="Ex: Varejo, Tecnologia..."/></Field>
                <Field label="Telefone">         <Input value={form.telefone}  onChange={F("telefone")}  placeholder="(11) 99999-9999"/></Field>
                <Field label="Website">          <Input value={form.website}   onChange={F("website")}   placeholder="www.empresa.com.br"/></Field>
                {/* Agrupa unidades do mesmo grupo: define para quais WhatsApps
                    os fluxos de chatbot podem transferir uma conversa. */}
                <Field label="Marca / grupo">     <Input value={form.marca}     onChange={F("marca")}     placeholder="Ex: Vision Peças"/></Field>
                <Field label="Status">
                  <Select value={form.status} onChange={F("status")}>
                    {["trial","ativo","inativo","cancelado"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                  </Select>
                </Field>
                <Field label="Plano">
                  <Select value={form.plano_id} onChange={F("plano_id")}>
                    <option value="">— Sem plano —</option>
                    {planos.filter(p=>p.ativo).map(p=><option key={p.id} value={p.id}>{p.nome} — R$ {parseFloat(p.preco_mensal).toLocaleString("pt-BR",{minimumFractionDigits:2})}</option>)}
                  </Select>
                </Field>
                <Field label="MRR (R$)"><Input value={form.mrr||""} onChange={F("mrr")} type="number" placeholder="0,00"/></Field>
              </div>
              {edit && (
                <div style={{marginTop:12}}>
                  <Field label="Mensagem de bloqueio (deixe em branco para usar o padrão)">
                    <Textarea
                      value={form.bloqueio_msg}
                      onChange={F("bloqueio_msg")}
                      placeholder="Seu acesso está temporariamente suspenso. Entre em contato com a C4HUB para regularizar sua situação."
                      rows={3}
                    />
                  </Field>
                </div>
              )}

              {!edit && temPlano && (
                <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${L.lineSoft}`}}>
                  <SectionLabel color={L.teal}>Acesso ao sistema</SectionLabel>
                  <div style={{fontSize:11.5,color:L.t3,marginBottom:12,lineHeight:1.5}}>
                    Crie as credenciais para o administrador da empresa acessar o sistema e gerenciar a equipe.
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
                    <Field label="Nome do Admin" style={{gridColumn:"1/-1"}}>
                      <Input value={form.admin_nome} onChange={F("admin_nome")} placeholder={form.nome || "Nome do responsável"}/>
                    </Field>
                    <Field label="E-mail de acesso *"><Input value={form.admin_email} onChange={F("admin_email")} type="email" placeholder="admin@empresa.com"/></Field>
                    <Field label="Senha *">           <Input value={form.admin_senha} onChange={F("admin_senha")} type="password" placeholder="Mínimo 6 caracteres"/></Field>
                  </div>
                  <Checkbox
                    checked={form.must_change_password}
                    onChange={v => setForm(p => ({ ...p, must_change_password: v }))}
                    label="Solicitar alteração de senha no primeiro login"
                  />
                </div>
              )}

              {err && <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginBottom:4,marginTop:8}}>{err}</div>}
              <ModalFooter onClose={()=>setModal(false)} onSave={save} loading={saving} label={edit?"Salvar Alterações":"Criar Empresa"}/>
            </>
          )}
        </Modal>
      )}

      {/* ── Modal: Bloqueio Manual ─────────────────────────────────────────── */}
      {bloqueioModal && bloqueioEmpresa && (
        <Modal title={`Bloquear acesso — ${bloqueioEmpresa.nome}`} onClose={()=>setBloqueioModal(false)} width={480}>
          <div style={{fontSize:13,color:L.t2,marginBottom:16,lineHeight:1.6}}>
            O cliente ainda poderá fazer login, mas verá a mensagem abaixo no lugar do sistema e não conseguirá realizar nenhuma ação.
          </div>
          <Field label="Mensagem para o cliente">
            <Textarea
              value={bloqueioMsg}
              onChange={setBloqueioMsg}
              placeholder="Seu acesso está temporariamente suspenso por inadimplência. Entre em contato com a C4HUB para regularizar sua situação e reativar o acesso."
              rows={4}
            />
          </Field>
          <div style={{fontSize:11,color:L.t4,marginTop:6}}>Deixe em branco para usar a mensagem padrão da C4HUB.</div>
          <ModalFooter
            onClose={()=>setBloqueioModal(false)}
            onSave={confirmarBloqueio}
            loading={bloqueioSaving}
            label="🔒 Confirmar Bloqueio"
          />
        </Modal>
      )}

      {/* ── Modal: Configuração de Cobrança ────────────────────────────────── */}
      {cobrancaModal && cobrancaEmpresa && (
        <Modal title={`Cobrança — ${cobrancaEmpresa.nome}`} onClose={()=>setCobrancaModal(false)} width={600}>
          {/* Tabs */}
          <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:`1px solid ${L.lineSoft}`,paddingBottom:0}}>
            {[["config","⚙️ Configuração"],["historico","📋 Histórico"]].map(([id,label])=>(
              <button key={id} onClick={()=>setCobrancaTab(id)} style={{
                padding:"8px 14px", fontSize:12, fontWeight:600, cursor:"pointer", border:"none",
                background:"transparent", color: cobrancaTab===id ? L.teal : L.t4,
                borderBottom: cobrancaTab===id ? `2px solid ${L.teal}` : "2px solid transparent",
                transition:"all .12s",
              }}>{label}</button>
            ))}
          </div>

          {cobrancaTab === "config" && (
            <>
              <SectionLabel color={L.teal}>Configuração de Cobrança</SectionLabel>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
                <Field label="Dia de Vencimento (1–28)">
                  <Input
                    value={cobrancaForm.dia_vencimento}
                    onChange={FC("dia_vencimento")}
                    type="number" min="1" max="28"
                    placeholder="Ex: 10"
                  />
                </Field>
                <Field label="WhatsApp de Cobrança">
                  <Input
                    value={cobrancaForm.whatsapp_cobranca}
                    onChange={FC("whatsapp_cobranca")}
                    placeholder={cobrancaEmpresa.telefone || "Padrão: telefone da empresa"}
                  />
                </Field>
              </div>
              <Checkbox
                checked={cobrancaForm.ativo}
                onChange={v => setCobrancaForm(p=>({...p, ativo:v}))}
                label="Cobrança automática ativa (mensagens serão enviadas automaticamente)"
              />

              {/* ── AbacatePay ── */}
              <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${L.lineSoft}`}}>
                <SectionLabel color={L.teal}>Cobrança automática — AbacatePay</SectionLabel>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
                  <Field label="Valor mensal (R$)">
                    <Input type="number" min="0" step="0.01"
                      value={abacate?.valor_mensal ?? ""}
                      onChange={v => setAbacate(p => ({...p, valor_mensal: v}))}
                      placeholder="Ex: 1500.00"/>
                  </Field>
                  <Field label="Produto / descrição na fatura">
                    <Input value={abacate?.produto_nome ?? ""}
                      onChange={v => setAbacate(p => ({...p, produto_nome: v}))}
                      placeholder="Ex: C4OS Pro, Tráfego Pago..."/>
                  </Field>
                </div>

                <Field label="Cobrança">
                  <Select value={abacate?.frequencia ?? "MONTHLY"}
                    onChange={v => setAbacate(p => ({...p, frequencia: v}))}>
                    <option value="MONTHLY">Assinatura mensal</option>
                    <option value="WEEKLY">Assinatura semanal</option>
                    <option value="SEMIANNUALLY">Assinatura semestral</option>
                    <option value="ANNUALLY">Assinatura anual</option>
                    <option value="ONE_TIME">Cobrança avulsa (uma vez)</option>
                  </Select>
                </Field>

                <Field label="Forma de pagamento">
                  <Select value={(abacate?.metodos || []).join(",") || ((abacate?.frequencia ?? "MONTHLY") === "ONE_TIME" ? "PIX" : "CARD")}
                    onChange={v => setAbacate(p => ({...p, metodos: v.split(",")}))}>
                    <option value="CARD">Cartão</option>
                    <option value="PIX">PIX{(abacate?.frequencia ?? "MONTHLY") !== "ONE_TIME" ? " (exige PIX Automático habilitado)" : ""}</option>
                    <option value="PIX,CARD">PIX e Cartão</option>
                  </Select>
                </Field>

                <Field label="E-mail do cliente (vai na fatura)">
                  <Input type="email" value={abacate?.email_cobranca ?? ""}
                    onChange={v => setAbacate(p => ({...p, email_cobranca: v}))}
                    placeholder="cliente@empresa.com.br"/>
                </Field>

                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
                  <button type="button" disabled={!!abacateBusy}
                    onClick={() => chamarAbacate("sync_cliente", {
                      email: abacate?.email_cobranca || undefined,
                      valor: Number(abacate?.valor_mensal) || undefined,
                      produto_nome: abacate?.produto_nome || undefined,
                      frequencia: abacate?.frequencia || undefined,
                      metodos: abacate?.metodos?.length ? abacate.metodos : undefined,
                    })}
                    style={{padding:"8px 14px",borderRadius:8,fontSize:12,fontWeight:600,cursor:abacateBusy?"default":"pointer",
                      border:`1.5px solid ${abacate?.customer_id ? L.line : L.teal}`,
                      background: abacate?.customer_id ? L.surface : L.teal,
                      color: abacate?.customer_id ? L.t3 : "#fff", fontFamily:"inherit"}}>
                    {abacateBusy === "sync_cliente" ? "Sincronizando..."
                      : abacate?.customer_id ? "Cliente já sincronizado" : "Sincronizar cliente"}
                  </button>
                  <button type="button"
                    disabled={!!abacateBusy || !abacate?.customer_id || !(Number(abacate?.valor_mensal) > 0)}
                    onClick={() => chamarAbacate("criar_cobranca", {
                      valor: Number(abacate.valor_mensal),
                      produto_nome: abacate.produto_nome || undefined,
                      frequencia: abacate.frequencia || undefined,
                      metodos: abacate.metodos?.length ? abacate.metodos : undefined,
                    })}
                    style={{padding:"8px 14px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:"inherit",
                      cursor:(abacateBusy || !abacate?.customer_id || !(Number(abacate?.valor_mensal)>0))?"default":"pointer",
                      border:`1.5px solid ${L.copper}`, background:L.copper, color:"#fff",
                      opacity:(!abacate?.customer_id || !(Number(abacate?.valor_mensal)>0))?.5:1}}>
                    {abacateBusy === "criar_cobranca" ? "Gerando..." : "Gerar link de cobrança"}
                  </button>
                </div>

                {!abacate?.customer_id && (
                  <div style={{fontSize:10,color:L.t3,marginTop:8,lineHeight:1.5}}>
                    Sincronize o cliente antes de gerar a cobrança. O AbacatePay precisa
                    do telefone e do CNPJ/CPF preenchidos no cadastro da empresa.
                  </div>
                )}

                {abacate?.url && (
                  <div style={{marginTop:10,padding:"10px 12px",background:L.surface,borderRadius:8,border:`1px solid ${L.lineSoft}`}}>
                    <div style={{fontSize:10,color:L.t3,marginBottom:4}}>Link de pagamento</div>
                    <a href={abacate.url} target="_blank" rel="noreferrer"
                      style={{fontSize:11,color:L.teal,wordBreak:"break-all"}}>{abacate.url}</a>
                    <div style={{marginTop:6}}>
                      <button type="button"
                        onClick={() => navigator.clipboard?.writeText(abacate.url)}
                        style={{padding:"4px 10px",borderRadius:6,fontSize:10,cursor:"pointer",
                          border:`1px solid ${L.line}`,background:L.white,color:L.t2,fontFamily:"inherit"}}>
                        Copiar link
                      </button>
                    </div>
                  </div>
                )}

                {abacateMsg && (
                  <div style={{marginTop:10,padding:"8px 12px",borderRadius:8,fontSize:11,lineHeight:1.5,
                    background: abacateMsg.ok ? L.greenBg : L.redBg,
                    color: abacateMsg.ok ? L.green : L.red}}>
                    {abacateMsg.texto}
                  </div>
                )}
              </div>

              <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${L.lineSoft}`}}>
                <SectionLabel color={L.copper}>Mensagens de Cobrança</SectionLabel>
                <div style={{fontSize:11,color:L.t3,marginBottom:12,lineHeight:1.6,padding:"8px 12px",background:L.surface,borderRadius:8,border:`1px solid ${L.lineSoft}`}}>
                  Variáveis disponíveis: <code style={{fontFamily:"'JetBrains Mono',monospace",background:L.line,padding:"1px 5px",borderRadius:4}}>{"{nome}"}</code>{" "}
                  <code style={{fontFamily:"'JetBrains Mono',monospace",background:L.line,padding:"1px 5px",borderRadius:4}}>{"{valor}"}</code>{" "}
                  <code style={{fontFamily:"'JetBrains Mono',monospace",background:L.line,padding:"1px 5px",borderRadius:4}}>{"{data_vencimento}"}</code>{" "}
                  — deixe em branco para usar a mensagem padrão.
                </div>

                {[
                  ["msg_2_dias_antes",   "2 dias antes do vencimento"],
                  ["msg_dia_vencimento", "No dia do vencimento"],
                  ["msg_5_dias_apos",    "5 dias após o vencimento"],
                  ["msg_20_dias_apos",   "20 dias após o vencimento"],
                ].map(([field, label]) => (
                  <Field key={field} label={label}>
                    <Textarea
                      value={cobrancaForm[field]}
                      onChange={FC(field)}
                      placeholder={MSG_PLACEHOLDERS[field]}
                      rows={3}
                    />
                  </Field>
                ))}
              </div>

              {cobrancaErr && (
                <div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginTop:8}}>{cobrancaErr}</div>
              )}
              <ModalFooter
                onClose={()=>setCobrancaModal(false)}
                onSave={saveCobranca}
                loading={cobrancaSaving}
                label="Salvar Configuração"
              />
            </>
          )}

          {cobrancaTab === "historico" && (
            <div>
              <SectionLabel>Histórico de Envios</SectionLabel>
              {cobrancaLog.length === 0 ? (
                <div style={{textAlign:"center",padding:"32px 0",color:L.t4,fontSize:13}}>Nenhum envio registrado ainda.</div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {cobrancaLog.map((log, i) => (
                    <div key={i} style={{
                      display:"flex",alignItems:"center",justifyContent:"space-between",
                      padding:"10px 14px",borderRadius:8,border:`1px solid ${L.lineSoft}`,
                      background:L.surface,fontSize:12,
                    }}>
                      <div>
                        <span style={{fontWeight:600,color:L.t1,marginRight:8}}>{tipoLabel[log.tipo] || log.tipo}</span>
                        <span style={{color:L.t4,fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{log.mes_referencia}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{color:L.t4,fontSize:11}}>{new Date(log.enviado_em).toLocaleString("pt-BR")}</span>
                        <Tag
                          color={log.status==="enviado"?L.green:L.red}
                          bg={log.status==="enviado"?L.greenBg:L.redBg}
                        >{log.status}</Tag>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </Fade>
  );
}
