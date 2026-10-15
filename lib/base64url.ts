// Base64 versi URL (tanpa + / =), dipakai untuk token sesi dan token Google.

export function keBase64Url(data: ArrayBuffer | Uint8Array): string {
  let s = "";
  for (const b of new Uint8Array(data)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function dariBase64Url(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const biner = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(biner, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** String acak yang aman untuk URL, mis. untuk state OAuth. */
export function acak(jumlahByte = 32): string {
  return keBase64Url(crypto.getRandomValues(new Uint8Array(jumlahByte)));
}
