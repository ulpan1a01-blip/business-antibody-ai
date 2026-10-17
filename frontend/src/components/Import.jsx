import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { api } from '../api.js';

export default function Import({ companyId }) {
  const [kinds, setKinds] = useState({}); const [kind, setKind] = useState('sales');
  const [csv, setCsv] = useState(''); const [prev, setPrev] = useState(null); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  useEffect(() => { api('/meta').then((m) => setKinds(m.importKinds)); }, []);
  const base = `/companies/${companyId}/import`;

  async function preview(text, mapping) {
    setErr(''); setMsg('');
    try { setPrev(await api(base + '/preview', { method: 'POST', body: { kind, csv: text, mapping } })); } catch (e) { setPrev(null); setErr(e.message); }
  }
  async function onFile(e) {
    const f = e.target.files[0]; if (!f) return; let text;
    try {
      if (/\.xlsx?$/i.test(f.name)) { // Excel превращаем в CSV прямо в браузере
        const XLSX = await import('xlsx'); const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
        text = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { dateNF: 'yyyy-mm-dd' });
      } else if (/\.csv$/i.test(f.name)) text = await f.text();
      else return setErr('Поддерживаются только файлы .csv, .xlsx и .xls');
    } catch { return setErr('Не удалось прочитать файл'); }
    setCsv(text); preview(text, null);
  }
  async function commit() {
    setErr('');
    try { const r = await api(base + '/commit', { method: 'POST', body: { kind, csv, mapping: prev.mapping } }); setMsg(`Загружено строк: ${r.imported}`); setPrev(null); setCsv(''); }
    catch (e) { setErr(e.message); }
  }
  const fields = kinds[kind]?.fields || {};
  return (
    <div className="glass space-y-4 p-5">
      <h2 className="text-lg font-bold">Загрузка данных</h2>
      <p className="text-xs text-slate-400">Загрузка заменяет старые данные выбранного типа.</p>
      <div className="flex flex-wrap gap-3">
        <select className="input max-w-xs" value={kind} onChange={(e) => { setKind(e.target.value); setPrev(null); setMsg(''); }}>{Object.entries(kinds).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <label className="btn-ghost cursor-pointer"><Upload size={16} /> Выбрать файл<input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFile} /></label>
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}
      {prev && (<>
        <div className="grid gap-3 sm:grid-cols-2">{Object.entries(fields).map(([field, f]) => (
          <label key={field} className="text-sm"><span className="text-slate-400">{field}{f.required ? ' *' : ''}</span>
            <select className="input mt-1" value={prev.mapping[field] ?? ''} onChange={(e) => preview(csv, { ...prev.mapping, [field]: e.target.value || null })}>
              <option value="">— не выбрано —</option>{prev.headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></label>))}</div>
        <p className="text-sm">Корректных строк: <b className="text-emerald-300">{prev.validCount}</b>, с ошибками: <b className="text-red-300">{prev.errorCount}</b></p>
        {prev.errors.length > 0 && <ul className="max-h-40 overflow-auto text-xs text-red-300">{prev.errors.map((e, i) => <li key={i}>Строка {e.row}, «{e.field}»: {e.message}</li>)}</ul>}
        {prev.preview.length > 0 && <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{Object.keys(prev.preview[0]).map((k) => <th key={k} className="px-2 py-1 text-left text-slate-400">{k}</th>)}</tr></thead>
          <tbody>{prev.preview.map((r, i) => <tr key={i} className="border-t border-white/10">{Object.values(r).map((v, j) => <td key={j} className="px-2 py-1">{String(v ?? '')}</td>)}</tr>)}</tbody></table></div>}
        <button className="btn-primary" disabled={prev.errorCount > 0 || prev.validCount === 0} onClick={commit}>Загрузить данные</button>
      </>)}
    </div>
  );
}
