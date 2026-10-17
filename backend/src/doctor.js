// AI BUSINESS DOCTOR. Два режима:
//  1) Claude: если задан ANTHROPIC_API_KEY, вопрос и ФАКТЫ компании отправляются в Claude API (только с backend).
//  2) Демо-режим: ответ собирают встроенные правила из тех же расчётов. Это НЕ нейросеть, и интерфейс так и пишет.
import { computeMetrics, healthScore, forecastCash } from './engine/finance.js';
import { detectThreats } from './engine/antibody.js';

const r1 = (n) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10) / 10);
const fmt = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₸';
const LEVEL = { green: 'низкий риск', yellow: 'требуется внимание', red: 'высокий риск' };

export function buildFacts(ctx) {
  const m = computeMetrics(ctx), f = forecastCash(ctx, { days: 60 });
  return {
    currency: '₸', asOf: ctx.asOf,
    metrics: { sales30: Math.round(m.sales30), salesChangePct: r1(m.salesChangePct), expenses30: Math.round(m.exp30), expensesChangePct: r1(m.expChangePct),
      profit30: Math.round(m.profit30), marginPct: r1(m.margin30), previousMarginPct: r1(m.marginPrev30), avgCheck: Math.round(m.avgCheck), cash: Math.round(ctx.cash), coverageDays: r1(m.coverageDays) },
    health: healthScore(ctx),
    cashForecast60: { firstNegativeDay: f.firstNegativeDay, minCash: f.minCash },
    threats: detectThreats(ctx),
  };
}

const FOCUS = { cash_gap: /касс|денег|деньги|разрыв|остат/i, sales_drop: /продаж|выруч/i, margin_drop: /марж|прибыл/i, supplier_dependence: /поставщик/i, dead_stock: /склад|залеж|товар/i };
const SAFEST = {
  cash_gap: 'Договориться с поставщиком об отсрочке или разбивке платежа: это обратимо и не влияет на продажи.',
  sales_drop: 'Сначала выяснить, какие товары просели, и только потом тратить деньги на рекламу.',
  margin_drop: 'Проверить закупочные цены и постоянные расходы, не меняя цены для клиентов.',
  supplier_dependence: 'Запросить цены у 1–2 запасных поставщиков, не отказываясь от основного.',
  dead_stock: 'Распродать небольшую часть остатков со скидкой, чтобы проверить спрос.',
};
const NEED = {
  cash_gap: 'реальные сроки оплаты от клиентов, график всех ближайших платежей',
  sales_drop: 'продажи по товарам, число клиентов, данные за тот же период прошлого года',
  margin_drop: 'закупочные цены по позициям и список постоянных расходов',
  supplier_dependence: 'условия, цены и сроки поставки у других поставщиков',
  dead_stock: 'продажи по товарам за год и сезонность ассортимента',
};

export function demoAnswer(facts, question = '') {
  const { metrics: m, health, threats } = facts;
  const pct = (v) => (v == null ? 'н/д' : `${v > 0 ? '+' : ''}${v}%`);
  const lines = [`Состояние бизнеса: ${health.score} из 100 (${LEVEL[health.level]}).`,
    `За последние 30 дней выручка изменилась на ${pct(m.salesChangePct)}, расходы на ${pct(m.expensesChangePct)}, маржа составляет ${m.marginPct}% (раньше ${m.previousMarginPct}%).`];
  let focus = threats.filter((t) => FOCUS[t.id]?.test(question));
  if (!focus.length) focus = threats.slice(0, 2);
  if (!focus.length) lines.push('Угроз по текущим правилам не найдено. Продолжайте загружать свежие данные.');
  for (const t of focus) {
    lines.push('', `Проблема: ${t.title}`, `Почему: ${t.cause}`, `Данные: ${t.evidence.join('; ')}.`, `Что можно сделать: ${t.recommendations.join('; ')}.`,
      `Самое безопасное действие: ${SAFEST[t.id]}`, `Какие данные ещё нужны: ${NEED[t.id]}.`);
  }
  lines.push('', 'Это ответ встроенных правил, а не нейросети. Я ничего не меняю автоматически: цены, письма поставщикам и платежи вы подтверждаете сами.');
  return lines.join('\n');
}

export const SYSTEM_PROMPT = `Ты AI Business Doctor для малого бизнеса в Казахстане. Отвечай по-русски, кратко и по структуре: почему возникла проблема; какие факторы повлияли; что можно сделать; какие действия наиболее безопасны; какие данные ещё нужны.
Используй ТОЛЬКО факты из блока ДАННЫЕ и не придумывай числа. Если данных не хватает, скажи об этом. Прогнозы это расчёты при допущениях, а не гарантии.
Ты не можешь менять цены, писать поставщикам или совершать финансовые операции: ты только советуешь, решение и подтверждение всегда за пользователем. Валюта: тенге (₸).`;

export async function callClaude({ apiKey, model, question, facts, fetchImpl = fetch }) {
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 1000, system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `ДАННЫЕ (JSON):\n${JSON.stringify(facts)}\n\nВОПРОС: ${question || 'Что сейчас главное и что делать?'}` }] }),
  });
  if (!res.ok) throw new Error(`Claude API: HTTP ${res.status}`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!text) throw new Error('Claude API вернул пустой ответ');
  return text;
}

// Возвращает {mode, answer, note?}. mode: 'claude' или 'demo'. Ответ демо-режима никогда не выдаётся за ответ нейросети.
export async function askDoctor(ctx, question, { apiKey, model = 'claude-sonnet-5-5', fetchImpl } = {}) {
  const facts = buildFacts(ctx);
  if (apiKey) {
    try { return { mode: 'claude', answer: await callClaude({ apiKey, model, question, facts, fetchImpl }) }; }
    catch (e) { console.error('Doctor:', e.message); return { mode: 'demo', answer: demoAnswer(facts, question), note: 'Claude API недоступен, показан ответ встроенных правил.' }; }
  }
  return { mode: 'demo', answer: demoAnswer(facts, question) };
}
