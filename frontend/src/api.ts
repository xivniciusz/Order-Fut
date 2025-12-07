export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    nome: string;
    email: string;
    created_at: string;
  };
};

export type MessageResponse = {
  message: string;
};

type RefreshResult = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// Global in-flight refresh promise to dedupe concurrent refresh requests
let ongoingRefresh: Promise<RefreshResult> | null = null;

async function performRefresh(refreshToken: string): Promise<RefreshResult> {
  if (!refreshToken) throw new ApiError("Sessao expirada. Faça login novamente.");
  if (ongoingRefresh) return ongoingRefresh;

  ongoingRefresh = authApi
    .refresh({ refresh_token: refreshToken })
    .then((res) => {
      ongoingRefresh = null;
      return res;
    })
    .catch((err) => {
      ongoingRefresh = null;
      throw err;
    });

  return ongoingRefresh;
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};

    if (!response.ok) {
      const detail = typeof data?.detail === "string" ? data.detail : data?.message;
      throw new ApiError(detail || "Nao foi possivel completar a solicitacao.");
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

export const authApi = {
  login: (payload: { email: string; password: string }) => postJson<AuthResponse>("/auth/login", payload),
  register: (payload: {
    nome: string;
    email: string;
    password: string;
    confirm_password: string;
  }) => postJson<AuthResponse>("/auth/register", payload),
  forgotPassword: (payload: { email: string }) => postJson<MessageResponse>("/auth/forgot-password", payload),
  resetPassword: (payload: {
    token: string;
    password: string;
    confirm_password: string;
  }) => postJson<MessageResponse>("/auth/reset-password", payload),
  refresh: (payload: { refresh_token: string }) => postJson<{ access_token: string; refresh_token: string; expires_in: number }>("/auth/refresh", payload),
  logout: (payload: { refresh_token: string }) => postJson<MessageResponse>("/auth/logout", payload),
};


export async function fetchWithAuth<T>(path: string, init?: RequestInit, token?: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const getStoredAuth = (): AuthResponse | null => {
    try {
      const raw = localStorage.getItem("orderfut_auth");
      if (!raw) return null;
      return JSON.parse(raw) as AuthResponse;
    } catch (err) {
      return null;
    }
  };

  const doRequest = async (accessToken?: string) => {
    const headers = new Headers(init?.headers as HeadersInit);
    headers.set("Accept", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    if (!(init && init.headers && (init.headers as any)["Content-Type"])) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    return response;
  };

  try {
    const stored = getStoredAuth();
    const access = token ?? stored?.access_token;
    let response = await doRequest(access);

    if (response.status === 401) {
      // Try refresh (deduped globally)
      const stored2 = getStoredAuth();
      const refreshToken = stored2?.refresh_token;
      if (!refreshToken) {
        throw new ApiError("Sessao expirada. Faça login novamente.");
      }
      try {
        const refreshed = await performRefresh(refreshToken);
        const merged: AuthResponse = {
          ...(stored2 ?? ({} as AuthResponse)),
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_in: refreshed.expires_in,
        };
        try {
          localStorage.setItem("orderfut_auth", JSON.stringify(merged));
        } catch (err) {
          // ignore
        }
        // retry once with new access token
        response = await doRequest(refreshed.access_token);
      } catch (err) {
        throw new ApiError("Sessao expirada. Faça login novamente.");
      }
    }

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};
    if (!response.ok) {
      const detail = typeof data?.detail === "string" ? data.detail : data?.message;
      throw new ApiError(detail || "Erro na requisicao autenticada.");
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as DOMException).name === "AbortError") throw new ApiError("Tempo limite atingido. Tente novamente.");
    throw new ApiError("Falha de rede. Verifique sua conexao.");
  } finally {
    clearTimeout(timeout);
  }
}
