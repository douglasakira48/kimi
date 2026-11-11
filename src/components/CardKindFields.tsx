"use client";

import { useState } from "react";

/** Tipo do cartão (crédito ou débito); só o crédito pede dia de fechamento e vencimento. */
export default function CardKindFields({
  members = [],
  defaultOwner = "",
}: {
  members?: { user_id: string; display_name: string }[];
  defaultOwner?: string;
}) {
  const [kind, setKind] = useState<"credit" | "debit">("credit");
  const [owner, setOwner] = useState(defaultOwner);
  return (
    <>
      <div className="field">
        <span className="label" id="kind-label">Tipo</span>
        <div className="segment" role="group" aria-labelledby="kind-label">
          <button type="button" className={kind === "credit" ? "on" : ""} aria-pressed={kind === "credit"} onClick={() => setKind("credit")}>Crédito</button>
          <button type="button" className={kind === "debit" ? "on" : ""} aria-pressed={kind === "debit"} onClick={() => setKind("debit")}>Débito</button>
        </div>
        <input type="hidden" name="kind" value={kind} />
      </div>
      {members.length > 0 && (
        <div className="field">
          <span className="label" id="card-owner-label">De quem é o cartão</span>
          <div className="chips" role="group" aria-labelledby="card-owner-label">
            {[{ id: "", label: "Casa" }, ...members.map((m) => ({ id: m.user_id, label: m.display_name }))].map((o) => (
              <button key={o.id || "casa"} type="button" className={`chip ${owner === o.id ? "on" : ""}`} aria-pressed={owner === o.id} onClick={() => setOwner(o.id)}>{o.label}</button>
            ))}
          </div>
          <input type="hidden" name="owner" value={owner} />
        </div>
      )}
      {kind === "credit" && (
        <div style={{ display: "flex", gap: 16 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="closing">Fecha no dia</label>
            <input id="closing" name="closing" type="number" min={1} max={31} inputMode="numeric" className="input lg" required />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="due">Vence no dia</label>
            <input id="due" name="due" type="number" min={1} max={31} inputMode="numeric" className="input lg" required />
          </div>
        </div>
      )}
    </>
  );
}
