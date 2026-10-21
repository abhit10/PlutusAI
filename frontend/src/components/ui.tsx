import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type FormHTMLAttributes,
  type ComponentPropsWithRef,
  type ReactNode,
} from "react";

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "outline";
}) {
  return (
    <button
      type={type}
      className={`portfolio-button ${variant} ${className}`}
      {...props}
    />
  );
}
export function Input({
  className = "",
  ...props
}: ComponentPropsWithRef<"input">) {
  return <input className={`portfolio-input ${className}`} {...props} />;
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="portfolio-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Form({
  onKeyDown,
  ...props
}: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      {...props}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (
          !e.defaultPrevented &&
          e.key === "Enter" &&
          (e.ctrlKey || e.metaKey)
        ) {
          e.preventDefault();
          if (!e.currentTarget.querySelector('button[type="submit"]:disabled'))
            e.currentTarget.requestSubmit();
        }
      }}
    />
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`dash-card ${className}`}>{children}</section>;
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warn";
}) {
  return <span className={`portfolio-badge ${tone}`}>{children}</span>;
}
export function Banner({
  tone = "error",
  children,
}: {
  tone?: "error" | "info";
  children: ReactNode;
}) {
  return (
    <div
      className={`portfolio-banner ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      className="portfolio-dialog"
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="card-heading">
        <h2 id={id}>{title}</h2>
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={busy}
          aria-label="Close dialog"
        >
          ×
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function Skeleton({ shell = false }: { shell?: boolean }) {
  const content = (
    <div
      className="portfolio-skeleton"
      role="status"
      aria-label="Loading your portfolio"
    >
      <div className="skeleton-line" />
      <div className="dashboard-grid">
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </div>
      <span className="sr-only">Loading your portfolio</span>
    </div>
  );
  return shell ? (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand">
          Plutus<span>AI</span>
          <i />
        </span>
      </header>
      <main className="app-main">{content}</main>
    </div>
  ) : (
    content
  );
}
export function AssetIdentity({
  symbol,
  name,
  assetClass,
}: {
  symbol: string;
  name: string;
  assetClass: string;
}) {
  return (
    <span className="asset-cell">
      <span
        className={`asset-logo ${assetClass === "crypto" ? "crypto-logo" : ""}`}
        aria-hidden="true"
      >
        {symbol === "BTC" ? "₿" : symbol === "ETH" ? "Ξ" : symbol.slice(0, 1)}
      </span>
      <span>
        <strong>{symbol}</strong>
        <small>{name}</small>
      </span>
    </span>
  );
}
