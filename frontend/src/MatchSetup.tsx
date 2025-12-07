import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveGroup } from "./ActiveGroupContext";
import { playersApi, PlayerDto } from "./playersApi";
import { GenerateTeamsResponse, matchesApi } from "./matchesApi";

export type MatchSetupProps = {
  token: string;
};

type LocalPlayer = PlayerDto & {
  isPresent: boolean;
  isGoalkeeper: boolean;
  order: number;
};

const sortPlayersByOrder = (list: LocalPlayer[]): LocalPlayer[] => [...list].sort((a, b) => a.order - b.order);

const teamSizeOptions = [5, 6, 7, 8, 9, 11];

const inputBase =
  "w-full rounded-2xl border border-slate-800/40 bg-slate-900/40 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-400 focus:bg-slate-900";

const sectionCard = "rounded-3xl border border-slate-800/60 bg-slate-900/50 p-5";

export default function MatchSetup({ token }: MatchSetupProps) {
  const { groups, selectedGroupId, selectGroup } = useActiveGroup();
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(selectedGroupId);
  const [players, setPlayers] = useState<LocalPlayer[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<GenerateTeamsResponse | null>(null);

  const [matchForm, setMatchForm] = useState(() => ({
    titulo: "Partida amistosa",
    startsAt: new Date().toISOString().slice(0, 16),
    teamSize: 5,
    goalkeepersFixed: false,
  }));

  useEffect(() => {
    if (selectedGroupId) {
      setCurrentGroupId(selectedGroupId);
    }
  }, [selectedGroupId]);

  const loadPlayers = useCallback(
    async (groupId: string) => {
      setLoadingPlayers(true);
      setError(null);
      try {
        const data = await playersApi.list(token, groupId);
        const mapped: LocalPlayer[] = data.players.map((player, index) => ({
          ...player,
          isPresent: false,
          isGoalkeeper: player.posicao === "GK",
          order: index,
        }));
        setPlayers(sortPlayersByOrder(mapped));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao carregar jogadores.";
        setError(message);
        setPlayers([]);
      } finally {
        setLoadingPlayers(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!currentGroupId) {
      setPlayers([]);
      setMatchId(null);
      setGeneratedResult(null);
      return;
    }
    setMatchId(null);
    setGeneratedResult(null);
    setStatusMessage(null);
    loadPlayers(currentGroupId);
  }, [currentGroupId, loadPlayers]);

  const handleGroupChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value || null;
    setCurrentGroupId(value);
    selectGroup(value);
  };

  const updatePlayer = (playerId: string, updater: (player: LocalPlayer) => LocalPlayer) => {
    setPlayers((prev) => prev.map((player) => (player.id === playerId ? updater(player) : player)));
    setGeneratedResult(null);
  };

  const reorderPlayers = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      return;
    }
    setPlayers((prev) => {
      const sourceIndex = prev.findIndex((player) => player.id === sourceId);
      const targetIndex = prev.findIndex((player) => player.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) {
        return prev;
      }
      const updated = [...prev];
      const [removed] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, removed);
      return updated.map((player, index) => ({ ...player, order: index }));
    });
    setGeneratedResult(null);
  };

  const linePlayers = useMemo(() => players.filter((player) => !player.isGoalkeeper), [players]);
  const goalkeeperPlayers = useMemo(() => players.filter((player) => player.isGoalkeeper), [players]);
  const presentLinePlayers = useMemo(() => linePlayers.filter((player) => player.isPresent), [linePlayers]);
  const presentLineCount = presentLinePlayers.length;

  const handleOrderSelect = (playerId: string, value: string) => {
    const nextPosition = Math.max(0, Number(value));
    setPlayers((prev) => {
      const currentIndex = prev.findIndex((player) => player.id === playerId);
      if (currentIndex === -1) {
        return prev;
      }
      const updated = [...prev];
      const [removed] = updated.splice(currentIndex, 1);
      updated.splice(Math.min(nextPosition, updated.length), 0, removed);
      return updated.map((player, index) => ({ ...player, order: index }));
    });
    setGeneratedResult(null);
  };

  const handleCreateMatch = async () => {
    if (!currentGroupId) {
      setError("Selecione um grupo para iniciar a organizacao.");
      return;
    }
    setMatchLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const payload = {
        group_id: currentGroupId,
        titulo: matchForm.titulo.trim() || "Partida",
        starts_at: new Date(matchForm.startsAt).toISOString(),
        team_size: matchForm.teamSize,
        goalkeepers_fixed: matchForm.goalkeepersFixed,
      };
      const match = await matchesApi.create(token, payload);
      setMatchId(match.id);
      setStatusMessage("Sessao criada com sucesso. Agora marque as presencas e salve a lista.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel criar a partida.";
      setError(message);
    } finally {
      setMatchLoading(false);
    }
  };

  const handleSyncPlayers = async () => {
    if (!matchId) {
      setError("Crie uma sessao da partida antes de sincronizar os jogadores.");
      return;
    }
    setMatchLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      await matchesApi.syncPlayers(token, matchId, {
        players: players.map((player) => ({
          player_id: player.id,
          is_present: player.isPresent,
          is_goalkeeper: player.isGoalkeeper,
          order_position: player.order,
        })),
      });
      setStatusMessage("Presencas sincronizadas. Voce pode gerar os times assim que estiver pronto.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel sincronizar os jogadores.";
      setError(message);
    } finally {
      setMatchLoading(false);
    }
  };

  const handleGenerateTeams = async () => {
    if (!matchId) {
      setError("Crie e sincronize a sessao antes de gerar os times.");
      return;
    }
      if (presentLineCount < matchForm.teamSize * 2) {
      setError("Quantidade insuficiente de jogadores presentes para montar dois times completos.");
      return;
    }
    setMatchLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const result = await matchesApi.generateTeams(token, matchId, {
        team_size: matchForm.teamSize,
        goalkeepers_fixed: matchForm.goalkeepersFixed,
      });
      setGeneratedResult(result);
      setStatusMessage("Times gerados automaticamente seguindo a ordem de chegada.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel gerar os times.";
      setError(message);
    } finally {
      setMatchLoading(false);
    }
  };

  const handleDragStart = (playerId: string) => setDraggingId(playerId);
  const handleDragOver = (event: React.DragEvent<HTMLLIElement>) => event.preventDefault();
  const handleDrop = (playerId: string) => {
    if (draggingId) {
      reorderPlayers(draggingId, playerId);
    }
    setDraggingId(null);
  };

  const TeamsPreview = () => {
    if (!generatedResult) {
      return null;
    }
    return (
      <section className={sectionCard}>
        <header className="mb-4">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Distribuicao</p>
          <h3 className="text-xl font-semibold text-white">Times gerados</h3>
          <p className="text-sm text-slate-600">Baseados na ordem de chegada e preferencia de goleiros.</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {generatedResult.teams.map((team) => (
            <div key={team.team_number} className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4">
              <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Time {team.team_number}</p>
              <ul className="mt-3 space-y-2">
                {team.players.map((player) => (
                  <li key={player.match_player_id} className="rounded-2xl bg-slate-950/40 px-3 py-2 text-sm text-white">
                    <span className="font-semibold">{player.nome}</span>
                    {player.is_goalkeeper && <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200">Goleiro</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const handleCopyMatchId = useCallback(async () => {
    if (!matchId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(matchId);
      setStatusMessage("ID da partida copiado. Abra a aba 'Partida ao vivo' para acompanhar em tempo real.");
    } catch {
      setError("Nao foi possivel copiar automaticamente. Copie o ID manualmente.");
    }
  }, [matchId]);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Organizacao</p>
          <h2 className="text-3xl font-semibold text-white">Organizar partida</h2>
          <p className="text-sm text-slate-600">Marque presencas, defina goleiros e gere os times obedecendo a ordem de chegada.</p>
        </div>
        <div className="text-right text-sm text-slate-600">
          <p>
            Linhas presentes: <span className="font-semibold text-white">{presentLineCount}</span>
          </p>
          <p className="text-xs">Necessario minimo: {matchForm.teamSize * 2}</p>
        </div>
      </header>

      {error && <p className="rounded-3xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{error}</p>}
      {statusMessage && <p className="rounded-3xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">{statusMessage}</p>}
      {matchId && (
        <div className="rounded-3xl border border-emerald-500/40 bg-emerald-500/5 px-5 py-4 text-sm text-emerald-100">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Sessao ativa</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-xs font-mono text-emerald-100">{matchId}</code>
            <button
              type="button"
              onClick={handleCopyMatchId}
              className="rounded-2xl border border-emerald-400/70 px-4 py-2 text-xs font-semibold text-emerald-200"
            >
              Copiar ID
            </button>
            <span className="text-xs text-emerald-200">Use na aba "Partida ao vivo" para controlar o jogo.</span>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className={sectionCard}>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-600">Grupo</p>
          <select className={`${inputBase} mt-3`} value={currentGroupId ?? ""} onChange={handleGroupChange}>
            <option value="">Selecione o grupo</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.nome}
              </option>
            ))}
          </select>
          <div className="mt-4 grid gap-3">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600">
              Titulo
              <input
                className={`${inputBase} mt-2`}
                value={matchForm.titulo}
                onChange={(event) => setMatchForm((prev) => ({ ...prev, titulo: event.target.value }))}
                placeholder="Treino sexta"
                maxLength={160}
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600">
              Data e hora
              <input
                type="datetime-local"
                className={`${inputBase} mt-2`}
                value={matchForm.startsAt}
                onChange={(event) => setMatchForm((prev) => ({ ...prev, startsAt: event.target.value }))}
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600">
                Tamanho dos times
                <select
                  className={`${inputBase} mt-2`}
                  value={matchForm.teamSize}
                  onChange={(event) => setMatchForm((prev) => ({ ...prev, teamSize: Number(event.target.value) }))}
                >
                  {teamSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}v{size}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600">
                Goleiros fixos?
                <button
                  type="button"
                  className={`mt-2 flex w-full items-center justify-between rounded-2xl border px-4 py-2 text-sm transition ${
                    matchForm.goalkeepersFixed
                      ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                      : "border-slate-700 text-slate-700"
                  }`}
                  onClick={() => setMatchForm((prev) => ({ ...prev, goalkeepersFixed: !prev.goalkeepersFixed }))}
                >
                  {matchForm.goalkeepersFixed ? "Sim, fixar goleiros" : "Nao, distribuir livre"}
                  <span className={`h-5 w-10 rounded-full border ${matchForm.goalkeepersFixed ? "border-emerald-400 bg-emerald-500/40" : "border-slate-600"}`}>
                    <span
                      className={`mt-0.5 block h-4 w-4 rounded-full bg-white transition-transform ${
                        matchForm.goalkeepersFixed ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </span>
                </button>
              </label>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreateMatch}
            className="mt-4 w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/30 disabled:opacity-60"
            disabled={!currentGroupId || matchLoading}
          >
            {matchId ? "Recriar sessao" : "Criar sessao"}
          </button>
        </div>

        <div className={sectionCard}>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-600">Acoes</p>
          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSyncPlayers}
              className="rounded-2xl border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-emerald-400 disabled:opacity-60"
              disabled={!matchId || matchLoading || !players.length}
            >
              Salvar lista de presenca
            </button>
            <button
              type="button"
              onClick={handleGenerateTeams}
              className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/30 disabled:opacity-60"
              disabled={!matchId || matchLoading || presentLineCount < matchForm.teamSize * 2}
            >
              Gerar times automaticamente
            </button>
            <p className="text-xs text-slate-600">
              Arraste ou reordene os jogadores de linha e use a lista dedicada para definir quem assume o gol em cada rodada.
            </p>
          </div>
        </div>
      </div>

      <section className={sectionCard}>
        <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-600">Lista de jogadores</p>
            <h3 className="text-xl font-semibold text-white">Controle de presenca</h3>
          </div>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className="rounded-2xl border border-slate-700 px-4 py-2 text-slate-700"
              onClick={() => setPlayers((prev) => prev.map((player) => ({ ...player, isPresent: true })))}
            >
              Marcar todos
            </button>
            <button
              type="button"
              className="rounded-2xl border border-slate-700 px-4 py-2 text-slate-700"
              onClick={() => setPlayers((prev) => prev.map((player) => ({ ...player, isPresent: false })))}
            >
              Limpar
            </button>
          </div>
        </header>
        {loadingPlayers ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-2xl bg-slate-800/40" />
            ))}
          </div>
        ) : players.length ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-600">Jogadores de linha</p>
              {linePlayers.length ? (
                <ul className="mt-3 space-y-3">
                  {linePlayers.map((player) => {
                    const actualIndex = players.findIndex((base) => base.id === player.id);
                    if (actualIndex === -1) {
                      return null;
                    }
                    return (
                      <li
                        key={player.id}
                        draggable
                        onDragStart={() => handleDragStart(player.id)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(player.id)}
                        className={`flex flex-wrap items-center gap-4 rounded-2xl border px-4 py-3 text-sm transition ${
                          player.isPresent ? "border-emerald-400/40 bg-emerald-500/5" : "border-slate-700 bg-slate-900/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="cursor-move text-xs uppercase tracking-[0.4em] text-slate-700">⋮⋮</span>
                          <input
                            type="checkbox"
                            checked={player.isPresent}
                            onChange={(event) =>
                              updatePlayer(player.id, (current) => ({ ...current, isPresent: event.target.checked }))
                            }
                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-white">{player.nome}</p>
                          <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                            Ordem
                            <select
                              className="rounded-xl border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                              value={actualIndex}
                              onChange={(event) => handleOrderSelect(player.id, event.target.value)}
                            >
                              {linePlayers.map((linePlayer, optionIndex) => {
                                const optionActualIndex = players.findIndex((base) => base.id === linePlayer.id);
                                if (optionActualIndex === -1) {
                                  return null;
                                }
                                return (
                                  <option key={optionActualIndex} value={optionActualIndex}>
                                    {optionIndex + 1}º da fila
                                  </option>
                                );
                              })}
                            </select>
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updatePlayer(player.id, (current) => ({ ...current, isGoalkeeper: !current.isGoalkeeper }))
                          }
                          className="rounded-2xl border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-700"
                        >
                          Marcar GK
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-700">Nenhum jogador de linha disponível.</p>
              )}
            </div>

            <div className="border-t border-slate-800 pt-4">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-600">Goleiros</p>
              {goalkeeperPlayers.length ? (
                <ul className="mt-3 space-y-3">
                  {goalkeeperPlayers.map((player) => (
                    <li
                      key={player.id}
                      className={`flex flex-wrap items-center gap-4 rounded-2xl border px-4 py-3 text-sm transition ${
                        player.isPresent ? "border-emerald-400/40 bg-emerald-500/5" : "border-slate-700 bg-slate-900/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={player.isPresent}
                          onChange={(event) =>
                            updatePlayer(player.id, (current) => ({ ...current, isPresent: event.target.checked }))
                          }
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-white">{player.nome}</p>
                        <p className="text-xs text-slate-600">Goleiro dedicado</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updatePlayer(player.id, (current) => ({ ...current, isGoalkeeper: !current.isGoalkeeper }))
                        }
                        className="rounded-2xl border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        Remover GK
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-700">
                  Nao ha goleiros marcados. Utilize o botao "Marcar GK" nos jogadores de linha para trazer para esta lista.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-10 text-center text-sm text-slate-600">
            Nenhum jogador carregado. Certifique-se de selecionar um grupo com atletas cadastrados.
          </div>
        )}
      </section>

      {TeamsPreview()}
    </section>
  );
}
