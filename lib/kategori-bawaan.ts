// Daftar kategori awal sesuai tabel "Jenis | Kategori" di docs/PRD.md.
// `ikon` adalah kunci yang nanti dicocokkan ke gambar SVG di komponen React.
// Kunci yang sama dengan desain (docs/design/02-tanya-balik): makan, transport,
// belanja, pulsa, tagihan, hiburan, langganan.

export type JenisBerkategori = "pengeluaran" | "pemasukan" | "investasi";

export interface KategoriBawaan {
  nama: string;
  jenis: JenisBerkategori;
  ikon: string;
}

export const KATEGORI_BAWAAN: KategoriBawaan[] = [
  // Pengeluaran
  { nama: "Makanan & Minuman", jenis: "pengeluaran", ikon: "makan" },
  { nama: "Transportasi", jenis: "pengeluaran", ikon: "transport" },
  { nama: "Pulsa & Internet", jenis: "pengeluaran", ikon: "pulsa" },
  { nama: "Belanja", jenis: "pengeluaran", ikon: "belanja" },
  { nama: "Top up", jenis: "pengeluaran", ikon: "topup" },
  { nama: "Tagihan & Rumah", jenis: "pengeluaran", ikon: "tagihan" },
  { nama: "Hiburan", jenis: "pengeluaran", ikon: "hiburan" },
  { nama: "Langganan", jenis: "pengeluaran", ikon: "langganan" },
  { nama: "Kesehatan", jenis: "pengeluaran", ikon: "kesehatan" },
  { nama: "Pendidikan", jenis: "pengeluaran", ikon: "pendidikan" },
  { nama: "Sosial & Donasi", jenis: "pengeluaran", ikon: "sosial" },
  { nama: "Lainnya", jenis: "pengeluaran", ikon: "lainnya" },
  // Pemasukan
  { nama: "Gaji", jenis: "pemasukan", ikon: "gaji" },
  { nama: "Bonus & Hadiah", jenis: "pemasukan", ikon: "bonus" },
  { nama: "Usaha & Penjualan", jenis: "pemasukan", ikon: "penjualan" },
  { nama: "Pemasukan Lain", jenis: "pemasukan", ikon: "pemasukan-lain" },
  // Investasi
  { nama: "Saham", jenis: "investasi", ikon: "saham" },
  { nama: "Kripto", jenis: "investasi", ikon: "kripto" },
];
