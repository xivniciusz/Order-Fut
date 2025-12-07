import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  assist: "Assistencia",
  substitution: "Substituicao",
  left: "Saiu",
};

const chipColors: Record<EventType, string> = {
  goal: "bg-emerald-500/10 text-emerald-200 border-emerald-500/40",
  card: "bg-amber-500/10 text-amber-200 border-amber-500/40",
  assist: "bg-sky-500/10 text-sky-200 border-sky-500/40",
  substitution: "bg-purple-500/10 text-purple-200 border-purple-500/40",
  left: "bg-rose-500/10 text-rose-200 border-rose-500/40",
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
  left: true,
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
  const [countdownMinutesInput, setCountdownMinutesInput] = useState("10");
  const [warningSecondsInput, setWarningSecondsInput] = useState("60");
  const [countdownTargetSeconds, setCountdownTargetSeconds] = useState(600);
  const [clockSeconds, setClockSeconds] = useState(600);
  const [warningSeconds, setWarningSeconds] = useState(60);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const warningPlayedRef = useRef(false);
  const endPlayedRef = useRef(false);
  const lastMatchIdRef = useRef<string | null>(null);

  const [eventForm, setEventForm] = useState({
    tipo: "goal" as EventType,
    playerId: "",
    assistPlayerId: "",
    description: "",
  });

  const resetAudioFlags = useCallback(() => {
    warningPlayedRef.current = false;
    endPlayedRef.current = false;
  }, []);

  const playTone = useCallback(
    (type: "warning" | "end") => {
      if (!audioEnabled || typeof window === "undefined" || typeof window.AudioContext === "undefined") {
        return;
      }
      const duration = type === "warning" ? 0.18 : 0.4;
      const frequency = type === "warning" ? 880 : 440;
      const context = audioContextRef.current ?? new window.AudioContext();
      audioContextRef.current = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.1;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    },
    [audioEnabled],
  );

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    setEventForm((prev) => ({ ...prev, playerId: "", assistPlayerId: "" }));
  }, [eventForm.tipo]);

  const activeTeams = useMemo(() => {
    if (!matchDetail) {
      return [] as Array<[string, MatchDetailPlayer[]]>;
    }
    const activeNumbers = matchDetail.active_team_numbers ?? [];
    return activeNumbers.map((teamNumber) => {
      const key = String(teamNumber);
      return [key, matchDetail.teams?.[key] ?? []] as [string, MatchDetailPlayer[]];
    });
  }, [matchDetail]);

  const waitingTeams = useMemo(() => {
    if (!matchDetail) {
      return [] as Array<[string, MatchDetailPlayer[]]>;
    }
    const waitingNumbers = matchDetail.waiting_team_numbers ?? [];
    return waitingNumbers.map((teamNumber) => {
      const key = String(teamNumber);
      return [key, matchDetail.teams?.[key] ?? []] as [string, MatchDetailPlayer[]];
    });
  }, [matchDetail]);

  const fieldPlayers: MatchDetailPlayer[] = useMemo(
    () => activeTeams.flatMap(([, players]) => players),
    [activeTeams],
  );

  const queuePlayers: MatchDetailPlayer[] = useMemo(
    () => waitingTeams.flatMap(([, players]) => players),
    [waitingTeams],
  );

  const looseBenchPlayers: MatchDetailPlayer[] = useMemo(() => matchDetail?.bench ?? [], [matchDetail]);

  const benchPlayers: MatchDetailPlayer[] = useMemo(
    () => [...queuePlayers, ...looseBenchPlayers],
    [queuePlayers, looseBenchPlayers],
  );

  const playerOptions = useMemo(() => {
    if (eventForm.tipo === "substitution") {
      return [...fieldPlayers, ...benchPlayers];
    }
    return fieldPlayers;
  }, [eventForm.tipo, fieldPlayers, benchPlayers]);

  const assistOptions = useMemo(() => fieldPlayers, [fieldPlayers]);

  const orderedTeams = useMemo(() => {
    if (!matchDetail?.teams) {
      return [] as Array<[string, MatchDetailPlayer[]]>;
    }
    return Object.entries(matchDetail.teams).sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [matchDetail]);

  const playerTeamMap = useMemo(() => {
    const map = new Map<string, number | null>();
    if (!matchDetail) {
      return map;
    }
    Object.entries(matchDetail.teams ?? {}).forEach(([teamKey, players]) => {
      const teamNumber = Number(teamKey);
      players.forEach((player) => map.set(player.player_id, teamNumber));
    });
    (matchDetail.bench ?? []).forEach((player) => map.set(player.player_id, player.team_number));
    return map;
  }, [matchDetail]);

  const scoreboard = useMemo(() => {
    const board: Record<string, number> = {};
    orderedTeams.forEach(([teamKey]) => {
      board[teamKey] = 0;
    });
    if (!matchDetail) {
      return board;
    }
    const events = matchDetail.events ?? [];
    events.forEach((event) => {
      if (event.tipo !== "goal" || !event.player_id) {
        return;
      }
      const team = playerTeamMap.get(event.player_id);
      if (!team) {
        return;
      }
      const key = String(team);
      board[key] = (board[key] ?? 0) + 1;
    });
    return board;
  }, [matchDetail, orderedTeams, playerTeamMap]);

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
    const nextMatchId = matchDetail?.id ?? null;
    const hasChanged = lastMatchIdRef.current !== nextMatchId;
    if (!hasChanged) {
      return;
    }
    lastMatchIdRef.current = nextMatchId;
    setClockRunning(false);
    resetAudioFlags();
    setClockSeconds(countdownTargetSeconds);
  }, [matchDetail?.id, countdownTargetSeconds, resetAudioFlags]);

  useEffect(() => {
    if (!clockRunning) {
      return;
    }
    const interval = setInterval(() => {
      setClockSeconds((prev) => {
        const next = Math.max(prev - 1, 0);
        if (warningSeconds > 0 && next === warningSeconds && !warningPlayedRef.current) {
          playTone("warning");
          warningPlayedRef.current = true;
        }
        if (next === 0) {
          if (!endPlayedRef.current) {
            playTone("end");
            endPlayedRef.current = true;
          }
          setClockRunning(false);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [clockRunning, warningSeconds, playTone]);

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
    resetAudioFlags();
    setClockSeconds(countdownTargetSeconds);
  };

  const handleApplyCountdown = () => {
    const rawMinutes = Math.floor(Number(countdownMinutesInput)) || 0;
    const minutes = Math.min(Math.max(rawMinutes, 1), 90);
    const totalSeconds = minutes * 60;
    const rawWarning = Math.floor(Number(warningSecondsInput)) || 0;
    const warningValue = Math.max(Math.min(rawWarning, totalSeconds), 0);
    setCountdownMinutesInput(String(minutes));
    setWarningSecondsInput(String(warningValue));
    setCountdownTargetSeconds(totalSeconds);
    setWarningSeconds(warningValue);
    if (!clockRunning) {
      setClockSeconds(totalSeconds);
      resetAudioFlags();
    }
  };

  const detailLoaded = Boolean(matchDetail);

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Partida ao vivo</p>
        <h2 className="text-3xl font-semibold text-white">Controle em tempo real</h2>
        <p className="text-sm text-slate-600">
          Monitore escala, fila de entrada e eventos enquanto o jogo acontece. Registre gols, cartoes e substituicoes com um toque e mantenha
          a fila organizada.
        </p>
      </header>

      {error && <p className="rounded-3xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className={sectionCard}>
          <header className="mb-4">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-600">Selecionar partida</p>
            <h3 className="text-lg font-semibold text-white">Escolha pelo ID ou agenda</h3>
          </header>
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
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
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
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
            <p className="text-xs uppercase tracking-[0.4em] text-slate-600">Tempo e placar</p>
            <h3 className="text-lg font-semibold text-white">Controle do jogo</h3>
          </header>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800/50 bg-slate-950/40 p-4 text-center">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <p className="uppercase tracking-[0.3em]">Cronometro regressivo</p>
                <span className="text-[0.65rem] text-slate-700">Tempo baseado na configuracao abaixo</span>
              </div>
              <p className="mt-3 text-4xl font-semibold text-white">{formatClock(clockSeconds)}</p>
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
              <div className="mt-4 space-y-2 text-left text-xs text-slate-600">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="block text-[0.6rem] uppercase tracking-[0.3em] text-slate-700">Duracao (min)</span>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      className="w-full rounded-2xl border border-slate-800/60 bg-slate-950/60 px-3 py-2 text-white"
                      value={countdownMinutesInput}
                      onChange={(event) => setCountdownMinutesInput(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[0.6rem] uppercase tracking-[0.3em] text-slate-700">Aviso final (s)</span>
                    <input
                      type="number"
                      min={0}
                      className="w-full rounded-2xl border border-slate-800/60 bg-slate-950/60 px-3 py-2 text-white"
                      value={warningSecondsInput}
                      onChange={(event) => setWarningSecondsInput(event.target.value)}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="w-full rounded-2xl border border-emerald-500/60 px-3 py-2 text-emerald-200"
                  onClick={handleApplyCountdown}
                >
                  Aplicar configuracao
                </button>
                <p className="text-[0.65rem] text-slate-700">Alertas soam no aviso configurado e quando o tempo zera.</p>
              </div>
              <label className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border border-slate-700 bg-slate-950"
                  checked={audioEnabled}
                  onChange={(event) => setAudioEnabled(event.target.checked)}
                />
                Alertas sonoros
              </label>
            </div>
            <div className="rounded-2xl border border-slate-800/50 bg-slate-950/40 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-600">Placar</p>
              {orderedTeams.length ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {orderedTeams.map(([teamKey]) => {
                    const teamNumber = Number(teamKey);
                    const isActive = matchDetail?.active_team_numbers?.includes(teamNumber);
                    const queueIndex = matchDetail?.waiting_team_numbers?.indexOf(teamNumber) ?? -1;
                    return (
                      <div
                        key={teamKey}
                        className={`rounded-2xl border bg-black/20 p-3 ${
                          isActive
                            ? "border-emerald-500/60"
                            : queueIndex >= 0
                              ? "border-slate-700"
                              : "border-slate-800/70"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-700">Time {teamKey}</p>
                          {isActive && <span className="text-[0.65rem] uppercase tracking-[0.3em] text-emerald-400">Em quadra</span>}
                          {!isActive && queueIndex >= 0 && (
                            <span className="text-[0.65rem] text-slate-700">Fila #{queueIndex + 1}</span>
                          )}
                        </div>
                        <p className="mt-1 text-3xl font-semibold text-white">{scoreboard[teamKey] ?? 0}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-700">Nenhuma equipe escalada.</p>
              )}
              <p className="mt-3 text-xs text-slate-700">Gols somados pelos eventos registrados.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            {(matchDetail?.active_team_numbers ?? []).map((teamNumber) => {
              const hasQueue = Boolean(matchDetail?.waiting_team_numbers?.length);
              return (
                <button
                  key={teamNumber}
                  type="button"
                  onClick={() => handleRotateTeam(teamNumber)}
                  disabled={!detailLoaded || !hasQueue || rotateLoading === teamNumber}
                  className="flex-1 rounded-2xl border border-slate-700 px-4 py-3 text-slate-200 disabled:opacity-50"
                >
                  {rotateLoading === teamNumber ? "Rotacionando..." : `Retirar Time ${teamNumber}`}
                </button>
              );
            })}
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
            <p className="text-xs uppercase tracking-[0.4em] text-slate-600">Times em quadra</p>
            <h3 className="text-lg font-semibold text-white">Escalacao atual</h3>
          </header>
          {detailLoaded ? (
            activeTeams.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {activeTeams.map(([teamKey, players]) => (
                  <div key={teamKey} className="rounded-2xl border border-emerald-500/30 bg-slate-950/40 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Time {teamKey}</p>
                    <ul className="mt-3 space-y-2 text-sm">
                      {players.length ? (
                        players.map((player) => (
                          <li key={player.match_player_id} className="rounded-2xl border border-slate-800/70 bg-black/20 px-3 py-2 text-slate-200">
                            <span className="font-semibold">{player.nome}</span>
                            {player.is_goalkeeper && <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200">GK</span>}
                          </li>
                        ))
                      ) : (
                        <li className="rounded-2xl border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-700">Sem jogadores atribuídos.</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-700">Gere os times e comece a contagem regressiva para liberar a escala.</p>
            )
          ) : (
            <p className="text-sm text-slate-700">Carregue uma partida para visualizar as equipes.</p>
          )}
        </div>

        <div className={`${sectionCard} space-y-4`}>
          <header>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-600">Fila e banco</p>
            <h3 className="text-lg font-semibold text-white">Quem aguarda entrar</h3>
          </header>
          {detailLoaded ? (
            waitingTeams.length || looseBenchPlayers.length ? (
              <div className="space-y-5 text-sm">
                {waitingTeams.length ? (
                  <div className="space-y-3">
                    {waitingTeams.map(([teamKey, players], index) => (
                      <div key={teamKey} className="rounded-2xl border border-slate-800/70 bg-black/15 p-4">
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <p className="uppercase tracking-[0.3em]">Time {teamKey}</p>
                          <span>#{index + 1} na fila</span>
                        </div>
                        <ul className="mt-3 space-y-2">
                          {players.length ? (
                            players.map((player) => (
                              <li key={player.match_player_id} className="rounded-2xl border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-slate-200">
                                <span className="font-semibold">{player.nome}</span>
                                {player.has_played && <span className="ml-2 text-xs text-slate-600">Ja jogou</span>}
                              </li>
                            ))
                          ) : (
                            <li className="rounded-2xl border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-700">Sem jogadores atribuídos.</li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-700">Nenhum time aguarda para entrar.</p>
                )}
                {looseBenchPlayers.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-700">Jogadores sem time definido</p>
                    <ul className="mt-3 space-y-2">
                      {looseBenchPlayers.map((player) => (
                        <li key={player.match_player_id} className="rounded-2xl border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-slate-200">
                          <span className="font-semibold">{player.nome}</span>
                          <span className="ml-2 text-xs text-slate-600">Fila #{player.order_position + 1}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-700">Sem filas: todos os presentes estao em quadra.</p>
            )
          ) : (
            <p className="text-sm text-slate-700">Carregue uma partida para ver a fila.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <form className={`${sectionCard} space-y-4`} onSubmit={handleEventSubmit}>
          <header>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-600">Registrar evento</p>
            <h3 className="text-lg font-semibold text-white">Atualize a parcial</h3>
          </header>
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
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
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
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
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
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
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
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
            <p className="text-xs uppercase tracking-[0.4em] text-slate-600">Eventos</p>
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
                    <span className="text-xs text-slate-700">{formatDateTime(event.created_at)}</span>
                  </div>
                  <p className="mt-2 font-semibold text-white">
                    {event.player_nome ?? "Evento geral"}
                    {event.assist_player_nome && (
                      <span className="text-xs text-slate-600"> · Assist: {event.assist_player_nome}</span>
                    )}
                  </p>
                  {event.description && <p className="text-xs text-slate-600">{event.description}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-700">Nenhum evento registrado ainda.</p>
          )}
        </div>
      </div>
    </section>
  );
}
