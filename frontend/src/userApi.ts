import { API_BASE_URL, ApiError, fetchWithAuth } from "./api";
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

async function authorizedRequest<T>(token: string | undefined, path: string, init?: RequestInit): Promise<T> {
  return fetchWithAuth<T>(path, { method: init?.method ?? "GET", ...(init ?? {}) }, token, 15000);
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
