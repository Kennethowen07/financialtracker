import { describe, expect, test } from "vitest";
import { buatToken, passwordCocok, tokenSah, UMUR_SESI_DETIK } from "./sesi";

const RAHASIA = "rahasia-uji";

describe("sesi login", () => {
  test("token baru sah", async () => {
    const token = await buatToken(Date.now(), RAHASIA);
    expect(await tokenSah(token, Date.now(), RAHASIA)).toBe(true);
  });

  test("token kedaluwarsa setelah 30 hari", async () => {
    const dibuat = Date.UTC(2026, 9, 1);
    const token = await buatToken(dibuat, RAHASIA);
    expect(await tokenSah(token, dibuat + (UMUR_SESI_DETIK - 60) * 1000, RAHASIA)).toBe(true);
    expect(await tokenSah(token, dibuat + (UMUR_SESI_DETIK + 60) * 1000, RAHASIA)).toBe(false);
  });

  test("token yang diubah atau ditandatangani kunci lain ditolak", async () => {
    const token = await buatToken(Date.now(), RAHASIA);
    const [exp, tanda] = token.split(".");
    expect(await tokenSah(`${Number(exp) + 999999}.${tanda}`, Date.now(), RAHASIA)).toBe(false);
    expect(await tokenSah(token, Date.now(), "kunci-lain")).toBe(false);
    expect(await tokenSah("asal-asalan", Date.now(), RAHASIA)).toBe(false);
    expect(await tokenSah(undefined, Date.now(), RAHASIA)).toBe(false);
  });

  test("password", async () => {
    expect(await passwordCocok("benar123", "benar123")).toBe(true);
    expect(await passwordCocok("salah", "benar123")).toBe(false);
    expect(await passwordCocok("", "benar123")).toBe(false);
    expect(await passwordCocok("apa saja", "")).toBe(false);
  });
});
