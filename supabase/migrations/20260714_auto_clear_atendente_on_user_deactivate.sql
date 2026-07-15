-- Função: ao desativar ou excluir um usuário, limpa atendente_id em conversas ativas
CREATE OR REPLACE FUNCTION clear_conversas_atendente_on_user_change()
RETURNS TRIGGER AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_uid := OLD.id;
    UPDATE conversas
    SET atendente_id = NULL
    WHERE atendente_id = v_uid
      AND status NOT IN ('resolvida');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND (OLD.ativo = true) AND (NEW.ativo = false) THEN
    v_uid := NEW.id;
    UPDATE conversas
    SET atendente_id = NULL
    WHERE atendente_id = v_uid
      AND status NOT IN ('resolvida');
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para UPDATE de ativo
DROP TRIGGER IF EXISTS trg_clear_atendente_on_deactivate ON usuarios;
CREATE TRIGGER trg_clear_atendente_on_deactivate
  AFTER UPDATE OF ativo ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION clear_conversas_atendente_on_user_change();

-- Trigger para DELETE (belt-and-suspenders, excluir-usuario já limpa antes)
DROP TRIGGER IF EXISTS trg_clear_atendente_on_delete ON usuarios;
CREATE TRIGGER trg_clear_atendente_on_delete
  AFTER DELETE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION clear_conversas_atendente_on_user_change();

-- Limpeza pontual: conversas abertas/aguardando com atendente inexistente ou inativo
UPDATE conversas c
SET atendente_id = NULL
WHERE c.atendente_id IS NOT NULL
  AND c.status NOT IN ('resolvida')
  AND NOT EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = c.atendente_id AND u.ativo = true
  );
