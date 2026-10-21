import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { marketPath, marketLabel } from "../lib/market";
import { portfolioApi } from "../lib/portfolio";
import type { Holding, Portfolio, AssetClass } from "../lib/types";
import { useLedger } from "../lib/useLedger";
import { formatDateTime } from "../lib/format";
import { Banner, Button, Card, Skeleton } from "../components/ui";
import { Feedback, NameEditor } from "../components/LedgerPanels";
import DeletePortfolio from "../components/DeletePortfolio";
import HoldingsToolbar, {
  useHoldingFilters,
} from "../components/HoldingsToolbar";
import { useAuth } from "../lib/auth";
import AddHoldingForm from "../components/AddHoldingForm";
import HoldingRow from "../components/HoldingRow";
import ChangeHistory from "../components/ChangeHistory";
export default function PortfolioPage({ market }: { market: AssetClass }) {
  const { id } = useParams();
  const [p, setP] = useState<Portfolio | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setP(null);
    setError("");
    portfolioApi
      .get(Number(id), market)
      .then((p) => {
        if (alive) setP(p);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [id, retry, market]);
  if (error)
    return (
      <>
        <Banner>{error}</Banner>
        <Button onClick={() => setRetry((n) => n + 1)}>Retry portfolio</Button>
      </>
    );
  return p ? <Editor key={p.id} initial={p} /> : <Skeleton />;
}
function Editor({ initial }: { initial: Portfolio }) {
  const ledger = useLedger(initial),
    p = ledger.portfolio;
  const [params, setParams] = useSearchParams();
  const location = useLocation(),
    navigate = useNavigate(),
    { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(
    initial.holdings.length === 0 || location.hash === "#add-holding",
  );
  const filter = useHoldingFilters([
    ...p.holdings,
    ...ledger.recoveredHoldings,
  ]);
  useEffect(() => {
    try {
      localStorage.setItem(`plutus-selected:${user?.id}:${p.asset_class}`, String(p.id));
    } catch {
      /* optional preference */
    }
  }, [p.id, user?.id]);
  useEffect(() => {
    if (p.holdings.length === 0) setAdding(true);
  }, [p.holdings.length]);
  useEffect(() => {
    if (params.get("holding")) filter.reset();
  }, [params.get("holding")]);
  const [removed, setRemoved] = useState<Holding[]>([]);
  useEffect(() => {
    document.title = `${p.name} · PlutusAI`;
  }, [p.name]);
  useEffect(() => {
    if (location.hash === "#add-holding") {
      setAdding(true);
      document.getElementById("add-holding")?.scrollIntoView();
    }
  }, [location.hash]);
  return (
    <div className="dashboard">
      <div className="dashboard-intro">
        <div>
          <Link className="text-link" to={marketPath(p.asset_class)}>
            ← Overview
          </Link>
          <NameEditor ledger={ledger} level={1} />
          <p className="muted">
            Saved {formatDateTime(p.updated_at)} ·{" "}
            {p.kind === "sample" ? "Sample data" : "Portfolio"}
          </p>
        </div>
        {p.kind !== "sample" && (
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={ledger.pending.size > 0}
              onClick={() => setDeleting(true)}
            >
              Delete portfolio
            </Button>
          </div>
        )}
      </div>
      {deleting && (
        <DeletePortfolio
          portfolio={p}
          onClose={() => setDeleting(false)}
          onDeleted={() =>
            navigate(marketPath(p.asset_class), {
              replace: true,
              state: { notice: `${p.name} deleted` },
            })
          }
        />
      )}
      <Feedback ledger={ledger} />
      {removed.map((h) => (
        <div className="portfolio-toast" role="status" key={h.symbol}>
          <span>{h.symbol} removed</span>
          <Button
            variant="outline"
            disabled={ledger.pending.has(`undo:${h.symbol}`)}
            onClick={async () => {
              if (
                await ledger.run(
                  `undo:${h.symbol}`,
                  `restore ${h.symbol}`,
                  (latest) => {
                    if (
                      latest.holdings.some((item) => item.symbol === h.symbol)
                    )
                      throw new Error(
                        `${h.symbol} already exists. Review it instead of overwriting it.`,
                      );
                    return portfolioApi.upsertHolding(
                      latest.id,
                      latest.version,
                      {
                        symbol: h.symbol,
                        quantity: h.quantity,
                        avg_cost_inr: h.avg_cost_inr,
                      },
                    );
                  },
                  `${h.symbol} restored`,
                )
              )
                setRemoved((items) =>
                  items.filter((item) => item.symbol !== h.symbol),
                );
            }}
          >
            Undo
          </Button>
          <Button
            variant="ghost"
            aria-label={`Dismiss undo ${h.symbol}`}
            onClick={() =>
              setRemoved((items) =>
                items.filter((item) => item.symbol !== h.symbol),
              )
            }
          >
            ×
          </Button>
          {ledger.errors[`undo:${h.symbol}`] && (
            <Banner>{ledger.errors[`undo:${h.symbol}`]}</Banner>
          )}
        </div>
      ))}
      <div className="dashboard-grid">
        <div className="dashboard-primary">
          <Card>
            <div className="card-heading">
              <h2>Your holdings</h2>
              <span className="count-pill">{p.holdings.length}</span>
            </div>
            <HoldingsToolbar filter={filter} />
            {filter.rows.length ? (
              <ul className="holdings-list">
                {filter.rows.map((h) => (
                  <HoldingRow
                    key={h.symbol}
                    holding={h}
                    missing={
                      !p.holdings.some((saved) => saved.symbol === h.symbol)
                    }
                    ledger={ledger}
                    focus={params.get("holding") === h.symbol}
                    focusToken={params.toString()}
                    onRemoved={(h) => {
                      ledger.clearNotice();
                      setRemoved((items) => [
                        ...items.filter((item) => item.symbol !== h.symbol),
                        h,
                      ]);
                    }}
                  />
                ))}
              </ul>
            ) : (
              <p className="panel-empty">
                {p.holdings.length
                  ? "No holdings match these filters."
                  : `Add your first ${p.asset_class === "stock" ? "stock" : "crypto"} holding below.`}
              </p>
            )}
            <p className="valuation-note">
              Live prices and performance analysis are coming soon. Purchase
              costs are the amounts you enter.
            </p>
          </Card>
          <section id="add-holding" className="dash-card">
            <div className="card-heading">
              <h2>Add a holding</h2>
              <Button
                variant="outline"
                aria-expanded={adding}
                disabled={ledger.pending.has("add")}
                onClick={() => setAdding(!adding)}
              >
                {adding ? "Close" : "＋ Add"}
              </Button>
            </div>
            {adding && (
              <AddHoldingForm
                market={p.asset_class}
                busy={ledger.pending.has("add")}
                holdings={p.holdings}
                error={ledger.errors.add}
                onEdit={(symbol) => {
                  setParams({ holding: symbol, edit: String(Date.now()) });
                  document
                    .getElementById(`holding-${symbol}`)
                    ?.scrollIntoView({ block: "center" });
                }}
                onSubmit={async (draft) => {
                  const updated = await ledger.run(
                    "add",
                    `add ${draft.symbol}`,
                    (latest) => {
                      if (
                        latest.holdings.some((h) => h.symbol === draft.symbol)
                      )
                        throw new Error(
                          `${draft.symbol} already exists. Edit its row above.`,
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
            )}
          </section>
        </div>
        <aside className="dashboard-secondary">
          <Card>
            <div className="card-heading">
              <h2>Portfolio updates</h2>
            </div>
            <ChangeHistory market={p.asset_class} portfolioId={p.id} version={p.version} />
          </Card>
        </aside>
      </div>
      <p className="dashboard-disclosure">
        Version {p.version} · {marketLabel(p.asset_class)} · INR
      </p>
    </div>
  );
}
