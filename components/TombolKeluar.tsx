"use client";
import { useRouter } from "next/navigation";
import { Ikon } from "./Ikon";

/** Tombol keluar (sidebar laptop & halaman akun). Menghapus cookie sesi lalu pindah ke halaman masuk. */
export function TombolKeluar({ className = "sidebar-link sidebar-keluar" }: { className?: string }) {
  const router = useRouter();
  async function keluar() {
    await fetch("/api/keluar", { method: "POST" }).catch(() => undefined);
    router.replace("/masuk");
    router.refresh();
  }
  return (
    <button type="button" className={className} onClick={keluar}>
      <Ikon nama="keluar" />
      Keluar
    </button>
  );
}
