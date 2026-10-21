import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { marketPath, savedMarket, rememberMarket, marketLabel } from "../lib/market";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { Banner, Button, Card, Field, Form, Input } from "../components/ui";
import ThemeToggle from "../components/ThemeToggle";
export default function AuthPage() {
  const { login, signup } = useAuth(),
    navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const market = params.get("market") === "crypto" ? "crypto" : params.get("market") === "stock" ? "stock" : savedMarket();
  const mode = params.get("mode") === "signup" ? "signup" : "login";
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState("");
  const [error, setError] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    document.title = `${mode === "login" ? "Sign in" : "Create account"} · PlutusAI`;
  }, [mode]);
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setFields({});
    try {
      if (mode === "login") await login(email, password);
      else await signup(email, password, name);
      rememberMarket(market);
      navigate(marketPath(market), { replace: true });
    } catch (err) {
      const data =
        err instanceof ApiError && err.data && typeof err.data === "object"
          ? (err.data as Record<string, unknown>)
          : {};
      const next: Record<string, string> = {};
      for (const key of ["email", "password", "name"])
        if (data[key])
          next[key] = Array.isArray(data[key])
            ? data[key].join(" ")
            : String(data[key]);
      setFields(next);
      if (!Object.keys(next).length)
        setError(
          err instanceof Error
            ? err.message
            : "Could not sign in. Please retry.",
        );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand" aria-label="PlutusAI home">
          Plutus<span>AI</span>
          <i />
        </Link>
        <ThemeToggle />
      </header>
      <main className="app-main auth-main">
        <div className="auth-intro">
          <p className="eyebrow">{market === "stock" ? "NSE / INDIAN STOCKS" : "CRYPTOCURRENCIES"} · INR</p>
          <h1>
            Your markets.
            <br /> <span className="headline-accent">In perspective.</span>
          </h1>
          <p>
            Create separate stocks or crypto portfolios. {marketLabel(market)} market
            analysis and price predictions are coming soon.
          </p>
        </div>
        <Card className="auth-card">
          <h2>{mode === "login" ? "Sign in" : "Create your account"}</h2>
          <p className="muted">
            {mode === "login"
              ? `Sign in to analyze your ${market === "stock" ? "stocks" : "crypto"} portfolio.`
              : `Create your ${market === "stock" ? "stock" : "crypto"} portfolio.`}
          </p>
          <Form className="portfolio-form" onSubmit={onSubmit}>
            {mode === "signup" && (
              <Field label="Name">
                <Input
                  value={name}
                  autoComplete="name"
                  disabled={busy}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!fields.name}
                  aria-describedby={fields.name ? "name-error" : undefined}
                />
                {fields.name && (
                  <small id="name-error" className="field-error">
                    {fields.name}
                  </small>
                )}
              </Field>
            )}
            <Field label="Email">
              <Input
                type="email"
                required
                value={email}
                autoComplete="email"
                disabled={busy}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!fields.email}
                aria-describedby={fields.email ? "email-error" : undefined}
              />
              {fields.email && (
                <small id="email-error" className="field-error">
                  {fields.email}
                </small>
              )}
            </Field>
            <div>
              <Field
                label="Password"
                hint={mode === "signup" ? "At least 8 characters." : undefined}
              >
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                  value={password}
                  disabled={busy}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  aria-invalid={!!fields.password}
                  aria-describedby={
                    fields.password
                      ? "password-error"
                      : error
                        ? "auth-error"
                        : undefined
                  }
                />
                {fields.password && (
                  <small id="password-error" className="field-error">
                    {fields.password}
                  </small>
                )}
              </Field>
              <Button
                variant="ghost"
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide password" : "Show password"}
              </Button>
            </div>
            {error && (
              <div id="auth-error">
                <Banner>{error}</Banner>
              </div>
            )}
            <Button type="submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </Button>
          </Form>
          <p className="auth-switch">
            {mode === "login" ? "New to PlutusAI?" : "Already have an account?"}{" "}
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setParams(mode === "login" ? { mode: "signup", market } : { market }, { replace: true });
                setError("");
                setFields({});
                setPassword("");
                setShowPassword(false);
              }}
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </Button>
          </p>
        </Card>
      </main>
    </div>
  );
}
