import Link from "next/link";
import type { ReactNode } from "react";
import type { InfoAkun } from "@/lib/akun";
import { Ikon } from "./Ikon";
import { TombolKeluar } from "./TombolKeluar";

interface Props {
  aktif: "dasbor" | "analisis" | "admin" | "akun";
  /** Akun yang login. Kosong di mode demo (tanpa Analisis AI, tanpa tombol keluar). */
  akun?: InfoAkun;
  children: ReactNode;
}

/** Sidebar di laptop (docs/design/05). Di HP sidebar disembunyikan lewat CSS. */
export function Kerangka({ aktif, akun, children }: Props) {
  const halaman = (nama: Props["aktif"]) => (aktif === nama ? "page" : undefined);
  return (
    <div className="kerangka">
      <nav className="sidebar" aria-label="Menu">
        <span className="sidebar-logo">
          <span className="sidebar-logo-ikon">
            <Ikon nama="tren" ukuran={16} tebal={2.2} />
          </span>
          Financial Detector
        </span>
        <Link href={akun ? "/" : "/demo"} className="sidebar-link" aria-current={halaman("dasbor")}>
          <Ikon nama="dasbor" />
          Dashboard
        </Link>
        {akun && (
          <Link href="/analisis" className="sidebar-link" aria-current={halaman("analisis")}>
            <Ikon nama="bintang" />
            Analisis AI
          </Link>
        )}
        {akun?.admin && (
          <Link href="/admin" className="sidebar-link" aria-current={halaman("admin")}>
            <Ikon nama="pengguna" />
            Pengguna
          </Link>
        )}
        {akun && (
          <div className="sidebar-akun">
            <Link href="/akun" className="sidebar-akun-info" aria-current={halaman("akun")}>
              <span className="sidebar-akun-nama">{akun.nama}</span>
              <span className="sidebar-akun-email">{akun.email}</span>
            </Link>
            <TombolKeluar />
          </div>
        )}
      </nav>
      <div className="isi">{children}</div>
    </div>
  );
}
