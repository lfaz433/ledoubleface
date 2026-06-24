import { useState, useEffect } from "react";

type Theme = "light" | "dark";

let currentTheme: Theme = "dark";
const listeners = new Set<(theme: Theme) => void>();

if (typeof window !== "undefined") {
  currentTheme = (localStorage.getItem("ldf-theme") as Theme) || "dark";
  if (currentTheme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function notifyListeners() {
  listeners.forEach((listener) => listener(currentTheme));
}

function setTheme(theme: Theme) {
  currentTheme = theme;
  localStorage.setItem("ldf-theme", theme);
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  notifyListeners();
}

function toggleTheme() {
  setTheme(currentTheme === "dark" ? "light" : "dark");
}

export function useTheme() {
  const [theme, setLocalTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    const listener = (newTheme: Theme) => setLocalTheme(newTheme);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return { theme, setTheme, toggleTheme };
}
