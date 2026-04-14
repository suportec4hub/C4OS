import { useState, useEffect, useRef, useCallback } from "react";
import Logo from "../components/Logo";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { Fade, Card, Grid, Row, Tag, PBtn } from "../components/ui";

const COPY_TIMEOUT = 2000;

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_TIMEOUT);
  };
  return (
    <button onClick={copy} style={{
      padding:"4px 10px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",
      fontFamily:"inherit",background:copied?L.greenBg:L.tealBg,color:copied?L.green:L.teal,
      border:`1.5px solid ${copied?L.green:L.teal}22`,transition:"all .15s",flexShrink:0
    }}>
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${L.lineSoft}`}}>
      <span style={{fontSize:11,color:L.t4,minWidth:130}}>{label}</span>
      <span style={{fontSize:12.5,color:L.t1}}>{value}</span>
    </div>
  );
}

function LabelInput({ label, value, onChange, placeholder, type="text", readOnly=false }) {
  return (
    <div>
      <label style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1.2px",display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace"}}>{label}</label>
      <input value={value} onChange={onChange} placeholder={placeholder} type={type} readOnly={readOnly}
        style={{width:"100%",background:readOnly?L.surface:L.white,border:`1.5px solid ${L.line}`,borderRadius:9,padding:"9px 12px",color:readOnly?L.t3:L.t1,fontSize:12.5,fontFamily:"inherit",outline:"none",marginBottom:14,cursor:readOnly?"default":"text"}}
        onFocus={e=>{ if(!readOnly) e.target.style.borderColor=L.teal; }}
        onBlur={e=>{ e.target.style.borderColor=L.line; }}
      />
    </div>
  );
}

const WEBHOOK_URL     = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/waba-webhook`;
const EVO_WEBHOOK_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`;

// ── Componente de conexão WhatsApp via Evolution GO ──────────────────────────
function EvolutionCard({ user, empData, onRefresh }) {
  const [phase,       setPhase]       = useState("idle");   // idle | loading | qr | connected | error
  const [qrImg,       setQrImg]       = useState(null);
  const [pairingCode, setPairingCode] = useState("");
  const [errMsg,      setErrMsg]      = useState("");
  const pollRef    = useRef(null);
  const timeoutRef = useRef(null);
  const phaseRef   = useRef("idle");

  // URL do webhook com token (para configuração manual no Evolution GO)
  const webhookDisplayUrl = empData.evolution_instance_token
    ? `${EVO_WEBHOOK_BASE}?token=${empData.evolution_instance_token}`
    : EVO_WEBHOOK_BASE;

  // Sincroniza status inicial
  useEffect(() => {
    const p = empData.evolution_connected ? "connected" : "idle";
    setPhase(p);
    phaseRef.current = p;
  }, [empData.evolution_connected]);

  // Limpa polling ao desmontar
  useEffect(() => () => { clearInterval(pollRef.current); clearTimeout(timeoutRef.current); }, []);

  const callEvo = useCallback(async (action, extra = {}) => {
    const { data, error } = await supabase.functions.invoke("evolution-action", {
      body: { action, empresa_id: user.empresa_id, ...extra },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, [user.empresa_id]);

  const startPolling = useCallback(() => {
    clearInterval(pollRef.current);
    clearTimeout(timeoutRef.current);

    pollRef.current = setInterval(async () => {
      try {
        // Busca QR atualizado
        const qrRes = await callEvo("qr");
        const raw = qrRes?.data?.Qrcode || qrRes?.data?.qrcode || "";
        if (raw) setQrImg(raw.split("|")[0]);

        // Verifica se já conectou
        const stRes = await callEvo("status");
        if (stRes?.data?.Connected || stRes?.data?.LoggedIn) {
          clearInterval(pollRef.current);
          clearTimeout(timeoutRef.current);
          phaseRef.current = "connected";
          setPhase("connected");
          setQrImg(null);
          onRefresh?.();
        }
      } catch (_) { /* ignora erros de polling silenciosamente */ }
    }, 4000);

    // Timeout de 3 minutos
    timeoutRef.current = setTimeout(() => {
      clearInterval(pollRef.current);
      if (phaseRef.current !== "connected") {
        phaseRef.current = "error";
        setPhase("error");
        setErrMsg("Tempo esgotado. O QR code expirou. Tente novamente.");
      }
    }, 180000);
  }, [callEvo, onRefresh]);

  const conectar = async () => {
    phaseRef.current = "loading";
    setPhase("loading"); setErrMsg(""); setQrImg(null); setPairingCode("");
    try {
      // Cria instância se ainda não existe
      if (!empData.evolution_instance_token) {
        await callEvo("create");
        // Aguarda um momento para a instância ficar pronta
        await new Promise(r => setTimeout(r, 1500));
        onRefresh?.();
      }
      // Conecta — retorna QR e pairing code (já com retry interno)
      const connRes = await callEvo("connect");
      if (connRes?.qrBase64) setQrImg(connRes.qrBase64.split("|")[0]);
      if (connRes?.pairingCode) setPairingCode(connRes.pairingCode);
      phaseRef.current = "qr";
      setPhase("qr");
      startPolling();
    } catch (e) {
      phaseRef.current = "error";
      setPhase("error");
      setErrMsg(e.message || "Erro ao conectar. Verifique a URL do servidor.");
    }
  };

  const desconectar = async () => {
    if (!confirm("Desconectar WhatsApp? A sessão será encerrada.")) return;
    setPhase("loading");
    try {
      await callEvo("logout");
      setPhase("idle");
      setQrImg(null);
      onRefresh?.();
    } catch (e) {
      setPhase("error");
      setErrMsg(e.message);
    }
  };

  const reconectar = async () => {
    phaseRef.current = "loading";
    setPhase("loading"); setErrMsg(""); setQrImg(null); setPairingCode("");
    try {
      // Reconfigura webhook + gera novo QR
      const connRes = await callEvo("connect");
      if (connRes?.qrBase64) setQrImg(connRes.qrBase64.split("|")[0]);
      if (connRes?.pairingCode) setPairingCode(connRes.pairingCode);
      phaseRef.current = "qr";
      setPhase("qr");
      startPolling();
    } catch (e) {
      phaseRef.current = "error";
      setPhase("error");
      setErrMsg(e.message);
    }
  };

  const isConnected = phase === "connected" || empData.evolution_connected;

  return (
    <div style={{ background: L.white, borderRadius: 12, border: `1.5px solid ${isConnected ? L.green + "44" : L.line}`, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <Row between mb={16}>
        <Row gap={12}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "#25D36618", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
            {isConnected ? "✅" : "📱"}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: L.t1 }}>WhatsApp via Evolution GO</div>
            <div style={{ fontSize: 11, color: L.t3, marginTop: 2 }}>
              {isConnected
                ? `Conectado${empData.evolution_phone ? ` · ${empData.evolution_phone}` : ""}`
                : "Escaneie o QR code para conectar"}
            </div>
          </div>
        </Row>
        <Tag
          color={isConnected ? L.green : L.t4}
          bg={isConnected ? L.greenBg : L.surface}>
          {isConnected ? "Conectado" : "Desconectado"}
        </Tag>
      </Row>

      {/* Webhook info */}
      <div style={{ background: L.surface, borderRadius: 9, padding: "9px 12px", marginBottom: 14, border: `1px solid ${L.lineSoft}` }}>
        <div style={{ fontSize: 10, color: L.t4, marginBottom: 4, fontFamily: "'JetBrains Mono',monospace" }}>
          URL do Webhook (Evolution GO)
          {empData.evolution_instance_token && <span style={{ color: L.green, marginLeft: 6 }}>· com token configurado</span>}
        </div>
        <Row gap={8}>
          <div style={{ flex: 1, fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", color: L.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{webhookDisplayUrl}</div>
          <CopyBtn value={webhookDisplayUrl} />
        </Row>
      </div>

      {/* Erros */}
      {errMsg && (
        <div style={{ padding: "8px 12px", background: L.redBg, borderRadius: 8, fontSize: 12, color: L.red, marginBottom: 14 }}>
          ⚠️ {errMsg}
        </div>
      )}

      {/* QR Code */}
      {phase === "qr" && (
        <div style={{ textAlign: "center", padding: "20px 0", marginBottom: 14 }}>
          {qrImg ? (
            <>
              <div style={{ fontSize: 12, color: L.t3, marginBottom: 12 }}>
                Abra o WhatsApp no celular → <b>Dispositivos Conectados</b> → <b>Conectar dispositivo</b>
              </div>
              <div style={{ display: "inline-block", padding: 12, background: L.white, borderRadius: 14, border: `1px solid ${L.line}`, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
                <img src={qrImg} alt="QR Code WhatsApp" style={{ width: 220, height: 220, display: "block" }} />
              </div>
              {pairingCode && (
                <div style={{ marginTop: 14, background: L.surface, borderRadius: 10, padding: "10px 16px", display: "inline-block", border: `1px solid ${L.line}` }}>
                  <div style={{ fontSize: 10, color: L.t4, marginBottom: 4 }}>Código de Pareamento</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: L.t1, letterSpacing: 3 }}>{pairingCode}</div>
                </div>
              )}
              <div style={{ fontSize: 10, color: L.t4, marginTop: 10, fontFamily: "'JetBrains Mono',monospace" }}>
                QR code atualiza a cada 4 segundos
              </div>
            </>
          ) : (
            <div style={{ padding: 30, color: L.t4 }}>
              <div style={{ fontSize: 28, marginBottom: 8, animation: "spin 1.5s linear infinite", display: "inline-block" }}>⟳</div>
              <div style={{ fontSize: 12 }}>Gerando QR code...</div>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {phase === "loading" && (
        <div style={{ textAlign: "center", padding: "20px 0", color: L.t3, fontSize: 12, marginBottom: 14 }}>
          <span style={{ animation: "spin 1.2s linear infinite", display: "inline-block", marginRight: 8 }}>⟳</span>
          Conectando ao servidor...
        </div>
      )}

      {/* Ações */}
      <Row gap={8}>
        {!isConnected && phase !== "qr" && phase !== "loading" && (
          <PBtn onClick={conectar} style={{ flex: 1 }}>
            📱 Conectar WhatsApp
          </PBtn>
        )}
        {phase === "qr" && (
          <button onClick={() => { clearInterval(pollRef.current); clearTimeout(timeoutRef.current); phaseRef.current = "idle"; setPhase("idle"); setQrImg(null); }}
            style={{ flex: 1, padding: "9px 16px", borderRadius: 9, background: L.surface, border: `1px solid ${L.line}`, color: L.t2, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 500 }}>
            Cancelar
          </button>
        )}
        {isConnected && (
          <>
            <button onClick={reconectar}
              style={{ padding: "9px 16px", borderRadius: 9, background: L.surface, border: `1px solid ${L.line}`, color: L.t2, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 500 }}>
              🔄 Reconectar
            </button>
            <button onClick={desconectar}
              style={{ padding: "9px 16px", borderRadius: 9, background: L.redBg, border: `1px solid ${L.red}22`, color: L.red, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600 }}>
              Desconectar
            </button>
          </>
        )}
      </Row>
    </div>
  );
}

export default function PageEmpresa({ empresa, user }) {
  const [tab, setTab] = useState("info");
  const [saving, setSaving] = useState(false);
  const [savingWaba, setSavingWaba] = useState(false);
  const [succ, setSucc] = useState("");
  const [succWaba, setSuccWaba] = useState("");

  const { data: empresas, refetch: refetchEmpresas } = useTable("empresas", {});
  const empData = empresas.find(e => e.id === user?.empresa_id) || {};

  const [infoForm, setInfoForm] = useState({});
  const [wabaForm, setWabaForm] = useState({ waba_phone_number_id:"", waba_access_token:"", waba_verify_token:"" });
  const [metaForm, setMetaForm] = useState({ meta_pixel_id:"", meta_access_token:"", meta_dataset_id:"" });
  const [ga4Form,  setGa4Form]  = useState({ ga4_measurement_id:"", ga4_api_secret:"" });
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingGa4,  setSavingGa4]  = useState(false);
  const [succMeta, setSuccMeta] = useState("");
  const [succGa4,  setSuccGa4]  = useState("");
  const { update } = useTable("empresas");

  // sync forms from empData
  useEffect(() => {
    if (empData.id) {
      setWabaForm({
        waba_phone_number_id: empData.waba_phone_number_id || "",
        waba_access_token:    empData.waba_access_token    || "",
        waba_verify_token:    empData.waba_verify_token    || "",
      });
      setMetaForm({
        meta_pixel_id:     empData.meta_pixel_id     || "",
        meta_access_token: empData.meta_access_token || "",
        meta_dataset_id:   empData.meta_dataset_id   || "",
      });
      setGa4Form({
        ga4_measurement_id: empData.ga4_measurement_id || "",
        ga4_api_secret:     empData.ga4_api_secret     || "",
      });
    }
  }, [empData.id]);

  const saveInfo = async () => {
    setSaving(true); setSucc("");
    await update(user?.empresa_id, infoForm);
    setSucc("Alterações salvas com sucesso!"); setSaving(false);
  };

  const saveWaba = async () => {
    setSavingWaba(true); setSuccWaba("");
    const { error } = await supabase.from("empresas").update({
      waba_phone_number_id: wabaForm.waba_phone_number_id,
      waba_access_token:    wabaForm.waba_access_token,
      waba_verify_token:    wabaForm.waba_verify_token,
    }).eq("id", user?.empresa_id);
    if (error) setSuccWaba("Erro ao salvar: " + error.message);
    else setSuccWaba("Configurações do WhatsApp salvas!");
    setSavingWaba(false);
  };

  const wabaStatus = empData.waba_phone_number_id ? "Configurado" : "Não configurado";
  const metaStatus = empData.meta_pixel_id ? "Conectado" : "Desconectado";
  const ga4Status  = empData.ga4_measurement_id ? "Conectado" : "Desconectado";

  const saveMeta = async () => {
    setSavingMeta(true); setSuccMeta("");
    const { error } = await supabase.from("empresas").update(metaForm).eq("id", user?.empresa_id);
    setSuccMeta(error ? "Erro: " + error.message : "Meta Ads salvo! Recarregue para ativar o pixel.");
    setSavingMeta(false);
  };

  const saveGa4 = async () => {
    setSavingGa4(true); setSuccGa4("");
    const { error } = await supabase.from("empresas").update(ga4Form).eq("id", user?.empresa_id);
    setSuccGa4(error ? "Erro: " + error.message : "Google Analytics salvo! Recarregue para ativar.");
    setSavingGa4(false);
  };

  return (
    <Fade>
      {/* Header card */}
      <div style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:22,marginBottom:14,display:"flex",alignItems:"center",gap:20,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
        <div style={{width:56,height:56,borderRadius:14,background:L.tealBg,border:`1.5px solid ${L.teal}22`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Logo size={40}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:18,fontWeight:700,color:L.t1,fontFamily:"'Outfit',sans-serif",marginBottom:4,letterSpacing:"-.3px"}}>{empData.nome||empresa}</div>
          <Row gap={14}>
            {[["CNPJ",empData.cnpj||"—"],["Segmento",empData.segmento||"—"],["Status",empData.status||"—"]].map(([k,v])=>(
              <span key={k} style={{fontSize:11,color:L.t4}}>{k}: <b style={{color:L.t2}}>{v}</b></span>
            ))}
          </Row>
        </div>
        <Row gap={8}>
          <Tag color={L.copper} bg={L.copperBg}>{empData.status||"trial"}</Tag>
        </Row>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:16,background:L.surface,padding:4,borderRadius:9,border:`1px solid ${L.line}`,width:"fit-content"}}>
        {["info","configurações","integrações"].map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:"6px 14px",borderRadius:7,fontSize:12,fontWeight:tab===t?600:400,cursor:"pointer",fontFamily:"inherit",background:tab===t?L.white:L.surface,color:tab===t?L.teal:L.t3,border:"none",transition:"all .12s",boxShadow:tab===t?"0 1px 3px rgba(0,0,0,0.07)":"none"}}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {tab==="info" && (
        <Grid cols={2} gap={14} responsive>
          <Card title="Informações da Empresa">
            {[["Nome",empData.nome||"—"],["CNPJ",empData.cnpj||"—"],["Segmento",empData.segmento||"—"],["Website",empData.website||"—"],["Telefone",empData.telefone||"—"],["Endereço",empData.endereco||"—"],["Status",empData.status||"—"]].map(([k,v])=>(
              <InfoRow key={k} label={k} value={v}/>
            ))}
          </Card>
          <Card title="Plano e Uso">
            <Grid cols={2} gap={8} mb={14} responsive>
              {[["MRR",`R$ ${parseFloat(empData.mrr||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`,L.teal,L.tealBg],["Status",empData.status||"—",L.copper,L.copperBg]].map(([k,v,c,bg])=>(
                <div key={k} style={{padding:11,background:bg,borderRadius:9,border:`1px solid ${c}18`}}>
                  <div style={{fontSize:10,color:c,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"1px",textTransform:"uppercase",marginBottom:4,fontWeight:600}}>{k}</div>
                  <div style={{fontSize:15,fontWeight:700,color:L.t1,fontFamily:"'Outfit',sans-serif"}}>{v}</div>
                </div>
              ))}
            </Grid>
          </Card>
        </Grid>
      )}

      {/* Configurações tab */}
      {tab==="configurações" && (
        <Card title="Configurações da Empresa">
          {succ && <div style={{padding:"8px 12px",background:L.greenBg,borderRadius:8,fontSize:12,color:L.green,marginBottom:14}}>{succ}</div>}
          <Grid cols={2} gap={14} responsive>
            {[["Nome da Empresa","nome",empData.nome||"","text"],["CNPJ","cnpj",empData.cnpj||"","text"],["Telefone","telefone",empData.telefone||"","text"],["Website","website",empData.website||"","text"],["Segmento","segmento",empData.segmento||"","text"],["Endereço","endereco",empData.endereco||"","text"],["MRR (R$) — Receita Recorrente Mensal","mrr",empData.mrr||"","number"]].map(([l,k,v,type])=>(
              <div key={k}>
                <label style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1.2px",display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace"}}>{l}</label>
                <input defaultValue={v} type={type} onChange={e=>setInfoForm(p=>({...p,[k]:type==="number"?parseFloat(e.target.value)||0:e.target.value}))}
                  style={{width:"100%",background:L.surface,border:`1.5px solid ${L.line}`,borderRadius:9,padding:"9px 12px",color:L.t1,fontSize:12.5,fontFamily:"inherit",outline:"none",marginBottom:14}}
                  onFocus={e=>e.target.style.borderColor=L.teal} onBlur={e=>e.target.style.borderColor=L.line}/>
              </div>
            ))}
          </Grid>
          <PBtn onClick={saveInfo}>{saving?"Salvando...":"Salvar Alterações"}</PBtn>
        </Card>
      )}

      {/* Integrações tab */}
      {tab==="integrações" && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* ── WhatsApp via Evolution GO ── */}
          <EvolutionCard user={user} empData={empData} onRefresh={refetchEmpresas} />

          {/* ── META ADS + PIXEL + CONVERSIONS API ── */}
          <div style={{background:L.white,borderRadius:12,border:`1.5px solid ${empData.meta_pixel_id?L.blue+"33":L.line}`,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <Row between mb={16}>
              <Row gap={12}>
                <div style={{width:42,height:42,borderRadius:11,background:"#1877f222",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📘</div>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:L.t1}}>Meta Ads — Pixel & Conversions API</div>
                  <div style={{fontSize:11,color:L.t3,marginTop:2}}>Facebook Pixel + API de Conversão (server-side)</div>
                </div>
              </Row>
              <Tag color={empData.meta_pixel_id?L.green:L.red} bg={empData.meta_pixel_id?L.greenBg:L.redBg}>{metaStatus}</Tag>
            </Row>

            <div style={{background:"#fffbf0",border:`1px solid ${L.yellow}44`,borderRadius:10,padding:12,marginBottom:16,fontSize:11,color:L.t2,lineHeight:1.7}}>
              <div style={{fontWeight:700,color:L.yellow,marginBottom:6}}>⚡ Como configurar</div>
              <ol style={{paddingLeft:18,margin:0}}>
                <li>Acesse <b>Meta Business Suite → Events Manager → Pixels</b></li>
                <li>Copie o <b>Pixel ID</b> e cole abaixo</li>
                <li>Para Conversions API: em <b>Configurações → API de Conversões</b>, gere um <b>Access Token</b></li>
                <li>O <b>Dataset ID</b> é o mesmo ID do seu Pixel</li>
                <li>Salve — o pixel será injetado automaticamente em todas as páginas</li>
              </ol>
            </div>

            {succMeta && <div style={{padding:"8px 12px",background:succMeta.startsWith("Erro")?L.redBg:L.greenBg,borderRadius:8,fontSize:12,color:succMeta.startsWith("Erro")?L.red:L.green,marginBottom:14}}>{succMeta}</div>}

            <Grid cols={2} gap={12} responsive>
              <LabelInput label="Pixel ID" value={metaForm.meta_pixel_id} onChange={e=>setMetaForm(p=>({...p,meta_pixel_id:e.target.value}))} placeholder="Ex: 123456789012345"/>
              <LabelInput label="Dataset ID (mesmo do Pixel)" value={metaForm.meta_dataset_id} onChange={e=>setMetaForm(p=>({...p,meta_dataset_id:e.target.value}))} placeholder="Ex: 123456789012345"/>
              <div style={{gridColumn:"1/-1"}}>
                <LabelInput label="Access Token — Conversions API" value={metaForm.meta_access_token} onChange={e=>setMetaForm(p=>({...p,meta_access_token:e.target.value}))} placeholder="EAAxxxxxxxx..." type="password"/>
              </div>
            </Grid>
            <PBtn onClick={saveMeta}>{savingMeta?"Salvando...":"Salvar Meta Ads"}</PBtn>
          </div>

          {/* ── GOOGLE ANALYTICS GA4 ── */}
          <div style={{background:L.white,borderRadius:12,border:`1.5px solid ${empData.ga4_measurement_id?L.green+"33":L.line}`,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <Row between mb={16}>
              <Row gap={12}>
                <div style={{width:42,height:42,borderRadius:11,background:L.greenBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📊</div>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:L.t1}}>Google Analytics 4</div>
                  <div style={{fontSize:11,color:L.t3,marginTop:2}}>GA4 — rastreamento de eventos e conversões</div>
                </div>
              </Row>
              <Tag color={empData.ga4_measurement_id?L.green:L.red} bg={empData.ga4_measurement_id?L.greenBg:L.redBg}>{ga4Status}</Tag>
            </Row>

            <div style={{background:"#fffbf0",border:`1px solid ${L.yellow}44`,borderRadius:10,padding:12,marginBottom:16,fontSize:11,color:L.t2,lineHeight:1.7}}>
              <div style={{fontWeight:700,color:L.yellow,marginBottom:6}}>⚡ Como configurar</div>
              <ol style={{paddingLeft:18,margin:0}}>
                <li>Acesse <b>Google Analytics → Admin → Fluxos de dados</b></li>
                <li>Copie o <b>Measurement ID</b> (formato G-XXXXXXXX)</li>
                <li>Para Measurement Protocol: em <b>Segredos da API do protocolo de medição</b>, crie um segredo</li>
                <li>Salve — o script GA4 será injetado automaticamente</li>
              </ol>
            </div>

            {succGa4 && <div style={{padding:"8px 12px",background:succGa4.startsWith("Erro")?L.redBg:L.greenBg,borderRadius:8,fontSize:12,color:succGa4.startsWith("Erro")?L.red:L.green,marginBottom:14}}>{succGa4}</div>}

            <Grid cols={2} gap={12} responsive>
              <LabelInput label="Measurement ID" value={ga4Form.ga4_measurement_id} onChange={e=>setGa4Form(p=>({...p,ga4_measurement_id:e.target.value}))} placeholder="Ex: G-XXXXXXXXXX"/>
              <LabelInput label="API Secret (Measurement Protocol)" value={ga4Form.ga4_api_secret} onChange={e=>setGa4Form(p=>({...p,ga4_api_secret:e.target.value}))} placeholder="Segredo da API" type="password"/>
            </Grid>
            <PBtn onClick={saveGa4}>{savingGa4?"Salvando...":"Salvar Google Analytics"}</PBtn>
          </div>

          {/* ── WEBHOOK API ── */}
          <div style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <Row between mb={12}>
              <Row gap={12}>
                <div style={{width:42,height:42,borderRadius:11,background:L.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:L.teal,fontWeight:700}}>{"{ }"}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:L.t1}}>Webhook API</div>
                  <div style={{fontSize:11,color:L.t3,marginTop:2}}>Receba eventos via webhook em qualquer sistema</div>
                </div>
              </Row>
              <Tag color={L.teal} bg={L.tealBg}>Ativo</Tag>
            </Row>
            <div style={{background:L.surface,borderRadius:9,padding:12,border:`1px solid ${L.line}`}}>
              <div style={{fontSize:10,color:L.t4,marginBottom:6}}>URL do Webhook</div>
              <Row gap={8}>
                <div style={{flex:1,background:L.white,border:`1px solid ${L.line}`,borderRadius:8,padding:"7px 10px",fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:L.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{WEBHOOK_URL}</div>
                <CopyBtn value={WEBHOOK_URL}/>
              </Row>
            </div>
          </div>
        </div>
      )}
    </Fade>
  );
}
