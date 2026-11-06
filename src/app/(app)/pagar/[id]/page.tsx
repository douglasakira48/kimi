import Link from "next/link";
import { notFound } from "next/navigation";
import PayForm from "@/components/PayForm";
import { reopenBillAction } from "@/app/actions";
import { toBill, toExpense } from "@/lib/data";
import { formatCurto, formatData, todayInSP } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

const ERROS: Record<string, string> = {
  valor: "Informe o valor da conta, por exemplo 96,40.",
  juros: "Informe o valor dos juros, por exemplo 2,38.",
  salvar: "Não consegui salvar. Tente de novo.",
};

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const sb = await createClient();

  const { data: row } = await sb.from("bills").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const bill = toBill(row);
  const { data: e } = await sb.from("expenses").select("*").eq("id", bill.expense_id).single();
  const expense = toExpense(e!);
  const today = todayInSP();
  const late = bill.status === "pending" && bill.due_date < today;

  return (
    <div className="stack" style={{ gap: 26 }}>
      <Link href="/" className="check" aria-label="Fechar" style={{ marginLeft: -12 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </Link>

      <div className="stack-sm">
        <h1>{bill.status === "paid" ? expense.name : `Pagar ${expense.name.toLowerCase()}`}</h1>
        <div className="muted" style={late ? { color: "var(--late)" } : undefined}>
          {late ? "Venceu em " : "Vence em "}
          {formatCurto(bill.due_date)}
          {bill.installment_no && expense.installments ? `, parcela ${bill.installment_no} de ${expense.installments}` : ""}
        </div>
      </div>

      {erro && ERROS[erro] && <div className="error" role="alert">{ERROS[erro]}</div>}

      {bill.status === "paid" ? (
        <div className="stack">
          <div className="info-box">
            <span style={{ fontWeight: 600 }}>Pago em {bill.paid_on ? formatData(bill.paid_on) : ""}</span>
            <span className="num">{formatBRL(bill.amount ?? 0)}</span>
            {bill.interest > 0 && <span className="small num">Mais {formatBRL(bill.interest)} de juros</span>}
          </div>
          <form action={reopenBillAction}>
            <input type="hidden" name="billId" value={bill.id} />
            <button type="submit" className="btn secondary">Desfazer pagamento</button>
          </form>
        </div>
      ) : (
        <PayForm
          billId={bill.id}
          today={today}
          defaultAmount={bill.amount !== null ? String(bill.amount).replace(".", ",") : ""}
        />
      )}
    </div>
  );
}
