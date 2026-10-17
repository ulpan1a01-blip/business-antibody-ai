import test from 'node:test';
import assert from 'node:assert/strict';
import { pctChange, addDays, windowSum, healthScore, forecastCash, computeMetrics } from '../src/engine/finance.js';
import { detectThreats } from '../src/engine/antibody.js';
import { simulate } from '../src/engine/simulation.js';
import { buildClothingAlmaty } from '../src/data/demoClothingAlmaty.js';

const ctx = buildClothingAlmaty();

test('pctChange считает процент и защищён от деления на 0', () => {
  assert.equal(pctChange(110, 100), 10);
  assert.equal(pctChange(5, 0), null);
});
test('windowSum суммирует ровно 3 дня', () => {
  const rows = [1, 2, 3, 4].map((n) => ({ date: addDays('2026-01-01', n - 1), amount: n * 10 }));
  assert.equal(windowSum(rows, '2026-01-04', 3), 90);
});
test('бизнес прибыльный, но продажи упали', () => {
  const m = computeMetrics(ctx);
  assert.ok(m.profit30 > 0);
  assert.ok(m.salesChangePct < -10);
});
test('диагностика находит кассовый разрыв в демо-сценарии', () => {
  const t = detectThreats(ctx).find((x) => x.id === 'cash_gap');
  assert.ok(t); assert.equal(t.severity, 'critical');
});
test('без платежа поставщику разрыва нет', () => {
  assert.equal(detectThreats({ ...ctx, payables: [] }).some((x) => x.id === 'cash_gap'), false);
});
test('Health Score от 0 до 100, баллы факторов суммируются', () => {
  const h = healthScore(ctx);
  assert.ok(h.score >= 0 && h.score <= 100);
  assert.equal(h.score, Math.round(h.factors.reduce((s, f) => s + f.points, 0)));
});
test('отсрочка платежа на 30 дней устраняет разрыв за 30 дней', () => {
  assert.equal(forecastCash(ctx, { payableShiftDays: 30, days: 30 }).firstNegativeDay, null);
});
test('сценарий: пессимистичный остаток не выше оптимистичного', () => {
  const r = simulate(ctx, 'price_up_15');
  assert.ok(r.cases.pessimistic.cash90 <= r.cases.base.cash90);
  assert.ok(r.cases.base.cash90 <= r.cases.optimistic.cash90);
});
test('чувствительность: падение спроса уменьшает остаток', () => {
  assert.ok(simulate(ctx, 'hire_2').sensitivity.demandMinus10 < 0);
});
