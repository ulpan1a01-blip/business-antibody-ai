// БАЗА ДАННЫХ: встроенный в Node.js SQLite (модуль node:sqlite, ничего ставить не нужно).
import { DatabaseSync } from 'node:sqlite';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  password_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL,
  business_type TEXT NOT NULL, city TEXT, cash REAL NOT NULL DEFAULT 0, as_of TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sales (company_id INTEGER NOT NULL REFERENCES companies(id), date TEXT NOT NULL, amount REAL NOT NULL, orders INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS expenses (company_id INTEGER NOT NULL REFERENCES companies(id), date TEXT NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL);
CREATE TABLE IF NOT EXISTS purchases (company_id INTEGER NOT NULL REFERENCES companies(id), date TEXT, supplier TEXT NOT NULL, amount REAL NOT NULL);
CREATE TABLE IF NOT EXISTS payables (company_id INTEGER NOT NULL REFERENCES companies(id), supplier TEXT NOT NULL, amount REAL NOT NULL, due_date TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inventory (company_id INTEGER NOT NULL REFERENCES companies(id), name TEXT NOT NULL, qty REAL NOT NULL, cost REAL NOT NULL, days_since_last_sale INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS diagnoses (
  id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, score INTEGER NOT NULL, level TEXT NOT NULL, result_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  threat_id TEXT, scenario_id TEXT NOT NULL, title TEXT NOT NULL, snapshot_json TEXT NOT NULL, expected_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', outcome_json TEXT, evaluated_at TEXT);
CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(company_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id, date);
`;

export function openDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

// Транзакция: либо записываются все строки, либо ни одной
export function transaction(db, fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}
