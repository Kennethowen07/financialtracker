// Daftar kategori yang dipakai AI, parser lokal, dan dashboard.
// `keywords` hanya dipakai oleh parser lokal (cadangan saat AI tidak tersedia).

export const EXPENSE_CATEGORIES = [
  {
    name: "Makanan & Minuman",
    icon: "🍜",
    keywords: ["makan", "minum", "kopi", "nasi", "bakso", "mie", "ayam", "sate", "jajan", "snack", "sarapan",
      "lunch", "dinner", "gofood", "grabfood", "shopeefood", "boba", "teh", "es", "roti", "gorengan", "warteg",
      "padang", "martabak", "pizza", "burger", "kfc", "mcd", "starbucks", "galon"],
  },
  {
    name: "Transportasi",
    icon: "🛵",
    keywords: ["bensin", "pertalite", "pertamax", "solar", "parkir", "tol", "ojol", "gojek", "grab", "gocar",
      "goride", "maxim", "taksi", "taxi", "bus", "krl", "mrt", "lrt", "kereta", "pesawat", "transjakarta",
      "angkot", "servis", "service", "ban"],
  },
  {
    name: "Pulsa & Internet",
    icon: "📶",
    keywords: ["kuota", "pulsa", "data", "internet", "wifi", "indihome", "biznet", "telkomsel", "xl",
      "indosat", "smartfren"],
  },
  {
    name: "Belanja",
    icon: "🛍️",
    keywords: ["belanja", "baju", "celana", "sepatu", "tas", "shopee", "tokopedia", "lazada", "indomaret",
      "alfamart", "supermarket", "sabun", "sampo", "skincare", "kosmetik", "elektronik", "charger"],
  },
  {
    name: "Tagihan & Rumah",
    icon: "🏠",
    keywords: ["listrik", "token", "pln", "pdam", "sewa", "kos", "kost", "kontrakan", "cicilan",
      "kredit", "asuransi", "bpjs", "iuran", "laundry", "gas", "elpiji"],
  },
  {
    name: "Hiburan",
    icon: "🎮",
    keywords: ["nonton", "bioskop", "netflix", "spotify", "disney", "game", "topup", "steam", "konser",
      "liburan", "hotel", "karaoke"],
  },
  {
    name: "Kesehatan",
    icon: "💊",
    keywords: ["obat", "dokter", "apotek", "klinik", "vitamin", "gym", "fitness"],
  },
  {
    name: "Pendidikan",
    icon: "📚",
    keywords: ["buku", "kursus", "kuliah", "spp", "ukt", "sekolah", "les", "udemy", "fotokopi", "print"],
  },
  {
    name: "Sosial & Donasi",
    icon: "🎁",
    keywords: ["kado", "sedekah", "donasi", "zakat", "infaq", "kondangan", "traktir", "arisan"],
  },
  { name: "Lainnya", icon: "📦", keywords: [] },
];

export const INCOME_CATEGORIES = [
  { name: "Gaji", icon: "💼", keywords: ["gaji", "salary", "thr"] },
  { name: "Bonus & Hadiah", icon: "🎉", keywords: ["bonus", "hadiah", "dikasih", "angpao", "cashback"] },
  { name: "Usaha & Penjualan", icon: "🏪", keywords: ["jual", "penjualan", "omzet", "untung", "freelance", "proyek", "project"] },
  { name: "Pemasukan Lain", icon: "💰", keywords: [] },
];

// Kata yang menandakan uang masuk (bukan pengeluaran).
export const INCOME_HINTS = ["gaji", "salary", "thr", "bonus", "dapat", "dapet", "terima", "masuk", "dikasih",
  "angpao", "cashback", "jual", "penjualan", "omzet", "freelance", "pemasukan", "income", "refund"];

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export function categoryIcon(name) {
  return ALL_CATEGORIES.find((c) => c.name === name)?.icon ?? "📦";
}
