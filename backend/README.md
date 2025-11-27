# Order Fut Backend

Servicos FastAPI com Poetry. Instale dependencias com `poetry install` e execute `poetry run uvicorn app.main:app --reload`.

Variaveis principais do `.env`:
- `DATABASE_URL`: conexao com PostgreSQL.
- `ALLOWED_ORIGINS`: dominios liberados no CORS.
- `FRONTEND_BASE_URL`: usado para montar links de redefinicao de senha.
- `JWT_SECRET`, `JWT_ALGORITHM` e tempos de expiracao para access/refresh e reset token.

Hashing de senhas utiliza **PBKDF2-SHA256** via Passlib, eliminando o limite de 72 bytes do bcrypt e garantindo compatibilidade com senhas longas.

## Migracao para Partida ao Vivo

O arquivo `live_match_migration.sql` (na raiz deste backend) adiciona as colunas e a tabela `match_players` exigidas pelos endpoints de Partida ao Vivo. Execute o script no mesmo banco configurado em `DATABASE_URL` antes de testar os novos fluxos (`/matches/{id}`, `/matches/{id}/next-team`, `/matches/{id}/finish` e `/events`).
