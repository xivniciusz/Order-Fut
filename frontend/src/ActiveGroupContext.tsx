import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActiveGroupSummary, StatsOverviewResponse, dashboardApi } from "./dashboardApi";

export type ActiveGroupContextValue = {
  isLoading: boolean;
  error: string | null;
  groups: ActiveGroupSummary[];
  selectedGroupId: string | null;
  stats: StatsOverviewResponse | null;
  selectGroup: (groupId: string | null) => void;
  refresh: () => Promise<void>;
};

const ActiveGroupContext = createContext<ActiveGroupContextValue | undefined>(undefined);

export type ActiveGroupProviderProps = PropsWithChildren<{ token: string | null }>;

export function ActiveGroupProvider({ token, children }: ActiveGroupProviderProps) {
  const [groups, setGroups] = useState<ActiveGroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  const resetState = useCallback(() => {
    setGroups([]);
    setSelectedGroupId(null);
    setStats(null);
    setError(null);
  }, []);

  const fetchGroups = useCallback(async () => {
    if (!token) {
      resetState();
      return;
    }

    setGroupsLoading(true);
    setError(null);
    try {
      const response = await dashboardApi.getActiveGroups(token);
      setGroups(response.groups);

      if (!response.groups.length) {
        setSelectedGroupId(null);
        setStats(null);
        return;
      }

      setSelectedGroupId((current) => {
        if (current && response.groups.some((group) => group.id === current)) {
          return current;
        }
        const activeGroup = response.groups.find((group) => group.is_active);
        return activeGroup?.id ?? response.groups[0].id;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel carregar os grupos.";
      setError(message);
      setGroups([]);
      setSelectedGroupId(null);
      setStats(null);
    } finally {
      setGroupsLoading(false);
    }
  }, [token, resetState]);

  const fetchStats = useCallback(
    async (groupId: string | null) => {
      if (!token || !groupId) {
        setStats(null);
        return;
      }

      setStatsLoading(true);
      setError(null);
      try {
        const overview = await dashboardApi.getStatsOverview(token, groupId);
        setStats(overview);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Nao foi possivel carregar o painel.";
        setError(message);
        setStats(null);
      } finally {
        setStatsLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token) {
      resetState();
      return;
    }
    fetchGroups();
  }, [token, fetchGroups, resetState]);

  useEffect(() => {
    if (!token) {
      setStats(null);
      return;
    }
    fetchStats(selectedGroupId);
  }, [token, selectedGroupId, fetchStats]);

  const selectGroup = useCallback((groupId: string | null) => {
    setSelectedGroupId(groupId);
  }, []);

  const refresh = useCallback(async () => {
    await fetchGroups();
  }, [fetchGroups]);

  const value = useMemo<ActiveGroupContextValue>(
    () => ({
      isLoading: groupsLoading || statsLoading,
      error,
      groups,
      selectedGroupId,
      stats,
      selectGroup,
      refresh,
    }),
    [groupsLoading, statsLoading, error, groups, selectedGroupId, stats, selectGroup, refresh],
  );

  return <ActiveGroupContext.Provider value={value}>{children}</ActiveGroupContext.Provider>;
}

export function useActiveGroup(): ActiveGroupContextValue {
  const context = useContext(ActiveGroupContext);
  if (!context) {
    throw new Error("useActiveGroup deve ser usado dentro de ActiveGroupProvider.");
  }
  return context;
}
