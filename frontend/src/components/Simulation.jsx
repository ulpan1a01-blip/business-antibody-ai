import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ReferenceLine, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api, money } from '../api.js';

const LINES = [['current', 'Сейчас (без изменений)', '#94a3b8'], ['optimistic', 'Оптимистичный', '#22d3ee'], ['base', 'Базовый', '#a78bfa'], ['pessimistic', 'Пессимистичный', '#f43f5e']];
const Cell = ({ v }) => <td className={`px-3 py-2 text-right ${v < 0 ? 'text-red-300' : ''}`}>{money(v)}</td>;

export default function Simulation({ backend, initial, companyId }) {
  const [scenarios, setScenarios] = useState({}); const [id, setId] = useState(initial || 'delay_payment_30');
  const [data, setData] = useState(null); const [err, setErr] = useState(''); const [saved, setSaved] = useState('');
  async function save() { setSaved(''); try { await api(`/companies/${companyId}/decisions`, { method: 'POST', body: { scenario: id } }); setSaved('Решение сохранено во вкладке «Память»'); } catch (e) { setSaved(e.message); } }
  useEffect(() => { api('/meta').then((m) => setScenarios(m.scenarios)); }, []);
  useEffect(() => { setErr(''); backend.simulate(id).then(setData).catch((e) => setErr(e.message)); }, [id, backend.key]);

  const series = data && data.current.series.map((p, i) => ({ day: p.day, current: p.cash, optimistic: data.cases.optimistic.series[i].cash, base: data.cases.base.series[i].cash, pessimistic: data.cases.pessimistic.series[i].cash }));
  const all = data && { current: data.current, ...data.cases };
  const s = data?.sensitivity;
  return (
    <div className="space-y-6">
      <div className="glass p-5">
        <h2 className="text-lg font-bold">Mirror Simulation — цифровой двойник</h2>
        <select className="input mt-3 max-w-md" value={id} onChange={(e) => setId(e.target.value)}>{Object.entries(scenarios).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <p className="mt-2 text-xs text-slate-400">Это расчёт при заданных допущениях, а не гарантированный прогноз.</p>
        {companyId ? <div className="mt-3 flex flex-wrap items-center gap-3"><button className="btn-ghost" onClick={save}>Сохранить решение в память</button>{saved && <span className="text-sm text-emerald-300">{saved}</span>}</div>
          : <p className="mt-2 text-xs text-slate-500">В демо-режиме решения не сохраняются.</p>}
      </div>
      {err && <p className="glass p-4 text-sm text-red-300">{err}</p>}
      {data && (<>
        <div className="glass p-4">
          <h3 className="mb-2 font-semibold">Денежный остаток на 90 дней</h3>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={series}><CartesianGrid stroke="#ffffff12" /><XAxis dataKey="day" stroke="#94a3b8" /><YAxis stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={60} />
              <Tooltip formatter={(v) => money(v)} labelFormatter={(d) => `День ${d}`} contentStyle={{ background: '#0f172a', border: '1px solid #ffffff20' }} /><Legend />
              <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" />
              {LINES.map(([k, name, color]) => <Line key={k} dataKey={k} name={name} stroke={color} dot={false} strokeWidth={2} strokeDasharray={k === 'current' ? '5 5' : undefined} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="glass overflow-x-auto p-4">
          <table className="w-full text-sm"><thead><tr className="text-slate-400"><th className="px-3 py-2 text-left">Остаток</th>{LINES.map(([k, n]) => <th key={k} className="px-3 py-2 text-right">{n}</th>)}</tr></thead>
            <tbody>{[['cash30', 'Через 30 дней'], ['cash60', 'Через 60 дней'], ['cash90', 'Через 90 дней']].map(([f, label]) => (<tr key={f} className="border-t border-white/10"><td className="px-3 py-2">{label}</td>{LINES.map(([k]) => <Cell key={k} v={all[k][f]} />)}</tr>))}
              <tr className="border-t border-white/10"><td className="px-3 py-2">Деньги закончатся на день</td>{LINES.map(([k]) => <td key={k} className="px-3 py-2 text-right">{all[k].firstNegativeDay ?? '—'}</td>)}</tr></tbody></table>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass p-5"><h3 className="font-semibold">Чувствительность (остаток через 90 дней)</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-300"><li>Спрос −10%: {money(s.demandMinus10)}</li><li>Спрос +10%: {money(s.demandPlus10)}</li><li>Расходы −10%: {money(s.costsMinus10)}</li><li>Расходы +10%: {money(s.costsPlus10)}</li></ul>
            <p className="mt-2 text-xs text-slate-500">Показано изменение относительно базового сценария.</p></div>
          <div className="glass p-5"><h3 className="font-semibold">Допущения и формулы</h3>
            <ul className="mt-2 list-inside list-disc text-sm text-slate-300">{data.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
            <ul className="mt-2 list-inside list-disc text-xs text-slate-400">{data.formulas.map((a) => <li key={a}>{a}</li>)}</ul></div>
        </div>
      </>)}
    </div>
  );
}
