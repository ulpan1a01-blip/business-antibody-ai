import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, LogOut, Database } from 'lucide-react';
import { api } from '../api.js';
import Diagnosis from './Diagnosis.jsx';
import Simulation from './Simulation.jsx';
import Import from './Import.jsx';
import History from './History.jsx';
import Doctor from './Doctor.jsx';
import Memory from './Memory.jsx';

function CompanyForm({ types, onCreated, onCancel }) {
  const [f, setF] = useState({ name: '', businessType: types[0] || '', city: '', cash: '' }); const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) { e.preventDefault(); setErr(''); try { const r = await api('/companies', { method: 'POST', body: { ...f, cash: Number(f.cash || 0) } }); onCreated(r.id); } catch (x) { setErr(x.message); } }
  return (
    <form onSubmit={submit} className="glass mx-auto max-w-lg space-y-3 p-6">
      <h2 className="text-lg font-bold">Профиль компании</h2>
      <input className="input" placeholder="Название компании" value={f.name} onChange={set('name')} required />
      <select className="input" value={f.businessType} onChange={set('businessType')}>{types.map((t) => <option key={t}>{t}</option>)}</select>
      <input className="input" placeholder="Город" value={f.city} onChange={set('city')} />
      <input className="input" type="number" placeholder="Денежный остаток, ₸" value={f.cash} onChange={set('cash')} />
      {err && <p className="text-sm text-red-300">{err}</p>}
      <div className="flex gap-2"><button className="btn-primary">Создать</button>{onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Отмена</button>}</div>
    </form>
  );
}

export default function Workspace({ user, demo, onExit }) {
  const [meta, setMeta] = useState(null); const [companies, setCompanies] = useState([]); const [cid, setCid] = useState(demo ? 'demo' : null);
  const [tab, setTab] = useState('diagnosis'); const [result, setResult] = useState(null); const [preset, setPreset] = useState(null);
  const [showForm, setShowForm] = useState(false); const [note, setNote] = useState(''); const [hv, setHv] = useState(0);

  async function refresh(select) { const l = await api('/companies'); setCompanies(l); setCid((c) => select ?? c ?? l[0]?.id ?? null); }
  useEffect(() => { api('/meta').then(setMeta); if (!demo) refresh(); }, []);

  // backend: единый набор функций; в демо-режиме идут запросы без авторизации и без сохранения
  const backend = useMemo(() => demo
    ? { key: 'demo', diagnose: () => api('/demo/diagnose'), simulate: (s) => api('/demo/simulate/' + s) }
    : { key: cid, diagnose: async () => { const r = await api(`/companies/${cid}/diagnose`, { method: 'POST' }); setHv((v) => v + 1); return r; }, simulate: (s) => api(`/companies/${cid}/simulate`, { method: 'POST', body: { scenario: s } }) }, [demo, cid]);

  const openSim = (id) => { setPreset(id || null); setTab('simulation'); };
  async function loadDemo() { setNote(''); try { await api(`/companies/${cid}/load-demo`, { method: 'POST' }); setNote('Демонстрационные (вымышленные) данные загружены. Запустите диагностику.'); } catch (e) { setNote(e.message); } }

  const tabs = [['diagnosis', 'Диагностика'], ...(demo ? [] : [['data', 'Данные']]), ['simulation', 'Симуляция'], ['doctor', 'AI-доктор'], ...(demo ? [] : [['memory', 'Память'], ['history', 'История']])];
  if (!meta) return <p className="p-8 text-slate-400">Загрузка…</p>;
  const needForm = !demo && (showForm || (companies.length === 0));
  return (
    <div className="mx-auto max-w-6xl px-5 py-5">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-bold"><ShieldCheck className="text-cyan-400" /> BUSINESS ANTIBODY AI</div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {demo ? <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-yellow-200">Демо-режим: вымышленные данные</span>
            : <><span className="text-slate-400">{user?.name}</span>
              {companies.length > 0 && <select className="input !w-auto" value={cid ?? ''} onChange={(e) => { setCid(Number(e.target.value)); setResult(null); }}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
              <button className="btn-ghost" onClick={() => setShowForm(true)}>+ Компания</button></>}
          <button className="btn-ghost" onClick={onExit}><LogOut size={16} /> {demo ? 'Выйти из демо' : 'Выйти'}</button>
        </div>
      </header>
      {needForm ? <CompanyForm types={meta.businessTypes} onCancel={companies.length ? () => setShowForm(false) : null} onCreated={(id) => { setShowForm(false); setResult(null); refresh(id); }} /> : (<>
        <nav className="mb-5 flex gap-2 overflow-x-auto">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`btn whitespace-nowrap ${tab === k ? 'bg-white/15' : 'border border-white/10 hover:bg-white/5'}`}>{l}</button>)}</nav>
        {!demo && <div className="glass mb-5 flex flex-wrap items-center gap-3 p-3 text-sm"><Database size={16} className="text-cyan-400" /> Нет данных? <button className="btn-ghost !py-1.5" onClick={loadDemo}>Загрузить демо-данные</button><span className="text-xs text-slate-500">Заменит данные компании на вымышленные.</span>{note && <span className="text-emerald-300">{note}</span>}</div>}
        {tab === 'diagnosis' && <Diagnosis backend={backend} result={result} setResult={setResult} onSimulate={openSim} />}
        {tab === 'data' && !demo && <Import companyId={cid} />}
        {tab === 'simulation' && <Simulation key={preset || 'default'} backend={backend} initial={preset} companyId={demo ? null : cid} />}
        {tab === 'doctor' && <Doctor demo={demo} companyId={cid} />}
        {tab === 'memory' && !demo && <Memory companyId={cid} />}
        {tab === 'history' && !demo && <History companyId={cid} refreshKey={hv} />}
      </>)}
    </div>
  );
}
