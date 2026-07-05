import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { L } from "../constants/theme";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const OBJETIVOS = [
  { v: "OUTCOME_LEADS",       l: "Geração de Leads" },
  { v: "OUTCOME_TRAFFIC",     l: "Tráfego" },
  { v: "OUTCOME_AWARENESS",   l: "Reconhecimento" },
  { v: "OUTCOME_ENGAGEMENT",  l: "Engajamento" },
  { v: "OUTCOME_SALES",       l: "Vendas" },
  { v: "OUTCOME_APP_PROMOTION", l: "Promoção de App" },
];

const OTIMIZACOES = [
  { v: "LEAD_GENERATION",   l: "Geração de Leads" },
  { v: "LINK_CLICKS",       l: "Cliques no Link" },
  { v: "IMPRESSIONS",       l: "Impressões" },
  { v: "REACH",             l: "Alcance" },
  { v: "THRUPLAY",          l: "ThruPlay (Vídeo)" },
  { v: "VIDEO_VIEWS",       l: "Visualizações de Vídeo" },
  { v: "CONVERSIONS",       l: "Conversões" },
];

function fmtBRL(v) {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtNum(v) {
  return Number(v ?? 0).toLocaleString("pt-BR");
}
function fmtPct(a, b) {
  if (!b || b === 0) return "0%";
  return ((a / b) * 100).toFixed(2) + "%";
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
}

const statusColor = (s) => {
  if (!s) return L.t3;
  const up = s.toUpperCase();
  if (up === "ACTIVE") return "#22c55e";
  if (up === "PAUSED") return "#f59e0b";
  if (up === "DELETED" || up === "ARCHIVED") return L.t3;
  return L.t3;
};

const statusLabel = (s) => {
  if (!s) return "—";
  const up = s.toUpperCase();
  if (up === "ACTIVE") return "Ativo";
  if (up === "PAUSED") return "Pausado";
  if (up === "DELETED") return "Deletado";
  if (up === "ARCHIVED") return "Arquivado";
  return s;
};

// ── Simple bar chart ────────────────────────────────────────────────────────
function MiniBar({ data, color = L.accent }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.v), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 40 }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.label}: ${fmtNum(d.v)}`}
          style={{
            flex: 1, background: color, borderRadius: 2,
            height: `${Math.max(4, (d.v / max) * 40)}px`,
            opacity: 0.85, cursor: "default",
          }} />
      ))}
    </div>
  );
}

// ── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: L.card, border: `1px solid ${L.line}`, borderRadius: 10,
      padding: "14px 18px",
    }}>
      <div style={{ fontSize: 11, color: L.t3, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? L.t1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: L.t3, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Spinner ─────────────────────────────────────────────────────────────────
function Spin() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        border: `3px solid ${L.line}`, borderTopColor: L.accent,
        animation: "spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.45)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: L.bg, border: `1px solid ${L.line}`, borderRadius: 14,
        width: "100%", maxWidth: width, maxHeight: "90vh", overflowY: "auto",
        padding: 24,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: L.t1 }}>{title}</span>
          <button onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: L.t3 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Form field helpers ───────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, color: L.t3, marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 7,
  border: `1px solid ${L.line}`, background: L.card,
  color: L.t1, fontSize: 13, boxSizing: "border-box",
  fontFamily: "inherit",
};

const selectStyle = { ...inputStyle };

function BtnPrimary({ children, onClick, disabled, loading }) {
  return (
    <button onClick={onClick} disabled={disabled || loading}
      style={{
        background: L.accent, color: "white", border: "none",
        borderRadius: 8, padding: "9px 18px", fontWeight: 600,
        fontSize: 13, cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.6 : 1,
      }}>
      {loading ? "Salvando…" : children}
    </button>
  );
}

// ── API call helper ──────────────────────────────────────────────────────────
async function callAction(body, session) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function TabDashboard({ contaId, session }) {
  const [data, setData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [range, setRange] = useState(7);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!contaId) return;
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - range);
    const sinceStr = since.toISOString().split("T")[0];

    const { data: rows } = await supabase
      .from("meta_insights")
      .select("data,impressoes,alcance,cliques,gasto,leads,video_plays,thruplays")
      .eq("meta_conta_id", contaId)
      .eq("ad_id", "")
      .gte("data", sinceStr)
      .order("data", { ascending: true });

    if (rows) {
      const totals = rows.reduce((acc, r) => ({
        impressoes: acc.impressoes + (r.impressoes || 0),
        alcance:    acc.alcance    + (r.alcance    || 0),
        cliques:    acc.cliques    + (r.cliques    || 0),
        gasto:      acc.gasto      + Number(r.gasto || 0),
        leads:      acc.leads      + (r.leads      || 0),
        video_plays: acc.video_plays + (r.video_plays || 0),
        thruplays:  acc.thruplays  + (r.thruplays  || 0),
      }), { impressoes: 0, alcance: 0, cliques: 0, gasto: 0, leads: 0, video_plays: 0, thruplays: 0 });
      setData(totals);
      setChartData(rows.map(r => ({ label: r.data, v: Number(r.gasto) })));
    }
    setLoading(false);
  }, [contaId, range]);

  useEffect(() => { load(); }, [load]);

  if (!contaId) return (
    <div style={{ textAlign: "center", color: L.t3, padding: 60 }}>
      Selecione uma conta de anúncio para ver o dashboard.
    </div>
  );

  if (loading) return <Spin />;

  const d = data ?? {};
  const ctr = fmtPct(d.cliques, d.impressoes);
  const cpl  = d.leads > 0 ? fmtBRL(d.gasto / d.leads) : "—";
  const cpc  = d.cliques > 0 ? fmtBRL(d.gasto / d.cliques) : "—";

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: L.t3 }}>Período:</span>
        {[7, 14, 30].map(r => (
          <button key={r} onClick={() => setRange(r)}
            style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12,
              border: `1px solid ${range === r ? L.accent : L.line}`,
              background: range === r ? L.accent : "transparent",
              color: range === r ? "white" : L.t2,
              cursor: "pointer",
            }}>
            {r}d
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="Investimento"   value={fmtBRL(d.gasto)}       color={L.accent} />
        <StatCard label="Impressões"     value={fmtNum(d.impressoes)}  />
        <StatCard label="Alcance"        value={fmtNum(d.alcance)}     />
        <StatCard label="Cliques"        value={fmtNum(d.cliques)}     />
        <StatCard label="CTR"            value={ctr}                   />
        <StatCard label="CPC"            value={cpc}                   />
        <StatCard label="Leads"          value={fmtNum(d.leads)}       color="#22c55e" />
        <StatCard label="CPL"            value={cpl}                   color="#22c55e" />
        <StatCard label="Video Plays"    value={fmtNum(d.video_plays)} />
        <StatCard label="ThruPlays"      value={fmtNum(d.thruplays)}   />
      </div>

      {chartData.length > 0 && (
        <div style={{
          background: L.card, border: `1px solid ${L.line}`,
          borderRadius: 10, padding: "16px 18px",
        }}>
          <div style={{ fontSize: 12, color: L.t3, marginBottom: 10 }}>Investimento por dia (R$)</div>
          <MiniBar data={chartData} color={L.accent} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 10, color: L.t4 }}>{chartData[0]?.label}</span>
            <span style={{ fontSize: 10, color: L.t4 }}>{chartData.at(-1)?.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL: Nova / Editar Campanha
// ════════════════════════════════════════════════════════════════════════════
function ModalCampanha({ onClose, onSaved, contaId, session, edit }) {
  const [nome, setNome] = useState(edit?.nome ?? "");
  const [objetivo, setObjetivo] = useState(edit?.objetivo ?? "OUTCOME_LEADS");
  const [orcamento, setOrcamento] = useState(edit?.orcamento_diario ?? "");
  const [inicio, setInicio] = useState(edit?.data_inicio ?? "");
  const [fim, setFim] = useState(edit?.data_fim ?? "");
  const [statusInicial, setStatusInicial] = useState(edit?.status ?? "PAUSED");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!nome.trim()) { setErr("Nome é obrigatório."); return; }
    setSaving(true); setErr("");
    const action = edit ? "update_campaign" : "create_campaign";
    const body = {
      action, conta_id: contaId,
      ...(edit ? { campaign_id: edit.campaign_id } : {}),
      nome: nome.trim(),
      objetivo,
      orcamento_diario: orcamento ? Number(orcamento) : undefined,
      data_inicio: inicio || undefined,
      data_fim:    fim || undefined,
      status_inicial: statusInicial,
      ...(edit ? { status: statusInicial } : {}),
    };
    const r = await callAction(body, session);
    setSaving(false);
    if (r.error) { setErr(r.error); return; }
    onSaved();
  };

  return (
    <Modal title={edit ? "Editar Campanha" : "Nova Campanha"} onClose={onClose}>
      <Field label="Nome da campanha">
        <input style={inputStyle} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Lançamento Produto X" />
      </Field>
      {!edit && (
        <Field label="Objetivo">
          <select style={selectStyle} value={objetivo} onChange={e => setObjetivo(e.target.value)}>
            {OBJETIVOS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </Field>
      )}
      <Field label="Orçamento diário (R$)">
        <input style={inputStyle} type="number" min="0" step="0.01"
          value={orcamento} onChange={e => setOrcamento(e.target.value)} placeholder="Ex: 50.00" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Data início">
          <input style={inputStyle} type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
        </Field>
        <Field label="Data fim">
          <input style={inputStyle} type="date" value={fim} onChange={e => setFim(e.target.value)} />
        </Field>
      </div>
      <Field label="Status">
        <select style={selectStyle} value={statusInicial} onChange={e => setStatusInicial(e.target.value)}>
          <option value="PAUSED">Pausado</option>
          <option value="ACTIVE">Ativo</option>
        </select>
      </Field>
      {err && <p style={{ color: L.red, fontSize: 12, marginBottom: 10 }}>{err}</p>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ background: "none", border: `1px solid ${L.line}`, borderRadius: 8, padding: "9px 16px", cursor: "pointer", color: L.t2, fontSize: 13 }}>Cancelar</button>
        <BtnPrimary onClick={save} loading={saving}>{edit ? "Salvar" : "Criar Campanha"}</BtnPrimary>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL: Nova / Editar Conjunto (AdSet)
// ════════════════════════════════════════════════════════════════════════════
function ModalAdset({ onClose, onSaved, contaId, session, campanha, edit }) {
  const [nome, setNome] = useState(edit?.nome ?? "");
  const [orcamento, setOrcamento] = useState(edit?.orcamento_diario ?? "");
  const [otimizacao, setOtimizacao] = useState("LEAD_GENERATION");
  const [inicio, setInicio] = useState(edit?.data_inicio ?? "");
  const [fim, setFim] = useState(edit?.data_fim ?? "");
  const [statusInicial, setStatusInicial] = useState(edit?.status ?? "PAUSED");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!nome.trim()) { setErr("Nome é obrigatório."); return; }
    if (!orcamento) { setErr("Orçamento é obrigatório."); return; }
    setSaving(true); setErr("");
    const action = edit ? "update_adset" : "create_adset";
    const body = {
      action, conta_id: contaId,
      ...(edit ? { adset_id: edit.adset_id } : { campaign_id: campanha.campaign_id }),
      nome: nome.trim(),
      orcamento_diario: Number(orcamento),
      otimizacao,
      data_inicio: inicio || undefined,
      data_fim:    fim || undefined,
      status_inicial: statusInicial,
      ...(edit ? { status: statusInicial } : {}),
    };
    const r = await callAction(body, session);
    setSaving(false);
    if (r.error) { setErr(r.error); return; }
    onSaved();
  };

  return (
    <Modal title={edit ? "Editar Conjunto" : `Novo Conjunto — ${campanha?.nome ?? ""}`} onClose={onClose}>
      <Field label="Nome do conjunto">
        <input style={inputStyle} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Público 25-45 SP" />
      </Field>
      <Field label="Orçamento diário (R$)">
        <input style={inputStyle} type="number" min="0" step="0.01"
          value={orcamento} onChange={e => setOrcamento(e.target.value)} placeholder="Ex: 30.00" />
      </Field>
      {!edit && (
        <Field label="Otimização">
          <select style={selectStyle} value={otimizacao} onChange={e => setOtimizacao(e.target.value)}>
            {OTIMIZACOES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </Field>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Data início">
          <input style={inputStyle} type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
        </Field>
        <Field label="Data fim">
          <input style={inputStyle} type="date" value={fim} onChange={e => setFim(e.target.value)} />
        </Field>
      </div>
      <Field label="Status">
        <select style={selectStyle} value={statusInicial} onChange={e => setStatusInicial(e.target.value)}>
          <option value="PAUSED">Pausado</option>
          <option value="ACTIVE">Ativo</option>
        </select>
      </Field>
      {err && <p style={{ color: L.red, fontSize: 12, marginBottom: 10 }}>{err}</p>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ background: "none", border: `1px solid ${L.line}`, borderRadius: 8, padding: "9px 16px", cursor: "pointer", color: L.t2, fontSize: 13 }}>Cancelar</button>
        <BtnPrimary onClick={save} loading={saving}>{edit ? "Salvar" : "Criar Conjunto"}</BtnPrimary>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: CAMPANHAS
// ════════════════════════════════════════════════════════════════════════════
function TabCampanhas({ contaId, session }) {
  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [adsets, setAdsets] = useState({});
  const [modal, setModal] = useState(null);
  const [adsetModal, setAdsetModal] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const loadCamps = useCallback(async () => {
    if (!contaId) return;
    setLoading(true);
    const { data } = await supabase
      .from("meta_campanhas")
      .select("*")
      .eq("meta_conta_id", contaId)
      .order("synced_at", { ascending: false });
    setCamps(data ?? []);
    setLoading(false);
  }, [contaId]);

  useEffect(() => { loadCamps(); }, [loadCamps]);

  const loadAdsets = async (campId, campUUID) => {
    const { data } = await supabase
      .from("meta_adsets")
      .select("*")
      .eq("campanha_id", campUUID)
      .order("synced_at", { ascending: false });
    setAdsets(prev => ({ ...prev, [campId]: data ?? [] }));
  };

  const toggleExpand = (camp) => {
    const was = expanded[camp.campaign_id];
    setExpanded(prev => ({ ...prev, [camp.campaign_id]: !was }));
    if (!was && !adsets[camp.campaign_id]) loadAdsets(camp.campaign_id, camp.id);
  };

  const doAction = async (action, body) => {
    const key = body.entity_id ?? body.campaign_id ?? body.adset_id;
    setActionLoading(prev => ({ ...prev, [key]: true }));
    const r = await callAction({ action, conta_id: contaId, ...body }, session);
    setActionLoading(prev => ({ ...prev, [key]: false }));
    if (r.error) alert("Erro: " + r.error);
    else loadCamps();
  };

  const toggleCamp = (camp) => {
    const isActive = camp.status?.toUpperCase() === "ACTIVE";
    doAction(isActive ? "pause" : "activate", { entity: "campaign", entity_id: camp.campaign_id });
  };

  const toggleAdset = (s, campId) => {
    const isActive = s.status?.toUpperCase() === "ACTIVE";
    callAction({ action: isActive ? "pause" : "activate", conta_id: contaId, entity: "adset", entity_id: s.adset_id }, session)
      .then(r => {
        if (r.error) alert("Erro: " + r.error);
        else loadAdsets(campId, s.campanha_id);
      });
  };

  const deleteCamp = async (camp) => {
    if (!confirm(`Deletar campanha "${camp.nome}"? Esta ação é irreversível.`)) return;
    const r = await callAction({ action: "delete_campaign", conta_id: contaId, campaign_id: camp.campaign_id }, session);
    if (r.error) alert("Erro: " + r.error);
    else loadCamps();
  };

  if (!contaId) return <div style={{ textAlign: "center", color: L.t3, padding: 60 }}>Selecione uma conta de anúncio.</div>;
  if (loading) return <Spin />;

  return (
    <div>
      {modal && (
        <ModalCampanha
          edit={modal === true ? null : modal}
          contaId={contaId}
          session={session}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); loadCamps(); }}
        />
      )}
      {adsetModal && (
        <ModalAdset
          edit={adsetModal.edit ?? null}
          campanha={adsetModal.campanha}
          contaId={contaId}
          session={session}
          onClose={() => setAdsetModal(null)}
          onSaved={() => {
            setAdsetModal(null);
            if (adsetModal.campanha) loadAdsets(adsetModal.campanha.campaign_id, adsetModal.campanha.id);
          }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button onClick={() => setModal(true)}
          style={{
            background: L.accent, color: "white", border: "none",
            borderRadius: 8, padding: "9px 18px", fontWeight: 600,
            fontSize: 13, cursor: "pointer",
          }}>
          + Nova Campanha
        </button>
      </div>

      {camps.length === 0 && (
        <div style={{ textAlign: "center", color: L.t3, padding: 40 }}>
          Nenhuma campanha encontrada. Crie uma nova ou sincronize a conta.
        </div>
      )}

      {camps.map(camp => {
        const isActive = camp.status?.toUpperCase() === "ACTIVE";
        const isExp    = expanded[camp.campaign_id];
        const aSets    = adsets[camp.campaign_id] ?? [];
        const busy     = actionLoading[camp.campaign_id];

        return (
          <div key={camp.id} style={{
            border: `1px solid ${L.line}`, borderRadius: 10,
            marginBottom: 10, overflow: "hidden",
          }}>
            {/* Campaign row */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", background: L.card,
              cursor: "pointer",
            }} onClick={() => toggleExpand(camp)}>
              <span style={{ fontSize: 18, userSelect: "none" }}>{isExp ? "▾" : "▸"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: L.t1 }}>{camp.nome ?? camp.campaign_id}</div>
                <div style={{ fontSize: 11, color: L.t3, marginTop: 2 }}>
                  {OBJETIVOS.find(o => o.v === camp.objetivo)?.l ?? camp.objetivo}
                  {camp.orcamento_diario ? ` · ${fmtBRL(camp.orcamento_diario)}/dia` : ""}
                  {camp.data_inicio ? ` · ${fmtDate(camp.data_inicio)}` : ""}
                  {camp.data_fim ? ` → ${fmtDate(camp.data_fim)}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={e => e.stopPropagation()}>
                <span style={{
                  padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: isActive ? "#dcfce7" : "#fef9c3",
                  color: isActive ? "#16a34a" : "#b45309",
                }}>
                  {statusLabel(camp.status)}
                </span>
                <button onClick={() => toggleCamp(camp)} disabled={busy}
                  style={{
                    padding: "5px 12px", borderRadius: 7, fontSize: 12,
                    border: `1px solid ${L.line}`, background: "transparent",
                    cursor: "pointer", color: L.t2, opacity: busy ? 0.5 : 1,
                  }}>
                  {busy ? "…" : isActive ? "⏸ Pausar" : "▶ Ativar"}
                </button>
                <button onClick={() => setModal(camp)}
                  style={{ padding: "5px 10px", borderRadius: 7, fontSize: 12, border: `1px solid ${L.line}`, background: "transparent", cursor: "pointer", color: L.t2 }}>
                  ✎ Editar
                </button>
                <button onClick={() => deleteCamp(camp)}
                  style={{ padding: "5px 10px", borderRadius: 7, fontSize: 12, border: `1px solid ${L.line}`, background: "transparent", cursor: "pointer", color: L.red }}>
                  🗑
                </button>
              </div>
            </div>

            {/* AdSets expanded */}
            {isExp && (
              <div style={{ background: L.bg, padding: "8px 16px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: L.t3, fontWeight: 600 }}>CONJUNTOS DE ANÚNCIO</span>
                  <button onClick={() => setAdsetModal({ campanha: camp })}
                    style={{
                      fontSize: 12, padding: "4px 12px", borderRadius: 7,
                      border: `1px solid ${L.accent}`, background: "transparent",
                      color: L.accent, cursor: "pointer", fontWeight: 600,
                    }}>
                    + Novo Conjunto
                  </button>
                </div>
                {aSets.length === 0 && (
                  <div style={{ fontSize: 12, color: L.t3, textAlign: "center", padding: "10px 0" }}>
                    Nenhum conjunto encontrado.
                  </div>
                )}
                {aSets.map(s => {
                  const sActive = s.status?.toUpperCase() === "ACTIVE";
                  return (
                    <div key={s.id} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 12px", borderRadius: 8, border: `1px solid ${L.line}`,
                      background: L.card, marginBottom: 6,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: L.t1 }}>{s.nome ?? s.adset_id}</div>
                        <div style={{ fontSize: 11, color: L.t3 }}>
                          {s.orcamento_diario ? fmtBRL(s.orcamento_diario) + "/dia" : ""}
                          {s.data_inicio ? ` · ${fmtDate(s.data_inicio)}` : ""}
                          {s.data_fim ? ` → ${fmtDate(s.data_fim)}` : ""}
                        </div>
                      </div>
                      <span style={{
                        padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: sActive ? "#dcfce7" : "#fef9c3",
                        color: sActive ? "#16a34a" : "#b45309",
                      }}>{statusLabel(s.status)}</span>
                      <button onClick={() => toggleAdset(s, camp.campaign_id)}
                        style={{ padding: "4px 10px", borderRadius: 7, fontSize: 11, border: `1px solid ${L.line}`, background: "transparent", cursor: "pointer", color: L.t2 }}>
                        {sActive ? "⏸" : "▶"}
                      </button>
                      <button onClick={() => setAdsetModal({ edit: s, campanha: camp })}
                        style={{ padding: "4px 10px", borderRadius: 7, fontSize: 11, border: `1px solid ${L.line}`, background: "transparent", cursor: "pointer", color: L.t2 }}>
                        ✎
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: ANÚNCIOS
// ════════════════════════════════════════════════════════════════════════════
function TabAnuncios({ contaId, session }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [insights, setInsights] = useState({});

  const load = useCallback(async () => {
    if (!contaId) return;
    setLoading(true);

    const { data: adRows } = await supabase
      .from("meta_anuncios")
      .select("*, meta_adsets(nome, meta_campanhas(nome, meta_conta_id))")
      .order("synced_at", { ascending: false });

    // Filter by conta
    const filtered = (adRows ?? []).filter(
      a => a.meta_adsets?.meta_campanhas?.meta_conta_id === contaId
    );
    setAds(filtered);

    // Load insights for these ads (last 30d)
    if (filtered.length > 0) {
      const adIds = filtered.map(a => a.ad_id);
      const since = new Date(); since.setDate(since.getDate() - 30);
      const { data: insRows } = await supabase
        .from("meta_insights")
        .select("ad_id,impressoes,alcance,cliques,gasto,leads,video_plays,thruplays")
        .eq("meta_conta_id", contaId)
        .in("ad_id", adIds)
        .gte("data", since.toISOString().split("T")[0]);

      const map = {};
      for (const r of insRows ?? []) {
        if (!map[r.ad_id]) map[r.ad_id] = { impressoes: 0, alcance: 0, cliques: 0, gasto: 0, leads: 0, video_plays: 0, thruplays: 0 };
        map[r.ad_id].impressoes += r.impressoes || 0;
        map[r.ad_id].alcance    += r.alcance    || 0;
        map[r.ad_id].cliques    += r.cliques    || 0;
        map[r.ad_id].gasto      += Number(r.gasto || 0);
        map[r.ad_id].leads      += r.leads      || 0;
        map[r.ad_id].video_plays += r.video_plays || 0;
        map[r.ad_id].thruplays  += r.thruplays  || 0;
      }
      setInsights(map);
    }
    setLoading(false);
  }, [contaId]);

  useEffect(() => { load(); }, [load]);

  const toggleAd = async (ad) => {
    const isActive = ad.status?.toUpperCase() === "ACTIVE";
    const r = await callAction({
      action: isActive ? "pause" : "activate",
      conta_id: contaId, entity: "ad", entity_id: ad.ad_id,
    }, session);
    if (r.error) alert("Erro: " + r.error);
    else load();
  };

  if (!contaId) return <div style={{ textAlign: "center", color: L.t3, padding: 60 }}>Selecione uma conta de anúncio.</div>;
  if (loading) return <Spin />;

  const displayed = ads.filter(a => filterStatus === "all" || a.status?.toUpperCase() === filterStatus);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["all", "Todos"], ["ACTIVE", "Ativos"], ["PAUSED", "Pausados"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilterStatus(v)}
            style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12,
              border: `1px solid ${filterStatus === v ? L.accent : L.line}`,
              background: filterStatus === v ? L.accent : "transparent",
              color: filterStatus === v ? "white" : L.t2, cursor: "pointer",
            }}>{l}</button>
        ))}
      </div>

      {displayed.length === 0 && (
        <div style={{ textAlign: "center", color: L.t3, padding: 40 }}>Nenhum anúncio encontrado.</div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {displayed.map(ad => {
          const ins = insights[ad.ad_id] ?? {};
          const isActive = ad.status?.toUpperCase() === "ACTIVE";
          const campNome = ad.meta_adsets?.meta_campanhas?.nome ?? "—";
          const adsetNome = ad.meta_adsets?.nome ?? "—";
          return (
            <div key={ad.id} style={{
              display: "flex", gap: 12, background: L.card,
              border: `1px solid ${L.line}`, borderRadius: 10, padding: "12px 14px",
              alignItems: "flex-start",
            }}>
              {/* Thumbnail */}
              <div style={{
                width: 60, height: 60, borderRadius: 8, flexShrink: 0,
                background: L.line, overflow: "hidden", position: "relative",
              }}>
                {ad.thumbnail_url
                  ? <img src={ad.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    {ad.is_video ? "🎬" : "🖼️"}
                  </div>
                }
                {ad.is_video && (
                  <div style={{
                    position: "absolute", bottom: 2, right: 2,
                    background: "rgba(0,0,0,0.6)", borderRadius: 4,
                    padding: "1px 4px", fontSize: 9, color: "white",
                  }}>VIDEO</div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: L.t1, marginBottom: 2 }}>{ad.nome ?? ad.ad_id}</div>
                <div style={{ fontSize: 11, color: L.t3, marginBottom: 8 }}>
                  {campNome} › {adsetNome}
                </div>
                {/* Metrics grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(90px,1fr))", gap: 8 }}>
                  {[
                    ["Gasto", fmtBRL(ins.gasto)],
                    ["Impressões", fmtNum(ins.impressoes)],
                    ["Cliques", fmtNum(ins.cliques)],
                    ["CTR", fmtPct(ins.cliques, ins.impressoes)],
                    ["Leads", fmtNum(ins.leads)],
                    ...(ad.is_video ? [
                      ["Plays", fmtNum(ins.video_plays)],
                      ["ThruPlays", fmtNum(ins.thruplays)],
                    ] : []),
                  ].map(([l, v]) => (
                    <div key={l} style={{ background: L.bg, borderRadius: 6, padding: "5px 8px" }}>
                      <div style={{ fontSize: 10, color: L.t4 }}>{l}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: L.t1 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <span style={{
                  padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: isActive ? "#dcfce7" : "#fef9c3",
                  color: isActive ? "#16a34a" : "#b45309",
                }}>{statusLabel(ad.status)}</span>
                <button onClick={() => toggleAd(ad)}
                  style={{
                    padding: "5px 12px", borderRadius: 7, fontSize: 12,
                    border: `1px solid ${L.line}`, background: "transparent",
                    cursor: "pointer", color: L.t2,
                  }}>
                  {isActive ? "⏸ Pausar" : "▶ Ativar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: LEADS
// ════════════════════════════════════════════════════════════════════════════
function TabLeads({ contaId, session }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterImport, setFilterImport] = useState("all");
  const [importing, setImporting] = useState({});
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    if (!contaId) return;
    setLoading(true);
    const { data } = await supabase
      .from("meta_leads")
      .select("*")
      .eq("meta_conta_id", contaId)
      .order("criado_em", { ascending: false })
      .limit(200);
    setLeads(data ?? []);
    setLoading(false);
  }, [contaId]);

  useEffect(() => { load(); }, [load]);

  const importLead = async (lead) => {
    setImporting(prev => ({ ...prev, [lead.id]: true }));
    const r = await callAction({ action: "import_lead", conta_id: contaId, lead_id: lead.id }, session);
    setImporting(prev => ({ ...prev, [lead.id]: false }));
    if (r.error) alert("Erro ao importar: " + r.error);
    else load();
  };

  if (!contaId) return <div style={{ textAlign: "center", color: L.t3, padding: 60 }}>Selecione uma conta de anúncio.</div>;
  if (loading) return <Spin />;

  const displayed = leads.filter(l =>
    filterImport === "all" ? true : filterImport === "importado" ? l.importado_crm : !l.importado_crm
  );

  return (
    <div>
      {detail && (
        <Modal title="Detalhes do Lead" onClose={() => setDetail(null)} width={440}>
          {Object.entries(detail.campos ?? {}).map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: L.t3, minWidth: 120 }}>{k}</span>
              <span style={{ fontSize: 13, color: L.t1 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${L.line}` }}>
            <div style={{ fontSize: 11, color: L.t3 }}>Campanha: {detail.campaign_id ?? "—"}</div>
            <div style={{ fontSize: 11, color: L.t3 }}>Anúncio: {detail.ad_id ?? "—"}</div>
            <div style={{ fontSize: 11, color: L.t3 }}>Formulário: {detail.form_id ?? "—"}</div>
            <div style={{ fontSize: 11, color: L.t3 }}>Criado em: {detail.criado_em ? new Date(detail.criado_em).toLocaleString("pt-BR") : "—"}</div>
          </div>
        </Modal>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["all", "Todos"], ["nao", "Não Importados"], ["importado", "Importados"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilterImport(v)}
            style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12,
              border: `1px solid ${filterImport === v ? L.accent : L.line}`,
              background: filterImport === v ? L.accent : "transparent",
              color: filterImport === v ? "white" : L.t2, cursor: "pointer",
            }}>{l}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: L.t3, alignSelf: "center" }}>
          {displayed.length} leads
        </span>
      </div>

      {displayed.length === 0 && (
        <div style={{ textAlign: "center", color: L.t3, padding: 40 }}>Nenhum lead encontrado.</div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {displayed.map(lead => (
          <div key={lead.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            background: L.card, border: `1px solid ${L.line}`,
            borderRadius: 10, padding: "10px 14px",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: L.accent + "20", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 15, flexShrink: 0,
            }}>👤</div>

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: L.t1 }}>{lead.nome ?? "Sem nome"}</div>
              <div style={{ fontSize: 11, color: L.t3 }}>
                {lead.email ?? ""}{lead.email && lead.telefone ? " · " : ""}{lead.telefone ?? ""}
              </div>
              {lead.criado_em && (
                <div style={{ fontSize: 10, color: L.t4, marginTop: 2 }}>
                  {new Date(lead.criado_em).toLocaleDateString("pt-BR")}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {lead.importado_crm
                ? <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>✓ No CRM</span>
                : <button onClick={() => importLead(lead)} disabled={importing[lead.id]}
                    style={{
                      padding: "5px 12px", borderRadius: 7, fontSize: 12,
                      background: L.accent, color: "white", border: "none",
                      cursor: importing[lead.id] ? "not-allowed" : "pointer",
                      opacity: importing[lead.id] ? 0.6 : 1, fontWeight: 600,
                    }}>
                    {importing[lead.id] ? "…" : "Importar CRM"}
                  </button>
              }
              <button onClick={() => setDetail(lead)}
                style={{
                  padding: "5px 10px", borderRadius: 7, fontSize: 12,
                  border: `1px solid ${L.line}`, background: "transparent",
                  cursor: "pointer", color: L.t2,
                }}>
                Ver
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: RELATÓRIOS
// ════════════════════════════════════════════════════════════════════════════
function TabRelatorios({ contaId }) {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCamp, setSelectedCamp] = useState("all");
  const [range, setRange] = useState(30);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!contaId) return;
    supabase.from("meta_campanhas").select("campaign_id,nome")
      .eq("meta_conta_id", contaId)
      .order("synced_at", { ascending: false })
      .then(({ data }) => setCampaigns(data ?? []));
  }, [contaId]);

  const load = useCallback(async () => {
    if (!contaId) return;
    setLoading(true);
    const since = new Date(); since.setDate(since.getDate() - range);
    const sinceStr = since.toISOString().split("T")[0];

    let q = supabase
      .from("meta_insights")
      .select("data,campaign_id,ad_id,impressoes,alcance,cliques,gasto,leads,video_plays,thruplays")
      .eq("meta_conta_id", contaId)
      .gte("data", sinceStr)
      .order("data", { ascending: false });

    if (selectedCamp !== "all") q = q.eq("campaign_id", selectedCamp).eq("ad_id", "");
    else q = q.eq("ad_id", "");

    const { data } = await q.limit(500);
    setRows(data ?? []);
    setLoading(false);
  }, [contaId, selectedCamp, range]);

  useEffect(() => { load(); }, [load]);

  const totals = rows.reduce((acc, r) => ({
    impressoes: acc.impressoes + (r.impressoes || 0),
    alcance:    acc.alcance    + (r.alcance    || 0),
    cliques:    acc.cliques    + (r.cliques    || 0),
    gasto:      acc.gasto      + Number(r.gasto || 0),
    leads:      acc.leads      + (r.leads      || 0),
    video_plays: acc.video_plays + (r.video_plays || 0),
    thruplays:  acc.thruplays  + (r.thruplays  || 0),
  }), { impressoes: 0, alcance: 0, cliques: 0, gasto: 0, leads: 0, video_plays: 0, thruplays: 0 });

  if (!contaId) return <div style={{ textAlign: "center", color: L.t3, padding: 60 }}>Selecione uma conta.</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select style={{ ...selectStyle, maxWidth: 200 }} value={selectedCamp} onChange={e => setSelectedCamp(e.target.value)}>
          <option value="all">Todas as campanhas</option>
          {campaigns.map(c => <option key={c.campaign_id} value={c.campaign_id}>{c.nome ?? c.campaign_id}</option>)}
        </select>
        {[7, 14, 30, 60, 90].map(r => (
          <button key={r} onClick={() => setRange(r)}
            style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12,
              border: `1px solid ${range === r ? L.accent : L.line}`,
              background: range === r ? L.accent : "transparent",
              color: range === r ? "white" : L.t2, cursor: "pointer",
            }}>{r}d</button>
        ))}
      </div>

      {/* Totals */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10, marginBottom: 20 }}>
        <StatCard label="Investimento Total" value={fmtBRL(totals.gasto)} color={L.accent} />
        <StatCard label="Impressões"          value={fmtNum(totals.impressoes)} />
        <StatCard label="Alcance"             value={fmtNum(totals.alcance)} />
        <StatCard label="Cliques"             value={fmtNum(totals.cliques)} />
        <StatCard label="CTR"                 value={fmtPct(totals.cliques, totals.impressoes)} />
        <StatCard label="Leads"               value={fmtNum(totals.leads)} color="#22c55e" />
        <StatCard label="CPL"                 value={totals.leads > 0 ? fmtBRL(totals.gasto / totals.leads) : "—"} />
        <StatCard label="CPC"                 value={totals.cliques > 0 ? fmtBRL(totals.gasto / totals.cliques) : "—"} />
        <StatCard label="Video Plays"         value={fmtNum(totals.video_plays)} />
        <StatCard label="ThruPlays"           value={fmtNum(totals.thruplays)} />
      </div>

      {/* Chart */}
      {rows.length > 0 && (
        <div style={{ background: L.card, border: `1px solid ${L.line}`, borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: L.t3, marginBottom: 10 }}>Gasto diário (R$)</div>
          <MiniBar
            data={[...rows].reverse().map(r => ({ label: r.data, v: Number(r.gasto) }))}
            color={L.accent}
          />
        </div>
      )}

      {loading && <Spin />}

      {/* Table */}
      {!loading && rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${L.line}` }}>
                {["Data", "Campanha", "Impressões", "Alcance", "Cliques", "CTR", "Gasto", "Leads", "CPL"].map(h => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: L.t3, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const camp = campaigns.find(c => c.campaign_id === r.campaign_id);
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${L.line}`, background: i % 2 === 0 ? L.bg : L.card }}>
                    <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{fmtDate(r.data)}</td>
                    <td style={{ padding: "6px 10px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {camp?.nome ?? r.campaign_id}
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmtNum(r.impressoes)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmtNum(r.alcance)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmtNum(r.cliques)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmtPct(r.cliques, r.impressoes)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmtBRL(r.gasto)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmtNum(r.leads)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{r.leads > 0 ? fmtBRL(Number(r.gasto) / r.leads) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: CONFIGURAÇÕES (Contas de anúncio)
// ════════════════════════════════════════════════════════════════════════════
function TabConfiguracoes({ contas, onReload, session }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ label: "", ad_account_id: "", access_token: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [syncing, setSyncing] = useState(false);

  const save = async () => {
    if (!form.label.trim() || !form.ad_account_id.trim() || !form.access_token.trim()) {
      setErr("Todos os campos são obrigatórios."); return;
    }
    setSaving(true); setErr("");
    const id = form.ad_account_id.replace("act_", "");
    const { error } = await supabase.from("meta_contas").insert({
      label:         form.label.trim(),
      ad_account_id: `act_${id}`,
      access_token:  form.access_token.trim(),
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setModal(false);
    setForm({ label: "", ad_account_id: "", access_token: "" });
    onReload();
  };

  const deleteAccount = async (conta) => {
    if (!confirm(`Remover conta "${conta.label}"? Todos os dados sincronizados serão apagados.`)) return;
    await supabase.from("meta_contas").delete().eq("id", conta.id);
    onReload();
  };

  const syncNow = async (contaId) => {
    setSyncing(true);
    await callAction({ action: "sync", conta_id: contaId }, session);
    setSyncing(false);
    onReload();
  };

  const updateToken = async (conta) => {
    const newToken = prompt("Novo access token:", conta.access_token);
    if (!newToken || newToken === conta.access_token) return;
    await supabase.from("meta_contas").update({ access_token: newToken, status: "ativa", sync_error: null }).eq("id", conta.id);
    onReload();
  };

  return (
    <div>
      {modal && (
        <Modal title="Conectar Conta de Anúncio" onClose={() => setModal(false)}>
          <div style={{
            background: "#fef9c3", border: "1px solid #fde68a",
            borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#92400e",
          }}>
            <strong>Como obter o Access Token:</strong><br />
            1. Acesse <strong>developers.facebook.com</strong> → seu App → Tools → Graph API Explorer<br />
            2. Selecione seu App e gere um token com permissões: <code>ads_management</code>, <code>ads_read</code>, <code>leads_retrieval</code><br />
            3. Converta para token de longa duração via OAuth ou use um token de sistema.
          </div>
          <Field label="Rótulo (nome interno)">
            <input style={inputStyle} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: C4HUB - Conta Principal" />
          </Field>
          <Field label="Ad Account ID">
            <input style={inputStyle} value={form.ad_account_id} onChange={e => setForm(f => ({ ...f, ad_account_id: e.target.value }))} placeholder="Ex: act_123456789 ou 123456789" />
          </Field>
          <Field label="Access Token">
            <textarea style={{ ...inputStyle, height: 80, resize: "vertical" }}
              value={form.access_token}
              onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))}
              placeholder="EAAxxxxxxx..." />
          </Field>
          {err && <p style={{ color: L.red, fontSize: 12, marginBottom: 10 }}>{err}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setModal(false)} style={{ background: "none", border: `1px solid ${L.line}`, borderRadius: 8, padding: "9px 16px", cursor: "pointer", color: L.t2, fontSize: 13 }}>Cancelar</button>
            <BtnPrimary onClick={save} loading={saving}>Conectar Conta</BtnPrimary>
          </div>
        </Modal>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button onClick={() => setModal(true)}
          style={{ background: L.accent, color: "white", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          + Conectar Conta
        </button>
      </div>

      {contas.length === 0 && (
        <div style={{ textAlign: "center", color: L.t3, padding: 60 }}>
          Nenhuma conta conectada. Clique em "Conectar Conta" para começar.
        </div>
      )}

      {contas.map(conta => (
        <div key={conta.id} style={{
          background: L.card, border: `1px solid ${conta.status === "erro" ? L.red : L.line}`,
          borderRadius: 10, padding: "14px 16px", marginBottom: 10,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: L.t1 }}>{conta.label}</div>
              <div style={{ fontSize: 12, color: L.t3, marginTop: 2 }}>
                {conta.account_name ? `${conta.account_name} · ` : ""}
                {conta.ad_account_id}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, color: L.t3 }}>
                <span style={{ color: statusColor(conta.status), fontWeight: 600 }}>● {statusLabel(conta.status)}</span>
                {conta.last_synced_at && <span>Última sync: {new Date(conta.last_synced_at).toLocaleString("pt-BR")}</span>}
                {conta.currency && <span>Moeda: {conta.currency}</span>}
              </div>
              {conta.sync_error && (
                <div style={{ marginTop: 6, fontSize: 11, color: L.red, background: "#fef2f2", borderRadius: 6, padding: "4px 8px" }}>
                  ⚠ {conta.sync_error}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => syncNow(conta.id)} disabled={syncing}
                style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, border: `1px solid ${L.line}`, background: "transparent", cursor: "pointer", color: L.t2 }}>
                {syncing ? "…" : "🔄 Sync"}
              </button>
              <button onClick={() => updateToken(conta)}
                style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, border: `1px solid ${L.line}`, background: "transparent", cursor: "pointer", color: L.t2 }}>
                🔑 Token
              </button>
              <button onClick={() => deleteAccount(conta)}
                style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, border: `1px solid ${L.line}`, background: "transparent", cursor: "pointer", color: L.red }}>
                🗑 Remover
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Webhook instructions */}
      <div style={{
        marginTop: 20, background: L.card, border: `1px solid ${L.line}`,
        borderRadius: 10, padding: "14px 16px",
      }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: L.t1, marginBottom: 10 }}>
          🔔 Configuração de Webhook (Leads em Tempo Real)
        </div>
        <div style={{ fontSize: 12, color: L.t3, lineHeight: 1.7 }}>
          <p style={{ margin: "0 0 8px" }}>Para receber leads instantaneamente:</p>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>Acesse <strong>developers.facebook.com</strong> → seu App → Webhooks</li>
            <li>Adicione assinatura de webhook: <code style={{ background: L.bg, padding: "1px 4px", borderRadius: 4 }}>leadgen</code></li>
            <li>URL do webhook:</li>
          </ol>
          <div style={{
            background: L.bg, border: `1px solid ${L.line}`, borderRadius: 7,
            padding: "8px 12px", marginTop: 6, fontFamily: "monospace", fontSize: 11,
            wordBreak: "break-all", color: L.t1,
          }}>
            {SUPABASE_URL}/functions/v1/meta-webhook
          </div>
          <p style={{ margin: "8px 0 0" }}>
            Token de verificação: <code style={{ background: L.bg, padding: "1px 4px", borderRadius: 4 }}>c4os-meta-webhook-2025</code>
          </p>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE ROOT
// ════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: "dashboard",    label: "Dashboard" },
  { id: "campanhas",    label: "Campanhas" },
  { id: "anuncios",     label: "Anúncios" },
  { id: "leads",        label: "Leads" },
  { id: "relatorios",   label: "Relatórios" },
  { id: "config",       label: "Configurações" },
];

export default function PageTrafico({ user }) {
  const [tab, setTab]       = useState("dashboard");
  const [contas, setContas]  = useState([]);
  const [contaId, setContaId] = useState("");
  const [session, setSession] = useState(null);
  const [loadingContas, setLoadingContas] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  }, []);

  const loadContas = useCallback(async () => {
    setLoadingContas(true);
    const { data } = await supabase
      .from("meta_contas")
      .select("*")
      .order("created_at", { ascending: true });
    const list = data ?? [];
    setContas(list);
    if (list.length > 0 && !contaId) setContaId(list[0].id);
    setLoadingContas(false);
  }, [contaId]);

  useEffect(() => { loadContas(); }, [loadContas]);

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: L.t1 }}>Tráfego Pago</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: L.t3 }}>Gestão completa de Meta Ads</p>
        </div>
        {contas.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: L.t3 }}>Conta:</span>
            <select style={{ ...selectStyle, width: "auto", minWidth: 180 }}
              value={contaId} onChange={e => setContaId(e.target.value)}>
              {contas.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 0, borderBottom: `2px solid ${L.line}`,
        marginBottom: 20, overflowX: "auto",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: "9px 18px", background: "none", border: "none",
              borderBottom: tab === t.id ? `2px solid ${L.accent}` : "2px solid transparent",
              color: tab === t.id ? L.accent : L.t3,
              fontWeight: tab === t.id ? 700 : 400,
              fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
              marginBottom: -2, transition: "color .15s",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loadingContas ? <Spin /> : (
        <>
          {tab === "dashboard"  && <TabDashboard  contaId={contaId} session={session} />}
          {tab === "campanhas"  && <TabCampanhas  contaId={contaId} session={session} />}
          {tab === "anuncios"   && <TabAnuncios   contaId={contaId} session={session} />}
          {tab === "leads"      && <TabLeads      contaId={contaId} session={session} />}
          {tab === "relatorios" && <TabRelatorios contaId={contaId} />}
          {tab === "config"     && <TabConfiguracoes contas={contas} onReload={loadContas} session={session} />}
        </>
      )}
    </div>
  );
}
