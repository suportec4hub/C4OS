import { L } from "../constants/theme";

export const TT = {background:"white",border:`1px solid ${L.line}`,borderRadius:9,color:L.t1,fontSize:11,boxShadow:"0 4px 16px rgba(0,0,0,0.1)"};
export const TD = {padding:"12px 14px",fontSize:12.5,transition:"background .1s"};

export function Fade({children}) {
  return <div style={{animation:"up .35s ease"}}>{children}</div>;
}

export function Card({title,sub,children}) {
  return (
    <div style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"18px 20px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:600,color:L.t1}}>{title}</div>
        {sub && <div style={{fontSize:10.5,color:L.t4,marginTop:1}}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export function Grid({cols,gap,mb,children}) {
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
    <div style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr style={{background:L.surface,borderBottom:`1px solid ${L.line}`}}>
            {heads.map(h => (
              <th key={h} style={{padding:"11px 14px",textAlign:"left",fontSize:9.5,fontWeight:700,color:L.t4,letterSpacing:"1.2px",textTransform:"uppercase",whiteSpace:"nowrap",fontFamily:"'JetBrains Mono',monospace"}}>
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

export function Av({name,color,size=28}) {
  const initials = name.split(" ").map(n => n[0]).slice(0,2).join("");
  return (
    <div style={{width:size,height:size,borderRadius:Math.round(size*.28),flexShrink:0,background:`${color}18`,border:`1.5px solid ${color}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.37,fontWeight:700,color,fontFamily:"'Outfit',sans-serif"}}>
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
    <span style={{padding:small?"2px 8px":"3px 10px",borderRadius:6,fontSize:small?10:10.5,fontWeight:600,whiteSpace:"nowrap",background:bg||`${color}12`,color,border:`1px solid ${color}20`}}>
      {children}
    </span>
  );
}

export function Chip({children,color,dot}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",background:`${color}0f`,border:`1px solid ${color}20`,borderRadius:6}}>
      {dot && <div style={{width:5,height:5,borderRadius:"50%",background:color}}/>}
      <span style={{fontSize:10,color,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,letterSpacing:"1px"}}>{children}</span>
    </div>
  );
}

export function PBtn({children,onClick,full}) {
  return (
    <button
      onClick={onClick}
      style={{padding:"8px 16px",borderRadius:9,fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"'Instrument Sans',sans-serif",background:L.teal,color:"white",border:"none",transition:"all .12s",whiteSpace:"nowrap",display:full?"block":"inline-block",width:full?"100%":"auto",boxShadow:`0 3px 10px ${L.teal}28`}}
      onMouseEnter={e=>{e.currentTarget.style.opacity=".88";e.currentTarget.style.transform="translateY(-1px)";}}
      onMouseLeave={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.transform="none";}}
    >
      {children}
    </button>
  );
}

export function IBtn({children,c,onClick}) {
  return (
    <button
      onClick={onClick}
      style={{padding:"4px 10px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:`${c}10`,color:c,border:`1px solid ${c}22`,transition:"all .1s",whiteSpace:"nowrap"}}
      onMouseEnter={e=>{e.currentTarget.style.background=`${c}20`;e.currentTarget.style.borderColor=`${c}44`;}}
      onMouseLeave={e=>{e.currentTarget.style.background=`${c}10`;e.currentTarget.style.borderColor=`${c}22`;}}
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
