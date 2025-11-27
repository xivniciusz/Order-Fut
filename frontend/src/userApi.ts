import { API_BASE_URL, ApiError } from "./api";
import type { ThemePreference } from "./ThemeContext";

export type UserPreferences = {
  theme: ThemePreference;
  notifications_email: boolean;
  notifications_push: boolean;
  auto_rotate_goalkeepers: boolean;
};

export type UserProfile = {
  id: string;
  nome: string;
  email: string;
  created_at: string;
  preferences: UserPreferences;
};

type UserProfileResponse = Omit<UserProfile, "preferences"> & {
  preferences: Partial<UserPreferences> | null;
};

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  notifications_email: true,
  notifications_push: false,
  auto_rotate_goalkeepers: true,
};

const sanitizeTheme = (value?: string | null): ThemePreference => {
  if (value === "light" || value === "dark") {
    return value;
  }
  return "system";
};

const mergePreferences = (raw?: Partial<UserPreferences> | null): UserPreferences => ({
  ...DEFAULT_PREFERENCES,
  ...(raw ?? {}),
  theme: sanitizeTheme(raw?.theme),
});

async function authorizedRequest<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
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

export const userApi = {
  async getProfile(token: string): Promise<UserProfile> {
    const response = await authorizedRequest<UserProfileResponse>(token, "/users/me");
    return { ...response, preferences: mergePreferences(response.preferences) };
  },
  async updatePreferences(token: string, payload: Partial<UserPreferences>): Promise<UserPreferences> {
    const response = await authorizedRequest<UserPreferences>(token, "/users/me/preferences", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return mergePreferences(response);
  },
};
