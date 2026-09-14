# Проверка использования файлов через MongoDB

## Назначение

Cloud хранит файлы на диске в `client/uploads`, а MongoDB — только сведения о
проектах и последние полные снимки используемых ими файлов.

Cloud никогда не удаляет кандидатов автоматически. Если хотя бы один активный
проект не прислал отчёт или его отчёт устарел, аудит помечается как неполный.

## Настройка Cloud

Добавьте в `server/.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=cloud
MONGODB_SERVER_SELECTION_TIMEOUT_MS=5000
USAGE_REPORT_MAX_AGE_DAYS=7
```

Рекомендуется создать отдельного пользователя MongoDB, имеющего доступ только к
базе Cloud. Доступ сервера Cloud к базам сторонних проектов не требуется.

Коллекции и индексы `usage_projects` и `usage_reports` создаются автоматически
при первом обращении к API проверки.

## Регистрация проекта

Проект можно добавить в интерфейсе Cloud в разделе «Проверка использования».
После создания токен показывается один раз.

Альтернативный запрос к Express API:

```bash
curl -X POST "https://cloud.escalion.ru/api/usage/projects" \
  -H "Content-Type: application/json" \
  -H "x-api-password: CLOUD_ADMIN_PASSWORD" \
  -d '{
    "project": "artistcrm",
    "name": "Artist CRM",
    "environments": ["production"]
  }'
```

Ответ содержит отдельный токен проекта:

```json
{
  "status": "ok",
  "project": "artistcrm",
  "environments": ["production"],
  "token": "shown-only-once"
}
```

Токен хранится в MongoDB только в виде SHA-256-хеша. Для его замены используйте:

```http
POST /api/usage/projects/artistcrm/rotate-token
```

## API отчёта проекта

```http
POST https://cloud.escalion.ru/api/usage/report
Content-Type: application/json
X-Usage-Token: <токен конкретного проекта>
```

```json
{
  "project": "artistcrm",
  "environment": "production",
  "scannedAt": "2026-08-12T05:00:00.000Z",
  "files": [
    "projects/artistcrm/logo.webp",
    "projects/artistcrm/landing/hero.webp"
  ],
  "warnings": [],
  "stats": {
    "documentsScanned": 1520,
    "linksFound": 48
  }
}
```

`files` — полный снимок, а не добавление к предыдущему списку. Повторный запрос
для той же пары `project + environment` атомарно заменяет прошлый отчёт.

API принимает относительные пути и полные URL на
`https://cloud.escalion.ru/uploads/`. В базе сохраняются нормализованные
относительные пути без query-параметров и hash. Максимум — 50 000 входных
значений в одном отчёте.

Ответ дополнительно содержит `unknownFiles`: ссылки проекта на файлы, которых
сейчас нет в `uploads`.

## Инструкция для ИИ в стороннем проекте

Передайте ИИ следующий текст, заменив идентификатор проекта и при необходимости
названия переменных окружения.

---

Проверь использование файлов Cloud в production MongoDB текущего проекта и
отправь полный снимок в Cloud API.

Параметры:

- базовый адрес файлов: `https://cloud.escalion.ru/uploads/`;
- адрес отчёта: `https://cloud.escalion.ru/api/usage/report`;
- проект: значение `CLOUD_PROJECT`;
- окружение: `production`;
- токен: значение `CLOUD_USAGE_TOKEN`.

Правила выполнения:

1. Сначала изучи фактические модели, схемы, репозитории и подключение MongoDB.
2. Определи поля, где хранятся URL файлов Cloud. Учитывай вложенные объекты,
   массивы и ссылки внутри HTML-текста, если такие поля есть.
3. Работай с MongoDB только на чтение. Не изменяй и не удаляй документы.
4. Не показывай MongoDB URI, пароли и токены в выводе.
5. Собери все полные ссылки, начинающиеся с
   `https://cloud.escalion.ru/uploads/`.
6. Удали query-параметры и hash, отрежь базовый адрес, безопасно URL-декодируй
   путь, замени обратные слеши на прямые и удали дубликаты.
7. Не допускай пустых путей, абсолютных файловых путей и сегментов `..`.
8. Если часть нужных коллекций или полей проверить не удалось, не отправляй
   неполный отчёт как успешный. Опиши причину.
9. Пустой список разрешён только после успешной полной проверки.
10. Отправь один POST-запрос с полным списком. Не используй административный
    пароль Cloud.

Формат запроса:

```http
POST https://cloud.escalion.ru/api/usage/report
Content-Type: application/json
X-Usage-Token: <CLOUD_USAGE_TOKEN>
```

```json
{
  "project": "<CLOUD_PROJECT>",
  "environment": "production",
  "scannedAt": "<текущее время UTC в ISO 8601>",
  "files": ["folder/file.webp"],
  "warnings": [],
  "stats": {
    "documentsScanned": 0,
    "linksFound": 0
  }
}
```

После выполнения сообщи, какие коллекции и поля проверены, сколько документов
просмотрено, сколько ссылок найдено до дедупликации, сколько уникальных путей
отправлено и какие `unknownFiles` вернул Cloud. Не удаляй файлы из Cloud.

---

## Аудит для интерфейса

Защищённый административным паролем endpoint:

```http
GET /api/usage/audit
```

Он возвращает:

- актуальность отчёта каждого проекта и окружения;
- `complete` и `safeToClean`;
- файлы, используемые проектами;
- кандидатов, не упомянутых ни в одном отчёте;
- ссылки на отсутствующие файлы;
- количество и размер файлов по категориям.

Даже при `safeToClean: true` API ничего не удаляет.
