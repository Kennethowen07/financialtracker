import { describe, expect, test } from "vitest";
import { buatDbUji } from "./db-uji";
import { hashIp, pakaiKuota, sisaKuota } from "./kuota";

describe("kuota demo", () => {
  test("2 panggilan per IP per hari", async () => {
    const db = await buatDbUji();
    expect(await sisaKuota(db, "a", "2026-10-15")).toBe(2);
    expect(await pakaiKuota(db, "a", "2026-10-15")).toBe(true);
    expect(await pakaiKuota(db, "a", "2026-10-15")).toBe(true);
    expect(await pakaiKuota(db, "a", "2026-10-15")).toBe(false);
    expect(await sisaKuota(db, "a", "2026-10-15")).toBe(0);
    // IP lain dan hari lain punya kuota sendiri
    expect(await sisaKuota(db, "b", "2026-10-15")).toBe(2);
    expect(await pakaiKuota(db, "a", "2026-10-16")).toBe(true);
  });

  test("batas total harian untuk semua pengunjung", async () => {
    const db = await buatDbUji();
    expect(await pakaiKuota(db, "a", "2026-10-15", 3)).toBe(true);
    expect(await pakaiKuota(db, "b", "2026-10-15", 3)).toBe(true);
    expect(await pakaiKuota(db, "c", "2026-10-15", 3)).toBe(true);
    expect(await pakaiKuota(db, "d", "2026-10-15", 3)).toBe(false);
    expect(await sisaKuota(db, "d", "2026-10-15", 3)).toBe(0);
  });

  test("IP disimpan sebagai hash", async () => {
    const h = await hashIp("203.0.113.5");
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(h).not.toContain("203");
    expect(await hashIp("203.0.113.5")).toBe(h);
  });
});
