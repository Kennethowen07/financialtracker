"use client";
// Halaman Analisis AI (docs/design/05b): tombol Perbarui, kartu ringkasan, "Paling sering".
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InfoAkun } from "@/lib/akun";
import type { Analisis } from "@/lib/analisis";
import type { RingkasanBulan } from "@/lib/laporan";
import { namaBulan, rupiah } from "@/lib/format";
import { PemilihBulan } from "./Bagian";
import { Ikon } from "./Ikon";
import { Kerangka } from "./Kerangka";

interface Props {
  bulan: string;
  bulanIni: string;
  analisis: Analisis | null;
  palingSering: RingkasanBulan["palingSering"];
  aiAktif: boolean;
  akun: InfoAkun;
}

export function AnalisisAI({ bulan, bulanIni, analisis: awal, palingSering, aiAktif, akun }: Props) {
  const router = useRouter();
  const [analisis, setAnalisis] = useState(awal);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  async function perbarui() {
    setSibuk(true);
    setGalat("");
    try {
      const res = await fetch("/api/analisis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulan }),
      });
      if (res.status === 401) return router.push("/masuk");
      const data = await res.json();
      if (!res.ok) setGalat(data.error ?? "Gagal membuat analisis");
      else setAnalisis(data);
    } catch {
      setGalat("Tidak bisa terhubung ke server");
    } finally {
      setSibuk(false);
    }
  }

  // Satu paragraf per kalimat, seperti di desain.
  const kalimat = analisis?.isi.split(/(?<=[.!?])\s+/).filter(Boolean) ?? [];

  return (
    <Kerangka aktif="analisis" akun={akun}>
      <header className="atas analisis-atas">
        <div className="atas-kiri">
          <Link href="/" className="tombol-bulat kembali" aria-label="Kembali ke dashboard">
            <Ikon nama="kiri" ukuran={20} />
          </Link>
          <PemilihBulan bulan={bulan} bulanIni={bulanIni} onPilih={(b) => router.push(`/analisis?bulan=${b}`)} />
        </div>
        <button type="button" className="tombol-utama dengan-ikon" onClick={perbarui} disabled={sibuk || !aiAktif}>
          <Ikon nama="segarkan" ukuran={16} tebal={2.2} className={sibuk ? "berputar" : undefined} />
          {sibuk ? "Menganalisis…" : "Perbarui"}
        </button>
      </header>

      <main className="analisis-grid">
        <section className="kartu kartu-analisis" aria-label="Ringkasan dari AI" aria-busy={sibuk}>
          <div className="analisis-kepala">
            <span className="analisis-judul">
              <Ikon nama="bintang" ukuran={20} />
              Ringkasan {namaBulan(bulan)}
            </span>
          </div>
          {!aiAktif && (
            <p className="analisis-teks redup">AI belum aktif. Isi <code>GEMINI_API_KEY</code> supaya analisis bisa dibuat.</p>
          )}
          {aiAktif && !analisis && !galat && (
            <p className="analisis-teks redup">Belum ada analisis untuk bulan ini. Tekan <b>Perbarui</b> untuk membuatnya.</p>
          )}
          {kalimat.map((k, i) => <p key={i} className="analisis-teks">{k}</p>)}
          {galat && <p className="galat" role="alert">{galat}</p>}
          {analisis && (
            <span className="analisis-waktu">
              Dibuat {new Date(analisis.dibuatPada).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })}
            </span>
          )}
        </section>

        <section className="kartu" aria-label="Paling sering">
          <h2 className="kartu-judul">Paling sering</h2>
          {palingSering.length === 0 && <p className="kosong-kecil">Belum ada pengeluaran.</p>}
          {palingSering.slice(0, 10).map((s) => (
            <div key={s.deskripsi} className="sering-baris">
              <span className="trx-deskripsi">{s.deskripsi}</span>
              <span className="sering-kali num">{s.kali}x</span>
              <span className="sering-total num">{rupiah(s.total)}</span>
            </div>
          ))}
        </section>
      </main>
    </Kerangka>
  );
}
