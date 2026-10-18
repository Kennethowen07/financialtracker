// Kebijakan privasi. Wajib ada (dan bisa dibuka tanpa login) supaya layar persetujuan
// Google OAuth bisa di-"Publish" untuk semua orang.
import Link from "next/link";

export const metadata = { title: "Kebijakan Privasi · Financial Detector" };

export default function Halaman() {
  return (
    <main className="halaman-teks">
      <h1>Kebijakan Privasi</h1>
      <p className="halaman-teks-sub">Berlaku sejak 15 Oktober 2026, diperbarui 18 Oktober 2026 (input suara).</p>

      <p>
        Financial Detector adalah aplikasi pencatat pengeluaran pribadi. Halaman ini menjelaskan data apa yang
        disimpan dan untuk apa.
      </p>

      <h2>Data yang disimpan</h2>
      <ul>
        <li>
          <b>Dari akun Google</b>: nama, alamat email, dan id akun Google. Hanya dipakai untuk login dan
          membedakan akun. Aplikasi tidak meminta akses ke Gmail, Drive, kontak, atau data Google lainnya.
        </li>
        <li>
          <b>Yang kamu ketik</b>: transaksi (tanggal, nominal, deskripsi, kategori) dan kata kunci yang diingat
          aplikasi supaya input berikutnya langsung dikenali.
        </li>
        <li>
          <b>Cookie</b>: satu cookie sesi supaya kamu tetap masuk (30 hari). Tidak ada cookie iklan atau pelacak.
        </li>
      </ul>

      <h2>Siapa yang bisa melihat</h2>
      <p>
        Data setiap akun terpisah dan hanya bisa dilihat pemilik akunnya. Pengelola aplikasi (admin) hanya bisa
        melihat daftar akun (nama, email, tanggal daftar, dan jumlah transaksi), bukan isi transaksinya. Data tidak
        dijual dan tidak dibagikan ke pihak lain, kecuali layanan berikut yang dibutuhkan agar aplikasi berjalan.
      </p>

      <h2>Layanan pihak ketiga</h2>
      <ul>
        <li><b>Google Sign-In</b> untuk login.</li>
        <li><b>Vercel</b> (server aplikasi) dan <b>Turso</b> (database) untuk menyimpan data.</li>
        <li>
          <b>Google Gemini</b> (AI), hanya di dua tempat: ringkasan bulanan saat kamu menekan Perbarui di halaman
          Analisis AI, dan teks hasil input suara yang nominalnya tidak terbaca (misalnya &quot;rasela dua lima&quot;).
          Kategori transaksi tidak ditebak AI, melainkan diambil dari catatanmu sendiri. Nama dan email tidak ikut
          dikirim. Aplikasi memakai Gemini versi gratis, di mana Google dapat memakai input tersebut untuk
          mengembangkan produknya.
        </li>
      </ul>

      <h2>Input suara</h2>
      <p>
        Suara diubah menjadi teks oleh fitur pengenal suara bawaan browser atau HP-mu (di iPhone oleh layanan
        Apple, di Chrome oleh Google). Aplikasi ini hanya menerima teksnya. Rekaman suara tidak disimpan dan tidak
        pernah dikirim ke server aplikasi ini maupun ke layanan AI.
      </p>

      <h2>Mode demo</h2>
      <p>
        Mode demo tidak memakai akun. Data demo hanya tersimpan di browser pengunjung. Untuk membatasi pemakaian
        AI, server menyimpan hash alamat IP (bukan alamat aslinya) beserta jumlah pemakaian per hari.
      </p>

      <h2>Menghapus data</h2>
      <p>
        Transaksi bisa dihapus kapan saja dari aplikasi. Untuk menghapus akun beserta seluruh datanya, hubungi
        pengelola aplikasi lewat email yang tercantum di layar login Google aplikasi ini.
      </p>

      <p className="halaman-teks-kaki">
        <Link href="/masuk">Kembali ke halaman masuk</Link>
      </p>
    </main>
  );
}
