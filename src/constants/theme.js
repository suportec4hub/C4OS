export const L = {
  // Backgrounds — brancos puros
  bg:"#ffffff", bgWarm:"#fafafa", white:"#ffffff", surface:"#f9fafb", hover:"#f3f4f6",
  line:"#e5e7eb", lineSoft:"#f3f4f6",

  // Primary — preto
  teal:"#111827", tealDk:"#000000", tealBg:"#f3f4f6",

  // Secundário — cinza médio
  copper:"#6b7280", copperBg:"#f9fafb",

  // Status (mantidos para semântica)
  green:"#16a34a",  greenBg:"#f0fdf4",
  red:"#dc2626",    redBg:"#fef2f2",
  yellow:"#ca8a04", yellowBg:"#fefce8",
  blue:"#2563eb",   blueBg:"#eff6ff",

  // Texto
  t1:"#111827", t2:"#374151", t3:"#6b7280", t4:"#9ca3af", t5:"#d1d8e0",
};

export const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{background:#ffffff;color:#111827;font-family:'Instrument Sans',sans-serif;font-size:13px;line-height:1.5;-webkit-font-smoothing:antialiased}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:99px}
  @keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @keyframes in{from{opacity:0}to{opacity:1}}
  @keyframes px{from{transform:translateX(-6px);opacity:0}to{transform:none;opacity:1}}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
  /* ── Responsive grid ── */
  .rg-auto{display:grid}
  .sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:14;animation:in .15s ease}
  .sidebar-drawer{animation:slideIn .22s ease}
  /* Form grid (2 cols → 1 col on mobile) */
  .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
  /* Mobile < 640px */
  @media(max-width:639px){
    .form-grid{grid-template-columns:1fr!important}
    .rg-auto{grid-template-columns:1fr!important}
    .hide-mobile{display:none!important}
    .show-mobile{display:flex!important}
    .table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
    .table-scroll table{min-width:580px}
    .stack-mobile{flex-direction:column!important;align-items:stretch!important;gap:8px!important}
    .wrap-mobile{flex-wrap:wrap!important}
    /* Modais full-width no mobile */
    .modal-box{width:calc(100vw - 32px)!important;max-width:100%!important;margin:16px!important;max-height:90dvh;overflow-y:auto}
    /* Kanban / colunas horizontais: scroll */
    .kanban-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:12px}
    /* Botões de ação que ficam apertados */
    .action-row{flex-wrap:wrap!important;gap:6px!important}
  }
  /* Tablet 640–1023px */
  @media(min-width:640px) and (max-width:1023px){
    .rg-auto{grid-template-columns:repeat(2,1fr)!important}
    .hide-tablet{display:none!important}
    .table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
    .table-scroll table{min-width:580px}
    .modal-box{width:min(520px,calc(100vw - 48px))!important}
  }
  /* TV ≥ 1920px */
  @media(min-width:1920px){
    body{font-size:14px}
    .tv-wide{max-width:1800px;margin:0 auto;width:100%}
  }
`;
