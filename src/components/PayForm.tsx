"use client";

import { useState } from "react";
import { markPaidAction } from "@/app/actions";
import { formatBRL, parseBRL } from "@/lib/money";

interface Props {
  billId: string;
  defaultAmount: string;
  today: string;
}

export default function PayForm({ billId, defaultAmount, today }: Props) {
  const [amount, setAmount] = useState(defaultAmount);
  const [withInterest, setWithInterest] = useState(false);
  const [interest, setInterest] = useState("");

  const total = (parseBRL(amount) ?? 0) + (withInterest ? (parseBRL(interest) ?? 0) : 0);

  return (
    <form action={markPaidAction} className="stack" style={{ gap: 30 }}>
      <input type="hidden" name="billId" value={billId} />

      <div className="field">
        <label htmlFor="amount">Valor da conta</label>
        <div className="prefix">
          <span>R$</span>
          <input
            id="amount" name="amount" className="input xl num" inputMode="decimal" autoComplete="off"
            value={amount} onChange={(e) => setAmount(e.target.value)} required
          />
        </div>
      </div>

      <div className="stack" style={{ gap: 18 }}>
        <div className="check-line">
          <label htmlFor="paidOn" style={{ fontWeight: 600 }}>Pago em</label>
          <input id="paidOn" name="paidOn" type="date" defaultValue={today} max={today} required style={{ border: 0, background: "transparent", fontSize: 16 }} />
        </div>

        <div className="check-line" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <label htmlFor="withInterest" style={{ fontWeight: 600 }}>Paguei com juros</label>
          <input
            id="withInterest" name="withInterest" type="checkbox" checked={withInterest}
            onChange={(e) => setWithInterest(e.target.checked)} style={{ accentColor: "#8a5200" }}
          />
        </div>

        {withInterest && (
          <div className="juros-box">
            <label htmlFor="interest">Valor dos juros</label>
            <div className="prefix">
              <span style={{ fontSize: 18, color: "#6b3f00" }}>R$</span>
              <input
                id="interest" name="interest" className="input md num" inputMode="decimal" autoComplete="off"
                value={interest} onChange={(e) => setInterest(e.target.value)} required
              />
            </div>
            <div className="small" style={{ color: "#6b3f00" }}>Entra no painel como juros pagos.</div>
          </div>
        )}
      </div>

      <div className="footer-bar">
        <div className="footer-inner">
          <div className="row-between" style={{ alignItems: "baseline" }}>
            <span className="muted">Total pago</span>
            <span className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26 }}>
              {formatBRL(total)}
            </span>
          </div>
          <button type="submit" className="btn">Confirmar pagamento</button>
        </div>
      </div>
    </form>
  );
}
