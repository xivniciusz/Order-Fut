import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePreference = "light" | "dark" | "system";

export type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: "light" | "dark";
  setThemePreference: (value: ThemePreference) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "orderfut.theme";

const prefersDark = () => (typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false);

const applyResolvedTheme = (resolved: "light" | "dark") => {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.classList.toggle("dark", resolved === "dark");
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") {
      return "system";
    }
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    return stored || "system";
  });
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(prefersDark() ? "dark" : "light");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateResolved = () => {
      const nextResolved = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      setResolvedTheme(nextResolved);
      applyResolvedTheme(nextResolved);
    };
    updateResolved();
    media.addEventListener("change", updateResolved);
    return () => media.removeEventListener("change", updateResolved);
  }, [theme]);

  const setThemePreference = useCallback((value: ThemePreference) => {
    setTheme(value);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      if (prev === "dark") {
        return "light";
      }
      if (prev === "light") {
        return "dark";
      }
      return prefersDark() ? "light" : "dark";
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setThemePreference, toggleTheme }),
    [theme, resolvedTheme, setThemePreference, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemePreference must be used within ThemeProvider");
  }
  return context;
}
