import { useEffect, useState } from 'react';
import { api } from '../api.js';
const COLOR = { green: 'text-emerald-300', yellow: 'text-yellow-300', red: 'text-red-300' };

export default function History({ companyId, refreshKey }) {
  const [items, setItems] = useState([]);
  useEffect(() => { api(`/companies/${companyId}/history`).then(setItems).catch(() => setItems([])); }, [companyId, refreshKey]);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">История диагностик</h2>
      {items.length === 0 && <p className="glass p-4 text-sm text-slate-400">Диагностик пока нет. Запустите первую на вкладке «Диагностика».</p>}
      {items.map((h) => (
        <div key={h.id} className="glass flex flex-wrap items-center justify-between gap-3 p-4">
          <div><p className="text-sm text-slate-400">{h.createdAt} (UTC)</p><p className="mt-1 text-sm">{h.threats.length ? h.threats.map((t) => t.title).join(' · ') : 'Угроз не найдено'}</p></div>
          <p className={`text-2xl font-extrabold ${COLOR[h.level]}`}>{h.score}</p>
        </div>
      ))}
    </div>
  );
}
