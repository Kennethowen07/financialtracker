// Membaca teks bebas tanpa AI: tanggal, nominal, dan pemecahan per nominal.
// Aturan: docs/PRD.md bagian "Aturan membaca input" + docs/KEPUTUSAN.md no. 1–2.
// Diturunkan dari legacy/src/parser.js (toAmount).
import { bacaTanggal } from "./tanggal";

export type Jenis = "pengeluaran" | "pemasukan" | "investasi" | "usaha";
export const SEMUA_JENIS: Jenis[] = ["pengeluaran", "pemasukan", "investasi", "usaha"];

export interface ItemTerbaca {
  deskripsi: string;
  nominal: number;
  /** Hanya terisi kalau jenisnya pasti dari teks (tanda +). Selain itu ditentukan memori/AI. */
  jenisPasti: Jenis | null;
}

export type AlasanGagalBaca = "kosong" | "tanpa_nominal" | "tanggal_masa_depan" | "tanggal_tidak_valid";

export type HasilBaca =
  | { ok: true; tanggal: string; tanggalDariTeks: boolean; items: ItemTerbaca[] }
  | { ok: false; alasan: AlasanGagalBaca };

const PENGALI: Record<string, number> = { rb: 1_000, ribu: 1_000, k: 1_000, jt: 1_000_000, juta: 1_000_000 };
const NOMINAL_MAKS = 1_000_000_000_000;

/** "25.000" → 25000, ("25", "rb") → 25000, ("1,5", "jt") → 1500000 */
export function keNominal(angka: string, akhiran?: string): number {
  if (akhiran) {
    return Math.round(parseFloat(angka.replace(",", ".")) * PENGALI[akhiran.toLowerCase()]);
  }
  // Titik/koma sebagai pemisah ribuan: "25.000", "1.250.000", "25,000"
  if (/^\d{1,3}([.,]\d{3})+$/.test(angka)) return Number(angka.replace(/[.,]/g, ""));
  return Math.round(parseFloat(angka.replace(",", ".")));
}

// Kandidat nominal: (+)(rp)angka(akhiran), tidak menempel ke huruf/angka di kiri maupun kanan.
// Contoh yang BUKAN nominal: "25kg" (akhiran k menempel huruf), "a4".
const POLA_NOMINAL = /(?<![\p{L}\d.,])(\+)?(?:rp\.?\s?)?(\d+(?:[.,]\d+)*)(?:\s?(ribu|rb|juta|jt|k))?(?![\p{L}\d])/giu;

// Kata/tanda penghubung yang dibuang dari ujung deskripsi.
const PENGHUBUNG_AWAL = /^(?:[\s,;:+=&-]|dan\s|sama\s)+/iu;
const PENGHUBUNG_AKHIR = /(?:[\s,;:+=&-]|\sdan|\ssama)+$/iu;

function rapikanDeskripsi(s: string): string {
  let hasil = ` ${s.replace(/\s+/g, " ")} `;
  hasil = hasil.replace(PENGHUBUNG_AWAL, "").replace(PENGHUBUNG_AKHIR, "");
  return hasil.trim();
}

/**
 * "kopi 15000 roti 25000" → 2 item, "kopi roti 35000" → 1 item ("kopi roti").
 * Angka < 1.000 tanpa akhiran (mis. "2 gelas") tetap bagian deskripsi.
 */
export function bacaInput(teks: string, sekarang: Date = new Date()): HasilBaca {
  if (!teks.trim()) return { ok: false, alasan: "kosong" };

  const t = bacaTanggal(teks, sekarang);
  if (!t.ok) return { ok: false, alasan: t.alasan };

  const nominal: { mulai: number; akhir: number; nilai: number; plus: boolean }[] = [];
  for (const m of t.sisa.matchAll(POLA_NOMINAL)) {
    const nilai = keNominal(m[2], m[3]);
    const plus = Boolean(m[1]);
    const lolos = Boolean(m[3]) || plus || nilai >= 1_000;
    if (!lolos || !Number.isFinite(nilai) || nilai <= 0 || nilai > NOMINAL_MAKS) continue;
    nominal.push({ mulai: m.index!, akhir: m.index! + m[0].length, nilai, plus });
  }
  if (nominal.length === 0) return { ok: false, alasan: "tanpa_nominal" };

  const items: ItemTerbaca[] = nominal.map((n, i) => ({
    deskripsi: rapikanDeskripsi(t.sisa.slice(i === 0 ? 0 : nominal[i - 1].akhir, n.mulai)),
    nominal: n.nilai,
    jenisPasti: n.plus ? "pemasukan" : null,
  }));

  // Teks setelah nominal terakhir ("makan 25000 di warteg", "25000 makan")
  // digabung ke deskripsi item terakhir.
  const ekor = rapikanDeskripsi(t.sisa.slice(nominal[nominal.length - 1].akhir));
  if (ekor) {
    const terakhir = items[items.length - 1];
    terakhir.deskripsi = rapikanDeskripsi(`${terakhir.deskripsi} ${ekor}`);
  }

  for (const item of items) {
    if (!item.deskripsi) item.deskripsi = item.jenisPasti === "pemasukan" ? "pemasukan" : "tanpa keterangan";
  }

  return { ok: true, tanggal: t.tanggal, tanggalDariTeks: t.dariTeks, items };
}
