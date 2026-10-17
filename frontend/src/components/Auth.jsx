import { useState } from 'react';
import { api, setToken } from '../api.js';

export default function Auth({ onDone, onBack }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (mode === 'register') await api('/auth/register', { method: 'POST', body: f });
      const s = await api('/auth/login', { method: 'POST', body: { email: f.email, password: f.password } });
      setToken(s.token); onDone(s.user);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <form onSubmit={submit} className="glass space-y-4 p-6">
        <h2 className="text-xl font-bold">{mode === 'login' ? 'Вход' : 'Регистрация'}</h2>
        {mode === 'register' && <input className="input" placeholder="Ваше имя" value={f.name} onChange={set('name')} required />}
        <input className="input" type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
        <input className="input" type="password" placeholder="Пароль (минимум 8 символов)" value={f.password} onChange={set('password')} required />
        {err && <p className="text-sm text-red-300">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
        <button type="button" className="w-full text-sm text-slate-400 hover:text-white" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
        <button type="button" className="w-full text-sm text-slate-500 hover:text-white" onClick={onBack}>← На главную</button>
      </form>
    </div>
  );
}
