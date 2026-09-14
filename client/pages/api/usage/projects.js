const { isAuthed } = require('../../../lib/auth')

const normalizeBaseUrl = (baseUrl) => {
  if (!baseUrl) return null
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

export default async function handler(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  if (!['GET', 'POST'].includes(req.method)) {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const baseUrl = normalizeBaseUrl(
    process.env.SERVER_API_URL || 'http://localhost:5000',
  )
  if (!baseUrl) {
    res.status(500).json({ message: 'SERVER_API_URL is not set' })
    return
  }

  try {
    const response = await fetch(`${baseUrl}/api/usage/projects`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-password': process.env.SERVER_API_PASSWORD || '',
      },
      body: req.method === 'POST' ? JSON.stringify(req.body || {}) : undefined,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      res.status(response.status).json(
        data || { message: 'Не удалось выполнить операцию с проектом' },
      )
      return
    }
    res.status(response.status).json(data)
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сети' })
  }
}
