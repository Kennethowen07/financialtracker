import { describe, expect, test } from "vitest";
import { olahHasilMutasi, tandaiPeriksa, type ItemPeriksa } from "./mutasi";

const HARI_INI = "2026-10-18";

const json = (transaksi: unknown[]) => JSON.stringify({ transaksi });
const baris = (lain: Record<string, unknown> = {}) => ({
  tanggal: "2026-10-16", keterangan: "Koka Ramen", nominal: 36000, arah: "keluar",
  golongan: "belanja", sumber: "BCA", terpotong: false, pending: false, ...lain,
});

describe("olahHasilMutasi: validasi hasil Gemini", () => {
  test("baris yang sah diteruskan apa adanya", () => {
    expect(olahHasilMutasi(json([baris()]), HARI_INI)).toEqual([
      { tanggal: "2026-10-16", keterangan: "Koka Ramen", nominal: 36000, arah: "keluar", golongan: "belanja", sumber: "BCA", terpotong: false, pending: false },
    ]);
  });

  test("baris yang tidak masuk akal dibuang", () => {
    const hasil = olahHasilMutasi(json([
      baris({ tanggal: "2026-10-19" }), // masa depan
      baris({ tanggal: "2026-02-30" }), // tanggal tidak ada
      baris({ tanggal: "16/10/2026" }), // format salah
      baris({ nominal: 0 }),
      baris({ nominal: -5000 }),
      baris({ nominal: "36000" }), // bukan angka
      baris({ keterangan: "  " }),
      baris({ keterangan: "Es Time" }), // satu-satunya yang sah
    ]), HARI_INI);
    expect(hasil.map((b) => b.keterangan)).toEqual(["Es Time"]);
  });

  test("nilai aneh dirapikan: golongan tak dikenal → belanja, nominal pecahan dibulatkan", () => {
    const [b] = olahHasilMutasi(json([baris({ golongan: "lain", nominal: 13900.4, arah: "MASUK", keterangan: "  Indomaret  " })]), HARI_INI);
    expect(b).toMatchObject({ golongan: "belanja", nominal: 13900, arah: "keluar", keterangan: "Indomaret" });
  });

  test("JSON rusak atau tanpa daftar → kosong", () => {
    expect(olahHasilMutasi("bukan json", HARI_INI)).toEqual([]);
    expect(olahHasilMutasi("{}", HARI_INI)).toEqual([]);
  });
});

function item(lain: Partial<ItemPeriksa> = {}): ItemPeriksa {
  return {
    tanggal: "2026-10-17", keterangan: "Grab", nominal: 53500, arah: "keluar", golongan: "belanja", sumber: "blu",
    terpotong: false, pending: false, kategori: null, jenis: "pengeluaran", tercatat: false, gambar: 0, ...lain,
  };
}

describe("tandaiPeriksa: centang awal", () => {
  test("transaksi biasa dicentang", () => {
    expect(tandaiPeriksa([item()])[0]).toMatchObject({ centang: true, alasan: null });
  });

  test("top up / isi saldo tidak dicentang", () => {
    const [b] = tandaiPeriksa([item({ golongan: "isi_saldo", keterangan: "Isi Saldo", arah: "masuk", sumber: "ShopeePay" })]);
    expect(b).toMatchObject({ centang: false, alasan: "isi_saldo" });
  });

  test("sudah tercatat tidak dicentang", () => {
    expect(tandaiPeriksa([item({ tercatat: true })])[0]).toMatchObject({ centang: false, alasan: "tercatat" });
  });

  test("sama dengan screenshot lain (blu Grab vs Grab GrabFood): yang kedua tidak dicentang", () => {
    const hasil = tandaiPeriksa([item(), item({ keterangan: "GrabFood", sumber: "Grab", gambar: 1 })]);
    expect(hasil.map((b) => [b.keterangan, b.centang, b.alasan, b.samaDengan])).toEqual([
      ["Grab", true, null, undefined],
      ["GrabFood", false, "dobel", "blu"],
    ]);
  });

  test("nominal sama di screenshot yang SAMA bukan dobel (empat transfer GoPay Rp100.000)", () => {
    const transfer = [1, 2, 3, 4].map((n) => item({ keterangan: `Transfer ${n}`, nominal: 100000, golongan: "transfer", sumber: "GoPay" }));
    expect(tandaiPeriksa(transfer).map((b) => b.centang)).toEqual([true, true, true, true]);
  });

  test("dua screenshot yang bertumpuk karena di-scroll: baris yang terulang tidak dicentang", () => {
    const a = item({ keterangan: "Transfer A", nominal: 100000, sumber: "GoPay", gambar: 0 });
    const b = item({ keterangan: "Transfer A", nominal: 100000, sumber: "GoPay", gambar: 1 });
    expect(tandaiPeriksa([a, b]).map((x) => x.centang)).toEqual([true, false]);
  });

  test("nominal sama di hari berbeda atau arah berbeda bukan dobel", () => {
    const hasil = tandaiPeriksa([item(), item({ tanggal: "2026-10-16", gambar: 1 }), item({ arah: "masuk", gambar: 2 })]);
    expect(hasil.map((b) => b.centang)).toEqual([true, true, true]);
  });
});
