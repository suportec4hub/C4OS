-- Altera evolution_instance_id de uuid para text
-- para suportar nomes de instância como "teste", "c4HUB-Lucas", etc.
ALTER TABLE empresas ALTER COLUMN evolution_instance_id TYPE text USING evolution_instance_id::text;
