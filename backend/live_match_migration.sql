-- Atualizacoes para suporte a Partida ao Vivo
-- Execute conectando no banco PostgreSQL configurado no .env

-- Ajustes na tabela matches
ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS team_size integer NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS goalkeepers_fixed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generated_at timestamptz,
    ADD COLUMN IF NOT EXISTS finished_at timestamptz;

-- Ajustes na tabela events
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS assist_player_id uuid,
    ADD COLUMN IF NOT EXISTS description text;

-- Garante a constraint de assistencia
ALTER TABLE events
    ADD CONSTRAINT IF NOT EXISTS events_assist_player_fk
    FOREIGN KEY (assist_player_id)
    REFERENCES players(id)
    ON DELETE SET NULL;

-- Tabela que relaciona jogadores a partidas
CREATE TABLE IF NOT EXISTS match_players (
    id uuid PRIMARY KEY,
    match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    is_present boolean NOT NULL DEFAULT false,
    is_goalkeeper boolean NOT NULL DEFAULT false,
    order_position integer NOT NULL DEFAULT 0,
    team_number integer,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_players_match_id ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_player_id ON match_players(player_id);
