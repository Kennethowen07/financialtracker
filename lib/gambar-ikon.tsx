import { ImageResponse } from "next/og";

/**
 * Ikon aplikasi: garis tren putih di atas gradien hijau (sama dengan logo sidebar).
 * `aman` = versi maskable: logo diperkecil supaya tidak terpotong saat HP membulatkan ikon.
 */
export function gambarIkon(ukuran: number, aman = false): ImageResponse {
  const garis = Math.round(ukuran * (aman ? 0.42 : 0.56));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a8a6f 0%, #0f5a4c 55%, #0a3a31 100%)",
          borderRadius: aman ? 0 : Math.round(ukuran * 0.22),
        }}
      >
        <svg width={garis} height={garis} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M15 7h6v6" />
        </svg>
      </div>
    ),
    { width: ukuran, height: ukuran },
  );
}
