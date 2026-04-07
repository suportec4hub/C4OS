import React, { useState, useEffect } from "react";
import { L } from "../constants/theme";

export default function Modal({ title, onClose, children, width = 480 }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{position:"fixed",inset:0,background:"rgba(15,25,35,0.45)",backdropFilter:"blur(3px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",animation:"in .15s ease"}}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{background:L.white,borderRadius:14,border:`1px solid ${L.line}`,width,maxWidth:"95vw",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.18)",animation:"up .2s ease"}}
      >
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:`1px solid ${L.lineSoft}`}}>
          <div style={{fontSize:14,fontWeight:700,color:L.t1,fontFamily:"'Outfit',sans-serif"}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:18,lineHeight:1,padding:"2px 6px",borderRadius:6,transition:"all .1s"}}
            onMouseEnter={e=>{e.currentTarget.style.background=L.surface;e.currentTarget.style.color=L.t1;}}
            onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=L.t4;}}
          >×</button>
        </div>
        <div style={{padding:"20px"}}>{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, required }) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:5,fontFamily:"'JetBrains Mono',monospace"}}>
        {label}{required && <span style={{color:L.red}}> *</span>}
      </label>
      {children}
    </div>
  );
}

export function Input({ value, onChange, placeholder, type = "text", ...rest }) {
  const [focus, setFocus] = useState(false);
  return (
    <input
      value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} type={type}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{width:"100%",background:L.surface,border:`1.5px solid ${focus ? L.teal : L.line}`,borderRadius:9,padding:"9px 12px",color:L.t1,fontSize:12.5,fontFamily:"'Instrument Sans',sans-serif",outline:"none",transition:"border-color .12s",...(rest.style||{})}}
      {...rest}
    />
  );
}

export function Select({ value, onChange, children, ...rest }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{width:"100%",background:L.surface,border:`1.5px solid ${L.line}`,borderRadius:9,padding:"9px 12px",color:L.t1,fontSize:12.5,fontFamily:"'Instrument Sans',sans-serif",outline:"none",cursor:"pointer",...(rest.style||{})}}
    >{children}</select>
  );
}

export function ModalFooter({ onClose, onSave, loading, label = "Salvar" }) {
  return (
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20,paddingTop:16,borderTop:`1px solid ${L.lineSoft}`}}>
      <button onClick={onClose}
        style={{padding:"9px 18px",borderRadius:9,fontSize:12.5,fontWeight:500,cursor:"pointer",fontFamily:"inherit",background:L.surface,color:L.t2,border:`1px solid ${L.line}`,transition:"all .1s"}}
        onMouseEnter={e=>e.currentTarget.style.borderColor=L.teal}
        onMouseLeave={e=>e.currentTarget.style.borderColor=L.line}
      >Cancelar</button>
      <button onClick={onSave} disabled={loading}
        style={{padding:"9px 20px",borderRadius:9,fontSize:12.5,fontWeight:600,cursor:loading?"wait":"pointer",fontFamily:"inherit",background:L.teal,color:"white",border:"none",opacity:loading?.7:1,transition:"all .12s",boxShadow:`0 3px 10px ${L.teal}28`}}
      >
        {loading ? "Salvando..." : label}
      </button>
    </div>
  );
}
