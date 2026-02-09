const { isAuthed } = require('../../lib/auth')

const normalizeBaseUrl = (baseUrl) => {
  if (!baseUrl) return null
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

export default async function handler(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const baseUrl = normalizeBaseUrl(
    process.env.SERVER_API_URL || 'http://localhost:5000'
  )

  if (!baseUrl) {
    res.status(500).json({ message: 'SERVER_API_URL is not set' })
    return
  }

  const { path, name } = req.query || {}
  if (!path || !name) {
    res.status(400).json({ message: 'path and name required' })
    return
  }

  const url = new URL('/api/rename', baseUrl)
  url.searchParams.set('path', path)
  url.searchParams.set('name', name)

  try {
    const response = await fetch(url.toString(), { method: 'POST' })
    if (!response.ok) {
      res.status(response.status).json({ message: 'Ошибка переименования' })
      return
    }
    const data = await response.json()
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сети' })
  }
}
