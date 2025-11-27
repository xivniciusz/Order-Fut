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
3. Copie `.env.example` para `.env` e configure:
   - `DATABASE_URL` com o Postgres utilizado.
   - `ALLOWED_ORIGINS` (lista separada por virgula, usada no CORS).
   - `FRONTEND_BASE_URL`, necessario para links de redefinicao de senha.
   - `JWT_SECRET` e opcoes de expiracao (`ACCESS_TOKEN_EXPIRES_MINUTES`, `REFRESH_TOKEN_EXPIRES_MINUTES`, `PASSWORD_RESET_TOKEN_MINUTES`).
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
- `passlib[pbkdf2]` para hashing PBKDF2-SHA256

### Endpoints do dashboard

Todos os endpoints abaixo **requerem** cabecalho `Authorization: Bearer <access_token>` emitido pelos fluxos `/auth/*`.

| Metodo | Rota                        | Descricao |
| ------ | --------------------------- | --------- |
| GET    | `/dashboard/groups/active`  | Lista os grupos do usuario autenticado com totais de atletas, jogos e proximo compromisso. |
| GET    | `/dashboard/stats/overview` | Retorna resumos do grupo selecionado (totais de atletas/jogos/gols/presencas, ultimos confrontos e artilharia). Aceita `group_id` opcional via query string. |

Os modelos `Group`, `Player`, `Match` e `Event` já estão configurados em `backend/app/models.py`, então basta popular essas tabelas para ver dados reais no painel.

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
   A raiz do app agora apresenta as telas de **login**, **cadastro**, **recuperacao** e **redefinicao** de senha, todas apontando para o backend configurado via `VITE_API_BASE_URL`.

### Dashboard React

- Apos login bem-sucedido o usuario e redirecionado para `Dashboard.tsx`, que utiliza o `ActiveGroupProvider` para buscar `/dashboard/groups/active` e `/dashboard/stats/overview`.
- O painel inclui:
   - Barra lateral com grupos ativos e acao de sincronizar.
   - Cards com totais (atletas, partidas, gols e presencas) + listas de ultimos jogos e artilharia.
   - Alternancia manual de tema (claro/escuro) com Tailwind em modo `class`.
- Para testar manualmente:
   1. Faca login/cadastro e copie o token exibido na sessao.
   2. Popule as tabelas no Postgres (players, matches, events) para alimentar os cards.
   3. Utilize a acao "Sincronizar" ou recarregue a pagina para refazer os fetches.

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

A aplicacao React consulta `http://localhost:8000/health` para validar o backend. Depois de autenticado, o dashboard automaticamente consome os novos endpoints protegidos para gerar o painel.
