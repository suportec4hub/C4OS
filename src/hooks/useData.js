import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

// Hook genérico de CRUD para qualquer tabela
export function useTable(table, filters = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from(table).select("*").order("created_at", { ascending: false });
    Object.entries(filters).forEach(([k, v]) => { if (v) q = q.eq(k, v); });
    const { data: rows, error: err } = await q;
    if (err) setError(err.message);
    else setData(rows || []);
    setLoading(false);
  }, [table, JSON.stringify(filters)]);

  useEffect(() => { fetch(); }, [fetch]);

  const insert = async (row) => {
    const { data: d, error: e } = await supabase.from(table).insert(row).select().single();
    if (!e) { setData(p => [d, ...p]); }
    return { data: d, error: e };
  };

  const update = async (id, changes) => {
    const { data: d, error: e } = await supabase.from(table).update(changes).eq("id", id).select().single();
    if (!e) { setData(p => p.map(r => r.id === id ? d : r)); }
    return { data: d, error: e };
  };

  const remove = async (id) => {
    const { error: e } = await supabase.from(table).delete().eq("id", id);
    if (!e) { setData(p => p.filter(r => r.id !== id)); }
    return { error: e };
  };

  return { data, loading, error, refetch: fetch, insert, update, remove };
}

// Hook específico para o perfil do usuário logado
export function useProfile() {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("usuarios").select("*, empresas(*)").eq("id", user.id).single()
          .then(({ data }) => setProfile(data));
      }
    });
  }, []);
  return profile;
}

// Hook para criar usuário via Edge Function
export async function criarUsuario({ email, senha, nome, cargo, role, empresa_id }) {
  const { data, error } = await supabase.functions.invoke("criar-usuario", {
    body: { email, senha, nome, cargo, role, empresa_id },
  });
  if (error) return { error: error.message || "Erro ao chamar a função" };
  return data || {};
}

// Hook de planos (leitura + update para admin)
export function usePlanos() {
  const { data, loading, update, refetch } = useTable("planos");
  const ativos = data.filter(p => p.ativo);
  return { planos: data, ativos, loading, update, refetch };
}
