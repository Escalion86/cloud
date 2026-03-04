# AGENTS.md

## Назначение проекта

Cloud - приватное хранилище фотографий и файлов с доступом извне через веб-интерфейс.

Проект состоит из двух частей:
- `server/` - Express-сервер для загрузки/чтения/удаления/переименования файлов и папок.
- `client/` - Next.js-приложение (UI + API-прокси + авторизация в UI).

Физическое хранилище файлов: `client/uploads/` (игнорируется Git).
Временные файлы загрузки: `client/temp/` (игнорируется Git).

## Язык и формат работы агента

- Отвечать пользователю только на русском языке.
- Перед изменениями проверять фактическую реализацию в коде, не полагаться на предположения.
- Не создавать бинарные файлы (изображения, аудио и т.п.).
- Сохранять текущий стиль проекта: функциональные React-компоненты, `prop-types`, существующий нейминг.

## Быстрый старт (локально)

1. Установить зависимости:
   - `cd server && npm i`
   - `cd ../client && npm i`
2. Запустить сервер API:
   - `cd server && npm start` (порт `5000`)
3. Запустить клиент:
   - `cd client && npm run dev` (обычно порт `3000`)

## Архитектура и поток запросов

1. Пользователь логинится в `client` через `/api/auth/login` (пароль `APP_PASSWORD`).
2. `client` ставит HttpOnly cookie `cloud_auth`.
3. UI вызывает только Next API-роуты (`client/pages/api/*`).
4. Next API-роуты проксируют запросы в `server` (`SERVER_API_URL`) и добавляют `SERVER_API_PASSWORD`.
5. `server` проверяет пароль (`PASSWORD`) и работает с файлами в `client/uploads`.

Ключевая идея: браузер не ходит напрямую в Express для служебных действий, только через прокси клиента.

## Переменные окружения

### `server/.env`

- `PASSWORD` - обязательный пароль для Express API (`/api/*`).
- `ALLOWED_EXTENSIONS` - необязательный whitelist расширений через запятую (`jpg,png,pdf`).
- `DOC_MAX_MB` - необязательный лимит размера документов (по умолчанию 20 MB).

### `client/.env.local`

- `APP_PASSWORD` - пароль входа в UI.
- `AUTH_COOKIE_VALUE` - значение auth-cookie (опционально, по умолчанию `ok`).
- `SERVER_API_URL` - адрес Express-сервера (например, `http://localhost:5000`).
- `SERVER_API_PASSWORD` - пароль для проксирования в Express (должен совпадать с `server:PASSWORD`).
- `FILES_BASE_URL` - базовый URL для открытия/скачивания файлов (например, `https://domain/uploads`).
- `NEXT_PUBLIC_SERVER_API_URL` и `NEXT_PUBLIC_FILES_BASE_URL` - публичные fallback-значения для клиента.
- `NEXT_PUBLIC_SERVER_API_PASSWORD` - пароль для прямой загрузки файла из браузера в Express (используется upload-формой).

Важно: загрузка файла в UI идет напрямую в `POST {SERVER_API_URL}/api`, не через Next proxy.

## Основные API (Express, `server/server.js`)

- `POST /api` - загрузка файла (`multipart/form-data`, поле `files`, `directory`).
- `GET /api/files?directory=&noFolders=` - список файлов/папок.
- `GET /api/deletefile?filePath=` - удалить файл.
- `DELETE /api/deletedir?directory=` - удалить папку рекурсивно.
- `POST /api/createdir?directory=` - создать папку.
- `GET /api/dirsize?directory=` - размер директории в байтах.
- `GET /api/disk` - свободное/общее место диска.
- `POST /api/rename?path=&name=` - переименование файла/папки.

Авторизация Express: `password` в query/body или заголовок `x-api-password`.

## Что важно помнить при изменениях

- Путь хранения завязан на `server -> ../client/uploads`; это часть текущего дизайна.
- Для небезопасных операций учитывать защиту от path traversal (`path.resolve` + проверка префикса `uploadsRoot`).
- Не ломать связку паролей:
  - `client:APP_PASSWORD` -> вход в UI.
  - `client:SERVER_API_PASSWORD` == `server:PASSWORD` -> доступ к файловому API.
- В `server` много маршрутов читают параметры из query; при доработках учитывать текущий контракт.
- При добавлении UI-компонентов обязательно указывать `propTypes`/`defaultProps` по текущему паттерну.

## Карта проекта

- `server/server.js` - весь Express API, CORS, загрузка через `multer`, ресайз через `sharp`.
- `server/package.json` - запуск сервера (`npm start`).
- `client/pages/index.js` - основной экран файлового менеджера.
- `client/pages/api/auth/*` - логин/логаут/проверка с cookie.
- `client/pages/api/*.js` и `client/pages/api/files/index.js` - прокси в Express API.
- `client/lib/auth.js` - работа с auth-cookie.
- `client/components/*` - UI-компоненты (навигация, список файлов, модалки, логин).

## Проверки после правок

Минимум перед завершением задачи:

1. `server` стартует без ошибок (`npm start`).
2. `client` стартует без ошибок (`npm run dev`).
3. Логин в UI работает.
4. Работают операции: список, загрузка, создание папки, переименование, удаление, размер папки.
