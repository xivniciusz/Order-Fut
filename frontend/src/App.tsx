import { useEffect, useMemo, useState } from "react";

import { authApi, AuthResponse } from "./api";
import Dashboard from "./Dashboard";

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
  canReveal?: boolean;
  helper?: string;
};

const EyeIcon = ({ isVisible }: { isVisible: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
    {isVisible ? (
      <>
        <path d="M2 12c1.5-3 5.5-6 10-6s8.5 3 10 6c-1.5 3-5.5 6-10 6s-8.5-3-10-6z" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ) : (
      <>
        <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.5 5.5A10.5 10.5 0 0121 12c-1.3 3.2-5 6.5-9 6.5a10.2 10.2 0 01-3.5-.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.5 18.5A10.5 10.5 0 013 12c.7-1.7 2.1-3.5 4.1-4.9" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )}
  </svg>
);

const InputField = ({ label, type = "text", value, onChange, placeholder, autoComplete, canReveal, helper }: InputProps) => {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const effectiveType = isPassword && canReveal ? (revealed ? "text" : "password") : type;

  return (
    <label className="flex flex-col gap-2 text-sm text-slate-200">
      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{label}</span>
      <div className="relative">
        <input
          className={`w-full rounded-xl border border-slate-700/70 bg-slate-900/80 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-500 focus:bg-slate-900 ${
            isPassword && canReveal ? "pr-12" : ""
          }`}
          type={effectiveType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
        />
        {isPassword && canReveal && (
          <button
            type="button"
            aria-label={revealed ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setRevealed((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-emerald-300"
          >
            <EyeIcon isVisible={revealed} />
          </button>
        )}
      </div>
      {helper && <span className="text-xs text-slate-400">{helper}</span>}
    </label>
  );
};

const MIN_PASSWORD = 8;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

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
      setAlert({ type: "success", text: "Token localizado. Redefina sua senha abaixo." });
    }
  }, [initialResetToken]);

  const handleError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
    setAlert({ type: "error", text: message });
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      setAlert({ type: "error", text: "Informe email e senha para continuar." });
      return;
    }
    if (loginForm.password.length < MIN_PASSWORD) {
      setAlert({ type: "error", text: `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.` });
      return;
    }
    setIsLoading(true);
    setAlert(null);
    try {
      const data = await authApi.login({
        email: normalizeEmail(loginForm.email),
        password: loginForm.password,
      });
      setAuthResult(data);
      setAlert({ type: "success", text: "Bem-vindo! Autenticacao concluida." });
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!registerForm.nome.trim()) {
      setAlert({ type: "error", text: "Informe seu nome completo." });
      return;
    }
    if (registerForm.password.length < MIN_PASSWORD) {
      setAlert({ type: "error", text: `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.` });
      return;
    }
    if (registerForm.password !== registerForm.confirm_password) {
      setAlert({ type: "error", text: "As senhas precisam ser iguais." });
      return;
    }
    setIsLoading(true);
    setAlert(null);
    try {
      const data = await authApi.register({
        nome: registerForm.nome.trim(),
        email: normalizeEmail(registerForm.email),
        password: registerForm.password,
        confirm_password: registerForm.confirm_password,
      });
      setAuthResult(data);
      setAlert({ type: "success", text: "Conta criada! Agora e so entrar com seus dados." });
      setLoginForm({ email: normalizeEmail(registerForm.email), password: registerForm.password });
      setView("login");
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!forgotForm.email) {
      setAlert({ type: "error", text: "Informe o email cadastrado para receber as instrucoes." });
      return;
    }
    setIsLoading(true);
    setAlert(null);
    try {
      const response = await authApi.forgotPassword({ email: normalizeEmail(forgotForm.email) });
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
    if (!resetForm.token.trim()) {
      setAlert({ type: "error", text: "Informe o token recebido por email." });
      return;
    }
    if (resetForm.password.length < MIN_PASSWORD) {
      setAlert({ type: "error", text: `A nova senha precisa de pelo menos ${MIN_PASSWORD} caracteres.` });
      return;
    }
    if (resetForm.password !== resetForm.confirm_password) {
      setAlert({ type: "error", text: "As senhas precisam ser iguais." });
      return;
    }
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

  const handleLogout = () => {
    setAuthResult(null);
    setView("login");
    setAlert(null);
  };

  if (authResult) {
    return <Dashboard auth={authResult} onLogout={handleLogout} />;
  }

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
              canReveal
              helper={`Utilize pelo menos ${MIN_PASSWORD} caracteres.`}
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
              canReveal
              helper={`Use combinacao com letras e numeros (minimo de ${MIN_PASSWORD} caracteres).`}
            />
            <InputField
              label="Confirmar senha"
              type="password"
              value={registerForm.confirm_password}
              onChange={(value) => setRegisterForm((prev) => ({ ...prev, confirm_password: value }))}
              autoComplete="new-password"
              canReveal
            />
            <button className="rounded-xl bg-emerald-500 py-3 text-lg font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isLoading}>
              {isLoading ? "Criando conta..." : "Criar conta"}
            </button>
            <p className="text-center text-sm text-slate-300">
              Ja possui acesso? {secondaryAction("login", "Entrar")}
            </p>
          </form>
        );
      case "forgot":
        return (
          <form onSubmit={handleForgot} className="flex flex-col gap-4">
            <p className="text-sm text-slate-300">
              Informe o email cadastrado e enviaremos o link de redefinicao. Caso nao encontre, verifique a pasta de spam.
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
                Ja possui token? {secondaryAction("reset", "Redefinir agora")}
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
              canReveal
            />
            <InputField
              label="Confirmar nova senha"
              type="password"
              value={resetForm.confirm_password}
              onChange={(value) => setResetForm((prev) => ({ ...prev, confirm_password: value }))}
              canReveal
            />
            <button className="rounded-xl bg-emerald-500 py-3 text-lg font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isLoading}>
              {isLoading ? "Atualizando..." : "Redefinir senha"}
            </button>
            <p className="text-center text-sm text-slate-300">
              Precisa solicitar outro link? {secondaryAction("forgot", "Receber novo email")}
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
          <h1 className="mt-6 text-4xl font-semibold leading-tight text-white">Painel de comando para o gestor do clube.</h1>
          <p className="mt-4 text-lg text-slate-300">
            Centralize escalações, estatísticas individuais e presença nos treinos em um único ambiente seguro. Crie a conta
            do seu grupo para desbloquear dashboards de performance, registro financeiro e comunicação direta com a equipe.
            Utilize o formulário ao lado para liberar o acesso dos administradores e manter todo o clube sincronizado.
          </p>
        </section>

        <section className="w-full max-w-md self-center rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
          <header className="mb-6">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Area do usuario</p>
            <h2 className="text-2xl font-semibold text-white">
              {view === "login" && "Entrar"}
              {view === "register" && "Criar conta"}
              {view === "forgot" && "Recuperar acesso"}
              {view === "reset" && "Redefinir senha"}
            </h2>
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
