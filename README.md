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

### CRUD de grupos

Endpoints protegidos que alimentam a nova tela de gestao de grupos:

| Metodo | Rota                          | Descricao |
| ------ | ----------------------------- | --------- |
| GET    | `/groups`                     | Retorna todos os grupos do usuario com contagem de jogadores e status ativo. |
| POST   | `/groups`                     | Cria um grupo (campos: `nome`, `ano_base`, `descricao`). O primeiro grupo ja nasce ativo. |
| PUT    | `/groups/{id}`                | Atualiza nome, ano base ou descricao do grupo informado. |
| DELETE | `/groups/{id}`                | Remove o grupo. Se ele estiver ativo, o backend promove o proximo grupo para ativo. |
| POST   | `/groups/{id}/set-active`     | Marca o grupo como ativo e desativa os demais do mesmo usuario. |

Tabela `groups` agora contem `id`, `user_id`, `nome`, `descricao`, `ano_base`, `is_active`, `created_at` e `updated_at` (alem do relacionamento com `players` e `matches`).

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
- Nova aba **Grupos** (dentro do dashboard) oferece CRUD completo: lista responsiva, botao "Criar grupo", botoes "Definir como ativo", modais de edicao/confirmacao de exclusao e atalho "Jogadores" para navegar para a tela de elenco.
- Componentes/servicos principais:
   - `ActiveGroupContext.tsx` agora respeita o estado `is_active` retornado pelo backend para priorizar o grupo certo.
   - `groupsApi.ts` centraliza chamadas autenticadas (`GET/POST/PUT/DELETE/POST set-active`).
   - `Groups.tsx` (pedida como *Groups.jsx*, implementada em TSX para manter o padrao do projeto) renderiza cards, valida formularios e reutiliza o contexto para sincronizar o dashboard.
- Para testar manualmente:
   1. Faca login/cadastro e copie o token exibido na sessao.
   2. Popule as tabelas no Postgres (players, matches, events) para alimentar os cards.
   3. Utilize a acao "Sincronizar" ou recarregue a pagina para refazer os fetches; na aba Grupos, acione os botoes de criar/editar/excluir/ativar.

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
