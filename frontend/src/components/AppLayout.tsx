import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { marketLabel, marketPath, rememberMarket } from "../lib/market";
import ThemeToggle from "./ThemeToggle";
export default function AppLayout() {
  const { user, logout } = useAuth();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false);
  const location = useLocation(),
    menu = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const market = location.pathname.startsWith("/crypto") ? "crypto" : "stock";
  useEffect(() => { if (/^\/(stocks|crypto)(\/|$)/.test(location.pathname)) rememberMarket(market); }, [market, location.pathname]);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    function close(e: PointerEvent) {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to={marketPath(market)} className="brand">
          Plutus<span>AI</span>
          <i />
        </Link>
        <nav className="main-nav" aria-label="Market">
          {(["stock", "crypto"] as const).map((lane) => (
            <Link key={lane} to={marketPath(lane)} className={market === lane ? "active" : ""} aria-current={market === lane ? "page" : undefined}>
              {marketLabel(lane)}
            </Link>
          ))}
        </nav>
        <div
          className="header-actions user-menu"
          ref={menu}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              trigger.current?.focus();
            }
          }}
        >
          <button
            ref={trigger}
            className="user-avatar"
            aria-label="Account menu"
            aria-expanded={open}
            aria-controls="account-menu"
            onClick={() => setOpen(!open)}
          >
            {(user?.name || user?.email || "P").slice(0, 1).toUpperCase()}
          </button>
          {open && (
            <div id="account-menu" className="account-menu">
              <strong>{user?.name || "Your account"}</strong>
              <p>{user?.email}</p>
              <div className="menu-theme">
                <span>Appearance</span>
                <ThemeToggle />
              </div>
              <button
                className="signout"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await logout();
                  } catch {
                    setError("Sign out failed. Please retry.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Signing out…" : "Sign out"}
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="app-main">
        {error && <p role="alert">{error}</p>}
        <Outlet />
      </main>
      <footer className="app-footer">
        <span>PlutusAI · {market === "stock" ? "NSE / Indian stocks" : "Cryptocurrencies"} · INR</span>
        <span>Market analysis & predictions — coming soon</span>
      </footer>
    </div>
  );
}
