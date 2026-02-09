const { setAuthCookie } = require('../../../lib/auth')

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const appPassword = process.env.APP_PASSWORD
  if (!appPassword) {
    res.status(500).json({ message: 'APP_PASSWORD is not set' })
    return
  }

  const { password } = req.body || {}

  if (!password || password !== appPassword) {
    res.status(401).json({ message: 'Неверный пароль' })
    return
  }

  setAuthCookie(res)
  res.status(200).json({ ok: true })
}
