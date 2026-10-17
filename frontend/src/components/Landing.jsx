import { motion } from 'framer-motion';
import { ShieldCheck, Play, ChevronDown } from 'lucide-react';

const NODES = [['Финансы', 0], ['Продажи', 72], ['Клиенты', 144], ['Склад', 216], ['Поставщики', 288]];

// Анимированное «цифровое ядро бизнеса»: центр и пять связанных узлов
function Core() {
  const c = 160, r = 115;
  return (
    <svg viewBox="0 0 320 320" className="w-full max-w-md mx-auto">
      <defs><radialGradient id="g"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#7c3aed" /></radialGradient></defs>
      {NODES.map(([label, deg], i) => {
        const a = ((deg - 90) * Math.PI) / 180, x = c + r * Math.cos(a), y = c + r * Math.sin(a);
        return (
          <g key={label}>
            <motion.line x1={c} y1={c} x2={x} y2={y} stroke="#22d3ee" strokeOpacity=".6" strokeDasharray="4 6"
              animate={{ strokeDashoffset: [0, -20] }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }} />
            <motion.circle cx={x} cy={y} r="9" fill="#0f172a" stroke="#a78bfa" strokeWidth="2"
              animate={{ r: [9, 12, 9] }} transition={{ repeat: Infinity, duration: 2.5, delay: i * 0.4 }} />
            <text x={x} y={y + (y > c ? 28 : -18)} textAnchor="middle" fontSize="11" fill="#cbd5e1">{label}</text>
          </g>
        );
      })}
      <motion.circle cx={c} cy={c} r="34" fill="url(#g)" style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
        animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }} />
      <text x={c} y={c + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#020617">ЯДРО</text>
    </svg>
  );
}

const HOW = [
  ['1. Загрузите данные', 'Продажи, расходы, закупки и остатки из CSV или Excel, либо демо-данные.'],
  ['2. Диагностика', 'Система считает показатели и ищет угрозы по понятным правилам.'],
  ['3. Прогноз', 'Для каждой угрозы показываем последствия на 30, 60 и 90 дней и объясняем допущения.'],
  ['4. Цифровой двойник', 'Проверьте решение на модели, прежде чем применять его в бизнесе.'],
];

export default function Landing({ onStart, onDemo }) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-6">
      <header className="flex items-center gap-2 font-bold tracking-wide"><ShieldCheck className="text-cyan-400" /> BUSINESS ANTIBODY AI</header>
      <section className="grid items-center gap-10 py-14 md:grid-cols-2">
        <div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-extrabold leading-tight md:text-5xl">
            Ваш бизнес может не замечать угрозы. <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">Наш ИИ заметит.</span>
          </motion.h1>
          <p className="mt-4 text-slate-300">Интеллектуальная система раннего обнаружения финансовых рисков, скрытых потерь и бизнес-аномалий.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button className="btn-primary" onClick={onStart}><ShieldCheck size={18} /> Запустить диагностику</button>
            <button className="btn-ghost" onClick={onDemo}><Play size={18} /> Посмотреть демо</button>
            <a className="btn-ghost" href="#how"><ChevronDown size={18} /> Как это работает</a>
          </div>
          <p className="mt-4 text-xs text-slate-500">Демо работает на вымышленных данных и не требует регистрации.</p>
        </div>
        <div className="glass p-4"><Core /></div>
      </section>
      <section id="how" className="grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-4">
        {HOW.map(([t, d]) => (<div key={t} className="glass p-5"><h3 className="font-semibold text-cyan-300">{t}</h3><p className="mt-2 text-sm text-slate-300">{d}</p></div>))}
      </section>
    </div>
  );
}
