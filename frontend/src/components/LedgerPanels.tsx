import { useState } from "react";
import type { Ledger } from "../lib/useLedger";
import { portfolioApi } from "../lib/portfolio";
import { Banner, Button, Field, Form, Input } from "./ui";

export function Feedback({ ledger }: { ledger: Ledger }) {
  return (
    <>
      {ledger.conflict && <Banner tone="info">{ledger.conflict}</Banner>}
      {ledger.notice && (
        <div className="portfolio-toast" role="status">
          <span>{ledger.notice}</span>
          <Button
            variant="ghost"
            aria-label="Dismiss notification"
            onClick={ledger.clearNotice}
          >
            ×
          </Button>
        </div>
      )}
    </>
  );
}
export function NameEditor({
  ledger,
  level = 2,
}: {
  ledger: Ledger;
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  const p = ledger.portfolio;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  if (!editing)
    return (
      <Heading>
        <button
          className="name-editor"
          aria-label={`Rename ${p.name}`}
          onClick={() => {
            setName(p.name);
            setEditing(true);
          }}
        >
          {p.name} <span aria-hidden="true">↗</span>
        </button>
      </Heading>
    );
  return (
    <div className="name-edit-block">
      <Heading>{p.name}</Heading>
      <Form
        className="portfolio-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await ledger.run(
              "name",
              "rename this portfolio",
              (latest) =>
                portfolioApi.rename(latest.id, latest.version, name.trim()),
              "Portfolio renamed",
            )
          )
            setEditing(false);
        }}
      >
        <Field label="Portfolio name">
          <Input
            autoFocus
            required
            maxLength={128}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={ledger.pending.has("name")}
          />
        </Field>
        {ledger.errors.name && <Banner>{ledger.errors.name}</Banner>}
        <div className="form-actions">
          <Button
            type="submit"
            disabled={ledger.pending.has("name") || !name.trim()}
          >
            {ledger.pending.has("name") ? "Saving…" : "Save name"}
          </Button>
          <Button
            variant="ghost"
            disabled={ledger.pending.has("name")}
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </div>
      </Form>
    </div>
  );
}
