// Создаёт CSV с историей демо-магазина + 15 вымышленных дней после даты решения.
// Запуск: node scripts/make-followup-csv.js
import { writeFileSync } from 'node:fs';
import { buildClothingAlmaty } from '../src/data/demoClothingAlmaty.js';
import { extendDemo } from '../src/data/demoFollowUp.js';
const n = extendDemo(buildClothingAlmaty(), 15);
writeFileSync('../demo_csv/sales.csv', 'date,amount,orders\n' + n.sales.map((r) => `${r.date},${r.amount},${r.orders}`).join('\n') + '\n');
writeFileSync('../demo_csv/expenses.csv', 'date,category,amount\n' + n.expenses.map((r) => `${r.date},${r.category},${r.amount}`).join('\n') + '\n');
console.log(`Готово. Вкладка «Память»: обновите остаток = ${n.cash}, дату = ${n.asOf}`);
