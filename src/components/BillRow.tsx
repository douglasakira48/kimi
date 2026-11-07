import Link from "next/link";
import Icon, { categoryIconName, paymentIconName } from "@/components/Icon";
import { paymentLabel, type Lookups } from "@/lib/data";
import { formatCurto, formatData, parseYMD } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { Bill } from "@/lib/types";

function diasAtraso(due: string, today: string): number {
  const a = parseYMD(due);
  const b = parseYMD(today);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

export default function BillRow({ bill, lk, today, last }: { bill: Bill; lk: Lookups; today: string; last?: number }) {
  const expense = lk.expenses.get(bill.expense_id);
  if (!expense) return null;
  const paid = bill.status === "paid";
  const late = !paid && bill.due_date < today;
  const atraso = diasAtraso(bill.due_date, today);

  const extras: string[] = [];
  if (expense.business_day && expense.recurrence === "monthly") extras.push(`${expense.business_day}º dia útil`);
  if (bill.installment_no && expense.installments) extras.push(`parcela ${bill.installment_no} de ${expense.installments}`);

  let meta = formatCurto(bill.due_date);
  if (paid) meta = bill.paid_on ? `Pago em ${formatData(bill.paid_on)}` : "Pago";
  else if (late) meta = atraso === 1 ? "Venceu ontem" : `Venceu há ${atraso} dias`;
  if (extras.length) meta += `, ${extras.join(", ")}`;

  return (
    <div className="bill">
      <div className="tile"><Icon name={categoryIconName(expense.category_id ? lk.categories.get(expense.category_id)?.name : null)} size={20} /></div>
      <Link
        href={`/pagar/${bill.id}`}
        className="check"
        aria-label={paid ? `${expense.name}, paga` : `Marcar ${expense.name} como paga`}
      >
        {paid ? (
          <span className="check-ok">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
          </span>
        ) : (
          <span className="dot" />
        )}
      </Link>
      <div className="bill-text">
        <span className="bill-name">{expense.name}</span>
        <span className={`bill-meta ${late ? "late" : ""}`}>{meta}</span>
      </div>
      <div className="bill-value">
        {bill.amount === null ? (
          <>
            <Link href={`/pagar/${bill.id}`} className="chip-ask">Informar valor</Link>
            {last !== undefined && <span className="bill-meta num">último {formatBRL(last)}</span>}
          </>
        ) : (
          <span className="bill-amount">{formatBRL(bill.amount + (paid ? bill.interest : 0))}</span>
        )}
        <span className="bill-meta pay-ico"><Icon name={paymentIconName(expense.payment_method)} size={14} />{paymentLabel(expense, lk.cards)}</span>
      </div>
    </div>
  );
}
