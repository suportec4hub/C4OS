import { useState, useEffect, useCallback } from "react";
import { useBreakpoint } from "../hooks/useBreakpoint";
import Logo from "./Logo";
import { Av, Chip } from "./ui";
import ModalPerfil from "./ModalPerfil";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { injectMetaPixel, injectGA4 } from "../lib/analytics";
import PageDashboard  from "../pages/PageDashboard";
import PageLeads      from "../pages/PageLeads";
import PagePipeline   from "../pages/PagePipeline";
import PageChat       from "../pages/PageChat";
import PageBroadcast  from "../pages/PageBroadcast";
import PageFollowUp   from "../pages/PageFollowUp";
import PageReports    from "../pages/PageReports";
import PageAI         from "../pages/PageAI";
import PageEmpresa    from "../pages/PageEmpresa";
import PageEquipe     from "../pages/PageEquipe";
import PageDeps       from "../pages/PageDeps";
import PageClientes   from "../pages/PageClientes";
import PageLogs       from "../pages/PageLogs";
import PageSuporte    from "../pages/PageSuporte";
import PageUsers      from "../pages/PageUsers";
import PagePlanos     from "../pages/PagePlanos";

const NAV_ITEMS = [
  {id:"dashboard",label:"Dashboard",    ico:"▦", g:"principal"},
  {id:"leads",    label:"Leads",        ico:"◎", g:"principal"},
  {id:"pipeline", label:"Funil",        ico:"⬡", g:"principal"},
  {id:"whatsapp", label:"Chat",         ico:"◈", g:"comunicação"},
  {id:"broadcast",label:"Disparos",     ico:"◉", g:"comunicação"},
  {id:"followup", label:"Follow-ups",   ico:"◷", g:"atividades"},
  {id:"reports",  label:"Relatórios",   ico:"◫", g:"analytics"},
  {id:"ai",       label:"C4 AI",        ico:"✦", g:"analytics"},
  {id:"empresa",  label:"Minha Empresa",ico:"⊞", g:"empresa"},
  {id:"equipe",   label:"Equipe",       ico:"◉", g:"empresa"},
  {id:"departs",  label:"Departamentos",ico:"⬡", g:"empresa"},
];

const ADMIN_ITEMS = [
  {id:"clientes",label:"Clientes",    ico:"⊞", g:"c4hub"},
  {id:"logs",    label:"Logs",        ico:"≡", g:"c4hub"},
  {id:"suporte", label:"Suporte",     ico:"⊙", g:"c4hub"},
  {id:"users",   label:"Usuários",    ico:"◉", g:"c4hub"},
  {id:"planos",  label:"Planos",      ico:"★", g:"c4hub"},
];

import { hasFullAccess, hasPageAccess } from "../lib/auth";

const ADMIN_ONLY = new Set(["clientes","logs","suporte","users","planos"]);

export default function Shell({user,onLogout,onProfileUpdate}) {
  const [sec,setSec] = useState("dashboard");
  const [col,setCol] = useState(false);
  const [mobOpen,setMobOpen] = useState(false);
  const [perfilOpen,setPerfilOpen] = useState(false);
  const { isMobile, isTablet } = useBreakpoint();
  const isAdmin = hasFullAccess(user);

  // Auto-collapse sidebar on tablet
  useEffect(() => {
    if (isTablet) setCol(true);
  }, [isTablet]);

  const navigate = useCallback((id) => {
    setSec(id);
    if (isMobile) setMobOpen(false);
  }, [isMobile]);

  // Injeta pixels de analytics da empresa
  useEffect(() => {
    if (!user?.empresa_id) return;
    supabase.from("empresas").select("meta_pixel_id, ga4_measurement_id").eq("id", user.empresa_id).single()
      .then(({ data }) => {
        if (data?.meta_pixel_id) injectMetaPixel(data.meta_pixel_id);
        if (data?.ga4_measurement_id) injectGA4(data.ga4_measurement_id);
      });
  }, [user?.empresa_id]);

  const allNav   = isAdmin ? [...NAV_ITEMS, ...ADMIN_ITEMS] : NAV_ITEMS;
  const navItems = allNav.filter(item =>
    ADMIN_ONLY.has(item.id) ? isAdmin : hasPageAccess(user, item.id)
  );
  const groups   = [...new Set(navItems.map(n => n.g))];
  const safe     = (!isAdmin && ADMIN_ONLY.has(sec)) ? "dashboard" : sec;
  const curr     = navItems.find(n => n.id === safe);

  const showCollapsed = isMobile ? false : col;

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:L.bg,fontFamily:"'Instrument Sans',sans-serif"}}>
      {/* Mobile overlay */}
      {isMobile && mobOpen && (
        <div className="sidebar-overlay" onClick={() => setMobOpen(false)} />
      )}
      {/* Sidebar */}
      <aside className={isMobile ? "sidebar-drawer" : undefined}
        style={isMobile ? {
          position:"fixed",top:0,left:0,bottom:0,width:240,
          background:L.white,borderRight:`1px solid ${L.line}`,
          display:"flex",flexDirection:"column",
          zIndex:20,boxShadow:"4px 0 20px rgba(0,0,0,0.14)",
          transform:mobOpen?"translateX(0)":"translateX(-100%)",
          transition:"transform .22s ease",overflow:"hidden",
        } : {
          width:col?56:220,minWidth:col?56:220,
          background:L.white,borderRight:`1px solid ${L.line}`,
          display:"flex",flexDirection:"column",
          transition:"width .22s ease,min-width .22s ease",
          overflow:"hidden",position:"relative",zIndex:20,flexShrink:0,
          boxShadow:"2px 0 12px rgba(0,0,0,0.04)",
        }}>
        {/* Logo */}
        <div style={{height:68,display:"flex",alignItems:"center",padding:showCollapsed?"0 8px":"0 14px",gap:10,borderBottom:`1px solid ${L.lineSoft}`,flexShrink:0,justifyContent:showCollapsed?"center":"flex-start"}}>
          <Logo size={showCollapsed?44:52}/>
          {!showCollapsed && (
            <div style={{animation:"px .2s ease"}}>
              <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:16,color:L.t1,lineHeight:1,letterSpacing:"-.3px"}}>C4 <span style={{color:L.teal}}>OS</span></div>
              <div style={{fontSize:9,color:L.t4,letterSpacing:"2px",textTransform:"uppercase",marginTop:1,fontFamily:"'JetBrains Mono',monospace"}}>by C4HUB</div>
            </div>
          )}
        </div>

        {/* Tenant badge */}
        {!showCollapsed && (
          <div style={{margin:"10px 12px 6px",padding:"8px 11px",borderRadius:8,background:isAdmin?L.tealBg:L.copperBg,border:`1px solid ${isAdmin?L.teal:L.copper}22`}}>
            <div style={{fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",color:isAdmin?L.teal:L.copper,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:isAdmin?L.teal:L.copper,display:"inline-block"}}/>
              {isAdmin ? "C4HUB ADMIN" : user.empresa}
            </div>
            <div style={{fontSize:11,color:L.t2,fontWeight:500}}>{user.nome}</div>
          </div>
        )}

        {/* Nav */}
        <nav style={{flex:1,overflowY:"auto",padding:"8px 8px"}}>
          {groups.map(g => (
            <div key={g} style={{marginBottom:6}}>
              {!showCollapsed && <div style={{fontSize:9,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:L.t5,padding:"6px 9px 4px",fontFamily:"'JetBrains Mono',monospace"}}>{g}</div>}
              {navItems.filter(n => n.g === g).map(item => {
                const on = safe === item.id;
                return (
                  <button key={item.id} onClick={()=>navigate(item.id)} title={showCollapsed?item.label:undefined}
                    style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:showCollapsed?"10px 0":"7px 10px",justifyContent:showCollapsed?"center":"flex-start",background:on?L.tealBg:"transparent",boxShadow:(!showCollapsed&&on)?`inset 2px 0 0 ${L.teal}`:"none",outline:"none",border:"none",borderRadius:showCollapsed?8:"0 8px 8px 0",cursor:"pointer",marginBottom:1,color:on?L.teal:L.t3,fontSize:12.5,fontFamily:"inherit",fontWeight:on?600:400,transition:"all .12s"}}
                    onMouseEnter={e=>{if(!on){e.currentTarget.style.background=L.surface;e.currentTarget.style.color=L.t2;}}}
                    onMouseLeave={e=>{if(!on){e.currentTarget.style.background="transparent";e.currentTarget.style.color=L.t3;}}}
                  >
                    <span style={{fontSize:13,flexShrink:0,opacity:on?1:.6}}>{item.ico}</span>
                    {!showCollapsed && <span style={{whiteSpace:"nowrap"}}>{item.label}</span>}
                    {!showCollapsed && item.id==="ai" && (
                      <span style={{marginLeft:"auto",background:L.tealBg,color:L.teal,borderRadius:4,padding:"1px 6px",fontSize:8,fontWeight:700,letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace",border:`1px solid ${L.teal}22`}}>AI</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{padding:"10px 8px",borderTop:`1px solid ${L.lineSoft}`,flexShrink:0}}>
          <div
            style={{display:"flex",alignItems:"center",gap:9,padding:showCollapsed?"8px 0":"8px 10px",borderRadius:8,background:L.surface,justifyContent:showCollapsed?"center":"flex-start",cursor:"pointer",transition:"background .12s"}}
            onClick={()=>setPerfilOpen(true)}
            title="Editar perfil"
            onMouseEnter={e=>e.currentTarget.style.background=L.hover}
            onMouseLeave={e=>e.currentTarget.style.background=L.surface}
          >
            <Av name={user.nome} color={user.cor} size={28} src={user.foto_url}/>
            {!showCollapsed && (
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:L.t1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.nome}</div>
                <div style={{fontSize:10,color:L.t3,whiteSpace:"nowrap"}}>{user.cargo}</div>
              </div>
            )}
            {!showCollapsed && (
              <button onClick={e=>{e.stopPropagation();onLogout();}}
                style={{background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:13,padding:4,transition:"color .12s",flexShrink:0}}
                onMouseEnter={e=>e.currentTarget.style.color=L.red}
                onMouseLeave={e=>e.currentTarget.style.color=L.t4}
              >⊗</button>
            )}
          </div>
        </div>

        {/* Collapse toggle (desktop only) */}
        {!isMobile && (
          <button onClick={()=>setCol(p=>!p)}
            style={{position:"absolute",top:20,right:-10,width:20,height:20,borderRadius:"50%",background:L.white,border:`1.5px solid ${L.line}`,color:L.t3,fontSize:9,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .12s",zIndex:30,boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=L.teal;e.currentTarget.style.color=L.teal;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t3;}}
          >
            {col?"›":"‹"}
          </button>
        )}
      </aside>

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        {/* Header */}
        <header style={{height:58,minHeight:58,flexShrink:0,background:L.white,borderBottom:`1px solid ${L.line}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:isMobile?"0 14px":"0 24px",gap:12,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {isMobile && (
              <button onClick={()=>setMobOpen(p=>!p)}
                style={{background:"none",border:`1px solid ${L.line}`,borderRadius:8,padding:"6px 9px",cursor:"pointer",color:L.t2,fontSize:15,lineHeight:1,transition:"all .12s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=L.teal;e.currentTarget.style.color=L.teal;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t2;}}
              >☰</button>
            )}
            <span style={{fontSize:isMobile?13:15,fontFamily:"'Outfit',sans-serif",fontWeight:700,color:L.t1,letterSpacing:"-.2px"}}>{curr?.label}</span>
            {!isAdmin && !isMobile && <Chip color={L.copper}>{user.empresa}</Chip>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {!isMobile && (
              <div style={{display:"flex",alignItems:"center",gap:7,background:L.surface,border:`1px solid ${L.line}`,borderRadius:8,padding:"6px 12px"}}>
                <span style={{color:L.t4,fontSize:13}}>⌕</span>
                <input placeholder="Buscar..." style={{background:"none",border:"none",outline:"none",color:L.t1,fontSize:12,width:150,fontFamily:"inherit"}}/>
              </div>
            )}
            <Chip color={L.green} dot>Online</Chip>
          </div>
        </header>

        {/* Modal de perfil */}
        {perfilOpen && (
          <ModalPerfil
            user={user}
            onClose={()=>setPerfilOpen(false)}
            onUpdate={(updated)=>{ onProfileUpdate?.(updated); setPerfilOpen(false); }}
          />
        )}

        {/* Content */}
        <div style={{flex:1,overflow:"auto",padding:isMobile?"14px":"24px"}}>
          {safe==="dashboard" && <PageDashboard user={user}/>}
          {safe==="leads"     && <PageLeads     user={user}/>}
          {safe==="pipeline"  && <PagePipeline  user={user}/>}
          {safe==="whatsapp"  && <PageChat      user={user}/>}
          {safe==="broadcast" && <PageBroadcast user={user}/>}
          {safe==="followup"  && <PageFollowUp  user={user}/>}
          {safe==="reports"   && <PageReports   user={user}/>}
          {safe==="ai"        && <PageAI        user={user}/>}
          {safe==="empresa"   && <PageEmpresa   user={user} empresa={user.empresa}/>}
          {safe==="equipe"    && <PageEquipe    user={user}/>}
          {safe==="departs"   && <PageDeps      user={user}/>}
          {safe==="clientes"  && isAdmin && <PageClientes user={user}/>}
          {safe==="logs"      && isAdmin && <PageLogs     user={user}/>}
          {safe==="suporte"   && isAdmin && <PageSuporte  user={user}/>}
          {safe==="users"     && isAdmin && <PageUsers    user={user}/>}
          {safe==="planos"    && isAdmin && <PagePlanos   user={user}/>}
        </div>
      </div>
    </div>
  );
}
