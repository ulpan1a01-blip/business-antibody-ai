# BUSINESS ANTIBODY AI (этапы 1–4)
Требуется Node.js 22.13+.
1) Backend:  cd backend && npm install && npm start      (http://localhost:3001)
2) Frontend: cd frontend && npm install && npm run dev   (http://localhost:5173)
Демо без регистрации: кнопка «Посмотреть демо».
Claude API: скопируйте .env.example в backend/.env и вставьте ANTHROPIC_API_KEY (backend сам файл .env не читает: запускайте `node --env-file=.env src/server.js`).
Без ключа AI-доктор работает в демо-режиме на правилах и честно это показывает.
Проверка Business Memory: demo_csv/ (вымышленная история + 15 дней после решения), см. скрипт backend/scripts/make-followup-csv.js
