// Mengubah nominal yang ditulis/diucapkan dengan kata menjadi angka, sebelum dibaca parser.
//   "dua puluh lima ribu" → "25000", "dua lima ribu" → "25000", "satu setengah juta" → "1500000",
//   "goceng" → "5000".
// Kata angka TANPA satuan ribu/juta ("dua lima", "sate lima tusuk") dibiarkan apa adanya,
// karena terlalu ambigu (docs/PRD.md bagian "Aturan membaca input").

const GAUL: Record<string, number> = {
  seceng: 1_000,
  noceng: 2_000,
  goceng: 5_000,
  ceban: 10_000,
  goban: 50_000,
};

const DIGIT: Record<string, number> = {
  nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9,
};
const TETAP: Record<string, number> = { sepuluh: 10, sebelas: 11, seratus: 100 };
const SATUAN: Record<string, number> = { ribu: 1_000, rb: 1_000, juta: 1_000_000, jt: 1_000_000 };
const SATUAN_SE: Record<string, number> = { seribu: 1_000, sejuta: 1_000_000 };

const SEMUA_KATA = [
  ...Object.keys(DIGIT), ...Object.keys(TETAP), ...Object.keys(SATUAN), ...Object.keys(SATUAN_SE),
  "puluh", "belas", "ratus", "setengah",
].join("|");
// Deretan kata angka berurutan, mis. "dua puluh lima ribu".
const POLA_DERET = new RegExp(`(?<![\\p{L}\\d])(?:${SEMUA_KATA})(?:\\s+(?:${SEMUA_KATA}))*(?![\\p{L}\\d])`, "giu");
const POLA_GAUL = new RegExp(`(?<![\\p{L}\\d])(?:${Object.keys(GAUL).join("|")})(?![\\p{L}\\d])`, "giu");

/**
 * Satu deret kata angka → teks pengganti. Satu deret bisa berisi beberapa nominal
 * ("dua puluh ribu lima belas ribu" → "20000 15000"). Kata di ujung yang tidak diikuti
 * satuan dikembalikan sebagai kata ("dua puluh ribu dua" → "20000 dua").
 */
function ubahDeret(deret: string): string {
  const asli = deret.split(/\s+/);
  const kata = asli.map((k) => k.toLowerCase());
  const hasil: string[] = [];
  let total = 0; // nominal yang sedang disusun
  let satuanTerakhir = Infinity; // satuan terakhir yang dipakai, untuk tahu kapan nominal baru dimulai
  let kelompok = 0; // bagian < 1000 yang sudah pasti ("dua ratus")
  let suku = 0; // angka yang masih bisa dikalikan puluh/belas/ratus
  let digitPolos = false; // kata sebelumnya digit tanpa pengali ("dua lima ribu")
  let setengah = false;
  let mulaiSisa = 0; // kata pertama yang belum masuk nominal mana pun

  const tutup = () => {
    if (total > 0) hasil.push(String(Math.round(total)));
    total = 0;
    satuanTerakhir = Infinity;
  };

  kata.forEach((k, i) => {
    const satuan = SATUAN[k] ?? SATUAN_SE[k];
    if (satuan) {
      const angka = SATUAN_SE[k] ? 1 : kelompok + suku + (setengah ? 0.5 : 0);
      if (angka === 0) return; // "ribu" tanpa angka di depannya: bukan nominal
      // Satuan yang sama atau lebih besar dari sebelumnya → nominal baru.
      if (satuan >= satuanTerakhir) tutup();
      total += angka * satuan;
      satuanTerakhir = satuan;
      kelompok = suku = 0;
      digitPolos = setengah = false;
      mulaiSisa = i + 1;
      return;
    }
    if (k in DIGIT) {
      if (digitPolos) suku = suku * 10 + DIGIT[k];
      else {
        kelompok += suku;
        suku = DIGIT[k];
      }
      digitPolos = true;
      return;
    }
    digitPolos = false;
    if (k in TETAP) {
      kelompok += suku + TETAP[k];
      suku = 0;
    } else if (k === "puluh") {
      kelompok += suku * 10;
      suku = 0;
    } else if (k === "belas") {
      kelompok += suku + 10;
      suku = 0;
    } else if (k === "ratus") {
      kelompok += suku * 100;
      suku = 0;
    } else if (k === "setengah") {
      setengah = true;
    }
  });

  // Ekor ratusan setelah satuan ikut nominal ("lima belas ribu lima ratus" → 15500).
  const ekor = kelompok + suku;
  if (total > 0 && ekor >= 100 && ekor < satuanTerakhir) {
    total += ekor;
    mulaiSisa = kata.length;
  }
  tutup();
  return [...hasil, ...asli.slice(mulaiSisa)].join(" ");
}

/** Ganti nominal dalam kata/bahasa gaul dengan angka. Teks lain tidak diubah. */
export function ubahAngkaKata(teks: string): string {
  return teks
    .replace(POLA_GAUL, (k) => String(GAUL[k.toLowerCase()]))
    .replace(POLA_DERET, (deret) => {
      // Tanpa satuan sama sekali → bukan nominal, biarkan.
      const adaSatuan = deret.toLowerCase().split(/\s+/).some((k) => k in SATUAN || k in SATUAN_SE);
      return adaSatuan ? ubahDeret(deret) : deret;
    });
}
