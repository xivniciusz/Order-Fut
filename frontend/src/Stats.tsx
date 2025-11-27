import { useEffect, useMemo, useRef, useState } from "react";
import { useActiveGroup } from "./ActiveGroupContext";
import type {
  ChartPoint,
  GroupStatsResponse,
  PlayerMatchSnapshot,
  PlayerStatsResponse,
  PlayerStatSnapshot,
  PlayerYearBreakdown,
  RankingEntry,
} from "./statsApi";
import { statsApi } from "./statsApi";

export type StatsProps = {
  token: string;
};

const Skeleton = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-3xl bg-slate-800/30 ${className}`} />
);

const chipColors = {
  goals: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  assists: "bg-sky-500/15 text-sky-200 border-sky-500/30",
  matches: "bg-indigo-500/15 text-indigo-200 border-indigo-500/30",
};

type RankingCardProps = {
  title: string;
  helper: string;
  entries: RankingEntry[];
  accent: keyof typeof chipColors;
};

const RankingCard = ({ title, helper, entries, accent }: RankingCardProps) => (
  <div className="rounded-3xl border border-slate-800/60 bg-slate-950/40 p-5">
    <header className="mb-3">
      <p className="text-[0.6rem] uppercase tracking-[0.4em] text-slate-500">Ranking</p>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="text-xs text-slate-400">{helper}</p>
    </header>
    {entries.length ? (
      <ul className="space-y-2 text-sm">
        {entries.slice(0, 5).map((entry, index) => (
          <li
            key={entry.player_id}
            className="flex items-center justify-between rounded-2xl border border-slate-800/60 bg-black/20 px-4 py-2"
          >
            <div>
              <p className="font-semibold text-white">
                {index + 1}. {entry.player_nome}
              </p>
              <p className="text-xs text-slate-500">Top {index + 1} da categoria</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${chipColors[accent]}`}>{entry.value}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-xs text-slate-500">Sem registros para o filtro atual.</p>
    )}
  </div>
);

const ChartCard = ({ points }: { points: ChartPoint[] }) => {
  const maxValue = Math.max(...points.map((point) => Math.max(point.matches, point.goals)), 1);
  return (
    <div className="rounded-3xl border border-slate-800/60 bg-slate-950/40 p-5">
      <header className="mb-4">
        <p className="text-[0.6rem] uppercase tracking-[0.4em] text-slate-500">Grafico de tendencia</p>
        <h3 className="text-lg font-semibold text-white">Producao mensal</h3>
        <p className="text-xs text-slate-400">Comparacao visual entre partidas disputadas e gols marcados.</p>
      </header>
      {points.length ? (
        <div className="flex items-end gap-4 overflow-x-auto py-4">
          {points.map((point) => (
            <div key={point.label} className="flex flex-1 min-w-[60px] flex-col items-center gap-2 text-xs text-slate-400">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                <span
                  className="inline-flex w-3 rounded-full bg-indigo-500/40"
                  style={{ height: `${(point.matches / maxValue) * 100}%` }}
                />
                <span
                  className="inline-flex w-3 rounded-full bg-emerald-500/60"
                  style={{ height: `${(point.goals / maxValue) * 100}%` }}
                />
              </div>
              <span className="font-semibold text-white">{point.label}</span>
              <div className="text-[0.6rem] uppercase tracking-[0.3em] text-slate-500">
                <p>Jogos: {point.matches}</p>
                <p>Gols: {point.goals}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">Gere eventos para visualizar a curva de desempenho.</p>
      )}
    </div>
  );
};

const SummaryCard = ({
  period,
  allTime,
  label,
}: {
  period: GroupStatsResponse["totals_period"];
  allTime: GroupStatsResponse["totals_all_time"];
  label: string;
}) => (
  <div className="rounded-3xl border border-slate-800/60 bg-slate-950/40 p-5">
    <header className="mb-3">
      <p className="text-[0.6rem] uppercase tracking-[0.4em] text-slate-500">Consolidado</p>
      <h3 className="text-lg font-semibold text-white">{label}</h3>
      <p className="text-xs text-slate-400">Total da filtragem atual vs historico completo.</p>
    </header>
    <dl className="space-y-3 text-sm">
      {["goals", "assists", "matches", "cards"].map((field) => (
        <div key={field}>
          <dt className="text-xs uppercase tracking-[0.3em] text-slate-500">
            {field === "goals" ? "Gols" : field === "assists" ? "Assistencias" : field === "matches" ? "Jogos" : "Cartoes"}
          </dt>
          <dd className="mt-1 flex items-center gap-3">
            <span className="text-3xl font-semibold text-white">{period[field as keyof typeof period]}</span>
            <div className="flex flex-1 items-center gap-2 text-xs text-slate-500">
              <div className="h-1 flex-1 rounded-full bg-slate-800">
                <div
                  className="h-1 rounded-full bg-emerald-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (period[field as keyof typeof period] / Math.max(1, allTime[field as keyof typeof allTime])) * 100,
                    )}%`,
                  }}
                />
              </div>
              <span className="text-[0.7rem]">{allTime[field as keyof typeof allTime]} historico</span>
            </div>
          </dd>
        </div>
      ))}
    </dl>
  </div>
);

const PlayerDetail = ({
  loading,
  error,
  data,
  onClose,
}: {
  loading: boolean;
  error: string | null;
  data: PlayerStatsResponse | null;
  onClose: () => void;
}) => (
  <div className="rounded-3xl border border-slate-800/60 bg-slate-950/40 p-5">
    <header className="mb-3 flex items-center justify-between">
      <div>
        <p className="text-[0.6rem] uppercase tracking-[0.4em] text-slate-500">Detalhes</p>
        <h3 className="text-lg font-semibold text-white">Atleta selecionado</h3>
      </div>
      {data && (
        <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-white">
          Limpar
        </button>
      )}
    </header>
    {loading ? (
      <Skeleton className="h-72" />
    ) : error ? (
      <p className="text-sm text-rose-300">{error}</p>
    ) : data ? (
      <div className="space-y-4 text-sm">
        <div>
          <p className="text-2xl font-semibold text-white">{data.player.nome}</p>
          <p className="text-xs text-slate-400">#{data.player.numero_camisa ?? "--"} · {data.player.posicao ?? "Sem posicao"}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {["goals", "assists", "matches", "cards"].map((field) => (
            <div key={field} className="rounded-2xl border border-slate-800/60 bg-black/20 px-4 py-3">
              <p className="text-[0.6rem] uppercase tracking-[0.3em] text-slate-500">
                {field === "goals" ? "Gols" : field === "assists" ? "Assistencias" : field === "matches" ? "Jogos" : "Cartoes"}
              </p>
              <p className="text-2xl font-semibold text-white">{data.totals[field as keyof typeof data.totals]}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Historico anual</p>
          {data.per_year.length ? (
            <ul className="mt-2 space-y-2">
              {data.per_year.map((yearItem: PlayerYearBreakdown) => (
                <li key={yearItem.year} className="rounded-2xl border border-slate-800/60 bg-black/20 px-4 py-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Ano {yearItem.year}</span>
                    <span>{yearItem.totals.matches} jogos</span>
                  </div>
                  <div className="mt-2 flex gap-3 text-[0.75rem] text-slate-300">
                    <span>⚽ {yearItem.totals.goals}</span>
                    <span>🎯 {yearItem.totals.assists}</span>
                    <span>🧱 {yearItem.totals.cards}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Sem distribuicao anual.</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Ultimos jogos</p>
          {data.recent_matches.length ? (
            <ul className="mt-2 space-y-2 text-xs">
              {data.recent_matches.map((match: PlayerMatchSnapshot) => (
                <li key={match.match_id} className="rounded-2xl border border-slate-800/60 bg-black/20 px-4 py-2 text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{match.titulo}</span>
                    <span>{new Date(match.starts_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <p className="mt-1 text-[0.7rem] uppercase tracking-[0.3em] text-slate-500">
                    Gols {match.goals} · Assist {match.assists} · Cartoes {match.cards}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Participacao recente nao encontrada.</p>
          )}
        </div>
      </div>
    ) : (
      <p className="text-sm text-slate-500">Selecione um atleta na tabela para ver os detalhes.</p>
    )}
  </div>
);

function formatGeneratedAt(value?: string) {
  if (!value) {
    return "--";
  }
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function Stats({ token }: StatsProps) {
  const { selectedGroupId, groups } = useActiveGroup();
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [groupStats, setGroupStats] = useState<GroupStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef(new Map<string, GroupStatsResponse>());
  const playerCacheRef = useRef(new Map<string, PlayerStatsResponse>());
  const [playerFocusId, setPlayerFocusId] = useState<string | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStatsResponse | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const currentGroupName = useMemo(() => {
    return groups.find((group) => group.id === selectedGroupId)?.nome ?? "";
  }, [groups, selectedGroupId]);

  useEffect(() => {
    setYearFilter("all");
    setGroupStats(null);
    setPlayerFocusId(null);
    setPlayerStats(null);
    setError(null);
    playerCacheRef.current.clear();
  }, [selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId) {
      return;
    }
    const yearValue = yearFilter === "all" ? null : Number(yearFilter);
    const cacheKey = `${selectedGroupId}:${yearValue ?? "all"}`;
    if (cacheRef.current.has(cacheKey)) {
      setGroupStats(cacheRef.current.get(cacheKey)!);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    statsApi
      .getGroupStats(token, selectedGroupId, yearValue)
      .then((response) => {
        if (cancelled) {
          return;
        }
        cacheRef.current.set(cacheKey, response);
        setGroupStats(response);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : "Nao foi possivel carregar as estatisticas.";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedGroupId, yearFilter]);

  useEffect(() => {
    if (!playerFocusId) {
      setPlayerStats(null);
      setPlayerError(null);
      setPlayerLoading(false);
      return;
    }
    if (playerCacheRef.current.has(playerFocusId)) {
      setPlayerStats(playerCacheRef.current.get(playerFocusId)!);
      return;
    }
    let cancelled = false;
    setPlayerLoading(true);
    setPlayerError(null);
    statsApi
      .getPlayerStats(token, playerFocusId)
      .then((response) => {
        if (cancelled) {
          return;
        }
        playerCacheRef.current.set(playerFocusId, response);
        setPlayerStats(response);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : "Nao foi possivel carregar o atleta.";
        setPlayerError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setPlayerLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [playerFocusId, token]);

  const highlightedPlayers = useMemo(() => {
    if (!groupStats) {
      return new Set<string>();
    }
    return new Set([
      ...groupStats.rankings.goals.map((entry) => entry.player_id),
      ...groupStats.rankings.assists.map((entry) => entry.player_id),
      ...groupStats.rankings.matches.map((entry) => entry.player_id),
    ]);
  }, [groupStats]);

  const yearOptions = useMemo(() => {
    const base = groupStats?.available_years ?? [];
    return base.length ? base : [];
  }, [groupStats]);

  if (!selectedGroupId) {
    return (
      <section className="space-y-4">
        <div className="rounded-3xl border border-slate-800/60 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
          Escolha um grupo na barra lateral para visualizar as estatisticas consolidadas.
        </div>
      </section>
    );
  }

  const periodLabel = yearFilter === "all" ? "Todos os anos" : `Ano ${yearFilter}`;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-800/60 bg-gradient-to-r from-emerald-500/10 to-slate-950/60 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.6em] text-emerald-300">{currentGroupName || "Estatisticas"}</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Central de desempenho</h2>
          <p className="text-sm text-slate-300">
            Compare goleadores, criadores e minutos em campo. Ajuste o periodo para acompanhar evolucao anual ou geral.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Selecione o ano
            <select
              className="mt-2 w-full rounded-2xl border border-slate-800/60 bg-slate-950/70 px-4 py-2 text-sm text-white"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
            >
              <option value="all">Todos os anos</option>
              {yearOptions.map((year) => (
                <option key={year} value={year.toString()}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-2xl border border-slate-800/60 bg-black/30 px-4 py-3 text-xs text-slate-400">
            <p className="uppercase tracking-[0.3em] text-slate-500">Ultima geracao</p>
            <p className="mt-1 text-sm text-white">{formatGeneratedAt(groupStats?.generated_at)}</p>
          </div>
        </div>
      </header>

      {error && <p className="rounded-3xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

      {loading && !groupStats ? (
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : groupStats ? (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <RankingCard title="Gols" helper={`Top 5 • ${periodLabel}`} entries={groupStats.rankings.goals} accent="goals" />
            <RankingCard title="Assistencias" helper={`Top 5 • ${periodLabel}`} entries={groupStats.rankings.assists} accent="assists" />
            <RankingCard title="Presenca" helper={`Top 5 • ${periodLabel}`} entries={groupStats.rankings.matches} accent="matches" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ChartCard points={groupStats.chart} />
            </div>
            <SummaryCard period={groupStats.totals_period} allTime={groupStats.totals_all_time} label={periodLabel} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <div className="rounded-3xl border border-slate-800/60 bg-slate-950/40 p-5">
                <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.6rem] uppercase tracking-[0.4em] text-slate-500">Elenco consolidado</p>
                    <h3 className="text-lg font-semibold text-white">Tabela de atletas</h3>
                    <p className="text-xs text-slate-400">Clique para abrir o painel detalhado.</p>
                  </div>
                  <span className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs text-emerald-200">{groupStats.players.length} atletas</span>
                </header>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-slate-300">
                    <thead>
                      <tr className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        <th className="px-4 py-2">Jogador</th>
                        <th className="px-4 py-2">Gols ({periodLabel})</th>
                        <th className="px-4 py-2">Assist</th>
                        <th className="px-4 py-2">Jogos</th>
                        <th className="px-4 py-2">Gols (total)</th>
                        <th className="px-4 py-2">Assist (total)</th>
                        <th className="px-4 py-2">Jogos (total)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupStats.players.map((player: PlayerStatSnapshot) => {
                        const isHighlighted = highlightedPlayers.has(player.player_id);
                        return (
                          <tr
                            key={player.player_id}
                            className={`cursor-pointer border-t border-slate-800/60 text-xs transition hover:bg-emerald-500/5 ${
                              isHighlighted ? "bg-emerald-500/5" : ""
                            }`}
                            onClick={() => setPlayerFocusId(player.player_id)}
                          >
                            <td className="px-4 py-3">
                              <p className="font-semibold text-white">{player.nome}</p>
                              <p className="text-[0.65rem] text-slate-500">#{player.numero_camisa ?? "--"} · {player.posicao ?? ""}</p>
                            </td>
                            <td className="px-4 py-3 font-semibold text-white">{player.period.goals}</td>
                            <td className="px-4 py-3">{player.period.assists}</td>
                            <td className="px-4 py-3">{player.period.matches}</td>
                            <td className="px-4 py-3 font-semibold text-white">{player.all_time.goals}</td>
                            <td className="px-4 py-3">{player.all_time.assists}</td>
                            <td className="px-4 py-3">{player.all_time.matches}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <PlayerDetail loading={playerLoading} error={playerError} data={playerStats} onClose={() => setPlayerFocusId(null)} />
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">Nenhum dado encontrado para o grupo selecionado.</p>
      )}
    </section>
  );
}
