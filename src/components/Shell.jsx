import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useBreakpoint } from "../hooks/useBreakpoint";
import Logo from "./Logo";
import { Av, Chip } from "./ui";
import ModalPerfil from "./ModalPerfil";
import { L } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { injectMetaPixel, injectGA4 } from "../lib/analytics";

// Lazy load: cada página vira chunk separado — carregado só quando o usuário navega até ela
const PageDashboard        = lazy(() => import("../pages/PageDashboard"));
const PageLeads            = lazy(() => import("../pages/PageLeads"));
const PagePipeline         = lazy(() => import("../pages/PagePipeline"));
const PageChat             = lazy(() => import("../pages/PageChat"));
const PageBroadcast        = lazy(() => import("../pages/PageBroadcast"));
const PageChatbot          = lazy(() => import("../pages/PageChatbot"));
const PageFollowUp         = lazy(() => import("../pages/PageFollowUp"));
const PageReports          = lazy(() => import("../pages/PageReports"));
const PageAI               = lazy(() => import("../pages/PageAI"));
const PageEmpresa          = lazy(() => import("../pages/PageEmpresa"));
const PageEquipe           = lazy(() => import("../pages/PageEquipe"));
const PageDeps             = lazy(() => import("../pages/PageDeps"));
const PageFinanceiro       = lazy(() => import("../pages/PageFinanceiro"));
const PageRH               = lazy(() => import("../pages/PageRH"));
const PageMarketing        = lazy(() => import("../pages/PageMarketing"));
const PageDigital          = lazy(() => import("../pages/PageDigital"));
const PageWorkspace        = lazy(() => import("../pages/PageWorkspace"));
const PageAgenda           = lazy(() => import("../pages/PageAgenda"));
const PageContratos        = lazy(() => import("../pages/PageContratos"));
const PagePropostas        = lazy(() => import("../pages/PagePropostas"));
const PageEstoque          = lazy(() => import("../pages/PageEstoque"));
const PageClientes         = lazy(() => import("../pages/PageClientes"));
const PageLogs             = lazy(() => import("../pages/PageLogs"));
const PageSuporte          = lazy(() => import("../pages/PageSuporte"));
const PageUsers            = lazy(() => import("../pages/PageUsers"));
const PagePlanos           = lazy(() => import("../pages/PagePlanos"));
const PageSetores          = lazy(() => import("../pages/PageSetores"));
const PageEtiquetas        = lazy(() => import("../pages/PageEtiquetas"));
const PageChatbotBuilder   = lazy(() => import("../pages/PageChatbotBuilder"));
const PageDisparos         = lazy(() => import("../pages/PageDisparos"));
const PageRelatoriosAtend  = lazy(() => import("../pages/PageRelatoriosAtend"));
const PageMeta             = lazy(() => import("../pages/PageMeta"));
const PageCheckoutAdmin    = lazy(() => import("../pages/PageCheckoutAdmin"));

const NAV_ITEMS = [
  {id:"dashboard",  label:"Dashboard",      ico:"▦", g:"principal"},
  {id:"leads",      label:"Leads",          ico:"◎", g:"principal"},
  {id:"pipeline",   label:"Pipeline",       ico:"⬡", g:"principal"},
  {id:"whatsapp",   label:"WhatsApp",       ico:"◈",  g:"comunicação"},
  {id:"chatbot",    label:"Chatbot",        ico:"🤖", g:"comunicação"},
  {id:"chatbotbuilder",  label:"Fluxo Visual",   ico:"⬡", g:"comunicação"},
  {id:"disparos",   label:"Disparos",       ico:"◉",  g:"comunicação"},
  {id:"workspace",  label:"Workspace",      ico:"◫",  g:"comunicação"},
  {id:"followup",   label:"Follow-ups",     ico:"◷", g:"atividades"},
  {id:"agenda",     label:"Agenda",         ico:"◷", g:"atividades"},
  {id:"financeiro", label:"Financeiro",     ico:"◈", g:"gestão"},
  {id:"rh",         label:"RH / Pessoas",   ico:"◉", g:"gestão"},
  {id:"marketing",  label:"Marketing",      ico:"◎", g:"crescimento", c4hubOnly:true},
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
  {id:"clientes",   label:"Clientes",    ico:"⊞", g:"c4hub"},
  {id:"logs",       label:"Logs",        ico:"≡", g:"c4hub"},
  {id:"suporte",    label:"Suporte",     ico:"⊙", g:"c4hub"},
  {id:"users",      label:"Usuários",    ico:"◉", g:"c4hub"},
  {id:"planos",     label:"Planos",      ico:"★", g:"c4hub"},
  {id:"checkout",   label:"Pg. Checkout",ico:"✓", g:"c4hub"},
];

import { hasFullAccess, hasPageAccess } from "../lib/auth";

// Visível somente para c4hub_admin
const STRICT_ADMIN_ONLY = new Set(["logs","users","planos","checkout"]);
// Visível para c4hub_admin E c4hub_vendedor
const C4HUB_TEAM_ONLY   = new Set(["clientes","suporte","reports","meta","relatoriosatend"]);
const ADMIN_ONLY = new Set([...STRICT_ADMIN_ONLY, ...C4HUB_TEAM_ONLY]);

export default function Shell({user,onLogout,onProfileUpdate,theme,toggleTheme}) {
  const [sec,setSec] = useState("dashboard");
  const [col,setCol] = useState(false);
  const [mobOpen,setMobOpen] = useState(false);
  const [perfilOpen,setPerfilOpen] = useState(false);
  const [chatTarget,setChatTarget] = useState(null); // telefone para auto-abrir no WhatsApp
  const [totalNaoLidas,setTotalNaoLidas] = useState(0);
  const { isMobile, isTablet } = useBreakpoint();
  const isAdmin       = hasFullAccess(user);
  const isC4HubAdmin  = user?.role === "c4hub_admin";
  const isC4HubVendedor = user?.role === "c4hub_vendedor";

  // Auto-collapse sidebar on tablet
  useEffect(() => {
    if (isTablet) setCol(true);
  }, [isTablet]);

  useEffect(() => {
    if (!user?.empresa_id) return;
    const fetchUnread = async () => {
      const { data } = await supabase
        .from("conversas")
        .select("nao_lidas")
        .eq("empresa_id", user.empresa_id);
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

  // Injeta pixels de analytics da empresa
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

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:L.bg,fontFamily:"'Instrument Sans',sans-serif"}}>
      {/* Mobile overlay */}
      {isMobile && mobOpen && (
        <div className="sidebar-overlay" onClick={() => setMobOpen(false)} />
      )}
      {/* Sidebar wrapper — position:relative permite o botão sair para a direita sem ser cortado */}
      <div style={{position:"relative",flexShrink:0,display:"flex"}}>
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
        <div style={{height:68,display:"flex",alignItems:"center",padding:showCollapsed?"0 8px":"0 14px",gap:10,flexShrink:0,justifyContent:showCollapsed?"center":"flex-start",position:"relative"}}>
          <Logo size={showCollapsed?44:52}/>
          {!showCollapsed && (
            <div style={{animation:"px .2s ease"}}>
              <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:16,color:L.t1,lineHeight:1,letterSpacing:"-.3px"}}>C4 <span style={{color:L.accent}}>OS</span></div>
              <div style={{fontSize:9,color:L.t4,letterSpacing:"2px",textTransform:"uppercase",marginTop:1,fontFamily:"'JetBrains Mono',monospace"}}>by C4HUB</div>
            </div>
          )}
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:1,background:`linear-gradient(90deg,var(--c-accent),transparent)`}}/>
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
                background: isC4HubAdmin ? L.teal : isC4HubVendedor ? L.green : L.copper,
                display:"inline-block"}}/>
              {isC4HubAdmin ? "C4HUB ADMIN" : isC4HubVendedor ? "VENDEDOR C4HUB" : user.empresa}
            </div>
            <div style={{fontSize:11,color:L.t2,fontWeight:500}}>{user.nome}</div>
          </div>
        )}

        {/* Nav */}
        <nav style={{flex:1,overflowY:"auto",padding:"8px 8px"}}>
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
                    style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:showCollapsed?"10px 0":"7px 10px",justifyContent:showCollapsed?"center":"flex-start",background:on?L.tealA:"transparent",border:on?`1px solid ${L.tealA2}`:"1px solid transparent",outline:"none",borderRadius:8,cursor:"pointer",marginBottom:1,color:on?L.teal:L.t3,fontSize:12.5,fontFamily:"inherit",fontWeight:on?600:400,transition:"all .12s",boxShadow:on?`0 2px 8px ${L.tealA}`:"none",position:"relative"}}
                    onMouseEnter={e=>{if(!on){e.currentTarget.style.background=L.surface;e.currentTarget.style.color=L.t2;e.currentTarget.style.borderColor=L.lineSoft;}}}
                    onMouseLeave={e=>{if(!on){e.currentTarget.style.background="transparent";e.currentTarget.style.color=L.t3;e.currentTarget.style.borderColor="transparent";}}}
                  >
                    <span style={{fontSize:13,flexShrink:0,opacity:on?1:.7,transition:"opacity .12s"}}>{item.ico}</span>
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
        <div style={{padding:"10px 8px",borderTop:`1px solid ${L.lineSoft}`,flexShrink:0,background:L.surface}}>
          <div
            style={{display:"flex",alignItems:"center",gap:9,padding:showCollapsed?"8px 0":"8px 10px",borderRadius:9,background:L.white,border:`1px solid ${L.line}`,justifyContent:showCollapsed?"center":"flex-start",cursor:"pointer",transition:"all .12s",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}
            onClick={()=>setPerfilOpen(true)}
            title="Editar perfil"
            onMouseEnter={e=>{e.currentTarget.style.borderColor=L.tealA2;e.currentTarget.style.boxShadow=`0 2px 8px ${L.tealA}`;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";}}
          >
            <Av name={user.nome} color={user.cor} size={28} src={user.foto_url}/>
            {!showCollapsed && (
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:L.t1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.nome}</div>
                <div style={{fontSize:10,color:L.t3,whiteSpace:"nowrap"}}>{user.cargo||"—"}</div>
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

      </aside>

        {/* Collapse toggle — fora do aside para não ser cortado pelo overflow:hidden */}
        {!isMobile && (
          <button onClick={()=>setCol(p=>!p)}
            style={{position:"absolute",top:"50%",right:-16,transform:"translateY(-50%)",width:16,height:48,borderRadius:"0 8px 8px 0",background:L.white,border:`1.5px solid ${L.line}`,borderLeft:"none",color:L.t3,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",zIndex:30,boxShadow:"3px 0 8px rgba(0,0,0,0.08)",padding:0}}
            onMouseEnter={e=>{e.currentTarget.style.background=L.accent;e.currentTarget.style.borderColor=L.accent;e.currentTarget.style.color="white";e.currentTarget.style.width="20px";}}
            onMouseLeave={e=>{e.currentTarget.style.background=L.white;e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t3;e.currentTarget.style.width="16px";}}
          >
            {col?"›":"‹"}
          </button>
        )}
      </div>

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        {/* Header */}
        <header style={{height:58,minHeight:58,flexShrink:0,background:L.white,borderBottom:`1px solid ${L.line}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:isMobile?"0 14px":"0 24px",gap:12,boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {isMobile && (
              <button onClick={()=>setMobOpen(p=>!p)}
                style={{background:"none",border:`1px solid ${L.line}`,borderRadius:8,padding:"6px 9px",cursor:"pointer",color:L.t2,fontSize:15,lineHeight:1,transition:"all .12s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=L.accent;e.currentTarget.style.color=L.accent;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t2;}}
              >☰</button>
            )}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:3,height:18,borderRadius:2,background:L.accent,flexShrink:0}}/>
              <span style={{fontSize:isMobile?13:15,fontFamily:"'Outfit',sans-serif",fontWeight:700,color:L.t1,letterSpacing:"-.2px"}}>{curr?.label}</span>
            </div>
            {!isAdmin && !isMobile && <Chip color={L.copper}>{user.empresa}</Chip>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {!isMobile && (
              <div style={{display:"flex",alignItems:"center",gap:7,background:L.surface,border:`1px solid ${L.line}`,borderRadius:20,padding:"6px 14px",transition:"all .15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=L.tealA2;e.currentTarget.style.boxShadow=`0 0 0 3px ${L.tealA}`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.boxShadow="none";}}
              >
                <span style={{color:L.t4,fontSize:13}}>⌕</span>
                <input placeholder="Buscar..." style={{background:"none",border:"none",outline:"none",color:L.t1,fontSize:12,width:150,fontFamily:"inherit"}}/>
              </div>
            )}
            <Chip color={L.green} dot>Online</Chip>
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
              style={{background:L.surface,border:`1px solid ${L.line}`,borderRadius:9,padding:"5px 9px",cursor:"pointer",color:L.t3,fontSize:15,lineHeight:1,transition:"all .15s",flexShrink:0}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=L.accent;e.currentTarget.style.color=L.accent;e.currentTarget.style.background=L.tealA;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=L.line;e.currentTarget.style.color=L.t3;e.currentTarget.style.background=L.surface;}}
            >
              {theme === "dark" ? "☀" : "☽"}
            </button>
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
          {safe==="digital"   && <PageDigital   user={user} isAdmin={isAdmin}/>}
          {safe==="workspace" && <PageWorkspace user={user}/>}
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
          {safe==="checkout"  && isC4HubAdmin && <PageCheckoutAdmin  user={user}/>}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
