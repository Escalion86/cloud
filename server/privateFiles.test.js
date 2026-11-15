const test = require('node:test')
const assert = require('node:assert/strict')
const {
  MAX_FILE_SIZE,
  normalizeEntityStorageKey,
  normalizeArtistCrmStorageKey,
  sanitizeName,
  validateFile,
} = require('./privateFiles')

test('storageKey принимает новый ключ Vedelo и legacy-ключ ArtistCRM', () => {
  const valid =
    'vedelo/507f1f77bcf86cd799439011/events/507f1f77bcf86cd799439012/documents/upload-1'
  const legacy = valid.replace(/^vedelo\//, 'artistcrm/')
  const client = valid.replace('/events/', '/clients/')
  assert.equal(normalizeEntityStorageKey(valid), valid)
  assert.equal(normalizeEntityStorageKey(client), client)
  assert.equal(normalizeEntityStorageKey(legacy), legacy)
  assert.equal(normalizeEntityStorageKey(valid.replace(/^vedelo\//, 'other/')), '')
  assert.equal(normalizeArtistCrmStorageKey(legacy), legacy)
  assert.equal(normalizeArtistCrmStorageKey(`${valid}/extra`), '')
  assert.equal(normalizeArtistCrmStorageKey('../artistcrm/secret'), '')
  assert.equal(
    normalizeArtistCrmStorageKey(valid.replace('/events/', '/unknown/')),
    ''
  )
})

test('приватный upload ограничивает размер и тип', () => {
  assert.equal(
    validateFile({
      originalname: 'brief.xlsx',
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 123,
    }).extension,
    'xlsx'
  )
  assert.equal(
    validateFile({
      originalname: 'payload.html',
      mimetype: 'text/html',
      size: 123,
    }).code,
    'FILE_TYPE_NOT_ALLOWED'
  )
  assert.equal(
    validateFile({
      originalname: 'brief.pdf',
      mimetype: 'application/pdf',
      size: MAX_FILE_SIZE + 1,
    }).code,
    'FILE_TOO_LARGE'
  )
})

test('имя скачивания не содержит локальный путь и управляющие символы', () => {
  assert.equal(sanitizeName('C:\\secret\\brief\u0000.pdf'), 'brief_.pdf')
})
