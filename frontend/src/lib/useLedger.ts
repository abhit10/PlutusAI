import { useRef, useState } from "react";
import { ApiError } from "./api";
import { portfolioApi } from "./portfolio";
import type { Holding, Portfolio } from "./types";

// Serialize this tab's writes while keeping unrelated controls usable. Never retry
// an external conflict automatically, and cancel queued drafts after a conflict.
export function useLedger(
  initial: Portfolio,
  onChange?: (p: Portfolio) => void,
) {
  const [portfolio, setPortfolio] = useState(initial);
  const current = useRef(initial);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const epoch = useRef(0);
  const locks = useRef(new Set<string>());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState("");
  const [notice, setNotice] = useState("");
  const [recoveredHoldings, setRecoveredHoldings] = useState<Holding[]>([]);
  function publish(p: Portfolio) {
    current.current = p;
    setPortfolio(p);
    onChange?.(p);
  }
  async function run(
    key: string,
    attempt: string,
    save: (p: Portfolio) => Promise<Portfolio>,
    success: string | ((p: Portfolio) => string),
  ) {
    if (locks.current.has(key)) return null;
    setNotice("");
    locks.current.add(key);
    setPending(new Set(locks.current));
    setErrors((e) => ({ ...e, [key]: "" }));
    const generation = epoch.current;
    const task = queue.current.then(async () => {
      try {
        if (generation !== epoch.current)
          throw new Error(
            `Review the refreshed portfolio before you ${attempt}. Your input has been kept.`,
          );
        const updated = await save(current.current);
        publish(updated);
        setRecoveredHoldings((items) =>
          items.filter(
            (h) => !updated.holdings.some((saved) => saved.symbol === h.symbol),
          ),
        );
        setConflict("");
        setNotice(typeof success === "function" ? success(updated) : success);
        return updated;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          epoch.current++;
          try {
            const latest = await portfolioApi.get(current.current.id, current.current.asset_class);
            const removedElsewhere = current.current.holdings.filter(
              (h) =>
                !latest.holdings.some((saved) => saved.symbol === h.symbol),
            );
            setRecoveredHoldings((items) => [
              ...items.filter(
                (h) =>
                  !latest.holdings.some((saved) => saved.symbol === h.symbol) &&
                  !removedElsewhere.some(
                    (removed) => removed.symbol === h.symbol,
                  ),
              ),
              ...removedElsewhere,
            ]);
            publish(latest);
            setConflict(
              `Someone else changed this while you tried to ${attempt}. The latest saved data is below; your input has been kept. Review it and try again.`,
            );
          } catch {
            setConflict(
              `Someone else changed this while you tried to ${attempt}. We couldn't reload the latest data. Refresh before trying again.`,
            );
          }
          setErrors((e) => ({
            ...e,
            [key]: `Not saved: review the latest data before you ${attempt}.`,
          }));
        } else
          setErrors((e) => ({
            ...e,
            [key]:
              err instanceof Error
                ? err.message
                : "Could not save. Please retry.",
          }));
        return null;
      } finally {
        locks.current.delete(key);
        setPending(new Set(locks.current));
      }
    });
    queue.current = task;
    return task;
  }
  return {
    portfolio,
    recoveredHoldings,
    dismissRecovered: (symbol: string) =>
      setRecoveredHoldings((items) => items.filter((h) => h.symbol !== symbol)),
    pending,
    errors,
    conflict,
    notice,
    clearNotice: () => setNotice(""),
    run,
  };
}
export type Ledger = ReturnType<typeof useLedger>;
