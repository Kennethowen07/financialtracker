"use client";
// Halaman masuk: tombol Google, login developer (khusus laptop), dan tautan ke mode demo.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Ikon } from "./Ikon";

interface Props {
  /** GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET sudah diisi. */
  google: boolean;
  /** Development di laptop: tampilkan login tanpa Google. */
  dev: boolean;
  galat: string | null;
}

function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function FormMasuk({ google, dev, galat: galatAwal }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [galat, setGalat] = useState(galatAwal);
  const [sibuk, setSibuk] = useState(false);

  async function masukDev(e: FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch("/api/auth/dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      setGalat((await res.json().catch(() => ({}))).error ?? "Gagal masuk");
    } catch {
      setGalat("Tidak bisa terhubung ke server");
    }
    setSibuk(false);
  }

  return (
    <main className="halaman-masuk">
      <div className="kartu kartu-masuk">
        <span className="sidebar-logo-ikon besar" aria-hidden="true">
          <Ikon nama="tren" ukuran={22} tebal={2.2} />
        </span>
        <h1 className="form-judul">Financial Detector</h1>
        <p className="masuk-sub">Catat pengeluaran cukup dengan mengetik, misalnya <b>makan 25000</b>.</p>

        {google ? (
          <a href="/api/auth/google" className="tombol-google">
            <LogoGoogle />
            Masuk dengan Google
          </a>
        ) : (
          <p className="masuk-catatan">
            Login Google belum diatur. Isi <code>GOOGLE_CLIENT_ID</code> dan <code>GOOGLE_CLIENT_SECRET</code>.
          </p>
        )}
        {galat && <p className="galat" role="alert">{galat}</p>}

        {dev && (
          <form className="masuk-dev" onSubmit={masukDev}>
            <span className="masuk-dev-label">Khusus development: masuk tanpa Google</span>
            <label className="sr-only" htmlFor="email-dev">Email</label>
            <input
              id="email-dev"
              className="isian"
              type="email"
              placeholder="email@contoh.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="tombol-utama" disabled={sibuk || !email}>
              {sibuk ? "Memeriksa…" : "Masuk"}
            </button>
          </form>
        )}

        <Link href="/demo" className="tautan-demo">Coba mode demo tanpa akun</Link>
      </div>
    </main>
  );
}
