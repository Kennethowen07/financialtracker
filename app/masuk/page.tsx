"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Ikon } from "@/components/Ikon";

export default function HalamanMasuk() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function masuk(e: FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setGalat("");
    try {
      const res = await fetch("/api/masuk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
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
      <form className="kartu kartu-masuk" onSubmit={masuk}>
        <span className="sidebar-logo-ikon besar" aria-hidden="true">
          <Ikon nama="tren" ukuran={22} tebal={2.2} />
        </span>
        <h1 className="form-judul">Financial Detector</h1>
        <label className="sr-only" htmlFor="password">Password</label>
        <input
          id="password"
          className="isian"
          type="password"
          autoComplete="current-password"
          autoFocus
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {galat && <p className="galat" role="alert">{galat}</p>}
        <button type="submit" className="tombol-utama besar" disabled={sibuk || !password}>
          {sibuk ? "Memeriksa…" : "Masuk"}
        </button>
        <Link href="/demo" className="tautan-demo">Coba mode demo</Link>
      </form>
    </main>
  );
}
