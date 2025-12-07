import { API_BASE_URL, ApiError, fetchWithAuth } from "./api";

export type ActiveGroupSummary = {
  id: string;
  nome: string;
  descricao?: string | null;
  foundation_year: number;
  current_year: number;
  created_at: string;
  total_players: number;
  total_matches: number;
  next_match?: string | null;
  is_active: boolean;
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

async function getJson<T>(path: string, token: string | undefined): Promise<T> {
  return fetchWithAuth<T>(path, { method: "GET" }, token, DEFAULT_TIMEOUT);
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
