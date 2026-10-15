import { describe, expect, test } from "vitest";
import { keBase64Url } from "./base64url";
import { periksaIdToken } from "./google";

const CLIENT = "client-uji.apps.googleusercontent.com";
const SEKARANG = Date.UTC(2026, 9, 15, 5);

/** id_token buatan untuk test (tanda tangan tidak diperiksa, lihat komentar di google.ts). */
function token(isi: Record<string, unknown>): string {
  const bagian = (o: object) => keBase64Url(new TextEncoder().encode(JSON.stringify(o)));
  return `${bagian({ alg: "RS256" })}.${bagian(isi)}.tanda`;
}

const sah = {
  iss: "https://accounts.google.com",
  aud: CLIENT,
  exp: SEKARANG / 1000 + 3600,
  sub: "1234567890",
  email: "Andi@Gmail.com",
  email_verified: true,
  name: "Andi Wijaya",
};

describe("periksa id_token Google", () => {
  test("token sah → profil (email huruf kecil)", () => {
    expect(periksaIdToken(token(sah), CLIENT, SEKARANG)).toEqual({
      googleId: "1234567890",
      email: "andi@gmail.com",
      nama: "Andi Wijaya",
    });
  });

  test("tanpa nama → nama diambil dari email", () => {
    expect(periksaIdToken(token({ ...sah, name: undefined }), CLIENT, SEKARANG)?.nama).toBe("andi");
  });

  test.each([
    ["penerbit lain", { iss: "https://evil.example" }],
    ["untuk aplikasi lain", { aud: "aplikasi-lain" }],
    ["sudah kedaluwarsa", { exp: SEKARANG / 1000 - 1 }],
    ["email belum diverifikasi", { email_verified: false }],
    ["tanpa sub", { sub: "" }],
  ])("ditolak: %s", (_nama, ubah) => {
    expect(periksaIdToken(token({ ...sah, ...ubah }), CLIENT, SEKARANG)).toBeNull();
  });

  test("token rusak ditolak", () => {
    expect(periksaIdToken("bukan-token", CLIENT, SEKARANG)).toBeNull();
    expect(periksaIdToken("a.b.c", CLIENT, SEKARANG)).toBeNull();
    expect(periksaIdToken(token(sah), "", SEKARANG)).toBeNull();
  });
});
