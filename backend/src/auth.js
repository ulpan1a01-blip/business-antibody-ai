// АВТОРИЗАЦИЯ. Пароль хранится только как хеш scrypt + соль. Сессии — случайный токен,
// в базе лежит только его SHA-256 (если базу украдут, токены использовать нельзя).
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { ApiError } from './errors.js';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function hashPassword(password) {
  const salt = randomBytes(16);
  return salt.toString('hex') + ':' + scryptSync(password, salt, 64).toString('hex');
}
export function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  return timingSafeEqual(expected, actual); // сравнение за постоянное время
}

export function register(db, { email, password, name }) {
  email = String(email || '').trim().toLowerCase(); name = String(name || '').trim();
  if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Некорректный email');
  if (typeof password !== 'string' || password.length < 8) throw new ApiError(400, 'Пароль должен быть не короче 8 символов');
  if (!name) throw new ApiError(400, 'Укажите имя');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new ApiError(409, 'Этот email уже зарегистрирован');
  const r = db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)').run(email, name, hashPassword(password));
  return { id: Number(r.lastInsertRowid), email, name };
}

export function login(db, { email, password }) {
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  // одинаковое сообщение для «нет пользователя» и «неверный пароль», чтобы не раскрывать, какие email есть в системе
  if (!u || !verifyPassword(String(password || ''), u.password_hash)) throw new ApiError(401, 'Неверный email или пароль');
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 864e5).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), u.id, expires);
  return { token, user: { id: u.id, email: u.email, name: u.name } };
}

export function userFromToken(db, token) {
  if (!token) return null;
  const row = db.prepare(`SELECT u.id, u.email, u.name, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha256(token));
  if (!row || row.expires_at < new Date().toISOString()) return null;
  return { id: row.id, email: row.email, name: row.name };
}
export const logout = (db, token) => db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
