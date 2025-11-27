import { API_BASE_URL, ApiError } from "./api";

export type ActiveGroupSummary = {
  id: string;
  nome: string;
  descricao?: string | null;
  created_at: string;
  total_players: number;
  total_matches: number;
  next_match?: string | null;
};

export type ActiveGroupsResponse = {
  groups: ActiveGroupSummary[];
};

export type StatsTotals = {
  players: number;
  matches: number;
  goals: number;
  cards: number;
  attendance_entries: number;
};

export type SelectedGroup = {
  id: string;
  nome: string;
};

export type RecentMatchSummary = {
  id: string;
  titulo: string;
  status: string;
  starts_at: string;
  placar_pro?: number | null;
  placar_contra?: number | null;
};

export type TopScorer = {
  player_id: string;
  player_nome: string;
  goals: number;
};

export type StatsOverviewResponse = {
  group: SelectedGroup;
  totals: StatsTotals;
  recent_matches: RecentMatchSummary[];
  top_scorers: TopScorer[];
};

const DEFAULT_TIMEOUT = 15000;

async function getJson<T>(path: string, token: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};

    if (!response.ok) {
      const detail = typeof data?.detail === "string" ? data.detail : data?.message;
      throw new ApiError(detail || "Nao foi possivel carregar os dados.");
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if ((error as DOMException).name === "AbortError") {
      throw new ApiError("Tempo limite atingido. Tente novamente.");
    }
    throw new ApiError("Falha de rede. Verifique sua conexao.");
  } finally {
    clearTimeout(timeout);
  }
}

export const dashboardApi = {
  async getActiveGroups(token: string): Promise<ActiveGroupsResponse> {
    return getJson<ActiveGroupsResponse>("/dashboard/groups/active", token);
  },
  async getStatsOverview(token: string, groupId?: string | null): Promise<StatsOverviewResponse> {
    const search = groupId ? `?group_id=${encodeURIComponent(groupId)}` : "";
    return getJson<StatsOverviewResponse>(`/dashboard/stats/overview${search}`, token);
  },
};
