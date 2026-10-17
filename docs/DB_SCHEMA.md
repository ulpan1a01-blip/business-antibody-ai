# Схема базы данных (SQLite)

    users ──< sessions
      │
      └──< companies ──< sales | expenses | purchases | payables | inventory
                    ├──< diagnoses   (история диагностик)
                    └──< decisions   (Business Memory)

| Таблица | Поля | Назначение |
|---|---|---|
| users | id, email (уникальный), name, password_hash (scrypt+соль), created_at | Предприниматели |
| sessions | token_hash (SHA-256), user_id, expires_at | Входы; сам токен в базе не хранится |
| companies | id, owner_id, name, business_type, city, cash, as_of, is_demo | Профиль компании; `as_of` — дата, на которую актуальны данные |
| sales | company_id, date, amount, orders | Продажи по дням |
| expenses | company_id, date, category, amount | Расходы; категория «Закупка товара» считается себестоимостью |
| purchases | company_id, date, supplier, amount | Закупки по поставщикам |
| payables | company_id, supplier, amount, due_date | Что нужно оплатить поставщикам |
| inventory | company_id, name, qty, cost, days_since_last_sale | Склад |
| diagnoses | id, company_id, created_at, score, level, result_json | История диагностик |
| decisions | id, company_id, scenario_id, title, snapshot_json, expected_json, status, outcome_json | Решение, прогноз на момент решения, результат проверки |

Защита данных: каждый запрос к компании проверяет `owner_id = текущий пользователь` (функция `getCompany` в `repo.js`).
