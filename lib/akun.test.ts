import { describe, expect, test } from "vitest";
import { denganKuota, type LayananAI } from "./ai";
import { aturAktif, daftarPengguna, masuk } from "./akun";
import { buatDbUji, masukUji } from "./db-uji";
import { pakaiKuotaPengguna } from "./kuota";

const ADMIN = "bos@uji.id";
const WAKTU = new Date("2026-10-15T05:00:00Z");

describe("login & akun", () => {
  test("login pertama membuat akun, login berikutnya memakai akun yang sama", async () => {
    const db = await buatDbUji();
    const pertama = await masukUji(db, { email: "Andi@Uji.id", nama: "Andi", googleId: "g-1" }, WAKTU, ADMIN);
    expect(pertama).toMatchObject({ email: "andi@uji.id", nama: "Andi", admin: false, aktif: true });

    const lagi = await masukUji(db, { email: "andi@uji.id", nama: "Andi W", googleId: "g-1" }, WAKTU, ADMIN);
    expect(lagi?.id).toBe(pertama?.id);
    expect(lagi?.nama).toBe("Andi W");
    expect(await daftarPengguna(db, ADMIN)).toHaveLength(1);
  });

  test("akun yang ditemukan lewat id Google tetap sama walau email Google-nya diganti", async () => {
    const db = await buatDbUji();
    const a = await masukUji(db, { email: "lama@uji.id", nama: "A", googleId: "g-1" }, WAKTU, ADMIN);
    const b = await masukUji(db, { email: "baru@uji.id", nama: "A", googleId: "g-1" }, WAKTU, ADMIN);
    expect(b?.id).toBe(a?.id);
    expect(b?.email).toBe("baru@uji.id");
  });

  test("akun developer (tanpa Google) tersambung ke Google saat login Google pertama", async () => {
    const db = await buatDbUji();
    const dev = await masukUji(db, { email: "andi@uji.id", nama: "andi" }, WAKTU, ADMIN);
    const google = await masukUji(db, { email: "andi@uji.id", nama: "Andi", googleId: "g-9" }, WAKTU, ADMIN);
    expect(google?.id).toBe(dev?.id);
  });

  test("email yang sudah tersambung ke akun Google lain ditolak (bukan mewarisi akunnya)", async () => {
    const db = await buatDbUji();
    const pemilikLama = await masukUji(db, { email: ADMIN, nama: "Bos", googleId: "g-asli" }, WAKTU, ADMIN);
    expect(await masuk(db, { email: ADMIN, nama: "Orang lain", googleId: "g-baru" }, WAKTU, ADMIN)).toBe("bentrok");
    // Pemilik asli tetap bisa login dan tetap admin.
    expect(await masukUji(db, { email: ADMIN, nama: "Bos", googleId: "g-asli" }, WAKTU, ADMIN)).toMatchObject({
      id: pemilikLama.id,
      admin: true,
    });
  });

  test("ganti email Google ke email yang sudah dipakai akun lain: tetap bisa login, email lama dipertahankan", async () => {
    const db = await buatDbUji();
    const a = await masukUji(db, { email: "a@uji.id", nama: "A", googleId: "g-a" }, WAKTU, ADMIN);
    await masukUji(db, { email: "b@uji.id", nama: "B", googleId: "g-b" }, WAKTU, ADMIN);
    const lagi = await masukUji(db, { email: "b@uji.id", nama: "A", googleId: "g-a" }, WAKTU, ADMIN);
    expect(lagi).toMatchObject({ id: a.id, email: "a@uji.id" });
  });

  test("akun biasa yang email Google-nya berganti tidak menjadi admin lewat email lama", async () => {
    const db = await buatDbUji();
    await masukUji(db, { email: ADMIN, nama: "Bos", googleId: "g-bos" }, WAKTU, ADMIN);
    // Akun lain mencoba memakai email admin: email tidak berubah, bukan admin.
    const andi = await masukUji(db, { email: "andi@uji.id", nama: "Andi", googleId: "g-andi" }, WAKTU, ADMIN);
    const lagi = await masukUji(db, { email: ADMIN, nama: "Andi", googleId: "g-andi" }, WAKTU, ADMIN);
    expect(lagi).toMatchObject({ id: andi.id, email: "andi@uji.id", admin: false });
  });

  test("admin = email yang sama dengan ADMIN_EMAIL", async () => {
    const db = await buatDbUji();
    expect((await masukUji(db, { email: ADMIN, nama: "Bos" }, WAKTU, ADMIN))?.admin).toBe(true);
    expect((await masukUji(db, { email: "andi@uji.id", nama: "Andi" }, WAKTU, ADMIN))?.admin).toBe(false);
    // Tanpa ADMIN_EMAIL tidak ada admin.
    expect((await masukUji(db, { email: ADMIN, nama: "Bos" }, WAKTU, ""))?.admin).toBe(false);
  });

  test("akun yang dinonaktifkan tidak bisa login", async () => {
    const db = await buatDbUji();
    const andi = (await masukUji(db, { email: "andi@uji.id", nama: "Andi" }, WAKTU, ADMIN));
    expect(await aturAktif(db, andi.id, false)).toBe(true);
    expect(await masuk(db, { email: "andi@uji.id", nama: "Andi" }, WAKTU, ADMIN)).toBe("nonaktif");
    await aturAktif(db, andi.id, true);
    expect(await masuk(db, { email: "andi@uji.id", nama: "Andi" }, WAKTU, ADMIN)).toMatchObject({ aktif: true });
  });

  test("data dari sebelum ada akun pindah ke admin saat admin login, bukan ke akun lain", async () => {
    const db = await buatDbUji();
    await db.execute(`INSERT INTO transaksi (tanggal, nominal, jenis, deskripsi, teks_asli, sumber, dibuat_pada)
                      VALUES ('2026-10-01', 25000, 'pengeluaran', 'rasela', 'rasela 25000', 'manual', '2026-10-01T00:00:00Z')`);
    await db.execute(`INSERT INTO memori (kata_kunci, jenis, asal, terakhir_dipakai)
                      VALUES ('rasela', 'pengeluaran', 'manual', '2026-10-01T00:00:00Z')`);

    const andi = (await masukUji(db, { email: "andi@uji.id", nama: "Andi" }, WAKTU, ADMIN));
    const milik = async (id: number) =>
      Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM transaksi WHERE pengguna_id = ?", args: [id] })).rows[0].n);
    expect(await milik(andi.id)).toBe(0);

    const bos = (await masukUji(db, { email: ADMIN, nama: "Bos" }, WAKTU, ADMIN));
    expect(await milik(bos.id)).toBe(1);
    const { rows } = await db.execute("SELECT pengguna_id FROM memori WHERE kata_kunci = 'rasela'");
    expect(Number(rows[0].pengguna_id)).toBe(bos.id);
  });

  test("daftar pengguna hanya berisi jumlah transaksi, bukan isinya", async () => {
    const db = await buatDbUji();
    await masukUji(db, { email: ADMIN, nama: "Bos" }, WAKTU, ADMIN);
    const [baris] = await daftarPengguna(db, ADMIN);
    expect(Object.keys(baris).sort()).toEqual(
      ["admin", "aktif", "dibuatPada", "email", "id", "jumlahTransaksi", "nama", "terakhirMasuk"].sort(),
    );
  });
});

describe("kuota AI per akun", () => {
  test("dibatasi per akun per hari", async () => {
    const db = await buatDbUji();
    const andi = (await masukUji(db, { email: "andi@uji.id", nama: "Andi" }, WAKTU, ADMIN));
    const budi = (await masukUji(db, { email: "budi@uji.id", nama: "Budi" }, WAKTU, ADMIN));
    expect(await pakaiKuotaPengguna(db, andi.id, "2026-10-15", 2)).toBe(true);
    expect(await pakaiKuotaPengguna(db, andi.id, "2026-10-15", 2)).toBe(true);
    expect(await pakaiKuotaPengguna(db, andi.id, "2026-10-15", 2)).toBe(false);
    expect(await pakaiKuotaPengguna(db, budi.id, "2026-10-15", 2)).toBe(true);
    expect(await pakaiKuotaPengguna(db, andi.id, "2026-10-16", 2)).toBe(true);
  });

  test("kalau kuota habis, AI tidak dipanggil dan hasilnya 'kuota'", async () => {
    let dipanggil = 0;
    const ai: LayananAI = {
      aktif: true,
      rapikanSuara: async () => {
        dipanggil++;
        return { ok: true, data: "rasela 25000" };
      },
      buatAnalisis: async () => ({ ok: true, data: "x" }),
      bacaMutasi: async () => ({ ok: false, alasan: "error" }),
    };
    let sisa = 1;
    const terbatas = denganKuota(ai, async () => sisa-- > 0);
    expect((await terbatas.rapikanSuara("rasela dua lima")).ok).toBe(true);
    expect(await terbatas.rapikanSuara("rasela dua lima")).toEqual({ ok: false, alasan: "kuota" });
    expect(dipanggil).toBe(1);
  });
});
