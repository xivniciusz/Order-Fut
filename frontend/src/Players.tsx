import { useEffect, useMemo, useState } from "react";
import { useActiveGroup } from "./ActiveGroupContext";
import { PlayerDto, PlayerPosition, PlayerPayload, playersApi } from "./playersApi";

const POSITION_LABELS: Record<PlayerPosition, string> = {
  GK: "Goleiro",
  DEF: "Defesa",
  MID: "Meio",
  ATT: "Ataque",
};

const POSITION_OPTIONS: { value: PlayerPosition; label: string }[] = ("GK DEF MID ATT".split(" ") as PlayerPosition[]).map((position) => ({
  value: position,
  label: POSITION_LABELS[position],
}));

const POSITION_FILTERS: { value: PlayerPosition | "ALL"; label: string }[] = [{ value: "ALL", label: "Todos" }, ...POSITION_OPTIONS];

const positionLabel = (value: PlayerPosition) => POSITION_LABELS[value] ?? value;

const inputBase =
  "w-full rounded-2xl border border-slate-800/40 bg-slate-900/40 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-400 focus:bg-slate-900";

type PlayersProps = {
  token: string;
  initialGroupId: string | null;
  onBack: () => void;
};

type ModalState =
  | { type: "create" }
  | { type: "edit"; player: PlayerDto }
  | { type: "delete"; player: PlayerDto }
  | null;

const defaultForm = (groupId: string | null): PlayerPayload => ({
  group_id: groupId ?? "",
  nome: "",
  posicao: "DEF",
  numero_camisa: undefined,
});

const avatarForName = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) {
    return parts[0][0]?.toUpperCase() ?? "?";
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
};

export default function Players({ token, initialGroupId, onBack }: PlayersProps) {
  const { groups, selectGroup, selectedGroupId } = useActiveGroup();
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(initialGroupId);
  const [players, setPlayers] = useState<PlayerDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [formValues, setFormValues] = useState<PlayerPayload>(defaultForm(initialGroupId));
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<PlayerPosition | "ALL">("ALL");

  useEffect(() => {
    if (initialGroupId) {
      setCurrentGroupId(initialGroupId);
      selectGroup(initialGroupId);
    }
  }, [initialGroupId, selectGroup]);

  useEffect(() => {
    if (selectedGroupId && !currentGroupId) {
      setCurrentGroupId(selectedGroupId);
    }
  }, [selectedGroupId, currentGroupId]);

  const loadPlayers = async (groupId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await playersApi.list(token, groupId);
      setPlayers(response.players);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao carregar jogadores.";
      setError(message);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentGroupId) {
      setPlayers([]);
      return;
    }
    loadPlayers(currentGroupId);
  }, [currentGroupId]);

  const handleGroupChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value || null;
    setCurrentGroupId(value);
    if (value) {
      selectGroup(value);
    }
  };

  const closeModal = () => {
    setModal(null);
    setFormValues(defaultForm(currentGroupId));
    setFormError(null);
  };

  const openCreateModal = () => {
    if (!currentGroupId) {
      setError("Selecione um grupo antes de adicionar jogadores.");
      return;
    }
    setFormValues(defaultForm(currentGroupId));
    setModal({ type: "create" });
  };

  const openEditModal = (player: PlayerDto) => {
    setFormValues({
      group_id: player.group_id,
      nome: player.nome,
      posicao: player.posicao,
      numero_camisa: player.numero_camisa ?? undefined,
    });
    setModal({ type: "edit", player });
  };

  const openDeleteModal = (player: PlayerDto) => {
    setModal({ type: "delete", player });
  };

  const validateForm = (values: PlayerPayload): string | null => {
    if (!values.group_id) {
      return "Selecione o grupo do jogador.";
    }
    if (!values.nome.trim()) {
      return "Informe o nome do jogador.";
    }
    if (values.nome.trim().length < 3) {
      return "Nome precisa ter pelo menos 3 caracteres.";
    }
    if (!POSITION_LABELS[values.posicao]) {
      return "Posicao invalida.";
    }
    if (values.numero_camisa !== undefined && values.numero_camisa !== null) {
      if (Number.isNaN(values.numero_camisa) || values.numero_camisa < 0 || values.numero_camisa > 99) {
        return "Numero deve estar entre 0 e 99.";
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!modal || modal.type === "delete") {
      return;
    }
    const normalized: PlayerPayload = {
      group_id: formValues.group_id,
      nome: formValues.nome.trim(),
      posicao: formValues.posicao,
      numero_camisa: formValues.numero_camisa ?? undefined,
    };
    const validation = validateForm(normalized);
    if (validation) {
      setFormError(validation);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      if (modal.type === "create") {
        await playersApi.create(token, normalized);
      } else if (modal.type === "edit" && modal.player) {
        await playersApi.update(token, modal.player.id, normalized);
      }
      if (currentGroupId) {
        await loadPlayers(currentGroupId);
      }
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel salvar o jogador.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!modal || modal.type !== "delete" || !modal.player) {
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      await playersApi.remove(token, modal.player.id);
      if (currentGroupId) {
        await loadPlayers(currentGroupId);
      }
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel excluir.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const matchesPosition = positionFilter === "ALL" || player.posicao === positionFilter;
      const matchesSearch = player.nome.toLowerCase().includes(search.toLowerCase());
      return matchesPosition && matchesSearch;
    });
  }, [players, positionFilter, search]);

  const currentGroupName = useMemo(() => groups.find((group) => group.id === currentGroupId)?.nome ?? "--", [groups, currentGroupId]);

  const renderModal = () => {
    if (!modal) {
      return null;
    }

    if (modal.type === "delete" && modal.player) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950/90 p-6 text-slate-100">
            <h3 className="text-xl font-semibold">Excluir jogador</h3>
            <p className="mt-3 text-sm text-slate-300">
              Tem certeza que deseja excluir <span className="font-semibold text-white">{modal.player.nome}</span>? Esta acao nao pode ser desfeita.
            </p>
            {formError && <p className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{formError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-300">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Removendo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
        <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950/90 p-6 text-slate-100">
          <h3 className="text-xl font-semibold">{modal.type === "edit" ? "Editar jogador" : "Adicionar jogador"}</h3>
          <form className="mt-4 space-y-4" onSubmit={(event) => event.preventDefault()}>
            <label className="flex flex-col gap-2 text-sm text-slate-200">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Nome completo</span>
              <input
                className={inputBase}
                value={formValues.nome}
                onChange={(event) => setFormValues((prev) => ({ ...prev, nome: event.target.value }))}
                placeholder="Ex.: Joao Silva"
                maxLength={160}
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-200">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Posicao</span>
              <select
                className={inputBase}
                value={formValues.posicao}
                onChange={(event) => setFormValues((prev) => ({ ...prev, posicao: event.target.value as PlayerPosition }))}
              >
                {POSITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-200">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Numero da camisa</span>
              <input
                className={inputBase}
                type="number"
                min={0}
                max={99}
                value={formValues.numero_camisa ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setFormValues((prev) => ({ ...prev, numero_camisa: value ? Number(value) : undefined }));
                }}
                placeholder="10"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-200">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Grupo</span>
              <select
                className={inputBase}
                value={formValues.group_id}
                onChange={(event) => setFormValues((prev) => ({ ...prev, group_id: event.target.value }))}
              >
                <option value="">Selecione</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.nome}
                  </option>
                ))}
              </select>
            </label>
            {formError && <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{formError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-300">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-60"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Salvando..." : modal.type === "edit" ? "Atualizar" : "Adicionar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button type="button" onClick={onBack} className="text-xs uppercase tracking-[0.4em] text-slate-400 hover:text-emerald-400">
            Voltar
          </button>
          <h2 className="mt-2 text-3xl font-semibold text-white">Jogadores do grupo</h2>
          <p className="text-sm text-slate-400">Gerencie cadastros, filtre por posicoes e mantenha o elenco atualizado.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-2xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
          disabled={!currentGroupId}
        >
          Adicionar jogador
        </button>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Grupo atual</label>
          <select className={`${inputBase} mt-2`} value={currentGroupId ?? ""} onChange={handleGroupChange}>
            <option value="">Selecione o grupo</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Buscar</label>
          <input
            className={`${inputBase} mt-2`}
            placeholder="Digite o nome do atleta"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Filtrar posicao</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {POSITION_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPositionFilter(option.value as PlayerPosition | "ALL")}
                className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                  positionFilter === option.value
                    ? "bg-emerald-500 text-emerald-950"
                    : "border border-slate-700 text-slate-300 hover:border-emerald-400"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!currentGroupId && (
        <div className="rounded-3xl border border-dashed border-slate-700 px-6 py-10 text-center text-sm text-slate-400">
          Escolha um grupo para visualizar os jogadores vinculados.
        </div>
      )}

      {currentGroupId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Grupo selecionado: <span className="font-semibold text-white">{currentGroupName}</span>
            </p>
            <span className="text-xs text-slate-500">{filteredPlayers.length} jogador(es)</span>
          </div>

          {error && <p className="rounded-3xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{error}</p>}

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-3xl border border-slate-800/60 bg-slate-900/40" />
              ))}
            </div>
          ) : filteredPlayers.length ? (
            <ul className="grid gap-4 lg:grid-cols-2">
              {filteredPlayers.map((player) => (
                <li key={player.id} className="rounded-3xl border border-slate-800 bg-slate-900/50 p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-lg font-semibold text-emerald-300">
                      {avatarForName(player.nome)}
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-semibold text-white">{player.nome}</p>
                      <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">{positionLabel(player.posicao).toUpperCase()}</p>
                      <p className="text-xs text-slate-400">Camisa {player.numero_camisa ?? "--"}</p>
                    </div>
                    <div className="flex flex-col gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => openEditModal(player)}
                        className="rounded-2xl border border-slate-700 px-3 py-1 text-slate-300"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteModal(player)}
                        className="rounded-2xl border border-rose-500/50 px-3 py-1 text-rose-300"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-700 px-6 py-10 text-center text-sm text-slate-400">
              Nenhum jogador encontrado para os filtros atuais.
            </div>
          )}
        </div>
      )}

      {renderModal()}
    </section>
  );
}
