import { describe, expect, test } from "vitest";
import { AI_NONAKTIF, type LayananAI } from "./ai";
import { ambilAnalisis, perbaruiAnalisis } from "./analisis";
import { buatDbUji, idKategori } from "./db-uji";
import { tambahManual } from "./transaksi";

const SEKARANG = () => new Date("2026-10-15T05:00:00Z");

function aiAnalisis(isi = "Pengeluaran naik.") {
  const terkirim: unknown[] = [];
  const ai: LayananAI = {
    aktif: true,
    tebakKategori: async () => ({ ok: false, alasan: "error" }),
    buatAnalisis: async (data) => {
      terkirim.push(data);
      return { ok: true, data: isi };
    },
  };
  return { ai, terkirim };
}

describe("Analisis AI", () => {
  test("yang dikirim hanya ringkasan + deskripsi tersering, lalu disimpan per bulan", async () => {
    const db = await buatDbUji();
    const makan = await idKategori(db, "Makanan & Minuman");
    const { ai, terkirim } = aiAnalisis("Makan paling besar.");
    const deps = { db, ai, sekarang: SEKARANG };
    await tambahManual(deps, { tanggal: "2026-10-03", nominal: 25000, deskripsi: "rasela", jenis: "pengeluaran", kategoriId: makan });
    await tambahManual(deps, { tanggal: "2026-10-04", nominal: 25500, deskripsi: "rasela", jenis: "pengeluaran", kategoriId: makan });

    const hasil = await perbaruiAnalisis(deps, "2026-10");
    expect(hasil).toMatchObject({ ok: true, analisis: { bulan: "2026-10", isi: "Makan paling besar." } });

    const data = terkirim[0] as Record<string, unknown>;
    expect(Object.keys(data)).not.toContain("transaksi");
    expect(data).toMatchObject({
      pengeluaran: 50500,
      deskripsi_tersering: [{ deskripsi: "rasela", kali: 2, total: 50500 }],
      per_minggu: expect.arrayContaining([{ minggu: "W1", tanggal: "1-7", total: 50500 }]),
    });

    expect(await ambilAnalisis(db, "2026-10")).toMatchObject({ isi: "Makan paling besar." });
  });

  test("tombol Perbarui menimpa analisis lama", async () => {
    const db = await buatDbUji();
    const makan = await idKategori(db, "Makanan & Minuman");
    const pertama = aiAnalisis("versi 1");
    await tambahManual({ db, ai: pertama.ai, sekarang: SEKARANG }, { tanggal: "2026-10-03", nominal: 1000, deskripsi: "x", jenis: "pengeluaran", kategoriId: makan });
    await perbaruiAnalisis({ db, ai: pertama.ai, sekarang: SEKARANG }, "2026-10");
    await perbaruiAnalisis({ db, ai: aiAnalisis("versi 2").ai, sekarang: SEKARANG }, "2026-10");
    expect((await ambilAnalisis(db, "2026-10"))?.isi).toBe("versi 2");
  });

  test("bulan tanpa transaksi tidak memanggil AI", async () => {
    const db = await buatDbUji();
    const { ai, terkirim } = aiAnalisis();
    expect(await perbaruiAnalisis({ db, ai, sekarang: SEKARANG }, "2026-10")).toEqual({ ok: false, alasan: "tanpa_data" });
    expect(terkirim).toHaveLength(0);
  });

  test("AI tidak aktif → gagal dengan alasan jelas", async () => {
    const db = await buatDbUji();
    const makan = await idKategori(db, "Makanan & Minuman");
    await tambahManual({ db, ai: AI_NONAKTIF, sekarang: SEKARANG }, { tanggal: "2026-10-03", nominal: 1000, deskripsi: "x", jenis: "pengeluaran", kategoriId: makan });
    expect(await perbaruiAnalisis({ db, ai: AI_NONAKTIF, sekarang: SEKARANG }, "2026-10")).toEqual({ ok: false, alasan: "tidak_aktif" });
  });
});
