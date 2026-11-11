import { describe, expect, it } from "vitest";
import { monthKeys, monthlyTotals, variableSeries, type SeriesBill } from "./series";

const b = (o: Partial<SeriesBill>): SeriesBill => ({
  expense_id: "e", due_date: "2026-11-05", amount: 100, interest: 0, status: "pending", is_estimate: false, ...o,
});

describe("series", () => {
  it("gera chaves de mês atravessando o ano", () => {
    expect(monthKeys("2026-11", 4)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });
  it("separa pago, a pagar e estimado", () => {
    const r = monthlyTotals(
      [b({ status: "paid", amount: 50, interest: 5 }), b({ amount: 30 }), b({ amount: 20, is_estimate: true }), b({ due_date: "2027-03-01" })],
      ["2026-11"],
    );
    expect(r[0]).toEqual({ key: "2026-11", paid: 55, pending: 30, estimate: 20 });
  });
  it("série variável marca estimativas", () => {
    const s = variableSeries(
      [b({ status: "paid", amount: 181.18 }), b({ due_date: "2026-12-05", is_estimate: true, amount: 181.18 })],
      "e", ["2026-11", "2026-12", "2027-01"],
    );
    expect(s).toEqual([
      { key: "2026-11", amount: 181.18, estimate: false },
      { key: "2026-12", amount: 181.18, estimate: true },
    ]);
  });
});
