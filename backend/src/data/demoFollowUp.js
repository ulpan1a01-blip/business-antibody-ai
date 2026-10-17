// ДЕМО: продолжение вымышленной истории магазина на N дней вперёд (для проверки Business Memory).
import { addDays } from '../engine/finance.js';
import { DOW } from './demoClothingAlmaty.js';

export function extendDemo(ctx, days) {
  const sales = [...ctx.sales], expenses = [...ctx.expenses]; let cash = ctx.cash;
  for (let i = 1; i <= days; i++) {
    const date = addDays(ctx.asOf, i), dow = new Date(date + 'T00:00:00Z').getUTCDay();
    const amount = Math.round(150000 * DOW[dow]);
    const rows = [['Закупка товара', Math.round(amount * 0.5)], ['Аренда', 20000], ['Зарплаты', 33333], ['Маркетинг', 6700]];
    sales.push({ date, amount, orders: Math.round(amount / 9500) });
    rows.forEach(([category, a]) => expenses.push({ date, category, amount: a }));
    cash += amount - rows.reduce((s, [, a]) => s + a, 0);
  }
  return { ...ctx, sales, expenses, cash: Math.round(cash), asOf: addDays(ctx.asOf, days) };
}
