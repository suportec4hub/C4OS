import { useState, useRef } from "react";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { Av } from "./ui";

export default function ModalPerfil({ user, onClose, onUpdate }) {
  const [nome,    setNome]    = useState(user.nome || "");
  const [cargo,   setCargo]   = useState(user.cargo || "");
  const [email,   setEmail]   = useState(user.email || "");
  const [senha,   setSenha]   = useState("");
  const [senha2,  setSenha2]  = useState("");
  const [preview, setPreview] = useState(user.foto_url || null);
  const [file,    setFile]    = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");
  const [succ,    setSucc]    = useState("");
  const fileRef = useRef(null);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { setErr("Foto muito grande (máx 2MB)."); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setErr("");
  };

  const removePhoto = () => {
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const save = async () => {
    if (!nome.trim()) { setErr("Nome é obrigatório."); return; }
    if (senha && senha.length < 6) { setErr("Senha mínima: 6 caracteres."); return; }
    if (senha && senha !== senha2) { setErr("As senhas não coincidem."); return; }
    setSaving(true); setErr(""); setSucc("");

    try {
      let foto_url = user.foto_url ?? null;

      // 1. Upload da foto (se selecionada)
      if (file) {
        const ext  = file.name.split(".").pop();
        const path = `${user.id}/avatar.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) throw new Error("Erro no upload: " + upErr.message);
        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
        foto_url = publicUrl + "?t=" + Date.now(); // cache-bust
      } else if (preview === null && user.foto_url) {
        // usuário removeu a foto
        foto_url = null;
      }

      // 2. Atualiza tabela usuarios
      const { error: dbErr } = await supabase
        .from("usuarios")
        .update({ nome: nome.trim(), cargo: cargo.trim(), foto_url })
        .eq("id", user.id);
      if (dbErr) throw new Error(dbErr.message);

      // 3. Atualiza auth (email e/ou senha)
      const authChanges = {};
      if (email.trim() && email.trim() !== user.email) authChanges.email = email.trim();
      if (senha) authChanges.password = senha;
      if (Object.keys(authChanges).length > 0) {
        const { error: authErr } = await supabase.auth.updateUser(authChanges);
        if (authErr) throw new Error(authErr.message);
      }

      setSucc("Perfil atualizado!");
      onUpdate({ nome: nome.trim(), cargo: cargo.trim(), foto_url, email: email.trim() || user.email });
      setTimeout(onClose, 1200);
    } catch (e) {
      setErr(e.message || "Erro ao salvar.");
    }
    setSaving(false);
  };

  // fechar com Escape
  const onKey = (e) => { if (e.key === "Escape") onClose(); };

  return (
    <div onKeyDown={onKey}
      onClick={onClose}
      style={{position:"fixed",inset:0,background:"rgba(15,25,35,0.45)",backdropFilter:"blur(3px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",animation:"in .15s ease"}}
    >
      <div onClick={e=>e.stopPropagation()}
        style={{background:L.white,borderRadius:16,border:`1px solid ${L.line}`,width:"min(460px,95vw)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.18)",animation:"up .2s ease"}}
      >
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:`1px solid ${L.lineSoft}`}}>
          <div style={{fontSize:14,fontWeight:700,color:L.t1,fontFamily:"'Outfit',sans-serif"}}>Editar Perfil</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:18,lineHeight:1,padding:"2px 6px",borderRadius:6,transition:"all .1s"}}
            onMouseEnter={e=>{e.currentTarget.style.background=L.surface;e.currentTarget.style.color=L.t1;}}
            onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=L.t4;}}
          >×</button>
        </div>

        <div style={{padding:20}}>
          {/* Foto */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:22}}>
            <div style={{position:"relative",display:"inline-block"}}>
              <Av name={nome||"?"} color={user.cor||L.copper} size={72} src={preview}/>
              <button
                onClick={()=>fileRef.current?.click()}
                title="Alterar foto"
                style={{position:"absolute",bottom:-4,right:-4,width:24,height:24,borderRadius:"50%",background:L.teal,border:`2px solid ${L.white}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"white",transition:"opacity .12s"}}
                onMouseEnter={e=>e.currentTarget.style.opacity=".8"}
                onMouseLeave={e=>e.currentTarget.style.opacity="1"}
              >✎</button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} style={{display:"none"}}/>
            <div style={{marginTop:10,display:"flex",gap:8}}>
              <button onClick={()=>fileRef.current?.click()}
                style={{padding:"4px 12px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.tealBg,color:L.teal,border:`1px solid ${L.teal}22`,transition:"all .12s"}}
                onMouseEnter={e=>e.currentTarget.style.filter="brightness(.96)"}
                onMouseLeave={e=>e.currentTarget.style.filter="none"}
              >{preview ? "Trocar foto" : "Adicionar foto"}</button>
              {preview && (
                <button onClick={removePhoto}
                  style={{padding:"4px 12px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:L.redBg,color:L.red,border:`1px solid ${L.red}22`,transition:"all .12s"}}
                  onMouseEnter={e=>e.currentTarget.style.filter="brightness(.96)"}
                  onMouseLeave={e=>e.currentTarget.style.filter="none"}
                >Remover</button>
              )}
            </div>
            <div style={{fontSize:10,color:L.t4,marginTop:6}}>JPG, PNG ou WebP · máx 2MB</div>
          </div>

          {/* Campos */}
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            <LI label="Nome completo *" value={nome} onChange={setNome} placeholder="Seu nome"/>
            <LI label="Cargo" value={cargo} onChange={setCargo} placeholder="Ex: CTO, Vendedor..."/>
            <LI label="E-mail" value={email} onChange={setEmail} placeholder={user.email||"seu@email.com"} type="email"/>
            <div style={{height:1,background:L.lineSoft,margin:"8px 0 12px"}}/>
            <div style={{fontSize:10,fontWeight:700,color:L.t4,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>Alterar senha</div>
            <LI label="Nova senha" value={senha} onChange={setSenha} placeholder="Mínimo 6 caracteres" type="password"/>
            <LI label="Confirmar senha" value={senha2} onChange={setSenha2} placeholder="Repita a senha" type="password"/>
          </div>

          {err  && <div style={{padding:"8px 12px",background:L.redBg,border:`1px solid ${L.red}22`,borderRadius:8,fontSize:12,color:L.red,margin:"8px 0"}}>{err}</div>}
          {succ && <div style={{padding:"8px 12px",background:L.greenBg,border:`1px solid ${L.green}22`,borderRadius:8,fontSize:12,color:L.green,margin:"8px 0"}}>✓ {succ}</div>}

          {/* Footer */}
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16,paddingTop:16,borderTop:`1px solid ${L.lineSoft}`}}>
            <button onClick={onClose}
              style={{padding:"9px 18px",borderRadius:9,fontSize:12.5,fontWeight:500,cursor:"pointer",fontFamily:"inherit",background:L.surface,color:L.t2,border:`1px solid ${L.line}`,transition:"all .1s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=L.teal}
              onMouseLeave={e=>e.currentTarget.style.borderColor=L.line}
            >Cancelar</button>
            <button onClick={save} disabled={saving}
              style={{padding:"9px 20px",borderRadius:9,fontSize:12.5,fontWeight:600,cursor:saving?"wait":"pointer",fontFamily:"inherit",background:L.teal,color:"white",border:"none",opacity:saving?.7:1,transition:"all .12s",boxShadow:`0 3px 10px ${L.teal}28`}}
            >{saving ? "Salvando..." : "Salvar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LI({ label, value, onChange, placeholder, type="text" }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:5,fontFamily:"'JetBrains Mono',monospace"}}>{label}</label>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type}
        onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
        style={{width:"100%",background:L.surface,border:`1.5px solid ${focus?L.teal:L.line}`,borderRadius:9,padding:"9px 12px",color:L.t1,fontSize:12.5,fontFamily:"'Instrument Sans',sans-serif",outline:"none",transition:"border-color .12s",boxSizing:"border-box"}}
      />
    </div>
  );
}
