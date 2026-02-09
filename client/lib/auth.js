const COOKIE_NAME = 'cloud_auth'

const getAuthCookieValue = () => process.env.AUTH_COOKIE_VALUE || 'ok'

const parseCookies = (cookieHeader) => {
  if (!cookieHeader) return {}
  return cookieHeader.split(';').reduce((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split('=')
    if (!rawKey) return acc
    acc[rawKey] = decodeURIComponent(rawValue.join('='))
    return acc
  }, {})
}

const isAuthed = (req) => {
  const cookies = parseCookies(req?.headers?.cookie)
  return cookies[COOKIE_NAME] === getAuthCookieValue()
}

const setAuthCookie = (res) => {
  const cookie = [
    `${COOKIE_NAME}=${encodeURIComponent(getAuthCookieValue())}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 24 * 7}`,
  ]
  if (process.env.NODE_ENV === 'production') {
    cookie.push('Secure')
  }
  res.setHeader('Set-Cookie', cookie.join('; '))
}

const clearAuthCookie = (res) => {
  const cookie = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ]
  if (process.env.NODE_ENV === 'production') {
    cookie.push('Secure')
  }
  res.setHeader('Set-Cookie', cookie.join('; '))
}

module.exports = {
  COOKIE_NAME,
  parseCookies,
  isAuthed,
  setAuthCookie,
  clearAuthCookie,
}
