// Защита от подбора пароля: считаем только НЕУДАЧНЫЕ попытки входа (по IP + email).
export function createLimiter({ max = 10, windowMs = 15 * 60 * 1000, now = Date.now } = {}) {
  const fails = new Map();
  const recent = (key) => (fails.get(key) || []).filter((t) => now() - t < windowMs);
  return {
    blocked: (key) => recent(key).length >= max,
    fail(key) { if (fails.size > 10000) fails.clear(); fails.set(key, [...recent(key), now()]); },
    reset: (key) => fails.delete(key),
  };
}
