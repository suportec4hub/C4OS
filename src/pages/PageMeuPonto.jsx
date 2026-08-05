// Ponto do colaborador — a tela dele, não a do RH.
//
// Existe separada de RH / Pessoas de propósito. Para bater o próprio ponto, o
// colaborador não deveria precisar entrar num módulo de RH, onde enxerga a
// empresa inteira: aqui ele vê só o que é dele, e não há nada para configurar
// ou ajustar. O ajuste, o atestado e o lançamento pela chefia continuam em
// RH / Pessoas → Ponto.
import { useEffect, useMemo, useState } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Fade, Row, Card, Tag, DataTable, TD, IBtn } from "../components/ui";
import { hojeISO, fmtData } from "../components/FichaColaborador";
import { Comprovante } from "../components/PontoEletronico";

const SEQUENCIA = [
  { campo: "entrada",      rotulo: "Entrada" },
  { campo: "saida_almoco", rotulo: "Saída para almoço" },
  { campo: "volta_almoco", rotulo: "Volta do almoço" },
  { campo: "saida",        rotulo: "Saída" },
];

const horaAgora = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const soHora = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--";

const minutos = (t) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };

const horasTrabalhadas = (r) => {
  const e = minutos(r.entrada), s = minutos(r.saida);
  if (e == null || s == null) return null;
  let total = s - e;
  const sa = minutos(r.saida_almoco), va = minutos(r.volta_almoco);
  if (sa != null && va != null && va > sa) total -= (va - sa);
  return total / 60;
};

const hhmm = (h) => {
  if (h == null) return "—";
  const sinal = h < 0 ? "-" : "";
  const a = Math.abs(h);
  return `${sinal}${String(Math.floor(a)).padStart(2, "0")}:${String(Math.round((a % 1) * 60)).padStart(2, "0")}`;
};

function pegarLocalizacao() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        latitude: Number(p.coords.latitude.toFixed(7)),
        longitude: Number(p.coords.longitude.toFixed(7)),
        precisao_m: Math.round(p.coords.accuracy),
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

export default function PageMeuPonto({ user }) {
  const empresaId = user?.empresa_id;
  const [config, setConfig]   = useState(null);
  const [ficha, setFicha]     = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const [regHoje, setRegHoje] = useState(null);   // modo corrigível
  const [marcs, setMarcs]     = useState([]);
  const [registros, setRegistros] = useState([]); // modo definitivo
  const [mesRegs, setMesRegs] = useState([]);

  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState(null);
  const [comprovante, setComprovante] = useState(null);

  const hoje = hojeISO();
  const mes = hoje.slice(0, 7);
  const eletronico = config?.modo_ponto === "eletronico";
  const isento = ficha?.registra_ponto === false;

  const carregar = async () => {
    if (!empresaId || !user?.id) return;
    const [ano, m] = mes.split("-").map(Number);
    const fim = new Date(Date.UTC(ano, m, 0)).toISOString().slice(0, 10);

    const [cfg, fic, emp, ponto, marc, regs, mesR] = await Promise.all([
      supabase.from("rh_config").select("*").eq("empresa_id", empresaId).maybeSingle(),
      supabase.from("rh_colaboradores").select("*").eq("usuario_id", user.id).maybeSingle(),
      supabase.from("empresas").select("nome, cnpj").eq("id", empresaId).maybeSingle(),
      supabase.from("rh_ponto").select("*").eq("usuario_id", user.id).eq("data", hoje).maybeSingle(),
      supabase.from("rh_ponto_marcacoes").select("*").eq("usuario_id", user.id).eq("data", hoje).order("hora"),
      supabase.from("rh_ponto_registros").select("*").eq("usuario_id", user.id)
        .order("nsr", { ascending: false }).limit(200),
      supabase.from("rh_ponto").select("*").eq("usuario_id", user.id)
        .gte("data", `${mes}-01`).lte("data", fim).order("data", { ascending: false }),
    ]);

    setConfig(cfg.data || { modo_ponto: "gestao" });
    setFicha(fic.data || null);
    setEmpresa(emp.data || null);
    setRegHoje(ponto.data || null);
    setMarcs(marc.data || []);
    setRegistros(regs.data || []);
    setMesRegs(mesR.data || []);
    setCarregando(false);
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [empresaId, user?.id]);

  const registrosHoje = useMemo(
    () => registros.filter((r) => new Date(r.data_hora_marcacao).toDateString() === new Date().toDateString())
      .sort((a, b) => a.nsr - b.nsr),
    [registros],
  );

  const proxima = eletronico
    ? SEQUENCIA[registrosHoje.length] || null
    : SEQUENCIA.find((s) => !regHoje?.[s.campo]) || null;

  const bater = async () => {
    if (!proxima) return;
    setOcupado(true); setMsg(null);
    const loc = await pegarLocalizacao();

    if (eletronico) {
      const { data, error } = await supabase.rpc("registrar_ponto_eletronico", {
        p_latitude: loc?.latitude ?? null, p_longitude: loc?.longitude ?? null,
        p_precisao: loc?.precisao_m ?? null, p_offline: false,
        p_data_hora: null, p_usuario_id: null, p_justificativa: null,
      });
      setOcupado(false);
      if (error) { setMsg({ erro: true, txt: error.message }); return; }
      await carregar();
      setComprovante(Array.isArray(data) ? data[0] : data);
      return;
    }

    const hora = horaAgora();
    const { error } = await supabase.from("rh_ponto").upsert(
      { empresa_id: empresaId, usuario_id: user.id, data: hoje,
        [proxima.campo]: hora, horas_previstas: regHoje?.horas_previstas ?? 8 },
      { onConflict: "usuario_id,data" });
    if (!error) {
      await supabase.from("rh_ponto_marcacoes").insert({
        empresa_id: empresaId, usuario_id: user.id, data: hoje,
        tipo: proxima.campo, hora, ...(loc || {}),
      });
    }
    setOcupado(false);
    if (error) { setMsg({ erro: true, txt: error.message }); return; }
    setMsg({ txt: loc
      ? `${proxima.rotulo} registrada às ${hora.slice(0, 5)} — localização capturada (±${loc.precisao_m} m).`
      : `${proxima.rotulo} registrada às ${hora.slice(0, 5)} — sem localização.` });
    await carregar();
  };

  const saldoMes = mesRegs.reduce((s, r) => {
    const t = horasTrabalhadas(r);
    return t == null ? s : s + (t - Number(r.horas_previstas ?? 8));
  }, 0);

  if (carregando) {
    return <Fade><div style={{ textAlign: "center", padding: 60, color: L.t4 }}>Carregando...</div></Fade>;
  }

  if (isento) {
    return (
      <Fade>
        <Card title="Meu ponto" sub="registro de jornada">
          <div style={{ padding: "20px 4px", fontSize: 13, color: L.t2, lineHeight: 1.7 }}>
            Você está <b>isento de marcação de ponto</b>
            {ficha?.motivo_isencao ? ` — ${ficha.motivo_isencao}` : ""}.
            <div style={{ fontSize: 11.5, color: L.t4, marginTop: 8 }}>
              Isso é definido na sua ficha, em RH / Pessoas. Se estiver errado, fale com o RH.
            </div>
          </div>
        </Card>
      </Fade>
    );
  }

  return (
    <Fade>
      {/* O botão é a tela: quem entra aqui veio bater ponto. */}
      <div style={{ background: L.white, border: `1px solid ${L.line}`, borderRadius: 14,
        padding: "22px 24px", marginBottom: 16 }}>
        <Row between>
          <div>
            <div style={{ fontSize: 11, color: L.t4, textTransform: "uppercase",
              letterSpacing: "1.4px", fontFamily: "'JetBrains Mono',monospace" }}>
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: L.t1, fontFamily: "'Outfit',sans-serif" }}>
              {proxima ? proxima.rotulo : "Jornada completa"}
            </div>
            <div style={{ fontSize: 11.5, color: L.t4, marginTop: 2 }}>
              {eletronico
                ? "Registro definitivo — não pode ser alterado depois"
                : "O RH pode ajustar este registro depois"}
            </div>
          </div>
          {proxima ? (
            <button onClick={ocupado ? undefined : bater} disabled={ocupado} style={{
              padding: "16px 30px", borderRadius: 12, border: "none", cursor: ocupado ? "default" : "pointer",
              background: ocupado ? L.surface : L.accent, color: ocupado ? L.t4 : "#fff",
              fontSize: 15, fontWeight: 700, fontFamily: "'Outfit',sans-serif",
            }}>{ocupado ? "Registrando..." : "Bater ponto"}</button>
          ) : (
            <Tag color={L.green} bg={L.greenBg}>tudo registrado hoje</Tag>
          )}
        </Row>

        <Row gap={10} mt={18}>
          {SEQUENCIA.map((s, i) => {
            const hora = eletronico
              ? (registrosHoje[i] ? soHora(registrosHoje[i].data_hora_marcacao) : null)
              : (regHoje?.[s.campo] ? regHoje[s.campo].slice(0, 5) : null);
            const reg = eletronico ? registrosHoje[i] : null;
            const marc = !eletronico ? marcs.find((m) => m.tipo === s.campo) : null;
            const lat = reg?.latitude ?? marc?.latitude;
            return (
              <div key={s.campo} style={{ flex: 1, padding: "10px 12px", borderRadius: 10,
                border: `1px solid ${hora ? L.green : L.line}`,
                background: hora ? L.greenBg : "transparent" }}>
                <div style={{ fontSize: 9.5, color: L.t4, textTransform: "uppercase",
                  letterSpacing: ".6px" }}>{s.rotulo}</div>
                <Row gap={6}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: hora ? L.green : L.t4,
                    fontFamily: "'JetBrains Mono',monospace" }}>{hora || "--:--"}</span>
                  {lat != null && (
                    <a href={`https://www.google.com/maps?q=${lat},${reg?.longitude ?? marc?.longitude}`}
                      target="_blank" rel="noopener noreferrer" title="Ver local"
                      style={{ fontSize: 12, textDecoration: "none" }}>📍</a>
                  )}
                  {reg && <IBtn c={L.teal} onClick={() => setComprovante(reg)} title="Comprovante">🧾</IBtn>}
                </Row>
              </div>
            );
          })}
        </Row>

        {msg && (
          <div style={{ marginTop: 14, padding: "9px 12px", borderRadius: 8, fontSize: 12,
            background: msg.erro ? L.redBg : L.tealBg, color: msg.erro ? L.red : L.teal }}>
            {msg.txt}
          </div>
        )}
      </div>

      <Row between mb={12}>
        <span style={{ fontSize: 10, letterSpacing: "1.4px", textTransform: "uppercase",
          color: L.t4, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>
          Meu mês
        </span>
        {!eletronico && (
          <Tag color={saldoMes >= 0 ? L.green : L.red} bg={saldoMes >= 0 ? L.greenBg : L.redBg}>
            banco de horas {saldoMes >= 0 ? "+" : ""}{hhmm(saldoMes)}
          </Tag>
        )}
      </Row>

      {eletronico ? (
        <DataTable heads={["NSR", "Marcação", "Origem", "Local", "Comprovante"]}>
          {registros.map((r) => (
            <tr key={r.id} style={{ borderBottom: `1px solid ${L.lineSoft}` }}>
              <td style={{ ...TD, fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5 }}>{r.nsr}</td>
              <td style={{ ...TD, fontSize: 12 }}>
                {new Date(r.data_hora_marcacao).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </td>
              <td style={TD}>
                <Tag color={r.origem_registro === "manual" ? L.yellow : L.green}
                  bg={r.origem_registro === "manual" ? L.yellowBg : L.greenBg}>
                  {r.origem_registro === "manual" ? "manual" : "automático"}
                </Tag>
              </td>
              <td style={TD}>
                {r.latitude != null
                  ? <a href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: L.teal, textDecoration: "none" }}>📍 mapa</a>
                  : <span style={{ fontSize: 11, color: L.t4 }}>—</span>}
              </td>
              <td style={TD}><IBtn c={L.teal} onClick={() => setComprovante(r)}>🧾</IBtn></td>
            </tr>
          ))}
          {registros.length === 0 && (
            <tr><td colSpan={5} style={{ ...TD, textAlign: "center", color: L.t4, padding: 40 }}>
              Nenhum registro ainda.</td></tr>
          )}
        </DataTable>
      ) : (
        <DataTable heads={["Data", "Entrada", "Almoço", "Saída", "Trabalhado", "Saldo"]}>
          {mesRegs.map((r) => {
            const t = horasTrabalhadas(r);
            const dif = t == null ? null : t - Number(r.horas_previstas ?? 8);
            return (
              <tr key={r.id} style={{ borderBottom: `1px solid ${L.lineSoft}` }}>
                <td style={{ ...TD, fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace" }}>{fmtData(r.data)}</td>
                <td style={{ ...TD, fontSize: 11.5 }}>{r.entrada?.slice(0, 5) || "—"}</td>
                <td style={{ ...TD, fontSize: 11.5, color: L.t3 }}>
                  {r.saida_almoco ? `${r.saida_almoco.slice(0, 5)}–${r.volta_almoco?.slice(0, 5) || "?"}` : "—"}
                </td>
                <td style={{ ...TD, fontSize: 11.5 }}>{r.saida?.slice(0, 5) || "—"}</td>
                <td style={{ ...TD, fontSize: 11.5, fontWeight: 600, color: L.t1 }}>{hhmm(t)}</td>
                <td style={TD}>
                  {dif == null ? <span style={{ fontSize: 11, color: L.t4 }}>incompleto</span> : (
                    <Tag color={dif >= 0 ? L.green : L.red} bg={dif >= 0 ? L.greenBg : L.redBg}>
                      {dif >= 0 ? "+" : ""}{hhmm(dif)}
                    </Tag>
                  )}
                </td>
              </tr>
            );
          })}
          {mesRegs.length === 0 && (
            <tr><td colSpan={6} style={{ ...TD, textAlign: "center", color: L.t4, padding: 40 }}>
              Nenhum ponto neste mês.</td></tr>
          )}
        </DataTable>
      )}

      <div style={{ marginTop: 14, fontSize: 11, color: L.t4 }}>
        Precisa corrigir um horário ou registrar atestado? Fale com o RH — o ajuste é feito por lá.
      </div>

      {comprovante && (
        <Comprovante registro={comprovante} empresa={empresa}
          colaborador={{ nome: user?.nome }} onClose={() => setComprovante(null)} />
      )}
    </Fade>
  );
}
