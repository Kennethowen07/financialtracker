// Tes API dashboard (tambah / edit / hapus) dengan database sementara.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "findet-srv-")), "test.db");
process.env.ALLOWED_USER_IDS = "111";
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_AUTH_TOKEN = "";
process.env.DASHBOARD_PASSWORD = "";

const { createServer } = await import("../src/server.js");
const { summarizeRange } = await import("../src/db.js");

let server;
let base;

before(async () => {
  server = createServer().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const send = (method, path, body) =>
  fetch(base + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => ({ status: res.status, body: await res.json() }));

test("tambah pengeluaran dari dashboard tercatat atas nama pemilik bot", async () => {
  const res = await send("POST", "/api/transactions", {
    amount: 45000, description: "Makan siang", category: "Makanan & Minuman", date: "2026-06-16",
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.type, "expense");
  assert.equal(summarizeRange("2026-06-01", "2026-06-30", 111).totals.expense, 45000);
});

test("validasi input", async () => {
  for (const bad of [
    { amount: 0, description: "x", date: "2026-06-16" },
    { amount: 1.5, description: "x", date: "2026-06-16" },
    { amount: 1000, description: "   ", date: "2026-06-16" },
    { amount: 1000, description: "x", date: "2026-02-30" },
  ]) {
    const res = await send("POST", "/api/transactions", bad);
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
});

test("kategori tidak dikenal jadi Lainnya", async () => {
  const res = await send("POST", "/api/transactions", {
    amount: 1000, description: "Sesuatu", category: "Ngawur", date: "2026-06-17",
  });
  assert.equal(res.body.category, "Lainnya");
});

test("edit lalu hapus", async () => {
  const created = await send("POST", "/api/transactions", {
    amount: 50000, description: "Bensin", category: "Transportasi", date: "2026-06-15",
  });
  const edited = await send("PATCH", `/api/transactions/${created.body.id}`, {
    amount: 60000, description: "Bensin motor", category: "Transportasi", date: "2026-06-15",
  });
  assert.equal(edited.status, 200);
  const report = await send("GET", "/api/report?month=2026-06");
  assert.ok(report.body.transactions.some((t) => t.id === created.body.id && t.amount === 60000));

  const removed = await send("DELETE", `/api/transactions/${created.body.id}`);
  assert.equal(removed.body.deleted, 1);
  assert.equal((await send("PATCH", `/api/transactions/${created.body.id}`, edited.body)).status, 404);
});
