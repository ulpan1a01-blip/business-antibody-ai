// РЕПОЗИТОРИЙ: вся работа с данными компаний. Каждая функция проверяет, что компания принадлежит пользователю.
import { transaction } from './db.js';
import { ApiError } from './errors.js';
import { healthScore, computeMetrics } from './engine/finance.js';
import { detectThreats } from './engine/antibody.js';

export const BUSINESS_TYPES = ['Магазин одежды', 'Продуктовый магазин', 'Кафе или ресторан', 'Салон красоты', 'Производство', 'Интернет-магазин', 'Услуги', 'Другой бизнес'];
const TABLES = { sales: ['date', 'amount', 'orders'], expenses: ['date', 'category', 'amount'], purchases: ['date', 'supplier', 'amount'], payables: ['supplier', 'amount', 'due_date'], inventory: ['name', 'qty', 'cost', 'days_since_last_sale'] };

export function createCompany(db, ownerId, { name, businessType, city, cash = 0, asOf, isDemo = 0 }) {
  name = String(name || '').trim();
  if (!name) throw new ApiError(400, 'Укажите название компании');
  if (!BUSINESS_TYPES.includes(businessType)) throw new ApiError(400, 'Выберите сферу бизнеса из списка');
  cash = Number(cash); if (!Number.isFinite(cash)) throw new ApiError(400, 'Денежный остаток должен быть числом');
  asOf = asOf || new Date().toISOString().slice(0, 10);
  const r = db.prepare('INSERT INTO companies (owner_id, name, business_type, city, cash, as_of, is_demo) VALUES (?,?,?,?,?,?,?)').run(ownerId, name, businessType, city || null, cash, asOf, isDemo);
  return Number(r.lastInsertRowid);
}

// Главная защита данных: чужая компания = «не найдена», а не «доступ запрещён» (не раскрываем, что она существует)
export function getCompany(db, companyId, userId) {
  const c = db.prepare('SELECT * FROM companies WHERE id = ? AND owner_id = ?').get(Number(companyId), userId);
  if (!c) throw new ApiError(404, 'Компания не найдена');
  return c;
}
export const listCompanies = (db, userId) => db.prepare('SELECT id, name, business_type, city, cash, as_of, is_demo FROM companies WHERE owner_id = ? ORDER BY id').all(userId);

// Заменяет данные одного типа (продажи, расходы...) новыми строками
export function replaceRows(db, companyId, userId, kind, rows) {
  getCompany(db, companyId, userId);
  const cols = TABLES[kind]; if (!cols) throw new ApiError(400, 'Неизвестный тип данных: ' + kind);
  transaction(db, () => {
    db.prepare(`DELETE FROM ${kind} WHERE company_id = ?`).run(Number(companyId));
    const ins = db.prepare(`INSERT INTO ${kind} (company_id, ${cols.join(',')}) VALUES (?, ${cols.map(() => '?').join(',')})`);
    for (const r of rows) ins.run(Number(companyId), ...cols.map((c) => r[c] ?? null));
  });
  return rows.length;
}

export function updateCash(db, companyId, userId, cash, asOf) {
  getCompany(db, companyId, userId);
  if (!Number.isFinite(Number(cash))) throw new ApiError(400, 'Денежный остаток должен быть числом');
  db.prepare('UPDATE companies SET cash = ?, as_of = COALESCE(?, as_of) WHERE id = ?').run(Number(cash), asOf || null, Number(companyId));
}

// Собираем данные в формат, который понимает движок расчётов (engine/)
export function loadContext(db, companyId, userId) {
  const c = getCompany(db, companyId, userId); const id = c.id; const all = (t) => db.prepare(`SELECT * FROM ${t} WHERE company_id = ?`).all(id);
  return {
    asOf: c.as_of, cash: c.cash,
    sales: all('sales').map((r) => ({ date: r.date, amount: r.amount, orders: r.orders })),
    expenses: all('expenses').map((r) => ({ date: r.date, category: r.category, amount: r.amount })),
    purchases: all('purchases').map((r) => ({ supplier: r.supplier, amount: r.amount })),
    payables: all('payables').map((r) => ({ supplier: r.supplier, amount: r.amount, dueDate: r.due_date })),
    inventory: all('inventory').map((r) => ({ name: r.name, qty: r.qty, cost: r.cost, daysSinceLastSale: r.days_since_last_sale })),
  };
}

// Загружает демо-данные (объект из data/*.js) в компанию пользователя
export function seedFromDemo(db, companyId, userId, demo) {
  replaceRows(db, companyId, userId, 'sales', demo.sales);
  replaceRows(db, companyId, userId, 'expenses', demo.expenses);
  replaceRows(db, companyId, userId, 'purchases', demo.purchases);
  replaceRows(db, companyId, userId, 'payables', demo.payables.map((p) => ({ ...p, due_date: p.dueDate })));
  replaceRows(db, companyId, userId, 'inventory', demo.inventory.map((i) => ({ ...i, days_since_last_sale: i.daysSinceLastSale })));
  updateCash(db, companyId, userId, demo.cash, demo.asOf);
}

// Диагностика: считаем и сохраняем в историю
export function diagnose(db, companyId, userId) {
  const ctx = loadContext(db, companyId, userId);
  if (!ctx.sales.length) throw new ApiError(400, 'Сначала загрузите данные о продажах');
  const health = healthScore(ctx), threats = detectThreats(ctx);
  const result = { health, threats, metrics: { ...computeMetrics(ctx), cash: ctx.cash } };
  db.prepare('INSERT INTO diagnoses (company_id, score, level, result_json) VALUES (?,?,?,?)').run(Number(companyId), health.score, health.level, JSON.stringify(result));
  return result;
}
export const diagnosisHistory = (db, companyId, userId) => { getCompany(db, companyId, userId); return db.prepare('SELECT id, created_at, score, level, result_json FROM diagnoses WHERE company_id = ? ORDER BY id DESC LIMIT 50').all(Number(companyId)).map((r) => ({ id: r.id, createdAt: r.created_at, score: r.score, level: r.level, threats: JSON.parse(r.result_json).threats.map((t) => ({ id: t.id, title: t.title, severity: t.severity })) })); };
