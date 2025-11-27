import { API_BASE_URL, ApiError } from "./api";

export type StatLine = {
  goals: number;
  assists: number;
  cards: number;
  matches: number;
};

export type RankingEntry = {
  player_id: string;
  player_nome: string;
  value: number;
};

export type RankingBlock = {
  goals: RankingEntry[];
  assists: RankingEntry[];
  matches: RankingEntry[];
};

export type ChartPoint = {
  label: string;
  goals: number;
  matches: number;
};

export type PlayerStatSnapshot = {
  player_id: string;
  nome: string;
  numero_camisa?: number | null;
  posicao?: string | null;
  period: StatLine;
  all_time: StatLine;
};

export type GroupStatsResponse = {
  group: {
    id: string;
    nome: string;
  };
  filter_year?: number | null;
  available_years: number[];
  totals_period: StatLine;
  totals_all_time: StatLine;
  rankings: RankingBlock;
  chart: ChartPoint[];
  players: PlayerStatSnapshot[];
  generated_at: string;
};

export type PlayerHeadline = {
  id: string;
  nome: string;
  numero_camisa?: number | null;
  posicao?: string | null;
};

export type PlayerYearBreakdown = {
  year: number;
  totals: StatLine;
};

export type PlayerMatchSnapshot = {
  match_id: string;
  titulo: string;
  starts_at: string;
  goals: number;
  assists: number;
  cards: number;
};

export type PlayerStatsResponse = {
  player: PlayerHeadline;
  group: {
    id: string;
    nome: string;
  };
  totals: StatLine;
  per_year: PlayerYearBreakdown[];
  recent_matches: PlayerMatchSnapshot[];
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
      throw new ApiError(detail || "Nao foi possivel carregar as estatisticas.");
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

export const statsApi = {
  async getGroupStats(token: string, groupId: string, year?: number | null): Promise<GroupStatsResponse> {
    const query = typeof year === "number" && !Number.isNaN(year) ? `?year=${year}` : "";
    return getJson<GroupStatsResponse>(`/stats/group/${groupId}${query}`, token);
  },
  async getPlayerStats(token: string, playerId: string): Promise<PlayerStatsResponse> {
    return getJson<PlayerStatsResponse>(`/stats/player/${playerId}`, token);
  },
};
