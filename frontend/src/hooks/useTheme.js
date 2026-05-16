import { createContext, useContext, useState, useEffect, createElement } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("finbridge-theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("finbridge-theme", dark ? "dark" : "light");
  }, [dark]);

  const toggle = () => setDark(d => !d);

  return createElement(ThemeContext.Provider, { value: { dark, toggle } }, children);
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      dark: typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
      toggle: () => {},
    };
  }
  return ctx;
}
