"use client";
// Daftar akun untuk admin: siapa saja yang terdaftar dan tombol nonaktifkan/aktifkan.
// Isi transaksi akun lain tidak pernah ditampilkan, hanya jumlahnya.
import { useState } from "react";
import type { BarisPengguna } from "@/lib/akun";

const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

export function DaftarPengguna({ awal, sayaId }: { awal: BarisPengguna[]; sayaId: number }) {
  const [daftar, setDaftar] = useState(awal);
  const [sibuk, setSibuk] = useState<number | null>(null);
  const [galat, setGalat] = useState("");

  async function ubah(p: BarisPengguna) {
    setSibuk(p.id);
    setGalat("");
    try {
      const res = await fetch(`/api/admin/pengguna/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktif: !p.aktif }),
      });
      if (res.ok) setDaftar((lama) => lama.map((x) => (x.id === p.id ? { ...x, aktif: !p.aktif } : x)));
      else setGalat((await res.json().catch(() => ({}))).error ?? "Gagal mengubah akun");
    } catch {
      setGalat("Tidak bisa terhubung ke server");
    }
    setSibuk(null);
  }

  return (
    <section className="kartu" aria-label="Daftar pengguna">
      <span className="kartu-judul">{daftar.length} akun terdaftar</span>
      {galat && <p className="galat" role="alert">{galat}</p>}
      <ul className="daftar-pengguna">
        {daftar.map((p) => (
          <li key={p.id} className={p.aktif ? "pengguna-baris" : "pengguna-baris nonaktif"}>
            <div className="pengguna-teks">
              <span className="pengguna-nama">
                {p.nama}
                {p.admin && <span className="lencana">Admin</span>}
                {!p.aktif && <span className="lencana merah">Nonaktif</span>}
              </span>
              <span className="pengguna-email">{p.email}</span>
              <span className="pengguna-info">
                Daftar {tanggal(p.dibuatPada)} · terakhir masuk {tanggal(p.terakhirMasuk)} · {p.jumlahTransaksi} transaksi
              </span>
            </div>
            {p.id !== sayaId && (
              <button type="button" className="tombol-kecil" disabled={sibuk === p.id} onClick={() => ubah(p)}>
                {p.aktif ? "Nonaktifkan" : "Aktifkan"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
