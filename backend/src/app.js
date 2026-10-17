// HTTP-СЛОЙ (Express): только принимает запросы и вызывает функции из auth/repo/importer/engine.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLimiter } from './rateLimit.js';
import { ApiError } from './errors.js';
import * as auth from './auth.js';
import * as repo from './repo.js';
import { parseCsv, suggestMapping, validateRows, IMPORT_KINDS } from './importer.js';
import { simulate, SCENARIOS } from './engine/simulation.js';
import { healthScore, computeMetrics } from './engine/finance.js';
import { detectThreats } from './engine/antibody.js';
import * as decisions from './decisions.js';
import { askDoctor } from './doctor.js';
import { buildClothingAlmaty } from './data/demoClothingAlmaty.js';

const DIST = fileURLToPath(new URL('../../frontend/dist', import.meta.url)); // собранный фронтенд

export function createApp(db, opts = {}) { // opts: {apiKey, model, fetchImpl}
  const app = express();
  app.set('trust proxy', 1); // на Render запросы идут через прокси, нужен реальный IP
  app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' }); next(); });
  app.use(express.json({ limit: '5mb' }));
  const limiter = createLimiter();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next); // ошибки уходят в общий обработчик

  // Защита: проверка токена из заголовка Authorization: Bearer <token>
  const requireAuth = (req, res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const user = auth.userFromToken(db, token);
    if (!user) return next(new ApiError(401, 'Требуется вход в систему'));
    req.user = user; req.token = token; next();
  };

  // --- Без регистрации (демо-режим): считает на встроенных вымышленных данных, ничего не сохраняет
  app.get('/api/demo/diagnose', wrap((req, res) => { const ctx = buildClothingAlmaty(); res.json({ demo: true, company: ctx.name, health: healthScore(ctx), threats: detectThreats(ctx), metrics: { ...computeMetrics(ctx), cash: ctx.cash } }); }));
  app.get('/api/demo/simulate/:scenario', wrap((req, res) => res.json(simulate(buildClothingAlmaty(), req.params.scenario))));
  app.get('/api/meta', (req, res) => res.json({ businessTypes: repo.BUSINESS_TYPES, scenarios: SCENARIOS, importKinds: IMPORT_KINDS }));

  // --- Авторизация
  app.post('/api/auth/register', wrap((req, res) => res.status(201).json(auth.register(db, req.body))));
  app.post('/api/auth/login', wrap((req, res) => {
    const key = req.ip + ':' + String(req.body?.email || '').toLowerCase();
    if (limiter.blocked(key)) throw new ApiError(429, 'Слишком много неудачных попыток входа. Попробуйте через 15 минут.');
    try { const r = auth.login(db, req.body); limiter.reset(key); res.json(r); } catch (e) { if (e.status === 401) limiter.fail(key); throw e; }
  }));
  app.post('/api/auth/logout', requireAuth, wrap((req, res) => { auth.logout(db, req.token); res.json({ ok: true }); }));
  app.get('/api/me', requireAuth, (req, res) => res.json(req.user));

  // --- Компании
  app.get('/api/companies', requireAuth, (req, res) => res.json(repo.listCompanies(db, req.user.id)));
  app.post('/api/companies', requireAuth, wrap((req, res) => res.status(201).json({ id: repo.createCompany(db, req.user.id, req.body) })));
  app.post('/api/companies/:id/load-demo', requireAuth, wrap((req, res) => { repo.seedFromDemo(db, req.params.id, req.user.id, buildClothingAlmaty()); res.json({ ok: true }); }));

  // --- Импорт: шаг 1 «предпросмотр» (ничего не сохраняет), шаг 2 «подтвердить»
  app.post('/api/companies/:id/import/preview', requireAuth, wrap((req, res) => {
    repo.getCompany(db, req.params.id, req.user.id);
    const { kind, csv, mapping } = req.body; const { headers, rows } = parseCsv(csv);
    const m = mapping || suggestMapping(kind, headers); const { valid, errors } = validateRows(kind, rows, m);
    res.json({ headers, mapping: m, preview: valid.slice(0, 10), validCount: valid.length, errors: errors.slice(0, 50), errorCount: errors.length });
  }));
  app.post('/api/companies/:id/import/commit', requireAuth, wrap((req, res) => {
    const { kind, csv, mapping } = req.body; const { rows } = parseCsv(csv);
    const { valid, errors } = validateRows(kind, rows, mapping);
    if (errors.length) throw new ApiError(400, 'В файле есть ошибки, исправьте их и повторите', errors.slice(0, 50));
    res.json({ imported: repo.replaceRows(db, req.params.id, req.user.id, kind, valid) });
  }));

  // --- Диагностика, история, симуляция
  app.post('/api/companies/:id/diagnose', requireAuth, wrap((req, res) => res.json(repo.diagnose(db, req.params.id, req.user.id))));
  app.get('/api/companies/:id/history', requireAuth, wrap((req, res) => res.json(repo.diagnosisHistory(db, req.params.id, req.user.id))));
  app.post('/api/companies/:id/simulate', requireAuth, wrap((req, res) => res.json(simulate(repo.loadContext(db, req.params.id, req.user.id), req.body.scenario, { elasticity: req.body.elasticity }))));

  // --- AI Business Doctor (без ключа Claude работает демо-режим на правилах)
  const doctorOpts = () => ({ apiKey: opts.apiKey, model: opts.model, fetchImpl: opts.fetchImpl });
  const getQuestion = (req) => { const q = String(req.body?.question || '').trim(); if (q.length > 500) throw new ApiError(400, 'Вопрос слишком длинный (максимум 500 символов)'); return q; };
  app.get('/api/doctor/status', (req, res) => res.json({ mode: opts.apiKey ? 'claude' : 'demo' }));
  app.post('/api/demo/doctor', wrap(async (req, res) => res.json(await askDoctor(buildClothingAlmaty(), getQuestion(req), doctorOpts()))));
  app.post('/api/companies/:id/doctor', requireAuth, wrap(async (req, res) => {
    const ctx = repo.loadContext(db, req.params.id, req.user.id);
    if (!ctx.sales.length) throw new ApiError(400, 'Сначала загрузите данные о продажах');
    res.json(await askDoctor(ctx, getQuestion(req), doctorOpts()));
  }));

  // --- Business Memory
  app.patch('/api/companies/:id', requireAuth, wrap((req, res) => {
    const { cash, asOf } = req.body;
    if (asOf !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new ApiError(400, 'Дата должна быть в формате ГГГГ-ММ-ДД');
    repo.updateCash(db, req.params.id, req.user.id, cash, asOf); res.json({ ok: true });
  }));
  app.get('/api/companies/:id/decisions', requireAuth, wrap((req, res) => res.json(decisions.listDecisions(db, req.params.id, req.user.id))));
  app.post('/api/companies/:id/decisions', requireAuth, wrap((req, res) => res.status(201).json({ id: decisions.recordDecision(db, req.params.id, req.user.id, req.body) })));
  app.post('/api/companies/:id/decisions/:did/evaluate', requireAuth, wrap((req, res) => res.json(decisions.evaluateDecision(db, req.params.id, req.user.id, req.params.did))));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Маршрут не найден' }));
  if (fs.existsSync(DIST)) { // в продакшене один сервис отдаёт и API, и сайт
    app.use(express.static(DIST));
    app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
  }

  app.use((err, req, res, next) => {
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.message, details: err.details });
    console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); // детали не показываем пользователю
  });
  return app;
}
