// BUSINESS MEMORY: сравнение ожиданий (прогноз на момент решения) с реальностью (данные сейчас).
const fmt = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₸';
export const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
const VERDICT = { better: 'лучше ожиданий модели', expected: 'в пределах ожиданий модели', worse: 'хуже ожиданий модели' };

// decision: {title, snapshot:{asOf,cash,sales30,profit30}, expected:{optimistic,base,pessimistic: массивы остатка по дням}}
// now: {asOf, cash, sales30, profit30}. Возвращает null, если после решения нет новых данных.
export function evaluate(decision, now) {
  const elapsed = daysBetween(decision.snapshot.asOf, now.asOf);
  if (elapsed < 1) return null;
  const day = Math.min(elapsed, 90);
  const exp = Object.fromEntries(Object.entries(decision.expected).map(([k, v]) => [k, v[day - 1]]));
  const lo = Math.min(...Object.values(exp)), hi = Math.max(...Object.values(exp));
  const verdict = now.cash > hi ? 'better' : now.cash < lo ? 'worse' : 'expected';
  const s = decision.snapshot;
  const message = `${elapsed} дн. назад вы выбрали «${decision.title}». ` +
    `Модель ожидала остаток от ${fmt(lo)} до ${fmt(hi)} (базовый ${fmt(exp.base)}), фактически ${fmt(now.cash)}: ${VERDICT[verdict]}. ` +
    `Продажи за 30 дней: было ${fmt(s.sales30)}, стало ${fmt(now.sales30)}. Прибыль за 30 дней: было ${fmt(s.profit30)}, стало ${fmt(now.profit30)}. ` +
    (elapsed > 90 ? 'Прогноз строился на 90 дней, поэтому сравнение сделано с 90-м днём. ' : '') +
    'Это сравнение с моделью, а не доказательство того, что результат вызвало именно решение.';
  return { elapsedDays: elapsed, comparedDay: day, expected: exp, actualCash: now.cash, verdict, message };
}
