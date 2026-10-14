import { describe, expect, test } from "vitest";
import type { Client } from "@libsql/client";
import { AI_NONAKTIF, type HasilAI, type InputTebak, type LayananAI, type TebakanKategori } from "./ai";
import { buatDbUji, idKategori } from "./db-uji";
import { cariMemori, simpanMemori } from "./memori";
import { catatTeks, daftarTransaksi, editTransaksi, hapusTransaksi, jawabTanya, tambahManual, type Deps } from "./transaksi";

// 15 Oktober 2026, 12.00 WIB
const SEKARANG = () => new Date("2026-10-15T05:00:00Z");

/** Gemini tiruan: jawaban ditentukan per deskripsi, dan jumlah panggilan dicatat. */
function aiTiruan(jawab: (deskripsi: string) => HasilAI<TebakanKategori>): LayananAI & { panggilan: InputTebak[] } {
  const panggilan: InputTebak[] = [];
  return {
    aktif: true,
    panggilan,
    tebakKategori: async (input) => {
      panggilan.push(input);
      return jawab(input.deskripsi);
    },
    buatAnalisis: async () => ({ ok: true, data: "analisis" }),
  };
}

const yakin = (jenis: TebakanKategori["jenis"], kategori: string | null, arah: "keluar" | "masuk" = "keluar"): HasilAI<TebakanKategori> => ({
  ok: true,
  data: { jenis, kategori, arah, yakinJenis: true, yakinKategori: true },
});
const ragu: HasilAI<TebakanKategori> = {
  ok: true,
  data: { jenis: "pengeluaran", kategori: "Lainnya", arah: "keluar", yakinJenis: true, yakinKategori: false },
};

async function siapkan(ai: LayananAI): Promise<Deps & { db: Client }> {
  return { db: await buatDbUji(), ai, sekarang: SEKARANG };
}

function harusOk<T extends { ok: boolean }>(hasil: T): Extract<T, { ok: true }> {
  if (!hasil.ok) throw new Error(`gagal: ${JSON.stringify(hasil)}`);
  return hasil as Extract<T, { ok: true }>;
}

describe("jalur 1: ketemu di memori", () => {
  test("'warteg 15000' langsung tersimpan tanpa memanggil AI", async () => {
    const ai = aiTiruan(() => ragu);
    const deps = await siapkan(ai);
    const makan = await idKategori(deps.db, "Makanan & Minuman");
    await simpanMemori(deps.db, { deskripsi: "warteg", jenis: "pengeluaran", kategoriId: makan, asal: "manual" });

    const hasil = harusOk(await catatTeks(deps, "warteg 15000"));
    expect(ai.panggilan).toHaveLength(0);
    expect(hasil.hasil[0].tanya).toBeNull();
    expect(hasil.hasil[0].transaksi).toMatchObject({
      nominal: 15000, jenis: "pengeluaran", sumber: "memori", perluTanya: false,
      kategori: { nama: "Makanan & Minuman" }, tanggal: "2026-10-15",
    });
  });

  test("typo tetap ketemu di memori", async () => {
    const ai = aiTiruan(() => ragu);
    const deps = await siapkan(ai);
    const makan = await idKategori(deps.db, "Makanan & Minuman");
    await simpanMemori(deps.db, { deskripsi: "bakmi effata", jenis: "pengeluaran", kategoriId: makan, asal: "manual" });

    const hasil = harusOk(await catatTeks(deps, "bakmi efata 30000"));
    expect(ai.panggilan).toHaveLength(0);
    expect(hasil.hasil[0].transaksi.sumber).toBe("memori");
  });
});

describe("jalur 2: Gemini yakin", () => {
  test("tersimpan sebagai 'ai' dan diingat, jadi input berikutnya lewat memori", async () => {
    const ai = aiTiruan((d) => (d === "kopi kenangan" ? yakin("pengeluaran", "Makanan & Minuman") : ragu));
    const deps = await siapkan(ai);

    const pertama = harusOk(await catatTeks(deps, "kopi kenangan 28000"));
    expect(pertama.hasil[0].transaksi).toMatchObject({ sumber: "ai", kategori: { nama: "Makanan & Minuman" } });
    expect(ai.panggilan).toHaveLength(1);

    const kedua = harusOk(await catatTeks(deps, "kopi kenangan 30000"));
    expect(kedua.hasil[0].transaksi.sumber).toBe("memori");
    expect(ai.panggilan).toHaveLength(1);
  });

  test("contoh mirip dari memori ikut dikirim ke AI (RAG ringan)", async () => {
    const ai = aiTiruan(() => yakin("pengeluaran", "Makanan & Minuman"));
    const deps = await siapkan(ai);
    const makan = await idKategori(deps.db, "Makanan & Minuman");
    await simpanMemori(deps.db, { deskripsi: "kopi gereja", jenis: "pengeluaran", kategoriId: makan, asal: "manual" });

    await catatTeks(deps, "kopi kenangan 28000");
    expect(ai.panggilan[0].contoh).toEqual([{ kataKunci: "kopi gereja", jenis: "pengeluaran", kategori: "Makanan & Minuman" }]);
  });

  test("gaji 6000000 → pemasukan, tarik saham → investasi arah masuk", async () => {
    const ai = aiTiruan((d) =>
      d === "gaji" ? yakin("pemasukan", "Gaji", "masuk") : yakin("investasi", "Saham", "masuk"),
    );
    const deps = await siapkan(ai);

    const gaji = harusOk(await catatTeks(deps, "gaji 6000000"));
    expect(gaji.hasil[0].transaksi).toMatchObject({ jenis: "pemasukan", arah: "masuk", kategori: { nama: "Gaji" } });

    const saham = harusOk(await catatTeks(deps, "tarik saham 668497"));
    expect(saham.hasil[0].transaksi).toMatchObject({ jenis: "investasi", arah: "masuk", kategori: { nama: "Saham" } });
  });

  test("gaji budi → usaha tanpa kategori, tidak perlu tanya", async () => {
    const ai = aiTiruan(() => yakin("usaha", null));
    const deps = await siapkan(ai);
    const hasil = harusOk(await catatTeks(deps, "gaji budi 3000000"));
    expect(hasil.hasil[0].tanya).toBeNull();
    expect(hasil.hasil[0].transaksi).toMatchObject({ jenis: "usaha", kategori: null, perluTanya: false, arah: "keluar" });
  });

  test("+5000000 tetap pemasukan walau AI bilang lain", async () => {
    const ai = aiTiruan(() => yakin("pengeluaran", "Belanja"));
    const deps = await siapkan(ai);
    const hasil = harusOk(await catatTeks(deps, "+5000000"));
    expect(hasil.hasil[0].transaksi).toMatchObject({ jenis: "pemasukan", arah: "masuk", perluTanya: true });
  });
});

describe("jalur 3: Gemini ragu atau gagal → tanya balik", () => {
  test("alur PRD: rasela 25000 → tanya balik → rasela 30000 dikenali tanpa AI", async () => {
    const ai = aiTiruan(() => ragu);
    const deps = await siapkan(ai);

    const pertama = harusOk(await catatTeks(deps, "rasela 25000"));
    const trx = pertama.hasil[0].transaksi;
    expect(pertama.hasil[0].tanya).toEqual({ tanyaJenis: false });
    expect(trx).toMatchObject({ kategori: null, perluTanya: true, nominal: 25000 });
    expect(ai.panggilan).toHaveLength(1);

    const makan = await idKategori(deps.db, "Makanan & Minuman");
    const dijawab = await jawabTanya(deps, trx.id, { jenis: "pengeluaran", kategoriId: makan });
    expect(dijawab).toMatchObject({ sumber: "tanya_balik", perluTanya: false, kategori: { nama: "Makanan & Minuman" } });

    const kedua = harusOk(await catatTeks(deps, "rasela 30000"));
    expect(kedua.hasil[0].transaksi).toMatchObject({ sumber: "memori", kategori: { nama: "Makanan & Minuman" } });
    expect(ai.panggilan).toHaveLength(1);
  });

  test("kategori di luar daftar dianggap ragu", async () => {
    const ai = aiTiruan(() => yakin("pengeluaran", "Kuliner"));
    const deps = await siapkan(ai);
    const hasil = harusOk(await catatTeks(deps, "sate padang 30000"));
    expect(hasil.hasil[0].tanya).not.toBeNull();
    expect(hasil.hasil[0].transaksi.perluTanya).toBe(true);
  });

  test("jenis ragu ('transfer andi') → tanya jenis juga", async () => {
    const ai = aiTiruan(() => ({
      ok: true,
      data: { jenis: "pengeluaran", kategori: "Lainnya", arah: "keluar", yakinJenis: false, yakinKategori: false },
    }));
    const deps = await siapkan(ai);
    const hasil = harusOk(await catatTeks(deps, "transfer andi 200000"));
    expect(hasil.hasil[0].tanya).toEqual({ tanyaJenis: true });
  });

  test.each(["timeout", "kuota", "error"] as const)("AI gagal (%s) → transaksi tetap tersimpan, AI off", async (alasan) => {
    const ai = aiTiruan(() => ({ ok: false, alasan }));
    const deps = await siapkan(ai);
    const hasil = harusOk(await catatTeks(deps, "rasela 25000"));
    expect(hasil.aiTersedia).toBe(false);
    expect(hasil.hasil[0].tanya).toEqual({ tanyaJenis: true });
    expect(await daftarTransaksi(deps.db, "2026-10")).toHaveLength(1);
  });

  test("tanpa API key → tidak memanggil AI, langsung tanya", async () => {
    const deps = await siapkan(AI_NONAKTIF);
    const hasil = harusOk(await catatTeks(deps, "rasela 25000"));
    expect(hasil.aiTersedia).toBe(false);
    expect(hasil.hasil[0].transaksi.perluTanya).toBe(true);
  });

  test("jawab dengan jenis usaha menyembunyikan kategori", async () => {
    const deps = await siapkan(aiTiruan(() => ragu));
    const trx = harusOk(await catatTeks(deps, "gaji budi 3000000")).hasil[0].transaksi;
    const dijawab = await jawabTanya(deps, trx.id, { jenis: "usaha" });
    expect(dijawab).toMatchObject({ jenis: "usaha", kategori: null, perluTanya: false });
    expect(await cariMemori(deps.db, "gaji budi")).toMatchObject({ jenis: "usaha", kategoriId: null });
  });

  test("opsi 'ketik sendiri' membuat kategori baru", async () => {
    const deps = await siapkan(aiTiruan(() => ragu));
    const trx = harusOk(await catatTeks(deps, "pakan kucing 50000")).hasil[0].transaksi;
    const dijawab = await jawabTanya(deps, trx.id, { jenis: "pengeluaran", kategoriBaru: "Hewan Peliharaan" });
    expect(dijawab.kategori?.nama).toBe("Hewan Peliharaan");
  });
});

describe("beberapa item dalam satu kalimat", () => {
  test("kopi 15000 roti 25000 → dua transaksi, AI dipanggil per item", async () => {
    const ai = aiTiruan(() => yakin("pengeluaran", "Makanan & Minuman"));
    const deps = await siapkan(ai);
    const hasil = harusOk(await catatTeks(deps, "kopi 15000 roti 25000"));
    expect(hasil.hasil.map((h) => [h.transaksi.deskripsi, h.transaksi.nominal])).toEqual([["kopi", 15000], ["roti", 25000]]);
    expect(ai.panggilan).toHaveLength(2);
  });

  test("teks tanpa nominal ditolak tanpa menyimpan apa pun", async () => {
    const deps = await siapkan(aiTiruan(() => ragu));
    expect(await catatTeks(deps, "halo")).toEqual({ ok: false, alasan: "tanpa_nominal" });
  });
});

describe("edit, manual, hapus", () => {
  test("koreksi kategori memperbarui memori dan menandai dikoreksi", async () => {
    const ai = aiTiruan(() => yakin("pengeluaran", "Makanan & Minuman"));
    const deps = await siapkan(ai);
    const trx = harusOk(await catatTeks(deps, "indomaret 45000")).hasil[0].transaksi;
    const belanja = await idKategori(deps.db, "Belanja");

    const diedit = await editTransaksi(deps, trx.id, { kategoriId: belanja });
    expect(diedit).toMatchObject({ dikoreksi: true, kategori: { nama: "Belanja" } });
    expect(await cariMemori(deps.db, "indomaret")).toMatchObject({ kategoriId: belanja });

    const lagi = harusOk(await catatTeks(deps, "indomaret 20000"));
    expect(lagi.hasil[0].transaksi).toMatchObject({ sumber: "memori", kategori: { nama: "Belanja" } });
  });

  test("ubah tanggal ke masa depan ditolak", async () => {
    const deps = await siapkan(aiTiruan(() => yakin("pengeluaran", "Makanan & Minuman")));
    const trx = harusOk(await catatTeks(deps, "makan 25000")).hasil[0].transaksi;
    await expect(editTransaksi(deps, trx.id, { tanggal: "2026-10-16" })).rejects.toThrow("masa depan");
  });

  test("form manual tersimpan dan diingat", async () => {
    const deps = await siapkan(AI_NONAKTIF);
    const transport = await idKategori(deps.db, "Transportasi");
    const trx = await tambahManual(deps, {
      tanggal: "2026-10-14", nominal: 50000, deskripsi: "bensin motor", jenis: "pengeluaran", kategoriId: transport,
    });
    expect(trx).toMatchObject({ sumber: "manual", tanggal: "2026-10-14" });
    expect(await cariMemori(deps.db, "bensin motor")).toMatchObject({ kategoriId: transport });
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
    expect(await hapusTransaksi(deps.db, trx.id)).toBe(true);
    expect(await hapusTransaksi(deps.db, trx.id)).toBe(false);
  });
});
