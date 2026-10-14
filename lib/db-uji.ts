// Database kosong di memori untuk test. Tiap panggilan = database baru yang terpisah.
import { createClient, type Client } from "@libsql/client";
import { siapkanDatabase } from "./skema";

export async function buatDbUji(): Promise<Client> {
  const client = createClient({ url: ":memory:" });
  await siapkanDatabase(client);
  return client;
}

export async function idKategori(client: Client, nama: string): Promise<number> {
  const { rows } = await client.execute({ sql: "SELECT id FROM kategori WHERE nama = ?", args: [nama] });
  if (!rows[0]) throw new Error(`Kategori ${nama} tidak ada`);
  return Number(rows[0].id);
}
