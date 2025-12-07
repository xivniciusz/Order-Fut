import { API_BASE_URL, ApiError } from "./api";

export type GroupDto = {
  id: string;
  nome: string;
  foundation_year: number;
  current_year: number;
  descricao?: string | null;
  is_active: boolean;
  created_at: string;
  players_count: number;
};

export type GroupsListResponse = {
  groups: GroupDto[];
};

export type GroupPayload = {
  nome: string;
  descricao?: string | null;
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

export const groupsApi = {
  list(token: string) {
    return request<GroupsListResponse>("/groups", "GET", token);
  },
  create(token: string, payload: GroupPayload) {
    return request<GroupDto>("/groups", "POST", token, payload);
  },
  update(token: string, id: string, payload: Partial<GroupPayload>) {
    return request<GroupDto>(`/groups/${id}`, "PUT", token, payload);
  },
  remove(token: string, id: string) {
    return request<{ message: string }>(`/groups/${id}`, "DELETE", token);
  },
  setActive(token: string, id: string) {
    return request<{ message: string }>(`/groups/${id}/set-active`, "POST", token);
  },
};
