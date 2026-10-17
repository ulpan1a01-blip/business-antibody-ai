// ДЕМО-ДАННЫЕ (вымышленные). Магазин одежды, Алматы.
// Сценарий: бизнес прибыльный, но платёж поставщику + сезонный спад дают кассовый разрыв через ~18 дней.
import { addDays } from '../engine/finance.js';
export const AS_OF = '2026-10-15';
export const DOW = [0.9, 0.9, 0.95, 1, 1.1, 1.25, 1.0]; // коэффициент дня недели (Вс..Сб), считается детерминированно

export function buildClothingAlmaty() {
  const sales = [], expenses = [];
  for (let i = 89; i >= 0; i--) {
    const date = addDays(AS_OF, -i);
    const dow = new Date(date + 'T00:00:00Z').getUTCDay();
    const base = i >= 60 ? 190000 : i >= 30 ? 170000 : 150000; // сезонное падение
    const amount = Math.round(base * DOW[dow]);
    sales.push({ date, amount, orders: Math.round(amount / 9500) });
    expenses.push({ date, category: 'Закупка товара', amount: Math.round(amount * 0.5) });
    expenses.push({ date, category: 'Аренда', amount: 20000 });
    expenses.push({ date, category: 'Зарплаты', amount: 33333 });
    expenses.push({ date, category: 'Маркетинг', amount: i >= 30 ? 6700 : 10000 });
  }
  return {
    demo: true, name: 'Магазин одежды «Алатау Стиль» (демо)', city: 'Алматы', asOf: AS_OF,
    cash: 1300000, sales, expenses,
    purchases: [
      { supplier: 'ТОО «Текстиль-Опт»', amount: 7800000 },
      { supplier: 'ИП Сабиров', amount: 1500000 },
      { supplier: 'ТОО «Модный Дом»', amount: 700000 },
    ],
    payables: [{ supplier: 'ТОО «Текстиль-Опт»', amount: 2100000, dueDate: addDays(AS_OF, 18) }],
    inventory: [
      { name: 'Зимние куртки (прошлая коллекция)', qty: 40, cost: 18000, daysSinceLastSale: 85 },
      { name: 'Футболки базовые', qty: 220, cost: 2500, daysSinceLastSale: 3 },
      { name: 'Платья летние', qty: 60, cost: 6000, daysSinceLastSale: 70 },
    ],
  };
}
