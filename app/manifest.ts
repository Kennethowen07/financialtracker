import type { MetadataRoute } from "next";

// Manifest PWA: supaya aplikasi bisa dipasang di layar utama HP.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CatetAja",
    short_name: "CatetAja",
    description: "Catat pengeluaran dengan mengetik bebas, langsung jadi dashboard bulanan.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#141414",
    theme_color: "#141414",
    lang: "id",
    icons: [
      { src: "/ikon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/ikon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/ikon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
