// Modal de cobrança de um cliente: configuração, mensagens, integração com o
// AbacatePay e histórico de envios.
//
// Vive fora das páginas porque é usado tanto no cadastro de clientes quanto na
// aba de contratos do financeiro — duplicar seria manter duas cópias de um
// fluxo que mexe em dinheiro.
import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { L } from "../constants/theme";
import Modal, { Field, Input, Select } from "./Modal";
import { Tag } from "./ui";

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
  }}>● {children}</div>
);

export default function ModalCobranca({ empresa, onClose, onSaved }) {
  const [cobrancaForm,   setCobrancaForm]   = useState(COBRANCA_VAZIO);
  const [cobrancaSaving, setCobrancaSaving] = useState(false);
  const [cobrancaErr,    setCobrancaErr]    = useState("");
  const [cobrancaLog,    setCobrancaLog]    = useState([]);
  const [cobrancaTab,    setCobrancaTab]    = useState("config");
  const [abacate,        setAbacate]        = useState(null);
  const [abacateBusy,    setAbacateBusy]    = useState("");
  const [abacateMsg,     setAbacateMsg]     = useState(null);

  const FC = k => v => setCobrancaForm(p => ({ ...p, [k]: v }));

  const carregar = useCallback(async (emp) => {
    setCobrancaErr("");
    setCobrancaTab("config");
    setCobrancaLog([]);

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
    if (!empresa) return;
    setAbacateBusy(action); setAbacateMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("abacatepay-action", {
        body: { action, empresa_id: empresa.id, ...extra },
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
    if (!empresa) return;
    const dia = parseInt(cobrancaForm.dia_vencimento);
    if (isNaN(dia) || dia < 1 || dia > 28) {
      setCobrancaErr("Dia de vencimento deve ser entre 1 e 28.");
      return;
    }
    setCobrancaSaving(true);
    setCobrancaErr("");

    const payload = {
      empresa_id:         empresa.id,
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
      // Quem abriu o modal atualiza a própria lista: sem isso a coluna de
      // cobrança seguia mostrando o dia antigo até recarregar a página.
      onSaved?.(dia, cobrancaForm.ativo);
      onClose();
    }
    setCobrancaSaving(false);
  };

  useEffect(() => { if (empresa) carregar(empresa); }, [empresa, carregar]);

  if (!empresa) return null;

  return (
        <Modal title={`Cobrança — ${empresa.nome}`} onClose={onClose} width={600}>
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
                    placeholder={empresa.telefone || "Padrão: telefone da empresa"}
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
                onClose={onClose}
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
  );
}
