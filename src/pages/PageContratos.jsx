import { useState } from "react";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { Fade, Row, Grid, TabPills, PBtn, DataTable, Tag, IBtn, TD } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const STATUS_C  = { rascunho: L.t4, enviado: L.blue, assinado: L.teal, vigente: L.green, encerrado: L.t3, cancelado: L.red };
const STATUS_BG = { rascunho: L.surface, enviado: L.blueBg, assinado: L.tealBg, vigente: L.greenBg, encerrado: L.surface, cancelado: L.redBg };
const TIPOS_C   = { servico: "Serviço", produto: "Produto", parceria: "Parceria", fornecedor: "Fornecedor", trabalho: "Contrato de Trabalho", locacao: "Locação" };

const VAZIO = { titulo: "", cliente_nome: "", cliente_email: "", tipo: "servico", status: "rascunho", valor: "", data_inicio: "", data_fim: "", observacoes: "", arquivo_url: "", arquivo_nome: "" };

const fmtD   = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";
const fmtVal = (v) => v != null && v !== "" ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const PROXIMOS_DIAS = 30;

export default function PageContratos({ user }) {
  const { data: contratos, loading, insert, update, remove, refetch } = useTable("contratos", { empresa_id: user?.empresa_id });

  const [aba,    setAba]    = useState("Todos");
  const [modal,  setModal]  = useState(false);
  const [edit,   setEdit]   = useState(null);
  const [form,   setForm]   = useState(VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [visualizar, setVisualizar] = useState(null); // { url, nome }
  const [anexando, setAnexando] = useState(null);     // id do contrato recebendo arquivo

  // Anexo direto da listagem, para não precisar abrir a edição só para subir o
  // documento — o contrato costuma ser criado antes de existir assinatura.
  const anexarNaLista = async (contrato, file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert("Arquivo acima de 20 MB."); return; }
    setAnexando(contrato.id);
    const limpo = file.name.replace(/[^\w.\-]/g, "_");
    const caminho = `${user.empresa_id}/${Date.now()}-${limpo}`;
    const { error } = await supabase.storage.from("contratos").upload(caminho, file);
    if (error) alert(`Falha ao enviar: ${error.message}`);
    else {
      await update(contrato.id, { arquivo_url: caminho, arquivo_nome: file.name });
      refetch();
    }
    setAnexando(null);
  };

  // Contrato assinado é documento sensível: fica em bucket privado e é aberto
  // por URL assinada de curta duração, não por link permanente.
  const abrirArquivo = async (contrato) => {
    if (!contrato.arquivo_url) return;
    const { data, error } = await supabase.storage
      .from("contratos").createSignedUrl(contrato.arquivo_url, 300);
    if (error || !data?.signedUrl) { alert("Não foi possível abrir o arquivo."); return; }
    setVisualizar({ url: data.signedUrl, nome: contrato.arquivo_nome || "Contrato" });
  };

  const enviarArquivo = async (file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setErr("Arquivo acima de 20 MB."); return; }
    setEnviando(true); setErr("");
    // Caminho começa pelo empresa_id: é assim que a política de acesso do
    // bucket identifica o dono do arquivo.
    const limpo = file.name.replace(/[^\w.\-]/g, "_");
    const caminho = `${user.empresa_id}/${Date.now()}-${limpo}`;
    const { error } = await supabase.storage.from("contratos").upload(caminho, file, { upsert: false });
    if (error) setErr(`Falha ao enviar: ${error.message}`);
    else setForm(p => ({ ...p, arquivo_url: caminho, arquivo_nome: file.name }));
    setEnviando(false);
  };
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");
  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  // KPIs
  const vigentes    = contratos.filter(c => c.status === "vigente");
  const valorCart   = vigentes.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const hoje        = new Date();
  const aVencer     = contratos.filter(c => {
    if (!c.data_fim || c.status !== "vigente") return false;
    const diff = (new Date(c.data_fim) - hoje) / 86400000;
    return diff >= 0 && diff <= PROXIMOS_DIAS;
  }).length;

  const TABS = ["Todos", "Vigentes", "Assinados", "Enviados", "Rascunho", "Encerrados"];
  const filtered = contratos.filter(c => {
    if (aba === "Vigentes")   return c.status === "vigente";
    if (aba === "Assinados")  return c.status === "assinado";
    if (aba === "Enviados")   return c.status === "enviado";
    if (aba === "Rascunho")   return c.status === "rascunho";
    if (aba === "Encerrados") return c.status === "encerrado" || c.status === "cancelado";
    return true;
  });

  const openNew  = () => { setForm(VAZIO); setEdit(null); setErr(""); setModal(true); };
  const openEdit = (c) => { setForm({ ...c, valor: c.valor ?? "" }); setEdit(c.id); setErr(""); setModal(true); };

  const save = async () => {
    if (!form.titulo.trim()) { setErr("Título obrigatório."); return; }
    setSaving(true); setErr("");
    // Campo de data vazio chega como "" e o Postgres recusa: precisa ser nulo.
    const payload = {
      ...form,
      empresa_id: user?.empresa_id,
      valor:       form.valor       !== "" ? Number(form.valor) : null,
      data_inicio: form.data_inicio || null,
      data_fim:    form.data_fim    || null,
      cliente_email: form.cliente_email?.trim() || null,
      arquivo_url:  form.arquivo_url  || null,
      arquivo_nome: form.arquivo_nome || null,
    };
    const { error } = edit ? await update(edit, payload) : await insert(payload);
    if (error) setErr(error.message || "Erro ao salvar.");
    else { setModal(false); refetch(); }
    setSaving(false);
  };

  const mudarStatus = async (id, status) => {
    await update(id, { status });
  };

  const vencendo = (c) => {
    if (!c.data_fim || c.status !== "vigente") return false;
    const diff = (new Date(c.data_fim) - hoje) / 86400000;
    return diff >= 0 && diff <= PROXIMOS_DIAS;
  };

  return (
    <Fade>
      {/* KPIs */}
      <Grid cols={4} gap={12} mb={16} responsive>
        {[
          { l: "Contratos Vigentes",    v: vigentes.length, c: L.green },
          { l: "Valor em Carteira",     v: fmtVal(valorCart), c: L.teal, small: true },
          { l: `A Vencer (${PROXIMOS_DIAS}d)`, v: aVencer, c: aVencer > 0 ? L.yellow : L.t4 },
          { l: "Total de Contratos",    v: contratos.length, c: L.t2 },
        ].map((k, i) => (
          <div key={i} style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: "15px 18px" }}>
            <div style={{ fontSize: 9.5, color: L.t4, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 5, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{k.l}</div>
            <div style={{ fontSize: k.small ? 19 : 28, fontWeight: 700, color: k.c, fontFamily: "'Outfit',sans-serif" }}>{k.v}</div>
          </div>
        ))}
      </Grid>

      <Row between mb={12}>
        <TabPills tabs={TABS} active={aba} onChange={setAba} />
        <PBtn onClick={openNew}>+ Novo Contrato</PBtn>
      </Row>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: L.t4 }}>Carregando...</div>
      ) : (
        <DataTable heads={["Contrato", "Cliente", "Tipo", "Valor", "Vigência", "Status", "Ações"]}>
          {filtered.map(c => (
            <tr key={c.id}
              style={{ borderBottom: `1px solid ${L.lineSoft}` }}
              onMouseEnter={e => e.currentTarget.style.background = L.surface}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <td style={{ ...TD, fontWeight: 600, color: L.t1 }}>
                {c.titulo}
                {vencendo(c) && (
                  <span style={{ marginLeft: 6, fontSize: 9, background: L.yellowBg, color: L.yellow, borderRadius: 4, padding: "1px 5px", fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>A VENCER</span>
                )}
              </td>
              <td style={TD}>
                <div style={{ fontSize: 12.5, color: L.t1 }}>{c.cliente_nome || "—"}</div>
                {c.cliente_email && <div style={{ fontSize: 10, color: L.t4 }}>{c.cliente_email}</div>}
              </td>
              <td style={TD}>
                <Tag color={L.teal} bg={L.tealBg}>{TIPOS_C[c.tipo] || c.tipo}</Tag>
              </td>
              <td style={{ ...TD, fontWeight: 600, color: L.t1, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
                {fmtVal(c.valor)}
              </td>
              <td style={{ ...TD, fontSize: 11, color: L.t4, fontFamily: "'JetBrains Mono',monospace" }}>
                {fmtD(c.data_inicio)}{c.data_fim ? ` → ${fmtD(c.data_fim)}` : ""}
              </td>
              <td style={TD}>
                <Tag color={STATUS_C[c.status] || L.t4} bg={STATUS_BG[c.status] || L.surface}>
                  {c.status}
                </Tag>
              </td>
              <td style={TD}>
                <Row gap={4}>
                  {c.status === "rascunho"  && <IBtn c={L.blue}  onClick={() => mudarStatus(c.id, "enviado")}   title="Marcar enviado">↗</IBtn>}
                  {c.status === "enviado"   && <IBtn c={L.teal}  onClick={() => mudarStatus(c.id, "assinado")}  title="Marcar assinado">✍</IBtn>}
                  {c.status === "assinado"  && <IBtn c={L.green} onClick={() => mudarStatus(c.id, "vigente")}   title="Ativar contrato">▶</IBtn>}
                  {c.status === "vigente"   && <IBtn c={L.t3}    onClick={() => mudarStatus(c.id, "encerrado")} title="Encerrar">⏹</IBtn>}
                  {c.arquivo_url ? (
                    <IBtn c={L.blue} onClick={() => abrirArquivo(c)}>📄</IBtn>
                  ) : (
                    <label style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
                      width:26,height:26,borderRadius:6,cursor:anexando===c.id?"default":"pointer",
                      border:`1px solid ${L.line}`,background:L.surface,color:L.t3,fontSize:12}}
                      title="Anexar contrato assinado">
                      {anexando===c.id ? "…" : "📎"}
                      <input type="file" accept=".pdf,image/*" style={{display:"none"}}
                        disabled={anexando===c.id}
                        onChange={e => anexarNaLista(c, e.target.files?.[0])}/>
                    </label>
                  )}
                  <IBtn c={L.teal} onClick={() => openEdit(c)}>✎</IBtn>
                  <IBtn c={L.red}  onClick={() => { if (confirm("Excluir contrato?")) remove(c.id); }}>⊗</IBtn>
                </Row>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={7} style={{ ...TD, textAlign: "center", color: L.t4, padding: 40, fontSize: 12 }}>
              Nenhum contrato encontrado.
            </td></tr>
          )}
        </DataTable>
      )}

      {modal && (
        <Modal title={edit ? "Editar Contrato" : "Novo Contrato"} onClose={() => setModal(false)} width={520}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            <Field label="Título *" style={{ gridColumn: "1/-1" }}>
              <Input value={form.titulo} onChange={F("titulo")} placeholder="Nome do contrato..." autoFocus />
            </Field>
            <Field label="Cliente">
              <Input value={form.cliente_nome || ""} onChange={F("cliente_nome")} placeholder="Nome do cliente..." />
            </Field>
            <Field label="E-mail do cliente">
              <Input value={form.cliente_email || ""} onChange={F("cliente_email")} type="email" placeholder="email@cliente.com" />
            </Field>
            <Field label="Tipo de contrato">
              <Select value={form.tipo} onChange={F("tipo")}>
                {Object.entries(TIPOS_C).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={F("status")}>
                {Object.keys(STATUS_C).map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Valor do contrato (R$)">
              <Input type="number" value={form.valor || ""} onChange={F("valor")} placeholder="0,00" />
            </Field>
            <div />
            <Field label="Data de início">
              <Input type="date" value={form.data_inicio || ""} onChange={F("data_inicio")} />
            </Field>
            <Field label="Data de encerramento">
              <Input type="date" value={form.data_fim || ""} onChange={F("data_fim")} />
            </Field>
            <Field label="Contrato assinado (PDF ou imagem)" style={{ gridColumn: "1/-1" }}>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <label style={{padding:"7px 12px",borderRadius:8,fontSize:11.5,fontWeight:600,cursor:enviando?"default":"pointer",
                  border:`1.5px solid ${L.line}`,background:L.surface,color:L.t2,fontFamily:"inherit"}}>
                  {enviando ? "Enviando..." : form.arquivo_url ? "Trocar arquivo" : "Selecionar arquivo"}
                  <input type="file" accept=".pdf,image/*" disabled={enviando} style={{display:"none"}}
                    onChange={e => enviarArquivo(e.target.files?.[0])}/>
                </label>
                {form.arquivo_nome && (
                  <span style={{fontSize:11,color:L.teal,wordBreak:"break-all"}}>📎 {form.arquivo_nome}</span>
                )}
                {form.arquivo_url && (
                  <button type="button"
                    onClick={()=>setForm(p=>({...p, arquivo_url:"", arquivo_nome:""}))}
                    style={{padding:"4px 8px",borderRadius:6,fontSize:10,cursor:"pointer",
                      border:`1px solid ${L.line}`,background:"transparent",color:L.red,fontFamily:"inherit"}}>
                    remover
                  </button>
                )}
              </div>
            </Field>
            <Field label="Observações / Termos" style={{ gridColumn: "1/-1" }}>
              <Input value={form.observacoes || ""} onChange={F("observacoes")} placeholder="Condições, cláusulas especiais..." />
            </Field>
          </div>
          {err && <div style={{ padding: "8px 12px", background: L.redBg, borderRadius: 8, fontSize: 12, color: L.red, marginTop: 4 }}>{err}</div>}
          <ModalFooter onClose={() => setModal(false)} onSave={save} loading={saving} label={edit ? "Salvar Alterações" : "Criar Contrato"} />
        </Modal>
      )}
      {visualizar && (
        <Modal title={visualizar.nome} onClose={() => setVisualizar(null)} width={900}>
          {/* Exibido no próprio sistema para não precisar baixar só para conferir. */}
          <iframe src={visualizar.url} title={visualizar.nome}
            style={{width:"100%",height:"70vh",border:`1px solid ${L.line}`,borderRadius:8,background:"#fff"}}/>
          <div style={{marginTop:10,display:"flex",justifyContent:"flex-end"}}>
            <a href={visualizar.url} target="_blank" rel="noreferrer"
              style={{fontSize:11.5,color:L.teal,textDecoration:"none"}}>Abrir em nova aba ↗</a>
          </div>
        </Modal>
      )}
    </Fade>
  );
}
