// Parser lokal tanpa AI. Dipakai sebagai cadangan kalau API Claude tidak tersedia/gagal,
// dan untuk memvalidasi nominal yang dikembalikan AI.
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, INCOME_HINTS } from "./categories.js";

const MULTIPLIER = { rb: 1_000, ribu: 1_000, k: 1_000, jt: 1_000_000, juta: 1_000_000 };
const AMOUNT_RE = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(ribu|rb|k|juta|jt)?(?![a-z])/gi;

/** Ubah satu token angka ("25.000", "25rb", "1,5jt") menjadi rupiah bulat. */
export function toAmount(numberPart, suffix) {
  if (suffix) {
    const value = parseFloat(numberPart.replace(",", "."));
    return Math.round(value * MULTIPLIER[suffix.toLowerCase()]);
  }
  // "25.000" / "1.250.000" / "25,000" → pemisah ribuan
  if (/^\d{1,3}([.,]\d{3})+$/.test(numberPart)) {
    return Number(numberPart.replace(/[.,]/g, ""));
  }
  return Math.round(parseFloat(numberPart.replace(",", ".")));
}

/** Semua nominal yang ditemukan dalam teks. */
export function findAmounts(text) {
  return [...text.matchAll(AMOUNT_RE)].map((m) => ({
    match: m[0],
    amount: toAmount(m[1], m[2]),
  }));
}

function tokens(text) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function matchesKeyword(words, lowered, keyword) {
  if (keyword.includes(" ")) return lowered.includes(keyword);
  return words.some((w) => w === keyword || (keyword.length >= 4 && w.startsWith(keyword)));
}

export function guessCategory(description, type) {
  const lowered = description.toLowerCase();
  const words = tokens(description);
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const found = categories.find((c) => c.keywords.some((k) => matchesKeyword(words, lowered, k)));
  return found?.name ?? categories[categories.length - 1].name;
}

function parseSegment(segment) {
  const amounts = findAmounts(segment);
  if (amounts.length === 0) return null;

  // Kalau ada beberapa angka ("kopi 2 gelas 30rb"), nominal = angka terbesar.
  const main = amounts.reduce((a, b) => (b.amount > a.amount ? b : a));
  if (!Number.isFinite(main.amount) || main.amount <= 0) return null;

  const description =
    segment.replace(main.match, " ").replace(/\s+/g, " ").replace(/^[\s:=-]+|[\s:=-]+$/g, "").trim() ||
    "Tanpa keterangan";
  const words = tokens(description);
  const type = INCOME_HINTS.some((hint) => words.includes(hint)) ? "income" : "expense";

  return { type, amount: main.amount, category: guessCategory(description, type), description };
}

/**
 * "makan 25rb, parkir 5000\nkuota 100k" → 3 transaksi.
 * Koma hanya dianggap pemisah jika tidak diikuti angka (supaya "1,5jt" tidak terpotong).
 */
export function parseLocal(text) {
  return text
    .split(/\n|;|,(?!\d)|\s+dan\s+|\s+\+\s+/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseSegment)
    .filter(Boolean);
}
