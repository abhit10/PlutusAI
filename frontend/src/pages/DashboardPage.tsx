import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { marketPath, marketLabel } from "../lib/market";
import { portfolioApi } from "../lib/portfolio";
import { useAuth } from "../lib/auth";
import { useLedger } from "../lib/useLedger";
import type { Portfolio, AssetClass } from "../lib/types";
import { formatDateTime, formatInr, formatQty } from "../lib/format";
import {
  AssetIdentity,
  Banner,
  Button,
  Card,
  Skeleton,
  Modal,
} from "../components/ui";
import { Feedback, NameEditor } from "../components/LedgerPanels";
import AddHoldingForm from "../components/AddHoldingForm";
import DeletePortfolio from "../components/DeletePortfolio";
import HoldingsToolbar, {
  useHoldingFilters,
} from "../components/HoldingsToolbar";
import CreatePortfolio from "../components/CreatePortfolio";
import ChangeHistory from "../components/ChangeHistory";
const MarketOverview = lazy(() => import("../components/MarketOverview"));
export default function DashboardPage({ market }: { market: AssetClass }) {
  const navigate = useNavigate(),
    { user } = useAuth();
  const storageKey = `plutus-hidden-samples:${user?.id}:${market}`;
  const [hidden, setHidden] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  });
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const location = useLocation();
  const [notice, setNotice] = useState<string>(location.state?.notice || "");
  const [deleting, setDeleting] = useState<Portfolio | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    try {
      return (
        Number(localStorage.getItem(`plutus-selected:${user?.id}:${market}`)) || null
      );
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (location.state?.notice) navigate(marketPath(market), { replace: true, state: null });
  }, []);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [creating, setCreating] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    document.title = `${marketLabel(market)} · PlutusAI`;
    let alive = true;
    setLoading(true);
    setError("");
    portfolioApi
      .list(market)
      .then((r) => {
        if (alive) setPortfolios(r.results);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [retry, market]);
  const visible = portfolios.filter(
    (p) => p.kind !== "sample" || !hidden.includes(p.id),
  );
  const p = visible.find((p) => p.id === selectedId) ?? visible[0];
  useEffect(() => {
    if (!loading) {
      try {
        if (p)
          localStorage.setItem(`plutus-selected:${user?.id}:${market}`, String(p.id));
        else localStorage.removeItem(`plutus-selected:${user?.id}:${market}`);
      } catch {
        /* optional preference */
      }
    }
  }, [p?.id, loading, user?.id]);
  function hide(id: number) {
    const next = [...hidden, id];
    setHidden(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Browser-only preference. */
    }
  }
  if (loading) return <Skeleton />;
  if (error)
    return (
      <>
        <Banner>{error}</Banner>
        <Button onClick={() => setRetry((n) => n + 1)}>Retry overview</Button>
      </>
    );
  return (
    <div className="dashboard">
      <div className="dashboard-intro">
        <div>
          <p className="eyebrow">{market === "stock" ? "NSE / INDIAN STOCKS" : "CRYPTOCURRENCIES"} · INR</p>
          <h1>{marketLabel(market)} portfolios.</h1>
        </div>
        {p && (
          <Button onClick={() => setCreating(true)}>＋ New portfolio</Button>
        )}
      </div>
      {notice && (
        <div className="portfolio-toast" role="status">
          <span>{notice}</span>
          <Button
            variant="ghost"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </Button>
        </div>
      )}
      <Suspense fallback={<Skeleton />}><MarketOverview key={market} market={market} /></Suspense>
      {deleting && (
        <DeletePortfolio
          portfolio={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setPortfolios((items) =>
              items.filter((item) => item.id !== deleting.id),
            );
            setNotice(`${deleting.name} deleted`);
            setDeleting(null);
            if (selectedId === deleting.id) setSelectedId(null);
          }}
        />
      )}
      {p ? (
        <Overview
          key={p.id}
          initial={p}
          portfolios={visible}
          onSelect={setSelectedId}
          onDelete={setDeleting}
          onChange={(updated) =>
            setPortfolios((items) =>
              items.map((item) => (item.id === updated.id ? updated : item)),
            )
          }
          onCreate={() => setCreating(true)}
          onHide={hide}
        />
      ) : (
        <Card className="onboarding">
          <h2>Your markets. Your portfolio.</h2>
          <p className="muted">
            Create a portfolio to track your {market === "stock" ? "Indian stocks" : "cryptocurrencies"}. Analysis and
            forecasts are coming soon.
          </p>
          <ol className="setup-checklist">
            <li>
              <span>1</span>
              <div>
                <strong>Create a portfolio</strong>
                <p>Give your {market === "stock" ? "stock" : "crypto"} portfolio a name.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Add {market === "stock" ? "stocks" : "crypto"}</strong>
                <p>
                  Search assets and enter your holdings to get ready for
                  analysis.
                </p>
              </div>
            </li>
          </ol>
          <Button onClick={() => setCreating(true)}>
            Create your portfolio
          </Button>
        </Card>
      )}
      {hidden.length > 0 && (
        <Button
          variant="ghost"
          onClick={() => {
            setHidden([]);
            try {
              localStorage.removeItem(storageKey);
            } catch {
              /* Optional preference. */
            }
          }}
        >
          Show hidden sample portfolios
        </Button>
      )}
      {creating && (
        <CreatePortfolio
          initialMarket={market}
          onClose={() => setCreating(false)}
          onCreated={(p) => navigate(`${marketPath(p.asset_class)}/${p.id}`)}
        />
      )}
      <p className="dashboard-disclosure">
        {marketLabel(market)} · Analysis and predictions coming soon
      </p>
    </div>
  );
}
function Overview({
  initial,
  portfolios,
  onSelect,
  onChange,
  onCreate,
  onHide,
  onDelete,
}: {
  initial: Portfolio;
  portfolios: Portfolio[];
  onSelect: (id: number) => void;
  onChange: (p: Portfolio) => void;
  onCreate: () => void;
  onHide: (id: number) => void;
  onDelete: (p: Portfolio) => void;
}) {
  const ledger = useLedger(initial, onChange),
    p = ledger.portfolio;
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const filter = useHoldingFilters(p.holdings);
  return (
    <>
      {adding && (
        <Modal
          title={`Add holding to ${p.name}`}
          onClose={() => setAdding(false)}
          busy={ledger.pending.has("add")}
        >
          <AddHoldingForm
            market={p.asset_class}
            holdings={p.holdings}
            busy={ledger.pending.has("add")}
            error={ledger.errors.add}
            onEdit={(symbol) =>
              navigate(`${marketPath(p.asset_class)}/${p.id}?holding=${symbol}`)
            }
            onSubmit={async (draft) => {
              const updated = await ledger.run(
                "add",
                `add ${draft.symbol}`,
                (latest) => {
                  if (latest.holdings.some((h) => h.symbol === draft.symbol))
                    throw new Error(
                      `${draft.symbol} already exists. Edit it instead.`,
                    );
                  return portfolioApi.upsertHolding(
                    latest.id,
                    latest.version,
                    draft,
                  );
                },
                `${draft.symbol} added`,
              );
              if (updated) {
                setAdding(false);
                filter.reset();
                return true;
              }
              return false;
            }}
          />
        </Modal>
      )}
      <Feedback ledger={ledger} />
      {p.kind === "sample" && (
        <div className="sample-banner">
          <strong>Sample portfolio — for exploration only.</strong>
          <div className="form-actions">
            <Button variant="outline" onClick={() => onHide(p.id)}>
              Hide sample
            </Button>
            <Button onClick={onCreate}>Create my own</Button>
          </div>
        </div>
      )}
      <div className="dashboard-grid">
        <div className="dashboard-primary">
          <Card>
            <div className="card-heading">
              <NameEditor ledger={ledger} level={2} />
              <select
                aria-label="Selected portfolio"
                value={p.id}
                onChange={(e) => onSelect(Number(e.target.value))}
              >
                {portfolios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <Link className="pill-link" to={`${marketPath(p.asset_class)}/${p.id}`}>
                Open portfolio ↗
              </Link>
            </div>
            <p className="section-description">
              Saved {formatDateTime(p.updated_at)}
            </p>
            <div className="position-chips">
              <span className={`portfolio-badge ${p.asset_class}-chip`}>{marketLabel(p.asset_class)} · {p.holdings.length} positions</span>
            </div>
          </Card>
          <Card>
            <div className="card-heading">
              <h2>Your holdings</h2>
              <Button variant="outline" onClick={() => setAdding(true)}>
                ＋ Add holding
              </Button>
            </div>
            <HoldingsToolbar filter={filter} />
            {filter.rows.length ? (
              <ul className="holdings-list">
                {filter.rows.map((h) => (
                  <li key={h.symbol}>
                    <Link
                      className="holding-summary actionable-holding"
                      to={`${marketPath(p.asset_class)}/${p.id}?holding=${encodeURIComponent(h.symbol)}`}
                      aria-label={`Edit ${h.symbol}, ${formatQty(h.quantity)} ${h.asset_class === "stock" ? "shares" : "units"}`}
                    >
                      <AssetIdentity
                        symbol={h.symbol}
                        name={h.asset_name}
                        assetClass={h.asset_class}
                      />
                      <div className="holding-number">
                        <small>Quantity</small>
                        <strong className="tabular">
                          {formatQty(h.quantity)}{" "}
                          {h.asset_class === "stock" ? "shares" : "units"}
                        </strong>
                      </div>
                      <div className="holding-number">
                        <small>Avg. cost / unit</small>
                        <strong className="tabular">
                          {h.avg_cost_inr === null
                            ? "Unknown"
                            : formatInr(h.avg_cost_inr)}
                        </strong>
                      </div>
                      <div className="holding-number">
                        <small>Your cost</small>
                        <strong className="tabular">
                          {h.entered_cost_inr === null
                            ? "Unknown"
                            : formatInr(h.entered_cost_inr)}
                        </strong>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="panel-empty">
                <p>
                  {p.holdings.length
                    ? "No holdings match these filters."
                    : "No holdings entered yet."}
                </p>
                {!p.holdings.length && (
                  <Button onClick={() => setAdding(true)}>
                    Add your first holding
                  </Button>
                )}
              </div>
            )}
            <p className="valuation-note">
              Purchase costs are the amounts you enter. Market quotes above do
              not change your holdings or calculate portfolio returns.
            </p>
          </Card>
          <Card>
            <div className="card-heading">
              <h2>{p.asset_class === "stock" ? "Stock forecasts" : "Crypto forecasts"}</h2>
              <span className="portfolio-badge">Coming soon</span>
            </div>
            <p className="section-description">
              {p.asset_class === "stock" ? "Stock" : "Crypto"} forecasts will live here.
            </p>
          </Card>
        </div>
        <aside className="dashboard-secondary">
          <Card>
            <div className="card-heading">
              <h2>Your portfolios</h2>
              <span className="count-pill">{portfolios.length}</span>
            </div>
            {portfolios.map((item) => (
              <div
                className={`portfolio-list-item ${p.id === item.id ? "selected" : ""}`}
                key={item.id}
              >
                <Link
                  className="portfolio-select"
                  to={`${marketPath(item.asset_class)}/${item.id}`}
                  onClick={() => onSelect(item.id)}
                >
                  <span className="portfolio-icon" aria-hidden="true">
                    ▣
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.kind === "sample" ? "Sample data" : "Portfolio"} ·{" "}
                      {item.holdings.length} positions
                    </small>
                  </span>
                </Link>
                {item.kind === "sample" ? (
                  <Button
                    variant="ghost"
                    aria-label={`Hide ${item.name}`}
                    onClick={() => onHide(item.id)}
                  >
                    Hide
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    aria-label={`Delete ${item.name}`}
                    disabled={ledger.pending.size > 0}
                    onClick={() => onDelete(item)}
                  >
                    ×
                  </Button>
                )}
              </div>
            ))}
          </Card>
          <Card>
            <div className="card-heading">
              <h2>Portfolio updates</h2>
            </div>
            <ChangeHistory market={p.asset_class} portfolioId={p.id} version={p.version} limit={4} />
          </Card>
        </aside>
      </div>
    </>
  );
}
