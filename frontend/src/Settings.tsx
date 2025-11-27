import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthResponse } from "./api";
import { useThemePreference } from "./ThemeContext";
import { userApi, type UserPreferences, type UserProfile } from "./userApi";

export type SettingsProps = {
  token: string;
  authUser: AuthResponse["user"];
  onLogout: () => void;
};

const Skeleton = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-3xl bg-slate-800/20 ${className}`} />
);

const formatDateTime = (value?: string) => {
  if (!value) {
    return "--";
  }
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const defaultPreferences: UserPreferences = {
  theme: "system",
  notifications_email: true,
  notifications_push: false,
  auto_rotate_goalkeepers: true,
};

export default function Settings({ token, authUser, onLogout }: SettingsProps) {
  const { setThemePreference, resolvedTheme } = useThemePreference();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadProfile = useCallback(() => {
    setLoading(true);
    setError(null);
    userApi
      .getProfile(token)
      .then((data) => {
        setProfile(data);
        setPreferences(data.preferences);
        setThemePreference(data.preferences.theme);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Nao foi possivel carregar as preferencias.";
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setThemePreference, token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!success) {
      return;
    }
    const timeout = setTimeout(() => setSuccess(null), 2500);
    return () => clearTimeout(timeout);
  }, [success]);

  const handlePreferenceUpdate = (payload: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...payload }));
    setSaving(true);
    setError(null);
    setSuccess(null);
    userApi
      .updatePreferences(token, payload)
      .then((updated) => {
        setPreferences(updated);
        setProfile((prev) => (prev ? { ...prev, preferences: updated } : prev));
        setThemePreference(updated.theme);
        setSuccess("Preferencias salvas com sucesso!");
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Nao foi possivel salvar as preferencias.";
        setError(message);
      })
      .finally(() => setSaving(false));
  };

  const themeOptions = useMemo(
    () => [
      { value: "light", label: "Claro", helper: "Foco em fundos claros" },
      { value: "dark", label: "Escuro", helper: "Menor brilho e cores frias" },
      { value: "system", label: "Automatico", helper: "Segue configuracao do dispositivo" },
    ],
    [],
  );

  const contact = useMemo(() => {
    const source = profile ?? authUser;
    if (!source) {
      return null;
    }
    return {
      email: source.email,
      createdAt: formatDateTime(source.created_at),
      id: source.id,
    };
  }, [authUser, profile]);

  if (loading && !profile) {
    return (
      <section className="space-y-6">
        <Skeleton className="h-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-slate-200/10 bg-gradient-to-br from-emerald-500/10 via-slate-900/70 to-slate-950/80 p-6 text-white shadow-lg shadow-emerald-900/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.6em] text-emerald-200">Preferencias da conta</p>
            <h2 className="mt-2 text-3xl font-semibold">Configurar experiencia</h2>
            <p className="text-sm text-emerald-50/80">Gerencie tema, alertas e regras automaticas conectadas ao seu usuario.</p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-semibold">
            <button
              type="button"
              onClick={loadProfile}
              className="rounded-2xl border border-emerald-400/60 px-4 py-2 text-emerald-100 transition hover:bg-emerald-400/10"
              disabled={loading}
            >
              Sincronizar perfil
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-2xl border border-rose-500/60 px-4 py-2 text-rose-100 transition hover:bg-rose-500/10"
            >
              Encerrar sessao
            </button>
          </div>
        </div>
        {contact && (
          <dl className="mt-6 grid gap-4 text-sm text-emerald-50/80 sm:grid-cols-3">
            <div>
              <dt className="text-[0.6rem] uppercase tracking-[0.4em] text-emerald-200">Email</dt>
              <dd className="mt-1 text-base font-semibold text-white">{contact.email}</dd>
            </div>
            <div>
              <dt className="text-[0.6rem] uppercase tracking-[0.4em] text-emerald-200">Cadastro</dt>
              <dd className="mt-1 text-base font-semibold text-white">{contact.createdAt}</dd>
            </div>
            <div>
              <dt className="text-[0.6rem] uppercase tracking-[0.4em] text-emerald-200">ID</dt>
              <dd className="mt-1 font-mono text-sm">{contact.id}</dd>
            </div>
          </dl>
        )}
      </header>

      {error && <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-3 text-sm text-rose-200">{error}</div>}
      {success && (
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm text-emerald-100">{success}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200/10 bg-white/5 p-6 text-slate-900 shadow-xl dark:border-slate-800 dark:bg-slate-900/60 dark:text-white">
          <header className="mb-4">
            <p className="text-[0.6rem] uppercase tracking-[0.4em] text-emerald-400">Interface</p>
            <h3 className="text-xl font-semibold">Aparencia e tema</h3>
            <p className="text-sm text-slate-500 dark:text-slate-300">Defina o modo principal exibido em todos os dispositivos sincronizados.</p>
          </header>
          <div className="grid gap-3">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handlePreferenceUpdate({ theme: option.value as UserPreferences["theme"] })}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                  preferences.theme === option.value
                    ? "border-emerald-400 bg-emerald-400/10 text-emerald-900 dark:text-emerald-100"
                    : "border-slate-200/30 bg-white/40 text-slate-600 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900"
                }`}
                disabled={saving}
              >
                <div>
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{option.helper}</p>
                </div>
                {preferences.theme === option.value && <span className="text-xs font-semibold uppercase">Ativo</span>}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Tema atual resolvido: <span className="font-semibold text-slate-900 dark:text-white">{resolvedTheme === "dark" ? "Escuro" : "Claro"}</span>
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200/10 bg-white/5 p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900/60">
          <header className="mb-4 text-slate-900 dark:text-white">
            <p className="text-[0.6rem] uppercase tracking-[0.4em] text-emerald-400">Alertas</p>
            <h3 className="text-xl font-semibold">Notificacoes</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">Customize canais de comunicacao utilizados pelo Order Fut.</p>
          </header>
          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200/40 bg-white/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              <input
                type="checkbox"
                checked={preferences.notifications_email}
                onChange={(event) => handlePreferenceUpdate({ notifications_email: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                disabled={saving}
              />
              <div>
                <p className="font-semibold">Email operacional</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Resumo de grupos, confirmacoes e alertas pontuais.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200/40 bg-white/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              <input
                type="checkbox"
                checked={preferences.notifications_push}
                onChange={(event) => handlePreferenceUpdate({ notifications_push: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                disabled={saving}
              />
              <div>
                <p className="font-semibold">Push no navegador</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Ideais para avisos imediatos em matchdays.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200/40 bg-white/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              <input
                type="checkbox"
                checked={preferences.auto_rotate_goalkeepers}
                onChange={(event) => handlePreferenceUpdate({ auto_rotate_goalkeepers: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                disabled={saving}
              />
              <div>
                <p className="font-semibold">Rodizio automatico de goleiros</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Mantem alternancia sugerida nas fichas de jogo geradas.</p>
              </div>
            </label>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200/10 bg-white/5 p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900/60">
        <header className="mb-4 text-slate-900 dark:text-white">
          <p className="text-[0.6rem] uppercase tracking-[0.4em] text-rose-400">Seguranca</p>
          <h3 className="text-xl font-semibold">Sessao e autenticacao</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Encerre o acesso atual ou desconecte dispositivos que nao utilizam mais o painel.
          </p>
        </header>
        <div className="flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            onClick={onLogout}
            className="rounded-2xl border border-rose-500/60 px-4 py-2 font-semibold text-rose-500 transition hover:bg-rose-500/10"
          >
            Desconectar agora
          </button>
          <button
            type="button"
            onClick={() => handlePreferenceUpdate(defaultPreferences)}
            className="rounded-2xl border border-slate-500/40 px-4 py-2 font-semibold text-slate-600 transition hover:bg-slate-500/10 dark:text-slate-200"
            disabled={saving}
          >
            Restaurar padroes
          </button>
        </div>
      </section>
    </section>
  );
}
