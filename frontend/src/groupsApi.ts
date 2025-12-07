import { API_BASE_URL, ApiError, fetchWithAuth } from "./api";

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

async function request<T>(path: string, method: string, token: string | undefined, body?: unknown): Promise<T> {
  const init: RequestInit = { method, body: body ? JSON.stringify(body) : undefined };
  return fetchWithAuth<T>(path, init, token, DEFAULT_TIMEOUT);
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
