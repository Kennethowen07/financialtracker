import { describe, expect, test } from "vitest";
import { ubahAngkaKata } from "./angka-kata";
import { bacaInput } from "./parser";

// 15 Oktober 2026, 12.00 WIB
const SEKARANG = new Date("2026-10-15T05:00:00Z");

function items(teks: string) {
  const hasil = bacaInput(teks, SEKARANG);
  if (!hasil.ok) throw new Error(`gagal membaca "${teks}": ${hasil.alasan}`);
  return hasil.items.map((i) => [i.deskripsi, i.nominal]);
}

describe("tabel nominal (kata & bahasa gaul)", () => {
  test.each([
    ["dua puluh lima ribu", 25_000],
    ["dua lima ribu", 25_000],
    ["seratus dua puluh ribu", 120_000],
    ["satu setengah juta", 1_500_000],
    ["seceng", 1_000],
    ["noceng", 2_000],
    ["goceng", 5_000],
    ["ceban", 10_000],
    ["goban", 50_000],
  ])("parkir %s → %d", (ucapan, nominal) => {
    expect(items(`parkir ${ucapan}`)).toEqual([["parkir", nominal]]);
  });

  test("dua lima (tanpa ribu) tidak dianggap nominal", () => {
    expect(bacaInput("rasela dua lima", SEKARANG)).toEqual({ ok: false, alasan: "tanpa_nominal" });
  });
});

describe("kalimat dari tes suara di iPhone", () => {
  test("lima kalimat contoh", () => {
    expect(items("rasela dua puluh lima ribu")).toEqual([["rasela", 25_000]]);
    expect(items("Parkir goceng")).toEqual([["Parkir", 5_000]]);
    expect(items("kopi lima belas ribu roti dua puluh ribu")).toEqual([["kopi", 15_000], ["roti", 20_000]]);
    expect(items("gaji enam juta")).toEqual([["gaji", 6_000_000]]);
    expect(items("grab tiga puluh tiga ribu")).toEqual([["grab", 33_000]]);
  });

  test("hasil iPhone yang sudah berupa angka tetap terbaca", () => {
    expect(items("Kopi 15.000 roti 20.000")).toEqual([["Kopi", 15_000], ["roti", 20_000]]);
  });
});

describe("bentuk lain", () => {
  test.each([
    ["seribu", "1000"],
    ["sejuta", "1000000"],
    ["setengah juta", "500000"],
    ["sepuluh ribu", "10000"],
    ["sebelas ribu", "11000"],
    ["tujuh belas ribu", "17000"],
    ["dua ratus lima puluh ribu", "250000"],
    ["lima belas ribu lima ratus", "15500"],
    ["seribu lima ratus", "1500"],
    ["dua juta lima ratus ribu", "2500000"],
    ["Dua Puluh Ribu", "20000"],
  ])("%s → %s", (kata, angka) => {
    expect(ubahAngkaKata(kata)).toBe(angka);
  });

  test("dua nominal berurutan tanpa kata di antaranya", () => {
    expect(ubahAngkaKata("dua puluh ribu lima belas ribu")).toBe("20000 15000");
  });

  test("kata angka di deskripsi (tanpa satuan) tidak diubah", () => {
    expect(items("sate lima tusuk dua puluh ribu")).toEqual([["sate lima tusuk", 20_000]]);
    expect(items("nasi dua bungkus 30rb")).toEqual([["nasi dua bungkus", 30_000]]);
    expect(ubahAngkaKata("kemarin beli tiga")).toBe("kemarin beli tiga");
  });

  test("kata gaul hanya diganti kalau berdiri sendiri", () => {
    expect(ubahAngkaKata("gocengan")).toBe("gocengan");
  });

  test("angka dengan akhiran rb/ribu tetap dibaca seperti biasa", () => {
    expect(items("bensin 25 ribu")).toEqual([["bensin", 25_000]]);
    expect(items("bensin 25 rb")).toEqual([["bensin", 25_000]]);
  });

  test("bersama tanggal", () => {
    const hasil = bacaInput("kemarin bensin tiga puluh ribu", SEKARANG);
    expect(hasil).toMatchObject({ ok: true, tanggal: "2026-10-14", items: [{ deskripsi: "bensin", nominal: 30_000 }] });
  });
});
