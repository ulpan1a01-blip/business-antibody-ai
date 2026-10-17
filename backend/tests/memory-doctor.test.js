import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import * as auth from '../src/auth.js';
import * as repo from '../src/repo.js';
import { recordDecision, listDecisions, evaluateDecision } from '../src/decisions.js';
import { evaluate } from '../src/engine/memory.js';
import { buildFacts, demoAnswer, askDoctor, SYSTEM_PROMPT } from '../src/doctor.js';
import { buildClothingAlmaty } from '../src/data/demoClothingAlmaty.js';
import { extendDemo } from '../src/data/demoFollowUp.js';

const base = buildClothingAlmaty();
const mk = () => { const db = openDb(); const u = auth.register(db, { email: 'a@mail.kz', password: 'password1', name: 'А' }); const id = repo.createCompany(db, u.id, { name: 'Демо', businessType: 'Магазин одежды' }); repo.seedFromDemo(db, id, u.id, base); return { db, u, id }; };
const dec = { title: 'Тест', snapshot: { asOf: '2026-10-01', sales30: 100, profit30: 10 }, expected: { optimistic: Array(90).fill(200), base: Array(90).fill(150), pessimistic: Array(90).fill(100) } };

test('evaluate: лучше / в пределах / хуже ожиданий', () => {
  const now = (cash) => ({ asOf: '2026-10-11', cash, sales30: 90, profit30: 5 });
  assert.equal(evaluate(dec, now(250)).verdict, 'better');
  assert.equal(evaluate(dec, now(150)).verdict, 'expected');
  assert.equal(evaluate(dec, now(50)).verdict, 'worse');
  assert.equal(evaluate(dec, now(150)).elapsedDays, 10);
});
test('evaluate: без новых данных возвращает null', () => assert.equal(evaluate(dec, { asOf: '2026-10-01', cash: 1, sales30: 1, profit30: 1 }), null));

test('решение сохраняется, без новых данных проверка отклоняется', () => {
  const { db, u, id } = mk();
  const did = recordDecision(db, id, u.id, { scenario: 'delay_payment_30', threatId: 'cash_gap' });
  assert.equal(listDecisions(db, id, u.id)[0].status, 'pending');
  assert.throws(() => evaluateDecision(db, id, u.id, did), /нет новых данных/);
});
test('после 15 новых дней решение оценивается по данным', () => {
  const { db, u, id } = mk();
  const did = recordDecision(db, id, u.id, { scenario: 'delay_payment_30' });
  const n = extendDemo(base, 15);
  repo.replaceRows(db, id, u.id, 'sales', n.sales); repo.replaceRows(db, id, u.id, 'expenses', n.expenses); repo.updateCash(db, id, u.id, n.cash, n.asOf);
  const out = evaluateDecision(db, id, u.id, did);
  assert.equal(out.elapsedDays, 15); assert.equal(out.actualCash, n.cash);
  assert.ok(['better', 'expected', 'worse'].includes(out.verdict));
  assert.equal(listDecisions(db, id, u.id)[0].status, 'evaluated');
});
test('чужое решение оценить нельзя', () => {
  const { db, u, id } = mk(); const b = auth.register(db, { email: 'b@mail.kz', password: 'password2', name: 'Б' });
  const did = recordDecision(db, id, u.id, { scenario: 'ads_up' });
  assert.throws(() => evaluateDecision(db, id, b.id, did), /не найдена/);
});

test('демо-доктор использует реальные данные компании', () => {
  const a = demoAnswer(buildFacts(base), 'Есть ли риск кассового разрыва?');
  assert.match(a, /кассового разрыва/); assert.match(a, /не нейросети/); assert.match(a, /2\s100\s000/);
});
test('без ключа режим demo, с ключом запрос уходит в Claude с фактами и без выдумок', async () => {
  assert.equal((await askDoctor(base, '')).mode, 'demo');
  let sent;
  const fake = async (url, init) => { sent = { url, init }; return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'ответ' }] }) }; };
  const r = await askDoctor(base, 'Почему?', { apiKey: 'test-key', fetchImpl: fake });
  assert.equal(r.mode, 'claude'); assert.equal(r.answer, 'ответ');
  const body = JSON.parse(sent.init.body);
  assert.ok(body.messages[0].content.includes('Текстиль-Опт')); assert.equal(body.system, SYSTEM_PROMPT);
});
test('при ошибке Claude API ответ честно помечается как demo', async () => {
  const r = await askDoctor(base, '', { apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.equal(r.mode, 'demo'); assert.match(r.note, /недоступен/);
});
