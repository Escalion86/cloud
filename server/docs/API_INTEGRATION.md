# Cloud Server API Integration Guide

## 1) Purpose
This document describes the actual HTTP contract of `server/server.js` so an external project (including an AI agent) can integrate with the Cloud file API reliably.

All endpoint behaviors below reflect current implementation.

## 2) Base URL
- Local default: `http://localhost:5000`
- Base API prefix: `/api`
- Public file URL base: `PUBLIC_BASE_URL` from `server/.env`

Examples in this document use `http://localhost:5000`.

## 3) Authentication
All `/api/*` endpoints require API password (`PASSWORD` in `server/.env`).

Server accepts password from any one of:
- Query param: `password`
- Body field: `password`
- Header: `x-api-password`
- Header: `x-token`
- Header: `authorization` (raw value or `Bearer <token>`)

If auth is missing/invalid, API returns:
- HTTP `401`
- JSON: `{ "status": "error", "message": "Unauthorized" }`
  or for upload route with extra details:
  `{ "status": "error", "message": "Unauthorized", "reason": "Неверный пароль API" }`

Recommended integration method: always send `x-api-password` header.

## 4) Storage model
Physical root for files is:
- `../client/uploads` relative to `server/server.js`

Public static files are exposed by server as:
- `/uploads/<path>`

## 5) Common notes for AI integrators
- Paths in many routes are relative to uploads root.
- Some routes read params only from query string even when HTTP method is `POST`/`DELETE`.
- Upload route is `multipart/form-data` with file field name exactly `files`.
- Upload success response contains both `urls` and `data` with same array value.
- `noFolders` in `/api/files` is treated as truthy by presence of any non-empty value.

## 6) Endpoints

### 6.1 Upload file
`POST /api`

Content-Type:
- `multipart/form-data`

Form fields:
- `files` (required): binary file
- `directory` (optional): target relative directory (e.g. `photos/2026`)
- `project` (optional): used only if `directory` is not provided
- `folder` (optional): used only if `directory` is not provided
- `fileName` (optional): desired filename **without extension** (server sanitizes)
- `extension` (optional): desired extension (e.g. `jpg`, `.pdf`)
- `generateName` (optional): boolean-like (`true`, `1`, `yes`, `on` => true)
- `password` (optional): auth fallback (prefer header)

Directory resolution:
1. If `directory` is provided => use it.
2. Else use `project/folder` combination (empty parts are skipped).

Filename/extension logic:
1. `extension`:
   - if provided => sanitized value is used;
   - else => extension from uploaded file is used.
2. Base filename:
   - if `generateName=true` => UUID is used;
   - else if `fileName` provided => use `fileName`;
   - else => use original uploaded filename base;
   - fallback => UUID.
3. Final stored name: `<baseName>.<extension>`.
4. If file with same name already exists in target directory, server auto-appends numeric suffix:
   - `name.ext` -> `name (1).ext` -> `name (2).ext` and so on.

Image post-processing:
- If MIME is `image/*` and extension is one of `jpg|jpeg|png|webp`, file is resized to fit within `2400x2400` (without enlargement) using `sharp` and saved with quality `90`.
- Other file types are moved as-is.

Validation:
- If `ALLOWED_EXTENSIONS` set in env, extension must be in whitelist.
- Document extensions `pdf|doc|docx|xls|xlsx|ppt|pptx` are limited by `DOC_MAX_MB` (default 20 MB).

Success response:
- HTTP `200`
- Body is array of URLs (because route uses `sendUploadResponse` wrapper):
```json
["${PUBLIC_BASE_URL}/uploads/photos/2026/example.jpg"]
```

Typical errors:
- `400` upload middleware or missing file
- `401` unauthorized
- `413` document too large
- `415` extension not allowed
- `500` internal error

cURL example:
```bash
curl -X POST "http://localhost:5000/api" \
  -H "x-api-password: YOUR_PASSWORD" \
  -F "files=@/absolute/path/photo.jpg" \
  -F "directory=photos/2026" \
  -F "fileName=vacation_cover" \
  -F "extension=webp" \
  -F "generateName=false"
```

### 6.2 List files/folders
`GET /api/files?directory=<path>&noFolders=<any>&password=<pwd>`

Query params:
- `directory` (required in practice): relative path under uploads
- `noFolders` (optional): when present/truthy, only files are returned
- `password` optional if header auth used

Success `200`:
```json
[
  {
    "name": "photo.jpg",
    "isFile": true,
    "size": 12345,
    "modified": 1760000000000
  }
]
```

If target directory does not exist, returns empty array `[]`.

cURL:
```bash
curl "http://localhost:5000/api/files?directory=photos/2026" \
  -H "x-api-password: YOUR_PASSWORD"
```

### 6.3 Delete file
`GET /api/deletefile?filePath=<relative-file-path>&password=<pwd>`

Query params:
- `filePath` (required): relative path including filename

Success `200`:
```json
{ "status": "ok", "message": "File deleted!" }
```

cURL:
```bash
curl "http://localhost:5000/api/deletefile?filePath=photos/2026/photo.jpg" \
  -H "x-api-password: YOUR_PASSWORD"
```

### 6.4 Delete directory
`DELETE /api/deletedir?directory=<relative-dir>&password=<pwd>`

Success `200`:
```json
{ "status": "ok", "message": "Directory deleted!" }
```

Errors:
- `400` missing/invalid directory
- `404` directory not found

cURL:
```bash
curl -X DELETE "http://localhost:5000/api/deletedir?directory=photos/2026" \
  -H "x-api-password: YOUR_PASSWORD"
```

### 6.5 Create directory
`POST /api/createdir?directory=<relative-dir>&password=<pwd>`

Success `200`:
```json
{ "status": "ok", "message": "Directory created!" }
```

cURL:
```bash
curl -X POST "http://localhost:5000/api/createdir?directory=photos/2026" \
  -H "x-api-password: YOUR_PASSWORD"
```

### 6.6 Get directory size
`GET /api/dirsize?directory=<relative-dir-or-empty>&password=<pwd>`

Rules:
- `directory` query key must exist (can be empty string to target root).

Success `200`:
```json
{ "status": "ok", "size": 987654321 }
```

cURL (root size):
```bash
curl "http://localhost:5000/api/dirsize?directory=" \
  -H "x-api-password: YOUR_PASSWORD"
```

### 6.7 Get disk stats
`GET /api/disk?password=<pwd>`

Success `200`:
```json
{ "status": "ok", "free": 1234567890, "total": 9876543210 }
```

cURL:
```bash
curl "http://localhost:5000/api/disk" \
  -H "x-api-password: YOUR_PASSWORD"
```

### 6.8 Rename file or directory
`POST /api/rename?path=<relative-path>&name=<new-name>&password=<pwd>`

Query params:
- `path`: existing relative path
- `name`: new name only (must not contain `/` or `\`)

Success `200`:
```json
{ "status": "ok", "message": "Renamed" }
```

cURL:
```bash
curl -X POST "http://localhost:5000/api/rename?path=photos/2026/photo.jpg&name=cover.jpg" \
  -H "x-api-password: YOUR_PASSWORD"
```

## 7) Minimal integration algorithm for external AI
1. Read API base URL and password from env:
   - `CLOUD_API_URL`
   - `CLOUD_API_PASSWORD`
2. For every request add header:
   - `x-api-password: <CLOUD_API_PASSWORD>`
3. For upload use multipart key `files` and optional keys (`directory`, `fileName`, `extension`, `generateName`).
4. Treat any non-2xx response as failure and parse JSON `{status,message,reason}` if present.
5. For file URLs returned by upload, use response array directly.

## 8) Recommended env for a third-party project
```env
CLOUD_API_URL=http://localhost:5000
CLOUD_API_PASSWORD=your_password_here
```

## 9) Compatibility notes
- API currently mixes REST styles (`GET` for file deletion, query params in `POST/DELETE`). External clients should follow the contract exactly.
- Upload response shape is intentionally non-standard (array body on success). Do not expect `{ status: "ok" }` in upload success body.
