import { describe, expect, it } from "vitest";
import { generateBills, firstMonthlyDue } from "./bills";
import { matchRule } from "./categorize";
import { cardDueDate, isBusinessDay, nthBusinessDay, todayInSP } from "./dates";
import { parseBRL, splitInstallments } from "./money";

describe("dias úteis", () => {
  it("5º dia útil de novembro de 2026 é segunda 9/11 (2/11 é feriado)", () => {
    expect(nthBusinessDay(2026, 11, 5)).toBe("2026-11-09");
  });
  it("5º dia útil de outubro de 2026 é sexta 7/10", () => {
    expect(nthBusinessDay(2026, 10, 5)).toBe("2026-10-07");
  });
  it("sexta-feira santa de 2026 (3/4) não é dia útil", () => {
    expect(isBusinessDay("2026-04-03")).toBe(false);
    expect(isBusinessDay("2026-04-02")).toBe(true);
  });
  it("20/11 é feriado a partir de 2024", () => {
    expect(isBusinessDay("2026-11-20")).toBe(false);
    expect(isBusinessDay("2023-11-20")).toBe(true);
  });
});

describe("fatura do cartão", () => {
  it("fecha 10, vence 18: compra em 6/11 vence 18/11", () => {
    expect(cardDueDate("2026-11-06", 10, 18)).toBe("2026-11-18");
  });
  it("fecha 10, vence 18: compra em 10/11 já cai na fatura de dezembro", () => {
    expect(cardDueDate("2026-11-10", 10, 18)).toBe("2026-12-18");
  });
  it("fecha 25, vence 5: compra em 6/11 vence 5/12", () => {
    expect(cardDueDate("2026-11-06", 25, 5)).toBe("2026-12-05");
  });
  it("fecha 25, vence 5: compra em 28/12 vence 5/2", () => {
    expect(cardDueDate("2026-12-28", 25, 5)).toBe("2027-02-05");
  });
});

describe("parcelas", () => {
  it("2500 em 12x fecha exatamente 2500", () => {
    const parts = splitInstallments(2500, 12);
    expect(parts[0]).toBe(208.33);
    expect(parts[11]).toBe(208.37);
    expect(Math.round(parts.reduce((a, b) => a + b, 0) * 100)).toBe(250000);
  });
  it("gera 12 vencimentos mensais no dia do cartão", () => {
    const bills = generateBills(
      {
        recurrence: "installment", payment_method: "card", day_of_month: null, business_day: null,
        first_due_date: "2026-11-18", installments: 12, amount: 208.33, total_amount: 2500, is_variable: false,
      },
      { closing_day: 10, due_day: 18 },
      "2027-12-31",
    );
    expect(bills).toHaveLength(12);
    expect(bills[0]).toMatchObject({ due_date: "2026-11-18", installment_no: 1 });
    expect(bills[11]).toMatchObject({ due_date: "2027-10-18", installment_no: 12, amount: 208.37 });
  });
});

describe("despesas mensais", () => {
  const aluguel = {
    recurrence: "monthly" as const, payment_method: "pix" as const, day_of_month: null, business_day: 5,
    installments: null, amount: 2389, total_amount: null, is_variable: false,
  };
  it("aluguel no 5º dia útil de nov a jan", () => {
    const first = firstMonthlyDue(aluguel, null, "2026-11-06");
    expect(first).toBe("2026-11-09");
    const bills = generateBills({ ...aluguel, first_due_date: first }, null, "2027-01-31");
    expect(bills.map((b) => b.due_date)).toEqual(["2026-11-09", "2026-12-07", "2027-01-08"]);
  });
  it("energia dia 16 sem valor fixo gera lançamentos sem valor", () => {
    const energia = {
      recurrence: "monthly" as const, payment_method: "pix" as const, day_of_month: 16, business_day: null,
      installments: null, amount: null, total_amount: null, is_variable: true,
    };
    const first = firstMonthlyDue(energia, null, "2026-11-06");
    const bills = generateBills({ ...energia, first_due_date: first }, null, "2027-01-31");
    expect(bills.map((b) => b.due_date)).toEqual(["2026-11-16", "2026-12-16", "2027-01-16"]);
    expect(bills.every((b) => b.amount === null)).toBe(true);
  });
  it("dia 31 vira o último dia do mês quando necessário", () => {
    const r = {
      recurrence: "monthly" as const, payment_method: "pix" as const, day_of_month: 31, business_day: null,
      installments: null, amount: 100, total_amount: null, is_variable: false,
    };
    const bills = generateBills({ ...r, first_due_date: "2027-01-31" }, null, "2027-04-30");
    expect(bills.map((b) => b.due_date)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  });
});

describe("categorias e valores", () => {
  const rules = [
    { keyword: "comida", category_id: "alim" },
    { keyword: "gas", category_id: "fixas" },
    { keyword: "gasolina", category_id: "transp" },
    { keyword: "agua", category_id: "fixas" },
  ];
  it("comida vira alimentação", () => expect(matchRule("Comida japonesa", rules)).toBe("alim"));
  it("ignora acentos", () => expect(matchRule("Água", rules)).toBe("fixas"));
  it("a regra mais longa vence", () => expect(matchRule("Gasolina", rules)).toBe("transp"));
  it("sem regra devolve nada", () => expect(matchRule("Impressora", rules)).toBeNull());
  it("lê valores em reais", () => {
    expect(parseBRL("2.500,00")).toBe(2500);
    expect(parseBRL("R$ 241,7")).toBe(241.7);
    expect(parseBRL("96.40")).toBe(96.4);
    expect(parseBRL("2.500")).toBe(2500);
    expect(parseBRL("abc")).toBeNull();
  });
  it("hoje em São Paulo vem no formato AAAA-MM-DD", () => {
    expect(todayInSP(new Date("2026-11-07T01:00:00Z"))).toBe("2026-11-06");
  });
});
