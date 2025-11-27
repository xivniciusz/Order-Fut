# Order Fut Stack

Ambiente full-stack com backend FastAPI, frontend React + Vite + Tailwind e banco PostgreSQL.

## Backend (FastAPI + Poetry)

1. Instale o [Poetry](https://python-poetry.org/docs/#installation). No PowerShell, use:
   ```powershell
   (Invoke-WebRequest -Uri https://install.python-poetry.org -UseBasicParsing).Content | py -
   ```
2. Entre na pasta `backend` e instale as dependencias:
   ```powershell
   cd backend
   poetry install
   ```
3. Copie `.env.example` para `.env` e ajuste `DATABASE_URL` e `ALLOWED_ORIGINS` conforme ambiente (separe origens por virgula).
4. Rode o servidor em modo dev:
   ```powershell
   poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

Dependencias principais ja listadas no `pyproject.toml`:
- `fastapi`
- `uvicorn[standard]`
- `psycopg[binary]`
- `sqlalchemy`
- `python-dotenv`

## Frontend (React + Vite + Tailwind)

1. Instale dependencias com npm ou pnpm (exemplo com npm):
   ```powershell
   cd frontend
   npm install
   ```
2. Inicie o ambiente de desenvolvimento:
   ```powershell
   npm run dev
   ```

Configure o backend usado no fetch criando `frontend/.env` a partir do `.env.example`:
```
VITE_API_BASE_URL=https://order-fut.onrender.com
```
Localmente voce pode manter `http://localhost:8000`.

Pacotes ja configurados em `package.json`:
- `react` e `react-dom`
- `vite` e `@vitejs/plugin-react`
- `tailwindcss`, `postcss`, `autoprefixer`
- `typescript`

Tailwind ja esta ligado em `tailwind.config.js` e `src/index.css`.

## Banco de Dados (PostgreSQL)

Instale o PostgreSQL localmente (pode ser via instalador oficial) e garanta que o servico esteja ativo.
Crie um banco chamado `order_fut` e ajuste usuario/senha conforme desejar.
Depois atualize `DATABASE_URL` no backend para refletir host, porta e credenciais escolhidas.

## Fluxo sugerido

1. Inicie seu servidor PostgreSQL local.
2. `cd backend && poetry install && poetry run uvicorn app.main:app --reload`
3. `cd frontend && npm install && npm run dev`

A aplicacao React consulta `http://localhost:8000/health` para validar o backend.
