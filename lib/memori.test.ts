import { describe, expect, test } from "vitest";
import { cariMemori, cocokkan, jarakEdit, normalisasi, simpanMemori, type EntriMemori } from "./memori";
import { buatDbUji, buatPenggunaUji, idKategori } from "./db-uji";

describe("normalisasi", () => {
  test("huruf kecil, tanda baca & spasi dirapikan", () => {
    expect(normalisasi("  Bakmi   Effata!! ")).toBe("bakmi effata");
    expect(normalisasi("Kopi-Gereja")).toBe("kopi gereja");
    expect(normalisasi("Makanan & Minuman")).toBe("makanan & minuman");
  });
});

describe("jarakEdit", () => {
  test("contoh dasar", () => {
    expect(jarakEdit("bakmi efata", "bakmi effata")).toBe(1);
    expect(jarakEdit("kopi", "kopi")).toBe(0);
    expect(jarakEdit("kopi gereja", "kopi kenangan")).toBeGreaterThan(2);
  });
});

describe("cocokkan (tanpa database)", () => {
  const daftar: EntriMemori[] = [
    { id: 1, kataKunci: "bakmi effata", jenis: "pengeluaran", kategoriId: 1 },
    { id: 2, kataKunci: "kopi gereja", jenis: "pengeluaran", kategoriId: 1 },
    { id: 3, kataKunci: "kopi arabica", jenis: "pengeluaran", kategoriId: 4 },
    { id: 4, kataKunci: "tol", jenis: "pengeluaran", kategoriId: 2 },
    { id: 5, kataKunci: "parkir", jenis: "pengeluaran", kategoriId: 2 },
  ];

  test("persis setelah normalisasi", () => {
    expect(cocokkan("Kopi Gereja", daftar)).toMatchObject({ id: 2, cara: "persis" });
  });

  test("typo 'bakmi efata' ketemu 'bakmi effata' (PRD)", () => {
    expect(cocokkan("bakmi efata", daftar)).toMatchObject({ id: 1, cara: "mirip" });
  });

  test("'kopi gereja' dan 'kopi arabica' tetap dua entri berbeda", () => {
    expect(cocokkan("kopi arabica", daftar)).toMatchObject({ id: 3 });
    expect(cocokkan("kopi kenangan", daftar)).toBeNull();
  });

  test("deskripsi pendek (< 5 huruf) harus persis", () => {
    expect(cocokkan("tol", daftar)).toMatchObject({ id: 4 });
    expect(cocokkan("tok", daftar)).toBeNull();
  });

  test("deskripsi 5–8 huruf toleransi 1 huruf", () => {
    expect(cocokkan("parkit", daftar)).toMatchObject({ id: 5, cara: "mirip" });
    expect(cocokkan("pakrit", daftar)).toBeNull();
  });

  test("dua kandidat sama dekat dengan kategori beda → tidak dianggap cocok", () => {
    const ambigu: EntriMemori[] = [
      { id: 1, kataKunci: "kopi abc", jenis: "pengeluaran", kategoriId: 1 },
      { id: 2, kataKunci: "kopi abd", jenis: "pengeluaran", kategoriId: 4 },
    ];
    expect(cocokkan("kopi abe", ambigu)).toBeNull();
  });
});

describe("memori di database", () => {
  test("simpan lalu cari, termasuk typo", async () => {
    const db = await buatDbUji();
    const uid = await buatPenggunaUji(db);
    const makan = await idKategori(db, "Makanan & Minuman");
    await simpanMemori(db, uid, { deskripsi: "Bakmi Effata", jenis: "pengeluaran", kategoriId: makan, asal: "tanya_balik" });

    expect(await cariMemori(db, uid, "bakmi effata")).toMatchObject({ kategoriId: makan, cara: "persis" });
    expect(await cariMemori(db, uid, "bakmi efata")).toMatchObject({ kategoriId: makan, cara: "mirip" });
    expect(await cariMemori(db, uid, "rasela")).toBeNull();
  });

  test("simpan ulang deskripsi yang sama memperbarui kategori (koreksi)", async () => {
    const db = await buatDbUji();
    const uid = await buatPenggunaUji(db);
    const makan = await idKategori(db, "Makanan & Minuman");
    const belanja = await idKategori(db, "Belanja");
    await simpanMemori(db, uid, { deskripsi: "rasela", jenis: "pengeluaran", kategoriId: makan, asal: "ai" });
    await simpanMemori(db, uid, { deskripsi: "rasela", jenis: "pengeluaran", kategoriId: belanja, asal: "koreksi" });

    expect(await cariMemori(db, uid, "rasela")).toMatchObject({ kategoriId: belanja });
    const { rows } = await db.execute("SELECT COUNT(*) AS n FROM memori");
    expect(Number(rows[0].n)).toBe(1);
  });

  test("jenis usaha disimpan tanpa kategori", async () => {
    const db = await buatDbUji();
    const uid = await buatPenggunaUji(db);
    const gaji = await idKategori(db, "Gaji");
    await simpanMemori(db, uid, { deskripsi: "gaji budi", jenis: "usaha", kategoriId: gaji, asal: "tanya_balik" });
    expect(await cariMemori(db, uid, "gaji budi")).toMatchObject({ jenis: "usaha", kategoriId: null });
  });
});
