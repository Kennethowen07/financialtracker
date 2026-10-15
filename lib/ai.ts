// Semua pemanggilan AI lewat sini (docs/PRD.md "Peran AI"): Gemini API mode gratis.
// Kode lain hanya mengenal interface LayananAI, jadi di test Gemini bisa diganti tiruan.
import { ApiError, GoogleGenAI } from "@google/genai";
import type { Jenis } from "./parser";

export interface TebakanKategori {
  jenis: Jenis;
  /** Nama kategori persis dari daftar, atau null (usaha / tidak tahu). */
  kategori: string | null;
  arah: "keluar" | "masuk";
  yakinJenis: boolean;
  yakinKategori: boolean;
}

export type AlasanAiGagal = "tidak_aktif" | "timeout" | "kuota" | "error";

export type HasilAI<T> = { ok: true; data: T } | { ok: false; alasan: AlasanAiGagal };

export interface InputTebak {
  deskripsi: string;
  kategori: { nama: string; jenis: string }[];
  contoh: { kataKunci: string; jenis: string; kategori: string | null }[];
}

export interface LayananAI {
  aktif: boolean;
  tebakKategori(input: InputTebak): Promise<HasilAI<TebakanKategori>>;
  buatAnalisis(ringkasan: unknown): Promise<HasilAI<string>>;
}

/** Batas waktu tunggu AI. Lewat dari ini langsung tanya balik (PRD). */
export const BATAS_WAKTU_MS = 8_000;

const SISTEM_KATEGORI = `Kamu mengategorikan satu transaksi keuangan pribadi berbahasa Indonesia.
Input berisi deskripsi singkat (sering informal, singkatan, atau nama toko/orang), daftar kategori yang boleh dipakai, dan contoh dari catatan sebelumnya.

Tentukan:
- jenis: "pengeluaran" (default), "pemasukan" (uang masuk: gaji, bonus, hasil jualan, refund), "investasi" (saham, kripto, Bybit, reksa dana), atau "usaha" (pengeluaran bisnis, mis. gaji karyawan "gaji budi").
- kategori: nama PERSIS dari daftar untuk jenis itu. Untuk "usaha" selalu null.
- arah: "keluar" atau "masuk". Pemasukan selalu masuk. Pengeluaran dan usaha selalu keluar. Investasi: setoran/beli = keluar, tarik/jual/withdraw = masuk.
- yakin_jenis dan yakin_kategori: true hanya kalau kamu benar-benar yakin.

Aturan penting:
- Kata seperti "gaji" hanya petunjuk. "bayar gaji ART" tetap pengeluaran.
- Transfer ke/dari orang ("transfer andi") arahnya tidak jelas → yakin_jenis false.
- Nama toko, orang, atau kata yang tidak kamu kenal → yakin_kategori false. Jangan menebak.
- Top up e-wallet (GoPay, OVO, ShopeePay, SeaBank, Flazz, Dana) → pengeluaran, kategori "Top up".
- Layanan tagihan rutin bulanan (Claude, Netflix, Spotify, YouTube Premium) → "Langganan".
- Kuota dan pulsa (termasuk myXL) → "Pulsa & Internet".
- Ikuti contoh dari catatan sebelumnya kalau deskripsinya mirip.`;

const SKEMA_KATEGORI = {
  type: "object",
  properties: {
    jenis: { type: "string", enum: ["pengeluaran", "pemasukan", "investasi", "usaha"] },
    kategori: { type: ["string", "null"] },
    arah: { type: "string", enum: ["keluar", "masuk"] },
    yakin_jenis: { type: "boolean" },
    yakin_kategori: { type: "boolean" },
  },
  required: ["jenis", "kategori", "arah", "yakin_jenis", "yakin_kategori"],
};

const SISTEM_ANALISIS = `Kamu asisten keuangan pribadi yang jujur dan praktis. Kamu menerima ringkasan keuangan satu bulan dalam JSON (nominal rupiah).
Tulis 3 sampai 5 kalimat insight dalam bahasa Indonesia santai, sebagai teks biasa tanpa markdown dan tanpa daftar berpoin.
Bahas yang paling berguna: kategori terbesar, perubahan dibanding bulan lalu, pola per minggu, kebiasaan dari deskripsi tersering, dan satu saran konkret.
Tulis nominal seperti "Rp25.000". Jangan mengarang angka yang tidak ada di data.`;

function alasanGagal(err: unknown): AlasanAiGagal {
  if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) return "timeout";
  if (err instanceof ApiError && err.status === 429) return "kuota";
  return "error";
}

export function buatLayananGemini(
  apiKey: string | undefined = process.env.GEMINI_API_KEY,
  model: string = process.env.GEMINI_MODEL || "gemini-flash-latest",
): LayananAI {
  if (!apiKey) return AI_NONAKTIF;
  const ai = new GoogleGenAI({ apiKey });

  async function panggil(system: string, isi: string, opsi: { json?: object; batasMs?: number }): Promise<HasilAI<string>> {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: isi,
        config: {
          systemInstruction: system,
          temperature: 0.2,
          abortSignal: AbortSignal.timeout(opsi.batasMs ?? BATAS_WAKTU_MS),
          ...(opsi.json ? { responseMimeType: "application/json", responseJsonSchema: opsi.json } : {}),
        },
      });
      const teks = res.text?.trim();
      return teks ? { ok: true, data: teks } : { ok: false, alasan: "error" };
    } catch (err) {
      const alasan = alasanGagal(err);
      console.error(`[ai] gagal (${alasan}):`, err instanceof Error ? err.message : err);
      return { ok: false, alasan };
    }
  }

  return {
    aktif: true,

    async tebakKategori(input) {
      const hasil = await panggil(SISTEM_KATEGORI, JSON.stringify(input), { json: SKEMA_KATEGORI });
      if (!hasil.ok) return hasil;
      try {
        const j = JSON.parse(hasil.data);
        return {
          ok: true,
          data: {
            jenis: j.jenis,
            kategori: typeof j.kategori === "string" ? j.kategori : null,
            arah: j.arah === "masuk" ? "masuk" : "keluar",
            yakinJenis: j.yakin_jenis === true,
            yakinKategori: j.yakin_kategori === true,
          },
        };
      } catch {
        return { ok: false, alasan: "error" };
      }
    },

    async buatAnalisis(ringkasan) {
      // Analisis boleh lebih lama karena dipicu tombol, bukan saat mencatat.
      return panggil(SISTEM_ANALISIS, JSON.stringify(ringkasan), { batasMs: 30_000 });
    },
  };
}

/** Dipakai kalau GEMINI_API_KEY kosong: semua input yang tidak ada di memori langsung tanya balik. */
export const AI_NONAKTIF: LayananAI = {
  aktif: false,
  tebakKategori: async () => ({ ok: false, alasan: "tidak_aktif" }),
  buatAnalisis: async () => ({ ok: false, alasan: "tidak_aktif" }),
};

/**
 * Bungkus layanan AI dengan kuota: setiap panggilan memakai satu jatah lewat `pakai()`.
 * Kalau jatah habis, hasilnya "kuota" tanpa memanggil AI (lalu muncul tanya balik seperti biasa).
 */
export function denganKuota(ai: LayananAI, pakai: () => Promise<boolean>): LayananAI {
  if (!ai.aktif) return ai;
  return {
    aktif: true,
    tebakKategori: async (input) => ((await pakai()) ? ai.tebakKategori(input) : { ok: false, alasan: "kuota" }),
    buatAnalisis: async (ringkasan) => ((await pakai()) ? ai.buatAnalisis(ringkasan) : { ok: false, alasan: "kuota" }),
  };
}
