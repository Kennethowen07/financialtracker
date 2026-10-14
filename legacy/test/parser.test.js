import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLocal, toAmount } from "../src/parser.js";

test("format nominal Indonesia", () => {
  assert.equal(toAmount("25000"), 25000);
  assert.equal(toAmount("25.000"), 25000);
  assert.equal(toAmount("1.250.000"), 1250000);
  assert.equal(toAmount("25", "rb"), 25000);
  assert.equal(toAmount("100", "k"), 100000);
  assert.equal(toAmount("1,5", "jt"), 1500000);
  assert.equal(toAmount("2.5", "juta"), 2500000);
});

test("contoh dari user", () => {
  assert.deepEqual(parseLocal("makan 25000"), [
    { type: "expense", amount: 25000, category: "Makanan & Minuman", description: "makan" },
  ]);
  assert.deepEqual(parseLocal("kuota 100000"), [
    { type: "expense", amount: 100000, category: "Pulsa & Internet", description: "kuota" },
  ]);
});

test("banyak transaksi dalam satu pesan", () => {
  const result = parseLocal("makan siang 25rb, parkir 5000\nbensin pertalite 1,5jt");
  assert.equal(result.length, 3);
  assert.deepEqual(result.map((r) => r.amount), [25000, 5000, 1500000]);
  assert.deepEqual(result.map((r) => r.category), ["Makanan & Minuman", "Transportasi", "Transportasi"]);
});

test("ambil angka terbesar sebagai nominal", () => {
  const [t] = parseLocal("kopi 2 gelas 30rb");
  assert.equal(t.amount, 30000);
  assert.equal(t.description, "kopi 2 gelas");
});

test("deteksi pemasukan", () => {
  const [t] = parseLocal("gaji 5jt");
  assert.equal(t.type, "income");
  assert.equal(t.category, "Gaji");
  assert.equal(t.amount, 5000000);
});

test("pesan tanpa angka diabaikan", () => {
  assert.deepEqual(parseLocal("halo bot"), []);
});

test("kategori tidak dikenal masuk Lainnya", () => {
  const [t] = parseLocal("beli sesuatu 12000");
  assert.equal(t.category, "Lainnya");
});
