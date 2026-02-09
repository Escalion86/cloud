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

  if (req.method !== 'DELETE' && req.method !== 'GET') {
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

  const { filePath } = req.query || {}
  if (!filePath) {
    res.status(400).json({ message: 'filePath is required' })
    return
  }

  const url = new URL('/api/deletefile', baseUrl)
  url.searchParams.set('filePath', filePath)

  try {
    const response = await fetch(url.toString())
    if (!response.ok) {
      res
        .status(response.status)
        .json({ message: 'Ошибка удаления файла' })
      return
    }
    const data = await response.json()
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сети' })
  }
}
