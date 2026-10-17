import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import * as auth from '../src/auth.js';
import * as repo from '../src/repo.js';
import { parseCsv, suggestMapping, validateRows } from '../src/importer.js';
import { buildClothingAlmaty } from '../src/data/demoClothingAlmaty.js';

const setup = () => { const db = openDb(); const a = auth.register(db, { email: 'A@mail.kz', password: 'password1', name: 'Айдана' }); const b = auth.register(db, { email: 'b@mail.kz', password: 'password2', name: 'Берик' }); return { db, a, b }; };

test('пароль хранится как хеш, вход работает, неверный пароль отклоняется', () => {
  const { db } = setup();
  assert.ok(!db.prepare('SELECT password_hash h FROM users').get().h.includes('password1'));
  const s = auth.login(db, { email: 'a@mail.kz', password: 'password1' });
  assert.equal(auth.userFromToken(db, s.token).name, 'Айдана');
  assert.throws(() => auth.login(db, { email: 'a@mail.kz', password: 'wrong' }), /Неверный/);
});
test('валидация регистрации', () => {
  const db = openDb();
  assert.throws(() => auth.register(db, { email: 'bad', password: 'password1', name: 'X' }), /email/);
  assert.throws(() => auth.register(db, { email: 'a@b.kz', password: '123', name: 'X' }), /8 символов/);
});
test('после выхода токен не работает', () => {
  const { db } = setup(); const s = auth.login(db, { email: 'a@mail.kz', password: 'password1' });
  auth.logout(db, s.token); assert.equal(auth.userFromToken(db, s.token), null);
});
test('пользователь не видит чужую компанию', () => {
  const { db, a, b } = setup();
  const id = repo.createCompany(db, a.id, { name: 'Моя', businessType: 'Услуги', cash: 100 });
  assert.throws(() => repo.getCompany(db, id, b.id), /не найдена/);
  assert.throws(() => repo.replaceRows(db, id, b.id, 'sales', []), /не найдена/);
});
test('демо-данные проходят через БД и дают тот же кассовый разрыв', () => {
  const { db, a } = setup();
  const id = repo.createCompany(db, a.id, { name: 'Демо', businessType: 'Магазин одежды' });
  repo.seedFromDemo(db, id, a.id, buildClothingAlmaty());
  const r = repo.diagnose(db, id, a.id);
  assert.ok(r.threats.some((t) => t.id === 'cash_gap'));
  assert.equal(repo.diagnosisHistory(db, id, a.id).length, 1);
});
test('CSV: кавычки, точка с запятой, автоподбор колонок', () => {
  const { headers, rows } = parseCsv('Дата;Сумма;Заказы\r\n01.10.2026;"150 000,50";12\r\n');
  assert.deepEqual(headers, ['Дата', 'Сумма', 'Заказы']);
  const { valid, errors } = validateRows('sales', rows, suggestMapping('sales', headers));
  assert.equal(errors.length, 0);
  assert.deepEqual(valid[0], { date: '2026-10-01', amount: 150000.5, orders: 12 });
});
test('CSV: понятные ошибки с номером строки', () => {
  const { headers, rows } = parseCsv('date,amount\n2026-10-01,abc\n,500\n');
  const { valid, errors } = validateRows('sales', rows, suggestMapping('sales', headers));
  assert.equal(valid.length, 0);
  assert.deepEqual(errors.map((e) => e.row), [2, 3]);
});
test('ошибка, если не выбрана обязательная колонка', () => {
  const { errors } = validateRows('expenses', [{ a: '1' }], { date: null, category: null, amount: null });
  assert.equal(errors.length, 3);
});

import { createLimiter } from '../src/rateLimit.js';
test('лимитер блокирует после 3 неудач и отпускает после окна времени', () => {
  let t = 0; const l = createLimiter({ max: 3, windowMs: 1000, now: () => t });
  [1, 2, 3].forEach(() => l.fail('k')); assert.equal(l.blocked('k'), true);
  t = 1500; assert.equal(l.blocked('k'), false);
  l.fail('k'); l.reset('k'); assert.equal(l.blocked('k'), false);
});
