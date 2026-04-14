import { useState, useEffect } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Row } from "../components/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";

const btn = (bg = L.surface, color = L.t2, extra = {}) => ({
  background: bg, color, border: `1px solid ${L.line}`, borderRadius: 8,
  padding: "7px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  fontWeight: 500, transition: "all .12s", ...extra,
});

const CORES_CHART = [L.t1, L.blue, L.green, L.yellow, L.red, "#7c3aed", "#0891b2"];

function StatCard({ label, value, sub, color = L.t1, icon }) {
  return (
    <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: "16px 18px",
      boxShadow: "0 1px 3px rgba(0,0,0,.04)", flex: 1, minWidth: 120 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {icon && <div style={{ fontSize: 20, flexShrink: 0 }}>{icon}</div>}
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          <div style={{ fontSize: 12, color: L.t2, fontWeight: 500, marginTop: 2 }}>{label}</div>
          {sub && <div style={{ fontSize: 10, color: L.t4, marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export default function PageRelatoriosAtend({ user }) {
  const [periodo, setPeriodo] = useState("7d");
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [atendentes, setAtendentes] = useState([]);

  useEffect(() => { load(); }, [user?.empresa_id, periodo]);

  const load = async () => {
    if (!user?.empresa_id) return;
    setLoading(true);

    const dias = periodo === "7d" ? 7 : periodo === "30d" ? 30 : 90;
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    const desdeStr = desde.toISOString();

    // Conversas no período
    const { data: convs } = await supabase.from("conversas")
      .select("id, status, atendente_id, created_at, ultima_hora, setor_id")
      .eq("empresa_id", user.empresa_id)
      .gte("created_at", desdeStr);

    // Mensagens no período
    const { data: msgs } = await supabase.from("mensagens")
      .select("id, de, created_at, hora, conversa_id")
      .eq("empresa_id", user.empresa_id)
      .gte("hora", desdeStr)
      .limit(5000);

    // Atendentes
    const { data: ats } = await supabase.from("usuarios")
      .select("id, nome").eq("empresa_id", user.empresa_id).eq("ativo", true);
    setAtendentes(ats || []);

    // Setores
    const { data: setores } = await supabase.from("setores")
      .select("id, nome").eq("empresa_id", user.empresa_id);

    const lista = convs || [];
    const listaMsgs = msgs || [];

    // --- Status breakdown ---
    const statusCount = {};
    lista.forEach(c => { statusCount[c.status] = (statusCount[c.status] || 0) + 1; });

    // --- Por atendente ---
    const porAtendente = {};
    lista.forEach(c => {
      const key = c.atendente_id || "__sem_atendente";
      if (!porAtendente[key]) porAtendente[key] = { total: 0, resolvidas: 0 };
      porAtendente[key].total++;
      if (c.status === "resolvida") porAtendente[key].resolvidas++;
    });

    // --- Por setor ---
    const porSetor = {};
    lista.forEach(c => {
      const key = c.setor_id || "__sem_setor";
      porSetor[key] = (porSetor[key] || 0) + 1;
    });

    // --- Por dia (últimos N dias) ---
    const porDia = {};
    lista.forEach(c => {
      const d = c.created_at?.split("T")[0];
      if (d) porDia[d] = (porDia[d] || 0) + 1;
    });
    const porDiaArr = [];
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      porDiaArr.push({ data: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), conversas: porDia[key] || 0 });
    }

    // --- Msgs received vs sent ---
    const msgsRecebidas = listaMsgs.filter(m => m.de !== "me").length;
    const msgsEnviadas  = listaMsgs.filter(m => m.de === "me").length;

    // --- Status pie ---
    const statusPie = Object.entries(statusCount).map(([k, v]) => ({
      name: { aberta: "Abertas", em_atendimento: "Atendendo", aguardando: "Aguardando", resolvida: "Resolvidas" }[k] || k,
      value: v,
    }));

    // --- Top atendentes ---
    const topAtendentes = Object.entries(porAtendente)
      .filter(([k]) => k !== "__sem_atendente")
      .map(([k, v]) => ({
        nome: (ats || []).find(a => a.id === k)?.nome?.split(" ")[0] || "?",
        total: v.total, resolvidas: v.resolvidas,
        taxa: v.total > 0 ? Math.round((v.resolvidas / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total).slice(0, 8);

    // --- Setores ---
    const topSetores = Object.entries(porSetor)
      .filter(([k]) => k !== "__sem_setor")
      .map(([k, v]) => ({
        nome: (setores || []).find(s => s.id === k)?.nome || "?",
        total: v,
      }))
      .sort((a, b) => b.total - a.total);

    setStats({
      totalConversas: lista.length,
      resolvidas: statusCount.resolvida || 0,
      abertas: statusCount.aberta || 0,
      aguardando: (statusCount.aguardando || 0) + (statusCount.em_atendimento || 0),
      totalMsgs: listaMsgs.length,
      msgsRecebidas, msgsEnviadas,
      taxaResolucao: lista.length > 0 ? Math.round(((statusCount.resolvida || 0) / lista.length) * 100) : 0,
      porDia: porDiaArr,
      statusPie, topAtendentes, topSetores,
    });
    setLoading(false);
  };

  return (
    <div>
      {/* Header */}
      <Row between mb={20}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: L.t1 }}>Relatórios de Atendimento</div>
          <div style={{ fontSize: 12, color: L.t3, marginTop: 2 }}>Métricas e performance do seu time</div>
        </div>
        <Row gap={6}>
          {[
            { id: "7d",  label: "7 dias"  },
            { id: "30d", label: "30 dias" },
            { id: "90d", label: "90 dias" },
          ].map(p => (
            <button key={p.id} onClick={() => setPeriodo(p.id)}
              style={btn(periodo === p.id ? L.t1 : L.surface, periodo === p.id ? "white" : L.t2, { padding: "5px 12px" })}>
              {p.label}
            </button>
          ))}
        </Row>
      </Row>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: L.t4 }}>
          <div style={{ animation: "spin 1s linear infinite", fontSize: 24, display: "inline-block", marginBottom: 8 }}>⟳</div>
          <div>Calculando métricas...</div>
        </div>
      ) : stats ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPIs */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatCard icon="💬" label="Conversas" value={stats.totalConversas} sub={`Últimos ${periodo === "7d" ? 7 : periodo === "30d" ? 30 : 90} dias`} />
            <StatCard icon="✓" label="Resolvidas" value={stats.resolvidas} color={L.green} sub={`${stats.taxaResolucao}% de resolução`} />
            <StatCard icon="⏳" label="Abertas/Em andamento" value={stats.abertas + stats.aguardando} color={L.yellow} />
            <StatCard icon="📨" label="Mensagens trocadas" value={stats.totalMsgs} sub={`↑${stats.msgsEnviadas} enviadas · ↓${stats.msgsRecebidas} recebidas`} />
            <StatCard icon="⭐" label="Taxa de resolução" value={`${stats.taxaResolucao}%`} color={stats.taxaResolucao >= 70 ? L.green : stats.taxaResolucao >= 40 ? L.yellow : L.red} />
          </div>

          {/* Charts row 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }} className="rg-auto">
            {/* Volume por dia */}
            <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: L.t1, marginBottom: 14 }}>Volume de conversas por dia</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.porDia} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: L.t3 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: L.t3 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${L.line}` }} />
                  <Bar dataKey="conversas" fill={L.t1} radius={[4, 4, 0, 0]} name="Conversas" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Status pie */}
            <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: L.t1, marginBottom: 14 }}>Status das conversas</div>
              {stats.statusPie.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={stats.statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 9 }}>
                      {stats.statusPie.map((_, i) => <Cell key={i} fill={CORES_CHART[i % CORES_CHART.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${L.line}` }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 0", color: L.t4, fontSize: 11 }}>Sem dados</div>
              )}
            </div>
          </div>

          {/* Charts row 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="rg-auto">
            {/* Top atendentes */}
            <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: L.t1, marginBottom: 14 }}>Top atendentes</div>
              {stats.topAtendentes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: L.t4, fontSize: 11 }}>Sem atribuições</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {stats.topAtendentes.map((a, i) => (
                    <div key={i}>
                      <Row between mb={3}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: L.t1 }}>{a.nome}</span>
                        <span style={{ fontSize: 10, color: L.t3 }}>{a.total} conv · {a.taxa}% resolvido</span>
                      </Row>
                      <div style={{ height: 5, background: L.lineSoft, borderRadius: 3 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, (a.total / (stats.topAtendentes[0]?.total || 1)) * 100)}%`,
                          background: L.t1, borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Setores */}
            <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: L.t1, marginBottom: 14 }}>Conversas por setor</div>
              {stats.topSetores.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: L.t4, fontSize: 11 }}>
                  Sem setores configurados
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stats.topSetores} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: L.t3 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: L.t3 }} tickLine={false} axisLine={false} width={70} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${L.line}` }} />
                    <Bar dataKey="total" fill={L.blue} radius={[0, 4, 4, 0]} name="Conversas" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
