import { describe, expect, test } from "vitest";
import { bacaTanggal, bulanSebelumnya, hariIni } from "./tanggal";

// 15 Oktober 2026, 12.00 WIB
const SEKARANG = new Date("2026-10-15T05:00:00Z");
const tgl = (teks: string) => bacaTanggal(teks, SEKARANG);

describe("zona waktu Asia/Jakarta, batas hari 00.00", () => {
  test("23.30 WIB masih hari yang sama", () => {
    expect(hariIni(new Date("2026-10-15T16:30:00Z"))).toBe("2026-10-15");
  });
  test("00.10 WIB sudah hari berikutnya walau di UTC masih kemarin", () => {
    expect(hariIni(new Date("2026-10-15T17:10:00Z"))).toBe("2026-10-16");
  });
});

describe("bacaTanggal", () => {
  test.each([
    ["kemarin", "2026-10-14"],
    ["kmrn", "2026-10-14"],
    ["kemarin lusa", "2026-10-13"],
    ["3 hari lalu", "2026-10-12"],
    ["hari ini", "2026-10-15"],
    ["tanggal 3", "2026-10-03"],
    ["tgl 15", "2026-10-15"],
    ["tgl. 1", "2026-10-01"],
    ["3 okt", "2026-10-03"],
    ["3 oktober 2026", "2026-10-03"],
    ["3/10", "2026-10-03"],
    ["03-10-2026", "2026-10-03"],
  ])("%s → %s", (teks, tanggal) => {
    expect(tgl(`${teks} makan 25000`)).toMatchObject({ ok: true, tanggal, sisa: "makan 25000" });
  });

  test("tanggal lewat hari ini tanpa bulan → bulan lalu", () => {
    expect(tgl("tanggal 20 makan 25000")).toMatchObject({ ok: true, tanggal: "2026-09-20" });
  });

  test("tanggal 31 di bulan lalu yang cuma 30 hari → tidak valid", () => {
    expect(tgl("tanggal 31 makan 25000")).toMatchObject({ ok: false, alasan: "tanggal_tidak_valid" });
  });

  test("tanggal + bulan tanpa tahun yang lewat hari ini → tahun lalu", () => {
    expect(tgl("3 des kado 100000")).toMatchObject({ ok: true, tanggal: "2025-12-03" });
  });

  test("masa depan dengan tahun eksplisit ditolak", () => {
    expect(tgl("3 des 2026 kado 100000")).toMatchObject({ ok: false, alasan: "tanggal_masa_depan" });
    expect(tgl("besok makan")).toMatchObject({ ok: false, alasan: "tanggal_masa_depan" });
  });

  test("tanggal tidak ada → hari ini, dariTeks false", () => {
    expect(tgl("makan 25000")).toEqual({ ok: true, tanggal: "2026-10-15", dariTeks: false, sisa: "makan 25000" });
  });

  test("bulanSebelumnya", () => {
    expect(bulanSebelumnya("2026-10")).toBe("2026-09");
    expect(bulanSebelumnya("2026-01")).toBe("2025-12");
  });
});
