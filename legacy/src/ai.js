import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config } from "./config.js";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./categories.js";
import { guessCategory, parseLocal } from "./parser.js";
import { addDays, rupiah, todayLocal } from "./format.js";
import { getInsight, monthReport, saveInsight } from "./db.js";

const client = config.anthropicEnabled ? new Anthropic() : null;

// Kalau model menolak (stop_reason "refusal"), server otomatis mencoba model cadangan.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };

const expenseNames = EXPENSE_CATEGORIES.map((c) => c.name);
const incomeNames = INCOME_CATEGORIES.map((c) => c.name);

// Sengaja string biasa (bukan z.enum): nilai di luar daftar dirapikan oleh sanitize(),
// jadi satu kategori yang meleset tidak membuat seluruh hasil AI dibuang.
const ParsedMessage = z.object({
  transactions: z.array(
    z.object({
      type: z.string().describe('"expense" atau "income"'),
      amount: z.number().int().describe("nominal rupiah, bilangan bulat positif"),
      category: z.string().describe("salah satu nama kategori dari daftar"),
      description: z.string(),
      date: z.string().describe("YYYY-MM-DD"),
    }),
  ),
  note: z.string(),
});

const PARSE_SYSTEM = `Kamu adalah pencatat keuangan pribadi. User mengirim pesan singkat berbahasa Indonesia (sering informal/singkatan) tentang uang yang baru dikeluarkan atau diterima. Ubah pesan itu menjadi daftar transaksi.

Aturan nominal (rupiah, bilangan bulat):
- "25000", "25.000", "Rp25.000" = 25000
- "25rb", "25 ribu", "25k" = 25000
- "1,5jt", "1.5 juta" = 1500000
- angka dalam kata ("dua puluh ribu") juga dihitung
- kalau ada beberapa angka untuk satu barang ("kopi 2 gelas 30rb"), nominal adalah harga totalnya

Aturan jenis:
- "expense" untuk pengeluaran (default)
- "income" untuk uang masuk: gaji, bonus, dapat/terima transfer, hasil jualan, refund, dsb.

Kategori pengeluaran: ${expenseNames.join(", ")}.
Kategori pemasukan: ${incomeNames.join(", ")}.
Pilih kategori paling masuk akal. Contoh: kuota/pulsa/wifi → Pulsa & Internet; bensin/parkir/ojol → Transportasi; token listrik/kos → Tagihan & Rumah. Pakai "Lainnya" / "Pemasukan Lain" hanya kalau benar-benar tidak cocok.

Aturan lain:
- Satu pesan bisa berisi beberapa transaksi (dipisah koma, baris baru, "dan", dll).
- description: keterangan singkat & rapi dalam bahasa Indonesia, tanpa nominal (mis. "Makan siang", "Kuota internet").
- date: format YYYY-MM-DD. Default hari ini; sesuaikan kalau user menyebut "kemarin", "tadi pagi", "tgl 3", dll. Jangan pernah di masa depan.
- Kalau pesan bukan transaksi atau tidak ada nominalnya, kembalikan transactions kosong dan isi note dengan penjelasan singkat (bahasa Indonesia, ramah). Selain itu note berisi string kosong.`;

const WEEKDAY = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" });

function sanitize(items, today) {
  const isDate = /^\d{4}-\d{2}-\d{2}$/;
  return items
    .filter((t) => Number.isInteger(t.amount) && t.amount > 0)
    .map((t) => {
      const type = t.type === "income" ? "income" : "expense";
      const allowed = type === "income" ? incomeNames : expenseNames;
      let date = isDate.test(t.date) ? t.date : today;
      // tanggal di masa depan atau terlalu jauh ke belakang kemungkinan salah tafsir
      if (date > today || date < addDays(today, -366)) date = today;
      return {
        type,
        amount: t.amount,
        category: allowed.includes(t.category) ? t.category : guessCategory(t.description, type),
        description: t.description.trim().slice(0, 120) || "Tanpa keterangan",
        date,
      };
    });
}

function parseWithoutAI(text, today) {
  return {
    source: "lokal",
    note: "",
    transactions: parseLocal(text).map((t) => ({ ...t, date: today })),
  };
}

function logApiError(context, err) {
  if (err instanceof Anthropic.AuthenticationError) {
    console.error(`[ai] ${context}: API key Anthropic tidak valid`);
  } else if (err instanceof Anthropic.RateLimitError) {
    console.error(`[ai] ${context}: kena rate limit`);
  } else if (err instanceof Anthropic.APIError) {
    console.error(`[ai] ${context}: API error ${err.status}: ${err.message}`);
  } else {
    console.error(`[ai] ${context}:`, err);
  }
}

/**
 * Pesan bebas → transaksi terstruktur.
 * Selalu mengembalikan hasil: kalau AI tidak tersedia/gagal, pakai parser lokal.
 */
export async function parseMessage(text) {
  const today = todayLocal();
  if (!client) return parseWithoutAI(text, today);

  try {
    const response = await client.beta.messages.parse({
      model: config.model,
      max_tokens: 4096,
      output_config: { effort: "low", format: betaZodOutputFormat(ParsedMessage) },
      system: PARSE_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Hari ini: ${today} (${WEEKDAY.format(new Date(`${today}T00:00:00Z`))})\n\n<pesan>\n${text}\n</pesan>`,
        },
      ],
      ...FALLBACK,
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.warn(`[ai] parse tidak menghasilkan output (stop_reason=${response.stop_reason}), pakai parser lokal`);
      return parseWithoutAI(text, today);
    }
    const { transactions, note } = response.parsed_output;
    return { source: "ai", note, transactions: sanitize(transactions, today) };
  } catch (err) {
    logApiError("parse", err);
    return parseWithoutAI(text, today);
  }
}

const INSIGHT_SYSTEM = `Kamu adalah asisten keuangan pribadi yang jujur dan praktis. Kamu menerima ringkasan data keuangan satu bulan dalam JSON (nominal dalam rupiah). Tulis analisis singkat dalam bahasa Indonesia santai untuk pemilik data.

Format (teks biasa, tanpa markdown, tanpa tanda bintang/pagar):
- 1 kalimat pembuka: gambaran umum bulan ini.
- 3–5 poin diawali "• " berisi temuan paling berguna: kategori terbesar, perubahan dibanding bulan lalu, pola harian/kebiasaan yang menonjol, pengeluaran yang tidak biasa.
- 1–2 saran konkret yang realistis, diawali "💡 ".
Tulis nominal sebagai "Rp25.000". Jangan mengarang angka yang tidak ada di data. Kalau datanya masih sedikit, katakan saja dan beri saran yang relevan. Maksimal sekitar 150 kata.`;

function insightPayload(report) {
  const today = todayLocal();
  const daysElapsed = report.month === today.slice(0, 7) ? Number(today.slice(8, 10)) : null;
  return {
    bulan: report.month,
    hari_berjalan: daysElapsed,
    total_pengeluaran: report.totals.expense,
    total_pemasukan: report.totals.income,
    jumlah_transaksi: report.totals.count,
    pembanding_bulan_lalu: {
      periode: report.previousPartial ? `tanggal 1–${daysElapsed} bulan lalu (periode yang sama)` : "bulan lalu penuh",
      pengeluaran: report.previous.expense,
      pemasukan: report.previous.income,
    },
    per_kategori: report.byCategory.map((c) => ({ jenis: c.type, kategori: c.category, total: c.total, jumlah: c.count })),
    harian: report.daily,
    transaksi_terbesar: [...report.transactions]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 15)
      .map((t) => ({ tanggal: t.date, jenis: t.type, kategori: t.category, keterangan: t.description, nominal: t.amount })),
  };
}

function fingerprint(report) {
  const lastId = report.transactions.reduce((max, t) => Math.max(max, t.id), 0);
  return `${report.totals.count}:${report.totals.expense}:${report.totals.income}:${lastId}`;
}

function insightWithoutAI(report) {
  const top = report.byCategory.find((c) => c.type === "expense");
  const monthName = new Date(`${report.month}-01T00:00:00Z`).toLocaleDateString("id-ID", {
    month: "long", year: "numeric", timeZone: "UTC",
  });
  const lines = [
    `${monthName}: pengeluaran ${rupiah(report.totals.expense)}, pemasukan ${rupiah(report.totals.income)}.`,
  ];
  if (top) lines.push(`• Kategori terbesar: ${top.category} (${rupiah(top.total)}).`);
  lines.push("(Analisis AI belum aktif — isi ANTHROPIC_API_KEY di file .env.)");
  return lines.join("\n");
}

/** Analisis AI untuk satu bulan. Hasil di-cache dan hanya dibuat ulang kalau datanya berubah. */
export async function getMonthInsight(month, { force = false } = {}) {
  const report = monthReport(month);
  if (report.totals.count === 0) {
    return { content: "Belum ada transaksi di bulan ini. Kirim pesan ke bot, misalnya \"makan 25000\".", cached: false };
  }
  if (!client) return { content: insightWithoutAI(report), cached: false };

  const fp = fingerprint(report);
  const cached = getInsight(month);
  if (!force && cached?.fingerprint === fp) return { content: cached.content, cached: true };

  try {
    const response = await client.beta.messages.create({
      model: config.model,
      max_tokens: 8000,
      output_config: { effort: "medium" },
      system: INSIGHT_SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(insightPayload(report)) }],
      ...FALLBACK,
    });
    if (response.stop_reason === "refusal") throw new Error("model menolak membuat analisis");

    const content = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!content) throw new Error("respons AI kosong");

    saveInsight(month, fp, content);
    return { content, cached: false };
  } catch (err) {
    logApiError("insight", err);
    return { content: insightWithoutAI(report), cached: false, error: true };
  }
}
