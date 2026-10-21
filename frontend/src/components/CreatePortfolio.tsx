import { useRef, useState } from "react";
import type { Portfolio, AssetClass } from "../lib/types";
import { portfolioApi } from "../lib/portfolio";
import { Button, Field, Form, Input, Modal, Banner } from "./ui";
import AddHoldingForm, { type HoldingDraft } from "./AddHoldingForm";
export default function CreatePortfolio({
  initialMarket,
  onClose,
  onCreated,
}: {
  initialMarket: AssetClass;
  onClose: () => void;
  onCreated: (p: Portfolio) => void;
}) {
  const [market, setMarket] = useState<AssetClass>(initialMarket);
  const [step, setStep] = useState(0),
    [name, setName] = useState(""),
    [holdings, setHoldings] = useState<HoldingDraft[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function create() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      onCreated(await portfolioApi.create(name.trim(), market, { holdings }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create portfolio.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal title="Create a portfolio" onClose={onClose} busy={busy}>
      <ol className="setup-progress" aria-label="Setup progress">
        {["Market & name", "Holdings"].map((label, i) => (
          <li key={label} aria-current={step === i ? "step" : undefined}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      {error && <Banner>{error}</Banner>}
      {step === 0 ? (
        <Form
          className="portfolio-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) setStep(1);
          }}
        >
          <Field label="Market">
            <select className="portfolio-input" value={market} disabled={holdings.length > 0} onChange={(e) => setMarket(e.target.value as AssetClass)}>
              <option value="stock">Stocks · NSE / Indian stocks · INR</option>
              <option value="crypto">Crypto · Cryptocurrencies · INR</option>
            </select>
            <small>One market per portfolio. {holdings.length > 0 ? "Remove staged holdings before changing market." : "This choice is permanent after creation."}</small>
          </Field>
          <Field label="Portfolio name">
            <Input
              required
              autoFocus
              maxLength={128}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Core investments"
            />
          </Field>
          <Button type="submit" disabled={!name.trim()}>
            Continue to holdings
          </Button>
        </Form>
      ) : (
        <>
          <p className="section-description">
            Add {market === "stock" ? "stocks" : "crypto"} to “{name}”, or create it now and add holdings
            later.
          </p>
          {holdings.length > 0 && (
            <ul className="draft-holdings">
              {holdings.map((h) => (
                <li key={h.symbol}>
                  <span>
                    {h.symbol} · {h.quantity}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    aria-label={`Remove draft ${h.symbol}`}
                    onClick={() =>
                      setHoldings((rows) =>
                        rows.filter((row) => row.symbol !== h.symbol),
                      )
                    }
                  >
                    ×
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <AddHoldingForm
            key={market}
            market={market}
            busy={busy}
            holdings={holdings}
            submitLabel="Add to portfolio"
            onSubmit={async (draft) => {
              setHoldings((rows) => [...rows, draft]);
              return true;
            }}
          />
          <div className="form-actions modal-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setStep(0)}
            >
              Back
            </Button>
            <Button disabled={busy} onClick={create}>
              {busy
                ? "Creating…"
                : holdings.length
                  ? `Create portfolio (${holdings.length} holdings)`
                  : "Skip and create portfolio"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
