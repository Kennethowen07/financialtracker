import { describe, expect, test } from "vitest";
import { bacaToken, buatToken, UMUR_SESI_DETIK } from "./sesi";

const RAHASIA = "rahasia-uji";

describe("sesi login", () => {
  test("token baru sah dan berisi id pengguna", async () => {
    const token = await buatToken(7, Date.now(), RAHASIA);
    expect(await bacaToken(token, Date.now(), RAHASIA)).toBe(7);
  });

  test("token kedaluwarsa setelah 30 hari", async () => {
    const dibuat = Date.UTC(2026, 9, 1);
    const token = await buatToken(7, dibuat, RAHASIA);
    expect(await bacaToken(token, dibuat + (UMUR_SESI_DETIK - 60) * 1000, RAHASIA)).toBe(7);
    expect(await bacaToken(token, dibuat + (UMUR_SESI_DETIK + 60) * 1000, RAHASIA)).toBeNull();
  });

  test("id, waktu, atau tanda tangan yang diubah ditolak", async () => {
    const token = await buatToken(7, Date.now(), RAHASIA);
    const [, exp, tanda] = token.split(".");
    // Mengganti id ke akun lain (mis. admin) dengan tanda tangan lama → ditolak.
    expect(await bacaToken(`1.${exp}.${tanda}`, Date.now(), RAHASIA)).toBeNull();
    expect(await bacaToken(`7.${Number(exp) + 999999}.${tanda}`, Date.now(), RAHASIA)).toBeNull();
    expect(await bacaToken(token, Date.now(), "kunci-lain")).toBeNull();
    expect(await bacaToken("asal-asalan", Date.now(), RAHASIA)).toBeNull();
    expect(await bacaToken(undefined, Date.now(), RAHASIA)).toBeNull();
  });

  test("tanpa kunci (SESSION_SECRET kosong di production) tidak ada token yang sah", async () => {
    const token = await buatToken(7, Date.now(), RAHASIA);
    expect(await bacaToken(token, Date.now(), "")).toBeNull();
    await expect(buatToken(7, Date.now(), "")).rejects.toThrow("SESSION_SECRET");
  });
});
