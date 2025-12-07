import { API_BASE_URL, ApiError, fetchWithAuth } from "./api";

export type PlayerPosition = "GK" | "DEF" | "MID" | "ATT";

export type PlayerDto = {
  id: string;
  group_id: string;
  nome: string;
  posicao: PlayerPosition;
  numero_camisa?: number | null;
  created_at: string;
};

export type PlayersListResponse = {
  players: PlayerDto[];
};

export type PlayerPayload = {
  nome: string;
  posicao: PlayerPosition;
  numero_camisa?: number | null;
  group_id: string;
};

export type PlayerUpdatePayload = Partial<Omit<PlayerPayload, "group_id">> & { group_id?: string };

const DEFAULT_TIMEOUT = 15000;

async function request<T>(path: string, method: string, token: string | undefined, body?: unknown): Promise<T> {
  const init: RequestInit = { method, body: body ? JSON.stringify(body) : undefined };
  return fetchWithAuth<T>(path, init, token, DEFAULT_TIMEOUT);
}

export const playersApi = {
  list(token: string, groupId: string) {
    const params = new URLSearchParams({ group_id: groupId });
    return request<PlayersListResponse>(`/players?${params.toString()}`, "GET", token);
  },
  create(token: string, payload: PlayerPayload) {
    return request<PlayerDto>("/players", "POST", token, payload);
  },
  update(token: string, id: string, payload: PlayerUpdatePayload) {
    return request<PlayerDto>(`/players/${id}`, "PUT", token, payload);
  },
  remove(token: string, id: string) {
    return request<{ message: string }>(`/players/${id}`, "DELETE", token);
  },
};
