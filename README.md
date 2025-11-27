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

### CRUD de jogadores

Endpoints autenticados para montar a tela de elenco. Todos exigem o `group_id` pertencente ao usuario logado:

| Metodo | Rota             | Descricao |
| ------ | ---------------- | --------- |
| GET    | `/players`       | Lista jogadores filtrando obrigatoriamente por `group_id` (query string). Ordena alfabeticamente e valida posse do grupo. |
| POST   | `/players`       | Cria jogador recebendo `nome`, `posicao` (`GK/DEF/MID/ATT`), `numero_camisa` (0-99, opcional) e `group_id`. Normaliza o nome e garante posicao permitida. |
| PUT    | `/players/{id}`  | Atualiza qualquer campo (inclusive transferir para outro grupo do mesmo usuario). Ignora requisicoes sem payload valido. |
| DELETE | `/players/{id}`  | Remove o jogador, garantindo que pertence a um grupo do usuario autenticado. |

Os schemas correspondentes estao em `backend/app/schemas.py` (`PlayerCreate`, `PlayerUpdate`, `PlayerResponse`, `PlayerPosition`) e o roteador completo em `backend/app/routes/players.py`.

### Organizacao de partidas

Fluxo novo para planejar jogos/treinos, controlar presenca e gerar times equilibrados. Todos os endpoints exigem token JWT:

| Metodo | Rota                              | Descricao |
| ------ | --------------------------------- | --------- |
| POST   | `/matches`                        | Cria uma sessao de partida a partir de um `group_id`, definindo titulo, data/hora, local, tamanho dos times e se os goleiros devem ficar fixos. |
| POST   | `/matches/{id}/players`           | Sincroniza toda a lista de jogadores daquele grupo com status de presenca, marcacao de goleiro e ordem de chegada (drag and drop). |
| POST   | `/matches/{id}/generate-teams`    | Valida se ha atletas suficientes e gera automaticamente dois times + banco seguindo a ordem cadastrada e, opcionalmente, respeitando goleiros fixos. |

Novos modelos estao em `backend/app/models.py`: `Match` agora possui `team_size`, `goalkeepers_fixed` e `generated_at`, e a tabela `match_players` armazena presenca, ordem e time final. Os DTOs (`MatchCreateRequest`, `MatchPlayersSyncRequest`, `GenerateTeamsResponse` etc.) estao em `backend/app/schemas.py`, enquanto o fluxo completo vive em `backend/app/routes/matches.py`.

### Partida ao vivo

Depois de gerar os times, acompanhe o jogo em tempo real usando a nova aba **Partida ao vivo** do dashboard. Nela voce informa o `match_id` (copie direto do card exibido em `MatchSetup`) e passa a registrar eventos, rotacionar times e encerrar a partida. A UI consome os endpoints abaixo:

| Metodo | Rota                         | Descricao |
| ------ | ---------------------------- | --------- |
| GET    | `/matches/{id}`              | Retorna detalhe completo da sessao (times, fila e eventos). |
| POST   | `/matches/{id}/next-team`    | Substitui todo o time informado pelo inicio da fila do banco. |
| POST   | `/matches/{id}/finish`       | Marca a partida como finalizada e registra `finished_at`. |
| POST   | `/events`                    | Registra gols, cartoes, assistencias, presencas ou substituicoes. |

O componente React `MatchLive.tsx` controla cronometro local, placar calculado a partir dos eventos e atualizacao automatica a cada 10 segundos. Use o botao "Copiar ID" em `MatchSetup.tsx` para colar rapidamente na aba ao vivo.

> **Migracoes:** rode o script `backend/live_match_migration.sql` no seu banco PostgreSQL para garantir que colunas (`team_size`, `goalkeepers_fixed`, `generated_at`, `finished_at`, `assist_player_id`, `description`) e a tabela `match_players` existam antes de usar o modo ao vivo.

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
- Aba **Jogadores** exibe o componente `Players.tsx`, com selecao de grupo, busca textual, filtro por posicao, cards com avatar inicial e modais para criar/editar/excluir atletas, todos alimentados pelo `playersApi.ts`.
- Aba **Organizacao** traz o componente `MatchSetup.tsx`, com interface dark/light para configurar a partida, marcar presencas, alternar goleiros, ordenar a fila via drag and drop e acionar o botao **Gerar Times**. A integracao usa `matchesApi.ts` para criar a sessao, sincronizar jogadores e solicitar a distribuicao automatica (a tela exibe os times e o banco de reservas resultantes).
- Componentes/servicos principais:
   - `ActiveGroupContext.tsx` agora respeita o estado `is_active` retornado pelo backend para priorizar o grupo certo.
   - `groupsApi.ts` centraliza chamadas autenticadas (`GET/POST/PUT/DELETE/POST set-active`).
   - `Groups.tsx` (pedida como *Groups.jsx*, implementada em TSX para manter o padrao do projeto) renderiza cards, valida formularios e reutiliza o contexto para sincronizar o dashboard.
   - `playersApi.ts` encapsula as chamadas `GET/POST/PUT/DELETE` para `/players`, aplicando timeout e mensagens amigaveis.
   - `Players.tsx` controla filtros, estado de modais, validacao de formularios e sincroniza selecao de grupo com o `ActiveGroupProvider` para manter o dashboard coerente.
   - `matchesApi.ts` organiza as chamadas `POST /matches`, `/matches/{id}/players` e `/matches/{id}/generate-teams` com timeouts padronizados.
   - `MatchSetup.tsx` concentra toda a logica de estado (formulario, toggle de goleiro, drag and drop usando eventos nativos, validacao minima de jogadores, mensagens de erro/sucesso e rendering responsivo dos cards de times).
- Para testar manualmente:
   1. Faca login/cadastro e copie o token exibido na sessao.
   2. Popule as tabelas no Postgres (players, matches, events) para alimentar os cards.
   3. Utilize a acao "Sincronizar" ou recarregue a pagina para refazer os fetches; na aba Grupos, acione os botoes de criar/editar/excluir/ativar.
   4. Acesse a aba Organizacao, selecione um grupo, crie a sessao, marque presencas e pressione "Gerar times" para validar o fluxo completo.

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

Novas tabelas/colunas criadas para a organizacao da partida:

- `matches`: guarda titulo, local, data/hora, tamanho do time, configuracao de goleiro (`goalkeepers_fixed`) e timestamps (`created_at`, `generated_at`).
- `match_players`: linha para cada atleta convidado, com flags `is_present`, `is_goalkeeper`, `order_position` e o `team_number` atribuido apos a geracao.

## Fluxo sugerido

1. Inicie seu servidor PostgreSQL local.
2. `cd backend && poetry install && poetry run uvicorn app.main:app --reload`
3. `cd frontend && npm install && npm run dev`

A aplicacao React consulta `http://localhost:8000/health` para validar o backend. Depois de autenticado, o dashboard automaticamente consome os novos endpoints protegidos para gerar o painel.
