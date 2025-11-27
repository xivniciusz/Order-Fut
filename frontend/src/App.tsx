import { useEffect, useMemo, useState } from "react";

import { authApi, AuthResponse } from "./api";

type AuthView = "login" | "register" | "forgot" | "reset";

type AlertState = {
  type: "success" | "error";
  text: string;
} | null;

type InputProps = {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
};

const InputField = ({ label, type = "text", value, onChange, placeholder, autoComplete }: InputProps) => (
  <label className="flex flex-col gap-1 text-sm text-slate-200">
    <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</span>
    <input
      className="rounded-xl border border-slate-700/70 bg-slate-900/80 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-500 focus:bg-slate-900"
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required
    />
  </label>
);

function App() {
  const search = useMemo(() => {
    if (typeof window === "undefined") {
      return new URLSearchParams();
    }
    return new URLSearchParams(window.location.search);
  }, []);
  const initialResetToken = search.get("token") || search.get("reset_token") || "";

  const [view, setView] = useState<AuthView>(initialResetToken ? "reset" : "login");
  const [alert, setAlert] = useState<AlertState>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authResult, setAuthResult] = useState<AuthResponse | null>(null);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    nome: "",
    email: "",
    password: "",
    confirm_password: "",
  });
  const [forgotForm, setForgotForm] = useState({ email: "" });
  const [resetForm, setResetForm] = useState({
    token: initialResetToken,
    password: "",
    confirm_password: "",
  });

  useEffect(() => {
    if (initialResetToken) {
      setAlert({ type: "success", text: "Token detectado automaticamente. Redefina sua senha abaixo." });
    }
  }, [initialResetToken]);

  const handleError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
    setAlert({ type: "error", text: message });
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setAlert(null);
    try {
      const data = await authApi.login(loginForm);
      setAuthResult(data);
      setAlert({ type: "success", text: "Login realizado com sucesso." });
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setAlert(null);
    try {
      const data = await authApi.register(registerForm);
      setAuthResult(data);
      setAlert({ type: "success", text: "Cadastro concluido! Usuario autenticado." });
      setView("login");
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setAlert(null);
    try {
      const response = await authApi.forgotPassword(forgotForm);
      setAlert({ type: "success", text: response.message });
      setView("login");
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setAlert(null);
    try {
      const response = await authApi.resetPassword(resetForm);
      setAlert({ type: "success", text: response.message });
      setView("login");
      setResetForm({ token: "", password: "", confirm_password: "" });
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const secondaryAction = (nextView: AuthView, text: string) => (
    <button
      type="button"
      onClick={() => {
        setView(nextView);
        setAlert(null);
      }}
      className="font-semibold text-emerald-400 transition hover:text-emerald-300"
    >
      {text}
    </button>
  );

  const renderForm = () => {
    switch (view) {
      case "login":
        return (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <InputField
              label="Email"
              type="email"
              value={loginForm.email}
              onChange={(value) => setLoginForm((prev) => ({ ...prev, email: value }))}
              autoComplete="email"
            />
            <InputField
              label="Senha"
              type="password"
              value={loginForm.password}
              onChange={(value) => setLoginForm((prev) => ({ ...prev, password: value }))}
              autoComplete="current-password"
            />
            <button className="rounded-xl bg-emerald-500 py-3 text-lg font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isLoading}>
              {isLoading ? "Entrando..." : "Entrar"}
            </button>
            <div className="flex flex-col gap-2 text-sm text-slate-300">
              <span>
                Nao possui conta? {secondaryAction("register", "Crie agora")}
              </span>
              <span>
                Esqueceu a senha? {secondaryAction("forgot", "Recuperar acesso")}
              </span>
            </div>
          </form>
        );
      case "register":
        return (
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <InputField
              label="Nome completo"
              value={registerForm.nome}
              onChange={(value) => setRegisterForm((prev) => ({ ...prev, nome: value }))}
              autoComplete="name"
            />
            <InputField
              label="Email"
              type="email"
              value={registerForm.email}
              onChange={(value) => setRegisterForm((prev) => ({ ...prev, email: value }))}
              autoComplete="email"
            />
            <InputField
              label="Senha"
              type="password"
              value={registerForm.password}
              onChange={(value) => setRegisterForm((prev) => ({ ...prev, password: value }))}
              autoComplete="new-password"
            />
            <InputField
              label="Confirmar senha"
              type="password"
              value={registerForm.confirm_password}
              onChange={(value) => setRegisterForm((prev) => ({ ...prev, confirm_password: value }))}
              autoComplete="new-password"
            />
            <button className="rounded-xl bg-emerald-500 py-3 text-lg font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isLoading}>
              {isLoading ? "Criando conta..." : "Criar conta"}
            </button>
            <p className="text-center text-sm text-slate-300">
              Ja possui login? {secondaryAction("login", "Entrar")}
            </p>
          </form>
        );
      case "forgot":
        return (
          <form onSubmit={handleForgot} className="flex flex-col gap-4">
            <p className="text-sm text-slate-300">
              Informe o email cadastrado e enviaremos o link de redefinicao. Confira caixa de entrada e spam.
            </p>
            <InputField
              label="Email"
              type="email"
              value={forgotForm.email}
              onChange={(value) => setForgotForm({ email: value })}
              autoComplete="email"
            />
            <button className="rounded-xl bg-emerald-500 py-3 text-lg font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isLoading}>
              {isLoading ? "Enviando..." : "Enviar instrucoes"}
            </button>
            <div className="flex flex-col gap-2 text-center text-sm text-slate-300">
              {secondaryAction("login", "Voltar para login")}
              <span>
                Ja possui token? {secondaryAction("reset", "Redefinir manualmente")}
              </span>
            </div>
          </form>
        );
      case "reset":
        return (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <InputField
              label="Token de redefinicao"
              value={resetForm.token}
              onChange={(value) => setResetForm((prev) => ({ ...prev, token: value }))}
              placeholder="Cole o token recebido por email"
            />
            <InputField
              label="Nova senha"
              type="password"
              value={resetForm.password}
              onChange={(value) => setResetForm((prev) => ({ ...prev, password: value }))}
            />
            <InputField
              label="Confirmar nova senha"
              type="password"
              value={resetForm.confirm_password}
              onChange={(value) => setResetForm((prev) => ({ ...prev, confirm_password: value }))}
            />
            <button className="rounded-xl bg-emerald-500 py-3 text-lg font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isLoading}>
              {isLoading ? "Atualizando..." : "Redefinir senha"}
            </button>
            <p className="text-center text-sm text-slate-300">
              Precisa solicitar outro link? {secondaryAction("forgot", "Enviar novamente")}
            </p>
          </form>
        );
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 px-4 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 lg:flex-row">
        <section className="flex-1 rounded-3xl border border-slate-800 bg-slate-900/60 p-10 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Order Fut</p>
          <h1 className="mt-6 text-4xl font-semibold leading-tight text-white">Gerencie seu clube com autenticacao segura.</h1>
          <p className="mt-4 text-lg text-slate-300">
            Interfaces responsivas, textos em portugues-br e integracao direta com o backend FastAPI ja em producao.
            Utilize as telas ao lado para testar todo o fluxo de login, cadastro, recuperacao e redefinicao de senha.
          </p>
          {authResult && (
            <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-sm text-emerald-100">
              <p className="text-base font-semibold text-emerald-300">Sessao ativa</p>
              <p className="mt-2 text-slate-200">
                Usuario: <span className="font-medium">{authResult.user.nome}</span> ({authResult.user.email})
              </p>
              <p className="mt-1 text-slate-300">Access token expira em {authResult.expires_in / 60} minutos.</p>
              <p className="mt-4 text-xs text-slate-400">
                Tokens exibidos apenas para fins de teste. Em producao, armazene-os com seguranca e utilize HTTPS.
              </p>
            </div>
          )}
        </section>

        <section className="w-full max-w-md self-center rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
          <header className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Autenticacao</p>
              <h2 className="text-2xl font-semibold text-white">
                {view === "login" && "Entrar"}
                {view === "register" && "Criar conta"}
                {view === "forgot" && "Recuperar acesso"}
                {view === "reset" && "Redefinir senha"}
              </h2>
            </div>
            <div className="text-right text-xs text-slate-500">
              API alvo
              <p className="font-mono text-[11px] text-emerald-400">{import.meta.env.VITE_API_BASE_URL ?? "localhost"}</p>
            </div>
          </header>

          {alert && (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                alert.type === "error"
                  ? "border-rose-500/60 bg-rose-500/10 text-rose-200"
                  : "border-emerald-500/50 bg-emerald-500/10 text-emerald-100"
              }`}
            >
              {alert.text}
            </div>
          )}

          {renderForm()}
        </section>
      </div>
    </main>
  );
}

export default App;
