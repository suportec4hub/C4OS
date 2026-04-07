/**
 * logAction — insere registro em logs_auditoria.
 * Pode ser chamado de qualquer página/hook sem precisar de user completo.
 */
import { supabase } from "./supabase";

export async function logAction({ empresa_id, usuario_id, usuario_email, tipo = "SYSTEM", nivel = "info", acao, detalhes = {} }) {
  await supabase.from("logs_auditoria").insert({
    empresa_id: empresa_id || null,
    usuario_id: usuario_id || null,
    usuario_email: usuario_email || null,
    tipo,
    nivel,
    acao,
    detalhes,
    created_at: new Date().toISOString(),
  });
}
