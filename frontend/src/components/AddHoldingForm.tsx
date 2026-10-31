import { useState } from "react";
import type { Asset, AssetClass, Holding, MarketQuote } from "../lib/types";
import { useMarketData } from "../lib/useMarketData";
import { formatInr, formatDateTime } from "../lib/format";
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
  const [useQuote, setUseQuote] = useState(true);
  const quote = useMarketData<MarketQuote>(asset ? `/market/quote/?symbol=${encodeURIComponent(asset.symbol)}&market=${market}` : null, 20_000);
  const current = quote.data;
  const quoteReady = !!current && !quote.error && !current.stale && current.currency === 'INR' && Number.isFinite(current.current_price) && current.current_price > 0;
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
        if (useQuote && !quoteReady) {
          setLocalError('Wait for a price, retry, or enter a purchase cost manually.');
          return;
        }
        if (
          await onSubmit({
            symbol: asset.symbol,
            quantity,
            avg_cost_inr: useQuote ? current!.current_price.toFixed(2) : cost.trim() || null,
          })
        ) {
          setAsset(null);
          setQuantity("");
          setCost("");
          setUseQuote(true);
        }
      }}
    >
      <AssetPicker
        market={market}
        value={asset}
        onChange={(next) => { setAsset(next); setCost(''); setLocalError(''); }}
        disabled={busy}
        holdings={holdings}
        onEdit={onEdit}
      />
      {asset && <div className="live-valuation">
        <strong>{asset.symbol} · {current ? formatInr(current.current_price.toFixed(2)) : quote.error ? 'Price unavailable' : 'Loading market price…'}</strong>
        {current && <p className="muted">{current.source === 'binance' ? 'Binance · Indicative INR' : 'Yahoo Finance'} · As of {formatDateTime(current.timestamp)} IST. {current.stale ? 'Stale quote.' : 'Updates every 20 seconds; prices may be delayed.'}</p>}
        {quote.error && <p role="status">{quote.error}</p>}
        <Button variant="outline" disabled={quote.loading} onClick={quote.retry}>Refresh quote</Button>
      </div>}
      <Field label="Purchase cost source">
        <select className="portfolio-input" value={useQuote ? 'quote' : 'manual'} disabled={busy} onChange={e => setUseQuote(e.target.value === 'quote')}>
          <option value="quote">Use latest available price</option>
          <option value="manual">Enter historical purchase cost</option>
        </select>
        <small>The selected price is saved as your purchase cost when added. Later quotes update market value only; this does not execute a trade.</small>
      </Field>
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
          hint={useQuote ? 'Latest quote, fixed when you add this holding.' : 'Optional. Blank means unknown, not zero.'}
        >
          <Input
            inputMode="decimal"
            maxLength={64}
            disabled={busy || useQuote}
            value={useQuote ? (quoteReady ? current!.current_price.toFixed(2) : '') : cost}
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
        <Button type="submit" disabled={busy || !!existing || !asset || (useQuote && !quoteReady)}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        <small className="muted">Ctrl / ⌘ + Enter to save</small>
      </div>
    </Form>
  );
}
