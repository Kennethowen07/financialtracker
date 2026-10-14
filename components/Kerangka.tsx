import Link from "next/link";
import type { ReactNode } from "react";
import { Ikon } from "./Ikon";
import { TombolKeluar } from "./TombolKeluar";

interface Props {
  aktif: "dasbor" | "analisis";
  /** Mode demo tidak punya Analisis AI dan berada di /demo. */
  demo?: boolean;
  children: ReactNode;
}

/** Sidebar di laptop (docs/design/05). Di HP sidebar disembunyikan lewat CSS. */
export function Kerangka({ aktif, demo = false, children }: Props) {
  return (
    <div className="kerangka">
      <nav className="sidebar" aria-label="Menu">
        <span className="sidebar-logo">
          <span className="sidebar-logo-ikon">
            <Ikon nama="tren" ukuran={16} tebal={2.2} />
          </span>
          Financial Detector
        </span>
        <Link href={demo ? "/demo" : "/"} className="sidebar-link" aria-current={aktif === "dasbor" ? "page" : undefined}>
          <Ikon nama="dasbor" />
          Dashboard
        </Link>
        {!demo && (
          <Link href="/analisis" className="sidebar-link" aria-current={aktif === "analisis" ? "page" : undefined}>
            <Ikon nama="bintang" />
            Analisis AI
          </Link>
        )}
        {!demo && <TombolKeluar />}
      </nav>
      <div className="isi">{children}</div>
    </div>
  );
}
