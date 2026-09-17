export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

// Keep in sync with the pre-paint script in index.html.
export const THEME_STORAGE_KEY = "creatorhub-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const TRANSITION_CLASS = "theme-transition";
const TRANSITION_MS = 260;

const isPreference = (value: unknown): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";

export const readStoredPreference = (): ThemePreference => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
};

export const writeStoredPreference = (preference: ThemePreference): void => {
  try {
    if (preference === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the choice just won't persist.
  }
};

export const getSystemTheme = (): ResolvedTheme =>
  typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(DARK_QUERY).matches
    ? "dark"
    : "light";

export const resolveTheme = (preference: ThemePreference): ResolvedTheme =>
  preference === "system" ? getSystemTheme() : preference;

export const subscribeToSystemTheme = (
  onChange: (theme: ResolvedTheme) => void
): (() => void) => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }

  const query = window.matchMedia(DARK_QUERY);
  const handleChange = (event: MediaQueryListEvent) =>
    onChange(event.matches ? "dark" : "light");

  query.addEventListener("change", handleChange);
  return () => query.removeEventListener("change", handleChange);
};

let transitionTimer: number | undefined;

export const applyTheme = (theme: ResolvedTheme, { animate = false } = {}): void => {
  const root = document.documentElement;

  if (animate) {
    root.classList.add(TRANSITION_CLASS);
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(
      () => root.classList.remove(TRANSITION_CLASS),
      TRANSITION_MS
    );
  }

  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#111018" : "#F7F7FF");
};
