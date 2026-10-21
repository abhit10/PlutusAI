import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { marketPath } from "../lib/market";
import { portfolioApi } from "../lib/portfolio";
import type { PortfolioChange, AssetClass } from "../lib/types";
import { formatDateTime } from "../lib/format";
import { describeChange } from "../lib/history";
import { Button } from "./ui";
export default function ChangeHistory({
  market,
  portfolioId,
  version,
  limit,
}: {
  market: AssetClass;
  portfolioId: number;
  version: number;
  limit?: number;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [changes, setChanges] = useState<PortfolioChange[]>([]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    portfolioApi
      .changes(portfolioId)
      .then((r) => {
        if (alive)
          setChanges(r.results.filter((c) => describeChange(c).length > 0));
      })
      .catch(() => {
        if (alive) setError("Could not load history.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [portfolioId, version, retry]);
  if (loading)
    return (
      <p className="panel-empty" role="status">
        Loading portfolio updates…
      </p>
    );
  if (error)
    return (
      <div className="panel-empty">
        <p role="alert">{error}</p>
        <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
          Retry history
        </Button>
      </div>
    );
  if (!changes.length)
    return (
      <p className="panel-empty">
        Your portfolio updates will appear here.{" "}
        <Link
          className="text-link"
          to={`${marketPath(market)}/${portfolioId}#add-holding`}
        >
          Add a holding →
        </Link>
      </p>
    );
  return (
    <ol className="history-list">
      {changes.slice(0, limit).map((c) => (
        <li key={c.id} className="activity-item">
          {describeChange(c).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          <time className="muted" dateTime={c.created_at}>
            {formatDateTime(c.created_at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
