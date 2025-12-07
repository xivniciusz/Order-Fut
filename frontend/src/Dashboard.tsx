import { useMemo, useState } from "react";
import type { AuthResponse } from "./api";
import { ActiveGroupProvider, useActiveGroup } from "./ActiveGroupContext";
import type { ActiveGroupSummary, RecentMatchSummary, TopScorer } from "./dashboardApi";
import Groups from "./Groups";
import MatchLive from "./MatchLive";
import MatchSetup from "./MatchSetup";
import Players from "./Players";
import Settings from "./Settings";
import { useThemePreference } from "./ThemeContext";
import Stats from "./Stats";
import { userApi } from "./userApi";

export type DashboardProps = {
  auth: AuthResponse;
  onLogout: () => void;
};

const statusColorMap: Record<string, string> = {
  scheduled: "bg-amber-500/10 text-amber-500",
  finished: "bg-emerald-500/10 text-emerald-400",
  canceled: "bg-rose-500/10 text-rose-400",
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "Sem agendamento";
  }
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "Data invalida";
  }
};

const Skeleton = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-500/10 ${className}`} />
);

function GroupsPanel() {
  const { groups, selectedGroupId, selectGroup, isLoading, refresh } = useActiveGroup();
  const hasGroups = groups.length > 0;

  return (
    <section className="rounded-3xl border border-slate-200/10 bg-white/5 p-6 shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900/40">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Grupos ativos</p>
          <h2 className="text-xl font-semibold">Selecione um elenco</h2>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-full border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-500 transition hover:border-emerald-400"
        >
          Sincronizar
        </button>
      </header>

      {isLoading && !hasGroups ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : hasGroups ? (
        <ul className="flex flex-col gap-3">
          {groups.map((group: ActiveGroupSummary) => {
            const isSelected = group.id === selectedGroupId;
            return (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() => selectGroup(group.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    isSelected
                      ? "border-emerald-500/60 bg-emerald-500/5 shadow-lg shadow-emerald-900/30"
                      : "border-slate-200/20 bg-white/5 hover:border-slate-200/40 dark:border-slate-800/80 dark:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-slate-600">{group.nome}</p>
                      {group.descricao && <p className="mt-1 text-sm text-slate-700 dark:text-slate-700">{group.descricao}</p>}
                    </div>
                    <span className="text-xs font-semibold text-emerald-400">{isSelected ? "Em uso" : "Selecionar"}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-700 dark:text-slate-700">
                    <div className="rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5">
                      <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-600">Jogadores</p>
                      <p className="text-lg font-semibold text-slate-800 dark:text-white">{group.total_players}</p>
                    </div>
                    <div className="rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5">
                      <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-600">Data</p>
                      <p className="text-lg font-semibold text-slate-800 dark:text-white">{new Date(group.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300/60 px-6 py-10 text-center text-sm text-slate-600 dark:border-slate-700">
          Nenhum grupo encontrado. Cadastre atletas no backend para destravar os paines.
        </div>
      )}
    </section>
  );
}

const StatCard = ({ label, value, helper }: { label: string; value: string; helper: string }) => (
  <div className="rounded-3xl border border-slate-200/20 bg-white/5 p-5 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900/50">
    <p className="text-[0.65rem] uppercase tracking-[0.4em] text-slate-600">{label}</p>
    <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">{value}</p>
    <p className="mt-1 text-xs text-slate-700 dark:text-slate-700">{helper}</p>
  </div>
);

const MatchesList = ({ matches }: { matches: RecentMatchSummary[] }) => (
  <div className="rounded-3xl border border-slate-200/20 bg-white/5 p-5 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900/50">
    <header className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Agenda</p>
        <h3 className="text-lg font-semibold">Ultimos jogos</h3>
      </div>
    </header>
    {matches.length ? (
      <ul className="space-y-4">
        {matches.map((match) => (
          <li key={match.id} className="rounded-2xl border border-slate-200/20 bg-black/5 p-4 dark:border-slate-700/60 dark:bg-white/5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{match.titulo}</p>
                <p className="text-xs text-slate-700 dark:text-slate-700">{formatDateTime(match.starts_at)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColorMap[match.status] ?? "bg-slate-500/10 text-slate-600"}`}>
                {match.status === "scheduled"
                  ? "Agendado"
                  : match.status === "finished"
                  ? "Finalizado"
                  : match.status === "canceled"
                  ? "Cancelado"
                  : match.status}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center text-xs text-slate-600 dark:text-slate-700">
              <div className="rounded-2xl bg-white/60 p-3 dark:bg-white/5">
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-600">Pro</p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">{match.placar_pro ?? "-"}</p>
              </div>
              <div className="rounded-2xl bg-white/60 p-3 dark:bg-white/5">
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-600">Contra</p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">{match.placar_contra ?? "-"}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-slate-700 dark:text-slate-700">Nenhuma partida registrada para este grupo.</p>
    )}
  </div>
);

const TopScorersList = ({ scorers }: { scorers: TopScorer[] }) => (
  <div className="rounded-3xl border border-slate-200/20 bg-white/5 p-5 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900/50">
    <header className="mb-4">
      <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Destaques</p>
      <h3 className="text-lg font-semibold">Artilharia</h3>
    </header>
    {scorers.length ? (
      <ul className="space-y-3">
        {scorers.map((scorer) => (
          <li key={scorer.player_id} className="flex items-center justify-between rounded-2xl bg-black/5 px-4 py-3 text-sm dark:bg-white/5">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{scorer.player_nome}</p>
              <p className="text-xs text-slate-700 dark:text-slate-700">{scorer.goals} gol(s)</p>
            </div>
            <span className="text-lg font-bold text-emerald-400">{scorer.goals}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-slate-700 dark:text-slate-700">Ainda nao ha gols registrados.</p>
    )}
  </div>
);

function DashboardBody({ auth }: { auth: AuthResponse }) {
  const { stats, isLoading, error, groups, selectedGroupId } = useActiveGroup();

  const statCards = useMemo(
    () => [
      {
        label: "Atletas cadastrados",
        value: stats ? stats.totals.players.toString() : isLoading ? "--" : "0",
        helper: "Total de jogadores ativos no grupo.",
      },
      {
        label: "Partidas registradas",
        value: stats ? stats.totals.matches.toString() : isLoading ? "--" : "0",
        helper: "Historico completo de confrontos.",
      },
      {
        label: "Gols computados",
        value: stats ? stats.totals.goals.toString() : isLoading ? "--" : "0",
        helper: "Eventos somados nas fichas.",
      },
      {
        label: "Presencas",
        value: stats ? stats.totals.attendance_entries.toString() : isLoading ? "--" : "0",
        helper: "Check-ins confirmados em treinos/jogos.",
      },
    ],
    [stats, isLoading],
  );

  const currentGroupName = useMemo(() => {
    const group = groups.find((item) => item.id === selectedGroupId);
    return group?.nome ?? "Dashboard";
  }, [groups, selectedGroupId]);

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200/10 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-8 shadow-2xl shadow-emerald-900/20 dark:border-slate-800">
        <p className="text-xs uppercase tracking-[0.6em] text-emerald-300">{currentGroupName}</p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white">Painel operacional do gestor</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-700">
          Acompanhe produtividade, agendas e presencas em tempo real. Utilize os dados abaixo para direcionar comunicados e definir
          convocacoes equilibradas.
        </p>
      </div>

      {error && (
        <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {isLoading && !stats
          ? [0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-32" />)
          : statCards.map((card) => <StatCard key={card.label} label={card.label} value={card.value} helper={card.helper} />)}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoading && !stats ? <Skeleton className="h-96" /> : <MatchesList matches={stats?.recent_matches ?? []} />}
        </div>
        <div>
          {isLoading && !stats ? <Skeleton className="h-96" /> : <TopScorersList scorers={stats?.top_scorers ?? []} />}
        </div>
      </div>

      <footer className="rounded-3xl border border-slate-200/20 bg-white/5 px-6 py-4 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-700">
        Centralize convocacoes, escala e desempenho em um unico painel: cadastre grupos, organize elencos e acompanhe indicadores sem sair do app.
      </footer>
    </div>
  );
}

export default function Dashboard({ auth, onLogout }: DashboardProps) {
  const { resolvedTheme, setThemePreference } = useThemePreference();
  const [view, setView] = useState<"overview" | "groups" | "players" | "organize" | "stats" | "live" | "settings">("overview");
  const [playersGroupId, setPlayersGroupId] = useState<string | null>(null);
  const [themeSyncError, setThemeSyncError] = useState<string | null>(null);
  const themeClasses = resolvedTheme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";

  const navigateToPlayers = (groupId: string) => {
    setPlayersGroupId(groupId);
    setView("players");
  };

  const handlePlayersBack = () => {
    setView("groups");
  };

  const handleQuickThemeToggle = () => {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    setThemePreference(nextTheme);
    setThemeSyncError(null);
    void userApi.updatePreferences(auth.access_token, { theme: nextTheme }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Nao foi possivel sincronizar o tema.";
      setThemeSyncError(message);
    });
  };

  return (
    <ActiveGroupProvider token={auth.access_token}>
      <div className={resolvedTheme === "dark" ? "dark" : ""}>
        <div className={`${themeClasses} min-h-screen transition-colors`}>
          <header className="border-b border-slate-200/10 bg-white/5 px-6 py-4 text-sm shadow-lg shadow-slate-900/10 dark:border-slate-900 dark:bg-slate-950/60">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-emerald-400">Order Fut</p>
                <p className="text-base font-semibold">{auth.user.nome}</p>
                <p className="text-xs text-slate-700 dark:text-slate-600">{auth.user.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleQuickThemeToggle}
                  className="rounded-2xl border border-slate-200/50 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-emerald-400 hover:text-emerald-400 dark:border-slate-700 dark:text-slate-200"
                >
                  {resolvedTheme === "dark" ? "Tema claro" : "Tema escuro"}
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-2xl border border-rose-500/60 px-4 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/10"
                >
                  Encerrar sessao
                </button>
              </div>
            </div>
          </header>

          {themeSyncError && (
            <div className="mx-auto mt-4 w-full max-w-6xl rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
              {themeSyncError}
            </div>
          )}

          <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 lg:flex-row">
            <div className="w-full lg:w-80">
              <GroupsPanel />
            </div>
            <div className="flex-1">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("overview")}
                  className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${
                    view === "overview"
                      ? "bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/30"
                      : "border border-slate-700 text-slate-700"
                  }`}
                >
                  Visao geral
                </button>
                <button
                  type="button"
                  onClick={() => setView("groups")}
                  className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${
                    view === "groups"
                      ? "bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/30"
                      : "border border-slate-700 text-slate-700"
                  }`}
                >
                  Grupos
                </button>
                <button
                  type="button"
                  onClick={() => setView("players")}
                  className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${
                    view === "players"
                      ? "bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/30"
                      : "border border-slate-700 text-slate-700"
                  }`}
                >
                  Jogadores
                </button>
                <button
                  type="button"
                  onClick={() => setView("organize")}
                  className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${
                    view === "organize"
                      ? "bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/30"
                      : "border border-slate-700 text-slate-700"
                  }`}
                >
                  Organizacao
                </button>
                <button
                  type="button"
                  onClick={() => setView("stats")}
                  className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${
                    view === "stats"
                      ? "bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/30"
                      : "border border-slate-700 text-slate-700"
                  }`}
                >
                  Estatisticas
                </button>
                <button
                  type="button"
                  onClick={() => setView("live")}
                  className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${
                    view === "live"
                      ? "bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/30"
                      : "border border-slate-700 text-slate-700"
                  }`}
                >
                  Partida ao vivo
                </button>
                <button
                  type="button"
                  onClick={() => setView("settings")}
                  className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${
                    view === "settings"
                      ? "bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/30"
                      : "border border-slate-700 text-slate-700"
                  }`}
                >
                  Configuracoes
                </button>
              </div>
              {view === "overview" && <DashboardBody auth={auth} />}
              {view === "groups" && <Groups token={auth.access_token} onNavigateToPlayers={navigateToPlayers} />}
              {view === "players" && (
                <Players token={auth.access_token} initialGroupId={playersGroupId} onBack={handlePlayersBack} />
              )}
              {view === "organize" && <MatchSetup token={auth.access_token} />}
              {view === "stats" && <Stats token={auth.access_token} />}
              {view === "live" && <MatchLive token={auth.access_token} />}
              {view === "settings" && <Settings token={auth.access_token} authUser={auth.user} onLogout={onLogout} />}
            </div>
          </main>
        </div>
      </div>
    </ActiveGroupProvider>
  );
}
