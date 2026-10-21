import { useState } from "react";
import type { Asset, AssetClass, Holding } from "../lib/types";
import { Button, Field, Form, Input } from "./ui";
import QuantityControl from "./QuantityControl";
import AssetPicker from "./AssetPicker";
export interface HoldingDraft {
  symbol: string;
  quantity: string;
  avg_cost_inr: string | null;
}
interface Props {
  market: AssetClass;
  onSubmit: (payload: HoldingDraft) => Promise<boolean>;
  busy: boolean;
  holdings?: Pick<Holding, "symbol">[];
  error?: string;
  onEdit?: (symbol: string) => void;
  submitLabel?: string;
}
export default function AddHoldingForm({
  market,
  onSubmit,
  busy,
  holdings = [],
  error,
  onEdit,
  submitLabel = "Add holding",
}: Props) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [localError, setLocalError] = useState("");
  const existing = holdings.find((h) => h.symbol === asset?.symbol);
  return (
    <Form
      className="portfolio-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setLocalError("");
        if (!asset) {
          setLocalError("Choose a supported asset from the search results.");
          return;
        }
        if (existing) {
          setLocalError(
            `${asset.symbol} is already held. Edit its row instead.`,
          );
          return;
        }
        if (
          await onSubmit({
            symbol: asset.symbol,
            quantity,
            avg_cost_inr: cost.trim() || null,
          })
        ) {
          setAsset(null);
          setQuantity("");
          setCost("");
        }
      }}
    >
      <AssetPicker
        market={market}
        value={asset}
        onChange={setAsset}
        disabled={busy}
        holdings={holdings}
        onEdit={onEdit}
      />
      {existing && (
        <div className="inline-notice">
          {existing.symbol} is already in this portfolio. Adding it here will
          not overwrite it.{" "}
          {onEdit && (
            <Button variant="outline" onClick={() => onEdit(existing.symbol)}>
              Edit {existing.symbol}
            </Button>
          )}
        </div>
      )}
      <div className="field-grid">
        <QuantityControl
          value={quantity}
          onChange={setQuantity}
          assetClass={market}
          step={asset?.quantity_step}
          disabled={busy || !asset}
        />
        <Field
          label="Average purchase cost per unit (INR)"
          hint="Optional. Blank means unknown, not zero."
        >
          <Input
            inputMode="decimal"
            maxLength={64}
            disabled={busy}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Unknown"
          />
        </Field>
      </div>
      {(error || localError) && (
        <p className="field-error" role="alert">
          {error || localError}
        </p>
      )}
      <div className="form-actions sticky-save">
        <Button type="submit" disabled={busy || !!existing}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        <small className="muted">Ctrl / ⌘ + Enter to save</small>
      </div>
    </Form>
  );
}
