// Semua urusan tanggal memakai kalender Asia/Jakarta, batas hari jam 00.00.
// Format tanggal di seluruh aplikasi: YYYY-MM-DD.

export const ZONA_WAKTU = "Asia/Jakarta";

const formatTanggal = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_WAKTU });

/** Tanggal hari ini di Jakarta, mis. "2026-10-15". */
export function hariIni(sekarang: Date = new Date()): string {
  return formatTanggal.format(sekarang);
}

export function tambahHari(iso: string, jumlah: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jumlah);
  return d.toISOString().slice(0, 10);
}

export function jumlahHari(tahun: number, bulan: number): number {
  return new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
}

/** "2026-10" → "2026-09" */
export function bulanSebelumnya(bulan: string): string {
  const [t, b] = bulan.split("-").map(Number);
  return b === 1 ? `${t - 1}-12` : `${t}-${String(b - 1).padStart(2, "0")}`;
}

function susun(tahun: number, bulan: number, hari: number): string | null {
  if (bulan < 1 || bulan > 12 || hari < 1 || hari > jumlahHari(tahun, bulan)) return null;
  return `${tahun}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
}

const NAMA_BULAN: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5,
  jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, agt: 8, ags: 8, agustus: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, nov: 11, november: 11, des: 12, desember: 12,
};
const POLA_NAMA_BULAN = Object.keys(NAMA_BULAN).sort((a, b) => b.length - a.length).join("|");

export type HasilTanggal =
  | { ok: true; tanggal: string; dariTeks: boolean; sisa: string }
  | { ok: false; alasan: "tanggal_masa_depan" | "tanggal_tidak_valid"; sisa: string };

interface OpsiMundur {
  /** "tanggal 20" saat hari ini tgl 15 → tanggal 20 bulan lalu */
  bolehMundurBulan?: boolean;
  /** "3 des" saat bulan Oktober → Desember tahun lalu */
  bolehMundurTahun?: boolean;
}

/**
 * Mencari keterangan tanggal di teks lalu membuangnya dari teks.
 * Contoh: "kemarin makan 25000" → tanggal kemarin, sisa "makan 25000".
 * Tanpa keterangan tanggal → hari ini.
 */
export function bacaTanggal(teks: string, sekarang: Date = new Date()): HasilTanggal {
  const today = hariIni(sekarang);
  const [tahunIni, bulanIni] = today.split("-").map(Number);

  const hasil = (tanggal: string | null, cocok: string, opsi: OpsiMundur = {}): HasilTanggal => {
    const sisa = rapikan(teks.replace(cocok, " "));
    if (!tanggal) return { ok: false, alasan: "tanggal_tidak_valid", sisa };
    let t: string | null = tanggal;
    if (t > today && (opsi.bolehMundurBulan || opsi.bolehMundurTahun)) {
      const [y, m, d] = t.split("-").map(Number);
      if (opsi.bolehMundurBulan) t = m === 1 ? susun(y - 1, 12, d) : susun(y, m - 1, d);
      else t = susun(y - 1, m, d);
      if (!t) return { ok: false, alasan: "tanggal_tidak_valid", sisa };
    }
    if (t > today) return { ok: false, alasan: "tanggal_masa_depan", sisa };
    return { ok: true, tanggal: t, dariTeks: true, sisa };
  };

  let m: RegExpMatchArray | null;

  // "3 okt", "tanggal 3 oktober 2026", "tgl 3 okt"
  m = teks.match(new RegExp(`(?:\\b(?:tanggal|tgl)\\.?\\s*)?\\b(\\d{1,2})\\s+(${POLA_NAMA_BULAN})\\b(?:\\s+(\\d{4})\\b)?`, "i"));
  if (m) {
    const tahun = m[3] ? Number(m[3]) : tahunIni;
    return hasil(susun(tahun, NAMA_BULAN[m[2].toLowerCase()], Number(m[1])), m[0], { bolehMundurTahun: !m[3] });
  }

  // "3/10", "03-10-2026", "tgl 3/10"
  m = teks.match(/(?:\b(?:tanggal|tgl)\.?\s*)?\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}|\d{2}))?(?![\d/-])/i);
  if (m) {
    const tahun = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : tahunIni;
    return hasil(susun(tahun, Number(m[2]), Number(m[1])), m[0], { bolehMundurTahun: !m[3] });
  }

  // "tanggal 3", "tgl 3", "tgl. 3"
  m = teks.match(/\b(?:tanggal|tgl)\.?\s*(\d{1,2})\b/i);
  if (m) return hasil(susun(tahunIni, bulanIni, Number(m[1])), m[0], { bolehMundurBulan: true });

  // Kata relatif
  m = teks.match(/\b(\d{1,2})\s+hari\s+(?:yang\s+)?lalu\b/i);
  if (m) return hasil(tambahHari(today, -Number(m[1])), m[0]);

  m = teks.match(/\b(?:kemarin\s+lusa|lusa\s+kemarin)\b/i);
  if (m) return hasil(tambahHari(today, -2), m[0]);

  m = teks.match(/\b(?:kemarin|kmrn|kmarin)\b/i);
  if (m) return hasil(tambahHari(today, -1), m[0]);

  m = teks.match(/\b(?:besok|lusa)\b/i);
  if (m) return { ok: false, alasan: "tanggal_masa_depan", sisa: rapikan(teks.replace(m[0], " ")) };

  m = teks.match(/\bhari\s+ini\b/i);
  if (m) return { ok: true, tanggal: today, dariTeks: true, sisa: rapikan(teks.replace(m[0], " ")) };

  return { ok: true, tanggal: today, dariTeks: false, sisa: rapikan(teks) };
}

function rapikan(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
