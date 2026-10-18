import { describe, expect, test } from "vitest";
import type { Client } from "@libsql/client";
import { AI_NONAKTIF, type LayananAI } from "./ai";
import { ambilAnalisis, perbaruiAnalisis } from "./analisis";
import { buatDbUji, buatPenggunaUji, idKategori } from "./db-uji";
import { tambahManual, type Deps } from "./transaksi";

const SEKARANG = () => new Date("2026-10-15T05:00:00Z");

function aiAnalisis(isi = "Pengeluaran naik.") {
  const terkirim: unknown[] = [];
  const ai: LayananAI = {
    aktif: true,
    rapikanSuara: async () => ({ ok: false, alasan: "error" }),
    buatAnalisis: async (data) => {
      terkirim.push(data);
      return { ok: true, data: isi };
    },
  };
  return { ai, terkirim };
}

async function siapkan(): Promise<{ db: Client; uid: number; makan: number; deps: (ai: LayananAI) => Deps }> {
  const db = await buatDbUji();
  const uid = await buatPenggunaUji(db);
  return { db, uid, makan: await idKategori(db, "Makanan & Minuman"), deps: (ai) => ({ db, ai, penggunaId: uid, sekarang: SEKARANG }) };
}

describe("Analisis AI", () => {
  test("yang dikirim hanya ringkasan + deskripsi tersering, lalu disimpan per bulan", async () => {
    const { db, uid, makan, deps } = await siapkan();
    const { ai, terkirim } = aiAnalisis("Makan paling besar.");
    await tambahManual(deps(ai), { tanggal: "2026-10-03", nominal: 25000, deskripsi: "rasela", jenis: "pengeluaran", kategoriId: makan });
    await tambahManual(deps(ai), { tanggal: "2026-10-04", nominal: 25500, deskripsi: "rasela", jenis: "pengeluaran", kategoriId: makan });

    const hasil = await perbaruiAnalisis(deps(ai), "2026-10");
    expect(hasil).toMatchObject({ ok: true, analisis: { bulan: "2026-10", isi: "Makan paling besar." } });

    const data = terkirim[0] as Record<string, unknown>;
    expect(Object.keys(data)).not.toContain("transaksi");
    expect(data).toMatchObject({
      pengeluaran: 50500,
      deskripsi_tersering: [{ deskripsi: "rasela", kali: 2, total: 50500 }],
      per_minggu: expect.arrayContaining([{ minggu: "W1", tanggal: "1-7", total: 50500 }]),
    });

    expect(await ambilAnalisis(db, uid, "2026-10")).toMatchObject({ isi: "Makan paling besar." });
  });

  test("tombol Perbarui menimpa analisis lama", async () => {
    const { db, uid, makan, deps } = await siapkan();
    const pertama = aiAnalisis("versi 1");
    await tambahManual(deps(pertama.ai), { tanggal: "2026-10-03", nominal: 1000, deskripsi: "x", jenis: "pengeluaran", kategoriId: makan });
    await perbaruiAnalisis(deps(pertama.ai), "2026-10");
    await perbaruiAnalisis(deps(aiAnalisis("versi 2").ai), "2026-10");
    expect((await ambilAnalisis(db, uid, "2026-10"))?.isi).toBe("versi 2");
  });

  test("analisis milik masing-masing akun", async () => {
    const { db, uid, makan, deps } = await siapkan();
    await tambahManual(deps(AI_NONAKTIF), { tanggal: "2026-10-03", nominal: 1000, deskripsi: "x", jenis: "pengeluaran", kategoriId: makan });
    await perbaruiAnalisis(deps(aiAnalisis("punya andi").ai), "2026-10");

    const budi = await buatPenggunaUji(db, "budi@uji.id");
    expect(await ambilAnalisis(db, budi, "2026-10")).toBeNull();
    // Budi belum punya transaksi, jadi tidak ada yang dianalisis (transaksi Andi tidak ikut terbaca).
    const { ai, terkirim } = aiAnalisis();
    expect(await perbaruiAnalisis({ db, ai, penggunaId: budi, sekarang: SEKARANG }, "2026-10")).toEqual({ ok: false, alasan: "tanpa_data" });
    expect(terkirim).toHaveLength(0);
    expect((await ambilAnalisis(db, uid, "2026-10"))?.isi).toBe("punya andi");
  });

  test("bulan tanpa transaksi tidak memanggil AI", async () => {
    const { deps } = await siapkan();
    const { ai, terkirim } = aiAnalisis();
    expect(await perbaruiAnalisis(deps(ai), "2026-10")).toEqual({ ok: false, alasan: "tanpa_data" });
    expect(terkirim).toHaveLength(0);
  });

  test("AI tidak aktif → gagal dengan alasan jelas", async () => {
    const { makan, deps } = await siapkan();
    await tambahManual(deps(AI_NONAKTIF), { tanggal: "2026-10-03", nominal: 1000, deskripsi: "x", jenis: "pengeluaran", kategoriId: makan });
    expect(await perbaruiAnalisis(deps(AI_NONAKTIF), "2026-10")).toEqual({ ok: false, alasan: "tidak_aktif" });
  });
});
