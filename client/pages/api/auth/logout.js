const { clearAuthCookie } = require('../../../lib/auth')

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  clearAuthCookie(res)
  res.status(200).json({ ok: true })
}
