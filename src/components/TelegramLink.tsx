"use client";

import { useState, useTransition } from "react";
import { createTelegramCodeAction } from "@/app/actions";

export default function TelegramLink({ linked, botUsername }: { linked: boolean; botUsername: string | null }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();

  function generate() {
    setError("");
    start(async () => {
      const res = await createTelegramCodeAction();
      if (res.code) setCode(res.code);
      else setError(res.error ?? "Tente de novo.");
    });
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row-between">
        <span>{linked ? "Telegram ligado" : "Telegram ainda não ligado"}</span>
        <button type="button" className="btn small secondary" onClick={generate} disabled={busy}>
          {linked ? "Ligar de novo" : "Ligar Telegram"}
        </button>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      {code && (
        <div className="info-box">
          <span className="small">Abra o bot{botUsername ? ` @${botUsername}` : ""} no Telegram e envie:</span>
          <span className="code">/start {code}</span>
          <span className="small">O código vale por 15 minutos.</span>
        </div>
      )}
    </div>
  );
}
