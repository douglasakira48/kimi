import { redirect } from "next/navigation";
import { getMember } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { createHouseholdAction, joinHouseholdAction } from "../actions";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sb = await createClient();
  if (await getMember(sb)) redirect("/");
  const { erro } = await searchParams;

  return (
    <main className="auth">
      <h1>Bem-vindo</h1>
      {erro && <div className="error" role="alert">{erro}</div>}

      <form action={createHouseholdAction} className="stack">
        <h2>Primeira pessoa da casa</h2>
        <div className="field">
          <label htmlFor="displayName">Seu nome</label>
          <input id="displayName" name="displayName" required maxLength={30} className="input lg" />
        </div>
        <div className="field">
          <label htmlFor="name">Nome da casa</label>
          <input id="name" name="name" defaultValue="Nossa casa" maxLength={40} className="input lg" />
        </div>
        <button type="submit" className="btn">Criar a casa</button>
      </form>

      <form action={joinHouseholdAction} className="stack">
        <h2>Já existe uma casa</h2>
        <div className="field">
          <label htmlFor="displayName2">Seu nome</label>
          <input id="displayName2" name="displayName" required maxLength={30} className="input lg" />
        </div>
        <div className="field">
          <label htmlFor="code">Código de convite</label>
          <input id="code" name="code" required maxLength={20} autoCapitalize="none" className="input lg" />
        </div>
        <button type="submit" className="btn secondary">Entrar na casa</button>
      </form>
    </main>
  );
}
