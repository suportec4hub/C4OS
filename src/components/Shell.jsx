import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useBreakpoint } from "../hooks/useBreakpoint";
import Logo from "./Logo";
import { Av, Chip } from "./ui";
import ModalPerfil from "./ModalPerfil";
import NotificacoesBell from "./NotificacoesBell";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { injectMetaPixel, injectGA4 } from "../lib/analytics";

// After a new deploy, chunk hashes change. If the old chunk no longer exists on
// the server the dynamic import rejects. This wrapper retries once then reloads
// the page so the browser fetches the updated manifest automatically.
function lazyLoad(factory) {
  return lazy(() =>
    factory().catch(() =>
      factory().catch(() => { window.location.reload(); return new Promise(() => {}); })
    )
  );
}

const PageDashboard        = lazyLoad(() => import("../pages/PageDashboard"));
const PageLeads            = lazyLoad(() => import("../pages/PageLeads"));
const PagePipeline         = lazyLoad(() => import("../pages/PagePipeline"));
const PageChat             = lazyLoad(() => import("../pages/PageChat"));
const PageBroadcast        = lazyLoad(() => import("../pages/PageBroadcast"));
const PageChatbot          = lazyLoad(() => import("../pages/PageChatbot"));
const PageFollowUp         = lazyLoad(() => import("../pages/PageFollowUp"));
const PageReports          = lazyLoad(() => import("../pages/PageReports"));
const PageAI               = lazyLoad(() => import("../pages/PageAI"));
const PageEmpresa          = lazyLoad(() => import("../pages/PageEmpresa"));
const PageEquipe           = lazyLoad(() => import("../pages/PageEquipe"));
const PageDeps             = lazyLoad(() => import("../pages/PageDeps"));
const PageFinanceiro       = lazyLoad(() => import("../pages/PageFinanceiro"));
const PageRH               = lazyLoad(() => import("../pages/PageRH"));
const PageMarketing        = lazyLoad(() => import("../pages/PageMarketing"));
const PageDigital          = lazyLoad(() => import("../pages/PageDigital"));
const PageAgenda           = lazyLoad(() => import("../pages/PageAgenda"));
const PageContratos        = lazyLoad(() => import("../pages/PageContratos"));
const PagePropostas        = lazyLoad(() => import("../pages/PagePropostas"));
const PageEstoque          = lazyLoad(() => import("../pages/PageEstoque"));
const PageClientes         = lazyLoad(() => import("../pages/PageClientes"));
const PageLogs             = lazyLoad(() => import("../pages/PageLogs"));
const PageSuporte          = lazyLoad(() => import("../pages/PageSuporte"));
const PageUsers            = lazyLoad(() => import("../pages/PageUsers"));
const PagePlanos           = lazyLoad(() => import("../pages/PagePlanos"));
const PageSetores          = lazyLoad(() => import("../pages/PageSetores"));
const PageEtiquetas        = lazyLoad(() => import("../pages/PageEtiquetas"));
const PageChatbotBuilder   = lazyLoad(() => import("../pages/PageChatbotBuilder"));
const PageDisparos         = lazyLoad(() => import("../pages/PageDisparos"));
const PageRelatoriosAtend  = lazyLoad(() => import("../pages/PageRelatoriosAtend"));
const PageMeta             = lazyLoad(() => import("../pages/PageMeta"));
const PageCheckoutAdmin    = lazyLoad(() => import("../pages/PageCheckoutAdmin"));
const PageNotificacoesAdmin = lazyLoad(() => import("../pages/PageNotificacoesAdmin"));
const PageTrafico          = lazyLoad(() => import("../pages/PageTrafico"));

const NAV_ITEMS = [
  {id:"dashboard",  label:"Dashboard",      ico:"▦", g:"principal"},
  {id:"leads",      label:"Leads",          ico:"◎", g:"principal"},
  {id:"pipeline",   label:"Pipeline",       ico:"⬡", g:"principal"},
  {id:"whatsapp",   label:"WhatsApp",       ico:"◈",  g:"comunicação"},
  {id:"chatbot",    label:"Chatbot",        ico:"🤖", g:"comunicação"},
  {id:"chatbotbuilder",  label:"Fluxo Visual",   ico:"⬡", g:"comunicação"},
  {id:"disparos",   label:"Disparos",       ico:"◉",  g:"comunicação"},
  {id:"followup",   label:"Follow-ups",     ico:"◷", g:"atividades"},
  {id:"agenda",     label:"Agenda",         ico:"◷", g:"atividades"},
  {id:"financeiro", label:"Financeiro",     ico:"◈", g:"gestão"},
  {id:"rh",         label:"RH / Pessoas",   ico:"◉", g:"gestão"},
  {id:"marketing",  label:"Marketing",      ico:"◎", g:"crescimento", c4hubOnly:true},
  {id:"trafico",    label:"Tráfego Pago",   ico:"◉", g:"crescimento", c4hubOnly:true},
  {id:"digital",    label:"Digital - TI",   ico:"⊞", g:"crescimento"},
  {id:"propostas",  label:"Propostas",      ico:"◎", g:"negócios"},
  {id:"contratos",  label:"Contratos",      ico:"◫", g:"negócios"},
  {id:"estoque",    label:"Estoque",        ico:"⬡", g:"operações"},
  {id:"meta",         label:"Metas",         ico:"🎯",  g:"analytics"},
  {id:"reports",      label:"Relatórios",    ico:"◫",  g:"analytics"},
  {id:"relatoriosatend", label:"Atendimento",ico:"📊", g:"analytics"},
  {id:"ai",           label:"C4 AI",         ico:"✦",  g:"analytics"},
  {id:"empresa",      label:"Minha Empresa", ico:"⊞",  g:"empresa"},
  {id:"equipe",       label:"Equipe",        ico:"◉",  g:"empresa"},
  {id:"departs",      label:"Departamentos", ico:"⬡",  g:"empresa"},
  {id:"setores",      label:"Setores",       ico:"🏢",  g:"empresa"},
  {id:"etiquetas",    label:"Etiquetas",     ico:"🏷️", g:"empresa"},
];

const ADMIN_ITEMS = [
  {id:"clientes",      label:"Clientes",       ico:"⊞", g:"c4hub"},
  {id:"logs",          label:"Logs",           ico:"≡", g:"c4hub"},
  {id:"suporte",       label:"Suporte",        ico:"⊙", g:"c4hub"},
  {id:"users",         label:"Usuários",       ico:"◉", g:"c4hub"},
  {id:"planos",        label:"Planos",         ico:"★", g:"c4hub"},
  {id:"checkout",      label:"Pg. Checkout",   ico:"✓", g:"c4hub"},
  {id:"notificacoes",  label:"Notificações",   ico:"🔔", g:"c4hub"},
];

import { hasFullAccess, hasPageAccess } from "../lib/auth";

// Visível somente para c4hub_admin
const STRICT_ADMIN_ONLY = new Set(["logs","users","planos","checkout","notificacoes"]);
// Visível para c4hub_admin E c4hub_vendedor
const C4HUB_TEAM_ONLY   = new Set(["clientes","suporte","reports","meta","relatoriosatend"]);
const ADMIN_ONLY = new Set([...STRICT_ADMIN_ONLY, ...C4HUB_TEAM_ONLY]);

// Bottom nav items for mobile (top 5 + "mais")
const BOTTOM_NAV = ["dashboard", "whatsapp", "leads", "followup", "agenda"];

export default function Shell({user,onLogout,onProfileUpdate,theme,toggleTheme}) {
  const [sec,setSec] = useState("dashboard");
  const [col,setCol] = useState(false);
  const [mobOpen,setMobOpen] = useState(false);
  const [perfilOpen,setPerfilOpen] = useState(false);
  const [chatTarget,setChatTarget] = useState(null);
  const [totalNaoLidas,setTotalNaoLidas] = useState(0);
  const { isMobile, isTablet } = useBreakpoint();
  const isAdmin       = hasFullAccess(user);
  const isC4HubAdmin  = user?.role === "c4hub_admin";
  const isC4HubVendedor = user?.role === "c4hub_vendedor";

  // Auto-collapse sidebar on tablet
  useEffect(() => { if (isTablet) setCol(true); }, [isTablet]);

  useEffect(() => {
    if (!user?.empresa_id) return;
    const fetchUnread = async () => {
      const { data } = await supabase.from("conversas").select("nao_lidas").eq("empresa_id", user.empresa_id);
      const total = (data || []).reduce((s, c) => s + (c.nao_lidas || 0), 0);
      setTotalNaoLidas(total);
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    const channel = supabase
      .channel("shell-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversas", filter: `empresa_id=eq.${user.empresa_id}` }, fetchUnread)
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [user?.empresa_id]);

  const navigate = useCallback((id) => {
    setSec(id);
    if (isMobile) setMobOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!user?.empresa_id) return;
    supabase.from("empresas").select("meta_pixel_id, ga4_measurement_id").eq("id", user.empresa_id).single()
      .then(({ data }) => {
        if (data?.meta_pixel_id) injectMetaPixel(data.meta_pixel_id);
        if (data?.ga4_measurement_id) injectGA4(data.ga4_measurement_id);
      });
  }, [user?.empresa_id]);

  const isC4HubTeam = isC4HubAdmin || isC4HubVendedor;
  const allNav   = isC4HubTeam ? [...NAV_ITEMS, ...ADMIN_ITEMS] : NAV_ITEMS;
  const navItems = allNav.filter(item => {
    if (STRICT_ADMIN_ONLY.has(item.id)) return isC4HubAdmin;
    if (C4HUB_TEAM_ONLY.has(item.id))  return isC4HubTeam;
    if (item.c4hubOnly && !isAdmin) return false;
    return hasPageAccess(user, item.id);
  });
  const groups   = [...new Set(navItems.map(n => n.g))];
  const safe     = (!isC4HubTeam && ADMIN_ONLY.has(sec)) ? "dashboard" : sec;
  const curr     = navItems.find(n => n.id === safe);
  const showCollapsed = isMobile ? false : col;

  // Bottom nav items — only visible ones
  const bottomItems = BOTTOM_NAV
    .map(id => navItems.find(n => n.id === id))
    .filter(Boolean);

  // Sidebar content (shared between drawer and desktop)
  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{height:isMobile?64:68,display:"flex",alignItems:"center",
        padding:showCollapsed?"0 8px":"0 14px",gap:10,flexShrink:0,
        justifyContent:showCollapsed?"center":"flex-start",position:"relative",
        paddingTop: isMobile ? "max(12px, env(safe-area-inset-top))" : undefined}}>
        <Logo size={showCollapsed?44:52}/>
        {!showCollapsed && (
          <div>
            <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:16,color:L.t1,lineHeight:1,letterSpacing:"-.3px"}}>C4 <span style={{color:L.accent}}>OS</span></div>
            <div style={{fontSize:9,color:L.t4,letterSpacing:"2px",textTransform:"uppercase",marginTop:1,fontFamily:"'JetBrains Mono',monospace"}}>by C4HUB</div>
          </div>
        )}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:1,background:`linear-gradient(90deg,var(--c-accent),transparent)`}}/>
        {/* Close drawer on mobile */}
        {isMobile && (
          <button onClick={()=>setMobOpen(false)}
            style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",
              color:L.t3,fontSize:20,lineHeight:1,padding:"8px",minWidth:44,minHeight:44,
              display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        )}
      </div>

      {/* Tenant badge */}
      {!showCollapsed && (
        <div style={{margin:"10px 12px 6px",padding:"8px 11px",borderRadius:8,
          background: isC4HubAdmin ? L.tealBg : isC4HubVendedor ? L.greenBg : L.copperBg,
          border:`1px solid ${isC4HubAdmin ? L.tealA : isC4HubVendedor ? L.greenA : L.copperA}`}}>
          <div style={{fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",
            color: isC4HubAdmin ? L.teal : isC4HubVendedor ? L.green : L.copper,
            fontWeight:700,fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
            <span style={{width:5,height:5,borderRadius:"50%",
              background: isC4HubAdmin ? L.teal : isC4HubVendedor ? L.green : L.copper,display:"inline-block"}}/>
            {isC4HubAdmin ? "C4HUB ADMIN" : isC4HubVendedor ? "VENDEDOR C4HUB" : user.empresa}
          </div>
          <div style={{fontSize:11,color:L.t2,fontWeight:500}}>{user.nome}</div>
        </div>
      )}

      {/* Nav */}
      <nav style={{flex:1,overflowY:"auto",padding:"8px 8px",WebkitOverflowScrolling:"touch"}}>
        {groups.map(g => (
          <div key={g} style={{marginBottom:6}}>
            {!showCollapsed && (
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"8px 9px 4px"}}>
                <div style={{width:4,height:4,borderRadius:"50%",background:L.tealA2,flexShrink:0}}/>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:L.t4,fontFamily:"'JetBrains Mono',monospace",flex:1}}>{g}</div>
                <div style={{height:1,flex:1,background:L.lineSoft,maxWidth:40}}/>
              </div>
            )}
            {navItems.filter(n => n.g === g).map(item => {
              const on = safe === item.id;
              return (
                <button key={item.id} onClick={()=>navigate(item.id)} title={showCollapsed?item.label:undefined}
                  style={{display:"flex",alignItems:"center",gap:9,width:"100%",
                    padding:showCollapsed?"0":"8px 10px",height:showCollapsed?44:40,
                    justifyContent:showCollapsed?"center":"flex-start",
                    background:on?L.tealA:"transparent",
                    border:on?`1px solid ${L.tealA2}`:"1px solid transparent",
                    outline:"none",borderRadius:8,cursor:"pointer",marginBottom:2,
                    color:on?L.teal:L.t3,fontSize:12.5,fontFamily:"inherit",
                    fontWeight:on?600:400,transition:"all .12s",
                    boxShadow:on?`0 2px 8px ${L.tealA}`:"none",position:"relative",
                    minHeight:44, // touch target
                  }}
                  onMouseEnter={e=>{if(!on){e.currentTarget.style.background=L.surface;e.currentTarget.style.color=L.t2;e.currentTarget.style.borderColor=L.lineSoft;}}}
                  onMouseLeave={e=>{if(!on){e.currentTarget.style.background="transparent";e.currentTarget.style.color=L.t3;e.currentTarget.style.borderColor="transparent";}}}
                >
                  <span style={{fontSize:14,flexShrink:0,opacity:on?1:.7}}>{item.ico}</span>
                  {!showCollapsed && <span style={{whiteSpace:"nowrap"}}>{item.label}</span>}
                  {!showCollapsed && item.id==="ai" && (
                    <span style={{marginLeft:"auto",background:L.tealA,color:L.teal,borderRadius:4,padding:"1px 6px",fontSize:8,fontWeight:700,letterSpacing:"1px",fontFamily:"'JetBrains Mono',monospace",border:`1px solid ${L.tealA2}`}}>AI</span>
                  )}
                  {!showCollapsed && item.id==="whatsapp" && totalNaoLidas > 0 && (
                    <span style={{marginLeft:"auto",background:L.red,color:"white",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700,minWidth:18,textAlign:"center"}}>
                      {totalNaoLidas > 99 ? "99+" : totalNaoLidas}
                    </span>
                  )}
                  {showCollapsed && item.id==="whatsapp" && totalNaoLidas > 0 && (
                    <span style={{position:"absolute",top:6,right:6,background:L.red,color:"white",borderRadius:"50%",width:14,height:14,fontSize:8,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {totalNaoLidas > 9 ? "9+" : totalNaoLidas}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{padding:"10px 8px",borderTop:`1px solid ${L.lineSoft}`,flexShrink:0,background:L.surface,
        paddingBottom: isMobile ? "max(10px, env(safe-area-inset-bottom))" : "10px"}}>
        <div style={{display:"flex",alignItems:"center",gap:9,
          padding:showCollapsed?"8px 0":"8px 10px",borderRadius:9,background:L.white,
          border:`1px solid ${L.line}`,justifyContent:showCollapsed?"center":"flex-start",
          cursor:"pointer",transition:"all .12s",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",minHeight:48}}
          onClick={()=>setPerfilOpen(true)} title="Editar perfil">
          <Av name={user.nome} color={user.cor} size={28} src={user.foto_url}/>
          {!showCollapsed && (
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:L.t1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.nome}</div>
              <div style={{fontSize:10,color:L.t3,whiteSpace:"nowrap"}}>{user.cargo||"—"}</div>
            </div>
          )}
          {!showCollapsed && (
            <button onClick={e=>{e.stopPropagation();onLogout();}}
              style={{background:"none",border:"none",cursor:"pointer",color:L.t4,fontSize:16,
                padding:"8px",lineHeight:1,minWidth:36,minHeight:36,
                display:"flex",alignItems:"center",justifyContent:"center",
                flexShrink:0,borderRadius:6,transition:"all .12s"}}
              onMouseEnter={e=>e.currentTarget.style.color=L.red}
              onMouseLeave={e=>e.currentTarget.style.color=L.t4}
            >⊗</button>
          )}
        </div>
        {/* Theme toggle in sidebar on mobile */}
        {isMobile && (
          <button onClick={toggleTheme}
            style={{marginTop:8,width:"100%",background:L.white,border:`1px solid ${L.line}`,
              borderRadius:8,padding:"9px",cursor:"pointer",color:L.t3,fontSize:14,
              fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              minHeight:44}}>
            {theme === "dark" ? "☀ Modo claro" : "☽ Modo escuro"}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div style={{display:"flex",height:"100dvh",overflow:"hidden",background:L.bg,fontFamily:"'Instrument Sans',sans-serif"}}>

      {/* ── Mobile sidebar drawer ── */}
      {isMobile && (
        <>
          {mobOpen && <div className="sidebar-overlay" onClick={()=>setMobOpen(false)} style={{zIndex:25}}/>}
          <aside className="sidebar-drawer"
            style={{position:"fixed",top:0,left:0,bottom:0,width:260,
              background:L.white,borderRight:`1px solid ${L.line}`,
              display:"flex",flexDirection:"column",
              zIndex:26,boxShadow:"4px 0 20px rgba(0,0,0,0.18)",
              transform:mobOpen?"translateX(0)":"translateX(-100%)",
              transition:"transform .25s cubic-bezier(.25,.46,.45,.94)",overflow:"hidden"}}>
            {sidebarContent}
          </aside>
        </>
      )}

      {/* ── Desktop/tablet sidebar ── */}
      {!isMobile && (
        <div style={{position:"relative",flexShrink:0,display:"flex"}}>
          <aside style={{
            width:col?56:220,minWidth:col?56:220,
            background:L.white,borderRight:`1px solid ${L.line}`,
            display:"flex",flexDirection:"column",
            transition:"width .22s ease,min-width .22s ease",
            overflow:"hidden",position:"relative",zIndex:20,flexShrink:0,
            boxShadow:"2px 0 12px rgba(0,0,0,0.04)"}}>
            {sidebarContent}
          </aside>
          {/* Collapse toggle — tablet-friendly (wider) */}
          <button onClick={()=>setCol(p=>!p)}
            style={{position:"absolute",top:"50%",right:-20,transform:"translateY(-50%)",
              width:20,height:56,borderRadius:"0 10px 10px 0",
              background:L.white,border:`1.5px solid ${L.line}`,borderLeft:"none",
              color:L.t3,fontSize:12,cursor:"pointer",display:"flex",
              alignItems:"center",justifyContent:"center",transition:"all .15s",
              zIndex:30,boxShadow:"3px 0 8px rgba(0,0,0,0.08)",padding:0,
              // Larger invisible tap area on tablet
              minWidth: isTablet ? 32 : 20}}
            onMouseEnter={e=>{e.currentTarget.style.background=L.accent;e.currentTarget.style.borderColor=L.accent;e.currentTarget.style.color="white";}}
            onMouseLeave={e=>{e.currentTarget.style.background=L.white;e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t3;}}
          >
            {col?"›":"‹"}
          </button>
        </div>
      )}

      {/* ── Main ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        {/* Header */}
        <header style={{
          height: isMobile ? 52 : 58, minHeight: isMobile ? 52 : 58,
          flexShrink:0,background:L.white,borderBottom:`1px solid ${L.line}`,
          display:"flex",alignItems:"center",justifyContent:"space-between",
          padding: isMobile ? "0 12px" : "0 24px",
          gap: isMobile ? 8 : 12,
          boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
          paddingTop: isMobile ? "env(safe-area-inset-top)" : undefined,
        }}>
          <div style={{display:"flex",alignItems:"center",gap:isMobile?8:10}}>
            {/* Hamburger — mobile only */}
            {isMobile && (
              <button onClick={()=>setMobOpen(p=>!p)}
                style={{background:"none",border:`1px solid ${L.line}`,borderRadius:9,
                  cursor:"pointer",color:L.t2,fontSize:16,lineHeight:1,
                  minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center",
                  transition:"all .12s",flexShrink:0}}
              >☰</button>
            )}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:3,height:18,borderRadius:2,background:L.accent,flexShrink:0}}/>
              <span style={{fontSize:isMobile?13:15,fontFamily:"'Outfit',sans-serif",fontWeight:700,color:L.t1,letterSpacing:"-.2px"}}>{curr?.label}</span>
            </div>
            {!isAdmin && !isMobile && <Chip color={L.copper}>{user.empresa}</Chip>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:isMobile?6:8}}>
            {/* Search — desktop only */}
            {!isMobile && (
              <div style={{display:"flex",alignItems:"center",gap:7,background:L.surface,border:`1px solid ${L.line}`,borderRadius:20,padding:"6px 14px",transition:"all .15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=L.tealA2;e.currentTarget.style.boxShadow=`0 0 0 3px ${L.tealA}`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.boxShadow="none";}}>
                <span style={{color:L.t4,fontSize:13}}>⌕</span>
                <input placeholder="Buscar..." style={{background:"none",border:"none",outline:"none",color:L.t1,fontSize:12,width:150,fontFamily:"inherit"}}/>
              </div>
            )}
            {/* Online chip — hidden on mobile */}
            {!isMobile && <Chip color={L.green} dot>Online</Chip>}
            {/* Theme toggle — hidden on mobile (moved to sidebar footer) */}
            {!isMobile && (
              <button onClick={toggleTheme} title={theme === "dark" ? "Modo claro" : "Modo escuro"}
                style={{background:L.surface,border:`1px solid ${L.line}`,borderRadius:9,
                  padding:"5px 9px",cursor:"pointer",color:L.t3,fontSize:15,lineHeight:1,
                  transition:"all .15s",flexShrink:0,minWidth:36,minHeight:36,
                  display:"flex",alignItems:"center",justifyContent:"center"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=L.accent;e.currentTarget.style.color=L.accent;e.currentTarget.style.background=L.tealA;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t3;e.currentTarget.style.background=L.surface;}}>
                {theme === "dark" ? "☀" : "☽"}
              </button>
            )}
            {/* Notification bell — visible for all */}
            <NotificacoesBell user={user} />
            {/* Avatar on mobile */}
            {isMobile && (
              <button onClick={()=>setPerfilOpen(true)}
                style={{background:"none",border:"none",cursor:"pointer",padding:0,
                  minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Av name={user.nome} color={user.cor} size={30} src={user.foto_url}/>
              </button>
            )}
          </div>
        </header>

        {/* Perfil modal */}
        {perfilOpen && (
          <ModalPerfil user={user} onClose={()=>setPerfilOpen(false)}
            onUpdate={(updated)=>{ onProfileUpdate?.(updated); setPerfilOpen(false); }}/>
        )}

        {/* Content */}
        <div style={{flex:1,
          overflow: (isMobile && safe === "whatsapp") ? "hidden" : "auto",
          padding: (isMobile && safe === "whatsapp") ? 0 : (isMobile ? "12px" : "24px"),
          paddingBottom: (isMobile && safe === "whatsapp")
            ? 0
            : isMobile
              ? "calc(68px + env(safe-area-inset-bottom))"
              : "24px",
          WebkitOverflowScrolling: "touch",
        }}>
          <Suspense fallback={
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh",gap:12,flexDirection:"column"}}>
              <div style={{width:28,height:28,borderRadius:"50%",border:`3px solid ${L.tealA2}`,borderTopColor:L.accent,animation:"spin 0.8s linear infinite"}}/>
              <span style={{fontSize:12,color:L.t4,fontFamily:"'JetBrains Mono',monospace"}}>carregando...</span>
            </div>
          }>
          {safe==="dashboard" && <PageDashboard user={user}/>}
          {safe==="leads"     && <PageLeads     user={user} onOpenChat={(target)=>{ setChatTarget(target); setSec("whatsapp"); }}/>}
          {safe==="pipeline"  && <PagePipeline  user={user} onOpenChat={(phone)=>{ setChatTarget(phone); setSec("whatsapp"); }}/>}
          {safe==="whatsapp"       && <PageChat            user={user} openPhone={chatTarget} onChatTargetUsed={()=>setChatTarget(null)}/>}
          {safe==="chatbot"        && <PageChatbot         user={user}/>}
          {safe==="chatbotbuilder"  && <PageChatbotBuilder  user={user}/>}
          {safe==="disparos"       && <PageDisparos        user={user}/>}
          {safe==="broadcast"      && <PageBroadcast       user={user}/>}
          {safe==="followup"  && <PageFollowUp  user={user} onGoToChat={(leadId)=>navigate("whatsapp")}/>}
          {safe==="meta"            && <PageMeta           user={user}/>}
          {safe==="reports"         && <PageReports        user={user}/>}
          {safe==="relatoriosatend" && <PageRelatoriosAtend user={user}/>}
          {safe==="ai"              && <PageAI              user={user}/>}
          {safe==="financeiro" && <PageFinanceiro user={user}/>}
          {safe==="rh"        && <PageRH        user={user}/>}
          {safe==="marketing" && <PageMarketing user={user} isAdmin={isAdmin}/>}
          {safe==="trafico"  && <PageTrafico  user={user}/>}
          {safe==="digital"   && <PageDigital   user={user} isAdmin={isAdmin}/>}
          {safe==="agenda"    && <PageAgenda    user={user}/>}
          {safe==="contratos" && <PageContratos user={user}/>}
          {safe==="propostas" && <PagePropostas user={user}/>}
          {safe==="estoque"   && <PageEstoque   user={user}/>}
          {safe==="empresa"    && <PageEmpresa   user={user} empresa={user.empresa}/>}
          {safe==="equipe"     && <PageEquipe    user={user}/>}
          {safe==="departs"    && <PageDeps      user={user}/>}
          {safe==="setores"    && <PageSetores   user={user}/>}
          {safe==="etiquetas"  && <PageEtiquetas user={user}/>}
          {safe==="clientes"  && isC4HubTeam  && <PageClientes      user={user}/>}
          {safe==="suporte"   && isC4HubTeam  && <PageSuporte       user={user}/>}
          {safe==="logs"      && isC4HubAdmin && <PageLogs           user={user}/>}
          {safe==="users"     && isC4HubAdmin && <PageUsers          user={user}/>}
          {safe==="planos"    && isC4HubAdmin && <PagePlanos         user={user}/>}
          {safe==="checkout"      && isC4HubAdmin && <PageCheckoutAdmin      user={user}/>}
          {safe==="notificacoes"  && isC4HubAdmin && <PageNotificacoesAdmin  user={user}/>}
          </Suspense>
        </div>
      </div>

      {/* ── Bottom Navigation Bar (mobile only) ── */}
      {isMobile && (
        <nav style={{
          position:"fixed",bottom:0,left:0,right:0,zIndex:22,
          background:L.white,borderTop:`1px solid ${L.line}`,
          display:"flex",alignItems:"stretch",
          paddingBottom:"env(safe-area-inset-bottom)",
          boxShadow:"0 -2px 16px rgba(0,0,0,0.08)",
        }}>
          {bottomItems.map(item => {
            const on = safe === item.id;
            return (
              <button key={item.id} onClick={()=>navigate(item.id)}
                style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
                  justifyContent:"center",padding:"8px 4px",
                  background:"none",border:"none",cursor:"pointer",
                  color:on?L.accent:L.t4,fontFamily:"inherit",
                  transition:"color .12s",position:"relative",minHeight:56,
                  borderTop:on?`2px solid ${L.accent}`:"2px solid transparent"}}>
                <span style={{fontSize:18,lineHeight:1,marginBottom:3}}>{item.ico}</span>
                <span style={{fontSize:9,fontWeight:on?700:400,letterSpacing:"0.3px"}}>{item.label}</span>
                {item.id==="whatsapp" && totalNaoLidas > 0 && (
                  <span style={{position:"absolute",top:6,right:"calc(50% - 14px)",
                    background:L.red,color:"white",borderRadius:10,
                    padding:"1px 5px",fontSize:9,fontWeight:700,minWidth:16,textAlign:"center"}}>
                    {totalNaoLidas > 99 ? "99+" : totalNaoLidas}
                  </span>
                )}
              </button>
            );
          })}
          {/* "Mais" button → opens full sidebar drawer */}
          <button onClick={()=>setMobOpen(p=>!p)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
              justifyContent:"center",padding:"8px 4px",
              background:"none",border:"none",cursor:"pointer",
              color:mobOpen?L.accent:L.t4,fontFamily:"inherit",
              transition:"color .12s",minHeight:56,
              borderTop:mobOpen?`2px solid ${L.accent}`:"2px solid transparent"}}>
            <span style={{fontSize:18,lineHeight:1,marginBottom:3}}>⊞</span>
            <span style={{fontSize:9,fontWeight:mobOpen?700:400}}>Mais</span>
          </button>
        </nav>
      )}
    </div>
  );
}
