import { useState, useEffect, useRef, useCallback } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Row } from "../components/ui";
import { useBreakpoint } from "../hooks/useBreakpoint";

// ─── Tipos de gatilho do nó Início ──────────────────────────────────────────
export const GATILHO_TIPOS = [
  {
    id: "mensagem_recebida",
    label: "Por Mensagem Recebida",
    ico: "💬",
    desc: "Inicia o fluxo em qualquer mensagem recebida do contato.",
    cor: "#2563eb",
  },
  {
    id: "palavra_chave",
    label: "Por palavra chave na mensagem",
    ico: "🔑",
    desc: "Inicia quando a mensagem contém uma palavra-chave específica.",
    cor: "#7c3aed",
  },
  {
    id: "primeira_mensagem_dia",
    label: "Primeira mensagem do cliente no dia",
    ico: "📅",
    desc: "Dispara apenas na primeira mensagem do contato a cada dia.",
    cor: "#ca8a04",
  },
  {
    id: "primeira_mensagem",
    label: "Primeira mensagem do cliente",
    ico: "👤",
    desc: "Dispara somente quando é um contato novo (primeira vez).",
    cor: "#16a34a",
  },
];

// ─── Tipos de nó ─────────────────────────────────────────────────────────────
const NODE_TYPES = {
  inicio:         { label: "Início",           cor: "#16a34a", icone: "▶",  desc: "Ponto de entrada do fluxo"                    },
  mensagem:       { label: "Mensagem",         cor: "#2563eb", icone: "💬", desc: "Envia uma mensagem de texto"                  },
  opcoes:         { label: "Menu de opções",   cor: "#ca8a04", icone: "📋", desc: "Apresenta opções numeradas"                   },
  condicao:       { label: "Condição",         cor: "#7c3aed", icone: "⟐",  desc: "Bifurca o fluxo por regra"                   },
  transferir:     { label: "Transferir",       cor: "#b8845a", icone: "⇄",  desc: "Transfere para atendente"                     },
  encerrar:       { label: "Encerrar",         cor: "#dc2626", icone: "⊗",  desc: "Encerra o fluxo"                              },
  aguardar:       { label: "Aguardar input",   cor: "#0891b2", icone: "⏳", desc: "Aguarda resposta do usuário"                  },
  imagem:         { label: "Enviar Imagem",    cor: "#0284c7", icone: "🖼",  desc: "Envia imagem com legenda opcional"            },
  video:          { label: "Enviar Vídeo",     cor: "#7c3aed", icone: "🎬", desc: "Envia vídeo com legenda opcional"             },
  audio:          { label: "Enviar Áudio",     cor: "#16a34a", icone: "🎵", desc: "Envia arquivo de áudio"                       },
  documento:      { label: "Enviar Documento", cor: "#ca8a04", icone: "📄", desc: "Envia documento/arquivo"                      },
  respostas:      { label: "Respostas",        cor: "#2563eb", icone: "🔘", desc: "Botões de resposta rápida (até 3)"            },
  lista:          { label: "Enviar Lista",     cor: "#059669", icone: "☰",  desc: "Menu de lista interativo WhatsApp"            },
  controle_fluxo: { label: "Controle de Fluxo",cor: "#dc2626", icone: "⇄",  desc: "Reinicia ou encerra o fluxo"                 },
};

// ─── Condição: tipos disponíveis ─────────────────────────────────────────────
const CONDICAO_TIPOS = [
  { id: "contem_palavra",       label: "Contém palavra-chave" },
  { id: "igual",                label: "Mensagem igual a" },
  { id: "numero_opcao",         label: "Respondeu opção nº" },
  { id: "primeira_mensagem",    label: "Primeira mensagem do cliente" },
  { id: "primeira_mensagem_dia",label: "Primeira mensagem do dia" },
];

const NODE_W = 210;
const NODE_H = 90; // approximate height for connection calc

const VAZIO_FLUXO = { nome: "", descricao: "", usuario_id: null };

// ─── Helpers ─────────────────────────────────────────────────────────────────
const btn = (bg = L.surface, color = L.t2, extra = {}) => ({
  background: bg, color, border: `1px solid ${L.line}`, borderRadius: 8,
  padding: "7px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  fontWeight: 500, transition: "all .12s", outline: "none", ...extra,
});

function labelS(text) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: L.t3, textTransform: "uppercase",
      letterSpacing: "1.2px", marginBottom: 5, fontFamily: "'JetBrains Mono',monospace" }}>
      {text}
    </div>
  );
}

function FieldInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {labelS(label)}
      <input type={type} value={value || ""} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", border: `1.5px solid ${L.line}`, borderRadius: 8,
          padding: "7px 10px", fontSize: 12, outline: "none", fontFamily: "inherit",
          boxSizing: "border-box", background: L.surface, color: L.t1,
          transition: "border-color .12s" }}
        onFocus={e => e.target.style.borderColor = "#111827"}
        onBlur={e => e.target.style.borderColor = L.line}
      />
    </div>
  );
}

function FieldTextarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {labelS(label)}
      <textarea value={value || ""} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={rows}
        style={{ width: "100%", border: `1.5px solid ${L.line}`, borderRadius: 8,
          padding: "7px 10px", fontSize: 12, outline: "none", fontFamily: "inherit",
          resize: "vertical", boxSizing: "border-box", background: L.surface, color: L.t1,
          display: "block", transition: "border-color .12s" }}
        onFocus={e => e.target.style.borderColor = "#111827"}
        onBlur={e => e.target.style.borderColor = L.line}
      />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {labelS(label)}
      <select value={value || ""} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", border: `1.5px solid ${L.line}`, borderRadius: 8,
          padding: "7px 10px", fontSize: 12, outline: "none", fontFamily: "inherit",
          boxSizing: "border-box", background: L.surface, color: L.t1, cursor: "pointer" }}>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.ico ? `${o.ico} ${o.label}` : o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── TriggerSelectorModal ────────────────────────────────────────────────────
function TriggerSelectorModal({ no, onSave, onClose }) {
  const [selected, setSelected] = useState(no.gatilho_tipo || "mensagem_recebida");
  const [palavras, setPalavras] = useState(no.gatilho_palavras || "");
  const [intervalo, setIntervalo] = useState(no.intervalo_reativacao || 0);

  const handleSave = () => {
    onSave({ ...no, gatilho_tipo: selected, gatilho_palavras: palavras, intervalo_reativacao: Number(intervalo) });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: L.white, borderRadius: 16, width: 520, maxWidth: "calc(100vw - 32px)",
          boxShadow: "0 20px 60px rgba(0,0,0,.22)", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${L.line}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: L.t1, fontFamily: "'Outfit',sans-serif" }}>
              ▶ Configurar Acionamento
            </div>
            <div style={{ fontSize: 12, color: L.t3, marginTop: 3 }}>
              Quando este fluxo deve ser iniciado?
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: L.t3, fontSize: 20, lineHeight: 1, padding: "2px 4px",
          }}>×</button>
        </div>

        {/* Cards de seleção */}
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          {GATILHO_TIPOS.map(g => {
            const on = selected === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setSelected(g.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                  textAlign: "left", fontFamily: "inherit",
                  background: on ? g.cor + "0e" : L.surface,
                  border: `2px solid ${on ? g.cor : L.line}`,
                  transition: "all .12s", outline: "none",
                }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.borderColor = g.cor + "55"; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.borderColor = L.line; }}
              >
                {/* Ícone */}
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: on ? g.cor + "18" : L.white,
                  border: `1px solid ${on ? g.cor + "33" : L.line}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, transition: "all .12s",
                }}>
                  {g.ico}
                </div>

                {/* Texto */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: on ? 700 : 500,
                    color: on ? g.cor : L.t1, marginBottom: 2,
                  }}>
                    {g.label}
                  </div>
                  <div style={{ fontSize: 11.5, color: L.t3, lineHeight: 1.45 }}>
                    {g.desc}
                  </div>
                </div>

                {/* Radio */}
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${on ? g.cor : L.line}`,
                  background: on ? g.cor : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all .12s",
                }}>
                  {on && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
                </div>
              </button>
            );
          })}

          {/* Campo de palavras-chave (aparece só quando palavra_chave selecionado) */}
          {selected === "palavra_chave" && (
            <div style={{
              padding: "12px 14px", background: "#7c3aed0a",
              border: "1.5px solid #7c3aed33", borderRadius: 9, marginTop: 2,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase",
                letterSpacing: "1px", marginBottom: 7, fontFamily: "'JetBrains Mono',monospace",
              }}>
                Palavras-chave (separadas por vírgula)
              </div>
              <input
                value={palavras}
                onChange={e => setPalavras(e.target.value)}
                placeholder="Ex: oi, olá, bom dia, quero saber"
                autoFocus
                style={{
                  width: "100%", border: "1.5px solid #7c3aed44", borderRadius: 8,
                  padding: "8px 11px", fontSize: 12.5, fontFamily: "inherit",
                  outline: "none", color: L.t1, background: L.white,
                  transition: "border-color .12s", boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = "#7c3aed"}
                onBlur={e => e.target.style.borderColor = "#7c3aed44"}
              />
            </div>
          )}

          {/* Intervalo de reativação */}
          <div style={{ marginTop: 4, padding: "12px 14px", background: L.blueBg, border: `1.5px solid ${L.blueA}`, borderRadius: 9 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: L.blue, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 7, fontFamily: "'JetBrains Mono',monospace" }}>
              ⏱ Intervalo de Reativação
            </div>
            <div style={{ fontSize: 11.5, color: L.t3, marginBottom: 8, lineHeight: 1.4 }}>
              Tempo mínimo (em minutos) antes do fluxo ser acionado novamente para o mesmo contato.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                value={intervalo}
                onChange={e => setIntervalo(e.target.value)}
                min="0"
                placeholder="0"
                style={{ width: 80, border: `1.5px solid ${L.blueA}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, outline: "none", fontFamily: "inherit", background: L.surface, color: L.t1 }}
              />
              <span style={{ fontSize: 12, color: L.t3 }}>minutos (0 = sempre reativar)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px 20px",
          borderTop: `1px solid ${L.line}`,
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>
          <button onClick={onClose} style={btn(L.surface, L.t2)}>Cancelar</button>
          <button
            onClick={handleSave}
            style={{
              padding: "9px 22px", borderRadius: 9, background: L.accent, color: "white",
              border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit", transition: "opacity .12s",
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = ".85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            Confirmar acionamento
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NodeCard ────────────────────────────────────────────────────────────────
function NodeCard({ no, selected, connecting, onClick, onEdit, onDelete, onConnectStart, onTrigger }) {
  const tipo = NODE_TYPES[no.tipo] || NODE_TYPES.mensagem;
  const isConnectingFrom = connecting?.id === no.id;
  const border = isConnectingFrom
    ? `2px dashed ${tipo.cor}`
    : selected
      ? `2px solid ${tipo.cor}`
      : `1.5px solid ${L.line}`;
  const shadow = selected || isConnectingFrom
    ? `0 0 0 3px ${tipo.cor}22, 0 4px 16px rgba(0,0,0,.1)`
    : "0 2px 8px rgba(0,0,0,.07)";

  // Preview content
  let preview = "";
  if (no.tipo === "inicio") {
    const g = GATILHO_TIPOS.find(t => t.id === (no.gatilho_tipo || "mensagem_recebida"));
    preview = g ? `${g.ico} ${g.label}` : "💬 Por Mensagem Recebida";
  } else if (no.tipo === "imagem") {
    preview = "🖼 " + (no.media_url ? no.media_url.slice(-30) : "URL não configurada");
  } else if (no.tipo === "video") {
    preview = "🎬 " + (no.media_url ? "Vídeo configurado" : "URL não configurada");
  } else if (no.tipo === "audio") {
    preview = "🎵 " + (no.media_url ? "Áudio configurado" : "URL não configurada");
  } else if (no.tipo === "documento") {
    preview = "📄 " + (no.media_url ? "Documento configurado" : "URL não configurada");
  } else if (no.tipo === "respostas") {
    const count = [no.botao_1, no.botao_2, no.botao_3].filter(Boolean).length;
    preview = count > 0 ? `${count} botão${count !== 1 ? "ões" : ""} configurado${count !== 1 ? "s" : ""}` : "Botões não configurados";
  } else if (no.tipo === "lista") {
    preview = no.lista_titulo_botao || "Lista não configurada";
  } else if (no.tipo === "controle_fluxo") {
    preview = no.controle_tipo === "reiniciar" ? "↺ Reinicia o fluxo" : "⊗ Encerra o fluxo";
  } else if (no.mensagem) {
    preview = no.mensagem.length > 55 ? no.mensagem.slice(0, 55) + "…" : no.mensagem;
  } else if (no.tipo === "opcoes" && no.opcoes?.length) {
    preview = `${no.opcoes.filter(Boolean).length} opções`;
  } else if (no.tipo === "condicao") {
    const ct = CONDICAO_TIPOS.find(t => t.id === (no.condicao_tipo || "contem_palavra"));
    preview = ct ? ct.label : "Condição";
  } else if (no.tipo === "transferir") {
    preview = "→ Transfere para atendente";
  } else if (no.tipo === "encerrar") {
    preview = "✕ Encerra o fluxo";
  } else if (no.tipo === "aguardar") {
    preview = no.variavel ? `Salva em: {${no.variavel}}` : "Aguarda resposta...";
  }

  // Nó Início: mostra badge do gatilho com cor própria
  const gatilhoInfo = no.tipo === "inicio"
    ? GATILHO_TIPOS.find(g => g.id === (no.gatilho_tipo || "mensagem_recebida"))
    : null;

  return (
    <div
      onClick={() => onClick(no)}
      style={{
        position: "absolute", left: no.x, top: no.y, width: NODE_W,
        background: L.white, borderRadius: 10, border, boxShadow: shadow,
        cursor: "default", userSelect: "none", transition: "border-color .15s, box-shadow .15s",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "8px 11px", borderBottom: `1px solid ${L.lineSoft}`,
        display: "flex", alignItems: "center", gap: 7,
        background: tipo.cor + "12", borderRadius: "8px 8px 0 0",
      }}>
        <span style={{ fontSize: 14, lineHeight: 1 }}>{tipo.icone}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: tipo.cor, textTransform: "uppercase",
            letterSpacing: ".8px", fontFamily: "'JetBrains Mono',monospace" }}>
            {tipo.label}
          </div>
          <div style={{ fontSize: 11.5, color: L.t1, fontWeight: 500, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
            {no.nome || "Sem nome"}
          </div>
        </div>
      </div>

      {/* Body — nó Início: badge do gatilho + botão de configurar */}
      {no.tipo === "inicio" ? (
        <div style={{ padding: "8px 11px", borderBottom: `1px solid ${L.lineSoft}` }}>
          {gatilhoInfo ? (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: gatilhoInfo.cor + "12",
              border: `1px solid ${gatilhoInfo.cor}33`,
              borderRadius: 6, padding: "3px 9px", fontSize: 10.5,
              color: gatilhoInfo.cor, fontWeight: 600,
            }}>
              <span>{gatilhoInfo.ico}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
                {gatilhoInfo.label}
              </span>
            </div>
          ) : null}
          <div
            onClick={e => { e.stopPropagation(); onTrigger ? onTrigger(no) : onEdit(no); }}
            style={{
              marginTop: 6, fontSize: 10, color: L.t3, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              transition: "color .1s",
            }}
            onMouseEnter={e => e.currentTarget.style.color = tipo.cor}
            onMouseLeave={e => e.currentTarget.style.color = L.t3}
          >
            <span>⚙</span> Clique para configurar acionamento
          </div>
        </div>
      ) : preview ? (
        <div style={{ padding: "7px 11px 6px", fontSize: 11, color: L.t3,
          lineHeight: 1.45, borderBottom: `1px solid ${L.lineSoft}` }}>
          {preview}
        </div>
      ) : null}

      {/* Actions */}
      <div style={{ padding: "5px 8px", display: "flex", gap: 3, justifyContent: "flex-end" }}>
        <NodeBtn color={L.t3} title="Editar" onClick={e => { e.stopPropagation(); onEdit(no); }}>✎</NodeBtn>
        <NodeBtn color={tipo.cor} title="Conectar" onClick={e => { e.stopPropagation(); onConnectStart(no); }}>→</NodeBtn>
        {no.tipo !== "inicio" && (
          <NodeBtn color={L.red} title="Remover" onClick={e => { e.stopPropagation(); onDelete(no.id); }}>✕</NodeBtn>
        )}
      </div>
    </div>
  );
}

function NodeBtn({ color, title, onClick, children }) {
  return (
    <button title={title} onClick={onClick}
      style={{ background: "none", border: "none", cursor: "pointer", color,
        fontSize: 12, padding: "2px 5px", borderRadius: 5, transition: "background .1s" }}
      onMouseEnter={e => e.currentTarget.style.background = color + "18"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}
    >
      {children}
    </button>
  );
}

// ─── Node Edit Panel ──────────────────────────────────────────────────────────
function NodeEditPanel({ no, onSave, onClose }) {
  const [form, setForm] = useState({ ...no });
  const tipo = NODE_TYPES[form.tipo] || NODE_TYPES.mensagem;
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div style={{ width: 290, minWidth: 290, borderLeft: `1px solid ${L.line}`,
      background: L.white, display: "flex", flexDirection: "column", boxShadow: "-2px 0 8px rgba(0,0,0,.04)" }}>

      {/* Panel header */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${L.line}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: tipo.cor + "0d" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{tipo.icone}</span>
          <div style={{ fontSize: 12, fontWeight: 700, color: tipo.cor }}>{tipo.label}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer",
          color: L.t3, fontSize: 18, lineHeight: 1, padding: "0 2px" }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {/* Nome */}
        <FieldInput label="Nome do nó" value={form.nome} onChange={v => set("nome", v)} placeholder="Ex: Abordagem inicial" />

        {/* ── INÍCIO: tipo de gatilho ── */}
        {form.tipo === "inicio" && (
          <>
            <FieldSelect
              label="Tipo de acionamento"
              value={form.gatilho_tipo || "mensagem_recebida"}
              onChange={v => set("gatilho_tipo", v)}
              options={GATILHO_TIPOS}
            />
            {(form.gatilho_tipo || "mensagem_recebida") === "palavra_chave" && (
              <FieldInput
                label="Palavra(s)-chave (separadas por vírgula)"
                value={form.gatilho_palavras}
                onChange={v => set("gatilho_palavras", v)}
                placeholder="Ex: oi, olá, bom dia"
              />
            )}
            <FieldTextarea
              label="Mensagem de abertura (opcional)"
              value={form.mensagem}
              onChange={v => set("mensagem", v)}
              placeholder="Mensagem enviada ao iniciar o fluxo..."
            />
          </>
        )}

        {/* ── MENSAGEM ── */}
        {form.tipo === "mensagem" && (
          <FieldTextarea
            label={'Mensagem  · use {nome} para o nome do contato'}
            value={form.mensagem}
            onChange={v => set("mensagem", v)}
            placeholder="Digite a mensagem que será enviada..."
            rows={4}
          />
        )}

        {/* ── MENU DE OPÇÕES ── */}
        {form.tipo === "opcoes" && (
          <>
            <FieldTextarea
              label="Texto introdutório"
              value={form.mensagem}
              onChange={v => set("mensagem", v)}
              placeholder="Ex: Escolha uma opção abaixo:"
              rows={2}
            />
            <div style={{ marginBottom: 12 }}>
              {labelS("Opções (uma por linha)")}
              <textarea
                value={(form.opcoes || []).join("\n")}
                onChange={e => set("opcoes", e.target.value.split("\n"))}
                rows={5}
                placeholder={"Vendas\nSuporte\nFinanceiro\nFalar com atendente"}
                style={{ width: "100%", border: `1.5px solid ${L.line}`, borderRadius: 8,
                  padding: "7px 10px", fontSize: 12, outline: "none", fontFamily: "inherit",
                  resize: "vertical", boxSizing: "border-box", background: L.surface, color: L.t1 }}
                onFocus={e => e.target.style.borderColor = "#111827"}
                onBlur={e => e.target.style.borderColor = L.line}
              />
              <div style={{ fontSize: 10, color: L.t4, marginTop: 4 }}>
                Cada linha = uma opção. O cliente digita o número correspondente.
              </div>
            </div>
          </>
        )}

        {/* ── CONDIÇÃO ── */}
        {form.tipo === "condicao" && (
          <>
            <FieldSelect
              label="Tipo de condição"
              value={form.condicao_tipo || "contem_palavra"}
              onChange={v => set("condicao_tipo", v)}
              options={CONDICAO_TIPOS}
            />
            {["contem_palavra", "igual"].includes(form.condicao_tipo || "contem_palavra") && (
              <FieldInput
                label={form.condicao_tipo === "igual" ? "Mensagem exata" : "Palavras-chave (separadas por vírgula)"}
                value={form.gatilhos}
                onChange={v => set("gatilhos", v)}
                placeholder={form.condicao_tipo === "igual" ? "sim" : "sim, confirmar, ok"}
              />
            )}
            {(form.condicao_tipo || "") === "numero_opcao" && (
              <FieldInput
                label="Número da opção"
                value={form.numero_opcao}
                onChange={v => set("numero_opcao", v)}
                placeholder="Ex: 1"
                type="number"
              />
            )}
            <div style={{ padding: "10px 12px", background: "#7c3aed0d", borderRadius: 8,
              border: "1px solid #7c3aed22", fontSize: 11, color: L.t3, lineHeight: 1.55 }}>
              <b style={{ color: "#7c3aed" }}>Sim</b> → conecte ao próximo nó se condição for verdadeira<br/>
              <b style={{ color: L.red }}>Não</b> → conecte ao nó alternativo
            </div>
          </>
        )}

        {/* ── AGUARDAR INPUT ── */}
        {form.tipo === "aguardar" && (
          <>
            <FieldTextarea
              label="Mensagem (pergunta ao usuário)"
              value={form.mensagem}
              onChange={v => set("mensagem", v)}
              placeholder="Ex: Qual é o seu nome?"
              rows={3}
            />
            <FieldInput
              label="Salvar resposta como variável"
              value={form.variavel}
              onChange={v => set("variavel", v)}
              placeholder="Ex: nome_cliente"
            />
            <div style={{ fontSize: 10, color: L.t4, marginTop: -8, marginBottom: 12 }}>
              Use {"{"}{form.variavel || "variavel"}{"}"} em mensagens seguintes
            </div>
          </>
        )}

        {/* ── TRANSFERIR ── */}
        {form.tipo === "transferir" && (
          <FieldTextarea
            label="Mensagem antes de transferir"
            value={form.mensagem}
            onChange={v => set("mensagem", v)}
            placeholder="Ex: Aguarde, vou transferir para um atendente..."
            rows={3}
          />
        )}

        {/* ── ENCERRAR ── */}
        {form.tipo === "encerrar" && (
          <FieldTextarea
            label="Mensagem de encerramento (opcional)"
            value={form.mensagem}
            onChange={v => set("mensagem", v)}
            placeholder="Ex: Obrigado pelo contato! Até logo. 👋"
            rows={3}
          />
        )}

        {/* ── IMAGEM ── */}
        {form.tipo === "imagem" && (
          <>
            <FieldInput label="URL da mídia" value={form.media_url} onChange={v => set("media_url", v)} placeholder="https://exemplo.com/imagem.jpg" />
            <FieldInput label="Legenda (opcional)" value={form.mensagem} onChange={v => set("mensagem", v)} placeholder="Texto da legenda..." />
          </>
        )}

        {/* ── VÍDEO ── */}
        {form.tipo === "video" && (
          <>
            <FieldInput label="URL da mídia" value={form.media_url} onChange={v => set("media_url", v)} placeholder="https://exemplo.com/video.mp4" />
            <FieldInput label="Legenda (opcional)" value={form.mensagem} onChange={v => set("mensagem", v)} placeholder="Texto da legenda..." />
          </>
        )}

        {/* ── ÁUDIO ── */}
        {form.tipo === "audio" && (
          <FieldInput label="URL do áudio" value={form.media_url} onChange={v => set("media_url", v)} placeholder="https://exemplo.com/audio.mp3" />
        )}

        {/* ── DOCUMENTO ── */}
        {form.tipo === "documento" && (
          <>
            <FieldInput label="URL da mídia" value={form.media_url} onChange={v => set("media_url", v)} placeholder="https://exemplo.com/documento.pdf" />
            <FieldInput label="Legenda (opcional)" value={form.mensagem} onChange={v => set("mensagem", v)} placeholder="Texto da legenda..." />
          </>
        )}

        {/* ── RESPOSTAS ── */}
        {form.tipo === "respostas" && (
          <>
            <FieldTextarea label="Texto da mensagem" value={form.mensagem} onChange={v => set("mensagem", v)} placeholder="Texto exibido antes dos botões..." rows={3} />
            <FieldInput label="Botão 1" value={form.botao_1} onChange={v => set("botao_1", v)} placeholder="Texto do botão 1" />
            <FieldInput label="Botão 2 (opcional)" value={form.botao_2} onChange={v => set("botao_2", v)} placeholder="Texto do botão 2" />
            <FieldInput label="Botão 3 (opcional)" value={form.botao_3} onChange={v => set("botao_3", v)} placeholder="Texto do botão 3" />
          </>
        )}

        {/* ── LISTA ── */}
        {form.tipo === "lista" && (
          <>
            <FieldTextarea label="Texto introdutório" value={form.mensagem} onChange={v => set("mensagem", v)} placeholder="Ex: Escolha uma opção da lista:" rows={2} />
            <FieldInput label="Texto do botão" value={form.lista_titulo_botao} onChange={v => set("lista_titulo_botao", v)} placeholder="Ver opções" />
            <FieldTextarea label="Itens da lista (um por linha)" value={form.lista_itens} onChange={v => set("lista_itens", v)} placeholder={"Opção 1\nOpção 2\nOpção 3"} rows={5} />
          </>
        )}

        {/* ── CONTROLE DE FLUXO ── */}
        {form.tipo === "controle_fluxo" && (
          <>
            <FieldSelect
              label="Ação de controle"
              value={form.controle_tipo || "reiniciar"}
              onChange={v => set("controle_tipo", v)}
              options={[{ id: "reiniciar", label: "Reiniciar fluxo" }, { id: "encerrar", label: "Encerrar fluxo" }]}
            />
            <FieldTextarea label="Mensagem antes de controlar (opcional)" value={form.mensagem} onChange={v => set("mensagem", v)} placeholder="Ex: Reiniciando o atendimento..." rows={3} />
          </>
        )}
      </div>

      <div style={{ padding: "12px 16px", borderTop: `1px solid ${L.line}` }}>
        <button onClick={() => onSave(form)}
          style={{ width: "100%", background: L.accent, color: "white", border: "none", borderRadius: 8,
            padding: "10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            transition: "opacity .12s" }}
          onMouseEnter={e => e.currentTarget.style.opacity = ".85"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
          Aplicar alterações
        </button>
      </div>
    </div>
  );
}

// ─── Fluxo List (home screen) ─────────────────────────────────────────────────
function FluxoCard({ f, emUso, onOpen, onUsar, onToggleAtivo, onDeletar, vendedores }) {
  const vendNome = f.usuario_id ? (vendedores.find(v => v.id === f.usuario_id)?.nome || "Vendedor") : null;
  return (
    <div style={{ background: L.white, borderRadius: 12,
      border: `2px solid ${emUso ? L.accent : L.line}`,
      padding: 18, transition: "all .15s",
      boxShadow: emUso ? `0 4px 20px ${L.accent}22` : "0 1px 4px rgba(0,0,0,.04)" }}>
      <Row between mb={6}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: L.t1,
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>
          {f.nome}
        </span>
        <Row gap={5} style={{ flexShrink: 0 }}>
          {emUso && (
            <span style={{ fontSize: 10, background: L.accent, color: "white",
              padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>🤖 Em uso</span>
          )}
          <span style={{ fontSize: 10,
            background: f.ativo ? L.greenBg : L.surface,
            color: f.ativo ? L.green : L.t4,
            padding: "2px 8px", borderRadius: 10, fontWeight: 600,
            border: `1px solid ${f.ativo ? L.green+"33" : L.line}` }}>
            {f.ativo ? "● Ativo" : "Rascunho"}
          </span>
        </Row>
      </Row>

      {vendNome && (
        <div style={{ fontSize: 10.5, color: L.teal, marginBottom: 6,
          display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: L.tealBg,
            border: `1px solid ${L.tealA2}`, display: "inline-flex", alignItems: "center",
            justifyContent: "center", fontSize: 8 }}>👤</span>
          {vendNome}
        </div>
      )}

      {f.descricao && (
        <div style={{ fontSize: 11.5, color: L.t3, marginBottom: 8, lineHeight: 1.4 }}>{f.descricao}</div>
      )}
      <div style={{ fontSize: 10, color: L.t4, marginBottom: 14, fontFamily: "'JetBrains Mono',monospace" }}>
        {new Date(f.created_at).toLocaleDateString("pt-BR")}
        {f.nos?.length ? ` · ${f.nos.length} nós` : ""}
      </div>
      <Row gap={6}>
        <button onClick={() => onOpen(f)}
          style={btn(L.accent, "white", { flex: 1, fontSize: 11.5, fontWeight: 600 })}>
          ✎ Editar
        </button>
        {!f.usuario_id && (
          <button onClick={() => onUsar(f)} title={emUso ? "Remover do chatbot" : "Usar no chatbot"}
            style={btn(emUso ? L.greenBg : L.surface, emUso ? L.green : L.t3,
              { fontSize: 11, padding: "7px 11px", border: `1px solid ${emUso ? L.green+"55" : L.line}` })}>
            {emUso ? "🤖 ✓" : "🤖"}
          </button>
        )}
        <button onClick={() => onToggleAtivo(f)}
          style={btn(f.ativo ? L.yellowBg : L.greenBg, f.ativo ? L.yellow : L.green,
            { fontSize: 11, padding: "7px 11px" })}>
          {f.ativo ? "⏸" : "▶"}
        </button>
        <button onClick={() => onDeletar(f.id)}
          style={btn(L.redBg, L.red, { fontSize: 11, padding: "7px 11px" })}>✕</button>
      </Row>
    </div>
  );
}

function FluxoList({ fluxos, fluxoAtivoId, vendedores, onOpen, onUsar, onToggleAtivo, onDeletar, onNovo }) {
  const [tab, setTab] = useState("empresa"); // "empresa" | "vendedor"

  const empresa  = fluxos.filter(f => !f.usuario_id);
  const vendedor = fluxos.filter(f => !!f.usuario_id);
  const lista    = tab === "empresa" ? empresa : vendedor;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <Row between mb={20}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: L.t1, fontFamily: "'Outfit',sans-serif" }}>
            Fluxo Visual
          </div>
          <div style={{ fontSize: 12, color: L.t3, marginTop: 3 }}>
            Crie fluxos de atendimento automático com arrastar e soltar
          </div>
        </div>
        <button onClick={() => onNovo(tab)} style={btn(L.accent, "white", { fontWeight: 600 })}>+ Novo fluxo</button>
      </Row>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, background: L.surface,
        borderRadius: 10, padding: 4, border: `1px solid ${L.line}`, width: "fit-content" }}>
        {[
          { id: "empresa",  label: "🏢 Empresa",           count: empresa.length  },
          { id: "vendedor", label: "👤 Por Vendedor",       count: vendedor.length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ ...btn(tab === t.id ? L.white : "transparent",
              tab === t.id ? L.t1 : L.t3,
              { border: tab === t.id ? `1px solid ${L.line}` : "1px solid transparent",
                borderRadius: 8, padding: "6px 16px", fontWeight: tab === t.id ? 600 : 400,
                boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                display: "flex", alignItems: "center", gap: 7 }) }}>
            {t.label}
            <span style={{ fontSize: 10, background: tab === t.id ? L.tealBg : L.line,
              color: tab === t.id ? L.teal : L.t4, borderRadius: 10,
              padding: "1px 7px", fontWeight: 700 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Descrição da aba */}
      <div style={{ fontSize: 12, marginBottom: 16, padding: "8px 12px",
        background: tab === "empresa" ? L.yellowBg : L.tealBg, borderRadius: 8,
        border: `1px solid ${tab === "empresa" ? L.yellowA : L.tealA2}`,
        color: tab === "empresa" ? L.yellow : L.teal }}>
        {tab === "empresa"
          ? "🏢 Fluxos gerais da empresa — usados pelo chatbot automático para todos os contatos"
          : "👤 Fluxos personalizados por vendedor — cada vendedor vê e usa o seu próprio fluxo no chat"}
      </div>

      {lista.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: L.t4,
          background: L.white, borderRadius: 14, border: `1px dashed ${L.line}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>
            {tab === "empresa" ? "🤖" : "👤"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: L.t2, marginBottom: 6 }}>
            {tab === "empresa" ? "Nenhum fluxo da empresa" : "Nenhum fluxo por vendedor"}
          </div>
          <div style={{ fontSize: 12, marginBottom: 20, color: L.t3, maxWidth: 340, margin: "0 auto 20px" }}>
            {tab === "empresa"
              ? "Crie fluxos de atendimento automático: menus, mensagens, transferências e mais."
              : "Crie fluxos personalizados para vendedores específicos. Eles aparecerão na aba Script durante o atendimento no WhatsApp."}
          </div>
          <button onClick={() => onNovo(tab)} style={btn(L.accent, "white", { fontWeight: 600 })}>
            + Criar primeiro fluxo
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
          {lista.map(f => (
            <FluxoCard key={f.id} f={f} emUso={fluxoAtivoId === f.id}
              vendedores={vendedores}
              onOpen={onOpen} onUsar={onUsar}
              onToggleAtivo={onToggleAtivo} onDeletar={onDeletar} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PageChatbotBuilder({ user }) {
  const [fluxos,       setFluxos]       = useState([]);
  const [vendedores,   setVendedores]   = useState([]);
  const [activeFluxo,  setActiveFluxo]  = useState(null);
  const [nos,          setNos]          = useState([]);
  const [conexoes,     setConexoes]     = useState([]);
  const [selectedNo,   setSelectedNo]   = useState(null);
  const [editingNo,    setEditingNo]    = useState(null);
  const [triggerModal, setTriggerModal] = useState(null);  // nó Início sendo configurado
  const [connecting,   setConnecting]   = useState(null);  // nó origem da conexão
  const [saving,       setSaving]       = useState(false);
  const [novaModal,    setNovaModal]    = useState(false);
  const [novaForm,     setNovaForm]     = useState(VAZIO_FLUXO);
  const [fluxoAtivoId, setFluxoAtivoId] = useState(null);
  const [connLabel,    setConnLabel]    = useState("");     // label da conexão em criação
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [toast,        setToast]        = useState(null);  // { msg, ok }

  const { isMobile } = useBreakpoint();

  // Drag state (ref para não re-render no mousemove)
  const draggingRef    = useRef(null);
  const dragOffRef     = useRef({ x: 0, y: 0 });
  const canvasRef      = useRef(null);
  const justLoadedRef  = useRef(false); // suprime unsavedChanges após carregamento de fluxo

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  // ── Load ──
  useEffect(() => {
    if (!user?.empresa_id) return;
    supabase.from("chatbot_fluxos")
      .select("id, nome, descricao, ativo, usuario_id, created_at, nos")
      .eq("empresa_id", user.empresa_id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setFluxos(data || []));
    supabase.from("chatbot_config")
      .select("fluxo_ativo_id").eq("empresa_id", user.empresa_id).maybeSingle()
      .then(({ data }) => { if (data) setFluxoAtivoId(data.fluxo_ativo_id); });
    supabase.from("usuarios")
      .select("id, nome, cargo").eq("empresa_id", user.empresa_id).eq("ativo", true).order("nome")
      .then(({ data }) => setVendedores(data || []));
  }, [user?.empresa_id]);

  // ── Unsaved changes tracker (justLoadedRef evita marcar dirty ao carregar fluxo) ──
  useEffect(() => {
    if (!activeFluxo) return;
    if (justLoadedRef.current) { justLoadedRef.current = false; return; }
    setUnsavedChanges(true);
  }, [nos, conexoes]);

  // ── Abrir fluxo ──
  const openFluxo = async (f) => {
    const { data, error } = await supabase.from("chatbot_fluxos")
      .select("nos, conexoes").eq("id", f.id).single();
    if (error) {
      showToast("Erro ao carregar fluxo: " + (error.message || "tente novamente."), false);
      return;
    }
    const initNos = data?.nos?.length
      ? data.nos
      : [{ id: "inicio", tipo: "inicio", nome: "Início", gatilho_tipo: "mensagem_recebida",
           mensagem: "", x: 60, y: 80 }];
    justLoadedRef.current = true; // suprime unsavedChanges no próximo efeito
    setNos(initNos);
    setConexoes(data?.conexoes || []);
    setActiveFluxo(f);
    setSelectedNo(null);
    setEditingNo(null);
    setConnecting(null);
    setUnsavedChanges(false);
  };

  // ── Salvar fluxo ──
  const saveFluxo = async () => {
    if (!activeFluxo) return;
    setSaving(true);
    const { error } = await supabase.from("chatbot_fluxos")
      .update({ nos, conexoes, updated_at: new Date().toISOString() })
      .eq("id", activeFluxo.id);
    setSaving(false);
    if (error) {
      showToast("Erro ao salvar: " + (error.message || "tente novamente."), false);
      return;
    }
    setUnsavedChanges(false);
    showToast("Fluxo salvo com sucesso!");
  };

  // ── Criar fluxo ──
  const criarFluxo = async () => {
    if (!novaForm.nome.trim()) return;
    const initNo = { id: "inicio", tipo: "inicio", nome: "Início",
      gatilho_tipo: "mensagem_recebida", mensagem: "", x: 60, y: 80 };
    const { data, error } = await supabase.from("chatbot_fluxos").insert({
      empresa_id: user.empresa_id, nome: novaForm.nome.trim(),
      descricao: novaForm.descricao.trim(), ativo: false,
      usuario_id: novaForm.usuario_id || null,
      nos: [initNo], conexoes: [],
    }).select().single();
    if (error) {
      showToast("Erro ao criar fluxo: " + (error.message || "tente novamente."), false);
    } else if (data) {
      setFluxos(p => [data, ...p]);
      setNovaModal(false);
      setNovaForm(VAZIO_FLUXO);
      openFluxo(data);
    }
  };

  // ── Usar no chatbot ──
  const usarNoChatbot = async (f) => {
    const isJaAtivo = fluxoAtivoId === f.id;
    const novoId = isJaAtivo ? null : f.id;
    const { data: cfgExist } = await supabase.from("chatbot_config")
      .select("id").eq("empresa_id", user.empresa_id).maybeSingle();
    if (cfgExist) {
      await supabase.from("chatbot_config").update({ fluxo_ativo_id: novoId }).eq("id", cfgExist.id);
    } else {
      await supabase.from("chatbot_config").insert({
        empresa_id: user.empresa_id, ativo: true, fluxo_ativo_id: novoId,
        mensagem_boas_vindas: "Olá! Em que posso ajudar?",
        mensagem_fora_horario: "Retornaremos em breve!",
        dias_semana: [1,2,3,4,5], horario_inicio: "08:00",
        horario_fim: "18:00", transferir_palavra: "atendente",
      });
    }
    setFluxoAtivoId(novoId);
    if (!isJaAtivo) {
      await supabase.from("chatbot_fluxos").update({ ativo: true }).eq("id", f.id);
      // Deactivate all other company-level flows in DB
      await supabase.from("chatbot_fluxos")
        .update({ ativo: false })
        .eq("empresa_id", user.empresa_id)
        .is("usuario_id", null)
        .neq("id", f.id);
      // Only flip ativo on other company-level flows (usuario_id IS NULL), never touch vendor flows
      setFluxos(p => p.map(x => {
        if (x.id === f.id) return { ...x, ativo: true };
        if (!x.usuario_id) return { ...x, ativo: false }; // company flows: only one active at a time
        return x; // vendor flows: untouched
      }));
    }
  };

  const toggleAtivo = async (f) => {
    await supabase.from("chatbot_fluxos").update({ ativo: !f.ativo }).eq("id", f.id);
    setFluxos(p => p.map(x => x.id === f.id ? { ...x, ativo: !x.ativo } : x));
    if (activeFluxo?.id === f.id) setActiveFluxo(p => ({ ...p, ativo: !p.ativo }));
  };

  const deletarFluxo = async (id) => {
    if (!window.confirm("Remover este fluxo permanentemente?")) return;
    const { error } = await supabase.from("chatbot_fluxos").delete().eq("id", id);
    if (error) { showToast("Erro ao remover: " + error.message, false); return; }
    setFluxos(p => p.filter(x => x.id !== id));
    if (activeFluxo?.id === id) setActiveFluxo(null);
    showToast("Fluxo removido.");
  };

  // ── Nós ──
  const addNo = (tipo) => {
    const id = `no-${Date.now()}`;
    const extraProps = (() => {
      if (["imagem","video","audio","documento"].includes(tipo)) return { media_url: "", mensagem: "" };
      if (tipo === "respostas") return { mensagem: "", botao_1: "", botao_2: "", botao_3: "" };
      if (tipo === "lista") return { mensagem: "", lista_titulo_botao: "Ver opções", lista_itens: "" };
      if (tipo === "controle_fluxo") return { controle_tipo: "reiniciar", mensagem: "" };
      return {};
    })();
    setNos(p => [...p, {
      id, tipo, nome: NODE_TYPES[tipo]?.label || tipo,
      mensagem: "", x: 160 + Math.random() * 260, y: 100 + Math.random() * 200,
      opcoes: [], gatilhos: "", variavel: "",
      condicao_tipo: "contem_palavra",
      ...extraProps,
    }]);
  };

  const deleteNo = (id) => {
    setNos(p => p.filter(n => n.id !== id));
    setConexoes(p => p.filter(c => c.de !== id && c.para !== id));
    if (selectedNo?.id === id) setSelectedNo(null);
    if (editingNo?.id === id) setEditingNo(null);
  };

  const saveNo = (updated) => {
    setNos(p => p.map(n => n.id === updated.id ? updated : n));
    setEditingNo(null);
  };

  // ── Conexões ──
  const handleConnectStart = (noOrigem) => {
    if (connecting?.id === noOrigem.id) { setConnecting(null); return; }
    setConnecting(noOrigem);
    setConnLabel("");
  };

  const handleConnectTo = (noDestino) => {
    if (!connecting) return;
    if (connecting.id === noDestino.id) { setConnecting(null); return; }
    const jaExiste = conexoes.find(c => c.de === connecting.id && c.para === noDestino.id);
    if (!jaExiste) {
      // Para condição: perguntar se é Sim ou Não
      let label = connLabel || "";
      if (connecting.tipo === "condicao" && !label) {
        const existeSim = conexoes.find(c => c.de === connecting.id && c.label === "Sim");
        label = existeSim ? "Não" : "Sim";
      }
      setConexoes(p => [...p, { id: `con-${Date.now()}`, de: connecting.id, para: noDestino.id, label }]);
    }
    setConnecting(null);
    setConnLabel("");
  };

  const deleteConexao = (id) => setConexoes(p => p.filter(c => c.id !== id));

  // ── Drag ──
  const handleMouseDown = useCallback((e, noId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const no = nos.find(n => n.id === noId);
    if (!no) return;
    draggingRef.current = noId;
    dragOffRef.current = { x: e.clientX - rect.left - no.x, y: e.clientY - rect.top - no.y };
    e.preventDefault();
  }, [nos]);

  const handleMouseMove = useCallback((e) => {
    if (!draggingRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, e.clientX - rect.left - dragOffRef.current.x);
    const y = Math.max(0, e.clientY - rect.top - dragOffRef.current.y);
    setNos(p => p.map(n => n.id === draggingRef.current ? { ...n, x, y } : n));
  }, []);

  const handleMouseUp = useCallback(() => { draggingRef.current = null; }, []);

  // ── Touch drag ──
  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    const target = e.target.closest('[data-nodeid]');
    if (!target) return;
    const noId = target.dataset.nodeid;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const no = nos.find(n => n.id === noId);
    if (!no) return;
    draggingRef.current = noId;
    dragOffRef.current = { x: touch.clientX - rect.left - no.x, y: touch.clientY - rect.top - no.y };
  }, [nos]);

  const handleTouchMove = useCallback((e) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, touch.clientX - rect.left - dragOffRef.current.x);
    const y = Math.max(0, touch.clientY - rect.top - dragOffRef.current.y);
    setNos(p => p.map(n => n.id === draggingRef.current ? { ...n, x, y } : n));
  }, []);

  const handleTouchEnd = useCallback(() => { draggingRef.current = null; }, []);

  // ── Toast overlay (shared between list and editor views) ──
  const toastEl = toast && (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: toast.ok ? "#111827" : L.red, color: "white", borderRadius: 10,
      padding: "10px 20px", fontSize: 12.5, fontWeight: 600, zIndex: 9999,
      boxShadow: "0 4px 20px rgba(0,0,0,.25)", pointerEvents: "none",
      animation: "fadeIn .2s ease" }}>
      {toast.ok ? "✓ " : "⚠ "}{toast.msg}
    </div>
  );

  // ── LIST view ──
  if (!activeFluxo) {
    return (
      <>
        <FluxoList
          fluxos={fluxos}
          fluxoAtivoId={fluxoAtivoId}
          vendedores={vendedores}
          onOpen={openFluxo}
          onUsar={usarNoChatbot}
          onToggleAtivo={toggleAtivo}
          onDeletar={deletarFluxo}
          onNovo={(tab) => {
            setNovaForm({ ...VAZIO_FLUXO, usuario_id: null });
            setNovaModal(tab);
          }}
        />
        {novaModal && (
          <NovaFluxoModal
            form={novaForm}
            setForm={setNovaForm}
            vendedores={novaModal === "vendedor" ? vendedores : []}
            onSave={criarFluxo}
            onClose={() => { setNovaModal(false); setNovaForm(VAZIO_FLUXO); }}
          />
        )}
        {toastEl}
      </>
    );
  }

  // ── EDITOR view ──
  const emUso = fluxoAtivoId === activeFluxo.id;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: isMobile ? "calc(100dvh - 80px)" : "calc(100dvh - 110px)",
      borderRadius: isMobile ? 8 : 12, border: `1px solid ${L.line}`, overflow: "hidden",
      background: L.white, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>

      {/* ── Toolbar ── */}
      <div style={{ padding: isMobile ? "0 10px" : "0 16px", background: L.white,
        borderBottom: `1px solid ${L.line}`,
        display: "flex", alignItems: "center", gap: 8,
        height: isMobile ? 48 : 52, flexShrink: 0, overflow: "hidden" }}>

        <button onClick={() => { setActiveFluxo(null); setNos([]); setConexoes([]); setEditingNo(null); setConnecting(null); }}
          style={btn(L.surface, L.t2, { padding: "5px 10px", fontSize: isMobile ? 11 : 11.5, flexShrink: 0 })}>← Voltar</button>

        <div style={{ fontSize: isMobile ? 11 : 13, fontWeight: 700, color: L.t1,
          display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, overflow: "hidden" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeFluxo.nome}</span>
          {!isMobile && (activeFluxo.usuario_id ? (
            <span style={{ fontSize: 10, background: L.tealBg, color: L.teal,
              padding: "2px 8px", borderRadius: 10, fontWeight: 700, flexShrink: 0,
              border: `1px solid ${L.tealA2}` }}>
              👤 {vendedores.find(v => v.id === activeFluxo.usuario_id)?.nome || "Vendedor"}
            </span>
          ) : (
            <span style={{ fontSize: 10, background: L.yellowBg, color: L.yellow,
              padding: "2px 8px", borderRadius: 10, fontWeight: 700, flexShrink: 0,
              border: `1px solid ${L.yellowA}` }}>🏢 Empresa</span>
          ))}
          {emUso && !isMobile && (
            <span style={{ fontSize: 10, background: L.accent, color: "white",
              padding: "2px 8px", borderRadius: 10, fontWeight: 700, flexShrink: 0 }}>🤖 Em uso</span>
          )}
          {connecting && !isMobile && (
            <span style={{ fontSize: 11, background: "#eff6ff", color: L.blue,
              padding: "4px 10px", borderRadius: 8, border: `1px solid ${L.blue}33`, fontWeight: 400 }}>
              Clique no nó de destino para conectar
            </span>
          )}
        </div>

        {/* Node type buttons — hidden on mobile (use + menu instead) */}
        {!isMobile && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {Object.entries(NODE_TYPES).filter(([k]) => k !== "inicio").map(([k, v]) => (
              <button key={k} onClick={() => addNo(k)}
                style={{ background: v.cor + "0e", color: v.cor, border: `1px solid ${v.cor}33`,
                  borderRadius: 7, padding: "4px 10px", fontSize: 11, cursor: "pointer",
                  fontFamily: "inherit", fontWeight: 500, transition: "all .1s" }}
                onMouseEnter={e => { e.currentTarget.style.background = v.cor + "22"; }}
                onMouseLeave={e => { e.currentTarget.style.background = v.cor + "0e"; }}>
                {v.icone} {v.label}
              </button>
            ))}
          </div>
        )}

        <button onClick={saveFluxo} disabled={saving}
          style={btn(saving ? L.surface : unsavedChanges ? L.green : L.teal, "white",
            { fontSize: isMobile ? 11 : 11.5, fontWeight: 600, border: "none",
              padding: isMobile ? "5px 10px" : "6px 14px", flexShrink: 0 })}>
          {saving ? "..." : unsavedChanges ? "💾 Salvar*" : "💾 Salvar"}
        </button>

        <button onClick={() => toggleAtivo(activeFluxo)}
          style={btn(activeFluxo.ativo ? L.yellowBg : L.greenBg,
            activeFluxo.ativo ? L.yellow : L.green, { fontSize: 11, padding: "6px 11px" })}>
          {activeFluxo.ativo ? "⏸ Pausar" : "▶ Ativar"}
        </button>
      </div>

      {/* ── Mobile node quick-add bar ── */}
      {isMobile && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "6px 10px",
          background: L.surface, borderBottom: `1px solid ${L.line}`, flexShrink: 0,
          WebkitOverflowScrolling: "touch" }}>
          {Object.entries(NODE_TYPES).filter(([k]) => k !== "inicio").map(([k, v]) => (
            <button key={k} onClick={() => addNo(k)}
              style={{ background: v.cor + "12", color: v.cor, border: `1px solid ${v.cor}33`,
                borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer",
                fontFamily: "inherit", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>
              {v.icone} {v.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ── Canvas ── */}
        <div
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => { setSelectedNo(null); if (connecting) setConnecting(null); }}
          style={{ flex: 1, position: "relative", overflow: "auto",
            background: "#f9fafb",
            backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            cursor: draggingRef.current ? "grabbing" : connecting ? "crosshair" : "default",
            minHeight: 400, minWidth: "min(600px, 100%)",
            WebkitOverflowScrolling: "touch" }}
        >
          {/* SVG Connections */}
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            pointerEvents: "none", overflow: "visible" }}>
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={L.t4}/>
              </marker>
              <marker id="arrow-cond-sim" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={L.green}/>
              </marker>
              <marker id="arrow-cond-nao" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={L.red}/>
              </marker>
            </defs>
            {conexoes.map(c => {
              const de   = nos.find(n => n.id === c.de);
              const para = nos.find(n => n.id === c.para);
              if (!de || !para) return null;
              const x1 = de.x + NODE_W;
              const y1 = de.y + 38;
              const x2 = para.x;
              const y2 = para.y + 38;
              const cx = (x1 + x2) / 2;
              const isSim = c.label === "Sim";
              const isNao = c.label === "Não";
              const strokeColor = isSim ? L.green : isNao ? L.red : L.t4;
              const markerId = isSim ? "arrow-cond-sim" : isNao ? "arrow-cond-nao" : "arrow";
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              return (
                <g key={c.id}>
                  <path d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
                    fill="none" stroke={strokeColor} strokeWidth={1.8}
                    markerEnd={`url(#${markerId})`} strokeDasharray={isNao ? "5 3" : "none"} />
                  {c.label && (
                    <>
                      <rect x={mx - 14} y={my - 9} width={28} height={17} rx={4}
                        fill="white" stroke={strokeColor} strokeWidth={1}/>
                      <text x={mx} y={my + 4} textAnchor="middle"
                        fontSize={9} fontWeight={700} fill={strokeColor} fontFamily="inherit">
                        {c.label}
                      </text>
                    </>
                  )}
                  {/* Hit area to delete connection */}
                  <path d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
                    fill="none" stroke="transparent" strokeWidth={12}
                    style={{ pointerEvents: "all", cursor: "pointer" }}
                    onClick={e => { e.stopPropagation(); deleteConexao(c.id); }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {nos.map(no => (
            <div
              key={no.id}
              data-nodeid={no.id}
              onMouseDown={e => handleMouseDown(e, no.id)}
              style={{ position: "absolute", left: no.x, top: no.y, cursor: "grab" }}
            >
              <NodeCard
                no={no}
                selected={selectedNo?.id === no.id}
                connecting={connecting}
                onClick={n => {
                  if (connecting) { handleConnectTo(n); return; }
                  if (n.tipo === "inicio") { setTriggerModal(n); return; }
                  setSelectedNo(n);
                }}
                onEdit={n => { setEditingNo(n); setSelectedNo(n); }}
                onTrigger={n => setTriggerModal(n)}
                onDelete={deleteNo}
                onConnectStart={handleConnectStart}
              />
            </div>
          ))}

          {/* Empty state */}
          {nos.length <= 1 && (
            <div style={{ position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%,-50%)", textAlign: "center",
              color: L.t4, pointerEvents: "none" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🤖</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: L.t3 }}>
                Adicione nós usando os botões na barra acima
              </div>
              <div style={{ fontSize: 11, marginTop: 5 }}>
                Arraste os nós para posicioná-los · Clique em → para conectar
              </div>
            </div>
          )}
        </div>

        {/* ── Edit Panel ── */}
        {editingNo && (
          <NodeEditPanel
            no={editingNo}
            onSave={saveNo}
            onClose={() => setEditingNo(null)}
          />
        )}
      </div>

      {/* ── Trigger Selector Modal (nó Início) ── */}
      {triggerModal && (
        <TriggerSelectorModal
          no={triggerModal}
          onSave={updated => {
            setNos(p => p.map(n => n.id === updated.id ? updated : n));
            setTriggerModal(null);
          }}
          onClose={() => setTriggerModal(null)}
        />
      )}
      {toastEl}

      {/* Status bar */}
      <div style={{ height: 28, borderTop: `1px solid ${L.lineSoft}`, background: L.surface,
        display: "flex", alignItems: "center", padding: "0 16px", gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: L.t4, fontFamily: "'JetBrains Mono',monospace" }}>
          {nos.length} nós · {conexoes.length} conexões
        </span>
        <span style={{ fontSize: 10, color: L.t4, fontFamily: "'JetBrains Mono',monospace" }}>
          Clique em → no nó para iniciar uma conexão · Clique na linha para remover
        </span>
        {connecting && (
          <span style={{ fontSize: 10, color: L.blue, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", marginLeft: "auto" }}>
            ● Conectando desde: {connecting.nome}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Modal: novo fluxo ────────────────────────────────────────────────────────
function NovaFluxoModal({ form, setForm, vendedores, onSave, onClose }) {
  const inpS = { width: "100%", border: `1.5px solid ${L.line}`, borderRadius: 9,
    padding: "9px 12px", fontSize: 12.5, color: L.t1, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box", background: L.surface };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: L.white, borderRadius: 14, padding: 28, width: 460,
          boxShadow: "0 12px 48px rgba(0,0,0,.18)" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: L.tealBg,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
            {form.usuario_id ? "👤" : "🤖"}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: L.t1, fontFamily: "'Outfit',sans-serif" }}>
              Novo fluxo {form.usuario_id ? "por vendedor" : "da empresa"}
            </div>
            <div style={{ fontSize: 11, color: L.t3 }}>Configure o fluxo de atendimento visual</div>
          </div>
        </div>

        {/* Nome */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, color: L.t3, display: "block", marginBottom: 5,
            fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px",
            fontFamily: "'JetBrains Mono',monospace" }}>Nome do fluxo *</label>
          <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
            placeholder="Ex: Atendimento Inicial" onKeyDown={e => e.key === "Enter" && onSave()}
            style={inpS}
            onFocus={e => e.target.style.borderColor = L.t1}
            onBlur={e => e.target.style.borderColor = L.line} />
        </div>

        {/* Descrição */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, color: L.t3, display: "block", marginBottom: 5,
            fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px",
            fontFamily: "'JetBrains Mono',monospace" }}>Descrição</label>
          <input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
            placeholder="Para que serve este fluxo?"
            style={inpS}
            onFocus={e => e.target.style.borderColor = L.t1}
            onBlur={e => e.target.style.borderColor = L.line} />
        </div>

        {/* Atribuir a */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 10, color: L.t3, display: "block", marginBottom: 5,
            fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px",
            fontFamily: "'JetBrains Mono',monospace" }}>Atribuir a</label>
          <select value={form.usuario_id || ""}
            onChange={e => setForm(p => ({ ...p, usuario_id: e.target.value || null }))}
            style={{ ...inpS, cursor: "pointer" }}>
            <option value="">🏢 Empresa (fluxo geral — todos os atendimentos)</option>
            {vendedores.map(v => (
              <option key={v.id} value={v.id}>👤 {v.nome}{v.cargo ? ` · ${v.cargo}` : ""}</option>
            ))}
          </select>
          <div style={{ fontSize: 10, color: L.t4, marginTop: 4, lineHeight: 1.5 }}>
            {form.usuario_id
              ? "Este fluxo aparece na aba Script do vendedor selecionado durante o atendimento no WhatsApp."
              : "Este fluxo é usado pelo chatbot automático e aparece para todos os vendedores sem fluxo próprio."}
          </div>
        </div>

        <Row gap={8} style={{ justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btn()}>Cancelar</button>
          <button onClick={onSave} style={btn(L.accent, "white", { fontWeight: 600 })}>Criar fluxo</button>
        </Row>
      </div>
    </div>
  );
}
