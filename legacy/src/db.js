import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";
import { previousMonth, todayLocal } from "./format.js";

mkdirSync(dirname(config.dbPath), { recursive: true });
const db = new DatabaseSync(config.dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT    NOT NULL,
    type        TEXT    NOT NULL CHECK (type IN ('expense', 'income')),
    amount      INTEGER NOT NULL CHECK (amount > 0),
    category    TEXT    NOT NULL,
    description TEXT    NOT NULL,
    raw_text    TEXT    NOT NULL,
    date        TEXT    NOT NULL,             -- YYYY-MM-DD, zona waktu lokal
    created_at  TEXT    NOT NULL,             -- ISO-8601 UTC
    source      TEXT    NOT NULL DEFAULT 'ai' -- 'ai' | 'lokal' | 'manual'
  );
  CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions (date);
  CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions (user_id, id);

  CREATE TABLE IF NOT EXISTS insights (
    month       TEXT PRIMARY KEY,             -- YYYY-MM
    fingerprint TEXT NOT NULL,                -- berubah kalau datanya berubah
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );
`);

const insertStmt = db.prepare(`
  INSERT INTO transactions (user_id, type, amount, category, description, raw_text, date, created_at, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

/** Simpan beberapa transaksi sekaligus (atomik). Mengembalikan transaksi lengkap dengan id. */
export function insertTransactions(userId, items, rawText, source) {
  const createdAt = new Date().toISOString();
  db.exec("BEGIN");
  try {
    const saved = items.map((t) => {
      const { lastInsertRowid } = insertStmt.run(
        String(userId), t.type, t.amount, t.category, t.description, rawText, t.date, createdAt, source,
      );
      return { id: Number(lastInsertRowid), ...t };
    });
    db.exec("COMMIT");
    return saved;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function deleteTransactions(userId, ids) {
  const stmt = db.prepare("DELETE FROM transactions WHERE user_id = ? AND id = ?");
  return ids.reduce((count, id) => count + Number(stmt.run(String(userId), id).changes), 0);
}

export function getTransaction(id) {
  return db.prepare("SELECT * FROM transactions WHERE id = ?").get(id) ?? null;
}

/** Ubah transaksi dari dashboard. Mengembalikan jumlah baris yang berubah (0 = tidak ada). */
export function updateTransaction(id, { type, amount, category, description, date }) {
  return Number(
    db
      .prepare("UPDATE transactions SET type = ?, amount = ?, category = ?, description = ?, date = ? WHERE id = ?")
      .run(type, amount, category, description, date, id).changes,
  );
}

export function deleteTransactionById(id) {
  return Number(db.prepare("DELETE FROM transactions WHERE id = ?").run(id).changes);
}

/** Hapus satu pesan terakhir user (semua transaksi yang dibuat dari pesan itu). */
export function deleteLastEntry(userId) {
  const last = db
    .prepare("SELECT created_at FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1")
    .get(String(userId));
  if (!last) return [];
  const rows = db
    .prepare("SELECT * FROM transactions WHERE user_id = ? AND created_at = ? ORDER BY id")
    .all(String(userId), last.created_at);
  db.prepare("DELETE FROM transactions WHERE user_id = ? AND created_at = ?").run(String(userId), last.created_at);
  return rows;
}

/** Ringkasan per kategori untuk rentang tanggal [from, to] (inklusif). */
export function summarizeRange(from, to, userId = null) {
  const userFilter = userId ? "AND user_id = ?" : "";
  const params = userId ? [from, to, String(userId)] : [from, to];
  const byCategory = db
    .prepare(`
      SELECT type, category, SUM(amount) AS total, COUNT(*) AS count
      FROM transactions
      WHERE date BETWEEN ? AND ? ${userFilter}
      GROUP BY type, category
      ORDER BY total DESC
    `)
    .all(...params);
  const totals = { expense: 0, income: 0, count: 0 };
  for (const row of byCategory) {
    totals[row.type] += row.total;
    totals.count += row.count;
  }
  return { from, to, totals, byCategory };
}

/** Semua data yang dibutuhkan dashboard untuk satu bulan (YYYY-MM). */
export function monthReport(month) {
  const from = `${month}-01`;
  const to = `${month}-31`;
  const prev = previousMonth(month);
  // Bulan berjalan dibandingkan dengan periode yang sama bulan lalu (tgl 1 s/d hari ini),
  // supaya setengah bulan tidak dibandingkan dengan satu bulan penuh.
  const today = todayLocal();
  const previousPartial = today.startsWith(month);
  const previousTo = previousPartial ? `${prev}-${today.slice(8, 10)}` : `${prev}-31`;

  const current = summarizeRange(from, to);
  const previous = summarizeRange(`${prev}-01`, previousTo);
  const daily = db
    .prepare(`
      SELECT date,
             SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense,
             SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income
      FROM transactions
      WHERE date BETWEEN ? AND ?
      GROUP BY date
      ORDER BY date
    `)
    .all(from, to);
  const transactions = db
    .prepare(`
      SELECT id, type, amount, category, description, date, source
      FROM transactions
      WHERE date BETWEEN ? AND ?
      ORDER BY date DESC, id DESC
    `)
    .all(from, to);

  return { month, ...current, previous: previous.totals, previousPartial, daily, transactions };
}

export function availableMonths() {
  return db
    .prepare("SELECT DISTINCT substr(date, 1, 7) AS month FROM transactions ORDER BY month DESC")
    .all()
    .map((r) => r.month);
}

export function getInsight(month) {
  return db.prepare("SELECT * FROM insights WHERE month = ?").get(month) ?? null;
}

export function saveInsight(month, fingerprint, content) {
  db.prepare(`
    INSERT INTO insights (month, fingerprint, content, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (month) DO UPDATE SET fingerprint = excluded.fingerprint,
                                      content = excluded.content,
                                      created_at = excluded.created_at
  `).run(month, fingerprint, content, new Date().toISOString());
}
