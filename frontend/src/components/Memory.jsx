import { useEffect, useState } from 'react';
import { Brain, Loader2 } from 'lucide-react';
import { api, money } from '../api.js';

const V = { better: ['Лучше ожиданий', 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'], expected: ['В пределах ожиданий', 'border-sky-500/50 bg-sky-500/15 text-sky-200'], worse: ['Хуже ожиданий', 'border-red-500/50 bg-red-500/15 text-red-300'] };

export default function Memory({ companyId }) {
  const [items, setItems] = useState([]); const [busy, setBusy] = useState(null); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [upd, setUpd] = useState({ cash: '', asOf: '' });
  const load = () => api(`/companies/${companyId}/decisions`).then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [companyId]);

  async function check(id) {
    setBusy(id); setErr('');
    try { await api(`/companies/${companyId}/decisions/${id}/evaluate`, { method: 'POST' }); await load(); } catch (e) { setErr(e.message); } finally { setBusy(null); }
  }
  async function update() {
    setErr(''); setOk('');
    try { await api(`/companies/${companyId}`, { method: 'PATCH', body: { cash: Number(upd.cash), asOf: upd.asOf } }); setOk('Остаток и дата обновлены'); } catch (e) { setErr(e.message); }
  }
  return (
    <div className="space-y-5">
      <div className="glass p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Brain className="text-violet-400" /> Business Memory</h2>
        <p className="mt-1 text-sm text-slate-400">Здесь хранятся ваши решения и прогноз, который модель дала в момент решения. После загрузки новых данных можно сравнить ожидание с реальностью.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400">Актуальный остаток, ₸<input className="input mt-1" type="number" value={upd.cash} onChange={(e) => setUpd({ ...upd, cash: e.target.value })} /></label>
          <label className="text-xs text-slate-400">Данные актуальны на дату<input className="input mt-1" type="date" value={upd.asOf} onChange={(e) => setUpd({ ...upd, asOf: e.target.value })} /></label>
          <button className="btn-ghost" disabled={!upd.cash || !upd.asOf} onClick={update}>Обновить</button>
        </div>
        {ok && <p className="mt-2 text-sm text-emerald-300">{ok}</p>}
      </div>
      {err && <p className="glass p-4 text-sm text-red-300">{err}</p>}
      {items.length === 0 && <p className="glass p-4 text-sm text-slate-400">Решений пока нет. Откройте «Симуляцию» и нажмите «Сохранить решение в память».</p>}
      {items.map((d) => (
        <div key={d.id} className="glass space-y-2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{d.title}</h3>
            {d.outcome && <span className={`rounded-full border px-2.5 py-0.5 text-xs ${V[d.outcome.verdict][1]}`}>{V[d.outcome.verdict][0]}</span>}</div>
          <p className="text-xs text-slate-400">Решение принято на дату данных: {d.decisionDate}. Ожидаемый базовый остаток: через 30 дн. {money(d.expectedBase30)}, через 90 дн. {money(d.expectedBase90)}.</p>
          {d.outcome && <p className="text-sm text-slate-200">{d.outcome.message}</p>}
          <button className="btn-ghost" disabled={busy === d.id} onClick={() => check(d.id)}>{busy === d.id && <Loader2 className="animate-spin" size={16} />} {d.outcome ? 'Проверить снова' : 'Проверить результат'}</button>
        </div>
      ))}
    </div>
  );
}
