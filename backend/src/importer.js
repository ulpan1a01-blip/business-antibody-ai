// ИМПОРТ: разбор CSV, автоподбор колонок, проверка данных с понятными ошибками.
import { ApiError } from './errors.js';

// Описание полей для каждого типа файла. aliases — как колонка может называться в файле пользователя.
export const IMPORT_KINDS = {
  sales: { label: 'Продажи', fields: {
    date: { required: true, type: 'date', aliases: ['date', 'дата'] },
    amount: { required: true, type: 'number', aliases: ['amount', 'сумма', 'выручка', 'продажи'] },
    orders: { required: false, type: 'int', aliases: ['orders', 'заказы', 'чеки', 'количество чеков'] } } },
  expenses: { label: 'Расходы', fields: {
    date: { required: true, type: 'date', aliases: ['date', 'дата'] },
    category: { required: true, type: 'text', aliases: ['category', 'категория', 'статья'] },
    amount: { required: true, type: 'number', aliases: ['amount', 'сумма', 'расход'] } } },
  purchases: { label: 'Закупки', fields: {
    supplier: { required: true, type: 'text', aliases: ['supplier', 'поставщик'] },
    amount: { required: true, type: 'number', aliases: ['amount', 'сумма'] },
    date: { required: false, type: 'date', aliases: ['date', 'дата'] } } },
  inventory: { label: 'Товары и остатки', fields: {
    name: { required: true, type: 'text', aliases: ['name', 'товар', 'название', 'наименование'] },
    qty: { required: true, type: 'number', aliases: ['qty', 'остаток', 'количество', 'кол-во'] },
    cost: { required: true, type: 'number', aliases: ['cost', 'себестоимость', 'закупочная цена'] },
    days_since_last_sale: { required: false, type: 'int', aliases: ['days_since_last_sale', 'дней без продаж', 'дней с последней продажи'] } } },
  payables: { label: 'Долги поставщикам', fields: {
    supplier: { required: true, type: 'text', aliases: ['supplier', 'поставщик'] },
    amount: { required: true, type: 'number', aliases: ['amount', 'сумма', 'долг'] },
    due_date: { required: true, type: 'date', aliases: ['due_date', 'срок оплаты', 'оплатить до', 'дата платежа'] } } },
};

// Разбор CSV: поддерживает кавычки, запятую или точку с запятой, переносы строк
export function parseCsv(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter((r) => r.some((x) => x.trim() !== ''));
  if (clean.length < 2) throw new ApiError(400, 'Файл пуст или содержит только заголовок');
  const headers = clean[0].map((h) => h.trim());
  return { headers, rows: clean.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))) };
}

// Автоподбор: какая колонка файла соответствует какому полю. Пользователь может поправить вручную.
export function suggestMapping(kind, headers) {
  const spec = IMPORT_KINDS[kind]; if (!spec) throw new ApiError(400, 'Неизвестный тип данных: ' + kind);
  const mapping = {};
  for (const [field, f] of Object.entries(spec.fields)) {
    mapping[field] = headers.find((h) => f.aliases.includes(h.toLowerCase())) ?? null;
  }
  return mapping;
}

function toDate(v) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); // 31.12.2026
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
function toNumber(v) {
  const s = String(v).replace(/[\s\u00A0₸]/g, '').replace(',', '.');
  return s !== '' && /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

// Проверка: возвращает чистые строки и список ошибок «строка N, колонка, причина»
export function validateRows(kind, rawRows, mapping) {
  const spec = IMPORT_KINDS[kind]; if (!spec) throw new ApiError(400, 'Неизвестный тип данных: ' + kind);
  const errors = [], valid = [];
  for (const [field, f] of Object.entries(spec.fields)) {
    if (f.required && !mapping[field]) errors.push({ row: 0, field, message: `Не выбрана колонка для обязательного поля «${field}»` });
  }
  if (errors.length) return { valid, errors };
  rawRows.forEach((raw, i) => {
    const out = {}; let ok = true;
    for (const [field, f] of Object.entries(spec.fields)) {
      const v = mapping[field] ? String(raw[mapping[field]] ?? '').trim() : '';
      if (v === '') { if (f.required) { errors.push({ row: i + 2, field, message: 'Пустое значение' }); ok = false; } else out[field] = f.type === 'text' || f.type === 'date' ? null : 0; continue; }
      let val = f.type === 'date' ? toDate(v) : f.type === 'text' ? v : toNumber(v);
      if (val === null) { errors.push({ row: i + 2, field, message: `Неверный формат: «${v}»` }); ok = false; continue; }
      if (f.type === 'number' && val < 0 && field !== 'amount') { errors.push({ row: i + 2, field, message: 'Значение не может быть отрицательным' }); ok = false; continue; }
      out[field] = f.type === 'int' ? Math.round(val) : val;
    }
    if (ok) valid.push(out);
  });
  return { valid, errors };
}
