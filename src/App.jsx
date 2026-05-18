import { useState, useEffect, lazy, Suspense } from "react";
import Login from "./components/Login";
import Shell from "./components/Shell";
import { globalCSS, L } from "./constants/theme";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { supabase } from "./lib/supabase";

const PageLanding = lazy(() => import("./pages/PageLanding"));
const PageBlog    = lazy(() => import("./pages/PageBlog"));
const PageDocs    = lazy(() => import("./pages/PageDocs"));

const PATH_MAP = { "/c4os": "login", "/c4blog": "blog", "/c4docs": "docs" };
const PAGE_PATH = { landing: "/", login: "/C4OS", blog: "/C4BLOG", docs: "/C4DOCS" };

const pathToPage = (path) =>
  PATH_MAP[path.toLowerCase().replace(/\/$/, "")] ?? "landing";

function AppInner() {
  const { theme, toggleTheme } = useTheme();
  const [user,setUser]         = useState(null);
  const [profile,setProfile]   = useState(null);
  const [ready,setReady]       = useState(false);
  const [publicPage,setPublicPage] = useState(() => pathToPage(window.location.pathname));

  const goPublic = (p) => {
    setPublicPage(p);
    history.pushState(null, "", PAGE_PATH[p] ?? "/");
  };

  useEffect(() => {
    const onPop = () => setPublicPage(pathToPage(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // CSS global
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = globalCSS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  // Sessão Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setReady(true); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*, empresas(nome, is_c4hub, status)")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("[fetchProfile] erro RLS/DB:", error.message);
        await supabase.auth.signOut();
        setReady(true);
        return;
      }

      if (data) {
        setProfile({
          id:         data.id,
          nome:       data.nome,
          cargo:      data.cargo ?? "",
          email:      user?.email ?? "",
          role:       data.role,
          empresa:    data.empresas?.nome ?? "—",
          empresa_id: data.empresa_id,
          is_c4hub:   data.empresas?.is_c4hub ?? false,
          // Mantido como hex para compatibilidade com Av/Chip que usam ${color}xx
          cor:        data.role === "c4hub_admin" ? "#111827" : "#6b7280",
          avatar:     data.nome.split(" ").map(n => n[0]).slice(0,2).join(""),
          foto_url:   data.foto_url ?? null,
        });
      }
    } catch (e) {
      console.error("[fetchProfile] exceção:", e);
      await supabase.auth.signOut();
    }
    setReady(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleProfileUpdate = (updated) => {
    setProfile(p => ({ ...p, ...updated }));
  };

  const publicFallback = (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f0fdf4"}}>
      <div style={{width:18,height:18,borderRadius:"50%",border:"2px solid #bbf7d0",borderTopColor:"#16a34a",animation:"spin .7s linear infinite"}}/>
    </div>
  );

  if (!ready) {
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--c-bg)"}}>
        <div style={{width:18,height:18,borderRadius:"50%",border:"2px solid var(--c-line)",borderTopColor:"#1aaa96",animation:"spin .7s linear infinite"}}/>
      </div>
    );
  }

  if (user && profile) {
    return (
      <Shell
        user={profile}
        onLogout={handleLogout}
        onProfileUpdate={handleProfileUpdate}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  if (publicPage === "login") return <Login />;

  return (
    <Suspense fallback={publicFallback}>
      {publicPage === "landing" && <PageLanding onNavigate={goPublic} />}
      {publicPage === "blog"    && <PageBlog    onNavigate={goPublic} />}
      {publicPage === "docs"    && <PageDocs    onNavigate={goPublic} />}
    </Suspense>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
