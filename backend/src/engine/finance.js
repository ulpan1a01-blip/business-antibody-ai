// ФИНАНСОВОЕ ЯДРО: чистые функции без базы данных и без ИИ.
// Все числа считаются по формулам, случайности нет.
export const COGS_CATEGORY = 'Закупка товара';
export const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + f(x), 0);
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
// Линейная шкала: x в диапазоне [x0,x1] переводится в [y0,y1]
export const lerp = (x, x0, x1, y0, y1) => y0 + ((clamp(x, x0, x1) - x0) / (x1 - x0)) * (y1 - y0);
export const pctChange = (now, prev) => (prev === 0 ? null : ((now - prev) / prev) * 100);

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Сумма за окно в `days` дней, заканчивающееся датой asOf (включительно), сдвинутое назад на offset дней
export function windowSum(rows, asOf, days, offset = 0, pick = () => true) {
  const to = addDays(asOf, 1 - offset);
  const from = addDays(to, -days);
  return sum(rows.filter((r) => r.date >= from && r.date < to && pick(r)), (r) => r.amount);
}

export function computeMetrics(ctx) {
  const { asOf, sales, expenses, cash } = ctx;
  const sales30 = windowSum(sales, asOf, 30);
  const salesPrev30 = windowSum(sales, asOf, 30, 30);
  const exp30 = windowSum(expenses, asOf, 30);
  const expPrev30 = windowSum(expenses, asOf, 30, 30);
  const cogs30 = windowSum(expenses, asOf, 30, 0, (r) => r.category === COGS_CATEGORY);
  const profit30 = sales30 - exp30;
  const profitPrev30 = salesPrev30 - expPrev30;
  const margin30 = sales30 ? (profit30 / sales30) * 100 : 0;
  const marginPrev30 = salesPrev30 ? (profitPrev30 / salesPrev30) * 100 : 0;
  const orders30 = sum(sales.filter((r) => r.date > addDays(asOf, -30)), (r) => r.orders || 0);
  return {
    sales30, salesPrev30, salesChangePct: pctChange(sales30, salesPrev30),
    exp30, expPrev30, expChangePct: pctChange(exp30, expPrev30),
    cogs30, profit30, margin30, marginPrev30,
    avgCheck: orders30 ? sales30 / orders30 : 0,
    coverageDays: exp30 ? cash / (exp30 / 30) : Infinity, // на сколько дней расходов хватит денег
  };
}

// Допущения для прогноза (все видны пользователю)
export function baselineParams(ctx) {
  const m = computeMetrics(ctx);
  const dailySales14 = windowSum(ctx.sales, ctx.asOf, 14) / 14;
  // Сезонный тренд: половина изменения продаж за 30 дней, но не меньше -30% и не больше +10%
  const seasonalTrend = clamp((m.salesChangePct ?? 0) / 100 / 2, -0.3, 0.1);
  return {
    dailySales: dailySales14 * (1 + seasonalTrend),
    cogsRatio: m.sales30 ? m.cogs30 / m.sales30 : 0,
    fixedDaily: (m.exp30 - m.cogs30) / 30,
    seasonalTrend, dailySales14,
  };
}

// Прогноз денежного остатка по дням
export function forecastCash(ctx, o = {}) {
  const p = baselineParams(ctx);
  const { demandMult = 1, priceMult = 1, fixedMult = 1, extraFixedDaily = 0, payableShiftDays = 0, days = 90 } = o;
  const payables = ctx.payables.map((x) => ({ ...x, dueDate: addDays(x.dueDate, payableShiftDays) }));
  let cash = ctx.cash, minCash = cash, firstNegativeDay = null;
  const series = [];
  for (let d = 1; d <= days; d++) {
    const date = addDays(ctx.asOf, d);
    const revenue = p.dailySales * demandMult * priceMult;
    const cogs = p.dailySales * demandMult * p.cogsRatio; // себестоимость зависит от объёма, не от цены
    const fixed = p.fixedDaily * fixedMult + extraFixedDaily;
    const paid = sum(payables.filter((x) => x.dueDate === date), (x) => x.amount);
    cash += revenue - cogs - fixed - paid;
    minCash = Math.min(minCash, cash);
    if (cash < 0 && firstNegativeDay === null) firstNegativeDay = d;
    series.push({ day: d, date, cash: Math.round(cash) });
  }
  return { series, minCash: Math.round(minCash), firstNegativeDay, params: p };
}

// Business Health Score: 4 компонента, максимум 100 баллов
export function healthScore(ctx) {
  const m = computeMetrics(ctx);
  const gap = forecastCash(ctx, { days: 30 }).firstNegativeDay;
  const factors = [
    { name: 'Маржа прибыли', max: 30, points: lerp(m.margin30, 0, 10, 0, 30), note: `маржа ${m.margin30.toFixed(1)}% (10% и выше = максимум)` },
    { name: 'Динамика продаж', max: 25, points: lerp(m.salesChangePct ?? 0, -30, 10, 0, 25), note: `продажи ${(m.salesChangePct ?? 0).toFixed(1)}% к прошлым 30 дням` },
    { name: 'Запас денег', max: 30, points: lerp(m.coverageDays, 0, 30, 0, 30), note: `денег хватает на ${m.coverageDays.toFixed(1)} дн. расходов (30+ = максимум)` },
    { name: 'Кассовый разрыв (30 дн.)', max: 15, points: gap === null ? 15 : 0, note: gap === null ? 'разрыв не прогнозируется' : `прогноз: деньги закончатся на ${gap}-й день` },
  ].map((f) => ({ ...f, points: Math.round(f.points * 10) / 10 }));
  const score = Math.round(sum(factors, (f) => f.points));
  return { score, level: score >= 70 ? 'green' : score >= 45 ? 'yellow' : 'red', factors };
}
