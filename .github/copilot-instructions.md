- [x] Confirmar que o arquivo copilot-instructions.md existe na pasta .github. (Checklist inicial criada.)

- [x] Esclarecer os requisitos do projeto
  (FastAPI no backend, React+Vite+Tailwind no frontend e PostgreSQL confirmados.)

- [x] Estruturar o projeto
  (Backend FastAPI e frontend React/Vite/Tailwind estao prontos; banco sera configurado manualmente.)

- [x] Personalizar o projeto
  (Healthcheck FastAPI e tela React consultando o backend configurados nos arquivos principais.)

- [x] Instalar extensoes obrigatorias
  (Nenhuma extensao extra foi necessaria para este setup.)

- [x] Compilar o projeto
  (`poetry install` executado no backend e `npm run build` no frontend.)

- [x] Criar e executar task
  (Task `backend: compile` em `.vscode/tasks.json` roda `poetry run python -m compileall app`.)

- [x] Iniciar o projeto
  (Pedido enviado ao usuario para iniciar modo debug; execucao aguarda autorizacao.)

- [x] Garantir documentacao atualizada
  (README principal revisado e comentarios removidos deste arquivo.)

## Diretrizes de Execucao
RASTREIO DE PROGRESSO:
- Se houver ferramenta para gerenciar a lista acima, use-a para registrar o andamento.
- Ao concluir cada etapa, marque como feita e adicione um resumo.
- Consulte o status atual antes de iniciar uma nova etapa.

REGRAS DE COMUNICACAO:
- Evite explicacoes longas ou saidas completas de comandos.
- Caso pule uma etapa, registre isso rapidamente (ex.: "Sem extensoes necessarias").
- Nao descreva a estrutura do projeto sem solicitacao.
- Mantenha as respostas objetivas.

REGRAS DE DESENVOLVIMENTO:
- Use o diretorio atual como raiz, salvo orientacao contraria.
- Nao adicione midia ou links externos sem pedido expresso.
- Use placeholders apenas com aviso de que devem ser trocados depois.
- Utilize a API do VS Code somente para projetos de extensao.
- O projeto ja esta aberto no VS Code; nao sugira comandos para abri-lo novamente.
- Se houver regras adicionais do setup, siga-as estritamente.

REGRAS PARA CRIAR PASTAS:
- Mantenha a pasta atual como raiz do projeto.
- Em comandos de terminal, use o argumento '.' para garantir o diretorio correto.
- Nao crie novas pastas exceto se o usuario pedir (alem da pasta .vscode para tasks).
- Se alguma ferramenta reclamar do nome da pasta, informe o usuario para renomear e reabrir.

REGRAS DE EXTENSOES:
- Instale apenas extensoes listadas pelo get_project_setup_info.

REGRAS DE CONTEUDO DO PROJETO:
- Se o usuario nao detalhar o projeto, assuma um "Hello World" inicial.
- Evite adicionar links, integracoes ou midias desnecessarias.
- Caso use assets de exemplo, avise que sao temporarios.
- Garanta que cada componente tenha proposito claro dentro do fluxo solicitado.
- Quando presumir alguma funcionalidade, confirme antes com o usuario.
- Para projetos de extensao VS Code, consulte a doc apropriada.

REGRAS PARA FINALIZAR O TRABALHO:
- Considerar concluido apenas quando:
  - O projeto for estruturado e compilado sem erros.
  - O arquivo `.github/copilot-instructions.md` existir e refletir o estado atual.
  - O README.md estiver atualizado.
  - O usuario tiver instrucoes claras de como debugar/iniciar o projeto.

Antes de iniciar uma nova tarefa, atualize o progresso deste plano.
- Trabalhe etapa por etapa.
- Mantenha a comunicacao sucinta.
- Siga boas praticas de desenvolvimento.