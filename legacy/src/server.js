import express from "express";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./categories.js";
import {
  availableMonths,
  deleteTransactionById,
  getTransaction,
  insertTransactions,
  monthReport,
  updateTransaction,
} from "./db.js";
import { getMonthInsight } from "./ai.js";
import { todayLocal } from "./format.js";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function safeEqual(a, b) {
  const [x, y] = [Buffer.from(a), Buffer.from(b)];
  return x.length === y.length && timingSafeEqual(x, y);
}

// Password opsional (Basic Auth). Wajib diisi kalau dashboard dibuka dari internet.
function basicAuth(req, res, next) {
  if (!config.dashboardPassword) return next();
  const [scheme, encoded] = (req.headers.authorization ?? "").split(" ");
  const password = scheme === "Basic" && encoded ? Buffer.from(encoded, "base64").toString().split(":").slice(1).join(":") : "";
  if (safeEqual(password, config.dashboardPassword)) return next();
  res.set("WWW-Authenticate", 'Basic realm="Financial Detector"').status(401).send("Butuh password");
}

function monthParam(req) {
  const month = String(req.query.month ?? todayLocal().slice(0, 7));
  return MONTH_RE.test(month) ? month : null;
}

function isRealDate(iso) {
  if (!DATE_RE.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** Validasi input form dashboard. Mengembalikan { value } atau { error }. */
function validateTransaction(body) {
  const type = body?.type === "income" ? "income" : "expense";
  const amount = Number(body?.amount);
  const description = String(body?.description ?? "").trim();
  const date = String(body?.date ?? "");
  const categories = (type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => c.name);
  const category = categories.includes(body?.category) ? body.category : categories[categories.length - 1];

  if (!Number.isInteger(amount) || amount <= 0 || amount > 1e12) return { error: "Nominal harus angka bulat lebih dari 0" };
  if (!description || description.length > 100) return { error: "Deskripsi wajib diisi (maks. 100 karakter)" };
  if (!isRealDate(date)) return { error: "Tanggal tidak valid" };
  return { value: { type, amount, category, description, date } };
}

// Transaksi dari dashboard dicatat atas nama pemilik bot, supaya ikut terhitung di /hari, /bulan, dst.
const dashboardUserId = () => config.allowedUserIds[0] ?? "dashboard";

export function createServer() {
  const app = express();
  app.disable("x-powered-by");
  app.use(basicAuth);
  app.use(express.json({ limit: "10kb" }));
  app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));

  app.get("/api/meta", (_req, res) => {
    res.json({
      today: todayLocal(),
      months: availableMonths(),
      aiEnabled: config.anthropicEnabled,
      categories: {
        expense: EXPENSE_CATEGORIES.map(({ name, icon }) => ({ name, icon })),
        income: INCOME_CATEGORIES.map(({ name, icon }) => ({ name, icon })),
      },
    });
  });

  app.get("/api/report", (req, res) => {
    const month = monthParam(req);
    if (!month) return res.status(400).json({ error: "Format bulan harus YYYY-MM" });
    res.json(monthReport(month));
  });

  app.get("/api/insight", async (req, res) => {
    const month = monthParam(req);
    if (!month) return res.status(400).json({ error: "Format bulan harus YYYY-MM" });
    res.json(await getMonthInsight(month, { force: req.query.force === "1" }));
  });

  app.post("/api/transactions", (req, res) => {
    const { value, error } = validateTransaction(req.body);
    if (error) return res.status(400).json({ error });
    const [saved] = insertTransactions(dashboardUserId(), [value], "(dashboard)", "manual");
    res.status(201).json(saved);
  });

  app.patch("/api/transactions/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || !getTransaction(id)) return res.status(404).json({ error: "Transaksi tidak ditemukan" });
    const { value, error } = validateTransaction(req.body);
    if (error) return res.status(400).json({ error });
    updateTransaction(id, value);
    res.json({ id, ...value });
  });

  app.delete("/api/transactions/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid" });
    res.json({ deleted: deleteTransactionById(id) });
  });

  return app;
}

export function startServer() {
  const app = createServer();
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, config.host, (err) => {
      if (err) return reject(err);
      console.log(`[web] dashboard: http://localhost:${config.port}`);
      resolve(server);
    });
  });
}
