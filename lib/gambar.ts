"use client";
// Kecilkan screenshot di browser sebelum diunggah: lebar maksimal 1000 px, JPEG.
// Screenshot iPhone (PNG ~1-3 MB) jadi ~150-300 KB: lebih cepat di jaringan HP dan aman di
// bawah batas ukuran request Vercel. Teks mutasi tetap terbaca jelas di lebar ini.
import type { Gambar } from "./ai";

const LEBAR_MAKS = 1000;
const TINGGI_MAKS = 8000; // screenshot panjang (scroll) tetap muat

export async function kecilkanGambar(file: File): Promise<Gambar> {
  const bitmap = await createImageBitmap(file);
  const skala = Math.min(1, LEBAR_MAKS / bitmap.width, TINGGI_MAKS / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * skala);
  canvas.height = Math.round(bitmap.height * skala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak bisa memproses gambar");
  ctx.fillStyle = "#fff"; // PNG transparan jangan jadi hitam
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { data: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType: "image/jpeg" };
}
