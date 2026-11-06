"use client";

import { useEffect, useState } from "react";
import {
  biometricEnabled, biometricSupported, disableBiometric, disableLock, enableBiometric, lockEnabled, setPin,
} from "@/lib/applock";

export default function LockSettings() {
  const [ready, setReady] = useState(false);
  const [on, setOn] = useState(false);
  const [bio, setBio] = useState(false);
  const [canBio, setCanBio] = useState(false);
  const [editing, setEditing] = useState(false);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [msg, setMsg] = useState("");

  function refresh() {
    setOn(lockEnabled());
    setBio(biometricEnabled());
  }
  useEffect(() => {
    refresh();
    setCanBio(biometricSupported());
    setReady(true);
  }, []);

  async function save() {
    if (!/^\d{4}$/.test(p1)) return setMsg("O PIN tem 4 números.");
    if (p1 !== p2) return setMsg("Os dois PINs não são iguais.");
    await setPin(p1);
    setP1(""); setP2(""); setEditing(false); setMsg("PIN salvo.");
    refresh();
  }

  async function toggleBio() {
    if (bio) { disableBiometric(); setMsg("Face ID desligado."); }
    else {
      const ok = await enableBiometric();
      setMsg(ok ? "Face ID ligado." : "Não consegui ligar o Face ID neste aparelho. O PIN continua valendo.");
    }
    refresh();
  }

  if (!ready) return null;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="small">
        Pede o PIN {canBio ? "ou o Face ID " : ""}quando você abre o app. Vale só neste aparelho.
      </div>
      {msg && <div className="hint-box small" role="status">{msg}</div>}

      {editing ? (
        <div className="stack" style={{ gap: 10 }}>
          <input className="input lg" type="password" inputMode="numeric" maxLength={4} placeholder="Novo PIN (4 números)" value={p1} onChange={(e) => setP1(e.target.value.replace(/\D/g, ""))} aria-label="Novo PIN" />
          <input className="input lg" type="password" inputMode="numeric" maxLength={4} placeholder="Repita o PIN" value={p2} onChange={(e) => setP2(e.target.value.replace(/\D/g, ""))} aria-label="Repita o PIN" />
          <div className="row-between">
            <button type="button" className="btn small secondary" onClick={() => { setEditing(false); setP1(""); setP2(""); }}>Cancelar</button>
            <button type="button" className="btn small" onClick={save}>Salvar PIN</button>
          </div>
        </div>
      ) : (
        <div className="row-between">
          <span>{on ? "Bloqueio ligado" : "Bloqueio desligado"}</span>
          <button type="button" className="btn small secondary" onClick={() => { setMsg(""); setEditing(true); }}>
            {on ? "Trocar PIN" : "Criar PIN"}
          </button>
        </div>
      )}

      {on && !editing && canBio && (
        <div className="row-between">
          <span>{bio ? "Face ID ligado" : "Face ID desligado"}</span>
          <button type="button" className="btn small secondary" onClick={toggleBio}>{bio ? "Desligar" : "Ligar Face ID"}</button>
        </div>
      )}
      {on && !editing && (
        <button type="button" className="btn small danger" style={{ alignSelf: "flex-start" }} onClick={() => { disableLock(); setMsg("Bloqueio desligado."); refresh(); }}>
          Desligar bloqueio
        </button>
      )}
    </div>
  );
}
