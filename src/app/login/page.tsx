import Icon from "@/components/Icon";
import { signInAction } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="auth">
      <div className="stack-sm" style={{ alignItems: "flex-start", gap: 14 }}>
        <div className="logo"><Icon name="logo" size={30} /></div>
        <h1>Contas da Casa</h1>
      </div>
      <form action={signInAction} className="stack">
        {erro && <div className="error" role="alert">Usuário ou senha incorretos.</div>}
        <div className="field">
          <label htmlFor="user">Usuário</label>
          <div className="input-ico">
            <Icon name="usuario" size={20} />
            <input id="user" name="user" type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" required className="input lg" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <div className="input-ico">
            <Icon name="cadeado" size={20} />
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input lg" />
          </div>
        </div>
        <button type="submit" className="btn">Entrar</button>
      </form>
    </main>
  );
}
