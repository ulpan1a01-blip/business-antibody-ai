import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Loader2, CheckCircle2, FlaskConical } from 'lucide-react';
import { money } from '../api.js';

const STEPS = ['Проверка загруженных данных', 'Запуск расчётов', 'Поиск потенциальных угроз', 'Формирование списка рисков', 'Подготовка вариантов действий'];
const SEV = { critical: ['Критический', 'border-red-500/50 bg-red-500/15 text-red-300'], high: ['Высокий', 'border-orange-500/50 bg-orange-500/15 text-orange-300'], medium: ['Средний', 'border-yellow-500/50 bg-yellow-500/15 text-yellow-200'], low: ['Низкий', 'border-sky-500/50 bg-sky-500/15 text-sky-200'] };
const LEVEL = { green: ['#34d399', 'Низкий риск'], yellow: ['#fbbf24', 'Требуется внимание'], red: ['#f43f5e', 'Высокий риск'] };
const TO_SCENARIO = { cash_gap: 'delay_payment_30', sales_drop: 'ads_up', margin_drop: 'cut_costs_10' }; // какую модель открыть для угрозы
const OPTIONS = [['delay_payment_30', 'Договориться об отсрочке платежа'], ['cut_costs_10', 'Снизить постоянные расходы на 10%'], ['ads_up', 'Увеличить рекламный бюджет']];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function Gauge({ health }) {
  const [color, label] = LEVEL[health.level], C = 2 * Math.PI * 52;
  return (
    <div className="glass p-5">
      <div className="flex items-center gap-5">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r="52" fill="none" stroke="#ffffff15" strokeWidth="10" />
          <motion.circle cx="65" cy="65" r="52" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={C}
            initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - health.score / 100) }} transition={{ duration: 1.2 }} transform="rotate(-90 65 65)" />
          <text x="65" y="72" textAnchor="middle" fontSize="30" fontWeight="800" fill="#fff">{health.score}</text>
        </svg>
        <div><p className="text-xs uppercase text-slate-400">Business Health Score</p><p className="text-xl font-bold" style={{ color }}>{label}</p></div>
      </div>
      <div className="mt-4 space-y-3">
        {health.factors.map((f) => (
          <div key={f.name}>
            <div className="flex justify-between text-xs"><span>{f.name}</span><span>{f.points} / {f.max}</span></div>
            <div className="mt-1 h-1.5 rounded bg-white/10"><div className="h-1.5 rounded" style={{ width: `${(f.points / f.max) * 100}%`, background: color }} /></div>
            <p className="mt-1 text-xs text-slate-400">{f.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const Kpi = ({ label, value, sub }) => (<div className="glass p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-lg font-bold">{value}</p>{sub && <p className="text-xs text-slate-400">{sub}</p>}</div>);

export default function Diagnosis({ backend, result, setResult, onSimulate }) {
  const [step, setStep] = useState(-1); const [err, setErr] = useState('');
  const running = step >= 0;

  async function run() { // реальный запрос идёт параллельно с анимацией
    setErr(''); setResult(null);
    const p = backend.diagnose(); p.catch(() => {});
    for (let i = 0; i < STEPS.length; i++) { setStep(i); await sleep(650); }
    try { setResult(await p); } catch (e) { setErr(e.message); }
    setStep(-1);
  }
  const m = result?.metrics;
  return (
    <div className="space-y-6">
      <div className="glass flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-bold">Иммунная диагностика бизнеса</h2><p className="text-sm text-slate-400">Расчёты по вашим данным, без случайных чисел.</p></div>
        <button className="btn-primary" onClick={run} disabled={running}>{running ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />} Запустить иммунную диагностику бизнеса</button>
      </div>
      {running && (
        <div className="glass space-y-2 p-5">
          {STEPS.map((s, i) => (
            <motion.div key={s} initial={{ opacity: 0.3 }} animate={{ opacity: i <= step ? 1 : 0.3 }} className="flex items-center gap-2 text-sm">
              {i < step ? <CheckCircle2 size={16} className="text-emerald-400" /> : i === step ? <Loader2 size={16} className="animate-spin text-cyan-400" /> : <span className="w-4" />} {s}
            </motion.div>
          ))}
        </div>
      )}
      {err && <p className="glass p-4 text-sm text-red-300">{err}</p>}
      {result && !running && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Выручка за 30 дней" value={money(m.sales30)} sub={m.salesChangePct == null ? '' : `${m.salesChangePct.toFixed(1)}% к прошлому периоду`} />
            <Kpi label="Прибыль за 30 дней" value={money(m.profit30)} sub={`маржа ${m.margin30.toFixed(1)}%`} />
            <Kpi label="Расходы за 30 дней" value={money(m.exp30)} />
            <Kpi label="Денежный остаток" value={money(m.cash)} sub={m.coverageDays == null ? '' : `хватит на ${m.coverageDays.toFixed(1)} дн. расходов`} />
            <Kpi label="Средний чек" value={money(m.avgCheck)} />
          </div>
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <Gauge health={result.health} />
            <div className="space-y-4">
              <h3 className="font-bold">Обнаруженные угрозы: {result.threats.length}</h3>
              {result.threats.length === 0 && <p className="glass p-4 text-sm text-emerald-300">Угроз по текущим правилам не найдено.</p>}
              {result.threats.map((t) => (
                <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3"><h4 className="font-semibold">{t.title}</h4><span className={`rounded-full border px-2.5 py-0.5 text-xs ${SEV[t.severity][1]}`}>{SEV[t.severity][0]}</span></div>
                  <ul className="list-inside list-disc text-sm text-slate-300">{t.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
                  <p className="text-sm"><b className="text-cyan-300">Возможная причина:</b> {t.cause}</p>
                  <p className="text-sm"><b className="text-red-300">Прогноз:</b> {t.forecast}</p>
                  <p className="text-sm"><b className="text-violet-300">Что делать:</b> {t.recommendations.join('; ')}.</p>
                  <button className="btn-ghost" onClick={() => onSimulate(TO_SCENARIO[t.id])}><FlaskConical size={16} /> Смоделировать решение</button>
                </motion.div>
              ))}
              <div className="glass p-5">
                <h4 className="font-semibold">Три варианта действий для проверки в цифровом двойнике</h4>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">{OPTIONS.map(([id, label]) => (<button key={id} className="btn-ghost text-left" onClick={() => onSimulate(id)}>{label}</button>))}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
