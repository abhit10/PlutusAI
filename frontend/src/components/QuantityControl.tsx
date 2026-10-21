import { useId, useMemo, type Ref } from "react";
import {
  decimalUnits,
  decimalString,
  cryptoStops,
  SCALE,
} from "../lib/quantity";
import { Button, Input } from "./ui";
export default function QuantityControl({
  value,
  onChange,
  assetClass,
  step,
  disabled = false,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  assetClass?: string;
  step?: string;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const id = useId(),
    stock = assetClass === "stock",
    unit = stock ? "shares" : "units";
  const quantum = stock ? SCALE : decimalUnits(step || "") || 0n;
  const inactive = disabled || !assetClass || quantum <= 0n;
  const stops = useMemo(
    () => (stock ? [] : cryptoStops(quantum)),
    [stock, quantum],
  );
  const amount = decimalUnits(value);
  const maximum = stock ? 10000n * SCALE : stops[stops.length - 1] || SCALE;
  let position = stock
    ? Number((amount || SCALE) / SCALE)
    : Math.max(
        0,
        stops.findIndex((v) => amount !== null && v >= amount),
      );
  if (amount !== null && amount >= maximum)
    position = stock ? 10000 : stops.length - 1;
  const rangeValue = stock
    ? Math.min(10000, Math.max(1, position))
    : Math.max(0, position);
  return (
    <div className="quantity-control">
      <label htmlFor={id} className="field-label">
        Quantity
      </label>
      <Input
        id={id}
        ref={inputRef}
        type="number"
        required
        min={quantum > 0n ? decimalString(quantum) : undefined}
        step={quantum > 0n ? decimalString(quantum) : "any"}
        inputMode="decimal"
        disabled={inactive}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-hint`}
      />
      <input
        className="quantity-range"
        type="range"
        aria-label="Quantity slider"
        aria-valuetext={`${value || "Not set"} ${unit}`}
        min={stock ? 1 : 0}
        max={stock ? 10000 : Math.max(0, stops.length - 1)}
        step={1}
        value={rangeValue}
        disabled={inactive || (!stock && stops.length < 2)}
        onChange={(e) =>
          onChange(
            stock
              ? e.target.value
              : decimalString(stops[Number(e.target.value)]),
          )
        }
      />
      <div className="range-caption" id={`${id}-hint`}>
        <span>
          {value || "Choose a quantity"} {assetClass ? unit : ""}
        </span>
        <small>
          {inactive && !disabled
            ? "Select an asset first"
            : `Step ${quantum > 0n ? decimalString(quantum) : "—"}`}
        </small>
      </div>
      {amount !== null && amount > maximum && (
        <small className="muted">
          Above slider range. Your typed quantity is kept exactly.
        </small>
      )}
      <div className="quantity-presets">
        {(stock ? ["1", "10", "50", "100"] : ["0.01", "0.1", "1"]).map(
          (preset) => (
            <Button
              key={preset}
              variant="outline"
              disabled={
                inactive ||
                (decimalUnits(preset) || 0n) % (quantum || 1n) !== 0n ||
                (decimalUnits(preset) || 0n) < quantum
              }
              onClick={() => onChange(preset)}
            >
              {preset}
            </Button>
          ),
        )}
      </div>
    </div>
  );
}
