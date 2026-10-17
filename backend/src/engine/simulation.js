// MIRROR SIMULATION: цифровой двойник. Пересчитывает прогноз под выбранное решение.
import { forecastCash } from './finance.js';

export const ELASTICITY = -1.2; // допущение: цена +1% → спрос -1.2%
export const SCENARIOS = {
  price_up_15: { label: 'Поднять цены на 15%', priceChangePct: 15 },
  cut_costs_10: { label: 'Снизить постоянные расходы на 10%', fixedChangePct: -10 },
  hire_2: { label: 'Нанять двух сотрудников (по 250 000 ₸/мес)', extraFixedMonthly: 500000 },
  ads_up: { label: 'Реклама +200 000 ₸/мес (спрос +8%)', extraFixedMonthly: 200000, demandUpliftPct: 8 },
  delay_payment_30: { label: 'Отсрочка платежа поставщику на 30 дней', payableShiftDays: 30 },
};
const CASES = { optimistic: { demand: 0.1, cost: -0.03 }, base: { demand: 0, cost: 0 }, pessimistic: { demand: -0.1, cost: 0.05 } };

function run(ctx, s, demandShock, costShock, elasticity) {
  const price = (s.priceChangePct || 0) / 100;
  const demandMult = (1 + demandShock) * (1 + elasticity * price) * (1 + (s.demandUpliftPct || 0) / 100);
  return forecastCash(ctx, {
    demandMult, priceMult: 1 + price,
    fixedMult: (1 + (s.fixedChangePct || 0) / 100) * (1 + costShock),
    extraFixedDaily: (s.extraFixedMonthly || 0) / 30,
    payableShiftDays: s.payableShiftDays || 0,
  });
}

export function simulate(ctx, scenarioId, { elasticity = ELASTICITY } = {}) {
  const s = SCENARIOS[scenarioId];
  if (!s) throw new Error('Неизвестный сценарий: ' + scenarioId);
  const at = (f, d) => f.series[d - 1].cash;
  const pack = (f) => ({ cash30: at(f, 30), cash60: at(f, 60), cash90: at(f, 90), minCash: f.minCash, firstNegativeDay: f.firstNegativeDay, series: f.series });
  const current = pack(forecastCash(ctx)); // «ничего не менять»
  const cases = {};
  for (const [name, c] of Object.entries(CASES)) cases[name] = pack(run(ctx, s, c.demand, c.cost, elasticity));
  const base90 = cases.base.cash90;
  const sens = (d, c) => run(ctx, s, d, c, elasticity).series[89].cash - base90;
  return {
    scenario: { id: scenarioId, ...s }, current, cases,
    sensitivity: { // как меняется остаток через 90 дней при изменении допущений
      demandMinus10: sens(-0.1, 0), demandPlus10: sens(0.1, 0), costsMinus10: sens(0, -0.1), costsPlus10: sens(0, 0.1),
    },
    assumptions: [`Эластичность спроса: ${elasticity}`, 'Оптимистичный: спрос +10%, расходы -3%', 'Пессимистичный: спрос -10%, расходы +5%', 'Прогноз не гарантирует результат: это расчёт при заданных допущениях'],
    formulas: ['Спрос = (1 + шок) × (1 + эластичность × изменение цены) × (1 + эффект рекламы)', 'Выручка/день = продажи × спрос × (1 + изменение цены)', 'Себестоимость/день = продажи × спрос × доля закупок', 'Остаток(день) = остаток(день-1) + выручка − себестоимость − постоянные расходы − платежи'],
  };
}
