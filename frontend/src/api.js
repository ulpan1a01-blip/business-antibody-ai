// Единая точка общения с backend. Токен хранится в localStorage и добавляется к каждому запросу.
let token = localStorage.getItem('token');
export const setToken = (t) => { token = t; t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); };

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'Ошибка запроса'); e.details = data.details; e.status = res.status; throw e; }
  return data;
}
export const money = (n) => Math.round(n ?? 0).toLocaleString('ru-RU') + ' ₸';
