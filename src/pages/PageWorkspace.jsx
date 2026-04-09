import { useState, useEffect, useRef, useCallback } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Fade, Row, PBtn, IBtn, Av } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const fmt = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const fmtDT = (iso) => iso
  ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  : "";

const VAZIO_CANAL    = { nome: "", tipo: "publico" };
const VAZIO_REUNIAO  = { titulo: "", descricao: "", data_inicio: "", link: "" };

export default function PageWorkspace({ user }) {
  const [canais,       setCanais]       = useState([]);
  const [canalId,      setCanalId]      = useState(null);
  const [mensagens,    setMensagens]    = useState([]);
  const [texto,        setTexto]        = useState("");
  const [reunioes,     setReunioes]     = useState([]);
  const [membros,      setMembros]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modalCanal,   setModalCanal]   = useState(false);
  const [modalReuniao, setModalReuniao] = useState(false);
  const [formCanal,    setFormCanal]    = useState(VAZIO_CANAL);
  const [formReuniao,  setFormReuniao]  = useState(VAZIO_REUNIAO);
  const [saving,       setSaving]       = useState(false);
  const endRef  = useRef(null);
  const subRef  = useRef(null);
  const inputRef = useRef(null);

  const canal = canais.find(c => c.id === canalId);

  const loadCanais = useCallback(async () => {
    const { data } = await supabase.from("workspace_canais")
      .select("*").eq("empresa_id", user.empresa_id).order("nome");
    const list = data || [];
    setCanais(list);
    if (list.length > 0 && !canalId) setCanalId(list[0].id);
  }, [user.empresa_id]); // eslint-disable-line

  const loadMensagens = useCallback(async (id) => {
    if (!id) return;
    const { data } = await supabase.from("workspace_mensagens")
      .select("*, usuarios(nome, cor, foto_url)")
      .eq("canal_id", id).order("created_at").limit(100);
    setMensagens(data || []);
  }, []);

  const loadReunioes = useCallback(async () => {
    const { data } = await supabase.from("workspace_reunioes")
      .select("*").eq("empresa_id", user.empresa_id)
      .gte("data_inicio", new Date().toISOString())
      .order("data_inicio").limit(5);
    setReunioes(data || []);
  }, [user.empresa_id]);

  const loadMembros = useCallback(async () => {
    const { data } = await supabase.from("usuarios")
      .select("id, nome, cargo, cor, foto_url")
      .eq("empresa_id", user.empresa_id).eq("ativo", true);
    setMembros(data || []);
  }, [user.empresa_id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadCanais(), loadReunioes(), loadMembros()]).finally(() => setLoading(false));
  }, [loadCanais, loadReunioes, loadMembros]);

  useEffect(() => {
    if (!canalId) return;
    loadMensagens(canalId);
    if (subRef.current) supabase.removeChannel(subRef.current);
    subRef.current = supabase
      .channel(`ws-msgs-${canalId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "workspace_mensagens",
        filter: `canal_id=eq.${canalId}`,
      }, async (payload) => {
        // Busca dados do usuário para a nova mensagem
        const { data: u } = await supabase.from("usuarios")
          .select("nome, cor, foto_url").eq("id", payload.new.usuario_id).single();
        setMensagens(p => [...p, { ...payload.new, usuarios: u }]);
      })
      .subscribe();
    return () => { if (subRef.current) supabase.removeChannel(subRef.current); };
  }, [canalId, loadMensagens]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const enviar = async () => {
    if (!texto.trim() || !canalId) return;
    const content = texto.trim();
    setTexto("");
    inputRef.current?.focus();
    await supabase.from("workspace_mensagens")
      .insert({ canal_id: canalId, usuario_id: user.id, content, tipo: "texto" });
  };

  const criarCanal = async () => {
    if (!formCanal.nome.trim()) return;
    setSaving(true);
    const { data } = await supabase.from("workspace_canais").insert({
      empresa_id: user.empresa_id,
      nome: formCanal.nome.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      tipo: formCanal.tipo,
      criado_por: user.id,
    }).select().single();
    if (data) { setCanais(p => [...p, data]); setCanalId(data.id); }
    setModalCanal(false); setFormCanal(VAZIO_CANAL); setSaving(false);
  };

  const criarReuniao = async () => {
    if (!formReuniao.titulo || !formReuniao.data_inicio) return;
    setSaving(true);
    const link = formReuniao.link.trim() ||
      `https://meet.jit.si/c4hub-${(user.empresa_id || "").slice(0, 8)}-${Date.now()}`;
    await supabase.from("workspace_reunioes").insert({
      ...formReuniao, link,
      empresa_id: user.empresa_id,
      criado_por: user.id,
    });
    await loadReunioes();
    setModalReuniao(false); setFormReuniao(VAZIO_REUNIAO); setSaving(false);
  };

  return (
    <Fade>
      <div style={{
        display: "flex", height: "calc(100vh - 110px)", borderRadius: 14,
        overflow: "hidden", border: `1px solid ${L.line}`, background: L.white,
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
      }}>

        {/* ── Sidebar canais ── */}
        <div style={{
          width: 220, minWidth: 220, borderRight: `1px solid ${L.line}`,
          display: "flex", flexDirection: "column", background: L.surface, flexShrink: 0,
        }}>
          <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${L.lineSoft}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: L.t1, fontFamily: "'Outfit',sans-serif" }}>
              {user.empresa || "Workspace"}
            </div>
            <div style={{ fontSize: 10, color: L.t4 }}>{membros.length} membros ativos</div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {/* Canais */}
            <div style={{ padding: "4px 14px 2px", fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: L.t5, fontFamily: "'JetBrains Mono',monospace" }}>
              Canais
            </div>
            {canais.map(c => (
              <button key={c.id} onClick={() => setCanalId(c.id)}
                style={{
                  width: "100%", textAlign: "left", padding: "6px 14px",
                  background: canalId === c.id ? L.tealBg : "transparent",
                  border: "none", cursor: "pointer",
                  color: canalId === c.id ? L.teal : L.t3,
                  fontSize: 12.5, fontFamily: "inherit", transition: "all .1s",
                  fontWeight: canalId === c.id ? 600 : 400,
                  boxShadow: canalId === c.id ? `inset 2px 0 0 ${L.teal}` : "none",
                }}
                onMouseEnter={e => { if (canalId !== c.id) e.currentTarget.style.background = L.hover; }}
                onMouseLeave={e => { if (canalId !== c.id) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ opacity: .6, marginRight: 3 }}>{c.tipo === "privado" ? "🔒" : "#"}</span>
                {c.nome}
              </button>
            ))}
            <button onClick={() => setModalCanal(true)}
              style={{ width: "100%", textAlign: "left", padding: "5px 14px", background: "transparent", border: "none", cursor: "pointer", color: L.t5, fontSize: 11, fontFamily: "inherit" }}
              onMouseEnter={e => e.currentTarget.style.color = L.teal}
              onMouseLeave={e => e.currentTarget.style.color = L.t5}>
              + Novo canal
            </button>

            {/* Membros */}
            <div style={{ padding: "10px 14px 4px", fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: L.t5, fontFamily: "'JetBrains Mono',monospace", marginTop: 6 }}>
              Membros ({membros.length})
            </div>
            {membros.map(m => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 14px" }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Av name={m.nome} size={20} color={m.cor} src={m.foto_url} />
                  <div style={{ position: "absolute", bottom: -1, right: -1, width: 7, height: 7, borderRadius: "50%", background: L.green, border: `1.5px solid ${L.surface}` }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: L.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nome.split(" ")[0]}</div>
                  {m.cargo && <div style={{ fontSize: 9, color: L.t5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.cargo}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Área de mensagens ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Header do canal */}
          <div style={{ height: 50, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${L.line}`, flexShrink: 0, background: L.white }}>
            <div style={{ fontWeight: 600, color: L.t1, fontSize: 13.5 }}>
              {canal ? <><span style={{ color: L.t4, marginRight: 4 }}>#</span>{canal.nome}</> : <span style={{ color: L.t4 }}>Selecione um canal</span>}
            </div>
            <PBtn onClick={() => setModalReuniao(true)} style={{ padding: "5px 12px", fontSize: 11 }}>
              📹 Agendar Reunião
            </PBtn>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 0 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: L.t4, fontSize: 12 }}>Carregando...</div>
            ) : !canalId ? (
              <div style={{ textAlign: "center", padding: 60, color: L.t4 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>💬</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: L.t2, marginBottom: 4 }}>Selecione um canal</div>
                <div style={{ fontSize: 11 }}>ou crie um novo canal para começar a conversa.</div>
              </div>
            ) : mensagens.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: L.t4 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>👋</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: L.t2, marginBottom: 4 }}>Início de #{canal?.nome}</div>
                <div style={{ fontSize: 11 }}>Seja o primeiro a enviar uma mensagem aqui.</div>
              </div>
            ) : (
              mensagens.map((m, i) => {
                const prev = mensagens[i - 1];
                const agrupado = prev && prev.usuario_id === m.usuario_id &&
                  (new Date(m.created_at) - new Date(prev.created_at)) < 300000;
                const nome = m.usuarios?.nome || "Usuário";
                const isMe = m.usuario_id === user.id;
                return (
                  <div key={m.id} style={{ display: "flex", gap: 10, marginTop: agrupado ? 2 : 14, alignItems: "flex-start" }}>
                    <div style={{ width: 34, flexShrink: 0, paddingTop: 1 }}>
                      {!agrupado && <Av name={nome} size={32} color={m.usuarios?.cor} src={m.usuarios?.foto_url} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {!agrupado && (
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: isMe ? L.teal : L.t1 }}>{nome}</span>
                          <span style={{ fontSize: 10, color: L.t5, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(m.created_at)}</span>
                        </div>
                      )}
                      <div style={{ fontSize: 13, color: L.t2, lineHeight: 1.55, wordBreak: "break-word" }}>{m.content}</div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 16px 14px", borderTop: `1px solid ${L.line}`, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: L.surface, border: `1px solid ${L.line}`, borderRadius: 12, padding: "8px 12px", transition: "border-color .15s" }}>
              <textarea ref={inputRef}
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                placeholder={canal ? `Mensagem em #${canal.nome}...` : "Selecione um canal..."}
                disabled={!canalId}
                style={{ flex: 1, background: "none", border: "none", outline: "none", resize: "none", fontSize: 13, color: L.t1, fontFamily: "inherit", lineHeight: 1.5, maxHeight: 120, minHeight: 20 }}
                rows={1}
              />
              <button onClick={enviar} disabled={!texto.trim() || !canalId}
                style={{ background: L.teal, border: "none", borderRadius: 8, width: 32, height: 32, color: L.white, cursor: "pointer", fontSize: 14, opacity: (!texto.trim() || !canalId) ? 0.35 : 1, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity .15s" }}>
                ↑
              </button>
            </div>
            <div style={{ fontSize: 10, color: L.t5, marginTop: 4, textAlign: "right" }}>Enter para enviar · Shift+Enter para nova linha</div>
          </div>
        </div>

        {/* ── Painel direito: reuniões ── */}
        <div style={{ width: 280, minWidth: 280, borderLeft: `1px solid ${L.line}`, display: "flex", flexDirection: "column", background: L.surface, flexShrink: 0 }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${L.lineSoft}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: L.t1 }}>Próximas Reuniões</div>
            <div style={{ fontSize: 10, color: L.t4, marginTop: 1 }}>videoconferências agendadas</div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            {reunioes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: L.t4, fontSize: 11 }}>
                Nenhuma reunião agendada.<br />
                <span style={{ cursor: "pointer", color: L.teal, fontWeight: 600 }}
                  onClick={() => setModalReuniao(true)}>Criar primeira reunião</span>
              </div>
            ) : reunioes.map(r => (
              <div key={r.id} style={{ border: `1px solid ${L.line}`, borderRadius: 10, padding: "11px 13px", marginBottom: 8, background: L.white }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: L.t1, marginBottom: 3 }}>{r.titulo}</div>
                <div style={{ fontSize: 10, color: L.t4, marginBottom: r.descricao ? 4 : 8, fontFamily: "'JetBrains Mono',monospace" }}>
                  📅 {fmtDT(r.data_inicio)}
                </div>
                {r.descricao && <div style={{ fontSize: 11, color: L.t3, marginBottom: 8, lineHeight: 1.4 }}>{r.descricao}</div>}
                <button onClick={() => window.open(r.link, "_blank")}
                  style={{ width: "100%", padding: "7px", background: L.teal, border: "none", borderRadius: 7, color: L.white, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                  📹 Entrar na Reunião
                </button>
              </div>
            ))}
          </div>

          <div style={{ padding: "12px", borderTop: `1px solid ${L.lineSoft}` }}>
            <button onClick={() => setModalReuniao(true)}
              style={{ width: "100%", padding: "8px", background: L.tealBg, border: `1px solid ${L.line}`, borderRadius: 8, color: L.teal, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              + Agendar Reunião
            </button>
          </div>
        </div>
      </div>

      {/* Modal: criar canal */}
      {modalCanal && (
        <Modal title="Novo Canal" onClose={() => setModalCanal(false)} width={380}>
          <Field label="Nome do canal">
            <Input value={formCanal.nome} onChange={v => setFormCanal(p => ({ ...p, nome: v }))}
              placeholder="ex: vendas, suporte, geral..." autoFocus />
          </Field>
          <Field label="Tipo">
            <Select value={formCanal.tipo} onChange={v => setFormCanal(p => ({ ...p, tipo: v }))}>
              <option value="publico">Público — visível para todos</option>
              <option value="privado">Privado — somente convidados</option>
            </Select>
          </Field>
          <ModalFooter onClose={() => setModalCanal(false)} onSave={criarCanal} loading={saving} label="Criar Canal" />
        </Modal>
      )}

      {/* Modal: agendar reunião */}
      {modalReuniao && (
        <Modal title="Agendar Reunião" onClose={() => setModalReuniao(false)} width={440}>
          <Field label="Título *">
            <Input value={formReuniao.titulo} onChange={v => setFormReuniao(p => ({ ...p, titulo: v }))}
              placeholder="Reunião de alinhamento..." autoFocus />
          </Field>
          <Field label="Data e Hora *">
            <Input type="datetime-local" value={formReuniao.data_inicio}
              onChange={v => setFormReuniao(p => ({ ...p, data_inicio: v }))} />
          </Field>
          <Field label="Descrição / Pauta">
            <Input value={formReuniao.descricao}
              onChange={v => setFormReuniao(p => ({ ...p, descricao: v }))}
              placeholder="Pauta da reunião..." />
          </Field>
          <Field label="Link externo (opcional)">
            <Input value={formReuniao.link}
              onChange={v => setFormReuniao(p => ({ ...p, link: v }))}
              placeholder="Deixe em branco — link Jitsi gerado automaticamente" />
          </Field>
          <div style={{ padding: "8px 12px", background: L.tealBg, borderRadius: 8, fontSize: 11, color: L.t3, marginTop: 4 }}>
            💡 O link de vídeo é gerado automaticamente via Jitsi Meet (gratuito, sem instalação).
          </div>
          <ModalFooter onClose={() => setModalReuniao(false)} onSave={criarReuniao} loading={saving} label="Agendar" />
        </Modal>
      )}
    </Fade>
  );
}
