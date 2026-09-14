const normalizeBaseUrl = (baseUrl) => {
  if (!baseUrl) return null
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

  const usageToken = (req.headers['x-usage-token'] || '').toString().trim()
  if (!usageToken) {
    res.status(401).json({ message: 'X-Usage-Token is required' })
    return
  }

  try {
    const response = await fetch(`${baseUrl}/api/usage/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-usage-token': usageToken,
      },
      body: JSON.stringify(req.body || {}),
    })
    const data = await response.json().catch(() => null)
    res.status(response.status).json(
      data || { status: 'error', message: 'Некорректный ответ сервера' },
    )
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сети' })
  }
}
