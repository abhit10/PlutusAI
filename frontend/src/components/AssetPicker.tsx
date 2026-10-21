import { useEffect, useId, useRef, useState } from "react";
import { portfolioApi } from "../lib/portfolio";
import type { Asset, AssetClass } from "../lib/types";
import { formatQty } from "../lib/format";
import { Button, Input } from "./ui";

export default function AssetPicker({
  market,
  value,
  onChange,
  disabled = false,
  holdings = [],
  onEdit,
}: {
  market: AssetClass;
  value: Asset | null;
  onChange: (a: Asset | null) => void;
  disabled?: boolean;
  holdings?: { symbol: string }[];
  onEdit?: (symbol: string) => void;
}) {
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("plutus-recent-assets") || "[]",
      );
      return Array.isArray(value)
        ? value.filter((v) => typeof v === "string").slice(0, 5)
        : [];
    } catch {
      return [];
    }
  });
  const held = (symbol: string) => holdings.some((h) => h.symbol === symbol);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const typing = useRef(false);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    portfolioApi
      .listAssets(market)
      .then((r) => {
        if (alive) setAssets(r.results.filter((a) => a.active));
      })
      .catch(() => {
        if (alive) setError("Assets could not be loaded.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [retry, market]);
  useEffect(() => {
    if (!value && !typing.current) setQuery("");
    typing.current = false;
  }, [value]);
  const matches = assets.filter(
    (a) =>
      `${a.symbol} ${a.name}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const options = matches;
  function choose(a: Asset) {
    if (held(a.symbol)) return;
    const next = [
      a.symbol,
      ...recent.filter((symbol) => symbol !== a.symbol),
    ].slice(0, 5);
    setRecent(next);
    try {
      localStorage.setItem("plutus-recent-assets", JSON.stringify(next));
    } catch {
      /* optional preference */
    }
    onChange(a);
    setQuery(a.symbol);
    setOpen(false);
    input.current?.focus();
  }
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);
  return (
    <div
      className="asset-picker"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id} className="field-label">
        {market === "stock" ? "NSE / Indian stock" : "Cryptocurrency"}
      </label>
      <Input
        ref={input}
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={
          open && options[active] ? `${id}-option-${active}` : undefined
        }
        aria-describedby={`${id}-hint`}
        autoComplete="off"
        disabled={disabled}
        value={query}
        placeholder="Search by symbol or name"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          if (value) {
            typing.current = true;
            onChange(null);
          }
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((i) =>
              !open
                ? 0
                : options.length
                  ? (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) %
                    options.length
                  : 0,
            );
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
          if (e.key === "Enter" && open) {
            e.preventDefault();
            if (options[active]) choose(options[active]);
          }
        }}
      />
      <small id={`${id}-hint`} className="muted">
        {value
          ? `${value.asset_class === "stock" ? "Whole shares" : "Fractional units"} · quantity step ${formatQty(value.quantity_step)}`
          : "Search, then use ↑ ↓ and Enter to select. Esc closes the list."}
      </small>
      {open && (
        <div
          className="asset-options"
          id={`${id}-list`}
          role="listbox"
          aria-label="Supported assets"
        >
          {loading ? (
            <p role="status">Loading supported assets…</p>
          ) : error ? (
            <p>{error}</p>
          ) : options.length === 0 ? (
            <p>No matching supported assets.</p>
          ) : (
            [market].map((group) => (
              <div
                role="group"
                aria-label={group === "stock" ? "Stocks" : "Crypto"}
                key={group}
              >
                {options.some((a) => a.asset_class === group) && (
                  <div className="option-group">
                    {group === "stock" ? "Stocks" : "Crypto"}
                  </div>
                )}
                {options.map(
                  (a, i) =>
                    a.asset_class === group && (
                      <div
                        role="option"
                        aria-selected={active === i}
                        aria-disabled={held(a.symbol)}
                        id={`${id}-option-${i}`}
                        key={a.id}
                        className={`asset-option ${active === i ? "highlighted" : ""}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => choose(a)}
                      >
                        <span>
                          <strong>{a.symbol}</strong>
                          <small>{a.name}</small>
                        </span>
                        <small>
                          {held(a.symbol)
                            ? "Already in portfolio · Edit instead"
                            : `Step ${formatQty(a.quantity_step)}`}
                        </small>
                      </div>
                    ),
                )}
              </div>
            ))
          )}
        </div>
      )}
      {open &&
        onEdit &&
        matches
          .filter((a) => held(a.symbol))
          .map((a) => (
            <Button
              key={a.symbol}
              variant="outline"
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                onEdit(a.symbol);
              }}
            >
              Edit {a.symbol} instead
            </Button>
          ))}
      {!query && recent.length > 0 && (
        <div className="recent-assets">
          <small>Recent picks</small>
          {recent
            .map((symbol) => assets.find((a) => a.symbol === symbol))
            .filter(
              (a): a is Asset =>
                !!a &&
                !held(a.symbol) &&
                a.asset_class === market,
            )
            .map((a) => (
              <Button
                key={a.symbol}
                variant="outline"
                disabled={disabled}
                onClick={() => choose(a)}
              >
                {a.symbol}
              </Button>
            ))}
        </div>
      )}
      {error && (
        <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
          Retry asset list
        </Button>
      )}
    </div>
  );
}
