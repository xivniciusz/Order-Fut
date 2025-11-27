# Order Fut Backend

Servicos FastAPI com Poetry. Instale dependencias com `poetry install` e execute `poetry run uvicorn app.main:app --reload`.

Variaveis principais do `.env`:
- `DATABASE_URL`: conexao com PostgreSQL.
- `ALLOWED_ORIGINS`: dominios liberados no CORS.
- `FRONTEND_BASE_URL`: usado para montar links de redefinicao de senha.
- `JWT_SECRET`, `JWT_ALGORITHM` e tempos de expiracao para access/refresh e reset token.
