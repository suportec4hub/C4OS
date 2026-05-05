import { useState, useEffect } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Login from "./components/Login";
import Shell from "./components/Shell";
import { globalCSS, L } from "./constants/theme";
import { supabase } from "./lib/supabase";

export default function App() {
  const [user,setUser]       = useState(null);
  const [profile,setProfile] = useState(null);
  const [ready,setReady]     = useState(false);

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
        // Desloga para evitar loop
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
          cor:        data.role === "c4hub_admin" ? L.teal : L.copper,
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

  if (!ready) {
    return (
      <>
        <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f5f7fa"}}>
          <div style={{width:18,height:18,borderRadius:"50%",border:"2px solid #e2e8f0",borderTopColor:"#1aaa96",animation:"spin .7s linear infinite"}}/>
        </div>
        <SpeedInsights />
      </>
    );
  }

  if (!user || !profile) return (
    <>
      <Login />
      <SpeedInsights />
    </>
  );
  return (
    <>
      <Shell user={profile} onLogout={handleLogout} onProfileUpdate={handleProfileUpdate} />
      <SpeedInsights />
    </>
  );
}
