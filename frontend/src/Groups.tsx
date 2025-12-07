import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveGroup } from "./ActiveGroupContext";
import { GroupDto, GroupPayload, groupsApi } from "./groupsApi";

type FormState = {
  nome: string;
  descricao: string;
};

const initialForm: FormState = {
  nome: "",
  descricao: "",
};

type ModalState =
  | { type: "create" }
  | { type: "edit"; group: GroupDto }
  | { type: "delete"; group: GroupDto }
  | null;

type GroupsProps = {
  token: string;
  onNavigateToPlayers: (groupId: string) => void;
};

const inputBase =
  "w-full rounded-2xl border border-slate-800/40 bg-slate-900/40 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-400 focus:bg-slate-900";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950/90 p-6 text-slate-100 shadow-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:text-emerald-400">
            Fechar
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export default function Groups({ token, onNavigateToPlayers }: GroupsProps) {
  const { refresh, selectGroup } = useActiveGroup();
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [formValues, setFormValues] = useState<FormState>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!token) {
      setGroups([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await groupsApi.list(token);
      setGroups(response.groups);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel carregar os grupos.";
      setError(message);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const closeModal = () => {
    setModal(null);
    setFormValues(initialForm);
    setFormError(null);
  };

  const openCreateModal = () => {
    setFormValues(initialForm);
    setModal({ type: "create" });
  };

  const openEditModal = (group: GroupDto) => {
    setFormValues({
      nome: group.nome,
      descricao: group.descricao ?? "",
    });
    setModal({ type: "edit", group });
  };

  const openDeleteModal = (group: GroupDto) => {
    setModal({ type: "delete", group });
  };

  const validateForm = (values: GroupPayload): string | null => {
    if (!values.nome.trim()) {
      return "Informe o nome do grupo.";
    }
    if (values.nome.trim().length < 3) {
      return "O nome precisa ter pelo menos 3 caracteres.";
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!modal || modal.type === "delete") {
      return;
    }
    const normalized: GroupPayload = {
      nome: formValues.nome.trim(),
      descricao: formValues.descricao.trim() ? formValues.descricao.trim() : undefined,
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
        await groupsApi.create(token, normalized);
      } else if (modal.type === "edit" && modal.group) {
        await groupsApi.update(token, modal.group.id, normalized);
      }
      await loadGroups();
      await refresh();
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel salvar o grupo.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!modal || modal.type !== "delete" || !modal.group) {
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      await groupsApi.remove(token, modal.group.id);
      await loadGroups();
      await refresh();
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel excluir o grupo.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetActive = async (group: GroupDto) => {
    if (group.is_active) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await groupsApi.setActive(token, group.id);
      selectGroup(group.id);
      await loadGroups();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel definir como ativo.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderModal = () => {
    if (!modal) {
      return null;
    }

    if (modal.type === "delete" && modal.group) {
      return (
        <Modal title="Excluir grupo" onClose={closeModal}>
          <p className="text-sm text-slate-700">
            Tem certeza que deseja excluir o grupo <span className="font-semibold text-white">{modal.group.nome}</span>? Esta acao nao pode ser desfeita.
          </p>
          {formError && <p className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{formError}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-700">
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
        </Modal>
      );
    }

    const isEdit = modal.type === "edit" && modal.group;
    return (
      <Modal title={isEdit ? "Editar grupo" : "Criar grupo"} onClose={closeModal}>
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">Nome</span>
            <input
              className={inputBase}
              value={formValues.nome}
              onChange={(event) => setFormValues((prev) => ({ ...prev, nome: event.target.value }))}
              placeholder="Ex.: Categoria Sub-20"
              maxLength={160}
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">Descricao</span>
            <textarea
              className={`${inputBase} min-h-[120px] resize-none`}
              value={formValues.descricao ?? ""}
              onChange={(event) => setFormValues((prev) => ({ ...prev, descricao: event.target.value }))}
              placeholder="Observacoes adicionais"
              maxLength={500}
            />
          </label>
          {formError && <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{formError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-700">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Salvando..." : isEdit ? "Atualizar" : "Criar"}
            </button>
          </div>
        </form>
      </Modal>
    );
  };

  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.nome.localeCompare(b.nome)), [groups]);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Gestao</p>
          <h2 className="text-2xl font-semibold text-white">Grupos cadastrados</h2>
          <p className="text-sm text-slate-600">Mantenha cada elenco organizado e defina quem esta ativo no dashboard.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-2xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
        >
          Criar grupo
        </button>
      </header>

      {error && <p className="rounded-3xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-3xl border border-slate-800/60 bg-slate-900/40" />
          ))}
        </div>
      ) : sortedGroups.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {sortedGroups.map((group) => (
            <li key={group.id} className={`rounded-3xl border p-5 ${group.is_active ? "border-emerald-400/60 bg-emerald-500/5" : "border-slate-800/60 bg-slate-900/40"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-600">{group.nome}</p>
                  <p className="mt-1 text-xs text-slate-700">Criado em {new Date(group.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${group.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-700"}`}>
                  {group.is_active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
                <div className="rounded-2xl bg-black/20 p-3">
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-600">Ano atual</p>
                  <p className="text-lg font-semibold text-white">{group.current_year}</p>
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-600">Fundação</p>
                  <p className="text-lg font-semibold text-white">{group.foundation_year}</p>
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-600">Jogadores</p>
                  <p className="text-lg font-semibold text-white">{group.players_count}</p>
                </div>
              </div>
              {group.descricao && <p className="mt-3 text-sm text-slate-700">{group.descricao}</p>}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleSetActive(group)}
                  className="rounded-2xl border border-emerald-400/60 px-4 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-60"
                  disabled={group.is_active || isSubmitting}
                >
                  Definir como ativo
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(group)}
                  className="rounded-2xl border border-slate-700 px-4 py-2 text-xs text-slate-700"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteModal(group)}
                  className="rounded-2xl border border-rose-500/50 px-4 py-2 text-xs text-rose-300"
                >
                  Excluir
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToPlayers(group.id)}
                  className="rounded-2xl border border-slate-600 px-4 py-2 text-xs text-slate-200"
                >
                  Jogadores
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-700 px-6 py-10 text-center text-sm text-slate-600">
          Nenhum grupo cadastrado ainda. Utilize o botao acima para criar o primeiro elenco.
        </div>
      )}

      {renderModal()}
    </section>
  );
}
