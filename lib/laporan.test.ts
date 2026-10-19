import { describe, expect, test } from "vitest";
import { indeksMinggu, ringkas } from "./laporan";
import type { Transaksi } from "./transaksi";

let id = 0;
function trx(tanggal: string, nominal: number, jenis: Transaksi["jenis"] = "pengeluaran", lain: Partial<Transaksi> = {}): Transaksi {
  return {
    id: ++id,
    tanggal,
    nominal,
    jenis,
    arah: jenis === "pemasukan" ? "masuk" : "keluar",
    kategori: { id: 1, nama: "Makanan & Minuman", ikon: "makan" },
    deskripsi: "makan",
    sumber: "memori",
    caraInput: "ketik",
    dikoreksi: false,
    perluTanya: false,
    dibuatPada: "2026-10-01T00:00:00Z",
    ...lain,
  };
}

describe("indeksMinggu (1–7, 8–14, 15–21, 22–akhir)", () => {
  test.each([
    ["2026-10-01", 0], ["2026-10-07", 0], ["2026-10-08", 1], ["2026-10-14", 1],
    ["2026-10-15", 2], ["2026-10-21", 2], ["2026-10-22", 3], ["2026-10-31", 3],
  ])("%s → W%i", (tanggal, indeks) => {
    expect(indeksMinggu(tanggal)).toBe(indeks);
  });
});

describe("ringkas", () => {
  const HARI_INI = "2026-10-15";

  test("total, sisa, usaha tidak ikut pengeluaran, investasi keluar & masuk", () => {
    const r = ringkas("2026-10", [
      trx("2026-10-01", 25000),
      trx("2026-10-15", 15000),
      trx("2026-10-01", 6000000, "pemasukan", { kategori: { id: 13, nama: "Gaji", ikon: "gaji" } }),
      trx("2026-10-02", 3000000, "usaha", { kategori: null }),
      trx("2026-10-03", 1000000, "investasi", { arah: "keluar" }),
      trx("2026-10-04", 668497, "investasi", { arah: "masuk" }),
    ], [], HARI_INI);

    expect(r).toMatchObject({
      pengeluaran: 40000,
      masuk: 6000000,
      sisa: 5960000,
      usaha: 3000000,
      investasiKeluar: 1000000,
      investasiMasuk: 668497,
      hariIni: 15000,
      mingguBerjalan: 2,
    });
  });

  test("week 4 berisi tanggal 22 sampai akhir bulan", () => {
    const r = ringkas("2026-10", [trx("2026-10-22", 1000), trx("2026-10-31", 2000), trx("2026-10-21", 500)], [], "2026-10-31");
    expect(r.minggu.map((m) => m.total)).toEqual([0, 0, 500, 3000]);
    expect(r.minggu[3]).toMatchObject({ dari: 22, sampai: 31 });
  });

  test("perubahan dibanding periode yang sama bulan lalu (tgl 1 s/d hari ini)", () => {
    const lalu = [trx("2026-09-10", 100000), trx("2026-09-20", 999999)]; // tgl 20 tidak dihitung (hari ini tgl 15)
    const r = ringkas("2026-10", [trx("2026-10-05", 112800)], lalu, HARI_INI);
    expect(r.pengeluaranBulanLalu).toBe(100000);
    expect(r.perubahanPersen).toBe(12.8);
  });

  test("bulan yang sudah lewat dibandingkan penuh, tanpa 'hari ini'", () => {
    const r = ringkas("2026-09", [trx("2026-09-30", 200)], [trx("2026-08-31", 100)], HARI_INI);
    expect(r.perubahanPersen).toBe(100);
    expect(r.hariIni).toBeNull();
    expect(r.mingguBerjalan).toBeNull();
  });

  test("per kategori urut terbesar, yang belum dikategorikan dikumpulkan", () => {
    const r = ringkas("2026-10", [
      trx("2026-10-01", 1000),
      trx("2026-10-01", 5000, "pengeluaran", { kategori: { id: 4, nama: "Belanja", ikon: "belanja" } }),
      trx("2026-10-02", 700, "pengeluaran", { kategori: null, perluTanya: true }),
    ], [], HARI_INI);
    expect(r.perKategori.map((k) => [k.nama, k.total])).toEqual([
      ["Belanja", 5000], ["Makanan & Minuman", 1000], ["Belum dikategorikan", 700],
    ]);
  });

  test("paling sering dihitung dari deskripsi yang dinormalisasi", () => {
    const r = ringkas("2026-10", [
      trx("2026-10-01", 25000, "pengeluaran", { deskripsi: "Rasela" }),
      trx("2026-10-02", 25500, "pengeluaran", { deskripsi: "rasela" }),
      trx("2026-10-02", 20000, "pengeluaran", { deskripsi: "nasgor" }),
    ], [], HARI_INI);
    expect(r.palingSering[0]).toEqual({ deskripsi: "rasela", kali: 2, total: 50500 });
  });
});
