import { signInAction } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="auth">
      <h1>Contas da Casa</h1>
      <form action={signInAction} className="stack">
        {erro && <div className="error" role="alert">E-mail ou senha incorretos.</div>}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input lg" />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input lg" />
        </div>
        <button type="submit" className="btn">Entrar</button>
      </form>
    </main>
  );
}
