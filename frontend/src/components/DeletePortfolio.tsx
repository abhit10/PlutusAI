import { useRef, useState } from "react";
import type { Portfolio } from "../lib/types";
import { portfolioApi } from "../lib/portfolio";
import { Banner, Button, Modal } from "./ui";
export default function DeletePortfolio({
  portfolio,
  onClose,
  onDeleted,
}: {
  portfolio: Portfolio;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const locked = useRef(false);
  return (
    <Modal title={`Delete ${portfolio.name}?`} onClose={onClose} busy={busy}>
      <p className="section-description">
        This permanently removes this portfolio and its holdings from PlutusAI.
        Your {portfolio.asset_class === "stock" ? "stocks" : "crypto"} are not sold. This cannot be undone.
      </p>
      {error && <Banner>{error}</Banner>}
      <div className="form-actions modal-actions">
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Keep portfolio
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            if (locked.current) return;
            locked.current = true;
            setBusy(true);
            setError("");
            try {
              await portfolioApi.delete(portfolio.id);
              onDeleted();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Could not delete portfolio.",
              );
            } finally {
              locked.current = false;
              setBusy(false);
            }
          }}
        >
          {busy ? "Deleting…" : "Delete portfolio"}
        </Button>
      </div>
    </Modal>
  );
}
