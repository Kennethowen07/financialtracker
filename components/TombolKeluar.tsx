"use client";
import { useRouter } from "next/navigation";
import { Ikon } from "./Ikon";

/** Tombol keluar di sidebar (laptop). Menghapus cookie sesi lalu pindah ke halaman masuk. */
export function TombolKeluar() {
  const router = useRouter();
  async function keluar() {
    await fetch("/api/keluar", { method: "POST" }).catch(() => undefined);
    router.replace("/masuk");
    router.refresh();
  }
  return (
    <button type="button" className="sidebar-link sidebar-keluar" onClick={keluar}>
      <Ikon nama="keluar" />
      Keluar
    </button>
  );
}
