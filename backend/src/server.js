import { openDb } from './db.js';
import { createApp } from './app.js';
const db = openDb(process.env.DB_PATH || './data.sqlite');
const port = process.env.PORT || 3001;
createApp(db, { apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || undefined }).listen(port, () => console.log(`API запущен: http://localhost:${port}`));
