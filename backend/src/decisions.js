// Решения предпринимателя: запись (с прогнозом на момент решения), список, проверка результата.
import { getCompany, loadContext } from './repo.js';
import { computeMetrics } from './engine/finance.js';
import { simulate, SCENARIOS } from './engine/simulation.js';
import { evaluate } from './engine/memory.js';
import { ApiError } from './errors.js';

export function recordDecision(db, companyId, userId, { scenario, threatId, title }) {
  if (!SCENARIOS[scenario]) throw new ApiError(400, 'Неизвестный сценарий');
  const ctx = loadContext(db, companyId, userId);
  if (!ctx.sales.length) throw new ApiError(400, 'Сначала загрузите данные о продажах');
  const sim = simulate(ctx, scenario);
  const m = computeMetrics(ctx);
  const snapshot = { asOf: ctx.asOf, cash: ctx.cash, sales30: m.sales30, profit30: m.profit30, exp30: m.exp30 };
  const expected = Object.fromEntries(['optimistic', 'base', 'pessimistic'].map((k) => [k, sim.cases[k].series.map((p) => p.cash)]));
  const r = db.prepare('INSERT INTO decisions (company_id, threat_id, scenario_id, title, snapshot_json, expected_json) VALUES (?,?,?,?,?,?)')
    .run(Number(companyId), threatId || null, scenario, String(title || SCENARIOS[scenario].label).slice(0, 200), JSON.stringify(snapshot), JSON.stringify(expected));
  return Number(r.lastInsertRowid);
}

export function listDecisions(db, companyId, userId) {
  getCompany(db, companyId, userId);
  return db.prepare('SELECT * FROM decisions WHERE company_id = ? ORDER BY id DESC').all(Number(companyId)).map((d) => {
    const snap = JSON.parse(d.snapshot_json), exp = JSON.parse(d.expected_json);
    return { id: d.id, createdAt: d.created_at, title: d.title, threatId: d.threat_id, status: d.status, decisionDate: snap.asOf,
      expectedBase30: exp.base[29], expectedBase90: exp.base[89], outcome: d.outcome_json ? JSON.parse(d.outcome_json) : null };
  });
}

export function evaluateDecision(db, companyId, userId, decisionId) {
  const ctx = loadContext(db, companyId, userId); // заодно проверяет владельца
  const d = db.prepare('SELECT * FROM decisions WHERE id = ? AND company_id = ?').get(Number(decisionId), Number(companyId));
  if (!d) throw new ApiError(404, 'Решение не найдено');
  const m = computeMetrics(ctx);
  const out = evaluate({ title: d.title, snapshot: JSON.parse(d.snapshot_json), expected: JSON.parse(d.expected_json) },
    { asOf: ctx.asOf, cash: ctx.cash, sales30: m.sales30, profit30: m.profit30 });
  if (!out) throw new ApiError(400, 'После даты решения нет новых данных: загрузите свежие продажи и расходы и обновите остаток и дату.');
  db.prepare("UPDATE decisions SET status = 'evaluated', outcome_json = ?, evaluated_at = CURRENT_TIMESTAMP WHERE id = ?").run(JSON.stringify(out), d.id);
  return out;
}
