# Contas da Casa

App para o casal agendar despesas, receber aviso no Telegram um dia antes do vencimento e acompanhar os gastos.

**O que faz**
- Despesa única, mensal (dia fixo ou N-ésimo dia útil) ou parcelada no cartão (até 5 cartões, com fechamento e vencimento).
- Valor variável (energia, água): o aviso pergunta o valor e você responde no Telegram.
- Cada vencimento é pendente, pago ou atrasado. Só o que foi pago entra nos gastos.
- Opção "Paguei com juros": o painel mostra os juros pagos.
- Painel por mês, com "Custo do mês" (pelo vencimento) e "Fluxo de caixa" (pelo dia do pagamento).
- Categoria sugerida por regras (palavras) e, se nada servir, pelo Gemini (só o nome da despesa é enviado).

## Colocar no ar

### 1. Código no GitHub
Descompacte, entre na pasta e rode:

```bash
git init -b main
git add .
git commit -m "Contas da Casa"
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

### 2. Banco (Supabase)
O banco já foi criado no projeto `nllbmxuneynhcvibbitf`. Se precisar refazer em outro projeto, rode os arquivos de `supabase/migrations`, em ordem, no SQL Editor.

Crie os logins de vocês dois em **Authentication > Users > Add user**, marcando **Auto Confirm User**. O app usa e-mail e senha, sem envio de e-mail.

### 3. Vercel
Importe o repositório. Em **Settings > Environment Variables**, preencha as variáveis de `.env.example`:

| Variável | De onde vem |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase, Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase, Project Settings > API (chave secreta) |
| `TELEGRAM_BOT_TOKEN` e `TELEGRAM_BOT_USERNAME` | BotFather |
| `TELEGRAM_WEBHOOK_SECRET` e `CRON_SECRET` | dois textos longos e aleatórios que você inventa |
| `GEMINI_API_KEY` e `GEMINI_MODEL` | Google AI Studio (modelo: `gemini-flash-latest`) |
| `APP_URL` | endereço do app na Vercel, sem barra no final |

Faça o deploy. Depois de preenchida a `APP_URL`, redeploy.

### 4. Ligar o bot ao app
Abra uma vez no navegador:

```
https://SEU_APP.vercel.app/api/telegram/setup?secret=SEU_CRON_SECRET
```

A resposta deve conter `"ok": true`.

### 5. Primeiro uso
1. Entre com seu e-mail e senha. O app pede para criar a casa.
2. Em **Ajustes**, cadastre os cartões (nome, dia de fechamento, dia de vencimento).
3. Em **Ajustes > Ligar Telegram**, copie o código e envie `/start CÓDIGO` ao bot.
4. Copie o código de convite da casa. A outra pessoa entra com o login dela e informa esse código.

## Avisos automáticos
A rotina `/api/cron/daily` roda todo dia às 9h de Brasília (no plano gratuito da Vercel o horário pode variar até uma hora). Ela:
- gera os próximos vencimentos das despesas mensais;
- avisa no Telegram o que vence amanhã (ou pergunta o valor, quando ele varia);
- cobra de novo, por até 5 dias, o que venceu e continua pendente.

## Regras de cálculo
- Dia útil: segunda a sexta, fora feriados nacionais (Carnaval e Corpus Christi não contam como feriado).
- Fatura do cartão: compra feita no dia do fechamento ou depois entra na fatura seguinte.
- Parcelas: a última absorve os centavos de diferença (2.500,00 em 12x = 11 de 208,33 e uma de 208,37).
- Dia 29, 30 ou 31 em mês mais curto vira o último dia do mês.

## Desenvolvimento

```bash
cp .env.example .env.local   # preencha
npm install
npm test        # testes dos cálculos
npm run dev
```
