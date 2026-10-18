// Semua pemanggilan AI lewat sini (docs/PRD.md "Peran AI"): Gemini API mode gratis.
// Kode lain hanya mengenal interface LayananAI, jadi di test Gemini bisa diganti tiruan.
import { ApiError, GoogleGenAI, type ContentListUnion } from "@google/genai";
import { konteksMutasi, SISTEM_MUTASI, SKEMA_MUTASI } from "./mutasi";

export type AlasanAiGagal = "tidak_aktif" | "timeout" | "kuota" | "error";

export type HasilAI<T> = { ok: true; data: T } | { ok: false; alasan: AlasanAiGagal };

export interface LayananAI {
  aktif: boolean;
  /**
   * Cadangan input suara: teks yang nominalnya tidak terbaca parser ditulis ulang menjadi
   * "deskripsi angka" (mis. "rasela 25000"). Hasilnya tetap dibaca parser. Kategori TIDAK
   * ditentukan AI (docs/PRD.md versi 3). String kosong = AI juga tidak menemukan nominal.
   */
  rapikanSuara(teks: string): Promise<HasilAI<string>>;
  buatAnalisis(ringkasan: unknown): Promise<HasilAI<string>>;
  /** Screenshot mutasi → JSON transaksi (divalidasi oleh lib/mutasi.ts olahHasilMutasi). */
  bacaMutasi(gambar: Gambar, hariIni: string): Promise<HasilAI<string>>;
}

/** Gambar dalam base64 (tanpa awalan data:), mis. dari input file di browser. */
export interface Gambar {
  data: string;
  mimeType: string;
}

/** Batas waktu tunggu AI. Lewat dari ini, teks dikembalikan ke kotak input (PRD). */
export const BATAS_WAKTU_MS = 8_000;

const SISTEM_SUARA = `Kamu menerima hasil pengenal suara (bahasa Indonesia) dari orang yang mencatat pengeluaran, misalnya "rasela dua lima" atau "bensin tiga puluh rebu".
Tulis ulang menjadi satu baris berformat "deskripsi nominal" dengan nominal berupa angka rupiah utuh tanpa titik, misalnya "rasela 25000".
Kalau ada beberapa transaksi, pisahkan dengan spasi: "kopi 15000 roti 20000".
Pertahankan deskripsi apa adanya (jangan diterjemahkan atau dibetulkan ejaannya), dan pertahankan kata waktu seperti "kemarin".
Ucapan pendek tanpa satuan untuk jajan sehari-hari biasanya ribuan ("dua lima" = 25000).
Kalau tidak ada nominal yang masuk akal, isi teks dengan string kosong. Jangan mengarang.`;

const SKEMA_SUARA = {
  type: "object",
  properties: { teks: { type: "string" } },
  required: ["teks"],
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

  async function panggil(system: string, isi: ContentListUnion, opsi: { json?: object; batasMs?: number }): Promise<HasilAI<string>> {
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

    async rapikanSuara(teks) {
      const hasil = await panggil(SISTEM_SUARA, teks, { json: SKEMA_SUARA });
      if (!hasil.ok) return hasil;
      try {
        const j = JSON.parse(hasil.data);
        return { ok: true, data: typeof j.teks === "string" ? j.teks.trim().slice(0, 500) : "" };
      } catch {
        return { ok: false, alasan: "error" };
      }
    },

    async bacaMutasi(gambar, hariIni) {
      // Membaca gambar lebih lama dari teks; dipicu tombol, jadi boleh menunggu.
      return panggil(
        SISTEM_MUTASI,
        [{ role: "user", parts: [{ inlineData: { mimeType: gambar.mimeType, data: gambar.data } }, { text: konteksMutasi(hariIni) }] }],
        { json: SKEMA_MUTASI, batasMs: 45_000 },
      );
    },

    async buatAnalisis(ringkasan) {
      // Analisis boleh lebih lama karena dipicu tombol, bukan saat mencatat.
      return panggil(SISTEM_ANALISIS, JSON.stringify(ringkasan), { batasMs: 30_000 });
    },
  };
}

/** Dipakai kalau GEMINI_API_KEY kosong: cadangan suara dan Analisis AI tidak tersedia. */
export const AI_NONAKTIF: LayananAI = {
  aktif: false,
  rapikanSuara: async () => ({ ok: false, alasan: "tidak_aktif" }),
  buatAnalisis: async () => ({ ok: false, alasan: "tidak_aktif" }),
  bacaMutasi: async () => ({ ok: false, alasan: "tidak_aktif" }),
};

/**
 * Bungkus layanan AI dengan kuota: setiap panggilan memakai satu jatah lewat `pakai()`.
 * Kalau jatah habis, hasilnya "kuota" tanpa memanggil AI.
 */
export function denganKuota(ai: LayananAI, pakai: () => Promise<boolean>): LayananAI {
  if (!ai.aktif) return ai;
  return {
    aktif: true,
    rapikanSuara: async (teks) => ((await pakai()) ? ai.rapikanSuara(teks) : { ok: false, alasan: "kuota" }),
    buatAnalisis: async (ringkasan) => ((await pakai()) ? ai.buatAnalisis(ringkasan) : { ok: false, alasan: "kuota" }),
    bacaMutasi: async (gambar, hariIni) => ((await pakai()) ? ai.bacaMutasi(gambar, hariIni) : { ok: false, alasan: "kuota" }),
  };
}
