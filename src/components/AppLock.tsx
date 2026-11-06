"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions";
import {
  GRACE_MS, biometricEnabled, checkPin, disableLock, lockEnabled, verifyBiometric, waitSeconds,
} from "@/lib/applock";
import Icon from "./Icon";

export default function AppLock({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [bio, setBio] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  const lock = useCallback(() => {
    if (!lockEnabled()) return;
    setPin("");
    setError("");
    setBio(biometricEnabled());
    setLocked(true);
  }, []);

  // Ao abrir o app, já nasce bloqueado (antes de pintar a tela).
  useLayoutEffect(() => { lock(); }, [lock]);

  // Ao voltar para o app depois de um tempo em segundo plano, bloqueia de novo.
  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current !== null && Date.now() - hiddenAt.current > GRACE_MS) {
        lock();
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [lock]);

  const tryBio = useCallback(async () => {
    if (await verifyBiometric()) setLocked(false);
  }, []);

  // Tenta o Face ID logo que a tela de bloqueio aparece (se o iOS exigir toque, o botão resolve).
  useEffect(() => {
    if (locked && bio) void tryBio();
  }, [locked, bio, tryBio]);

  async function submit(value: string) {
    const wait = waitSeconds();
    if (wait > 0) { setError(`Muitas tentativas. Espere ${wait}s.`); setPin(""); return; }
    if (await checkPin(value)) {
      setLocked(false);
      setPin("");
      setError("");
    } else {
      setPin("");
      const w = waitSeconds();
      setError(w > 0 ? `Muitas tentativas. Espere ${w}s.` : "PIN incorreto.");
    }
  }

  function onChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    setPin(digits);
    if (digits.length === 4) void submit(digits);
  }

  async function forgot() {
    disableLock();
    await signOutAction();
  }

  return (
    <>
      <div aria-hidden={locked} style={locked ? { visibility: "hidden" } : undefined}>{children}</div>
      {locked && (
        <div className="lock" role="dialog" aria-label="App bloqueado">
          <div className="logo"><Icon name="logo" size={72} /></div>
          <h1 style={{ fontSize: 24 }}>Contas da Casa</h1>
          <div className="stack" style={{ gap: 14, width: "100%", maxWidth: 280 }}>
            <label htmlFor="pin" className="muted" style={{ textAlign: "center" }}>Digite o PIN</label>
            <input
              id="pin" className="input lg" type="password" inputMode="numeric" autoComplete="off" autoFocus
              maxLength={4} value={pin} onChange={(e) => onChange(e.target.value)}
              style={{ textAlign: "center", letterSpacing: "0.6em", fontSize: 28 }}
            />
            {error && <div className="error" role="alert">{error}</div>}
            {bio && <button type="button" className="btn" onClick={tryBio}>Usar Face ID</button>}
            <button type="button" className="btn small secondary" style={{ alignSelf: "center" }} onClick={forgot}>
              Esqueci o PIN (sair)
            </button>
          </div>
        </div>
      )}
    </>
  );
}
