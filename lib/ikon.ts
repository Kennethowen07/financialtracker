// Path SVG ikon (gaya garis 2px, viewBox 24). Kunci = kolom `ikon` di tabel kategori.
// Ikon kategori dari docs/design/02-tanya-balik dan 05-dashboard-laptop disalin persis;
// sisanya dibuat dengan gaya yang sama.

export const IKON: Record<string, string[]> = {
  // kategori (dari desain)
  makan: ["M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z", "M17 9h2a2 2 0 0 1 0 4h-2"],
  transport: ["M5 16h14v-4l-2-5H7l-2 5z", "M5 12h14", "M7 16v3M17 16v3"],
  belanja: ["M6 8h12l-1 12H7z", "M9 8a3 3 0 0 1 6 0"],
  pulsa: ["M2 9a15 15 0 0 1 20 0", "M5 12.5a10 10 0 0 1 14 0", "M8.5 16a5 5 0 0 1 7 0", "M12 19.5h.01"],
  tagihan: ["M4 11l8-7 8 7v9H4z", "M10 20v-5h4v5"],
  hiburan: ["M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0z", "M10 9l5 3-5 3z"],
  langganan: ["M17 3l4 4-4 4", "M3 11V9a2 2 0 0 1 2-2h16", "M7 21l-4-4 4-4", "M21 13v2a2 2 0 0 1-2 2H3"],
  sosial: ["M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"],
  semua: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],

  // kategori lain
  topup: ["M3 7h18v12H3z", "M16 13h2", "M3 7l12-4v4"],
  kesehatan: ["M12 5v14M5 12h14"],
  pendidikan: ["M3 9l9-5 9 5-9 5z", "M7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5"],
  lainnya: ["M5 12h.01M12 12h.01M19 12h.01"],
  gaji: ["M4 8h16v11H4z", "M9 8V5h6v3", "M4 13h16"],
  bonus: ["M4 10h16v10H4z", "M3 7h18v3H3z", "M12 7v13", "M12 7c-2-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3-2-5 1"],
  penjualan: ["M4 10l1-5h14l1 5", "M5 10v9h14v-9", "M9 19v-5h6v5"],
  "pemasukan-lain": ["M12 8v8M8 12h8", "M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0z"],
  saham: ["M3 17l6-6 4 4 8-8", "M15 7h6v6"],
  kripto: ["M9 6v12M13 6v2M13 16v2", "M8 8h6a2 2 0 0 1 0 4H8", "M8 12h7a2 2 0 0 1 0 4H8"],
  usaha: ["M4 8h16v11H4z", "M9 8V5h6v3"],
  tanya: ["M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7", "M12 17h.01"],

  // antarmuka
  bintang: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"],
  dasbor: ["M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"],
  menu: ["M4 6h16M4 12h16M4 18h10"],
  kirim: ["M5 12h14M13 6l6 6-6 6"],
  tutup: ["M6 6l12 12M18 6L6 18"],
  bawah: ["M6 9l6 6 6-6"],
  kiri: ["M15 18l-6-6 6-6"],
  kanan: ["M9 18l6-6-6-6"],
  naik: ["M12 19V5M5 12l7-7 7 7"],
  turun: ["M12 5v14M19 12l-7 7-7-7"],
  masuk: ["M17 7L7 17M7 9v8h8"],
  keluar: ["M7 17L17 7M9 7h8v8"],
  kalender: ["M4 6h16v14H4z", "M4 10h16M9 3v4M15 3v4"],
  pensil: ["M4 20h4L19 9l-4-4L4 16z"],
  segarkan: ["M20 11a8 8 0 1 0-2.3 5.7", "M20 5v6h-6"],
  memproses: ["M21 12a9 9 0 1 1-6.2-8.6"],
  tren: ["M3 17l6-6 4 4 8-8"],
  pengguna: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6"],
};

export function pathIkon(kunci: string | null | undefined): string[] {
  return IKON[kunci ?? ""] ?? IKON.lainnya;
}

/** Tujuh kategori pengeluaran yang tampil langsung di panel tanya balik (sisanya lewat "Semua"). */
export const IKON_UTAMA = ["makan", "transport", "belanja", "pulsa", "tagihan", "hiburan", "langganan"];
