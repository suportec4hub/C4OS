import { useState } from "react";
import { L } from "../constants/theme";

// Aplica opacidade a uma cor. Funciona com CSS variables e hex strings.
// pct = percentual de 0-100 (ex: 9 ≈ hex 18, 13 ≈ hex 22)
const ao = (color, pct) =>
  color?.startsWith?.("var(")
    ? `color-mix(in srgb, ${color} ${pct}%, transparent)`
    : `${color}${Math.round(pct * 2.55).toString(16).padStart(2, "0")}`;

export const TT = {background:L.white,border:`1px solid ${L.line}`,borderRadius:9,color:L.t1,fontSize:11,boxShadow:"0 4px 16px rgba(0,0,0,0.1)"};
export const TD = {padding:"12px 14px",fontSize:12.5,transition:"background .1s"};

export function Fade({children}) {
  return <div style={{animation:"up .35s ease"}}>{children}</div>;
}

export function Card({title,sub,children}) {
  return (
    <div style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"18px 20px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:600,color:L.t1}}>{title}</div>
        {sub && <div style={{fontSize:10.5,color:L.t3,marginTop:1}}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export function Grid({cols,gap,mb,children,responsive}) {
  if (responsive) {
    return (
      <div className="rg-auto"
        style={{gridTemplateColumns:typeof cols==="number"?`repeat(${cols},1fr)`:cols,gap:gap||12,marginBottom:mb||0}}>
        {children}
      </div>
    );
  }
  return (
    <div style={{display:"grid",gridTemplateColumns:typeof cols==="number"?`repeat(${cols},1fr)`:cols,gap,marginBottom:mb||0}}>
      {children}
    </div>
  );
}

export function Row({children,gap,between,justify,mb,mt}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:gap||8,justifyContent:between?"space-between":justify||"flex-start",marginBottom:mb||0,marginTop:mt||0}}>
      {children}
    </div>
  );
}

export function DataTable({heads,children}) {
  return (
    <div className="table-scroll" style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr style={{background:L.surface,borderBottom:`1px solid ${L.line}`}}>
            {heads.map(h => (
              <th key={h} style={{padding:"11px 14px",textAlign:"left",fontSize:9.5,fontWeight:700,color:L.t3,letterSpacing:"1.2px",textTransform:"uppercase",whiteSpace:"nowrap",fontFamily:"'JetBrains Mono',monospace"}}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Av({name,color,size=28,src,style:extraStyle}) {
  const [imgErr, setImgErr] = useState(false);
  const initials = (name||"?").split(" ").map(n => n[0]).filter(Boolean).slice(0,2).join("").toUpperCase();
  const radius = Math.round(size*.28);
  const bg  = ao(color, 9);
  const brd = ao(color, 14);
  if (src && !imgErr) {
    return (
      <img src={src} alt={name} onError={() => setImgErr(true)}
        style={{width:size,height:size,borderRadius:radius,flexShrink:0,objectFit:"cover",border:`1.5px solid ${brd}`,display:"block",...extraStyle}}
      />
    );
  }
  return (
    <div style={{width:size,height:size,borderRadius:radius,flexShrink:0,background:bg,border:`1.5px solid ${brd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.37,fontWeight:700,color,fontFamily:"'Outfit',sans-serif",...extraStyle}}>
      {initials}
    </div>
  );
}

export function ScBar({v,w=40,h=4}) {
  const c = v>80 ? L.green : v>60 ? L.yellow : L.red;
  return (
    <div style={{width:w,height:h,borderRadius:3,background:L.surface,overflow:"hidden",flexShrink:0,border:`1px solid ${L.line}`}}>
      <div style={{width:`${v}%`,height:"100%",background:c,borderRadius:3}}/>
    </div>
  );
}

export function Tag({children,color,bg,small}) {
  return (
    <span style={{padding:small?"2px 8px":"3px 10px",borderRadius:6,fontSize:small?10:10.5,fontWeight:600,whiteSpace:"nowrap",background:bg||ao(color,7),color,border:`1px solid ${ao(color,12)}`}}>
      {children}
    </span>
  );
}

export function Chip({children,color,dot}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",background:ao(color,6),border:`1px solid ${ao(color,12)}`,borderRadius:6}}>
      {dot && <div style={{width:5,height:5,borderRadius:"50%",background:color}}/>}
      <span style={{fontSize:10,color,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,letterSpacing:"1px"}}>{children}</span>
    </div>
  );
}

export function PBtn({children,onClick,full}) {
  return (
    <button
      onClick={onClick}
      style={{padding:"8px 16px",borderRadius:9,fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"'Instrument Sans',sans-serif",background:L.accent,color:"white",border:"none",transition:"all .12s",whiteSpace:"nowrap",display:full?"block":"inline-block",width:full?"100%":"auto",boxShadow:`0 3px 10px ${ao(L.accent,16)}`}}
      onMouseEnter={e=>{e.currentTarget.style.opacity=".88";e.currentTarget.style.transform="translateY(-1px)";}}
      onMouseLeave={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.transform="none";}}
    >
      {children}
    </button>
  );
}

export function IBtn({children,c,onClick}) {
  const bg  = ao(c, 6);
  const bg2 = ao(c, 12);
  const brd = ao(c, 13);
  const brd2 = ao(c, 26);
  return (
    <button
      onClick={onClick}
      style={{padding:"4px 10px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:bg,color:c,border:`1px solid ${brd}`,transition:"all .1s",whiteSpace:"nowrap"}}
      onMouseEnter={e=>{e.currentTarget.style.background=bg2;e.currentTarget.style.borderColor=brd2;}}
      onMouseLeave={e=>{e.currentTarget.style.background=bg;e.currentTarget.style.borderColor=brd;}}
    >
      {children}
    </button>
  );
}

export function TabPills({tabs,active,onChange}) {
  return (
    <div style={{display:"flex",gap:4,background:L.surface,padding:4,borderRadius:9,border:`1px solid ${L.line}`}}>
      {tabs.map(t => {
        const on = active===t;
        return (
          <button key={t} onClick={()=>onChange(t)} style={{padding:"6px 14px",borderRadius:7,fontSize:12,fontWeight:on?600:400,cursor:"pointer",fontFamily:"inherit",background:on?L.white:L.surface,color:on?L.teal:L.t3,border:"none",transition:"all .12s",boxShadow:on?"0 1px 3px rgba(0,0,0,0.07)":"none"}}>
            {t}
          </button>
        );
      })}
    </div>
  );
}
