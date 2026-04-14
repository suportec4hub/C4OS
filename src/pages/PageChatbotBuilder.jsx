import { useState, useEffect, useRef } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Row } from "../components/ui";

// ─── Node types ──────────────────────────────────────────────────────────────
const NODE_TYPES = {
  inicio:    { label: "Início",        cor: L.green,  icone: "▶", desc: "Ponto de entrada do fluxo"   },
  mensagem:  { label: "Mensagem",      cor: L.blue,   icone: "💬", desc: "Envia uma mensagem de texto" },
  opcoes:    { label: "Menu de opções",cor: L.yellow, icone: "📋", desc: "Apresenta opções numeradas"  },
  condicao:  { label: "Condição",      cor: "#7c3aed",icone: "⟐",  desc: "Bifurca por palavra-chave"  },
  transferir:{ label: "Transferir",    cor: L.copper, icone: "⇄",  desc: "Transfere para atendente"    },
  encerrar:  { label: "Encerrar",      cor: L.red,    icone: "⊗",  desc: "Encerra o fluxo"             },
  aguardar:  { label: "Aguardar input",cor: "#0891b2",icone: "⏳",  desc: "Aguarda resposta do usuário" },
};

const btn = (bg = L.surface, color = L.t2, extra = {}) => ({
  background: bg, color, border: `1px solid ${L.line}`, borderRadius: 8,
  padding: "7px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  fontWeight: 500, transition: "all .12s", ...extra,
});

const VAZIO_FLUXO = { nome: "", descricao: "" };

// ─── Node card component ─────────────────────────────────────────────────────
function NodeCard({ no, onEdit, onDelete, onConnect, selected, onClick }) {
  const tipo = NODE_TYPES[no.tipo] || NODE_TYPES.mensagem;
  return (
    <div onClick={() => onClick(no)} style={{
      position: "absolute", left: no.x, top: no.y, width: 200,
      background: L.white, borderRadius: 10, border: `2px solid ${selected ? tipo.cor : L.line}`,
      boxShadow: selected ? `0 0 0 3px ${tipo.cor}22` : "0 2px 8px rgba(0,0,0,.08)",
      cursor: "pointer", userSelect: "none", transition: "border-color .15s, box-shadow .15s",
    }}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${L.lineSoft}`,
        display: "flex", alignItems: "center", gap: 8,
        background: tipo.cor + "11", borderRadius: "8px 8px 0 0" }}>
        <span style={{ fontSize: 16 }}>{tipo.icone}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: tipo.cor, textTransform: "uppercase",
            letterSpacing: ".5px" }}>{tipo.label}</div>
          <div style={{ fontSize: 11, color: L.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {no.nome || "Sem nome"}
          </div>
        </div>
      </div>
      {no.mensagem && (
        <div style={{ padding: "6px 12px 8px", fontSize: 11, color: L.t3,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {no.mensagem}
        </div>
      )}
      <div style={{ padding: "6px 10px", display: "flex", gap: 4, justifyContent: "flex-end" }}>
        <button onClick={e => { e.stopPropagation(); onEdit(no); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: L.t3, fontSize: 11 }}>✎</button>
        <button onClick={e => { e.stopPropagation(); onConnect(no); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: L.blue, fontSize: 11 }}>→</button>
        {no.tipo !== "inicio" && (
          <button onClick={e => { e.stopPropagation(); onDelete(no.id); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: L.red, fontSize: 11 }}>✕</button>
        )}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function PageChatbotBuilder({ user }) {
  const [fluxos,       setFluxos]       = useState([]);
  const [activeFluxo,  setActiveFluxo]  = useState(null);
  const [nos,          setNos]          = useState([]);
  const [conexoes,     setConexoes]     = useState([]);
  const [selectedNo,   setSelectedNo]   = useState(null);
  const [editingNo,    setEditingNo]    = useState(null);
  const [connecting,   setConnecting]   = useState(null); // no de origem
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [novaModal,    setNovaModal]    = useState(false);
  const [novaForm,     setNovaForm]     = useState(VAZIO_FLUXO);
  const [dragging,     setDragging]     = useState(null);
  const [dragOffset,   setDragOffset]   = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!user?.empresa_id) return;
    supabase.from("chatbot_fluxos").select("id, nome, descricao, ativo, created_at")
      .eq("empresa_id", user.empresa_id).order("created_at", { ascending: false })
      .then(({ data }) => setFluxos(data || []));
  }, [user?.empresa_id]);

  const openFluxo = async (f) => {
    setActiveFluxo(f);
    const { data } = await supabase.from("chatbot_fluxos").select("nos, conexoes").eq("id", f.id).single();
    setNos(data?.nos || [{ id: "inicio", tipo: "inicio", nome: "Início", x: 60, y: 80 }]);
    setConexoes(data?.conexoes || []);
    setSelectedNo(null);
  };

  const saveFluxo = async () => {
    if (!activeFluxo) return;
    setSaving(true);
    await supabase.from("chatbot_fluxos").update({ nos, conexoes, updated_at: new Date().toISOString() }).eq("id", activeFluxo.id);
    setSaving(false);
  };

  const toggleAtivo = async (f) => {
    await supabase.from("chatbot_fluxos").update({ ativo: !f.ativo }).eq("id", f.id);
    setFluxos(p => p.map(x => x.id === f.id ? { ...x, ativo: !x.ativo } : x));
    if (activeFluxo?.id === f.id) setActiveFluxo(p => ({ ...p, ativo: !p.ativo }));
  };

  const criarFluxo = async () => {
    if (!novaForm.nome.trim()) return;
    const initNo = { id: "inicio", tipo: "inicio", nome: "Início", mensagem: "", x: 60, y: 80 };
    const { data, error } = await supabase.from("chatbot_fluxos").insert({
      empresa_id: user.empresa_id, nome: novaForm.nome.trim(),
      descricao: novaForm.descricao.trim(), ativo: false,
      nos: [initNo], conexoes: [],
    }).select().single();
    if (!error && data) {
      setFluxos(p => [data, ...p]);
      setNovaModal(false);
      setNovaForm(VAZIO_FLUXO);
      openFluxo(data);
    }
  };

  const deletarFluxo = async (id) => {
    if (!window.confirm("Remover este fluxo?")) return;
    await supabase.from("chatbot_fluxos").delete().eq("id", id);
    setFluxos(p => p.filter(x => x.id !== id));
    if (activeFluxo?.id === id) setActiveFluxo(null);
  };

  const addNo = (tipo) => {
    const id = `no-${Date.now()}`;
    const newNo = { id, tipo, nome: NODE_TYPES[tipo]?.label || tipo, mensagem: "", x: 100 + Math.random() * 300, y: 100 + Math.random() * 200, opcoes: [] };
    setNos(p => [...p, newNo]);
  };

  const deleteNo = (id) => {
    setNos(p => p.filter(n => n.id !== id));
    setConexoes(p => p.filter(c => c.de !== id && c.para !== id));
  };

  const saveNo = (updated) => {
    setNos(p => p.map(n => n.id === updated.id ? updated : n));
    setEditingNo(null);
  };

  const handleConnect = (noOrigem) => {
    if (!connecting) { setConnecting(noOrigem); return; }
    if (connecting.id === noOrigem.id) { setConnecting(null); return; }
    const jaExiste = conexoes.find(c => c.de === connecting.id && c.para === noOrigem.id);
    if (!jaExiste) {
      setConexoes(p => [...p, { id: `con-${Date.now()}`, de: connecting.id, para: noOrigem.id, label: "" }]);
    }
    setConnecting(null);
  };

  // Drag & drop
  const handleMouseDown = (e, noId) => {
    if (e.button !== 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const no = nos.find(n => n.id === noId);
    setDragging(noId);
    setDragOffset({ x: e.clientX - rect.left - no.x, y: e.clientY - rect.top - no.y });
    e.stopPropagation();
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left - dragOffset.x);
    const y = Math.max(0, e.clientY - rect.top - dragOffset.y);
    setNos(p => p.map(n => n.id === dragging ? { ...n, x, y } : n));
  };

  // ── render: fluxo list ──
  if (!activeFluxo) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Row between mb={20}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: L.t1 }}>Chatbot Visual</div>
            <div style={{ fontSize: 12, color: L.t3, marginTop: 2 }}>
              Crie fluxos de atendimento automático com arrastar e soltar
            </div>
          </div>
          <button onClick={() => setNovaModal(true)} style={btn(L.t1, "white")}>+ Novo fluxo</button>
        </Row>

        {fluxos.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: L.t4 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Nenhum fluxo criado</div>
            <div style={{ fontSize: 12, marginBottom: 20 }}>
              Crie fluxos visuais de atendimento: menus, mensagens automáticas, transferências e muito mais.
            </div>
            <button onClick={() => setNovaModal(true)} style={btn(L.t1, "white")}>+ Criar primeiro fluxo</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {fluxos.map(f => (
              <div key={f.id} style={{ background: L.white, borderRadius: 12, border: `1px solid ${L.line}`,
                padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                <Row between mb={6}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: L.t1 }}>{f.nome}</span>
                  <span style={{ fontSize: 10, background: f.ativo ? L.greenBg : L.surface,
                    color: f.ativo ? L.green : L.t3, padding: "2px 8px", borderRadius: 10, fontWeight: 600,
                    border: `1px solid ${f.ativo ? L.green + "33" : L.line}` }}>
                    {f.ativo ? "Ativo" : "Rascunho"}
                  </span>
                </Row>
                {f.descricao && <div style={{ fontSize: 11, color: L.t3, marginBottom: 10 }}>{f.descricao}</div>}
                <div style={{ fontSize: 10, color: L.t4, marginBottom: 12 }}>
                  Criado em {new Date(f.created_at).toLocaleDateString("pt-BR")}
                </div>
                <Row gap={6}>
                  <button onClick={() => openFluxo(f)} style={btn(L.t1, "white", { flex: 1, fontSize: 11 })}>
                    ✎ Editar fluxo
                  </button>
                  <button onClick={() => toggleAtivo(f)}
                    style={btn(f.ativo ? L.yellowBg : L.greenBg, f.ativo ? L.yellow : L.green, { fontSize: 11, padding: "7px 10px" })}>
                    {f.ativo ? "⏸" : "▶"}
                  </button>
                  <button onClick={() => deletarFluxo(f.id)} style={btn(L.redBg, L.red, { fontSize: 11, padding: "7px 10px" })}>
                    ✕
                  </button>
                </Row>
              </div>
            ))}
          </div>
        )}

        {novaModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200,
            display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setNovaModal(false)}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: L.white, borderRadius: 12, padding: 24, width: 400, boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: L.t1, marginBottom: 16 }}>Novo fluxo</div>
              {[
                { label: "Nome do fluxo *", key: "nome", placeholder: "Ex: Atendimento Inicial" },
                { label: "Descrição",        key: "descricao", placeholder: "Para que serve este fluxo?" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input value={novaForm[f.key]} onChange={e => setNovaForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 12px",
                      fontSize: 12, color: L.t1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              ))}
              <Row gap={8} style={{ justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setNovaModal(false)} style={btn()}>Cancelar</button>
                <button onClick={criarFluxo} style={btn(L.t1, "white")}>Criar</button>
              </Row>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── render: flow editor ──
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)" }}>
      {/* Toolbar */}
      <div style={{ padding: "10px 16px", background: L.white, borderBottom: `1px solid ${L.line}`,
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
        <button onClick={() => { setActiveFluxo(null); setNos([]); setConexoes([]); }} style={btn()}>← Voltar</button>
        <div style={{ fontSize: 13, fontWeight: 700, color: L.t1, flex: 1 }}>{activeFluxo.nome}</div>
        {connecting && (
          <div style={{ fontSize: 11, background: L.blueBg, color: L.blue, padding: "5px 10px", borderRadius: 8,
            border: `1px solid ${L.blue}33` }}>
            Clique no nó de destino para conectar
          </div>
        )}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {Object.entries(NODE_TYPES).filter(([k]) => k !== "inicio").map(([k, v]) => (
            <button key={k} onClick={() => addNo(k)}
              style={btn(v.cor + "11", v.cor, { fontSize: 10, padding: "4px 9px", border: `1px solid ${v.cor}33` })}>
              {v.icone} {v.label}
            </button>
          ))}
        </div>
        <button onClick={saveFluxo} disabled={saving}
          style={btn(L.green, "white", { fontSize: 12 })}>
          {saving ? "Salvando..." : "💾 Salvar"}
        </button>
        <button onClick={() => toggleAtivo(activeFluxo)}
          style={btn(activeFluxo.ativo ? L.yellowBg : L.greenBg, activeFluxo.ativo ? L.yellow : L.green, { fontSize: 11 })}>
          {activeFluxo.ativo ? "⏸ Pausar" : "▶ Ativar"}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Canvas */}
        <div ref={canvasRef} onMouseMove={handleMouseMove} onMouseUp={() => setDragging(null)}
          onClick={() => { setSelectedNo(null); if (connecting) setConnecting(null); }}
          style={{ flex: 1, position: "relative", overflow: "auto", background: "#f8f9fa",
            backgroundImage: "radial-gradient(#e5e7eb 1px, transparent 1px)",
            backgroundSize: "20px 20px", cursor: dragging ? "grabbing" : "default" }}>

          {/* SVG connections */}
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
            {conexoes.map(c => {
              const de   = nos.find(n => n.id === c.de);
              const para = nos.find(n => n.id === c.para);
              if (!de || !para) return null;
              const x1 = de.x + 200, y1 = de.y + 40;
              const x2 = para.x,     y2 = para.y + 40;
              const cx = (x1 + x2) / 2;
              return (
                <g key={c.id}>
                  <path d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
                    fill="none" stroke={L.line} strokeWidth={2} />
                  <polygon points={`${x2-6},${y2-4} ${x2},${y2} ${x2-6},${y2+4}`} fill={L.t3} />
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {nos.map(no => (
            <div key={no.id} onMouseDown={e => handleMouseDown(e, no.id)}>
              <NodeCard
                no={no}
                selected={selectedNo?.id === no.id || connecting?.id === no.id}
                onClick={n => { setSelectedNo(n); if (connecting) handleConnect(n); }}
                onEdit={setEditingNo}
                onDelete={deleteNo}
                onConnect={handleConnect}
              />
            </div>
          ))}

          {nos.length <= 1 && (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              textAlign: "center", color: L.t4, pointerEvents: "none" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Adicione nós clicando nos botões acima</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Arraste os nós para posicioná-los. Use → para conectar.</div>
            </div>
          )}
        </div>

        {/* Edit panel */}
        {editingNo && (
          <NodeEditPanel no={editingNo} onSave={saveNo} onClose={() => setEditingNo(null)} />
        )}
      </div>
    </div>
  );
}

// ─── Node editor panel ────────────────────────────────────────────────────────
function NodeEditPanel({ no, onSave, onClose }) {
  const [form, setForm] = useState({ ...no });

  return (
    <div style={{ width: 280, minWidth: 280, borderLeft: `1px solid ${L.line}`, background: L.white,
      display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${L.line}`, display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: L.t1 }}>
          {NODE_TYPES[no.tipo]?.icone} Editar: {NODE_TYPES[no.tipo]?.label}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: L.t3, fontSize: 16 }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>Nome do nó</label>
          <input value={form.nome || ""} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
            style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "7px 10px",
              fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>

        {["mensagem","inicio","aguardar"].includes(no.tipo) && (
          <div>
            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>
              Mensagem {"{nome}" + " = nome do contato"}
            </label>
            <textarea value={form.mensagem || ""} onChange={e => setForm(p => ({ ...p, mensagem: e.target.value }))}
              rows={4} placeholder="Digite a mensagem que será enviada..."
              style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "7px 10px",
                fontSize: 12, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
          </div>
        )}

        {no.tipo === "opcoes" && (
          <div>
            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>Texto introdutório</label>
            <textarea value={form.mensagem || ""} onChange={e => setForm(p => ({ ...p, mensagem: e.target.value }))}
              rows={2} placeholder="Ex: Escolha uma opção:"
              style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "7px 10px",
                fontSize: 12, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: 8 }} />
            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>Opções (uma por linha)</label>
            <textarea value={(form.opcoes || []).join("\n")} onChange={e => setForm(p => ({ ...p, opcoes: e.target.value.split("\n") }))}
              rows={4} placeholder={"Vendas\nSuportte\nFinanceiro"}
              style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "7px 10px",
                fontSize: 12, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
          </div>
        )}

        {no.tipo === "condicao" && (
          <div>
            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>Palavras-chave (separadas por vírgula)</label>
            <input value={form.gatilhos || ""} onChange={e => setForm(p => ({ ...p, gatilhos: e.target.value }))}
              placeholder="sim, confirmar, ok"
              style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "7px 10px",
                fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
        )}

        {no.tipo === "aguardar" && (
          <div>
            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>Salvar resposta como variável</label>
            <input value={form.variavel || ""} onChange={e => setForm(p => ({ ...p, variavel: e.target.value }))}
              placeholder="Ex: nome_cliente"
              style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "7px 10px",
                fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
        )}

        {no.tipo === "transferir" && (
          <div>
            <label style={{ fontSize: 11, color: L.t3, display: "block", marginBottom: 4 }}>Mensagem antes de transferir</label>
            <textarea value={form.mensagem || ""} onChange={e => setForm(p => ({ ...p, mensagem: e.target.value }))}
              rows={3} placeholder="Aguarde, vou transferir para um atendente..."
              style={{ width: "100%", border: `1px solid ${L.line}`, borderRadius: 8, padding: "7px 10px",
                fontSize: 12, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
          </div>
        )}
      </div>
      <div style={{ padding: 14, borderTop: `1px solid ${L.line}` }}>
        <button onClick={() => onSave(form)}
          style={{ width: "100%", background: L.t1, color: "white", border: "none", borderRadius: 8,
            padding: "9px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Aplicar alterações
        </button>
      </div>
    </div>
  );
}
