import { describe, expect, test } from "vitest";
import { bacaInput, keNominal } from "./parser";

// 15 Oktober 2026, 12.00 WIB
const SEKARANG = new Date("2026-10-15T05:00:00Z");
const baca = (teks: string) => bacaInput(teks, SEKARANG);

function items(teks: string) {
  const hasil = baca(teks);
  if (!hasil.ok) throw new Error(`gagal membaca "${teks}": ${hasil.alasan}`);
  return hasil.items;
}

describe("format nominal", () => {
  test.each([
    ["25000", undefined, 25000],
    ["25.000", undefined, 25000],
    ["1.250.000", undefined, 1250000],
    ["25,000", undefined, 25000],
    ["25", "rb", 25000],
    ["25", "k", 25000],
    ["1,5", "jt", 1500000],
    ["2.5", "juta", 2500000],
  ])("%s %s → %d", (angka, akhiran, hasil) => {
    expect(keNominal(angka, akhiran)).toBe(hasil);
  });

  test("bentuk penulisan di kalimat", () => {
    expect(items("makan 25000")[0].nominal).toBe(25000);
    expect(items("makan 25.000")[0].nominal).toBe(25000);
    expect(items("makan 25rb")[0].nominal).toBe(25000);
    expect(items("makan 25 ribu")[0].nominal).toBe(25000);
    expect(items("makan 25k")[0].nominal).toBe(25000);
    expect(items("laptop 1,5jt")[0].nominal).toBe(1500000);
    expect(items("makan Rp25.000")[0].nominal).toBe(25000);
  });
});

describe("pemecahan per nominal", () => {
  test("kopi 15000 roti 25000 → dua transaksi", () => {
    expect(items("kopi 15000 roti 25000")).toEqual([
      { deskripsi: "kopi", nominal: 15000, jenisPasti: null },
      { deskripsi: "roti", nominal: 25000, jenisPasti: null },
    ]);
  });

  test("kopi roti 35000 → satu transaksi", () => {
    expect(items("kopi roti 35000")).toEqual([{ deskripsi: "kopi roti", nominal: 35000, jenisPasti: null }]);
  });

  test("pemisah koma, 'dan', dan baris baru dibuang dari deskripsi", () => {
    expect(items("bensin 30k, parkir 5000 dan tol 12rb\nkuota 100rb").map((i) => i.deskripsi)).toEqual([
      "bensin",
      "parkir",
      "tol",
      "kuota",
    ]);
  });

  test("angka kecil tanpa akhiran tetap bagian deskripsi", () => {
    expect(items("kopi 2 gelas 30rb")).toEqual([{ deskripsi: "kopi 2 gelas", nominal: 30000, jenisPasti: null }]);
  });

  test("teks setelah nominal digabung ke deskripsi", () => {
    expect(items("makan 25000 di warteg")[0].deskripsi).toBe("makan di warteg");
    expect(items("25000 makan")[0].deskripsi).toBe("makan");
  });

  test("tanpa nominal ditolak", () => {
    expect(baca("halo bot")).toEqual({ ok: false, alasan: "tanpa_nominal" });
    expect(baca("kopi 2 gelas")).toEqual({ ok: false, alasan: "tanpa_nominal" });
    expect(baca("   ")).toEqual({ ok: false, alasan: "kosong" });
  });

  test("ukuran menempel huruf bukan nominal", () => {
    expect(items("beras 5kg 75000")).toEqual([{ deskripsi: "beras 5kg", nominal: 75000, jenisPasti: null }]);
  });
});

describe("tabel aturan parser", () => {
  // Jenis selain "+" ditentukan memori/AI di Tahap 3; parser hanya memastikan
  // nominal & deskripsinya benar dan tidak memaksakan jenis.
  test.each([
    ["makan 25000", "makan", 25000],
    ["gaji 6000000", "gaji", 6000000],
    ["tarik saham 668497", "tarik saham", 668497],
    ["gaji budi 3000000", "gaji budi", 3000000],
    ["transfer andi 200000", "transfer andi", 200000],
  ])("%s", (teks, deskripsi, nominal) => {
    expect(items(teks)).toEqual([{ deskripsi, nominal, jenisPasti: null }]);
  });

  test("+5000000 selalu pemasukan", () => {
    expect(items("+5000000")).toEqual([{ deskripsi: "pemasukan", nominal: 5000000, jenisPasti: "pemasukan" }]);
    expect(items("bonus +500rb")[0]).toEqual({ deskripsi: "bonus", nominal: 500000, jenisPasti: "pemasukan" });
  });
});

describe("tanggal di kalimat", () => {
  test("tanpa keterangan → hari ini", () => {
    const hasil = baca("makan 25000");
    expect(hasil).toMatchObject({ ok: true, tanggal: "2026-10-15", tanggalDariTeks: false });
  });

  test("kemarin", () => {
    const hasil = baca("kemarin makan 25000");
    expect(hasil).toMatchObject({ ok: true, tanggal: "2026-10-14", tanggalDariTeks: true });
    if (hasil.ok) expect(hasil.items[0].deskripsi).toBe("makan");
  });

  test("angka tanggal tidak dibaca sebagai nominal", () => {
    const hasil = baca("tanggal 3 bensin 30000");
    expect(hasil).toMatchObject({ ok: true, tanggal: "2026-10-03" });
    if (hasil.ok) expect(hasil.items).toEqual([{ deskripsi: "bensin", nominal: 30000, jenisPasti: null }]);
  });

  test("tanggal masa depan ditolak", () => {
    expect(baca("besok makan 25000")).toEqual({ ok: false, alasan: "tanggal_masa_depan" });
  });
});
