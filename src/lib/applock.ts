/** Bloqueio local do app (PIN e Face ID/Touch ID). Fica só neste aparelho; não muda o login. */

const K = {
  pin: "cc.lock.pin",
  salt: "cc.lock.salt",
  cred: "cc.lock.cred",
  fails: "cc.lock.fails",
  until: "cc.lock.until",
} as const;

export const GRACE_MS = 15_000; // tempo em segundo plano antes de pedir de novo

function get(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function set(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* ignora */ }
}
function del(k: string) {
  try { localStorage.removeItem(k); } catch { /* ignora */ }
}

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  u.forEach((c) => (s += String.fromCharCode(c)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64 = (s: string) => {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
};

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return b64(await crypto.subtle.digest("SHA-256", data));
}

export function lockEnabled(): boolean {
  return !!get(K.pin);
}
export function biometricEnabled(): boolean {
  return !!get(K.cred);
}
export function biometricSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;
}

export async function setPin(pin: string) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  set(K.salt, salt);
  set(K.pin, await hashPin(pin, salt));
  del(K.fails);
  del(K.until);
}

export function waitSeconds(): number {
  const until = Number(get(K.until) ?? 0);
  return until > Date.now() ? Math.ceil((until - Date.now()) / 1000) : 0;
}

export async function checkPin(pin: string): Promise<boolean> {
  if (waitSeconds() > 0) return false;
  const salt = get(K.salt) ?? "";
  const ok = (await hashPin(pin, salt)) === get(K.pin);
  if (ok) {
    del(K.fails);
    del(K.until);
    return true;
  }
  const fails = Number(get(K.fails) ?? 0) + 1;
  set(K.fails, String(fails));
  if (fails >= 5) {
    set(K.until, String(Date.now() + 30_000));
    set(K.fails, "0");
  }
  return false;
}

export async function enableBiometric(): Promise<boolean> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Contas da Casa" },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "contas-da-casa", displayName: "Contas da Casa" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    set(K.cred, b64(cred.rawId));
    return true;
  } catch {
    return false;
  }
}

export async function verifyBiometric(): Promise<boolean> {
  const id = get(K.cred);
  if (!id) return false;
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: unb64(id) }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return !!res;
  } catch {
    return false;
  }
}

export function disableBiometric() {
  del(K.cred);
}

export function disableLock() {
  [K.pin, K.salt, K.cred, K.fails, K.until].forEach(del);
}
