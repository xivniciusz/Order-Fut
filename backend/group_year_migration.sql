-- Migracao: Refatorar ano_base para current_year (dinamico) + foundation_year (estatico)
-- Execute conectando no banco PostgreSQL configurado no .env

-- Adiciona coluna foundation_year com ano de criacao (derivado de created_at)
ALTER TABLE groups
    ADD COLUMN IF NOT EXISTS foundation_year integer;

-- Popula foundation_year com o ano de created_at para grupos existentes
UPDATE groups
SET foundation_year = EXTRACT(YEAR FROM created_at)
WHERE foundation_year IS NULL;

-- Renomeia ano_base para current_year
ALTER TABLE groups
    RENAME COLUMN ano_base TO current_year;

-- Define foundation_year como NOT NULL (so apos populacao)
ALTER TABLE groups
    ALTER COLUMN foundation_year SET NOT NULL;

-- Comentarios para documentacao
COMMENT ON COLUMN groups.foundation_year IS 'Ano em que o grupo foi criado (estatico)';
COMMENT ON COLUMN groups.current_year IS 'Ano em que o grupo esta acontecendo (dinamico, recalculado automaticamente)';
