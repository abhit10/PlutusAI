import { useState } from "react"

export function initializeTheme() {
  let theme = "light"
  try { theme = localStorage.getItem("plutus-theme") === "dark" ? "dark" : "light" } catch { /* Storage may be blocked. */ }
  document.documentElement.dataset.theme = theme
}
export default function ThemeToggle() {
  const [dark, setDark] = useState(document.documentElement.dataset.theme === "dark")
  function toggle() {
    const theme = dark ? "light" : "dark"
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem("plutus-theme", theme) } catch { /* Still works without storage. */ }
    setDark(!dark)
  }
  return <button className="theme-toggle" onClick={toggle} aria-label={`Switch to ${dark ? "light" : "dark"} mode`} title={`Switch to ${dark ? "light" : "dark"} mode`}>
    {dark ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/></svg>}
  </button>
}
