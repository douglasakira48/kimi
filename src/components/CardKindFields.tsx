"use client";

import { useState } from "react";

/** Tipo do cartão (crédito ou débito); só o crédito pede dia de fechamento e vencimento. */
export default function CardKindFields() {
  const [kind, setKind] = useState<"credit" | "debit">("credit");
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
