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
| POST   | `/groups`                     | Cria um grupo (campos: `nome`, `descricao`). O primeiro grupo ja nasce ativo. `foundation_year` e `current_year` sao calculados automaticamente. |
| PUT    | `/groups/{id}`                | Atualiza nome ou descricao do grupo informado (os campos de ano nao sao edistaveis). |
| DELETE | `/groups/{id}`                | Remove o grupo. Se ele estiver ativo, o backend promove o proximo grupo para ativo. |
| POST   | `/groups/{id}/set-active`     | Marca o grupo como ativo e desativa os demais do mesmo usuario. |

Tabela `groups` agora contem `id`, `user_id`, `nome`, `descricao`, `foundation_year` (ano de criacao, estatico), `current_year` (ano dinâmico, muda automaticamente com o passar dos anos), `is_active`, `created_at` e `updated_at` (alem do relacionamento com `players` e `matches`).

**Lógica de anos:**
- `foundation_year`: Extraído automaticamente do ano de `created_at`. Representa quando o grupo foi criado (permanece constante).
- `current_year`: Calculado em tempo real como o ano atual. Muda automaticamente a cada novo ano civil, refletindo o ano em que o grupo está acontecendo.
- **Filtro de estatísticas**: A tela de estatísticas permite filtrar dados por qualquer ano anterior via query parameter `?year=YYYY`, possibilitando análises históricas completas.

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
| POST   | `/matches/{id}/generate-teams`    | Valida se ha atletas suficientes e distribui automaticamente os jogadores em N times equilibrados + banco seguindo a ordem cadastrada e, opcionalmente, respeitando goleiros fixos. |

Novos modelos estao em `backend/app/models.py`: `Match` agora possui `team_size`, `goalkeepers_fixed` e `generated_at`, e a tabela `match_players` armazena presenca, ordem e time final. Os DTOs (`MatchCreateRequest`, `MatchPlayersSyncRequest`, `GenerateTeamsResponse` etc.) estao em `backend/app/schemas.py`, enquanto o fluxo completo vive em `backend/app/routes/matches.py`.

### Partida ao vivo

Depois de gerar os times, acompanhe o jogo em tempo real usando a nova aba **Partida ao vivo** do dashboard. Nela voce informa o `match_id` (copie direto do card exibido em `MatchSetup`) e passa a registrar eventos, rotacionar times e encerrar a partida. A UI consome os endpoints abaixo:

| Metodo | Rota                         | Descricao |
| ------ | ---------------------------- | --------- |
| GET    | `/matches/{id}`              | Retorna detalhe completo da sessao, indicando claramente os dois times ativos, a fila (ordem completa) e o banco solto. |
| POST   | `/matches/{id}/next-team`    | Substitui todo o time informado pelo inicio da fila; apenas equipes em quadra podem ser rotacionadas. |
| POST   | `/matches/{id}/finish`       | Marca a partida como finalizada e registra `finished_at` (necessario para as estatisticas contabilizarem o jogo). |
| POST   | `/events`                    | Registra gols, cartoes, assistencias, substituicoes e o novo evento **"saiu"** (LEFT_FIELD), que dispara automaticamente a entrada do proximo time. |

O componente React `MatchLive.tsx` agora opera com **apenas dois times em quadra**, destacando quem esta jogando e quem aguarda na fila. A fila funciona por equipes completas: ao registrar o evento "Saiu" ou clicar em "Retirar Time", a equipe deixa a quadra e a primeira da fila assume automaticamente, sempre preservando a ordem definida em `MatchSetup`. O cronometro passou a ser exclusivamente **regressivo**, com duracao configuravel, avisos sonoros (pre-alarme e fim) e travamento em `00:00` — ideal para validar quando uma partida realmente conta nas estatisticas. Continue usando o botao "Copiar ID" em `MatchSetup.tsx` para iniciar rapidamente a sessao ao vivo.

### Estatisticas do grupo

Novos endpoints disponibilizam consolidacao anual e historica usando as tabelas `players`, `matches` e `events`:

| Metodo | Rota | Descricao |
| ------ | ----- | --------- |
| GET | `/stats/group/{group_id}?year=YYYY` | Agrega eventos por atleta, monta rankings (gols, assistencias, jogos), gera amostras mensais e retorna tanto o periodo filtrado quanto os totais gerais. Apenas partidas finalizadas entram no cômputo e cada jogador so conta se tiver sido marcado como `has_played`. |
| GET | `/stats/player/{id}` | Retorna o resumo completo do atleta (totais, distribuicao por ano e ultimos jogos com gols/assistencias/cartoes), novamente considerando somente partidas finalizadas e atletas que de fato entraram em quadra. |

Os retornos sao consumidos diretamente pela nova aba de estatisticas e podem ser reutilizados para relatórios externos.

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
- Aba **Estatisticas** utiliza `Stats.tsx` + `statsApi.ts` para buscar os novos endpoints com cache em memoria. A tela exibe cards de ranking (gols/assistencias/jogos), seletor anual, grafico descritivo de tendencia, resumo comparando periodo x historico, tabela responsiva com todos os atletas (destacando o top 5) e um painel lateral que carrega os detalhes do jogador (com skeletons e atualizacao dinamica).
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

### Autenticação e sessão (importante)

- Comportamento atual: o frontend persiste o `AuthResponse` (contendo `access_token` e `refresh_token`) em `localStorage` para que a sessão sobreviva ao recarregamento da página. O usuário permanecerá logado enquanto o token de acesso não expirar ou até que faça `logout`.
- Logout: ao executar logout a sessão é removida do `localStorage` e o usuário precisa autenticar novamente.
- Expiração: o `access_token` expira conforme configurado no backend (`ACCESS_TOKEN_EXPIRES_MINUTES`). Quando expira, o frontend deve obter um novo `access_token` usando o `refresh_token` — atualmente não há endpoint `/auth/refresh` implementado por padrão. Para evitar logouts inesperados recomendamos implementar a renovação automática (ver item abaixo).
- Segurança: armazenar tokens em `localStorage` é simples e funciona, porém expõe tokens ao risco de XSS. Para produção é melhor usar cookies `HttpOnly` (para `refresh_token`) e um `access_token` curto em memória, ou usar cookies `HttpOnly` para ambos conforme o modelo de sessão desejado.

Recomendações imediatas:
- Implementar um endpoint `/auth/refresh` que troque o `refresh_token` por um novo `access_token` e, opcionalmente, um novo `refresh_token`. Esse endpoint deve validar a validade do `refresh_token` e ser seguro quanto a repetição/revogação.
- No frontend, ao reidratar a sessão a partir do `localStorage`, valide o `access_token` chamando um endpoint protegido (ex.: `/users/me`). Se receber `401`, chame `/auth/refresh` para renovar o token e, se ainda assim falhar, forçar o login.
- Preferir cookies `HttpOnly` para armazenar o `refresh_token` e reduzir superfície de ataque; em cenários com múltiplos clientes (apps e navegadores) avaliar trade-offs.

Nota sobre segredos e arquivos locais:
- Nao comite arquivos de ambiente (`.env`) ou bancos locais (`backend/order_fut.db`) no repositório. Esses itens ja estao listados no `.gitignore`, e recomendamos manter segredos em variaveis de ambiente do servidor de producao.

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
