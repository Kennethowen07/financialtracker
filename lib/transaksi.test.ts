import { describe, expect, test } from "vitest";
import type { Client } from "@libsql/client";
import { AI_NONAKTIF, type HasilAI, type LayananAI } from "./ai";
import { buatDbUji, buatPenggunaUji, idKategori } from "./db-uji";
import { tentukanKategori } from "./kategori";
import { cariMemori, simpanMemori } from "./memori";
import {
  catatTeks, daftarTransaksi, editTransaksi, hapusTransaksi, jawabTanya, rapikanSuara, tambahManual, type Deps,
} from "./transaksi";

// 15 Oktober 2026, 12.00 WIB
const SEKARANG = () => new Date("2026-10-15T05:00:00Z");

/** Gemini tiruan untuk cadangan suara: jawaban ditentukan per teks, jumlah panggilan dicatat. */
function aiTiruan(jawab: (teks: string) => HasilAI<string> = () => ({ ok: false, alasan: "error" })): LayananAI & { panggilan: string[] } {
  const panggilan: string[] = [];
  return {
    aktif: true,
    panggilan,
    rapikanSuara: async (teks) => {
      panggilan.push(teks);
      return jawab(teks);
    },
    buatAnalisis: async () => ({ ok: true, data: "analisis" }),
  };
}

async function siapkan(ai: LayananAI = aiTiruan()): Promise<Deps & { db: Client }> {
  const db = await buatDbUji();
  return { db, ai, penggunaId: await buatPenggunaUji(db), sekarang: SEKARANG };
}

function harusOk<T extends { ok: boolean }>(hasil: T): Extract<T, { ok: true }> {
  if (!hasil.ok) throw new Error(`gagal: ${JSON.stringify(hasil)}`);
  return hasil as Extract<T, { ok: true }>;
}

describe("ketemu di memori", () => {
  test("'warteg 15000' langsung tersimpan dengan kategori dari memori", async () => {
    const deps = await siapkan();
    const makan = await idKategori(deps.db, "Makanan & Minuman");
    await simpanMemori(deps.db, deps.penggunaId, { deskripsi: "warteg", jenis: "pengeluaran", kategoriId: makan, asal: "manual" });

    const hasil = harusOk(await catatTeks(deps, "warteg 15000"));
    expect(hasil.hasil[0].tanya).toBeNull();
    expect(hasil.hasil[0].transaksi).toMatchObject({
      nominal: 15000, jenis: "pengeluaran", sumber: "memori", perluTanya: false, caraInput: "ketik",
      kategori: { nama: "Makanan & Minuman" }, tanggal: "2026-10-15",
    });
  });

  test("typo tetap ketemu di memori", async () => {
    const deps = await siapkan();
    const makan = await idKategori(deps.db, "Makanan & Minuman");
    await simpanMemori(deps.db, deps.penggunaId, { deskripsi: "bakmi effata", jenis: "pengeluaran", kategoriId: makan, asal: "manual" });

    const hasil = harusOk(await catatTeks(deps, "bakmi efata 30000"));
    expect(hasil.hasil[0].transaksi.sumber).toBe("memori");
  });

  test("jenis dari memori: gaji → pemasukan, tarik saham → investasi arah masuk", async () => {
    const deps = await siapkan();
    const gajiKat = await idKategori(deps.db, "Gaji");
    const saham = await idKategori(deps.db, "Saham");
    await simpanMemori(deps.db, deps.penggunaId, { deskripsi: "gaji", jenis: "pemasukan", kategoriId: gajiKat, asal: "manual" });
    await simpanMemori(deps.db, deps.penggunaId, { deskripsi: "tarik saham", jenis: "investasi", kategoriId: saham, asal: "manual" });

    const gaji = harusOk(await catatTeks(deps, "gaji 6000000"));
    expect(gaji.hasil[0].transaksi).toMatchObject({ jenis: "pemasukan", arah: "masuk", kategori: { nama: "Gaji" } });
    const tarik = harusOk(await catatTeks(deps, "tarik saham 668497"));
    expect(tarik.hasil[0].transaksi).toMatchObject({ jenis: "investasi", arah: "masuk", kategori: { nama: "Saham" } });
  });
});

describe("belum dikenal → tanya balik (AI kategorisasi dimatikan, PRD versi 3)", () => {
  test("alur PRD: rasela 25000 → tanya balik → rasela 30000 dikenali", async () => {
    const ai = aiTiruan();
    const deps = await siapkan(ai);

    const pertama = harusOk(await catatTeks(deps, "rasela 25000"));
    const trx = pertama.hasil[0].transaksi;
    expect(pertama.hasil[0].tanya).toEqual({ tanyaJenis: true });
    expect(trx).toMatchObject({ kategori: null, perluTanya: true, nominal: 25000, sumber: "tanya_balik" });

    const makan = await idKategori(deps.db, "Makanan & Minuman");
    const dijawab = await jawabTanya(deps, trx.id, { jenis: "pengeluaran", kategoriId: makan });
    expect(dijawab).toMatchObject({ sumber: "tanya_balik", perluTanya: false, kategori: { nama: "Makanan & Minuman" } });

    const kedua = harusOk(await catatTeks(deps, "rasela 30000"));
    expect(kedua.hasil[0].transaksi).toMatchObject({ sumber: "memori", kategori: { nama: "Makanan & Minuman" } });
    expect(ai.panggilan).toHaveLength(0); // AI tidak pernah dipanggil saat mencatat
  });

  test("+5000000 → pemasukan pasti, hanya kategori yang ditanyakan", async () => {
    const deps = await siapkan();
    const hasil = harusOk(await catatTeks(deps, "+5000000"));
    expect(hasil.hasil[0].tanya).toEqual({ tanyaJenis: false });
    expect(hasil.hasil[0].transaksi).toMatchObject({ jenis: "pemasukan", arah: "masuk", perluTanya: true });
  });

  test("tanpa API key tetap bisa mencatat", async () => {
    const deps = await siapkan(AI_NONAKTIF);
    const hasil = harusOk(await catatTeks(deps, "rasela 25000"));
    expect(hasil.hasil[0].transaksi.perluTanya).toBe(true);
  });

  test("jawab dengan jenis usaha menyembunyikan kategori", async () => {
    const deps = await siapkan();
    const trx = harusOk(await catatTeks(deps, "gaji budi 3000000")).hasil[0].transaksi;
    const dijawab = await jawabTanya(deps, trx.id, { jenis: "usaha" });
    expect(dijawab).toMatchObject({ jenis: "usaha", kategori: null, perluTanya: false });
    expect(await cariMemori(deps.db, deps.penggunaId, "gaji budi")).toMatchObject({ jenis: "usaha", kategoriId: null });
  });

  test("opsi 'ketik sendiri' membuat kategori baru", async () => {
    const deps = await siapkan();
    const trx = harusOk(await catatTeks(deps, "pakan kucing 50000")).hasil[0].transaksi;
    const dijawab = await jawabTanya(deps, trx.id, { jenis: "pengeluaran", kategoriBaru: "Hewan Peliharaan" });
    expect(dijawab.kategori?.nama).toBe("Hewan Peliharaan");
  });

  test("dua permintaan membuat kategori yang sama bersamaan → tetap satu kategori", async () => {
    const deps = await siapkan();
    const buat = () => tentukanKategori(deps.db, deps.penggunaId, "pengeluaran", { kategoriBaru: "Hewan" });
    const [a, b] = await Promise.all([buat(), buat()]);
    expect(a).toBe(b);
  });
});

describe("beberapa item dalam satu kalimat", () => {
  test("kopi 15000 roti 25000 → dua transaksi", async () => {
    const deps = await siapkan();
    const hasil = harusOk(await catatTeks(deps, "kopi 15000 roti 25000"));
    expect(hasil.hasil.map((h) => [h.transaksi.deskripsi, h.transaksi.nominal])).toEqual([["kopi", 15000], ["roti", 25000]]);
  });

  test("teks tanpa nominal ditolak tanpa menyimpan apa pun", async () => {
    const deps = await siapkan();
    expect(await catatTeks(deps, "halo")).toEqual({ ok: false, alasan: "tanpa_nominal" });
    expect(await daftarTransaksi(deps.db, deps.penggunaId, "2026-10")).toHaveLength(0);
  });
});

describe("input suara", () => {
  test("tercatat dengan cara_input 'suara', nominal dalam kata terbaca", async () => {
    const deps = await siapkan();
    const hasil = harusOk(await catatTeks(deps, "rasela dua puluh lima ribu", "suara"));
    expect(hasil.hasil[0].transaksi).toMatchObject({ deskripsi: "rasela", nominal: 25000, caraInput: "suara", perluTanya: true });
  });

  test("cadangan Gemini: teks tanpa nominal ditulis ulang, hasilnya harus lolos parser", async () => {
    const ai = aiTiruan((teks) => ({ ok: true, data: teks === "rasela dua lima" ? "rasela 25000" : "" }));
    expect(await rapikanSuara(ai, "rasela dua lima")).toEqual({ ok: true, teks: "rasela 25000" });
    expect(await rapikanSuara(ai, "halo halo")).toEqual({ ok: false, alasan: "tanpa_nominal" });
    expect(ai.panggilan).toEqual(["rasela dua lima", "halo halo"]);
  });

  test("cadangan Gemini gagal atau kuota habis", async () => {
    expect(await rapikanSuara(aiTiruan(() => ({ ok: false, alasan: "timeout" })), "rasela dua lima"))
      .toEqual({ ok: false, alasan: "tidak_tersedia" });
    expect(await rapikanSuara(aiTiruan(() => ({ ok: false, alasan: "kuota" })), "rasela dua lima"))
      .toEqual({ ok: false, alasan: "kuota" });
    expect(await rapikanSuara(AI_NONAKTIF, "rasela dua lima")).toEqual({ ok: false, alasan: "tidak_tersedia" });
  });

  test("Gemini menjawab teks yang tetap tanpa nominal → dianggap tanpa nominal", async () => {
    const ai = aiTiruan(() => ({ ok: true, data: "rasela" }));
    expect(await rapikanSuara(ai, "rasela dua lima")).toEqual({ ok: false, alasan: "tanpa_nominal" });
  });
});

describe("edit, manual, hapus", () => {
  test("koreksi kategori memperbarui memori dan menandai dikoreksi", async () => {
    const deps = await siapkan();
    const makan = await idKategori(deps.db, "Makanan & Minuman");
    await simpanMemori(deps.db, deps.penggunaId, { deskripsi: "indomaret", jenis: "pengeluaran", kategoriId: makan, asal: "manual" });
    const trx = harusOk(await catatTeks(deps, "indomaret 45000")).hasil[0].transaksi;
    const belanja = await idKategori(deps.db, "Belanja");

    const diedit = await editTransaksi(deps, trx.id, { kategoriId: belanja });
    expect(diedit).toMatchObject({ dikoreksi: true, kategori: { nama: "Belanja" } });
    expect(await cariMemori(deps.db, deps.penggunaId, "indomaret")).toMatchObject({ kategoriId: belanja });

    const lagi = harusOk(await catatTeks(deps, "indomaret 20000"));
    expect(lagi.hasil[0].transaksi).toMatchObject({ sumber: "memori", kategori: { nama: "Belanja" } });
  });

  test("ubah tanggal ke masa depan ditolak", async () => {
    const deps = await siapkan();
    const trx = harusOk(await catatTeks(deps, "makan 25000")).hasil[0].transaksi;
    await expect(editTransaksi(deps, trx.id, { tanggal: "2026-10-16" })).rejects.toThrow("masa depan");
  });

  test("form manual tersimpan dan diingat", async () => {
    const deps = await siapkan(AI_NONAKTIF);
    const transport = await idKategori(deps.db, "Transportasi");
    const trx = await tambahManual(deps, {
      tanggal: "2026-10-14", nominal: 50000, deskripsi: "bensin motor", jenis: "pengeluaran", kategoriId: transport,
    });
    expect(trx).toMatchObject({ sumber: "manual", caraInput: "form", tanggal: "2026-10-14" });
    expect(await cariMemori(deps.db, deps.penggunaId, "bensin motor")).toMatchObject({ kategoriId: transport });
  });

  test("kategori yang jenisnya tidak cocok ditolak", async () => {
    const deps = await siapkan(AI_NONAKTIF);
    const gaji = await idKategori(deps.db, "Gaji");
    await expect(
      tambahManual(deps, { tanggal: "2026-10-14", nominal: 1000, deskripsi: "x", jenis: "pengeluaran", kategoriId: gaji }),
    ).rejects.toThrow("tidak cocok");
  });

  test("hapus", async () => {
    const deps = await siapkan(AI_NONAKTIF);
    const trx = harusOk(await catatTeks(deps, "rasela 25000")).hasil[0].transaksi;
    expect(await hapusTransaksi(deps.db, deps.penggunaId, trx.id)).toBe(true);
    expect(await hapusTransaksi(deps.db, deps.penggunaId, trx.id)).toBe(false);
  });
});

describe("pemisahan data antar akun", () => {
  /** Dua akun di database yang sama: A (andi) dan B (budi). */
  async function duaAkun() {
    const db = await buatDbUji();
    const a: Deps = { db, ai: AI_NONAKTIF, penggunaId: await buatPenggunaUji(db, "andi@uji.id"), sekarang: SEKARANG };
    const b: Deps = { db, ai: AI_NONAKTIF, penggunaId: await buatPenggunaUji(db, "budi@uji.id"), sekarang: SEKARANG };
    return { db, a, b };
  }

  test("akun B tidak melihat, mengubah, menjawab, atau menghapus transaksi akun A", async () => {
    const { db, a, b } = await duaAkun();
    const makan = await idKategori(db, "Makanan & Minuman");
    const trx = harusOk(await catatTeks(a, "rasela 25000")).hasil[0].transaksi;

    expect(await daftarTransaksi(db, b.penggunaId, "2026-10")).toHaveLength(0);
    await expect(editTransaksi(b, trx.id, { nominal: 1 })).rejects.toThrow("tidak ditemukan");
    await expect(jawabTanya(b, trx.id, { jenis: "pengeluaran", kategoriId: makan })).rejects.toThrow("tidak ditemukan");
    expect(await hapusTransaksi(db, b.penggunaId, trx.id)).toBe(false);

    const milikA = await daftarTransaksi(db, a.penggunaId, "2026-10");
    expect(milikA).toHaveLength(1);
    expect(milikA[0]).toMatchObject({ nominal: 25000, perluTanya: true });
  });

  test("memori milik masing-masing akun", async () => {
    const { db, a, b } = await duaAkun();
    const makan = await idKategori(db, "Makanan & Minuman");
    await simpanMemori(db, a.penggunaId, { deskripsi: "rasela", jenis: "pengeluaran", kategoriId: makan, asal: "manual" });

    expect(harusOk(await catatTeks(a, "rasela 25000")).hasil[0].transaksi.sumber).toBe("memori");
    expect(harusOk(await catatTeks(b, "rasela 25000")).hasil[0].transaksi.perluTanya).toBe(true);
    expect(await cariMemori(db, b.penggunaId, "rasela")).toBeNull();
  });

  test("kategori 'ketik sendiri' hanya terlihat dan bisa dipakai pemiliknya", async () => {
    const { db, a, b } = await duaAkun();
    const trxA = harusOk(await catatTeks(a, "pakan kucing 50000")).hasil[0].transaksi;
    const hewan = (await jawabTanya(a, trxA.id, { jenis: "pengeluaran", kategoriBaru: "Hewan" })).kategori!.id;

    const trxB = harusOk(await catatTeks(b, "pakan anjing 40000")).hasil[0].transaksi;
    await expect(jawabTanya(b, trxB.id, { jenis: "pengeluaran", kategoriId: hewan })).rejects.toThrow("tidak ditemukan");

    // B boleh membuat kategori dengan nama yang sama; hasilnya kategori terpisah.
    const hewanB = (await jawabTanya(b, trxB.id, { jenis: "pengeluaran", kategoriBaru: "Hewan" })).kategori!.id;
    expect(hewanB).not.toBe(hewan);

    // Nama kategori bawaan dipakai ulang, bukan dibuat dobel.
    const trxB2 = harusOk(await catatTeks(b, "bakso 20000")).hasil[0].transaksi;
    const dijawab = await jawabTanya(b, trxB2.id, { jenis: "pengeluaran", kategoriBaru: "makanan & minuman" });
    expect(dijawab.kategori?.id).toBe(await idKategori(db, "Makanan & Minuman"));
  });
});
