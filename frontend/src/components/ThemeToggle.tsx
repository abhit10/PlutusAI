import { useSyncExternalStore } from "react";

function savedTheme() {
  try { return localStorage.getItem("plutus-theme"); } catch { return null; }
}
function applyTheme(theme: string) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event("plutus-theme-change"));
}
export function initializeTheme() {
  const saved = savedTheme();
  applyTheme(saved === "light" || saved === "dark" ? saved :
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
function subscribe(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const systemChanged = () => { if (!['light', 'dark'].includes(savedTheme() ?? '')) initializeTheme(); };
  const storageChanged = (event: StorageEvent) => {
    if (event.key === "plutus-theme" || event.key === null) initializeTheme();
  };
  window.addEventListener("plutus-theme-change", callback);
  window.addEventListener("storage", storageChanged);
  media.addEventListener("change", systemChanged);
  return () => {
    window.removeEventListener("plutus-theme-change", callback);
    window.removeEventListener("storage", storageChanged);
    media.removeEventListener("change", systemChanged);
  };
}
export default function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark", () => false);
  function toggle() {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("plutus-theme", theme); } catch { /* Works without storage. */ }
    applyTheme(theme);
  }
  return <button type="button" className="theme-toggle" onClick={toggle} aria-pressed={dark} aria-label={`Switch to ${dark ? "light" : "dark"} mode`} title={`${dark ? "Dark" : "Light"} mode · switch theme`}>
    <svg className={`theme-icon ${dark ? 'is-dark' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <g className="theme-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></g>
      <path className="theme-moon" d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/>
    </svg>
  </button>;
}
