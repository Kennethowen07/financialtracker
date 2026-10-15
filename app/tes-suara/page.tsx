// Halaman tes sementara untuk input suara (docs/PRD.md "Input suara", urutan pengerjaan no. 1).
// Tidak masuk navigasi, tidak menyentuh database maupun AI. Dihapus setelah fitur aslinya jadi.
import { TesSuara } from "@/components/TesSuara";

export const metadata = { title: "Tes Suara · Financial Detector", robots: { index: false } };

export default function Halaman() {
  return <TesSuara />;
}
