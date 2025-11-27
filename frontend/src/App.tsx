import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then((res) => res.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch(() => setError("Nao foi possivel conectar ao backend."));
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <section className="max-w-xl rounded-2xl border border-slate-700 bg-slate-800/60 p-8 text-center shadow-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Order Fut</p>
        <h1 className="mt-4 text-3xl font-semibold">Stack inicial pronta</h1>
        <p className="mt-2 text-slate-300">
          Frontend em React + Vite + Tailwind integrado a um backend FastAPI e PostgreSQL locais.
        </p>
        <div className="mt-6">
          {health && <span className="rounded-full bg-emerald-500/20 px-4 py-1 text-emerald-300">Backend online ({health.status})</span>}
          {error && <span className="rounded-full bg-rose-500/20 px-4 py-1 text-rose-300">{error}</span>}
          {!health && !error && <span className="rounded-full bg-slate-700 px-4 py-1 text-slate-300">Verificando backend...</span>}
        </div>
      </section>
    </main>
  );
}

export default App;
