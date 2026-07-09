// 테마 프로바이더 — dark/light를 documentElement 클래스와 CSS 변수로 전환
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

/** documentElement에 dark/light만 교체한다 (폰트 변수 클래스는 유지). */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

/** localStorage 또는 현재 DOM에서 테마를 읽는다. */
function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // ignore
  }
  if (typeof document !== "undefined") {
    if (document.documentElement.classList.contains("light")) return "light";
  }
  return "dark";
}

/** 앱 전역 테마 (기본 dark). */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = readTheme();
    setThemeState(initial);
    applyTheme(initial);
    setReady(true);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // private mode 등 — 무시
    }
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      applyTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  // ready 전에는 깜빡임 최소화를 위해 children은 그대로 렌더
  return (
    <ThemeContext.Provider value={value}>
      <div data-theme-ready={ready ? "true" : "false"} className="contents">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

/** 현재 테마와 setter. Provider 밖에서는 no-op. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "dark",
      setTheme: () => {
        /* no-op */
      },
      toggleTheme: () => {
        /* no-op */
      },
    };
  }
  return ctx;
}
