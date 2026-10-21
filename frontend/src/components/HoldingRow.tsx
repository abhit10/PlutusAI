import { useEffect, useRef, useState } from "react";
import type { Holding } from "../lib/types";
import type { Ledger } from "../lib/useLedger";
import { portfolioApi } from "../lib/portfolio";
import { formatInr, formatQty } from "../lib/format";
import QuantityControl from "./QuantityControl";
import { AssetIdentity, Banner, Button, Field, Form, Input } from "./ui";
export default function HoldingRow({
  holding: h,
  ledger,
  focus,
  focusToken,
  onRemoved,
  missing = false,
}: {
  holding: Holding;
  ledger: Ledger;
  focus: boolean;
  focusToken?: string;
  missing?: boolean;
  onRemoved: (h: Holding) => void;
}) {
  const [editing, setEditing] = useState(focus);
  const [removing, setRemoving] = useState(false);
  const [qty, setQty] = useState(
    h.quantity.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""),
  );
  const [cost, setCost] = useState(h.avg_cost_inr ?? "");
  const input = useRef<HTMLInputElement>(null);
  const key = `holding:${h.symbol}`,
    busy = ledger.pending.has(key);
  useEffect(() => {
    if (focus) setEditing(true);
  }, [focus, focusToken]);
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);
  return (
    <li className="holding-row" id={`holding-${h.symbol}`}>
      <div className="holding-summary">
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
            {h.avg_cost_inr === null ? "Unknown" : formatInr(h.avg_cost_inr)}
          </strong>
        </div>
        <div className="holding-number">
          <small>Your cost</small>
          <strong className="tabular">
            {h.entered_cost_inr === null
              ? "Unknown"
              : formatInr(h.entered_cost_inr)}
          </strong>
          {h.avg_cost_inr !== null && (
            <small>
              {formatQty(h.quantity)} × {formatInr(h.avg_cost_inr)}
            </small>
          )}
        </div>
        <div className="form-actions">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setQty(
                h.quantity.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""),
              );
              setCost(h.avg_cost_inr ?? "");
              setRemoving(false);
              setEditing(!editing);
            }}
          >
            {editing ? "Close edit" : `Edit ${h.symbol}`}
          </Button>
          {!missing && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setRemoving(true);
                setEditing(false);
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      {missing && (
        <Banner tone="info">
          This holding was removed in another session. Its draft is kept here;
          it is not part of the saved portfolio. Review to restore it, or{" "}
          <Button
            variant="outline"
            onClick={() => ledger.dismissRecovered(h.symbol)}
          >
            Discard draft
          </Button>
          .
        </Banner>
      )}
      {editing && (
        <Form
          className="portfolio-form row-editor"
          onSubmit={async (e) => {
            e.preventDefault();
            const expected = h.updated_at;
            const updated = await ledger.run(
              key,
              `update ${h.symbol}`,
              (latest) => {
                const current = latest.holdings.find(
                  (item) => item.symbol === h.symbol,
                );
                if (
                  (!current && !missing) ||
                  (current && current.updated_at !== expected)
                )
                  throw new Error(
                    "This holding changed. Review the latest saved quantity and cost before saving again.",
                  );
                return portfolioApi.upsertHolding(latest.id, latest.version, {
                  symbol: h.symbol,
                  quantity: qty,
                  avg_cost_inr: cost.trim() || null,
                });
              },
              (p) =>
                `${h.symbol} · ${formatQty(p.holdings.find((item) => item.symbol === h.symbol)!.quantity)} ${h.asset_class === "stock" ? "shares" : "units"} saved`,
            );
            if (updated) setEditing(false);
          }}
        >
          <div className="form-columns">
            <QuantityControl
              value={qty}
              onChange={setQty}
              assetClass={h.asset_class}
              step={h.quantity_step}
              disabled={busy}
              inputRef={input}
            />
            <Field
              label="Average purchase cost (INR)"
              hint="Leave blank if unknown."
            >
              <Input
                inputMode="decimal"
                maxLength={64}
                value={cost}
                onChange={(e) => {
                  setCost(e.target.value);
                }}
                disabled={busy}
              />
            </Field>
          </div>
          {
            <div className="review-box">
              <strong>Changes to {h.symbol}</strong>
              <p>
                Quantity: {missing ? "Removed" : formatQty(h.quantity)} → {qty}
              </p>
              <p>
                Average cost:{" "}
                {h.avg_cost_inr === null
                  ? "Unknown"
                  : formatInr(h.avg_cost_inr)}{" "}
                → {cost.trim() ? `₹${cost}` : "Unknown"}
              </p>
            </div>
          }
          <div className="sticky-save">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : missing ? "Restore holding" : "Save holding"}
            </Button>
            <small>Ctrl / ⌘ + Enter</small>
          </div>
        </Form>
      )}
      {removing && (
        <div className="review-box">
          <strong>Remove {h.symbol}?</strong>
          <p>
            This removes {formatQty(h.quantity)}{" "}
            {h.asset_class === "stock" ? "shares" : "units"} from this
            portfolio. It does not record a sale.
          </p>
          <div className="form-actions">
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                const expected = h.updated_at;
                if (
                  await ledger.run(
                    key,
                    `remove ${h.symbol}`,
                    (latest) => {
                      if (
                        latest.holdings.find((item) => item.symbol === h.symbol)
                          ?.updated_at !== expected
                      )
                        throw new Error(
                          "This holding changed. Review it before removing.",
                        );
                      return portfolioApi.removeHolding(
                        latest.id,
                        latest.version,
                        h.symbol,
                      );
                    },
                    `${h.symbol} removed`,
                  )
                )
                  onRemoved(h);
              }}
            >
              {busy ? "Removing…" : `Confirm remove ${h.symbol}`}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setRemoving(false)}
            >
              Keep holding
            </Button>
          </div>
        </div>
      )}
      {ledger.errors[key] && <Banner>{ledger.errors[key]}</Banner>}
    </li>
  );
}
