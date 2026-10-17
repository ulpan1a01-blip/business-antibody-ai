import { useEffect, useState } from 'react';
import { Stethoscope, Loader2, Bot, Cog } from 'lucide-react';
import { api } from '../api.js';

const PRESETS = ['Что сейчас главное и что делать?', 'Есть ли риск кассового разрыва?', 'Почему упали продажи?', 'Какие данные тебе ещё нужны?'];

export default function Doctor({ demo, companyId }) {
  const [status, setStatus] = useState(null); const [q, setQ] = useState(''); const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { api('/doctor/status').then(setStatus).catch(() => {}); }, []);

  async function ask(text) {
    setBusy(true); setErr(''); setRes(null);
    try { setRes(await api(demo ? '/demo/doctor' : `/companies/${companyId}/doctor`, { method: 'POST', body: { question: text } })); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  const claude = res?.mode === 'claude';
  return (
    <div className="space-y-5">
      <div className="glass p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Stethoscope className="text-cyan-400" /> AI Business Doctor</h2>
        <p className="mt-1 text-sm text-slate-400">Объясняет проблемы по данным вашей компании. Он только советует: цены, сообщения поставщикам и платежи вы подтверждаете сами.</p>
        {status && <p className="mt-2 text-xs text-slate-500">{status.mode === 'claude' ? 'Подключён Claude API: вопрос и сводка показателей компании отправляются в Claude.' : 'Ключ Claude не задан: работает демо-режим на встроенных правилах (не нейросеть).'}</p>}
        <div className="mt-4 flex flex-wrap gap-2">{PRESETS.map((p) => <button key={p} className="btn-ghost !py-1.5 text-xs" disabled={busy} onClick={() => { setQ(p); ask(p); }}>{p}</button>)}</div>
        <div className="mt-3 flex gap-2">
          <input className="input" maxLength={500} placeholder="Ваш вопрос о бизнесе…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !busy && ask(q)} />
          <button className="btn-primary" disabled={busy} onClick={() => ask(q)}>{busy ? <Loader2 className="animate-spin" size={16} /> : 'Спросить'}</button>
        </div>
      </div>
      {err && <p className="glass p-4 text-sm text-red-300">{err}</p>}
      {res && (
        <div className="glass p-5">
          <p className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${claude ? 'border-violet-500/50 bg-violet-500/15 text-violet-200' : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200'}`}>
            {claude ? <><Bot size={14} /> Ответ нейросети Claude</> : <><Cog size={14} /> Ответ встроенных правил, не нейросети</>}</p>
          {res.note && <p className="mb-2 text-xs text-orange-300">{res.note}</p>}
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{res.answer}</div>
        </div>
      )}
    </div>
  );
}
