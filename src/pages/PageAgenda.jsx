import { useState, useEffect, useCallback } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Fade, Row, PBtn, IBtn, Tag, TabPills } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const TIPOS = {
  evento:   { l: "Evento",   c: L.teal },
  reuniao:  { l: "Reunião",  c: L.blue },
  tarefa:   { l: "Tarefa",   c: L.copper },
  lembrete: { l: "Lembrete", c: L.yellow },
};
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DSW   = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const fmtH  = (iso) => iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
const fmtD  = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "";

const VAZIO = { titulo: "", tipo: "evento", data_inicio: "", data_fim: "", local: "", descricao: "", all_day: false };

export default function PageAgenda({ user }) {
  const [eventos,  setEventos]  = useState([]);
  const [view,     setView]     = useState("month");
  const [ano,      setAno]      = useState(new Date().getFullYear());
  const [mes,      setMes]      = useState(new Date().getMonth());
  const [modal,    setModal]    = useState(false);
  const [edit,     setEdit]     = useState(null);
  const [form,     setForm]     = useState(VAZIO);
  const [saving,   setSaving]   = useState(false);
  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    const ini = new Date(ano, mes - 1, 1).toISOString();
    const fim = new Date(ano, mes + 2, 0).toISOString();
    const { data } = await supabase.from("agenda_eventos")
      .select("*").eq("empresa_id", user.empresa_id)
      .gte("data_inicio", ini).lte("data_inicio", fim)
      .order("data_inicio");
    setEventos(data || []);
  }, [ano, mes, user.empresa_id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.titulo.trim() || !form.data_inicio) return;
    setSaving(true);
    const payload = { ...form, empresa_id: user.empresa_id, usuario_id: user.id };
    if (edit) await supabase.from("agenda_eventos").update(payload).eq("id", edit);
    else       await supabase.from("agenda_eventos").insert(payload);
    await load();
    setModal(false); setEdit(null); setForm(VAZIO); setSaving(false);
  };

  const del = async (id) => {
    if (!confirm("Excluir evento?")) return;
    await supabase.from("agenda_eventos").delete().eq("id", id);
    setEventos(p => p.filter(e => e.id !== id));
  };

  const openNew = (diaStr) => {
    const dt = diaStr ? `${diaStr}T09:00` : "";
    setForm({ ...VAZIO, data_inicio: dt });
    setEdit(null); setModal(true);
  };

  const openEdit = (e) => {
    setForm({ ...e, data_inicio: e.data_inicio?.slice(0, 16) || "", data_fim: e.data_fim?.slice(0, 16) || "" });
    setEdit(e.id); setModal(true);
  };

  // ── Calendar grid ──
  const primeiroDia  = new Date(ano, mes, 1).getDay();
  const diasNoMes    = new Date(ano, mes + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < primeiroDia; i++) cells.push(null);
  for (let d = 1; d <= diasNoMes; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const chave = (dia) =>
    `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  const evsDia = (dia) => dia
    ? eventos.filter(e => e.data_inicio?.startsWith(chave(dia)))
    : [];

  const hoje = new Date();
  const isHoje = (dia) =>
    dia && hoje.getFullYear() === ano && hoje.getMonth() === mes && hoje.getDate() === dia;

  // ── Semana atual ──
  const startSemana = new Date(hoje);
  startSemana.setDate(hoje.getDate() - hoje.getDay());
  const semana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startSemana); d.setDate(d.getDate() + i); return d;
  });

  const proximos = eventos
    .filter(e => new Date(e.data_inicio) >= hoje)
    .sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio))
    .slice(0, 20);

  const navMes = (dir) => {
    if (dir === -1 && mes === 0)  { setMes(11); setAno(a => a - 1); }
    else if (dir === 1 && mes === 11) { setMes(0); setAno(a => a + 1); }
    else setMes(m => m + dir);
  };

  const viewLabel = view === "month" ? "Mês" : view === "week" ? "Semana" : "Próximos";

  return (
    <Fade>
      {/* Header */}
      <Row between mb={16} style={{ flexWrap: "wrap", gap: 10 }}>
        <Row gap={12} style={{ flexWrap: "wrap" }}>
          <TabPills
            tabs={["Mês", "Semana", "Próximos"]}
            active={viewLabel}
            onChange={v => setView(v === "Mês" ? "month" : v === "Semana" ? "week" : "list")}
          />
          {view === "month" && (
            <Row gap={6}>
              <IBtn c={L.t3} onClick={() => navMes(-1)}>‹</IBtn>
              <span style={{ fontSize: 14, fontWeight: 600, color: L.t1, minWidth: 160, textAlign: "center" }}>
                {MESES[mes]} {ano}
              </span>
              <IBtn c={L.t3} onClick={() => navMes(1)}>›</IBtn>
            </Row>
          )}
        </Row>
        <PBtn onClick={() => openNew(null)}>+ Novo Evento</PBtn>
      </Row>

      {/* ── Visão Mês ── */}
      {view === "month" && (
        <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${L.line}` }}>
            {DSW.map(d => (
              <div key={d} style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, color: L.t4, textTransform: "uppercase", letterSpacing: "1px", textAlign: "center", fontFamily: "'JetBrains Mono',monospace" }}>
                {d}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {cells.map((dia, i) => {
              const evs = evsDia(dia);
              const hj  = isHoje(dia);
              return (
                <div key={i}
                  onClick={() => dia && openNew(chave(dia))}
                  style={{
                    minHeight: 90, padding: "6px 7px",
                    borderRight: (i + 1) % 7 !== 0 ? `1px solid ${L.lineSoft}` : "none",
                    borderBottom: `1px solid ${L.lineSoft}`,
                    cursor: dia ? "pointer" : "default",
                    background: "transparent", transition: "background .1s",
                  }}
                  onMouseEnter={e => { if (dia) e.currentTarget.style.background = L.surface; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                  {dia && (
                    <>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", display: "flex",
                        alignItems: "center", justifyContent: "center", marginBottom: 3,
                        background: hj ? L.teal : "transparent",
                        color: hj ? L.white : L.t3,
                        fontSize: 12, fontWeight: hj ? 700 : 400,
                      }}>
                        {dia}
                      </div>
                      {evs.slice(0, 3).map(e => (
                        <div key={e.id}
                          onClick={ev => { ev.stopPropagation(); openEdit(e); }}
                          style={{
                            background: (TIPOS[e.tipo]?.c || L.teal) + "20",
                            borderLeft: `2.5px solid ${TIPOS[e.tipo]?.c || L.teal}`,
                            borderRadius: "0 4px 4px 0",
                            padding: "2px 5px", marginBottom: 2,
                            fontSize: 10, color: TIPOS[e.tipo]?.c || L.teal,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            cursor: "pointer",
                          }}>
                          {!e.all_day && <span style={{ opacity: .7 }}>{fmtH(e.data_inicio)} </span>}
                          {e.titulo}
                        </div>
                      ))}
                      {evs.length > 3 && (
                        <div style={{ fontSize: 9, color: L.t4, paddingLeft: 4 }}>+{evs.length - 3} mais</div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Visão Semana ── */}
      {view === "week" && (
        <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {semana.map((d, i) => {
              const key = d.toISOString().slice(0, 10);
              const evs = eventos.filter(e => e.data_inicio?.startsWith(key));
              const isT = key === hoje.toISOString().slice(0, 10);
              return (
                <div key={i} style={{ borderRight: i < 6 ? `1px solid ${L.lineSoft}` : "none", minHeight: 260 }}>
                  <div style={{ padding: "10px 10px 8px", borderBottom: `1px solid ${L.lineSoft}`, background: isT ? L.tealBg : L.surface, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: L.t4, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 2 }}>{DSW[d.getDay()]}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: isT ? L.teal : L.t1 }}>{d.getDate()}</div>
                  </div>
                  <div style={{ padding: "6px 6px", display: "flex", flexDirection: "column", gap: 4 }}>
                    {evs.map(e => (
                      <div key={e.id} onClick={() => openEdit(e)}
                        style={{ background: (TIPOS[e.tipo]?.c || L.teal) + "18", borderLeft: `3px solid ${TIPOS[e.tipo]?.c || L.teal}`, borderRadius: "0 6px 6px 0", padding: "5px 7px", cursor: "pointer" }}>
                        <div style={{ fontWeight: 600, color: L.t1, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.titulo}</div>
                        {!e.all_day && <div style={{ color: L.t4, fontSize: 9.5 }}>{fmtH(e.data_inicio)}</div>}
                      </div>
                    ))}
                    <button
                      onClick={() => { const s = `${key}T09:00`; setForm({ ...VAZIO, data_inicio: s }); setEdit(null); setModal(true); }}
                      style={{ background: "none", border: `1px dashed ${L.lineSoft}`, borderRadius: 6, padding: "4px", fontSize: 10, color: L.t5, cursor: "pointer", width: "100%", fontFamily: "inherit" }}>
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Próximos eventos ── */}
      {view === "list" && (
        <div style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`, overflow: "hidden" }}>
          {proximos.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: L.t4, fontSize: 12 }}>Nenhum evento próximo.</div>
          ) : proximos.map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", borderBottom: i < proximos.length - 1 ? `1px solid ${L.lineSoft}` : "none" }}>
              <div style={{ width: 4, height: 38, borderRadius: 4, background: TIPOS[e.tipo]?.c || L.teal, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: L.t1 }}>{e.titulo}</div>
                <div style={{ fontSize: 11, color: L.t4, marginTop: 1 }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{fmtD(e.data_inicio)}</span>
                  {!e.all_day && <span style={{ fontFamily: "'JetBrains Mono',monospace" }}> {fmtH(e.data_inicio)}</span>}
                  {e.local && <span style={{ marginLeft: 10 }}>📍 {e.local}</span>}
                </div>
              </div>
              <Tag color={TIPOS[e.tipo]?.c || L.teal} bg={(TIPOS[e.tipo]?.c || L.teal) + "18"}>
                {TIPOS[e.tipo]?.l}
              </Tag>
              <IBtn c={L.teal} onClick={() => openEdit(e)}>✎</IBtn>
              <IBtn c={L.red}  onClick={() => del(e.id)}>⊗</IBtn>
            </div>
          ))}
        </div>
      )}

      {/* Modal evento */}
      {modal && (
        <Modal title={edit ? "Editar Evento" : "Novo Evento"} onClose={() => { setModal(false); setEdit(null); setForm(VAZIO); }} width={480}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            <Field label="Título *" style={{ gridColumn: "1/-1" }}>
              <Input value={form.titulo} onChange={F("titulo")} placeholder="Nome do evento..." autoFocus />
            </Field>
            <Field label="Tipo">
              <Select value={form.tipo} onChange={F("tipo")}>
                {Object.entries(TIPOS).map(([v, { l }]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Dia inteiro">
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 6 }}>
                <input type="checkbox" checked={!!form.all_day} onChange={e => F("all_day")(e.target.checked)} />
                <span style={{ fontSize: 12, color: L.t2 }}>Sim</span>
              </div>
            </Field>
            <Field label={form.all_day ? "Data *" : "Início *"}>
              <Input type={form.all_day ? "date" : "datetime-local"} value={form.data_inicio} onChange={F("data_inicio")} />
            </Field>
            {!form.all_day && (
              <Field label="Término">
                <Input type="datetime-local" value={form.data_fim || ""} onChange={F("data_fim")} />
              </Field>
            )}
            <Field label="Local" style={{ gridColumn: "1/-1" }}>
              <Input value={form.local || ""} onChange={F("local")} placeholder="Sala, link ou endereço..." />
            </Field>
            <Field label="Descrição" style={{ gridColumn: "1/-1" }}>
              <Input value={form.descricao || ""} onChange={F("descricao")} placeholder="Detalhes..." />
            </Field>
          </div>

          {/* Link Google Agenda — só mostra quando há título e data */}
          {form.titulo && form.data_inicio && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: L.surface, borderRadius: 8, border: `1px solid ${L.line}`, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>📅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: L.t2, marginBottom: 2 }}>Adicionar ao Google Agenda</div>
                <div style={{ fontSize: 10, color: L.t4 }}>Abre o Google Calendar com os dados preenchidos para salvar e ativar notificações.</div>
              </div>
              <button
                onClick={() => {
                  const toGCal = (iso) => iso ? new Date(iso).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z" : "";
                  const dtStart = toGCal(form.data_inicio);
                  const dtEnd   = toGCal(form.data_fim || form.data_inicio);
                  const params  = new URLSearchParams({
                    action: "TEMPLATE",
                    text:   form.titulo,
                    dates:  `${dtStart}/${dtEnd}`,
                    details: form.descricao || "",
                    location: form.local || "",
                  });
                  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank");
                }}
                style={{ padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "#4285F4", color: "white", border: "none", whiteSpace: "nowrap" }}>
                Abrir Google
              </button>
            </div>
          )}

          {/* Ações do modal: Excluir (se editando) + Salvar */}
          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "space-between", alignItems: "center" }}>
            {edit ? (
              <button
                onClick={async () => { if (confirm("Excluir este evento?")) { await del(edit); setModal(false); setEdit(null); setForm(VAZIO); } }}
                style={{ padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: L.redBg, color: L.red, border: `1px solid ${L.red}22`, transition: "all .12s" }}
                onMouseEnter={e => { e.currentTarget.style.background = L.red; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.background = L.redBg; e.currentTarget.style.color = L.red; }}>
                🗑 Excluir
              </button>
            ) : <div />}
            <ModalFooter
              onClose={() => { setModal(false); setEdit(null); setForm(VAZIO); }}
              onSave={save} loading={saving}
              label={edit ? "Salvar" : "Criar Evento"}
              inline
            />
          </div>
        </Modal>
      )}
    </Fade>
  );
}
