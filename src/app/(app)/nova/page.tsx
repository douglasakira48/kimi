import Link from "next/link";
import NewExpenseForm from "@/components/NewExpenseForm";
import { loadLookups } from "@/lib/data";
import { todayInSP } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export default async function NewExpensePage() {
  const sb = await createClient();
  const lk = await loadLookups(sb);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row-between" style={{ marginLeft: -12 }}>
        <Link href="/" className="check" aria-label="Fechar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
        <h1 style={{ flex: 1, fontSize: 24 }}>Nova despesa</h1>
      </div>
      <NewExpenseForm
        categories={Array.from(lk.categories.values())}
        cards={Array.from(lk.cards.values())}
        today={todayInSP()}
      />
    </div>
  );
}
