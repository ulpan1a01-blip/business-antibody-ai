// ANTIBODY ENGINE: каждый детектор — отдельная функция с порогом.
// Если порог не превышен, угроза не создаётся.
import { computeMetrics, forecastCash, windowSum, sum } from './finance.js';

const fmt = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₸';
const ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

const detectors = [
  function cashGap(ctx) {
    const f = forecastCash(ctx, { days: 60 });
    if (f.firstNegativeDay === null) return null;
    const next = ctx.payables.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    return {
      id: 'cash_gap', title: 'Риск кассового разрыва',
      severity: f.firstNegativeDay <= 30 ? 'critical' : 'high',
      evidence: [`Денежный остаток сейчас: ${fmt(ctx.cash)}`,
        next ? `Платёж поставщику «${next.supplier}»: ${fmt(next.amount)} до ${next.dueDate}` : 'Платежей нет',
        `Прогноз: остаток станет отрицательным через ${f.firstNegativeDay} дн., минимум ${fmt(f.minCash)}`],
      cause: 'Крупный платёж поставщику совпадает с сезонным снижением продаж: ежедневной прибыли не хватает, чтобы его покрыть.',
      forecast: `Через ${f.firstNegativeDay} дней нечем платить по обязательствам, дефицит до ${fmt(-f.minCash)}.`,
      recommendations: ['Договориться об отсрочке или разбивке платежа на части', 'Сократить закупки на медленные позиции', 'Провести акцию на залежавшийся товар, чтобы вернуть деньги'],
    };
  },
  function salesDrop(ctx) {
    const m = computeMetrics(ctx);
    if (m.salesChangePct === null || m.salesChangePct > -10) return null;
    return {
      id: 'sales_drop', title: 'Падение продаж',
      severity: m.salesChangePct <= -20 ? 'high' : 'medium',
      evidence: [`Продажи за 30 дней: ${fmt(m.sales30)}`, `Предыдущие 30 дней: ${fmt(m.salesPrev30)}`, `Изменение: ${m.salesChangePct.toFixed(1)}%`],
      cause: 'Возможны сезонность, рост конкуренции или снижение трафика. По одним цифрам причину точно определить нельзя: нужны данные о клиентах и рекламе.',
      forecast: 'Если тренд сохранится, выручка продолжит снижаться, а постоянные расходы останутся прежними.',
      recommendations: ['Проверить, какие товары просели сильнее всего', 'Запустить сезонное предложение', 'Сравнить с тем же периодом прошлого года'],
    };
  },
  function marginDrop(ctx) {
    const m = computeMetrics(ctx);
    const drop = m.marginPrev30 - m.margin30;
    if (drop < 3) return null;
    return {
      id: 'margin_drop', title: 'Снижение маржинальности', severity: drop >= 8 ? 'high' : 'medium',
      evidence: [`Маржа сейчас: ${m.margin30.toFixed(1)}%`, `Маржа раньше: ${m.marginPrev30.toFixed(1)}%`, `Падение: ${drop.toFixed(1)} п.п.`],
      cause: 'Постоянные расходы (аренда, зарплаты) не уменьшились, когда продажи упали.',
      forecast: 'При дальнейшем падении выручки бизнес уйдёт в убыток.',
      recommendations: ['Пересмотреть постоянные расходы', 'Проверить закупочные цены'],
    };
  },
  function supplierDependence(ctx) {
    const total = sum(ctx.purchases, (p) => p.amount);
    if (!total) return null;
    const by = {};
    ctx.purchases.forEach((p) => (by[p.supplier] = (by[p.supplier] || 0) + p.amount));
    const [name, amount] = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
    const share = (amount / total) * 100;
    if (share < 60) return null;
    return {
      id: 'supplier_dependence', title: 'Зависимость от одного поставщика', severity: share >= 75 ? 'high' : 'medium',
      evidence: [`Поставщик «${name}»: ${share.toFixed(0)}% всех закупок`, `Сумма: ${fmt(amount)}`],
      cause: 'Почти все закупки идут через одного поставщика.',
      forecast: 'Задержка поставки или рост цены напрямую остановит продажи, и вы не сможете торговаться.',
      recommendations: ['Найти 1–2 запасных поставщика', 'Закупать у запасного хотя бы 20–30% товара'],
    };
  },
  function deadStock(ctx) {
    const dead = ctx.inventory.filter((i) => i.daysSinceLastSale >= 60);
    const value = sum(dead, (i) => i.qty * i.cost);
    if (!dead.length || value < ctx.cash * 0.1) return null;
    return {
      id: 'dead_stock', title: 'Залежавшиеся товары', severity: value >= ctx.cash * 0.3 ? 'high' : 'medium',
      evidence: dead.map((i) => `${i.name}: ${i.qty} шт., не продавалось ${i.daysSinceLastSale} дн.`).concat(`Заморожено денег: ${fmt(value)}`),
      cause: 'Товары закуплены сверх спроса или не соответствуют сезону.',
      forecast: 'Деньги заморожены на складе, и товары дешевеют с каждым месяцем.',
      recommendations: ['Распродажа со скидкой 20–30%', 'Не закупать эти позиции повторно'],
    };
  },
];

export function detectThreats(ctx) {
  return detectors.map((d) => d(ctx)).filter(Boolean).sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
