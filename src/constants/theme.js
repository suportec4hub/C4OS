// Todas as cores apontam para CSS custom properties.
// O toggle de tema aplica data-theme="dark" em <html> e o CSS cuida do resto.
export const L = {
  // Backgrounds
  bg:"var(--c-bg)", bgWarm:"var(--c-bgWarm)", white:"var(--c-white)",
  surface:"var(--c-surface)", hover:"var(--c-hover)",
  line:"var(--c-line)", lineSoft:"var(--c-lineSoft)",

  // WhatsApp-specific colors (chat area only)
  waChatBg:       "var(--wa-chat-bg)",
  waBubbleIn:     "var(--wa-bubble-in)",
  waBubbleOut:    "var(--wa-bubble-out)",
  waBubbleOutText:"var(--wa-bubble-out-text)",
  waHeaderBg:     "var(--wa-header-bg)",
  waInputBg:      "var(--wa-input-bg)",
  waTimestamp:    "var(--wa-timestamp)",
  waDateBg:       "var(--wa-date-bg)",
  waDateText:     "var(--wa-date-text)",
  waTick:         "var(--wa-tick)",

  // Primary
  teal:"var(--c-teal)", tealDk:"var(--c-tealDk)", tealBg:"var(--c-tealBg)",
  tealA:"var(--c-tealA)",   // ~13% opacity  (substitui ${L.tealA})
  tealA2:"var(--c-tealA2)", // ~20% opacity  (substitui ${L.tealA2})
  // Accent — botão primário: dark em light mode, teal em dark mode
  accent:"var(--c-accent)",
  // Card destaque — gradient para cartão premium (Enterprise/Popular)
  cardFeature:"var(--c-card-feature)",

  // Secondary
  copper:"var(--c-copper)", copperBg:"var(--c-copperBg)",
  copperA:"var(--c-copperA)", // ~13% opacity

  // Status
  green:"var(--c-green)", greenBg:"var(--c-greenBg)",
  greenA:"var(--c-greenA)",   // ~13%
  greenA2:"var(--c-greenA2)", // ~25%  (substitui 44)

  red:"var(--c-red)", redBg:"var(--c-redBg)",
  redA:"var(--c-redA)",   // ~13%
  redA2:"var(--c-redA2)", // ~20%  (substitui 33)
  redA3:"var(--c-redA3)", // ~27%  (substitui 44)

  yellow:"var(--c-yellow)", yellowBg:"var(--c-yellowBg)",
  yellowA:"var(--c-yellowA)",   // ~13%
  yellowA2:"var(--c-yellowA2)", // ~25%  (substitui 33/44)

  blue:"var(--c-blue)", blueBg:"var(--c-blueBg)",
  blueA:"var(--c-blueA)", // ~20%

  // Texto
  t1:"var(--c-t1)", t2:"var(--c-t2)", t3:"var(--c-t3)", t4:"var(--c-t4)", t5:"var(--c-t5)",
};

export const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}

  /* ── Tema claro (padrão) ─────────────────────────────────────────────── */
  :root {
    --c-bg:#ffffff; --c-bgWarm:#fafafa; --c-white:#ffffff;
    --c-surface:#f9fafb; --c-hover:#f3f4f6;
    --c-line:#e5e7eb; --c-lineSoft:#f3f4f6;

    /* WhatsApp light */
    --wa-chat-bg:#efeae2;
    --wa-bubble-in:#ffffff;
    --wa-bubble-out:#d9fdd3;
    --wa-bubble-out-text:#111b21;
    --wa-header-bg:#f0f2f5;
    --wa-input-bg:#f0f2f5;
    --wa-timestamp:#667781;
    --wa-date-bg:rgba(255,255,255,0.90);
    --wa-date-text:#54656f;
    --wa-tick:#53bdeb;

    --c-teal:#111827; --c-tealDk:#000000; --c-tealBg:#f3f4f6;
    --c-tealA:rgba(17,24,39,0.13); --c-tealA2:rgba(17,24,39,0.20);
    --c-accent:#111827;
    --c-card-feature:linear-gradient(135deg,#111827 0%,#1c2537 100%);

    --c-copper:#6b7280; --c-copperBg:#f9fafb;
    --c-copperA:rgba(107,114,128,0.13);

    --c-green:#16a34a; --c-greenBg:#f0fdf4;
    --c-greenA:rgba(22,163,74,0.13); --c-greenA2:rgba(22,163,74,0.25);

    --c-red:#dc2626; --c-redBg:#fef2f2;
    --c-redA:rgba(220,38,38,0.13); --c-redA2:rgba(220,38,38,0.20); --c-redA3:rgba(220,38,38,0.27);

    --c-yellow:#ca8a04; --c-yellowBg:#fefce8;
    --c-yellowA:rgba(202,138,4,0.13); --c-yellowA2:rgba(202,138,4,0.25);

    --c-blue:#2563eb; --c-blueBg:#eff6ff;
    --c-blueA:rgba(37,99,235,0.20);

    --c-t1:#111827; --c-t2:#374151; --c-t3:#6b7280; --c-t4:#9ca3af; --c-t5:#d1d8e0;
  }

  /* ── Tema escuro ─────────────────────────────────────────────────────── */
  html[data-theme="dark"] {
    --c-bg:#0d1117; --c-bgWarm:#161b22; --c-white:#161b22;
    --c-surface:#21262d; --c-hover:#30363d;
    --c-line:#30363d; --c-lineSoft:#21262d;

    /* WhatsApp dark */
    --wa-chat-bg:#0b141a;
    --wa-bubble-in:#202c33;
    --wa-bubble-out:#005c4b;
    --wa-bubble-out-text:#e9edef;
    --wa-header-bg:#202c33;
    --wa-input-bg:#202c33;
    --wa-timestamp:#8696a0;
    --wa-date-bg:#182229;
    --wa-date-text:#8696a0;
    --wa-tick:#53bdeb;

    --c-teal:#c9d1d9; --c-tealDk:#ffffff; --c-tealBg:#21262d;
    --c-tealA:rgba(201,209,217,0.13); --c-tealA2:rgba(201,209,217,0.20);
    --c-accent:#1aaa96;
    --c-card-feature:linear-gradient(135deg,#0a5c53 0%,#0d7a6e 40%,#1aaa96 100%);

    --c-copper:#8b949e; --c-copperBg:#161b22;
    --c-copperA:rgba(139,148,158,0.13);

    --c-green:#3fb950; --c-greenBg:#0d1f0f;
    --c-greenA:rgba(63,185,80,0.13); --c-greenA2:rgba(63,185,80,0.25);

    --c-red:#f85149; --c-redBg:#1c0a0a;
    --c-redA:rgba(248,81,73,0.13); --c-redA2:rgba(248,81,73,0.20); --c-redA3:rgba(248,81,73,0.27);

    --c-yellow:#d29922; --c-yellowBg:#1d1711;
    --c-yellowA:rgba(210,153,34,0.13); --c-yellowA2:rgba(210,153,34,0.25);

    --c-blue:#58a6ff; --c-blueBg:#0c1a2e;
    --c-blueA:rgba(88,166,255,0.20);

    --c-t1:#f0f6fc; --c-t2:#e6edf3; --c-t3:#c9d1d9; --c-t4:#8b949e; --c-t5:#6e7681;
  }

  :root{color-scheme:light}
  html[data-theme="dark"]{color-scheme:dark}
  body{background:var(--c-bg);color:var(--c-t1);font-family:'Instrument Sans',sans-serif;font-size:13px;line-height:1.5;-webkit-font-smoothing:antialiased;transition:background .2s,color .2s}
  input,textarea,select{color:var(--c-t1);background:var(--c-bg)}
  input::placeholder,textarea::placeholder{color:var(--c-t4)}
  :focus-visible{outline:2px solid var(--c-accent);outline-offset:2px;border-radius:4px}
  ::selection{background:var(--c-tealA2);color:var(--c-t1)}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:var(--c-line);border-radius:99px}
  ::-webkit-scrollbar-thumb:hover{background:var(--c-tealA2)}
  tbody tr{transition:background .1s}
  tbody tr:hover{background:var(--c-surface)}
  /* ── Força textos hardcoded escuros a ficarem legíveis no tema escuro ── */
  html[data-theme="dark"] [style*="color:#111827"],html[data-theme="dark"] [style*="color: #111827"],
  html[data-theme="dark"] [style*="color:#1f2937"],html[data-theme="dark"] [style*="color:#374151"],
  html[data-theme="dark"] [style*="color:#4b5563"],html[data-theme="dark"] [style*="color:#6b7280"],
  html[data-theme="dark"] [style*="color:#9ca3af"],html[data-theme="dark"] [style*="color:#0f172a"],
  html[data-theme="dark"] [style*="color:#1a1a2e"],html[data-theme="dark"] [style*="color:#000000"],
  html[data-theme="dark"] [style*="color:#000"] { color:var(--c-t2)!important; }
  /* ── Força backgrounds claros hardcoded a ficarem escuros no tema escuro ── */
  html[data-theme="dark"] [style*="background:#fff"],html[data-theme="dark"] [style*="background: #fff"],
  html[data-theme="dark"] [style*="background:#ffffff"],html[data-theme="dark"] [style*="background:#f9fafb"],
  html[data-theme="dark"] [style*="background:#f3f4f6"],html[data-theme="dark"] [style*="background:#f0f9ff"],
  html[data-theme="dark"] [style*="background:#eff6ff"],html[data-theme="dark"] [style*="background:#fffbf0"],
  html[data-theme="dark"] [style*="background:#fffbeb"],html[data-theme="dark"] [style*="background:#fefce8"] { background:var(--c-surface)!important; }
  @keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @keyframes in{from{opacity:0}to{opacity:1}}
  @keyframes px{from{transform:translateX(-6px);opacity:0}to{transform:none;opacity:1}}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
  @keyframes slideInRight{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}
  @keyframes shrinkBar{from{width:100%}to{width:0%}}
  /* ── Responsive grid ── */
  .rg-auto{display:grid}
  .sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:14;animation:in .15s ease}
  .sidebar-drawer{animation:slideIn .22s ease}
  /* Form grid (2 cols → 1 col on mobile) */
  .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
  /* XS < 375px (tiny phones) */
  @media(max-width:374px){
    body{font-size:12px}
    .modal-box{width:calc(100vw - 16px)!important;max-width:100%!important;margin:8px!important;max-height:92dvh;overflow-y:auto}
  }
  /* Mobile < 640px */
  @media(max-width:639px){
    .form-grid{grid-template-columns:1fr!important}
    .rg-auto{grid-template-columns:1fr!important}
    .hide-mobile{display:none!important}
    .show-mobile{display:flex!important}
    .table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
    .table-scroll table{min-width:480px}
    .stack-mobile{flex-direction:column!important;align-items:stretch!important;gap:8px!important}
    .wrap-mobile{flex-wrap:wrap!important}
    .modal-box{
      position:fixed!important;inset:0!important;width:100%!important;max-width:100%!important;
      margin:0!important;border-radius:0!important;
      max-height:100dvh!important;overflow-y:auto!important;
      padding-bottom:max(24px,env(safe-area-inset-bottom))!important;
    }
    .modal-sheet{
      position:fixed!important;bottom:0!important;left:0!important;right:0!important;
      width:100%!important;max-width:100%!important;margin:0!important;
      border-radius:20px 20px 0 0!important;
      max-height:90dvh!important;overflow-y:auto!important;
      padding-bottom:max(24px,env(safe-area-inset-bottom))!important;
    }
    .kanban-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:12px}
    .action-row{flex-wrap:wrap!important;gap:6px!important}
    .safe-pad{padding-left:max(12px,env(safe-area-inset-left));padding-right:max(12px,env(safe-area-inset-right))}
    /* Previne zoom automático do iOS em inputs (< 16px dispara o zoom) */
    input,select,textarea{font-size:max(16px,1em)!important}
    /* Evita scroll horizontal acidental */
    body{overflow-x:hidden}
    /* Mínimo tap target para acessibilidade em mobile */
    button,a,[role="button"]{min-height:36px}
  }
  /* Tablet 640–1023px */
  @media(min-width:640px) and (max-width:1023px){
    .rg-auto{grid-template-columns:repeat(2,1fr)!important}
    .hide-tablet{display:none!important}
    .table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
    .table-scroll table{min-width:580px}
    .modal-box{width:min(520px,calc(100vw - 48px))!important;max-height:90dvh!important;overflow-y:auto!important}
    input,select,textarea{font-size:max(16px,1em)!important}
  }
  /* TV ≥ 1920px */
  @media(min-width:1920px){
    body{font-size:14px}
    .tv-wide{max-width:1800px;margin:0 auto;width:100%}
  }
`;
