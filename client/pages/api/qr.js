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

  const { url } = req.body || {}
  if (!url || typeof url !== 'string') {
    res.status(400).json({ message: 'Некорректная ссылка' })
    return
  }

  const qrBaseUrl = normalizeBaseUrl(
    process.env.QR_API_URL || 'https://qr.escalion.ru'
  )

  if (!qrBaseUrl) {
    res.status(500).json({ message: 'QR API URL is not set' })
    return
  }

  const qrUrl = `${qrBaseUrl}/api/v1/qr/generate`

  try {
    const response = await fetch(qrUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'url',
        data: { url },
        options: {
          resolutionPreset: 'medium',
          margin: 2,
        },
      }),
    })

    if (!response.ok) {
      let message = 'Не удалось сгенерировать QR-код'
      try {
        const data = await response.json()
        if (data?.error) {
          message = data.error
        }
      } catch (error) {
        // ignore
      }
      res.status(response.status).json({ message })
      return
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).send(buffer)
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сети при генерации QR-кода' })
  }
}
