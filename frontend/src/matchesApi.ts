import { API_BASE_URL, ApiError } from "./api";

export type MatchResponse = {
  id: string;
  group_id: string;
  titulo: string;
  starts_at: string;
  local?: string | null;
  team_size: number;
  goalkeepers_fixed: boolean;
  created_at: string;
};

export type MatchCreatePayload = {
  group_id: string;
  titulo: string;
  starts_at: string;
  local?: string | null;
  team_size: number;
  goalkeepers_fixed: boolean;
};

export type MatchPlayersSyncPayload = {
  players: Array<{
    player_id: string;
    is_present: boolean;
    is_goalkeeper: boolean;
    order_position: number;
  }>;
};

export type GeneratedTeamPlayer = {
  match_player_id: string;
  player_id: string;
  nome: string;
  is_goalkeeper: boolean;
  order_position: number;
};

export type GeneratedTeam = {
  team_number: number;
  players: GeneratedTeamPlayer[];
};

export type GenerateTeamsResponse = {
  teams: GeneratedTeam[];
  bench: GeneratedTeamPlayer[];
};

const DEFAULT_TIMEOUT = 15000;

async function request<T>(path: string, method: string, token: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};

    if (!response.ok) {
      const detail = typeof data?.detail === "string" ? data.detail : data?.message;
      throw new ApiError(detail || "Nao foi possivel concluir a operacao.");
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

export const matchesApi = {
  create(token: string, payload: MatchCreatePayload) {
    return request<MatchResponse>("/matches", "POST", token, payload);
  },
  syncPlayers(token: string, matchId: string, payload: MatchPlayersSyncPayload) {
    return request<{ message: string }>(`/matches/${matchId}/players`, "POST", token, payload);
  },
  generateTeams(token: string, matchId: string, payload: { team_size: number; goalkeepers_fixed: boolean }) {
    return request<GenerateTeamsResponse>(`/matches/${matchId}/generate-teams`, "POST", token, payload);
  },
};
