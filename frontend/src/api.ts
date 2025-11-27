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

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
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
};
