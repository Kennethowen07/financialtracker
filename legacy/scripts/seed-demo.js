// Isi database dengan data contoh supaya dashboard bisa dicoba tanpa bot.
// Pakai database terpisah:  npm run demo:seed  (menulis ke data/demo.db)
import { insertTransactions } from "../src/db.js";
import { config } from "../src/config.js";
import { addDays, todayLocal } from "../src/format.js";

if (!/demo/i.test(config.dbPath)) {
  console.error("Supaya data asli tidak tercampur, jalankan dengan DB_PATH yang mengandung kata 'demo', mis. data/demo.db");
  process.exit(1);
}

const samples = [
  ["expense", 25000, "Makanan & Minuman", "Makan siang"],
  ["expense", 18000, "Makanan & Minuman", "Kopi susu"],
  ["expense", 32000, "Makanan & Minuman", "Nasi padang"],
  ["expense", 15000, "Transportasi", "Ojol ke kantor"],
  ["expense", 30000, "Transportasi", "Bensin"],
  ["expense", 5000, "Transportasi", "Parkir"],
  ["expense", 100000, "Pulsa & Internet", "Kuota internet"],
  ["expense", 150000, "Belanja", "Belanja bulanan Indomaret"],
  ["expense", 54000, "Hiburan", "Langganan Netflix"],
  ["expense", 50000, "Hiburan", "Nonton bioskop"],
  ["expense", 200000, "Tagihan & Rumah", "Token listrik"],
  ["expense", 45000, "Kesehatan", "Obat flu"],
];

const today = todayLocal();
let count = 0;
for (let back = 45; back >= 0; back--) {
  const date = addDays(today, -back);
  const day = Number(date.slice(8, 10));
  const picks = samples.filter((_, i) => (i * 7 + day * 3) % 5 === 0 || (i < 2 && day % 2 === 0));
  const items = picks.map(([type, amount, category, description]) => ({ type, amount, category, description, date }));
  if (day === 1) items.push({ type: "income", amount: 6_500_000, category: "Gaji", description: "Gaji bulanan", date });
  if (day === 20) items.push({ type: "income", amount: 750_000, category: "Usaha & Penjualan", description: "Freelance desain", date });
  if (items.length) count += insertTransactions("demo", items, "(data demo)", "ai").length;
}
console.log(`Selesai: ${count} transaksi demo ditambahkan ke ${config.dbPath}`);
