import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useActiveGroup } from "./ActiveGroupContext";
import type { RecentMatchSummary } from "./dashboardApi";
import {
  EventType,
  MatchDetailPlayer,
  MatchDetailResponse,
  matchesApi,
} from "./matchesApi";

export type MatchLiveProps = {
  token: string;
};

const EVENT_LABELS: Record<EventType, string> = {
  goal: "Gol",
  card: "Cartao",
  attendance: "Presenca",
  assist: "Assistencia",
  substitution: "Substituicao",
};

const chipColors: Record<EventType, string> = {
  goal: "bg-emerald-500/10 text-emerald-200 border-emerald-500/40",
  card: "bg-amber-500/10 text-amber-200 border-amber-500/40",
  attendance: "bg-slate-500/10 text-slate-200 border-slate-500/30",
  assist: "bg-sky-500/10 text-sky-200 border-sky-500/40",
  substitution: "bg-purple-500/10 text-purple-200 border-purple-500/40",
};

const sectionCard = "rounded-3xl border border-slate-800/60 bg-slate-900/50 p-5";

const formatDateTime = (value: string) => {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatClock = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const EVENT_MANDATORY_PLAYER: Partial<Record<EventType, boolean>> = {
  goal: true,
  card: true,
  assist: true,
  substitution: true,
};

const EVENT_NEEDS_ASSIST: Partial<Record<EventType, boolean>> = {
  goal: true,
  assist: true,
};

export default function MatchLive({ token }: MatchLiveProps) {
  const { stats } = useActiveGroup();
  const scheduledMatches = useMemo(() => stats?.recent_matches ?? [], [stats]);

  const [matchIdInput, setMatchIdInput] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [matchDetail, setMatchDetail] = useState<MatchDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [rotateLoading, setRotateLoading] = useState<number | null>(null);
  const [finishLoading, setFinishLoading] = useState(false);
  const [clockRunning, setClockRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [eventForm, setEventForm] = useState({
    tipo: "goal" as EventType,
    playerId: "",
    assistPlayerId: "",
    description: "",
  });

  useEffect(() => {
    setEventForm((prev) => ({ ...prev, playerId: "", assistPlayerId: "" }));
  }, [eventForm.tipo]);

  const availablePlayers: MatchDetailPlayer[] = useMemo(() => {
    if (!matchDetail) {
      return [];
    }
    const teams = Object.values(matchDetail.teams ?? {}).flat();
    return [...teams, ...matchDetail.bench];
  }, [matchDetail]);

  const fieldPlayers: MatchDetailPlayer[] = useMemo(() => {
    if (!matchDetail) {
      return [];
    }
    return Object.values(matchDetail.teams ?? {}).flat();
  }, [matchDetail]);

  const benchPlayers: MatchDetailPlayer[] = useMemo(() => (matchDetail ? matchDetail.bench : []), [matchDetail]);

  const playerOptions = useMemo(() => {
    if (!matchDetail) {
      return [];
    }
    if (eventForm.tipo === "substitution") {
      return [...fieldPlayers, ...benchPlayers];
    }
    return fieldPlayers;
  }, [matchDetail, eventForm.tipo, fieldPlayers, benchPlayers]);

  const assistOptions = useMemo(() => fieldPlayers, [fieldPlayers]);

  const playerTeamMap = useMemo(() => {
    const map = new Map<string, number | null>();
    if (!matchDetail) {
      return map;
    }
    Object.entries(matchDetail.teams ?? {}).forEach(([teamKey, players]) => {
      const teamNumber = Number(teamKey);
      players.forEach((player) => map.set(player.player_id, teamNumber));
    });
    matchDetail.bench.forEach((player) => map.set(player.player_id, player.team_number));
    return map;
  }, [matchDetail]);

  const scoreboard = useMemo(() => {
    let team1 = 0;
    let team2 = 0;
    if (!matchDetail) {
      return { team1, team2 };
    }
    const events = matchDetail.events ?? [];
    events.forEach((event) => {
      if (event.tipo !== "goal" || !event.player_id) {
        return;
      }
      const team = playerTeamMap.get(event.player_id);
      if (team === 1) {
        team1 += 1;
      } else if (team === 2) {
        team2 += 1;
      }
    });
    return { team1, team2 };
  }, [matchDetail, playerTeamMap]);

  const fetchMatch = useCallback(
    async (matchId: string, { silent = false }: { silent?: boolean } = {}) => {
      if (!matchId) {
        if (!silent) {
          setError("Informe o ID da partida para iniciar o monitoramento.");
        }
        return;
      }
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const detail = await matchesApi.detail(token, matchId);
        setMatchDetail(detail);
        setSelectedMatchId(matchId);
        if (!silent) {
          setMatchIdInput(matchId);
        }
      } catch (err) {
        if (!silent) {
          const message = err instanceof Error ? err.message : "Nao foi possivel carregar a partida.";
          setError(message);
          setMatchDetail(null);
          setSelectedMatchId(null);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [token],
  );

  useEffect(() => {
    if (!selectedMatchId) {
      return;
    }
    const interval = setInterval(() => {
      fetchMatch(selectedMatchId, { silent: true });
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedMatchId, fetchMatch]);

  useEffect(() => {
    if (!matchDetail) {
      return;
    }
    setClockRunning(false);
    const startsAt = new Date(matchDetail.starts_at).getTime();
    if (!Number.isNaN(startsAt)) {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - startsAt) / 1000));
      setElapsedSeconds(diff);
    } else {
      setElapsedSeconds(0);
    }
  }, [matchDetail?.starts_at]);

  useEffect(() => {
    if (!clockRunning) {
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [clockRunning]);

  const handleLoadMatch = () => fetchMatch(matchIdInput.trim());

  const handleSelectScheduled = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setMatchIdInput(value);
    if (value) {
      fetchMatch(value);
    }
  };

  const handleRotateTeam = async (teamNumber: number) => {
    if (!selectedMatchId) {
      return;
    }
    setRotateLoading(teamNumber);
    setError(null);
    try {
      const updated = await matchesApi.rotate(token, selectedMatchId, { team_number: teamNumber });
      setMatchDetail(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel rotacionar o time.";
      setError(message);
    } finally {
      setRotateLoading(null);
    }
  };

  const handleFinishMatch = async () => {
    if (!selectedMatchId) {
      return;
    }
    setFinishLoading(true);
    setError(null);
    try {
      await matchesApi.finish(token, selectedMatchId);
      await fetchMatch(selectedMatchId);
      setClockRunning(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel finalizar a partida.";
      setError(message);
    } finally {
      setFinishLoading(false);
    }
  };

  const handleEventSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMatchId) {
      setError("Selecione uma partida para registrar eventos.");
      return;
    }
    if (EVENT_MANDATORY_PLAYER[eventForm.tipo] && !eventForm.playerId) {
      setError("Escolha o jogador principal para este evento.");
      return;
    }
    setEventLoading(true);
    setError(null);
    try {
      await matchesApi.createEvent(token, {
        match_id: selectedMatchId,
        tipo: eventForm.tipo,
        player_id: eventForm.playerId || undefined,
        assist_player_id: eventForm.assistPlayerId || undefined,
        description: eventForm.description?.trim() || undefined,
      });
      setEventForm((prev) => ({ ...prev, playerId: "", assistPlayerId: "", description: "" }));
      await fetchMatch(selectedMatchId, { silent: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel registrar o evento.";
      setError(message);
    } finally {
      setEventLoading(false);
    }
  };

  const handleResetClock = () => {
    setClockRunning(false);
    setElapsedSeconds(0);
  };

  const detailLoaded = Boolean(matchDetail);

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Partida ao vivo</p>
        <h2 className="text-3xl font-semibold text-white">Controle em tempo real</h2>
        <p className="text-sm text-slate-400">
          Monitore escala, fila de entrada e eventos enquanto o jogo acontece. Registre gols, cartoes e substituicoes com um toque e mantenha
          a fila organizada.
        </p>
      </header>

      {error && <p className="rounded-3xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className={sectionCard}>
          <header className="mb-4">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Selecionar partida</p>
            <h3 className="text-lg font-semibold text-white">Escolha pelo ID ou agenda</h3>
          </header>
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Escolha rapida
              <select
                className="mt-2 w-full rounded-2xl border border-slate-800/50 bg-slate-950/40 px-4 py-3 text-sm text-white"
                value={matchIdInput}
                onChange={handleSelectScheduled}
              >
                <option value="">Selecione um agendamento</option>
                {scheduledMatches.map((match: RecentMatchSummary) => (
                  <option key={match.id} value={match.id}>
                    {match.titulo} · {formatDateTime(match.starts_at)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Ou informe manualmente
              <input
                className="mt-2 w-full rounded-2xl border border-slate-800/50 bg-slate-950/40 px-4 py-3 text-sm text-white placeholder-slate-500"
                value={matchIdInput}
                onChange={(event) => setMatchIdInput(event.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </label>
            <div className="flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                onClick={handleLoadMatch}
                className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-emerald-950 shadow-lg shadow-emerald-500/30 disabled:opacity-60"
                disabled={!matchIdInput || loading}
              >
                {loading ? "Carregando..." : "Carregar partida"}
              </button>
              {selectedMatchId && (
                <button
                  type="button"
                  onClick={() => fetchMatch(selectedMatchId)}
                  className="rounded-2xl border border-slate-700 px-4 py-3 text-slate-200"
                >
                  Atualizar
                </button>
              )}
              {selectedMatchId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMatchId(null);
                    setMatchDetail(null);
                  }}
                  className="rounded-2xl border border-slate-700 px-4 py-3 text-slate-200"
                >
                  Encerrar sessao
                </button>
              )}
            </div>
            {detailLoaded && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100">
                <p className="font-semibold">{matchDetail?.titulo}</p>
                <p className="text-xs text-emerald-200">ID: {selectedMatchId}</p>
                <p className="text-xs text-emerald-200">Inicio: {formatDateTime(matchDetail!.starts_at)}</p>
                <p className="text-xs text-emerald-200">Status: {matchDetail?.status === "finished" ? "Finalizado" : "Em andamento"}</p>
              </div>
            )}
          </div>
        </div>

        <div className={`${sectionCard} space-y-4`}>
          <header>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Tempo e placar</p>
            <h3 className="text-lg font-semibold text-white">Controle do jogo</h3>
          </header>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800/50 bg-slate-950/40 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Cronometro</p>
              <p className="mt-2 text-4xl font-semibold text-white">{formatClock(elapsedSeconds)}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-2xl border border-slate-700 px-3 py-1 text-slate-200"
                  onClick={() => setClockRunning((prev) => !prev)}
                  disabled={!detailLoaded}
                >
                  {clockRunning ? "Pausar" : "Iniciar"}
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-slate-700 px-3 py-1 text-slate-200"
                  onClick={handleResetClock}
                  disabled={!detailLoaded}
                >
                  Reiniciar
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800/50 bg-slate-950/40 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Placar</p>
              <div className="mt-3 flex items-center justify-center gap-4 text-3xl font-semibold text-white">
                <span>{scoreboard.team1}</span>
                <span className="text-base text-slate-500">vs</span>
                <span>{scoreboard.team2}</span>
              </div>
              <p className="mt-3 text-xs text-slate-500">Gols somados pelos eventos registrados.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <button
              type="button"
              onClick={() => handleRotateTeam(1)}
              disabled={!detailLoaded || !matchDetail?.bench.length || rotateLoading === 1}
              className="flex-1 rounded-2xl border border-slate-700 px-4 py-3 text-slate-200 disabled:opacity-50"
            >
              {rotateLoading === 1 ? "Rotacionando..." : "Entrar Time 1"}
            </button>
            <button
              type="button"
              onClick={() => handleRotateTeam(2)}
              disabled={!detailLoaded || !matchDetail?.bench.length || rotateLoading === 2}
              className="flex-1 rounded-2xl border border-slate-700 px-4 py-3 text-slate-200 disabled:opacity-50"
            >
              {rotateLoading === 2 ? "Rotacionando..." : "Entrar Time 2"}
            </button>
            <button
              type="button"
              onClick={handleFinishMatch}
              disabled={!detailLoaded || matchDetail?.status === "finished" || finishLoading}
              className="rounded-2xl bg-rose-500/20 px-4 py-3 font-semibold text-rose-200 disabled:opacity-50"
            >
              {finishLoading ? "Encerrando..." : "Finalizar partida"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${sectionCard} space-y-4`}>
          <header>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Times em quadra</p>
            <h3 className="text-lg font-semibold text-white">Escalacao atual</h3>
          </header>
          {detailLoaded ? (
            <div className="grid gap-4 md:grid-cols-2">
              {["1", "2"].map((teamKey) => (
                <div key={teamKey} className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Time {teamKey}</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {matchDetail?.teams?.[teamKey]?.length ? (
                      matchDetail.teams[teamKey].map((player) => (
                        <li key={player.match_player_id} className="rounded-2xl border border-slate-800/70 bg-black/20 px-3 py-2 text-slate-200">
                          <span className="font-semibold">{player.nome}</span>
                          {player.is_goalkeeper && <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200">GK</span>}
                        </li>
                      ))
                    ) : (
                      <li className="rounded-2xl border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-500">Sem jogadores atribuídos.</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Carregue uma partida para visualizar as equipes.</p>
          )}
        </div>

        <div className={`${sectionCard} space-y-4`}>
          <header>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Fila e banco</p>
            <h3 className="text-lg font-semibold text-white">Quem aguarda entrar</h3>
          </header>
          {detailLoaded ? (
            matchDetail?.bench.length ? (
              <ul className="space-y-2 text-sm">
                {matchDetail.bench.map((player) => (
                  <li key={player.match_player_id} className="flex items-center justify-between rounded-2xl border border-slate-800/70 bg-black/20 px-4 py-2 text-slate-200">
                    <div>
                      <p className="font-semibold">{player.nome}</p>
                      <p className="text-xs text-slate-500">Ordem #{player.order_position + 1}</p>
                    </div>
                    {player.team_number && <span className="text-xs text-slate-400">Preferencia: Time {player.team_number}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Sem filas: todos os presentes estao em quadra.</p>
            )
          ) : (
            <p className="text-sm text-slate-500">Carregue uma partida para ver a fila.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <form className={`${sectionCard} space-y-4`} onSubmit={handleEventSubmit}>
          <header>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Registrar evento</p>
            <h3 className="text-lg font-semibold text-white">Atualize a parcial</h3>
          </header>
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Tipo de evento
            <select
              className="mt-2 w-full rounded-2xl border border-slate-800/50 bg-slate-950/40 px-4 py-3 text-sm text-white"
              value={eventForm.tipo}
              onChange={(event) =>
                setEventForm((prev) => ({ ...prev, tipo: event.target.value as EventType }))
              }
              disabled={!detailLoaded || eventLoading}
            >
              {(Object.keys(EVENT_LABELS) as EventType[]).map((type) => (
                <option key={type} value={type}>
                  {EVENT_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Jogador principal
            <select
              className="mt-2 w-full rounded-2xl border border-slate-800/50 bg-slate-950/40 px-4 py-3 text-sm text-white"
              value={eventForm.playerId}
              onChange={(event) => setEventForm((prev) => ({ ...prev, playerId: event.target.value }))}
              disabled={!detailLoaded || !playerOptions.length || eventLoading}
            >
              <option value="">Selecione o atleta</option>
              {playerOptions.map((player) => (
                <option key={player.match_player_id} value={player.player_id}>
                  {player.nome}
                </option>
              ))}
            </select>
          </label>
          {EVENT_NEEDS_ASSIST[eventForm.tipo] && (
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Assistencia (opcional)
              <select
                className="mt-2 w-full rounded-2xl border border-slate-800/50 bg-slate-950/40 px-4 py-3 text-sm text-white"
                value={eventForm.assistPlayerId}
                onChange={(event) => setEventForm((prev) => ({ ...prev, assistPlayerId: event.target.value }))}
                disabled={!detailLoaded || !assistOptions.length || eventLoading}
              >
                <option value="">Sem assistencia</option>
                {assistOptions.map((player) => (
                  <option key={player.match_player_id} value={player.player_id}>
                    {player.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Observacoes
            <textarea
              className="mt-2 w-full rounded-2xl border border-slate-800/50 bg-slate-950/40 px-4 py-3 text-sm text-white placeholder-slate-500"
              rows={3}
              value={eventForm.description}
              onChange={(event) => setEventForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Ex.: Gol de cobertura, cartao por falta forte..."
              disabled={!detailLoaded || eventLoading}
              maxLength={255}
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/30 disabled:opacity-60"
            disabled={!detailLoaded || eventLoading}
          >
            {eventLoading ? "Registrando..." : "Registrar evento"}
          </button>
        </form>

        <div className={`${sectionCard} space-y-4`}>
          <header>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Eventos</p>
            <h3 className="text-lg font-semibold text-white">Linha do tempo</h3>
          </header>
          {detailLoaded && matchDetail?.events?.length ? (
            <ul className="space-y-3">
              {[...matchDetail.events].reverse().map((event) => (
                <li key={event.id} className="rounded-2xl border border-slate-800/60 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${chipColors[event.tipo]}`}>
                      {EVENT_LABELS[event.tipo]}
                    </span>
                    <span className="text-xs text-slate-500">{formatDateTime(event.created_at)}</span>
                  </div>
                  <p className="mt-2 font-semibold text-white">
                    {event.player_nome ?? "Evento geral"}
                    {event.assist_player_nome && (
                      <span className="text-xs text-slate-400"> · Assist: {event.assist_player_nome}</span>
                    )}
                  </p>
                  {event.description && <p className="text-xs text-slate-400">{event.description}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Nenhum evento registrado ainda.</p>
          )}
        </div>
      </div>
    </section>
  );
}
