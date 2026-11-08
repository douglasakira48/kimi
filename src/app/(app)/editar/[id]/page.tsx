import Link from "next/link";
import { notFound } from "next/navigation";
import EditExpenseForm from "@/components/EditExpenseForm";
import { loadLookups, toExpense } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: row } = await sb.from("expenses").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const expense = toExpense(row);
  const lk = await loadLookups(sb);
  const cards = Array.from(lk.cards.values());
  const creditName = expense.payment_method === "card" && expense.card_id ? lk.cards.get(expense.card_id)?.name ?? "Cartão" : null;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row-between" style={{ marginLeft: -12 }}>
        <Link href="/" className="check" aria-label="Fechar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
        <h1 style={{ flex: 1, fontSize: 24 }}>Editar despesa</h1>
      </div>
      <EditExpenseForm
        expense={{
          id: expense.id,
          name: expense.name,
          categoryId: expense.category_id,
          payment: expense.payment_method,
          cardId: expense.card_id,
          amount: expense.amount,
          recurrence: expense.recurrence,
          isVariable: expense.is_variable,
        }}
        categories={Array.from(lk.categories.values())}
        debitCards={cards.filter((c) => c.kind === "debit").map((c) => ({ id: c.id, name: c.name }))}
        creditName={creditName}
      />
    </div>
  );
}
