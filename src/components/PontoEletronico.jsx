// Ponto no modo eletrônico (Portaria 671 / REP-P).
//
// Diferença essencial para o modo gestão: aqui o registro é imutável. Uma vez
// gravado, não muda — e é isso que lhe dá valor probatório. Registro que o RH
// pode editar não prova nada sobre a jornada, então correção entra como
// registro novo e o original permanece.
//
// NSR e hash são calculados no banco, por função SECURITY DEFINER. Se fossem
// montados aqui no navegador, qualquer pessoa poderia forjar a cadeia — e a
// cadeia é justamente o que denuncia adulteração.
//
// LIMITE CONHECIDO, e que não deve ser esquecido: falta a assinatura digital
// qualificada ICP-Brasil (PAdES no comprovante, CAdES/.p7s no AFD) e a
// validação do leiaute do AFD contra o arquivo oficial do MTE. Sem isso o
// módulo entrega imutabilidade, NSR, cadeia de integridade e comprovante ao
// trabalhador, mas não está homologado. Ver docs/ponto-eletronico.md.
import { useEffect, useState } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Row, Tag, PBtn, IBtn, DataTable, TD } from "./ui";
import Modal, { Field, Input, Select, ModalFooter } from "./Modal";

const TIPOS = [
  { campo: "entrada",      rotulo: "Entrada" },
  { campo: "saida_almoco", rotulo: "Saída para almoço" },
  { campo: "volta_almoco", rotulo: "Volta do almoço" },
  { campo: "saida",        rotulo: "Saída" },
];

const dtBR = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" }) : "—";
const soHora = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

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

/* ─────────────────────────── Configuração do modo ─────────────────────────── */

export function ConfigPonto({ empresaId, config, empresa, onSalvou, onClose }) {
  const [form, setForm] = useState(config || { modo_ponto: "gestao" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const C = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const salvar = async () => {
    setSalvando(true); setErro("");
    const { error } = await supabase.from("rh_config")
      .upsert({ ...form, empresa_id: empresaId, atualizado_em: new Date().toISOString() },
              { onConflict: "empresa_id" });
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    onSalvou?.(); onClose();
  };

  const eletronico = form.modo_ponto === "eletronico";

  return (
    <Modal title="Configuração do ponto" onClose={onClose} width={540}>
      {/* Os nomes anteriores ("Gestão" e "Eletrônico") davam a entender que a
          batida automática só existia num dos modos, e que dependia de
          certificado. Ela existe nos dois e não depende de nada: a diferença
          entre os modos é só se o registro pode ser corrigido depois. */}
      <div style={{ padding: "9px 12px", borderRadius: 8, background: L.tealBg,
        color: L.teal, fontSize: 11.5, lineHeight: 1.6, marginBottom: 12 }}>
        Nos <b>dois modos</b> o colaborador bate o próprio ponto pelo celular ou pelo
        computador, com data, hora e localização puxadas do aparelho. A escolha abaixo
        muda apenas <b>o que acontece depois</b> da batida.
      </div>

      <Field label="Modo de registro">
        <Select value={form.modo_ponto} onChange={C("modo_ponto")}>
          <option value="gestao">Corrigível — o RH pode ajustar os horários depois</option>
          <option value="eletronico">Definitivo — registro não pode ser alterado (Portaria 671)</option>
        </Select>
      </Field>

      <div style={{ padding: "10px 12px", borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
        background: eletronico ? L.tealBg : L.surface, color: eletronico ? L.teal : L.t3, marginBottom: 12 }}>
        {eletronico ? (
          <>Depois de batido, o registro não pode ser editado nem excluído — nem pelo RH.
          Cada marcação gera comprovante para o trabalhador e recebe NSR sequencial encadeado
          por hash. Esquecimento se corrige com um lançamento novo, justificado, e o
          original permanece.</>
        ) : (
          <>O RH pode ajustar e apagar horários depois da batida. Mais prático no dia a dia,
          mas o registro não serve como prova de jornada, justamente por ser editável.</>
        )}
      </div>

      {eletronico && (
        <>
          {/* Só leitura: o dado é o do cadastro da empresa. Reproduzir aqui um
              campo editável criaria uma segunda fonte para o mesmo dado, e a
              divergência apareceria no comprovante. */}
          <div style={{ fontSize: 10, letterSpacing: "1.2px", textTransform: "uppercase",
            color: L.t4, fontWeight: 600, margin: "6px 0 8px" }}>
            Identificação do empregador — vem do cadastro da empresa
          </div>
          <div style={{ background: L.surface, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
            <Row between mb={4}>
              <span style={{ fontSize: 11, color: L.t4 }}>Razão social</span>
              <span style={{ fontSize: 12, color: empresa?.nome ? L.t1 : L.yellow }}>
                {empresa?.nome || "não preenchida"}
              </span>
            </Row>
            <Row between>
              <span style={{ fontSize: 11, color: L.t4 }}>CNPJ</span>
              <span style={{ fontSize: 12, color: empresa?.cnpj ? L.t1 : L.yellow,
                fontFamily: "'JetBrains Mono',monospace" }}>
                {empresa?.cnpj || "não preenchido"}
              </span>
            </Row>
            {!empresa?.cnpj && (
              <div style={{ fontSize: 10.5, color: L.yellow, marginTop: 8 }}>
                Preencha o CNPJ em Minha Empresa — ele aparece no comprovante do trabalhador.
              </div>
            )}
          </div>

          <div style={{ padding: "10px 12px", borderRadius: 8, background: L.yellowBg,
            color: L.yellow, fontSize: 11.5, lineHeight: 1.6 }}>
            <b>Funciona normalmente sem certificado digital</b> — a batida, o comprovante e a
            imutabilidade não dependem dele. O certificado ICP-Brasil (e a conferência do
            leiaute do AFD) só é necessário para o arquivo ser aceito por um auditor fiscal
            do trabalho. Até lá, use como registro interno.
          </div>
        </>
      )}

      {erro && <div style={{ padding: "8px 12px", background: L.redBg, borderRadius: 8,
        fontSize: 12, color: L.red, marginTop: 8 }}>{erro}</div>}
      <ModalFooter onClose={onClose} onSave={salvar} loading={salvando} />
    </Modal>
  );
}

/* ─────────────────────────── Comprovante (CRPT) ─────────────────────────── */

export function Comprovante({ registro, empresa, colaborador, onClose }) {
  const linhas = [
    ["Empregador", empresa?.nome || "—"],
    ["CNPJ", empresa?.cnpj || "—"],
    ["Trabalhador", colaborador?.nome || "—"],
    ["CPF", registro.cpf],
    ["Data e hora da marcação", dtBR(registro.data_hora_marcacao)],
    ["Data e hora da gravação", dtBR(registro.data_hora_gravacao)],
    ["NSR", String(registro.nsr)],
    ["Tipo de registro", registro.tipo],
    ["Marcação", registro.offline ? "offline" : "online"],
    ["Localização", registro.latitude != null
      ? `${registro.latitude}, ${registro.longitude} (±${registro.precisao_m} m)` : "não informada"],
    ["Hash SHA-256", registro.hash],
  ];

  const texto = [
    "COMPROVANTE DE REGISTRO DE PONTO DO TRABALHADOR",
    "".padEnd(52, "="),
    ...linhas.map(([k, v]) => `${k}: ${v}`),
    "".padEnd(52, "="),
    "Documento gerado pelo C4OS. Guarde este comprovante.",
  ].join("\n");

  const baixar = () => {
    const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `comprovante-ponto-nsr-${registro.nsr}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Modal title="Comprovante de registro de ponto" onClose={onClose} width={520}>
      <div style={{ background: L.surface, borderRadius: 10, padding: "14px 16px",
        fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5 }}>
        {linhas.map(([k, v]) => (
          <div key={k} style={{ display: "flex", gap: 10, padding: "3px 0" }}>
            <span style={{ color: L.t4, minWidth: 168 }}>{k}</span>
            <span style={{ color: L.t1, wordBreak: "break-all" }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: L.t4, margin: "10px 0" }}>
        O comprovante fica disponível para consulta e download a qualquer momento nesta tela.
      </div>
      <Row justify="flex-end" gap={8}>
        <PBtn onClick={baixar}>Baixar comprovante</PBtn>
      </Row>
    </Modal>
  );
}

/* ─────────────────────────── Painel do modo eletrônico ─────────────────────────── */

export default function PontoEletronico({ user, empresaId, config, empresa, colaboradores, fichas = [] }) {
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState("");
  const [comprovante, setComprovante] = useState(null);
  const [cadeia, setCadeia] = useState(null);
  const [manual, setManual] = useState(null);

  const fichaDe = (uid) => fichas.find((f) => f.usuario_id === uid);
  // Isento não vê o painel de bater ponto e não entra nas listas: é o caso de
  // sócio, diretoria e cargo de gestão.
  const registraPonto = (uid) => fichaDe(uid)?.registra_ponto !== false;
  const podeManual = ["client_admin", "c4hub_admin"].includes(user?.role);
  const souIsento = !registraPonto(user?.id);

  const carregar = async () => {
    setCarregando(true);
    const { data } = await supabase.from("rh_ponto_registros")
      .select("*").eq("empresa_id", empresaId).order("nsr", { ascending: false }).limit(300);
    setRegistros(data || []);
    setCarregando(false);
  };
  useEffect(() => { if (empresaId) carregar(); /* eslint-disable-next-line */ }, [empresaId]);

  const nome = (uid) => colaboradores.find((c) => c.id === uid)?.nome || "—";

  const meusHoje = registros.filter((r) => r.usuario_id === user?.id &&
    new Date(r.data_hora_marcacao).toDateString() === new Date().toDateString());
  const proximo = TIPOS[meusHoje.length] || null;

  const bater = async () => {
    setOcupado(true); setMsg("");
    const loc = await pegarLocalizacao();
    const { data, error } = await supabase.rpc("registrar_ponto_eletronico", {
      p_latitude: loc?.latitude ?? null,
      p_longitude: loc?.longitude ?? null,
      p_precisao: loc?.precisao_m ?? null,
      p_offline: false,
      p_data_hora: null,
    });
    setOcupado(false);
    if (error) { setMsg(error.message); return; }
    const reg = Array.isArray(data) ? data[0] : data;
    await carregar();
    // Comprovante aparece na hora: a norma exige que o trabalhador tenha acesso
    // a cada marcação, sem depender de pedido ou aprovação.
    setComprovante(reg);
  };

  const conferir = async () => {
    const { data, error } = await supabase.rpc("verificar_cadeia_ponto", { p_empresa: empresaId });
    if (error) { setMsg(error.message); return; }
    const quebrados = (data || []).filter((r) => !r.integro);
    setCadeia({ total: (data || []).length, quebrados });
  };

  // AFD no formato posicional. O leiaute oficial ainda precisa ser conferido
  // contra o arquivo do MTE — por isso o nome do arquivo diz "conferir".
  const exportarAFD = () => {
    const p = (v, n) => String(v ?? "").replace(/\D/g, "").padStart(n, "0").slice(-n);
    const txt = (v, n) => String(v ?? "").padEnd(n, " ").slice(0, n);
    const dt = (iso) => {
      const d = new Date(iso);
      const z = (x) => String(x).padStart(2, "0");
      return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}-0300`;
    };
    const ordenados = [...registros].sort((a, b) => a.nsr - b.nsr);
    const linhas = [];
    linhas.push(`${p(0, 9)}1${p(empresa?.cnpj, 14)}${txt(empresa?.nome, 150)}`);
    ordenados.forEach((r) => {
      linhas.push(`${p(r.nsr, 9)}7${dt(r.data_hora_marcacao)}${p(r.cpf, 11)}${dt(r.data_hora_gravacao)}${r.offline ? "1" : "0"}${txt(r.hash, 64)}`);
    });
    linhas.push(`${p(999999999, 9)}9`);
    const blob = new Blob([linhas.join("\r\n") + "\r\n"], { type: "text/plain;charset=iso-8859-1" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `AFD-conferir-leiaute-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      {souIsento ? (
        <div style={{ background: L.surface, border: `1px solid ${L.line}`, borderRadius: 12,
          padding: "12px 16px", marginBottom: 14, fontSize: 11.5, color: L.t3 }}>
          Você está isento de marcação de ponto
          {fichaDe(user?.id)?.motivo_isencao ? ` — ${fichaDe(user.id).motivo_isencao}` : ""}.
          {podeManual && " Você continua podendo lançar e conferir o ponto da equipe."}
        </div>
      ) : (
      <div style={{ background: L.white, border: `1px solid ${L.line}`, borderRadius: 12,
        padding: "14px 16px", marginBottom: 14 }}>
        <Row between>
          <div style={{ flex: 1 }}>
            <Row gap={8} mb={8}>
              <span style={{ fontSize: 10, letterSpacing: "1.4px", textTransform: "uppercase",
                color: L.t4, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>
                Meu ponto de hoje
              </span>
              <Tag color={L.teal} bg={L.tealBg}>registro imutável</Tag>
            </Row>
            <Row gap={8}>
              {TIPOS.map((t, i) => {
                const r = meusHoje[i];
                return (
                  <div key={t.campo} style={{ padding: "6px 10px", borderRadius: 8, minWidth: 96,
                    border: `1px solid ${r ? L.green : L.line}`, background: r ? L.greenBg : "transparent" }}>
                    <div style={{ fontSize: 9.5, color: L.t4, textTransform: "uppercase" }}>{t.rotulo}</div>
                    <Row gap={5}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: r ? L.green : L.t4,
                        fontFamily: "'JetBrains Mono',monospace" }}>
                        {r ? soHora(r.data_hora_marcacao) : "--:--"}
                      </span>
                      {r && <IBtn c={L.teal} onClick={() => setComprovante(r)} title="Comprovante">🧾</IBtn>}
                    </Row>
                  </div>
                );
              })}
            </Row>
          </div>
          <div>
            {proximo
              ? <PBtn onClick={ocupado ? undefined : bater}>
                  {ocupado ? "Registrando..." : `Registrar ${proximo.rotulo.toLowerCase()}`}
                </PBtn>
              : <Tag color={L.green} bg={L.greenBg}>jornada completa</Tag>}
          </div>
        </Row>
        {msg && <div style={{ marginTop: 10, padding: "7px 11px", borderRadius: 8,
          fontSize: 11.5, background: L.redBg, color: L.red }}>{msg}</div>}
      </div>
      )}

      <Row between mb={12}>
        <Row gap={8}>
          <Tag color={L.t3} bg={L.surface}>{registros.length} registro(s)</Tag>
          {cadeia && (
            <Tag color={cadeia.quebrados.length ? L.red : L.green}
              bg={cadeia.quebrados.length ? L.redBg : L.greenBg}>
              {cadeia.quebrados.length
                ? `${cadeia.quebrados.length} de ${cadeia.total} com cadeia quebrada`
                : `cadeia íntegra (${cadeia.total})`}
            </Tag>
          )}
        </Row>
        <Row gap={8}>
          <button onClick={conferir} style={{ padding: "6px 12px", borderRadius: 8, cursor: "pointer",
            fontSize: 11.5, border: `1px solid ${L.line}`, background: "transparent", color: L.t2 }}>
            Conferir integridade
          </button>
          <button onClick={exportarAFD} style={{ padding: "6px 12px", borderRadius: 8, cursor: "pointer",
            fontSize: 11.5, border: `1px solid ${L.line}`, background: "transparent", color: L.t2 }}>
            Exportar AFD
          </button>
          {podeManual && <PBtn onClick={() => setManual({ usuario_id: "", data_hora: "", justificativa: "" })}>
            + Lançar manual
          </PBtn>}
        </Row>
      </Row>

      {carregando ? (
        <div style={{ textAlign: "center", padding: 40, color: L.t4 }}>Carregando...</div>
      ) : (
        <DataTable heads={["NSR", "Colaborador", "Marcação", "Origem", "Local", "Integridade", "Comprovante"]}>
          {registros.map((r) => (
            <tr key={r.id} style={{ borderBottom: `1px solid ${L.lineSoft}` }}>
              <td style={{ ...TD, fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5 }}>{r.nsr}</td>
              <td style={{ ...TD, fontSize: 12, color: L.t1 }}>{nome(r.usuario_id)}</td>
              <td style={{ ...TD, fontSize: 11.5 }}>{dtBR(r.data_hora_marcacao)}</td>
              <td style={TD}>
                <Tag color={r.origem_registro === "manual" ? L.yellow : L.green}
                  bg={r.origem_registro === "manual" ? L.yellowBg : L.greenBg}>
                  {r.origem_registro === "manual" ? "manual" : "automático"}
                </Tag>
                {r.justificativa && (
                  <div style={{ fontSize: 10, color: L.t4, marginTop: 2 }} title={r.justificativa}>
                    {String(r.justificativa).slice(0, 30)}{r.justificativa.length > 30 ? "…" : ""}
                  </div>
                )}
              </td>
              <td style={TD}>
                {r.latitude != null
                  ? <a href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: L.teal, textDecoration: "none" }}>📍 mapa</a>
                  : <span style={{ fontSize: 11, color: L.t4 }}>—</span>}
              </td>
              <td style={{ ...TD, fontSize: 10, color: L.t4, fontFamily: "'JetBrains Mono',monospace" }}>
                {String(r.hash).slice(0, 10)}…
              </td>
              <td style={TD}><IBtn c={L.teal} onClick={() => setComprovante(r)}>🧾</IBtn></td>
            </tr>
          ))}
          {registros.length === 0 && (
            <tr><td colSpan={7} style={{ ...TD, textAlign: "center", color: L.t4, padding: 40 }}>
              Nenhum registro eletrônico ainda.</td></tr>
          )}
        </DataTable>
      )}

      {manual && (
        <ModalManual dados={manual} setDados={setManual}
          colaboradores={colaboradores.filter((c) => registraPonto(c.id))}
          onGravou={async (reg) => { await carregar(); setManual(null); setComprovante(reg); }} />
      )}

      {comprovante && (
        <Comprovante registro={comprovante} empresa={empresa}
          colaborador={colaboradores.find((c) => c.id === comprovante.usuario_id)}
          onClose={() => setComprovante(null)} />
      )}
    </>
  );
}

/* ─────────────────── Lançamento manual (modo eletrônico) ───────────────────
   Não corrige nem apaga nada: entra como registro novo, com autor e
   justificativa, e o original permanece. É assim que se conserta um
   esquecimento sem destruir o valor probatório do que já foi gravado. */

function ModalManual({ dados, setDados, colaboradores, onGravou }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const M = (k) => (v) => setDados((p) => ({ ...p, [k]: v }));

  const gravar = async () => {
    if (!dados.usuario_id) { setErro("Selecione o colaborador."); return; }
    if (!dados.data_hora)  { setErro("Informe data e hora da marcação."); return; }
    if (!dados.justificativa?.trim()) { setErro("Justificativa é obrigatória no lançamento manual."); return; }
    setSalvando(true); setErro("");
    const { data, error } = await supabase.rpc("registrar_ponto_eletronico", {
      p_latitude: null, p_longitude: null, p_precisao: null, p_offline: false,
      p_data_hora: new Date(dados.data_hora).toISOString(),
      p_usuario_id: dados.usuario_id,
      p_justificativa: dados.justificativa,
    });
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    onGravou(Array.isArray(data) ? data[0] : data);
  };

  return (
    <Modal title="Lançar ponto manualmente" onClose={() => setDados(null)} width={480}>
      <Field label="Colaborador *">
        <Select value={dados.usuario_id} onChange={M("usuario_id")}>
          <option value="">Selecionar...</option>
          {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
      </Field>
      <Field label="Data e hora da marcação *">
        <Input type="datetime-local" value={dados.data_hora} onChange={M("data_hora")} />
      </Field>
      <Field label="Justificativa *">
        <Input value={dados.justificativa} onChange={M("justificativa")}
          placeholder="Esquecimento de marcação, falha do dispositivo..." />
      </Field>
      <div style={{ padding: "9px 12px", background: L.yellowBg, borderRadius: 8,
        fontSize: 11.5, color: L.yellow, lineHeight: 1.5 }}>
        O lançamento manual entra como registro novo, identificado como manual e com o
        seu nome como autor. Nenhum registro anterior é alterado ou apagado.
      </div>
      {erro && <div style={{ padding: "8px 12px", background: L.redBg, borderRadius: 8,
        fontSize: 12, color: L.red, marginTop: 8 }}>{erro}</div>}
      <ModalFooter onClose={() => setDados(null)} onSave={gravar} loading={salvando} label="Registrar" />
    </Modal>
  );
}
