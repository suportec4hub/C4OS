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
`;
