import { API_BASE_URL, ApiError } from "./api";

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
