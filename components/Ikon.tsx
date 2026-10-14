import { pathIkon } from "@/lib/ikon";

interface Props {
  nama: string | null | undefined;
  ukuran?: number;
  tebal?: number;
  label?: string;
  className?: string;
}

/** Ikon garis gaya Lucide. Tanpa `label` dianggap dekorasi (disembunyikan dari pembaca layar). */
export function Ikon({ nama, ukuran = 18, tebal = 2, label, className }: Props) {
  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={tebal}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {pathIkon(nama).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
